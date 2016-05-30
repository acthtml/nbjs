/**
 * @fileOverview 系统初始化引导
 */

import install from './install';
import plugin from './plugin';
import config from './config';
import cache from './cache';
import application from './application';

export default async function bootstrap(phase){
  // @todo
  // 1. 错误捕获初始化
  // bootstrapErrorHandle();
  // 2. 环境变量初始化
  // bootstrapEnviorment();

  // 3. 尝试安装，数据库初始化
  await install.attempt();

  // 4. 插件初始化
  await plugin.init();

  // 5. 缓存初始化
  await cache.init();

  // 6. 系统配置初始化
  await config.init();

  // 7. 初始化应用服务
  await application();
}
