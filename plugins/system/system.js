/**
 * @fileOverview system core
 */
import fsp from 'fs-promise';
import path from 'path';

/**
 * hook.router()
 */
export async function router(router){
  // 静态文件服务器
  router.get('/files/:filename', async function(ctx, next){
    let filename = path.join(process.cwd(), 'site/files', ctx.params.filename);

    // 查看文件是否存在
  })
}
