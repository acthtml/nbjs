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
export default async function pack(files, destDir = '../site/files/js') {
  if(!files) return;

  // webpack 基础配置
  let config = {
    //入口
    entry: [],
    //出口
    output: {
      path: path.join(__dirname, destDir),
      filename: '[hash].js',
    },
    //装载器
    module: {
      loaders: [{ test: /\.js$/, exclude: /node_modules/, loader: "babel-loader" }]
    }
  };

  if(typeof files == 'string') files = [files];

  config.entry = files;
  let stats = await wp(config)
                    .catch(err => {
                      throw new Error('webpack 打包错误', err)
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
      if(err) rej(err);
      res(stats);
    })
  })

  p.then(stats => stats)
   .catch(err => err);

  return p;
}
