// link 
// https://www.zhihu.com/question/473737575/answer/2339126396
// 写的真好,自己实现了以下

const webpack=require("./webpack");
const config=require("../example/webpack.config");

const compiler=webpack(config);


compiler.run((err,stats)=>{
  if(err){
    console.log(err,'err');
    throw new Error("oops");
  }
  console.log(stats.toJson().chunks);
  // ...
});