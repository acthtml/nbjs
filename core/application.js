/**
 * @fileOverview 应用服务
 */

import Koa from 'koa';
import router from 'koa-router';

import config from './config';

function application(){
  let app = new Koa();

  // init session
  // init path
  // init routers
  // start listen
  app.listen(config.get(port));
}

export default application;
