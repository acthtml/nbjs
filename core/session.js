/**
 * @fileOverview session
 * @todo 进行重构
 * {sessions} uid, sid, ssid, hostname, timestamp, cache, session
 */

import session from 'koa-session-store';
import MongooseStore from 'koa-session-mongoose';

import db from './database';

export default function(){
  return session({
    store : new MongooseStore({
      collection : 'sessions',
      connection : db.mongoose.connection,
      expires : 60 * 60 * 24 * 14, // 默认2周
      model : 'Session'
    })
  })
}
