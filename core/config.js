/**
 * @fileOverview 系统配置
 */

import fsp from 'fs-promise';
import path from 'path';
import db from './database';
import cache from './cache';

export default {
  // 系统配置
  configs : null,
  /**
   * 系统配置文件的确认并导入
   * @return {boolean} 是否导入成功
   */
  async ensure(){
    // 是否有文件
    let isExist = await fsp.stat(this.path())
                      .then(stats => {
                        return stats.isFile();
                      })
                      .catch(e => {
                        return false;
                      })

    if(!isExist) return false;

    // 导入配置
    let configs = require(this.path());
    this.configs = configs.default;
    return true;
  },
  /**
   * 从数据库中导入配置并初始化
   * @return {boolean} 是否初始化成功
   */
  async init(){
    this.initSchema();

    let configs = await cache.get('configs');
    if(!configs){
      configs = {};
      // 从配置集合中获取
      let Config = db.getModel('Config'),
          rst = await Config.find({}).exec();
      for(let i = 0; i < rst.length; i++){
        let conf = rst[i];
        configs[conf.name] = conf.value;
      }
      // 重新设置缓存
      await cache.set('configs', configs);
    }

    // 将初始中的文件配置覆盖数据库配置
    for(let key in this.configs){
      if(this.configs.hasOwnProperty(key)) configs[key] = this.configs[key];
    }

    this.configs = configs;
  },
  /**
   * 初始化配置相关schema
   */
  initSchema(){
    let schema = new db.mongoose.Schema({
      name : String,
      value : db.mongoose.Schema.Types.Mixed
    });

    db.addSchema('Config', schema);
  },
  /**
   * 获取系统配置
   * @param  {string} name 配置名称
   * @param  {mix} def  默认值
   * @return {mix}      返回指定配置的值
   */
  get(name, def){
    if(!this.configs.hasOwnProperty(name)){
      return def;
    }else{
      return this.configs[name];
    }
  },
  /**
   * 设置系统配置
   * @param {string} name  配置名称
   * @param {mix} value 配置值
   * @return {boolean}  配置是否设置成功
   */
  async set(name, value){
    // 数据库中更新配置
    let Conf = db.getModel('Config');
    let rst = await Config.update({name : name}, {name : name, value : value}, {upsert : true})
                    .exec()
                    .then(() => true)
                    .catch(e => false);

    // 数据库中更新成功则在本地更新
    if(rst){
      this.configs[name] = value;
      await cache.set('configs', this.configs);
    }

    return rst;
  },
  /**
   * 删除系统配置
   * @param  {string} name 配置名称，如不指定，则删除所有配置
   * @return {boolean}      是否删除成功
   */
  async del(name){
    // 删除条件
    let opt;

    // 未指定配置名称，删除全部
    if(!name){
      opt = {};
    }
    // 有对应的配置
    else if(this.configs.hasOwnProperty(name)){
      opt = {name : name}
    }
    // 无对应的配置
    else{
      return true;
    }

    // 删除数据库中对应的条目
    let Conf = db.getModel('Config'),
        rst = await Config.remove(opt)
                          .exec()
                          .then(() => true)
                          .catch(e => false)
    // 数据库中更新成功
    if(rst){
      if(name){
        delete this.configs[name];
      }else{
        this.configs = {}
      }

      await cache.set('configs', this.configs);
    }

    return rst;
  },
  /**
   * 配置文件的路径
   */
  path(){
    let dest = 'site/configs.js';
    return path.join(process.cwd(), dest);
  }
}
