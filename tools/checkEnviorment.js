/**
 * @fileOverview 检测运行环境
 */

import config from '../core/config';
import install from '../core/install';
import db from '../core/database';

export default async function(){
  // 确认导入配置
  if(!await config.ensure()){
    console.log('系统配置文件site/config.js缺少，无法初始化。');
    return false;
  }

  // 数据库初始化
  db.init();
  // 是否已安装
  if(!await install.is()){
    console.log('系统尚未安装。请先使用npm run start进行初始化安装。');
    return false;
  }

  return true;
}
