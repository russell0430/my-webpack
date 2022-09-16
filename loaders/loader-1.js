function loader1(sourceCode) {
  // console.log('join loader1');
  return sourceCode + `\n const loader1='http://www.baidu.com'`;
}
module.exports=loader1;