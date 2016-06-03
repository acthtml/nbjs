/**
 * @fileOverview 应用服务
 */

import Koa from 'koa';
import Router from 'koa-router';
import staticServer from 'koa-static-server';

import config from './config';
import plugin from './plugin';
import session from './session';
import render from './render';

async function application(){
  let app = new Koa();

  // init render
  app.use(render);

  // init static server
  app.use(staticServer({rootDir: 'site/files', rootPath: '/files'}));

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

export default application;
