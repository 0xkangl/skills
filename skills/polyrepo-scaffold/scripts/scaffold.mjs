// polyrepo-scaffold 零依赖脚手架脚本。仅用 node: 内置模块。
import { readdirSync, readFileSync } from 'node:fs';
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

// 列出可用模板名(排除 root —— root 是 workspace 级配置,不是可选模块)
export function getAvailableTemplateNames() {
  return readdirSync(resolveTemplatesDir(), { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name !== 'root')
    .map((e) => e.name);
}

// 从模板 AGENTS.md 的 "## Role" 下首行提取角色描述
export function getModuleRole(templateName) {
  const content = readFileSync(resolveTemplatesDir(templateName, 'AGENTS.md'), 'utf-8');
  const match = content.match(/## Role\n(.+)/);
  return match ? match[1].trim() : templateName;
}

// 解析模块列表:逗号分隔的 "name" 或 "name=template"
// takenNames:已占用的模块名(用于跨调用去重)
// 返回 { modules, skipped: [{ entry, reason }] }
export function parseModuleList(moduleStr, takenNames = []) {
  const templates = getAvailableTemplateNames();
  const modules = [];
  const skipped = [];
  const taken = [...takenNames];

  for (const entry of moduleStr.split(',').map((s) => s.trim()).filter(Boolean)) {
    const eq = entry.indexOf('=');
    let name, tpl;
    if (eq >= 0) {
      name = entry.slice(0, eq).trim();
      tpl = entry.slice(eq + 1).trim();
    } else {
      name = entry;
      tpl = entry;
    }

    if (!name) { skipped.push({ entry, reason: 'empty name' }); continue; }
    const v = validateProjectName(name);
    if (v !== true) { skipped.push({ entry, reason: v }); continue; }
    if (!templates.includes(tpl) || tpl === 'root') {
      skipped.push({ entry, reason: `template "${tpl}" not available` });
      continue;
    }
    if (taken.includes(name)) { skipped.push({ entry, reason: 'duplicate name' }); continue; }

    modules.push({ name, templateRef: tpl, isCustom: name !== tpl });
    taken.push(name);
  }
  return { modules, skipped };
}
