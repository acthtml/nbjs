/**
 * @fileOverview 应用服务
 */

import Koa from 'koa';
import Router from 'koa-router';

import config from './config';
import plugin from './plugin';

async function application(){
  let app = new Koa();

  // init session
  // init path


  // init routers
  let router = new Router();
  await plugin.invokeAll(router);
  app.use(router.routers());

  // start listen
  app.listen(config.get('port'));
}

function routers(app){

}

export default application;
