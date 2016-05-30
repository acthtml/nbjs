/**
 * @fileOverview my test a.
 */

export async function router(router){
  router.get('/home', async (ctx, next) => {
    ctx.body = 'home page';
    await next();
  });

  router.get('/', async (ctx, next) => {
    let views = ctx.session.views || 0;
    ctx.session.views = ++views

    ctx.body = 'views : ' + views;

    await next();
  })
}


function home(){
  return {
    'wrapper' : {
      '$component' : 'wrapper',
      page : {
        '$component' : 'page',
        'header' : {
          '$component' : 'header'
        },
        'content' : {
          '$component' : 'content'
        },
        'footer' : {
          '$component' : 'footer'
        }
      }
    }
  }
}
