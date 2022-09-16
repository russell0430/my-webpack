
  (()=>{
    var __webpack_modules={
      './example/src/module.js':(module)=>{const name = "my-webpack";
module.exports = {
  name
};
const loader2 = 'baidu';
const loader1 = 'http://www.baidu.com';}
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
      const depModule = __webpack_require__("./example/src/module.js");

console.log(depModule, 'dep');
console.log('this is entry 2 !');
const loader2 = 'baidu';
const loader1 = 'http://www.baidu.com';
    })();
  })();
  