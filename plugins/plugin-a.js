// plugin-a.js

class PluginA{
  apply(compiler){
    // 注册同步钩子
    compiler.hooks.run.tap('Plugin A',()=>{
      console.log('PluginA');
    })
  }
}
module.exports=PluginA;