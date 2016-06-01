/**
 * @fileOverview my test a.
 */
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import path from 'path';

import Html from './component/html';
import Page from './component/page';

export async function router(router){
  router.get('/home', async (ctx, next) => {
    ctx.type = 'text/html';

    ctx.render = {
      html : Html,
      page : Page,
      app : path.join(__dirname, './component/app.js')
    }

    // console.log(appfilename);

    await next();
  });

  router.get('/', async (ctx, next) => {
    let views = ctx.session.views || 0;
    ctx.session.views = ++views

    ctx.body = 'views : ' + views;

    await next();
  })
}
