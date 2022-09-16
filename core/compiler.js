// compiler.js

// babel
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generator = require('@babel/generator').default;
const t = require('@babel/types');
const { tryExtensions,getSourceCode } = require('./utils');

const { SyncHook } = require('tapable');
const { toUnixPath } = require("./utils");
const path = require("path");
const fs = require('fs');
// Compiler
class Compiler {
  constructor(options) {
    this.options = options;

    this.rootPath = this.options.context || toUnixPath(process.cwd());
    // 创建plugin hooks
    this.hooks = {
      // 开始编译的hook
      run: new SyncHook(),
      // 输出asset到output之前执行(写入文件之前)
      emit: new SyncHook(),
      // 在compilation完成时执行,完成全部编译执行
      done: new SyncHook(),
    }
    // 保存所有入口模块对象
    this.entries = new Set();
    // 保存所有依赖模块对象
    this.modules = new Set();
    // 所有的代码块对象
    this.chunks = new Set();
    // 存放本次产出的文件对象
    this.assets = new Set();
    // 存放本次编译所有产出的文件名
    this.files = new Set();


  }
  // register hook example =>  compiler.hooks.run.tap()

  //run() 启动编译,接受我外部传递callback
  run(callback) {
    // 调用run时,触发开始编译的plugin
    // 告诉订阅者,发布开始执行的订阅,执行关于run的所有tap监听方法
    // 触发对应的plugin逻辑
    this.hooks.run.call();

    const entry = this.getEntry();
    // 编译入口文件
    this.buildEntryModule(entry);
    // 导出列表,将每一个chunk转化为单独文件加入输出列表assets中
    this.exportFile(callback);
  }
  /**
   * this.options.entry这里考录比较常见的两种配置
   * 1. entry:'entry.js'
   * 2. entry:{ 
   *     'entry1':'entry1.js',
   *     'entry2':'entry2.js'
   *    }
   * 这两种方式都会经过getEntry转化成以下形式
   * {
   *  [模块名]:[模块绝对路径] 
   * }
   * 
   * @param {}
   * @returns 
   */
  getEntry() {
    let entry = Object.create(null);
    const { entry: optionsEntry } = this.options;
    if (typeof optionsEntry === 'string') {
      entry['main'] = optionsEntry;
    } else {
      entry = optionsEntry;
    }

    // 将entry变成绝对路径
    Object.keys(entry).forEach((key) => {
      const value = entry[key];
      if (!path.isAbsolute(value)) {
        // 转化为绝对路径同时 统一分隔符为'/'
        entry[key] = toUnixPath(path.join(this.rootPath, value));
        // console.log(entry[key]);
      }
      else {
        entry[key] = toUnixPath(value);
      }
    })
    // console.log('entry',entry);
    return entry;
  }
  buildEntryModule(entry) {
    Object.keys(entry).forEach((entryName) => {
      const entryPath = entry[entryName];
      const entryObj = this.buildModule(entryName, entryPath);
      this.entries.add(entryObj);
      this.buildUpChunk(entryName,entryObj);
    });
    // console.log(this.entries, 'entries');
    // console.log(this.modules, 'modules');
  }
  // buildModule 需要进行的工作
  // 1. buildModule 接受两个参数进行模块编译,
  //    一个是模块所属的入口文件名称,第二个是编译的模块路径
  // 2. buildModule方法进行代码编译的前提是,通过fs模块根据入口文件路径读取文件源代码
  // 3. 读取文件内容之后,调用所有匹配的loader对模块进行处理得到返回的结果
  // 4. 得到loader处理后的结果,通过babel分析loader处理后的代码,进行代码的编译
  //    (这一步编译出演针对require语句,修改源代码中require语句的路径)
  // 5. 如果该入口文件无依赖和任何模块(require语句),返回编译后的模块对象
  // 6. 若存在依赖的模块,递归buildModule方法进行模块的编译

  buildModule(moduleName, modulePath) {
    // 1. 读取文件原始代码
    const orginSourceCode =
      (this.orginSourceCode = fs.readFileSync(modulePath, 'utf-8'));
    this.moduleCode = orginSourceCode;
    // 2. 调用loader进行处理
    this.handleLoader(modulePath);
    // 3. 调用webpack进行模块编译,获得最终的module对象
    const module = this.handleWebpackCompiler(moduleName, modulePath);
    // 4. 返回module
    return module;
  }



  // 匹配loader处理
  // 对传入的文件路径匹配到后缀的loader后,
  // 依次倒序使用loader处理代码this.moduleCode
  handleLoader(modulePath) {
    const matchLoaders = [];
    // 1. 获取所有传入的loader规则
    const rules = this.options.module.rules;
    rules.forEach((loader) => {
      const testRule = loader.test;
      if (testRule.test(modulePath)) {
        // 仅考虑loader 
        // { test:/\.js$/g, use:['babel-loader'] }, 
        // { test:/\.js$/, loader:'babel-loader' }
        if (loader.loader) {
          matchLoaders.push(loader.loader);
        } else {
          matchLoaders.push(...loader.use);
        }
      }
      // 2. 倒序执行loader传入的源代码
      for (let i = matchLoaders.length - 1; i >= 0; i--) {
        // 目前我们外部仅支持传入绝对路径的loader模式
        // require引入对应loader
        const loaderFn = require(matchLoaders[i]);
        this.moduleCode = loaderFn(this.moduleCode);
      }
    })
  }

  handleWebpackCompiler(moduleName, modulePath) {
    // 将当前模块相对于项目启动的根目录计算出相对路径,作为模块ID
    const moduleId = './' + toUnixPath(path.relative(this.rootPath, modulePath));
    // 创建模块对象
    const module = {
      id: moduleId,
      dependencies: new Set(),
      name: [moduleName],
    };
    // 调用babel分析代码
    const ast = parser.parse(this.moduleCode, {
      sourceType: 'module',
    });
    // 深度优先,遍历语法Tree
    traverse(ast, {
      CallExpression: (nodePath) => {
        const node = nodePath.node;
        if (node.callee.name === 'require') {
          // 获得源代码中引入模块的相对路径
          const requirePath = node.arguments[0].value;
          // 寻找模块绝对路径,当前模块路径+require()对应相对路径
          const moduleDirName = path.dirname(modulePath);
          const absolutePath = tryExtensions(
            path.join(moduleDirName, requirePath),
            this.options.resolve.extensions,
            requirePath,
            moduleDirName
          );
          // 生成moduleId - 针对于根路径的模块ID 添加进新的依赖模块路径
          const moduleId =
            './' + toUnixPath(path.relative(this.rootPath, absolutePath));
          // console.log('moduleID',this.rootPath,absolutePath);
          // 通过babel修改源代码中的require变成 __webpack_require__语句
          node.callee = t.identifier('__webpack_require__');
          // 修改源代码中require语句引入的模块 全部修改,变为相对于根路径进行处理
          node.arguments = [t.stringLiteral(moduleId)];
          // 为当前模块添加require语句造成的依赖(内容为相对于根路径的模块ID)
          // module.dependencies.add(moduleId);
          // 转化为ids的数组
          const alreadyModules = Array.from(this.modules).map(i => i.id);
          if (!alreadyModules.includes(moduleId)) {
            // 为当前模块添加require语句造成的依赖,内容为相对于根路径的模块Id
            module.dependencies.add(moduleId);
          } else {
            // 若已经存在,不添加进模块编译,但是更新模块依赖入口
            this.modules.forEach((value) => {
              if (value.id === moduleId) {
                value.name.push(moduleName);
              }
            })
          }
        }
      }
    })
    // 遍历结束根据AST生成新代码
    const { code } = generator(ast);
    // 为当前模块挂载新生成的代码
    module._source = code;
    // 递归依赖深度表里,存在依赖模块则加入
    module.dependencies.forEach((dependency) => {
      const depModule = this.buildModule(moduleName, dependency);
      // 将编译后热河依赖模块对象加入modules对象中
      this.modules.add(depModule);
    })
    // 返回
    return module;
  }

  //根据入口文件和依赖模块组装chunks
  buildUpChunk(entryName, entryObj) {
    const chunk = {
      name:entryName, // 每一个入口文件作为chunk
      entryModule:entryObj, //entry编译后的对象
      modules:Array.from(this.modules).filter((i)=>
        (i.name.includes(entryName))
      ), // 寻找与当前entry有关的module
    };
    // chunk添加到this.chunks
    console.log(chunk);
    this.chunks.add(chunk);
  }

  // 将chunk加入输出列表中
  exportFile(callback){
    const output=this.options.output;
    // 根据chunk生成assets内容
    this.chunks.forEach((chunk)=>{
      const parseFileName=output.filename.replace('[name]',chunk.name);
      // assets中{'main.js':'生成的字符串代码...'}
      this.assets[parseFileName]=getSourceCode(chunk);
    })
    // 调用 Pluginemit钩子
    this.hooks.emit.call();
    // 先判断目录是否存在,存在直接fs.write,不存在则首先创建目录
    if(!fs.existsSync(output.path)){
      fs.mkdirSync(output.path);
    }
    // files保存所有生成的文件名
    this.files=Object.keys(this.assets);
    Object.keys(this.assets).forEach((filename)=>{
      const filePath=path.join(output.path,filename);
      fs.writeFileSync(filePath,this.assets[filename]);
    })
    // 结束触发钩子
    this.hooks.done.call();
    callback(null,{
      toJson:()=>{
        return {
          entries:this.entries,
          modules:this.modules,
          files:this.files,
          chunks:this.chunks,
          assets:this.assets,
        }
      }
    })
  }
}

module.exports = Compiler;

// 编译阶段的准备工作
// 1. 目录文件基础逻辑补充
// 2. 通过hooks.tap等注册webpack插件
// 3. getEntry获得各个入口对象

// 模块编译阶段,需要做
// 1. 根据入口文件路径分析入口文件,用入口文件进行匹配对应的loader进行处理
// 2. 将loader处理完成的入口文件使用webpack进行编译
// 3. 分析入口文件依赖,重复两个步骤编译对应依赖
// 4. 若嵌套文件存在依赖文件,递归调用依赖模块进行编译
// 5. 递归编译完成,组装一个个包含多个模块的chunk

// 经过loader处理入口问价,得到处理后的代码保存在ths.moduleCode
// 此时经过loader处理后就进入webpack内部的编译阶段
// 需要做的是针对当前模块进行编译,将当前模块所有依赖的模块语(require())引入的路径
// 变为相对于根路径(this.rootPath)的相对路径.
// 这里的编译结果是期望将源代码中的依赖模块路径变为相对根路径的路径,同时建立基础的模块依赖关系

// webpack 编译
// 使用babel相关的api针对require语句进行了编译
// 同时代码中引入了tryExtensions()工具方法,是针对于后缀名补全的工具
// 针对于每一次的文件编译,都会返回一个module对象
// - id属性,表示当前模块对于this.rootPath的相对目录
// - dependencies属性,是一个Set内部保存了该模块以来的所有模块的模块ID
// - name属性,表示该模块属于哪个入口文件
// - _source属性,存放模块自身经过babel编译后的字符串代码

// 针对模块入口的分析
// 从入口出发,读取入口文件内容调用匹配的loader处理入口文件
// 通过babel分析依赖,并且同时将所有依赖的路径更换为相对于启动目录options.context的路径
// 入口文件若存在依赖,递归上述步骤编译依赖模块
// 将每个依赖模块编译后的对象加入 this.modules
// 将每一个入口文件编译对象加入 this.entries

// 编译完成阶段
// 根据上述依赖,组合最终输出的chunk - buildChunk
// chunk拥有
// 1. name :当前入口文件名称
// 2. entryModule :入口文件编译后对象
// 3. modules :该文家依赖的所有模块对象组成的数组,
//    其中每一个元素的格式和entryModule是一致的

// 原始打包生成的代码
// webpack打包后的代码内部定义了一个 __webpack_require__的函数代替了nodejs的require方法
// 
// 输出文件格式:
//
// 1. 编译后的入口文件
// (()=>{
//   const depModule=__webpack_require(
//   /*! ./module */,'./example/src/module.js'
//   );
//   console.log(depModule,'dep');
//   console.log('this is entry 1 !');
//   const loader2='baidu';
//   const loader1='www.baidu.com';
// })()
// 2. 顶部的入口文件依赖的所有模块定义的对象
//    定义了一个__webpack_modules的对象
//    key为模块的ID,也是相对于根路径的相对路径
//    value是改以来对象编译后的代码
// var __webpack_modules__={
//   './example/src/module.js':(module)=>{
//     const name='baidu';
//     module.exports={
//       name,
//     };
//     const loader2='baidu';
//     const loader1='www.baidu.com';
//   }
// }

// 输出文件阶段
// exportFile做了以下的事情
// 1. 首先获取配置参数的输出配置迭代this.chunks
//    将output.filename中的'[name]'换成对应的入口文件名,
//    同时根据chunk内容为this.assets添加打包需要的文件名和文件内容
// 2. 将文件写入磁盘前调用plugin的emit钩子函数
// 3. 判断output.path是否存在,不存在,创建一个文件夹
// 4. 将本次打包生成的所有文件名(this.assets的key值组成的数组)存放到files中
// 5. 循环this.assets,将文件一次写入对应的磁盘中
// 6. 所有打包流程结束,触发webpack插件的done钩子
// 7. 为nodejs webpack Api呼应,调用润犯法中外部传入callback

// this.assets通过分析chunk得到assets输出对应代码到磁盘
// this.assets的value是通过调用getSourceCode(chunk)的 方法生成模块对应代码

