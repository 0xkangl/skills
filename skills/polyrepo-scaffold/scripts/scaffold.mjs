// polyrepo-scaffold 零依赖脚手架脚本。仅用 node: 内置模块。
import { readdirSync, readFileSync, writeFileSync, existsSync, cpSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join, basename, extname } from 'node:path';

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

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// 按扩展名白名单 + Makefile/Dockerfile 判定文本文件
const TEXT_FILE_EXTENSIONS = new Set([
  '.md', '.txt', '.json', '.yaml', '.yml', '.toml',
  '.js', '.ts', '.jsx', '.tsx', '.go', '.py', '.rb',
  '.sh', '.bash', '.zsh', '.gitignore', '.cursorignore',
  '.env', '.env.example', '.gitkeep', '.mdc',
]);

export function isTextFile(filePath) {
  const base = basename(filePath);
  if (base === 'Makefile' || base === 'Dockerfile') return true;
  const ext = extname(filePath);
  return TEXT_FILE_EXTENSIONS.has(ext) || ext === '';
}

// 零依赖递归遍历目录下所有文件(返回绝对路径,含 dotfiles)
function walkFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkFiles(full));
    else out.push(full);
  }
  return out;
}

// 复制模板目录到 targetDir,并对文本文件做变量替换
export function copyAndReplace(templateName, targetDir, vars) {
  if (!vars || !vars.PROJECT) {
    throw new Error('copyAndReplace requires vars.PROJECT to be set');
  }
  const srcDir = resolveTemplatesDir(templateName);
  if (!existsSync(srcDir)) {
    throw new Error(`Template not found: "${templateName}" (looked in ${srcDir})`);
  }
  cpSync(srcDir, targetDir, { recursive: true });

  for (const filePath of walkFiles(targetDir)) {
    if (!isTextFile(filePath)) continue;
    let content = readFileSync(filePath, 'utf-8');
    content = content.replace(/\{\{PROJECT\}\}/g, vars.PROJECT);

    // 自定义模块:把模板引用名 -<TEMPLATE_REF> 改为 -<MODULE_NAME>
    if (vars.MODULE_NAME && vars.TEMPLATE_REF) {
      content = content.replace(
        new RegExp(`-${escapeRegExp(vars.TEMPLATE_REF)}\\b`, 'g'),
        `-${vars.MODULE_NAME}`
      );
      // 替换 role 文案为 "<Name> application"
      if (vars.ORIGINAL_ROLE) {
        const cap = vars.MODULE_NAME.charAt(0).toUpperCase() + vars.MODULE_NAME.slice(1);
        content = content.replace(
          new RegExp(`^${escapeRegExp(vars.ORIGINAL_ROLE)}$`, 'm'),
          `${cap} application`
        );
      }
    }
    writeFileSync(filePath, content, 'utf-8');
  }
}
