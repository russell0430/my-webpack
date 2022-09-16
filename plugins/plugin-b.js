// plugin-b.js

class PluginB{
  apply(compiler){
    // 注册同步钩子
    compiler.hooks.run.tap('Plugin B',()=>{
      console.log('PluginB');
    })
  }
}
module.exports=PluginB;