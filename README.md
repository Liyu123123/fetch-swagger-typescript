1. 功能
   1.  根据 SwaggerUI doc 接口数据 生成 typescript 接口类型定义，支持cjs, esm方式引用。详细使用方法见根目录examples文件夹
2. 使用方法
   1.  npm install fetch-swagger-typescript --save-dev /

```typescript
 1. npm install fetch-swagger-typescript --save-dev 
  或者 yarn add fetch-swagger-typescript -D

 2. 在项目根目录新建fetchswagger.config.ts
  cjs方式调用
  const {generateService} = require("fetch-swagger-typescript")
  generateService({
    schemaPath: "http://xxxxxxx/v2/api-docs",//swagger json生成地址
    serversPath: "./servers", //生成接口文件路径
    controllerName: [], //单个controller名字 不传则默认请求apijson tags里所有name
  })
   package.json scripts中加入一行 
   api:ts-node/node fetchswagger.config.ts

  esm方式调用
  import { generateService } from 'fetch-swagger-typescript';
  generateService({
    schemaPath: 'http://xxxxxxx/v2/api-docs',
    serversPath: './src/api', //生成接口文件路径
    controllerName: [], //单个controller名字 不传则默认请求apijson tags里所有name
  });
  package.json scripts中加入一行 
  api: node -r esm ./src/index.ts

  
```
