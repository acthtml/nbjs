/**
 * @fileOverview 启动服务
 */

import bootstrap from '../core/bootstrap';

bootstrap()
  .then(() => {
    console.log('服务启动成功。')
  })
  .catch(e => {
    console.log('服务启动失败，', e, e.stack);
  })
