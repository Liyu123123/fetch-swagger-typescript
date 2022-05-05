import path from "path";
import fs from "fs";
import * as prettier from "prettier";
export const mkdir = (dir: string) => {
  if (!fs.existsSync(dir)) {
    mkdir(path.dirname(dir));
    fs.mkdirSync(dir);
  }
};
export const writeFile = (
  folderPath: string,
  fileName: string,
  content: string
) => {
  const filePath = path.join(folderPath, fileName);
  mkdir(path.dirname(filePath));
  const [prettierContent, hasError] = prettierFile(content);
  fs.writeFileSync(filePath, prettierContent, {
    encoding: "utf8",
  });
  return hasError;
};

export const prettierFile = (content: string): [string, boolean] => {
  let result = content;
  let hasError = false;
  try {
    // @ts-ignore

    result = prettier.format(content, {
      singleQuote: true,
      trailingComma: "all",
      printWidth: 100,
      parser: "typescript",
      proseWrap: 'never',
      endOfLine: 'lf',
      // @ts-ignore

      overrides: [
        {
          files: '.prettierrc',
          options: {
            parser: 'json',
          },
        },
        {
          files: 'document.ejs',
          options: {
            parser: 'html',
          },
        },
      ],
    });
  } catch (error) {
    hasError = true;
  }
  return [result, hasError];
};
// @ts-ignore

export const filterRepeat = (arr, tagName) => {
  const result = [];
  const obj = {};
  for (let i = 0; i < arr.length; i++) {
    // @ts-ignore

    if (!obj[arr[i][tagName]]) {
      result.push(arr[i]);
      // @ts-ignore

      obj[arr[i][tagName]] = true;
    }
  }
  return result;
};
// @ts-ignore

export const getRefkey = ($ref) => {
  return ($ref ?? '').replace(/#\/definitions\//g, '')
}
// @ts-ignore

export const replaceRef = (ref) => {
  const reg =
    /\\|\/|\?|\，|\,|\？|\*|\"|\“|\”|\'|\‘|\’|\<|\>|\{|\}|\[|\]|\【|\】|\：|\:|\、|\^|\$|\!|\~|\`|\>|\«|\»|\»»/g;
  return (ref ?? '').replace(reg, '')
}

// @ts-ignore

export const getDefinition = ($ref, apiJson) => {
  let newRef = $ref
  if ($ref.startsWith('#')) {
    newRef = getRefkey($ref)
  }
  return apiJson.definitions[newRef]
}
