// polyrepo-scaffold 零依赖脚手架脚本。仅用 node: 内置模块。
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// 模板根目录(默认 ../templates,测试可覆盖)
let TEMPLATES_DIR = resolve(__dirname, '../templates');

export function setTemplatesDir(dir) {
  TEMPLATES_DIR = resolve(dir);
}

export function resolveTemplatesDir(...subPaths) {
  return resolve(TEMPLATES_DIR, ...subPaths);
}

// 项目名/模块名校验:小写字母开头,仅小写字母/数字/连字符,2-50 字符
const PROJECT_NAME_REGEX = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

export function validateProjectName(name) {
  if (!PROJECT_NAME_REGEX.test(name)) {
    return 'Must start with lowercase letter, only lowercase/digits/hyphens';
  }
  if (name.length < 2 || name.length > 50) {
    return 'Must be 2-50 characters';
  }
  return true;
}
