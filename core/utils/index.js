
const fs=require('fs');
/**
 * 
 * 统一路径分隔符,为后续生成模块ID方便
 * @param {*} path
 * @returns
 */
// 不同的操作系统下,文件分割路径不同,
// 这里统一使用 '\' 替换路径中的 '//' 
// 后续使用模块相对于rootPath的路径作为每一个文件的唯一Id
function toUnixPath(path) {
  return path.replace(/\\+/g, '/');
}


/**
 * @param{*} modulePath 模块绝对路径
 * @param{*} extensions 扩展名数组
 * @param{*} orginModulePath 原始引入模块路径
 * @param{*} moduleContext 模块上下文(当前模块所在目录)
 * @return
 */

function tryExtensions(
  modulePath, extensions, orginModulePath, moduleContext
) {
  // 优先尝试不需要扩展名
  extensions.unshift('');
  for(let extension of extensions){
    if(fs.existsSync(modulePath+extension)){
      return modulePath+extension;
    }
  }
  throw new Error(`No module,Error: Can not resolve ${orginModulePath} in ${oduleContext}` )
}
/**
 * 
 * @param {*} chunk 
 * name 属性入口文件名
 * entryModule 入口文件module对象
 * modules 依赖模块路径
 */
function getSourceCode(chunk){
  const {name,entryModule,modules}=chunk;
  return `
  (()=>{
    var __webpack_modules={
      ${
        modules.map((module)=>{
        return `'${module.id}':(module)=>{${module._source}}`;
      }).join(',')}
    };
    // The module cache
    var __webpack_module_cache__={};
    // The require function
    function __webpack_require__(moduleId){
      // Check if module is in cache
      var cachedModule=__webpack_module_cache__[moduleId];
      if(cachedModule!==undefined){
        return cacheModule.exports;
      }
      // Create a new module ( and put it into the cache)
      var module=(__webpack_module_cache__[moduleId]={
        // no module.id needed
        // no module.loaded needed
        exports:{}
      });
      
      // Execute the module function 
      __webpack_modules__[moduleId](module,module.exports,__webpack_require__);
      
      // Return the exports of the module
      return module.exports;
    }
    
    var __webpack_exports__={};
    // This entry need to be wrapped in an IIFE 
    // ,because it need to be isolated against other moduels in the chunk
    (()=>{
      ${entryModule._source}
    })();
  })();
  `;
}
// 在getSourceCode中,通过组合而来的chunk获得对应的
// - name :该入口文件对应输出文件的名称.
// - entryModule :存放在该入口文件编译后的对象
// - modules :存放该入口文件依赖的所有模块对象
// 通过字符串拼接的方式实现 __webpack_module 对象的属性
// 同时在底部通过${entryModule._source} 拼接出入口恩建的代码.
// 这里我们将模块的require方法转化成相对于根路径的context的路径,
// 因为最终实现的__webpack_require__方法都是针对于模块跟路径的相对路径自己实现的require
module.exports = {
  toUnixPath,
  tryExtensions,
  getSourceCode,
}