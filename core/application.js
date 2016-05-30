/**
 * @fileOverview 应用服务
 */

import Koa from 'koa';
import Router from 'koa-router';

import config from './config';
import plugin from './plugin';
import session from './session';

async function application(){
  let app = new Koa();

  // init session
  app.keys = config.get('secretKeys', [config.get('hashSalt')]);
  app.use(session());

  // init path
  // @todo path alias

  // init routers
  let router = new Router();
  await plugin.invokeAll('router', router);
  app.use(router.routes());

  // start listen
  app.listen(config.get('port'));
}

function routers(app){

}

export default application;
