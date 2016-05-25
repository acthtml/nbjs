/**
 * @fileOverview 数据库api
 */

import config from './config';
import mongoose from './mongoose';

export default {
  // mongoose实体
  mongoose : null,
  /**
   * 初始化
   */
  init(){
    let url = this.getConnectURL();
    mongoose.connect(url);

    this.mongoose = mongoose;
  },
  /**
   * 获取数据库的链接字符串。
   * mongodb://username:password@hostname:port/database
   *
   * 这里是简化版本，只需返回 username:password@hostname:port
   * @return {string} username:password@hostname:port
   */
  getConnectURL(){
    let {username, password, host, port, name = 'default'} = config.get('database');
    let url = '';
    url += username + '';
    if(password) url += ':' + password;
    if(url) url += '@';
    url += host;
    if(port) url += ':' + port;

    url += '/' + name;
    return 'mongodb://' + url;
  },
  // 缓存所有实体
  schemas : {},
  // 缓存所有模型
  models : {},
  /**
   * 根据hook.schema来创建对应的
   * @see  hook.schema()
   * @param  {string} name SchemaName
   * @return {object}      对应的schema
   */
  getSchema(name) {
    return this.schemas[name];
  },
  /**
   * 获取对应的model
   * @param  {string} name SchemaName
   * @return {function} 对应的model构造函数
   */
  getModel(name) {
    var model = this.models[name];
    if(!model){
      model = this.mongoose.model(name, this.getSchema(name));
      this.models[name] = model;
    }
    return model;
  },
  /**
   * 根据SchemaName和实体配置返回对应实体
   * @param  {string} name     SchemaName
   * @param  {object} instance 实体配置
   * @return {object}          对应的实体
   */
  getInstance(name, instance) {
    let Model = this.getModel(name);
    return  new Model(instance);
  },
  /**
   * 添加对应实体
   * @param {mixed} name  如果name为字符串，则将name作为SchemaName添加，如果name
   *                      为对象，则将对象中的每个属性作为SchemaName，值作为对应
   *                      的schema对象添加。
   * @param {object} schema 对应的schema对象
   */
  addSchema(name, schema) {
    var schemas = {};
    if(typeof name == 'object'){
      schemas = name;
    }else{
      var o = {};
      o[name] = schema;
      schemas = o;
    }

    for(var key in schemas){
      if(schemas.hasOwnProperty(key)){
        this.schemas[key] = schemas[key];
      }
    }
  },
  /**
   * 清除对应的实体
   * @param  {string} name 实体名称
   */
  removeSchema(name){
    delete this.schemas[name];
    delete this.models[name];
  }
}
