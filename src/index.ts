// @ts-ignore
import axios from "axios";
import _ from "lodash";
import nunjucks from "nunjucks";
import fsextra from "fs-extra";
import { writeFile, filterRepeat, replaceRef, getRefkey, getDefinition } from "./utils/index";
import { startFetchProps } from '../types'
import path from 'path';
const __dirname = path.dirname(new URL(import.meta.url).pathname);
const getOpenApiRequest = async (schemaPath: string) => {
  if (!schemaPath) throw new Error("url参数缺失！");
  try {
    const result = await axios.get(schemaPath);
    return result.data;
  } catch (e) {
    console.error(e);
  }
};
console.log(123)

/** 根据ControllerName收集Paths */
const collectPathsByControllerName = (paths: any, controllerName: any) => {
  let subPaths = {};
  Object.keys(paths).forEach((pathKey) => {
    const pathVal = paths[pathKey];
    Object.keys(pathVal).forEach(methodKey => {
      const methodsVal = pathVal[methodKey]
      const tagName = methodsVal.tags[0];
      if (tagName === controllerName) {
        subPaths = {
          ...subPaths,
          [pathKey]: pathVal,
        };
      }
    })

  });

  return subPaths;
};
const getParametersDataFn = (
  finialyResult: any,
) => {
  //1.收集parameters
  //2.从parameters过滤掉没有schema嵌套的
  //3.从最终数据中生成数据
  const apiJsonData = cacheConfig.getApiJsonData()

  const getParametersData = _.flatten(
    _.values(finialyResult).map((item) => _.values(item)[0].parameters)
  ).filter((item) => Boolean(item));

  const hasSchemaData = getParametersData.filter((item) => {
    return judgeIsHasSchemToItera(item);
  });
  const getRenderTypes = hasSchemaData.map((item) => {
    const Schma = item.schema;
    const Items = item.items;
    if (!Schma && Items && Items.$ref) {
      const definition = getDefinition(Items.$ref, apiJsonData);
      const { properties } = definition

      return {
        name: getRefkey(Items.$ref).replace(/\-*/g, ""),
        properties: iteraPropertiesTodata(properties, apiJsonData),
      };
    }
    if (Schma && Schma.items && Schma.items.$ref) {
      const definition = getDefinition(Schma.items.$ref, apiJsonData);
      const { properties } = definition

      return {
        name: getRefkey(Schma.items.$ref).replace(/\-*/g, ""),
        properties: iteraPropertiesTodata(properties, apiJsonData),
      };
    }
    if (Schma && Schma.$ref) {
      if (getRefkey(Schma.$ref) === "long[]" || getRefkey(Schma.$ref) === "String") {
        return;
      }

      const definition = getDefinition(Schma.$ref, apiJsonData);
      const { properties } = definition

      return {
        name: getRefkey(Schma.$ref).replace(/\-*/g, ""),
        properties: iteraPropertiesTodata(properties, apiJsonData),
      };
    }
    return null
  });
  const getResultData = _.flatten(
    _.values(finialyResult).map((item) => {
      if (_.values(item)[0].responses['200']?.schema?.$ref) {
        const refKey = getRefkey(_.values(item)[0].responses['200'].schema.$ref)

        const definition = getDefinition(refKey, apiJsonData);
        const { properties } = definition

        return {
          name: refKey.replace(/\-*/g, ""),
          properties: iteraPropertiesTodata(properties, apiJsonData),
        }
      }
      return null

    })
  ).filter((item) => Boolean(item))
  const getChildProperties = _.flatten(
    getRenderTypes.filter((item) => Boolean(item)).map((v: any) => v.properties)
  );

  const getResChildProperties = _.flatten(
    getResultData.filter((item) => Boolean(item)).map((v: any) => v.properties)
  );
  const arr: any = [];
  const resArr: any = []
  // @ts-ignore
  const baseItera = (datalist) => {
    // @ts-ignore
    datalist.forEach((item) => {
      if (item.nextRef) {
        arr.push({
          name: item.nextRef.replace(/\-*/g, ""),
          properties: item.properties,
        });
        baseItera(item.properties);
      }
    });
  };
  // @ts-ignore
  const baseIteraRes = (datalist) => {
    // @ts-ignore
    datalist.forEach((item) => {
      if (item.nextRef) {
        resArr.push({
          name: item.nextRef.replace(/\-*/g, ""),
          properties: item.properties,
        });
        baseItera(item.properties);
      }
    });
  };
  baseItera(getChildProperties);
  baseIteraRes(getResChildProperties);
  const result = getRenderTypes.filter((item) => Boolean(item)).concat(arr);
  // @ts-ignore
  const responseResult = getResultData.filter((item) => Boolean(item)).concat(resArr).map(item => ({ ...item, name: replaceRef(item.name) }));
  // @ts-ignore
  return result.concat(responseResult);
};
const getPathsByControllerName = (
  controllerName: string,
  englishName: string
) => {
  const apiJsonData = cacheConfig.getApiJsonData()
  const { paths } = apiJsonData;
  const finialyResult = collectPathsByControllerName(paths, controllerName);
  // @ts-ignore
  let getServiceData = [];
  Object.keys(finialyResult).forEach((pathKey) => {
    // @ts-ignore
    const pathValue = finialyResult[pathKey];

    Object.keys(pathValue).forEach((methodKey) => {
      const methodsVal = pathValue[methodKey]
      const { operationId, parameters, responses, summary } =
        methodsVal
      const fnStr = pathKey.split("/");
      const apiName =
        operationId ||
        formartFnNameHasError(fnStr[fnStr.length - 1] + fnStr[fnStr.length - 2]);
      const ajaxResultName = formartExpeclStr(responses["200"], englishName);
      if (_.isEmpty(parameters)) {
        getServiceData.push({
          url: pathKey, //接口名称
          method: methodKey, //请求方式
          summary, //描述
          fnName: apiName,
          responses: responses,
          ajaxResultName,
        });
      } else {
        //正常情况 1.query 2.body 3.formdata 4.quey formdata
        // @ts-ignore
        const hasQuery = parameters.some((item) => item.in === "query");
        // @ts-ignore
        const hasFormData = parameters.some((item) => item.in === "formData");
        // @ts-ignore
        const hasBody = parameters.some((item) => item.in === "body");
        // @ts-ignore
        const hasHeader = parameters.some((item) => item.in === "header");

        const getParamtersHasFormdata = getParameters(
          // @ts-ignore
          parameters.filter((item) => item.in === "query"),
          englishName
        );
        const getFormdataHasParamters = getParameters(
          // @ts-ignore
          parameters.filter((item) => item.in === "formData"),
          englishName
        );
        const getbodyParamters = getParameters(
          // @ts-ignore
          parameters.filter((item) => item.in === "body"),
          englishName
        );
        if (hasQuery && !hasFormData && !hasBody) {
          getServiceData.push({
            url: pathKey, //接口名称
            method: methodKey, //请求方式
            summary, //描述
            fnName: apiName,
            controllerName: englishName, //上层controller
            responses: responses,
            parameters: getParamtersHasFormdata,
            ajaxResultName,
          });
        }
        if (hasQuery && hasFormData) {
          getServiceData.push({
            url: pathKey, //接口名称
            method: methodKey, //请求方式
            summary, //描述
            fnName: apiName,
            controllerName: englishName, //上层controller
            responses: responses,
            parameters: getParamtersHasFormdata,
            getFormDataParamters: getFormdataHasParamters,
            ajaxResultName,
          });
        }
        if (hasHeader && hasFormData) {
          getServiceData.push({
            url: pathKey, //接口名称
            method: methodKey, //请求方式
            summary, //描述
            fnName: apiName,
            controllerName: englishName, //上层controller
            responses: responses,
            getFormDataParamters: getFormdataHasParamters,
            ajaxResultName,
          });
        }
        if (!hasQuery && hasBody) {
          getServiceData.push({
            url: pathKey, //接口名称
            method: methodKey, //请求方式
            summary, //描述
            fnName: apiName,
            controllerName: englishName, //上层controller
            responses: responses,
            bodyParamters: getbodyParamters,
            ajaxResultName,
          });
        }
        if (hasQuery && hasBody) {
          getServiceData.push({
            url: pathKey, //接口名称
            method: methodKey, //请求方式
            summary, //描述
            fnName: apiName,
            parameters: getParamtersHasFormdata,
            controllerName: englishName, //上层controller
            responses: responses,
            bodyParamters: getbodyParamters,
            ajaxResultName,
          });
        }
        if (hasHeader && !hasQuery && !hasBody && !hasFormData) {
          getServiceData.push({
            url: pathKey, //接口名称
            method: methodKey, //请求方式
            summary, //描述
            fnName: apiName,
            responses: responses,
            ajaxResultName,
          });
        }
      }
    })
  });
  const declareData = getParametersDataFn(
    finialyResult
  );

  return {
    declareData,
    // @ts-ignore
    getServiceData,
  };
};

const getFinalResultType = (type: string) => {
  const enumObj = {
    arrayobject: '{ [key: string]: any }[]',
    arraystring: 'string[]',
    arrayinteger: 'number[]',
    integer: 'number',
    number: 'number',
    array: '[]',
    string: 'string',
    boolean: 'boolean',
    object: '{[key: string]: any}',
  }
  // @ts-ignore
  return enumObj[type] ?? 'any'
};
// @ts-ignore
const formartExpeclStr = (data, controllerName) => {
  if (!data.schema) return
  let str = "";
  const reg =
    /\\|\/|\?|\，|\,|\？|\*|\"|\“|\”|\'|\‘|\’|\<|\>|\{|\}|\[|\]|\【|\】|\：|\:|\、|\^|\$|\!|\~|\`|\>|\«|\»|\»»/g;
  if (data.schema?.$ref) {
    const refKey = getRefkey(data.schema.$ref)
    str = `${controllerName}.${refKey
      .replace(reg, "")
      .replace(/\-*/g, "")}`;
  } else {
    str = getFinalResultType(data.schema.type);
  }
  return str;
};
// @ts-ignore
const judgeIsHasSchemToItera = (item) => {
  const Schema = item.schema;
  const Items = item.items;
  return (
    (Schema?.$ref) ||
    (Schema?.items?.$ref) ||
    (Items?.$ref)
  );
};
// @ts-ignore
const iteraPropertiesTodata = (data, apiJsonData) => {
  // @ts-ignore
  const results = [];
  Object.keys(data).forEach((item) => {
    const target = data[item];
    if (target.items) {
      if (target.type && target.items.$ref) {
        const refKey = getRefkey(target.items.$ref)
        const definition = getDefinition(refKey, apiJsonData);
        const { properties } = definition
        results.push({
          name: item,
          nextRef: refKey,
          types: replaceRef(refKey) + getFinalResultType(target.type),
          desc: target.description,
          properties: iteraPropertiesTodata(
            properties,
            apiJsonData
          ),
        });
      }
      if (!target.type && target.items?.$ref) {
        const refKey = getRefkey(target.items.$ref)
        const definition = getDefinition(refKey, apiJsonData);
        const { properties } = definition
        results.push({
          name: item,
          nextRef: refKey,
          types: replaceRef(refKey) + getFinalResultType(target.type),
          desc: target.description,
          properties: iteraPropertiesTodata(
            properties,
            apiJsonData
          ),
        });
      }
      if (target.items?.type) {
        results.push({
          name: item,
          types:
            getFinalResultType(target.items.type) +
            getFinalResultType(target.type),
          desc: target.description,
        });
      }

    }


    if (target.schema && target.schema.$ref) {
      const refKey = getRefkey(target.schema.$ref)
      const definition = getDefinition(refKey, apiJsonData);
      const { properties } = definition
      results.push({
        name: item,
        nextRef: refKey,
        types: replaceRef(refKey) + getFinalResultType(target.type),
        properties: iteraPropertiesTodata(
          properties,
          apiJsonData
        ),
      });
    }
    if (target.$ref) {
      const refKey = getRefkey(target.$ref)
      const definition = getDefinition(refKey, apiJsonData);
      const { properties } = definition
      results.push({
        name: item,
        nextRef: refKey,
        types: replaceRef(refKey),
        desc: target.description,
        properties: iteraPropertiesTodata(
          properties,
          apiJsonData
        ),
      });
    }

    if (!target.$ref && !target.items && !target.schema) {
      results.push({
        name: item,
        types: getFinalResultType(target.type),
        desc: target.description,
      });
    }
  });
  // @ts-ignore
  return results;
};
// @ts-ignore
const getParameters = (parameters, controllerName) => {
  // @ts-ignore
  return parameters.map((v) => {
    const schema = v.schema;
    const items = v.items;
    if (!schema && !items) {
      return { ...v, type: getFinalResultType(v.type) };
    }
    if (!schema && !items.$ref && items.type) {
      return { ...v, type: getFinalResultType(v.type + items.type) };
    }
    if (schema && schema.items && schema.items.type) {
      return {
        ...v,
        type: getFinalResultType(schema.type + schema.items.type),
      };
    }
    if (schema && schema.type && !schema.items) {
      return {
        ...v,
        type: getFinalResultType(schema.type),
      };
    }
    if (schema && schema.type && schema.items && schema.items.$ref) {
      return {
        ...v,
        type: `${controllerName}.${getRefkey(schema.items.$ref).replace(
          /\-*/g,
          ""
        )}${getFinalResultType(schema.type)}`,
      };
    }
    if (schema && !schema.items && schema.type) {
      return { ...v, type: getFinalResultType(schema.type) };
    }
    if (schema && !schema.items && schema.$ref) {
      return {
        ...v,
        type: `${controllerName}.${getRefkey(schema.$ref).replace(/\-*/g, "")}`,
      };
    }
    if (schema && schema.items && schema.items.$ref) {
      return {
        ...v,
        type: `${controllerName}.${getRefkey(schema.items.$ref).replace(/\-*/g, "")}`,
      };
    }
    return { ...v };
  });
};
// @ts-ignore
const formartFnNameHasError = (name) => {
  const getWay = ["get", "post", "delete", "put"];

  if (getWay.includes(name)) {
    return name + "s";
  } else if (/\-*/g.test(name)) {
    return name.replace(/\-*/g, "");
  } else {
    return name;
  }
};
// @ts-ignore
const renderDeclareTemplateBydata = async (list, nameSpace, serversPath) => {
  console.log(`${nameSpace}---declare开始`)

  nunjucks.configure({
    autoescape: false,
  });
  const filedata = fsextra.readFileSync(path.join(__dirname, '../', 'template', `types.njk`), 'utf8')
  const params = {
    namespace: nameSpace,
    list: filterRepeat(list, "name"),
  };

  writeFile(`./${serversPath}/${nameSpace}`, "types.d.ts", nunjucks.renderString(filedata, params));
  console.log(`${nameSpace}---declare结束`)
};
// @ts-ignore
const renderServiveTemplate = (data, nameSpace, requestName, serversPath) => {
  console.log(`${nameSpace}---service开始`)

  nunjucks.configure({
    autoescape: false,
  });
  const filedata = fsextra.readFileSync(path.join(__dirname, '../', 'template', `apiService.njk`), 'utf8')
  const params = {
    requestImportStatement: requestName,
    list: data,
    controllerName: nameSpace,
  };

  writeFile(`./${serversPath}/${nameSpace}`, "index.ts", nunjucks.renderString(filedata, params));
  console.log(`${nameSpace}---service结束`)

};

const getImportStatement = (requestLibPath: string) => {
  if (requestLibPath && requestLibPath.startsWith("import")) {
    return requestLibPath;
  }
  if (requestLibPath) {
    return `import request from '${requestLibPath}'`;
  }
  return `import { request } from "umi"`;
};
// @ts-ignore
const getChineseToEnglishName = (apiJsonData, controllerName) => {
  // @ts-ignore
  const target = apiJsonData.tags.find((cur) => cur.name === controllerName);
  if (_.isEmpty(target)) {
    throw new Error(`${controllerName}匹配出错，请检查拼写`);
  } else {
  }
  return target.description.replace(/\s*/g, "");
};
const resolveFloderByControllName = (
  controllName: string[],

  serversPath: string
) => {
  controllName.forEach((item) => {

    const apiJsonData = cacheConfig.getApiJsonData()
    const getEngLishName = getChineseToEnglishName(apiJsonData, item);

    const { declareData, getServiceData } = getPathsByControllerName(

      item,
      getEngLishName
    );

    const receiveImportStatement = getImportStatement("@/utils/request.ts");

    renderServiveTemplate(
      getServiceData,
      getEngLishName,
      receiveImportStatement,
      serversPath
    );
    renderDeclareTemplateBydata(declareData, getEngLishName, serversPath);
  });
};
var cacheConfig = (function () {
  // @ts-ignore
  let data = null
  return {
    // @ts-ignore
    setApiJsonData: function (apiData) {
      data = apiData
    },
    getApiJsonData: function () {
      // @ts-ignore
      return data
    }
  }
})();
export const generateService = async ({
  schemaPath,
  serversPath,
  controllerName,
}: startFetchProps) => {
  console.log('请求swagger json开始')
  // @ts-ignore
  const apiJsonData = await getOpenApiRequest(schemaPath);
  console.log('请求swagger json结束')
  cacheConfig.setApiJsonData(apiJsonData)
  if (_.isEmpty(controllerName)) {
    const { tags } = apiJsonData;
    // @ts-ignore
    const getTagsName = tags.map((item) => item.name);
    // @ts-ignore
    resolveFloderByControllName(getTagsName, serversPath);
  } else {
    if (_.isArray(controllerName)) {
      // @ts-ignore
      resolveFloderByControllName(controllerName, serversPath);
    } else {
      throw new Error("controllerName格式应该为数组！");
    }
  }
};
