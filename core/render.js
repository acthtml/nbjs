/**
 * @fileOverview 页面输出
 */

import React from 'react';
import ReactDomServer from 'react-dom/server';
import webpack from './webpack'

export default async function render(ctx, next){
  await next();

  if(!ctx.render) return;

  // 进行打包
  let complier =  await webpack(ctx.render.app),
      scripts = 'files/js/' + complier.compilation.hash + '.js';



  let Page = ctx.render.page,
      Html = ctx.render.html;

  ctx.body = '<!DOCTYPE html>' + _render(Html, {page : _render(Page), scripts : scripts});
}

function _render(Component, props = {}, isStaticMarkup = false){
  return ReactDomServer[isStaticMarkup ? 'renderToString' : 'renderToStaticMarkup'](<Component {...props}/>);
}

