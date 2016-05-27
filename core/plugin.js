/**
 * @fileOverview 插件系统
 *
 * 系统核心插件在 /plugins目录，用户自定插件在/site/plugins目录。
 *
 * 插件需要满足命名规则，即使在子目录中，都能被识别为有效的插件：
 *
 * - /pluginName
 *   - pluginName.js
 *   - pluginName.json
 *
 * @todo
 * - install/uninstall/enable/disable中的报错指引
 * - 上述操作用当插件涉及到npm package时包的操作
 * - update方案
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
    await this.scanLocalPlugins()
    // 重建插件列表
    await this.rebuildList();
    // 启用核心默认插件
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
   * 扫描本地插件，设置this.list.all
   * 只要插件满足
   * @todo  能扫描子目录
   */
  async scanLocalPlugins(){
    // 需要扫描的文件夹
    let dirs = ['plugins', 'site/plugins'],
        list = {},
        plugins = {};

    // 扫描文件夹，获取以dir为key，插件名称为value的插件列表plugins
    for(var i = 0; i < dirs.length; i++){
      plugins = _.assign(plugins, await this._scanLocalPlugins(dirs[i]));
    }

    // 将其转换成插件列表
    for(let dir in plugins){
      let name = plugins[dir],
          pluginInfo = require(path.join(process.cwd(), dir, name + '.json')),
          pluginInstance = {
            filepath : dir,
            name : name,
            status : 0,
            schemaVersion : -1,
            weight : 0,
            info : pluginInfo
          }

      if(list.hasOwnProperty(name)){
        list[dir] = pluginInstance;
      }else{
        list[name] = pluginInstance;
      }
    }

    this.list.all = list;
  },

  /**
   * 扫描出文件夹中的有效的插件
   * @param  {String} dir
   *         扫描文件夹，例如 'plugins', 'site/plugins'
   * @param  {String} name
   *         插件名称，如果指定插件名称，则只要该目录下有插件命名规范的文件(pluginName.js，
   *         pluginName.json)就算有效的插件，进而不用扫描子目录。
   * @return {Object}
   *         返回的插件列表，例如{'plugins/menu':'menu'}，其中key为插件所在文件夹
   *         地址（plugins/menu），value则为插件名称（menu）。。
   */
  async _scanLocalPlugins(dir, name = ''){
    let plugins = {};
    // 指定插件名称，查看当前目录是否具有插件命名规范的文件（pluginName.js和pluginName.json）
    if(name){
      // 符合命名规则
      if(await fsp.exists(path.join(process.cwd(), dir, name + '.js')) && await fsp.exists(path.join(process.cwd(), dir, name + '.json'))){
        plugins[dir] = name;
        return plugins;
      }
    }

    // 当前文件夹并不符合插件，扫描子目录。
    let files = await fsp.readdir(path.join(process.cwd(), dir));
    for(let i = 0; i < files.length; i++){
      // 当前文件是否为文件夹
      let isDir = await fsp.stat(path.join(process.cwd(), dir, files[i]))
                          .then(async status => status.isDirectory())
                          .catch(e => false);
      if(isDir){
        let pluginName = files[i];
        plugins = _.assign(plugins, await this._scanLocalPlugins([dir, pluginName].join('/'), pluginName));
      }
    }

    return plugins;
  },

  /**
   * 重建插件列表
   */
  async rebuildList(){
    let Plugin = db.getModel('Plugin'),
        listOfDB = null,
        list = this.list.all;

    // 获取数据库中的列表
    listOfDB = await Plugin.find().exec();

    for(let i = 0; i < listOfDB.length; i++){
      let plugin = listOfDB[i];
      // 在本地列表中，则同步一下本地列表的数据。
      if(list.hasOwnProperty(plugin.name)){
        list[plugin.name].status = plugin.status;
        list[plugin.name].schemaVersion = plugin.schemaVersion;
        list[plugin.name].weight = plugin.weight;

        if(plugin.status == 1) this.list.enabled.push(plugin.name);
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
   * 启用核心默认插件
   */
  async enableDefaultPlugins(){
    // 默认核心插件
    let defaultPlugins = ['system', 'menu'];
    await this.enable(defaultPlugins, true)
  },

  /**
   * 插件列表
   * @type {Object}
   */
  list : {
    // 所有的插件，key为插件机器名，value为插件详情。
    all : {},
    // 已启用的插件，每个值为插件机器名。
    enabled : [],
    // hooks列表，key为hookName，value为插件机器名。
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
    // 如果插件未实现回调，则返回undefined
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
  getDetails(name){
    return this.list.all[name];
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
        plugin = this.getDetails(name),
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
   * @param  {String} name  插件名称，不指定则安装所有插件
   */
  async install(name){
    // 已安装则不进行安装
    let detials = this.getDetails(name);
    if(detials.schemaVersion != -1) return;

    // 进行安装
    await this.invoke(name, 'install');

    // 获取和设置当前的schema版本号
    let schemaVersion = this.getSchemaVersion(name);
    detials.schemaVersion = schemaVersion;

    // 更新数据库
    let Plugin = db.getModel('Plugin');
    await Plugin
            .where('name', name)
            .update({schemaVersion : schemaVersion})
            .exec();
  },

  /**
   * 卸载指定插件
   *
   * @param  {string} name 差价名称
   */
  async uninstall(name){
    // 已卸载则不进行卸载
    let details = this.getDetails(name);
    if(details.schemaVersion == -1) return;

    // 进行卸载
    await this.invoke(name, 'uninstall');

    // 更新数据库
    details.schemaVersion = -1;
    let Plugin = db.getModel('Plugin');
    await Plugin
            .where('name', name)
            .update({schemaVersion : -1})
            .exec()
  },

  /**
   * 利用npm安装指定依赖
   * @param  {array} packages 依赖列表
   * @todo  进行测试
   */
  async installPackages(packages){
    if(!packages || packages && packages.length == 0) return true;

    if(!_.isArray(packages)){
      packages = [packages];
    }

    for(var i = 0; i < packages.length; i++){
      await this.installPackage(packages[i])
            .catch( e => false);
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
   * 停用插件
   *
   * @param  {String|Array} name 停用的插件名称，可以是数组，也可以是字符串
   * @param  {Boolean} disableDependencies 是否停用其依赖插件
   * @return {Boolean} 是否全部停用成功
   */
  async disable(name, disableDependencies){
    let success = true;

    // 当name为数组时，依次启用插件
    if(_.isArray(name)){
      for(let i = 0; i < name.length; i++){
        success = await this.disable(name[i], disableDependencies);
        if(!success) break;
      }
      return success;
    }

    let details = this.getDetails(name);

    // 查看插件依赖是否已安装
    if(disableDependencies){
      let dependencies = details.info.pluginDependencies;
      if(dependencies && dependencies.length){
        success = await this.disable(dependencies, disableDependencies);
      }
    }

    // 已启用则进行停用
    if(this.list.enabled.indexOf(name) > -1){
      details.status = 0;
      this.list.enabled.splice(this.list.enabled.indexOf(name), 1);
      this.list.hoos = {};

      let Plugin = db.getModel('Plugin');
      await Plugin
              .where('name', name)
              .update({status:0})
              .exec();
    }

    return success;
  },

  /**
   * 启用插件
   *
   * @param  {String|Array} name 启用插件名称，可以是数组，也可以是字符串。
   * @param  {Boolean} enableDependencies 是否启用依赖插件
   * @return {Boolean} 是否全部启用成功
   * @todo 启用失败时，返回错误详情。
   */
  async enable(name, enableDependencies){
    let success = true;

    // 当name为数组时，依次启用插件
    if(_.isArray(name)){
      for(let i = 0; i < name.length; i++){
        success = await this.enable(name[i], enableDependencies);
        if(!success) break;
      }
      return success;
    }

    let details = this.getDetails(name);

    // 查看插件依赖是否已安装
    if(enableDependencies){
      let dependencies = details.info.pluginDependencies;
      if(dependencies && dependencies.length){
        success = await this.enable(dependencies, enableDependencies);
      }
    }

    // 尚未启用则进行启用
    if(this.list.enabled.indexOf(name) == -1){
      // 1. 安装package依赖
      await this.installPackages(details.info.packageDependencies);
      // 2. 进行安装
      await this.install(name);

      details.status = 1;
      this.list.enabled.push(name);
      this.list.hoos = {};

      let Plugin = db.getModel('Plugin');
      await Plugin
              .where('name', name)
              .update({status:1})
              .exec();
    }
    return success;
  },

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
   * 实现指定钩子函数的以启用插件有哪些
   *
   * @param  {string} hook  钩子函数名称
   * @param  {boolean} sort 是否排序 默认为false，按插件的权重weight从小到大排序。true则按插件名称排序。
   * @return {array}       以数组形式返回实现指定钩子函数的插件名称。
   *
   * @todo  排序
   */
  implements(hook, sort){
    // 优先读取缓存列表
    let list = this.list.hooks[hook];

    // 没有缓存，重新生成。
    if(!list){
      list = [];
      for(let name in this.list.all){
        if(this.implement(name, hook)) list.push(name);
      }
      // 将结果缓存
      this.list.hooks[hook] = list;
    }

    return list;
  },

  /**
   * 获取插件安装的schemaVersion
   * @param  {string} name 插件名称
   * @return {number}    schemaVersion
   */
  getSchemaVersion(name){
    return this.getDetails(name).info.version;
  }
}
