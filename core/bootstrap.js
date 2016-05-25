/**
 * @fileOverview 系统初始化引导
 */

import install from './install';
import config from './config';
import cache from './cache';

export async function bootstrap(phase){
  // @todo
  // 1. 错误捕获初始化
  // bootstrapErrorHandle();
  // 2. 环境变量初始化
  // bootstrapEnviorment();

  // 3. 尝试安装
  await install.attempt();

  // 4. 缓存初始化
  await cache.init();

  // 5. 系统配置初始化
  await config.init();

  // sesssion,path,router
}
