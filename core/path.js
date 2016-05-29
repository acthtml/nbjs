/**
 * @fileOverview 路径别名（path alias）
 */
import db from './database';

export default {
  init(){

  },
  addSchemas(){
    let schema = new db.mongoose.Schema({
      source : String,
      alias : String
    })
  },
  inited: false,

}
