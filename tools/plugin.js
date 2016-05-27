/**
 * @fileOverview 插件管理工具
 *
 * ```shell
 * # 插件安装
 * npm run plugin install pluginName
 * # 插件卸载
 * npm run plugin uninstall pluginName
 * # 插件启用，支持多插件，支持启用依赖
 * npm run plugin enable pluginNameA pluginNameB true
 * # 插件关闭，支持多差劲，支持关闭依赖
 * npm run plugin enable pluginNameA pluginNameB true
 *
 * @todo 这些命令应该在npm run start之后使用，这样避免再次环境重建。
 */

import plugin from '../core/plugin';
import checkEnviorment from './checkEnviorment';

async function run(){
  if(!await checkEnviorment()) return;

  // @todo 临时用一下
  await plugin.init();

  // 有效的命名
  let actions = ['install', 'uninstall', 'enable', 'disable'];

  // 当前的命令参数
  let args = process.argv.slice(2);

  // 参数是否有效
  if(args.length == 0 || args.length > 0 && actions.indexOf(args[0]) == -1){
    console.log('请使用有效的插件操作命令：', actions);
    return;
  }

  // 当前的操作
  let action = args[0];
  // 当前操作对应的参数
  args = args.slice(1);
  if(args.length == 0){
    console.log('请指明需要操作的插件名称。');
    return;
  }

  console.log('开始执行', action, ...args);
  if(action == 'install' || action == 'uninstall'){
    await plugin[action](args[0]);
  }else{
    let isDependencies = false;
    if(args.indexOf('true') >= 0){
      args = args.splice(args.indexOf('true'), 1);
      isDependencies = true;
    }else if(args.indexOf('false') >= 0){
      args = args.splice(args.indexOf('false'), 1);
    }

    await plugin[action](args, isDependencies);
  }
  console.log('结束执行', action, ...args);
}


run()
  .catch( e => {
    console.log('插件操作失败', e, e.stack)
  })
