/**
 * @fileOverview 插件系统
 */
import fs from 'fs';
import _ from 'lodash';
import path from 'path';
import fsp from 'fs-promise';
import npm from 'npm';

import db from './database';

export default {
  /**
   * 插件的初始化
   */
  async init(){
    // 初始化插件相关的schema
    this.initSchema();
    // 扫描本地插件
    await this.scanLocalPlugins();
    // 重建插件列表
    await this.rebuildList();
    // 开启默认插件
    await this.enableDefaultPlugins();
  },

  /**
   * 初始化插件相关的schema
   */
  initSchema(){
    if(db.getSchema('Plugin')) return;

    let schema = new db.mongoose.Schema({
      filepath : String,
      name : String,
      status : {type:Number, default:0},
      schemaVersion : {type:db.mongoose.Schema.Types.Mixed, default:-1},
      weight : {type: Number, default:0},
      info : Object
    }, {name : 1, weight : 1})

    db.addSchema('Plugin', schema);
  },

  /**
   * 扫描本地插件，设置this.cache.list
   */
  async scanLocalPlugins(){
    // 需要扫描的文件夹
    let dirs = ['plugins', 'site/plugins'],
        list = {};

    // 扫描文件夹
    for(var i = 0; i < dirs.length; i++){
      let dir = path.join(process.cwd(), dirs[i]);
      let files = await fsp.readdir(dir);
      // 扫描文件夹的内容。
      for(var j = 0; j < files.length; j ++){
        // 是否是文件夹
        let isDir = await fsp.stat(path.join(dir, files[j]))
                            .then(async status => {
                              return status.isDirectory()
                            })
        // 如果是文件夹，查看是否符合[pluginName]/[pluginName].js + [pluginName]/[pluginName].json
        let pluginName = files[j]
        if(isDir && await fsp.stat(path.join(dir, pluginName, pluginName + '.js')) && await  fsp.stat(path.join(dir, pluginName, pluginName + '.json'))){
          let pluginInfo = require(path.join(dir, pluginName, pluginName + '.json')),
              pluginInstance = {
                filepath :[dirs[i], pluginName].join('/'),
                name : pluginName,
                status : 0,
                schemaVersion : 0,
                weight : 0,
                info : pluginInfo
              }
          list[pluginName] = pluginInstance;
        }
      }
    }

    this.cache.list = list;
  },

  /**
   * 重建插件列表
   */
  async rebuildList(){
    let Plugin = db.getModel('Plugin'),
        listOfDB = null,
        list = this.cache.list;

    // 获取数据库中的列表
    listOfDB = await Plugin.find().exec();

    for(let i = 0; i < listOfDB.length; i++){
      let plugin = listOfDB[i];
      // 在本地列表中，则同步一下本地列表的数据。
      if(list.hasOwnProperty(plugin.name)){
        list[plugin.name].status = plugin.status;
        list[plugin.name].schemaVersion = plugin.schemaVersion;
        list[plugin.name].weight = plugin.weight;

        if(plugin.status == 1) this.cache.enabled.push(plugin.name);
      }
    };

    // 清空plugins集合，重新
    await Plugin.remove();
    // 将本地数据插入数据库
    for(let name in list){
      if(!list.hasOwnProperty(name)) continue;

      let plugin = db.getInstance('Plugin', list[name]);
      await plugin.save();
    }
  },

  /**
   * 开启默认插件
   */
  async enableDefaultPlugins(){
    let defaultPlugins = ['system', 'menu'];

    await this.enable(defaultPlugins, true)
  },

  // cache
  cache : {
    // all plugins
    list : {},
    // all installed and enabled plugins
    enabled : [],
    // hooks hash object
    hooks : {}
  },

  /**
   * 触发指定插件的指定钩子函数。
   *
   * @param  {string} name     插件名称
   * @param  {string} hook 钩子函数名称
   * @return {mix}
   */
  async invoke(name, hook, ...args){
    let model = this.get(name, hook);

    // 如果该插件实现了该回调，则返回执行结果。
    if(this.implement(name, hook)){
      return model[hook](...args);
    }
    // 如果插件为实现回调，则返回undefined
    else{
      return;
    }
  },

  /**
   * 触发所有已启用插件的指定钩子函数
   *
   * @param  {string}    hook 钩子函数名称
   * @return {mix}
   */
  async invokeAll(hook, ...args){
    let list = this.implements(hook),
        result = {};

    for(let i = 0; i < list.length; i++){
      let name = list[i];
      let hookResult = await this.invoke(name, hook, ...args);
      // 结果是对象，进行合并
      if(_.isObject(hookResult)){
        _.assign(result, hookResult);
      }
      // 结果非对象，则将结果以数组形式合并输出。
      else{
        // 将结果转换成数组形式
        if(_.isObject(result)) result = [];
        // 结果为数组
        if(_.isArray(hookResult)){
          result.contact(hookResult);
        }
        // 结果为非数组
        else{
          result.push(hookResult);
        }
      }
    }

    return result;
  },


  /**
   * 根据插件名称获取插件信息
   *
   * @param  {string} name 插件名称
   * @return {object}      插件信息
   */
  getInfo(name){
    return this.cache.list[name];
  },

  /**
   * 根据插件名称和钩子函数名称获取钩子函数所在的文件模块，如果钩子函数名称未提供，
   * 则返回主插件文件。列如：plugins/name/name.js
   *
   * @param  {string} name 插件名称
   * @param  {string} hook 钩子函数名称
   * @return {mix}      返回所在文件的模块，如果插件无效，则返回undefined。
   */
  get(name, hook){
    let filename = this.getFileName(name, hook);

    if(!filename) return;

    filename = path.join(process.cwd(), filename)

    // 判断文件是否存在和可执行。
    if(fs.existsSync(filename)){
      return require(filename);
    }else{
      return;
    }
  },

  /**
   * 根据插件名称和钩子函数名称返回钩子函数所在的文件路径
   *
   * @param  {string} name 插件名称
   * @param  {string} hook 钩子函数名称
   * @return {string}
   *    钩子函数所在文件路径，例如：plugins/system/system.install。没有指定的插件
   *    则返回undefined.
   */
  getFileName(name, hook){
    let ext = this.getFileExtension(hook),
        plugin = this.getInfo(name),
        filename;

    if(!plugin) return;

    filename = name;
    if(ext) filename += '.' + ext;

    filename = [plugin.filepath, filename].join('/');
    return filename;
  },

  /**
   * 根据钩子函数名称获取钩子函数所在文件的后缀。
   *
   * @param  {string} hook 钩子函数名称
   * @return {string}      钩子函数所在文件的后缀
   */
  getFileExtension(hook){
    let ext = '';

    switch(hook){
      case 'install':
      case 'schema' :
        ext = 'install';
        break;
      default :
        ext = 'js'
    }

    return ext;
  },

  /**
   * 安装指定插件
   *
   * @param  {String} name 插件名称，不指定则安装所有插件
   * @return {boolean}  安装成功则返回true。
   */
  async install(name){
    if(this.inArray(name, this.cache.enabled)) return true;

    await this.invoke(name, 'install');

    let schemaVersion = this.getSchemaVersion(name);
    this.cache.list[name].schemaVersion = schemaVersion;

    let Plugin = db.getModel('Plugin');
    await Plugin.update({
      name : name
    }, {
      schemaVersion : schemaVersion
    });

    return true;
  },

  /**
   * 卸载指定插件
   *
   * @param  {string} name 差价名称
   * @return {boolean}     卸载成功返回true
   */
  async uninstall(name){
    await name ? this.invoke(name, 'uninstall') : this.invokeAll('uninstall');
  },

  /**
   * 开启指定插件
   *
   * @param  {string} name 插件名称，可以是数组，也可以是字符串。
   * @param  {boolean} isDependencies 是否开启依赖插件
   * @return {boolean} 开启成功返回true
   * @todo
   *   - 判断是否安装成功
   */
  async enable(name, isDependencies){
    if(_.isArray(name)){
      for(let i = 0; i < name.length; i++){
        let isSuccess = await this.enable(name[i], isDependencies);
        if(!isSuccess) return false;
      }
      return true;
    }

    let info = this.getInfo(name);

    // 查看插件依赖是否已安装
    if(isDependencies){
      let dependencies = info.info.pluginDependencies;
      if(dependencies && dependencies.length){
        await this.enable(dependencies, isDependencies);
      }
    }

    // 未安装则进行安装
    if(!this.inArray(name, this.cache.enabled)){
      // 1. 安装package依赖
      await this.installPackages(info.info.packageDependencies);
      // 2. 进行安装
      await this.install(name);

      info.status = 1;
      this.cache.enabled.push(name);

      let Plugin = db.getModel('Plugin');
      await Plugin.update({
        name : name
      }, {
        status : 1
      })
    }

    return true;
  },

  /**
   * 利用npm安装指定依赖
   * @param  {array} packages 依赖列表
   */
  async installPackages(packages){
    if(!packages || packages && packages.length == 0) return true;

    if(!_.isArray(packages)){
      packages = [packages];
    }

    for(var i = 0; i < packages.length; i++){
      await this.installPackage(packages[i])
            .catch( e => {
              console.log(packages[i], 'pacakge install error:', e)
              return false;
            });
    }

    return true;
  },
  /**
   * 安装指定包
   * @param  {string} name 包名称
   */
  async installPackage(name){
    let p = new Promise((res, rej) => {
      npm.load({}, err => {
        if(err) rej(err);

        npm.commands.install([name], (err, data) => {
          if(err) rej(err);

          res(true);
        })
      })
    })

    return p;
  },
  /**
   * 是否在数组中
   */
  inArray(value, arr){
    for(let i = 0; i < arr.length; i++){
      if(value == arr[i]) return true;
    }
    return false;
  },

  /**
   * 关闭指定插件
   *
   * @param  {string} name 插件名称
   * @return {boolean}     关闭成功返回true
   */
  disable(name){},

  /**
   * 指定插件是否实现指定钩子函数
   *
   * @param  {string} name 插件名称
   * @param  {string} hook 钩子函数名称
   * @return {boolean}     实现指定钩子函数则返回true
   */
  implement(name, hook){
    let model = this.get(name, hook);
    return model && model.hasOwnProperty(hook);
  },

  /**
   * 哪些已启用的插件实现了指定钩子函数
   *
   * @param  {string} hook  钩子函数名称
   * @param  {boolean} sort 是否排序 默认为false，按插件的权重weight从小到大排序。true则按插件名称排序。
   * @return {array}       以数组形式返回实现指定钩子函数的插件名称。
   *
   * @todo  排序
   */
  implements(hook, sort){
    // 优先读取缓存列表
    let list = this.cache.hooks[hook];

    // 没有缓存，重新生成。
    if(!list){
      list = [];
      for(let name in this.cache.list){
        if(this.implement(name, hook)) list.push(name);
      }
      // 将结果缓存
      this.cache.hooks[hook] = list;
    }

    return list;
  },

  /**
   * 获取插件安装的schemaVersion
   * @param  {string} name 插件名称
   * @return {number}    schemaVersion
   */
  getSchemaVersion(name){
    return this.getInfo(name).info.version;
  }
}
