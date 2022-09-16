// code usage of webpack
// const webpack=require('webpack');

// const compiler=webpack({
//   //[configuration Object](/configuration/)
// });

// compiler.run((err,stats)=>{//[Stats Object](#stats-object)
//   // ...
//   compiler.close((closeErr)=>{

//   });
// });
const Compiler=require('./compiler');
function webpack(options) {
  const mergeOptions = _mergeOptions(options);
  const compiler = new Compiler(mergeOptions);
  // 加载插件
  _loadPlugin(options.plugins, compiler);
  return compiler;
}

function _mergeOptions(options) {
  const shellOptions = process.argv.slice(2).reduce((option, argv) => {
    // argv -> --mode=production
    const [key, value] = argv.split('=');
    if (key && value) {
      const parseKey = key.slice(2); // get rid of '--'
      option[parseKey] = value;
    }
  }, {});
  return { ...options, ...shellOptions };
}

function _loadPlugin(plugins, compiler) {
  if (plugins && Array.isArray(plugins)) {
    plugins.forEach(plugin => {
      plugin.apply(compiler);
    })
  }
}
module.exports = webpack;