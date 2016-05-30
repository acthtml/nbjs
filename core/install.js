/**
 * @fileOverview 系统安装
 */

import config from './config';
import db from './database';
import plugin from './plugin';

export default {
  /**
   * 尝试安装
   */
  async attempt(){
    // 确认导入配置
    if(!await config.ensure()){
      throw new Error('系统配置文件site/config.js缺少，无法初始化。')
    }

    // 数据库初始化
    db.init();
    // 是否已安装
    if(await this.is()) return;

    // 进行安装程序
    await this.install();
  },
  /**
   * 系统是否已安装
   * @return {Boolean} 如果{plugins}集合中有system条目，则已安装
   */
  async is(){
    plugin.addSchema();

    let Plugin = db.getModel('Plugin');
    let rst = await Plugin
                .find({name : 'system'})
                .exec()
    return rst.length == 1;
  },
  /**
   * 进行安装程序
   */
  async install(){
    // @todo 命令行或UI交互

    // 插件初始化
    await plugin.init();
  }
}
