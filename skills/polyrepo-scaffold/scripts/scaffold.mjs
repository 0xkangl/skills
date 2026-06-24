// polyrepo-scaffold 零依赖脚手架脚本。仅用 node: 内置模块。
import { readdirSync, readFileSync, writeFileSync, existsSync, cpSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
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

// 文本文件判定:扩展名白名单 + 点开头配置文件名(basename 精确匹配) + Makefile/Dockerfile
// 点文件(如 .env.example)的 path.extname 不可靠(.env.example → .example),故用 basename 精确匹配
const TEXT_FILE_EXTENSIONS = new Set([
  '.md', '.txt', '.json', '.yaml', '.yml', '.toml',
  '.js', '.ts', '.jsx', '.tsx', '.go', '.py', '.rb',
  '.sh', '.bash', '.zsh', '.mdc',
]);

const TEXT_DOTFILES = new Set([
  '.gitignore', '.gitkeep', '.cursorignore', '.cursorindexingignore',
  '.env', '.env.example',
]);

export function isTextFile(filePath) {
  const base = basename(filePath);
  if (base === 'Makefile' || base === 'Dockerfile') return true;
  if (TEXT_DOTFILES.has(base)) return true;
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

// 初始化模块为独立 git 仓:只 git init + 改 main,不 add、不 commit
export function gitInit(modDir, moduleName) {
  try {
    execFileSync('git', ['init'], { cwd: modDir, stdio: 'pipe' });
    execFileSync('git', ['branch', '-M', 'main'], { cwd: modDir, stdio: 'pipe' });
  } catch (err) {
    throw new Error(`Failed to initialize git repo for "${moduleName}": ${err.message}`);
  }
}

// 创建单个模块:组装替换变量 → 复制模板 → (可选)git init
export function createModule(templateRef, modDir, projectName, mod, opts = {}) {
  const vars = {
    PROJECT: projectName,
    MODULE_NAME: mod.isCustom ? mod.name : null,
    TEMPLATE_REF: mod.isCustom ? mod.templateRef : null,
  };
  if (mod.isCustom) {
    try {
      vars.ORIGINAL_ROLE = getModuleRole(mod.templateRef);
    } catch {
      vars.ORIGINAL_ROLE = null;
    }
  }
  copyAndReplace(templateRef, modDir, vars);
  if (!opts.noGit) gitInit(modDir, mod.name);
}

const SPEC_CENTER_SUFFIX = '-spec-center';
const SPEC_CENTER_NAME = 'spec-center';

// init 子命令编排
export function runInit(flags) {
  const name = flags.name;
  if (!name) throw new Error('init requires --name');
  const nameCheck = validateProjectName(name);
  if (nameCheck !== true) throw new Error(`Invalid project name "${name}": ${nameCheck}`);

  const dir = resolve(flags.dir || `./${name}`);
  if (existsSync(dir) && readdirSync(dir).length > 0) {
    throw new Error(`Target directory not empty: ${dir}`);
  }

  const parsed = parseModuleList(flags.modules || '', []);
  // spec-center 始终包含,且置顶;过滤掉用户误传的 spec-center
  const modules = [
    { name: SPEC_CENTER_NAME, templateRef: SPEC_CENTER_NAME, isCustom: false },
    ...parsed.modules.filter((m) => m.name !== SPEC_CENTER_NAME),
  ];

  if (flags.dryRun) {
    return { mode: 'init', dryRun: true, dir, name, modules: modules.map((m) => m.name), skipped: parsed.skipped };
  }

  mkdirSync(dir, { recursive: true });
  copyAndReplace('root', dir, { PROJECT: name });
  for (const mod of modules) {
    const modDir = join(dir, `${name}-${mod.name}`);
    createModule(mod.templateRef, modDir, name, mod, { noGit: flags.noGit });
  }

  return { mode: 'init', dir, name, modules: modules.map((m) => m.name), skipped: parsed.skipped };
}

// 汇总输出(简洁单行,便于转述)
export function printSummary(r) {
  if (r.dryRun) {
    console.log(`[dry-run] ${r.mode}: ${r.dir} (project ${r.name})`);
    console.log(`[dry-run] modules: ${r.modules.join(', ') || '(none)'}`);
  } else {
    console.log(`${r.mode}: ${r.dir} (project ${r.name})`);
    console.log(`${r.mode === 'init' ? 'created' : 'added'}: ${r.modules.join(', ') || '(none)'}`);
  }
  for (const s of r.skipped || []) {
    console.log(`skipped: ${s.entry} (${s.reason})`);
  }
}

// add 子命令编排
export function runAdd(flags) {
  const name = flags.name;
  if (!name) throw new Error('add requires --name');
  const dir = resolve(flags.dir || '.');
  const specCenterDir = join(dir, `${name}${SPEC_CENTER_SUFFIX}`);
  if (!existsSync(specCenterDir)) {
    throw new Error(`spec-center not found: expected ${specCenterDir}`);
  }

  // 扫描已有模块(<name>- 前缀目录)
  const prefix = `${name}-`;
  const existing = readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name.startsWith(prefix))
    .map((e) => e.name.slice(prefix.length));

  const parsed = parseModuleList(flags.modules || '', []);
  const skipped = [...parsed.skipped];
  const toCreate = [];
  for (const mod of parsed.modules) {
    if (mod.name === SPEC_CENTER_NAME) {
      skipped.push({ entry: mod.name, reason: 'spec-center already exists' });
      continue;
    }
    if (existing.includes(mod.name)) {
      skipped.push({ entry: mod.name, reason: 'already exists' });
      continue;
    }
    toCreate.push(mod);
  }

  if (flags.dryRun) {
    return { mode: 'add', dryRun: true, dir, name, modules: toCreate.map((m) => m.name), skipped };
  }

  for (const mod of toCreate) {
    const modDir = join(dir, `${name}-${mod.name}`);
    createModule(mod.templateRef, modDir, name, mod, { noGit: flags.noGit });
  }

  return { mode: 'add', dir, name, modules: toCreate.map((m) => m.name), skipped };
}

const HELP = `polyrepo-scaffold — multi-repo workspace scaffolder (zero-dependency)

Usage:
  node scaffold.mjs init --name <project> [--dir <path>] [--modules <list>] [--no-git] [--dry-run]
  node scaffold.mjs add  --name <project> [--dir <path>]  --modules <list>  [--no-git] [--dry-run]

Module list:
  comma-separated; "name" (built-in template) or "name=template" (custom-named).
  Available templates: server, web, client, spec-center.

Notes:
  init always includes spec-center; add never recreates it.
  Each new module gets "git init" + "git branch -M main" only (no add, no commit).`;

export function parseArgs(argv) {
  const command = argv[0];
  const flags = {};
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--no-git') flags.noGit = true;
    else if (a === '--dry-run') flags.dryRun = true;
    else if (a === '--name') flags.name = argv[++i];
    else if (a === '--dir') flags.dir = argv[++i];
    else if (a === '--modules') flags.modules = argv[++i];
    else if (a === '--templates-dir') flags.templatesDir = argv[++i];
    else if (a === '--help' || a === '-h') flags.help = true;
    else throw new Error(`Unknown argument: ${a}`);
  }
  return { command, flags };
}

export function main(argv) {
  const { command, flags } = parseArgs(argv);
  if (flags.help || !command || command === '--help' || command === '-h') {
    console.log(HELP);
    return;
  }
  if (flags.templatesDir) setTemplatesDir(flags.templatesDir);

  let result;
  if (command === 'init') result = runInit(flags);
  else if (command === 'add') result = runAdd(flags);
  else throw new Error(`Unknown command: ${command} (expected init|add)`);

  printSummary(result);
}

// 主程序守卫:仅当直接执行此文件时才跑 CLI
const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  try {
    main(process.argv.slice(2));
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}
