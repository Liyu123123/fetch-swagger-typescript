const { generateService } = require('fetch-swagger-typescript')
generateService({
  schemaPath: 'http://111.231.118.251:18187/v2/api-docs',
  serversPath: './src/api', //生成接口文件路径
  controllerName: [], //单个controller名字 不传则默认请求apijson tags里所有name
});
