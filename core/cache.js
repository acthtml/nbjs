/**
 * @fileOverview 缓存系统
 */

import db from './database';
import config from './config';

export default {
  /**
   * 初始化
   */
  init(){
    // @注册schema
    this.initSchema();
  },
  /**
   * 获取缓存数据
   * @param  {string} id  缓存id
   * @param  {string} bin 缓存bin
   * @return {mix}        对应的缓存数据，如果过期，则返回null
   */
  async get(id, bin = 'Cache'){
    let items = await this.getMultiple([id], bin);
    return items[id];
  },
  /**
   * 批量获取缓存数据
   * @param  {Array} ids 以缓存id组成的数组
   * @param  {String} bin 缓存bin
   * @return {object}     以id为key构成的缓存数据，没有则为null
   */
  async getMultiple(ids, bin = 'Cache'){
    // GC
    await this.garbageCollection(bin);

    let Cache = db.getModel(bin);
    let rst = await Cache
      .where('name').in(ids)
      .exec()
      .catch(e => ([]))

    let items = {},
        now = Date.now();
    for(let i = 0; i < rst.length; i++){
      let item = rst[i];
      // 缓存过期则值为无效（null）
      items[item.name] = item.expire > now ? item.value : null;
    }

    // 将不在缓存中的值设置为null;
    for(let j = 0; j < ids.length; j++){
      let key = ids[j];
      if(!items.hasOwnProperty(key)){
        items[key] = null;
      }
    }

    return items;
  },
  /**
   * 设置缓存
   * @param {String} id           缓存id
   * @param {Mix} data            缓存数据
   * @param {String} bin          缓存bin
   * @param {Number} expire       缓存有效期毫秒数
   * @return {Boolean}            是否设置成功
   */
  async set(id, data, bin = 'Cache', expire = 0){
    if(!this.isValidBin(bin)) return false;

    let Cache = db.getModel(bin),
        rst = await Cache.where({name: id})
         .update({$set : {value : data, expire : expire, created : Date.now()}})
         .setOptions({upsert : true})
         .exec()
         .then( () => true)
         .catch( e => false);

    return rst;
  },
  /**
   * 清除缓存
   * @param  {string|Array|Regex} id       缓存id，id可为字符串或者数组，甚至正则表达式
   * @param  {String} bin                  缓存bin
   * @return {boolean}                     是否删除成功
   */
  async clear(id, bin = 'Cache'){
    if(!this.isValidBin(bin)) return false;

    let Config = db.getModel(bin),
        query,
        rst;

    // id为空，则只进行垃圾回收
    if(!id){
      return await this.garbageCollection(bin, true);
    }
    // id为*（星号），则删除全部
    else if(id == '*'){
      query = Config.find({})
    }
    // id为数组，删除数组中的
    else if(typeof id == 'object' && id.constructor == Array){
      query = Config.where('name').in(ids)
    }
    else{
      query = Config.find({name : id})
    }

    rst = await query.exec()
               .then(() => true)
               .catch(e => false);

    return rst;
  },

  /**
   * GC，缓存垃圾回收
   * @param  {String} bin       缓存bin
   * @param  {Boolean} force    是否无视cacheLifeTime(缓存回收周期)强制进行回收，只用于程序内部调用。
   * @return {boolean}          是否回收成功
   */
  async garbageCollection(bin = 'Cache', force = false){
    if(!this.isValidBin(bin)) return false;

    let cacheLifeTime = config.get('cacheLifeTime', 0), // 缓存回收周期，0表示不进行回收
        cacheFlushBin = 'cacheFlush' + bin,
        cacheFlush = config.get(cacheFlushBin, 0); // 上一次缓存GC时间，0表示尚未进行GC

    if(!cacheLifeTime && !force) return true;

    let now = Date.now(), // 当前时间
        success = true; // GC是否成功

    // 首次进行或者已过GC周期，则进行GC
    if(!cacheFlush || cacheFlush + cacheLifeTime >= now){
      let Cache = db.getModel(bin);
      success = await Cache
        .where('expire').ne(this.CACHE_PERMANENT)
        .where('expire').lt(now)
        .remove()
        .exec()
        .then(() => true)
        .catch(e => false);

      if(success) await config.set(cacheFlushBin, now);
    }

    return success;
  },

  /**
   * 是否为有效的缓存bin
   * @param {Boolean} bin 缓存bin
   * @param {Boolean} silent 是否不需要抛出错误
   * @return {Boolean} 是否有效
   */
  isValidBin(bin, silent = false){
    let valid = false;

    for(let i = 0; i < this.bins.length; i++){
      if(bin == this.bins[i]){
        valid = true;
        break;
      }
    }

    if(!silent && !valid){
      throw new Error('cache，不是合法的缓存bin：' + bin);
    }

    return valid;
  },
  /**
   * 有效的缓存bins
   * @type {Array}
   */
  bins:['Cache'],
  /**
   * 添加缓存bin
   * @param {String} bin 缓存bin，命名规则为'Cache*'
   * @todo  添加bin的命令规则验证
   */
  addBin(bin){
    if(this.isValidBin(bin, true)) return;

    db.addSchema(bin, this.getScheme());
    this.bins.push(bin);
  },
  /**
   * 删除缓存bin
   * @param  {string} bin 缓存bin
   */
  removeBin(bin){
    if(!this.isValidBin(bin, true)) return;

    db.removeSchema(bin);
    this.bins.splice(this.bins.indexOf(bin), 1);
  },
  /**
   * 根据缓存bin添加数据库schema
   * @param {String} bin 缓存bin
   */
  getScheme(){
    let schema = new db.mongoose.Schema({
      name : String,
      value : db.mongoose.Schema.Types.Mixed,
      expire : {type : Number, default : 0},
      created : {type : Number, default : Date.now}
    });

    return schema;
  },
  /**
   * 初始化缓存相关schema
   */
  initSchema(){
    for(let i = 0; i < this.bins.length; i++){
      db.addSchema(this.bins[i], this.getScheme());
    }
  },
  /**
   * 永久缓存，通过指定缓存id来删除。
   * @type {Number}
   */
  CACHE_PERMANENT : 0,
  /**
   * 临时缓存，再下次缓存清除（垃圾回收，clear方法）中进行删除。
   * @type {Number}
   */
  CACHE_TEMPORARY : -1
}
