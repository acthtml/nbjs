/**
 * @fileOverview 通过webpack进行打包文件
 */

import webpack from 'webpack';
import path from 'path';

/**
 * 文件打包
 * @param  {Array|String} files 需要打包的文件
 * @param  {String} destDir     打包后的目标文件夹
 * @return {String}             打包后的文件地址
 */
export default async function pack(files, destDir = 'site/files/js') {
  if(!files) return;

  // webpack 基础配置
  let config = {
    //入口
    entry: files,
    //出口
    output: {
      path: path.join(process.cwd(), destDir),
      filename: '[hash].js',
    },
    //装载器
    module: {
      loaders: [{ test: /\.js$/, exclude: /node_modules/, loader: "babel-loader" }]
    }
  };

  let stats = await wp(config)
                    .then(stats => {
                      return stats.toJson();
                    })
                    .catch(err => {
                      throw new Error('webpack 打包错误');
                    });

  return stats;
}


/**
 * webpack promise版本
 * @param  {Object} config 同webpackconfig
 * @return {Object}        webpack的promise
 */
function wp(config){
  let p = new Promise((res, rej) => {
    webpack(config, (err, stats) => {
      if(err)
        rej(err);
      let jsonStats = stats.toJson();
      if(jsonStats.errors.length > 0)
        rej(jsonStats.errors);
      if(jsonStats.warnings.length > 0)
        rej(jsonStats.warnings);
      res(stats);
    })
  })

  p.then(stats => stats)
   .catch(err => err);

  return p;
}
