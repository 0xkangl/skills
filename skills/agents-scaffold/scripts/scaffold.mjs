// agents-scaffold 零依赖脚手架脚本。仅用 node: 内置模块。
import { readdirSync, readFileSync, writeFileSync, existsSync, cpSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join, basename, extname, relative } from 'node:path';

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

// 列出可用模块模板名。排除 root(workspace 级配置)与 single(单仓库治理片段),二者都不是 init/add 的可选模块。
const NON_MODULE_TEMPLATES = new Set(['root', 'single']);

export function getAvailableTemplateNames() {
  return readdirSync(resolveTemplatesDir(), { withFileTypes: true })
    .filter((e) => e.isDirectory() && !NON_MODULE_TEMPLATES.has(e.name))
    .map((e) => e.name);
}

// 从 AGENTS.md 文本的 "## Role" 下首行提取角色描述
export function extractRole(content) {
  const match = content.match(/## Role\n(.+)/);
  return match ? match[1].trim() : null;
}

// 从模板 AGENTS.md 提取角色(自定义模块改名时用)
export function getModuleRole(templateName) {
  const content = readFileSync(resolveTemplatesDir(templateName, 'AGENTS.md'), 'utf-8');
  return extractRole(content) || templateName;
}

// 从已生成模块目录的 AGENTS.md 读角色(生成 Module Map 时用,以文件系统为单一真相)
export function readModuleRole(agentsPath, fallback) {
  try {
    return extractRole(readFileSync(agentsPath, 'utf-8')) || fallback;
  } catch {
    return fallback;
  }
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

  // 只遍历模板源文件映射到目标(不 walk 整个 targetDir)——原地模式下 targetDir
  // 可能含预存的 .git/用户文件,绝不能对它们做变量替换。
  for (const srcFile of walkFiles(srcDir)) {
    const filePath = join(targetDir, relative(srcDir, srcFile));
    if (!isTextFile(filePath)) continue;
    let content = readFileSync(filePath, 'utf-8');
    content = content.replace(/\{\{PROJECT\}\}/g, vars.PROJECT);

    // 单仓库:去掉模板自带的 -<STRIP_SUFFIX> 后缀,使命名统一为 <PROJECT>
    // (\b 保护 -spec-center 等不被误伤,与自定义改名同理)
    if (vars.STRIP_SUFFIX) {
      content = content.replace(new RegExp(`-${escapeRegExp(vars.STRIP_SUFFIX)}\\b`, 'g'), '');
    }

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

// spec-center/AGENTS.md 中由脚本维护的两处区块锚点(HTML 注释,不渲染)
const MODULE_MAP_START = '<!-- MODULE_MAP_START -->';
const MODULE_MAP_END = '<!-- MODULE_MAP_END -->';
const REPO_TREE_START = '<!-- REPO_TREE_START -->';
const REPO_TREE_END = '<!-- REPO_TREE_END -->';

// 替换两个锚点之间的内容(不含锚点本身)
function replaceBetween(content, startMarker, endMarker, inner) {
  const start = content.indexOf(startMarker);
  const end = content.indexOf(endMarker);
  if (start < 0 || end < 0 || end < start) {
    throw new Error(`Markers not found or out of order: ${startMarker} .. ${endMarker}`);
  }
  const before = content.slice(0, start + startMarker.length);
  const after = content.slice(end);
  return `${before}\n${inner}\n${after}`;
}

// 扫描工作区里实际存在的业务模块名(<name>- 前缀,排除 spec-center),按字母序
function scanModuleNames(workspaceDir, projectName) {
  const prefix = `${projectName}-`;
  const specCenterDirName = `${projectName}${SPEC_CENTER_SUFFIX}`;
  return readdirSync(workspaceDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name.startsWith(prefix) && e.name !== specCenterDirName)
    .map((e) => e.name.slice(prefix.length))
    .sort();
}

// 渲染 Module Map 表的模块行(不含 spec-center —— 它固定写在锚点上方)
function renderModuleMapRows(workspaceDir, projectName, moduleNames) {
  return moduleNames
    .map((m) => {
      const role = readModuleRole(join(workspaceDir, `${projectName}-${m}`, 'AGENTS.md'), `${m} application`);
      return `| \`${projectName}-${m}\` | ${role} |`;
    })
    .join('\n');
}

// 递归渲染目录树节点;node: { label, comment?, children? }。同层注释对齐。
function renderTreeNodes(nodes, prefix) {
  const out = [];
  const width = Math.max(...nodes.map((n) => n.label.length));
  nodes.forEach((node, i) => {
    const last = i === nodes.length - 1;
    const connector = last ? '└── ' : '├── ';
    out.push(node.comment
      ? `${prefix}${connector}${node.label.padEnd(width)}  # ${node.comment}`
      : `${prefix}${connector}${node.label}`);
    if (node.children?.length) {
      out.push(...renderTreeNodes(node.children, prefix + (last ? '    ' : '│   ')));
    }
  });
  return out;
}

// 渲染整棵 Repository Structure 树(含 ``` 围栏);连接线由结构确定,杜绝手画错。
function renderRepoTree(projectName, moduleNames) {
  const specCenterChildren = [
    { label: 'AGENTS.md', comment: 'This file - global project rules' },
    { label: 'api/', comment: 'API specifications (OpenAPI / endpoint specs)' },
    { label: 'conventions/', comment: 'Cross-cutting convention docs (starts empty)' },
    { label: 'specs/', comment: 'Shared specs affecting 2+ modules' },
    { label: 'errors/', comment: 'Error codes and formats' },
    { label: 'events/', comment: 'Inter-module event definitions' },
  ];
  const moduleSubtree = () => [
    { label: 'AGENTS.md' },
    { label: 'docs/', children: [{ label: 'specs/' }, { label: 'plans/' }] },
  ];
  const top = [
    { label: 'AGENTS.md', comment: `Root reference → ${projectName}-spec-center/AGENTS.md` },
    { label: `${projectName}-spec-center/`, comment: 'SSOT - shared specs and contracts', children: specCenterChildren },
    ...moduleNames.map((m) => ({ label: `${projectName}-${m}/`, children: moduleSubtree() })),
  ];
  return ['```', 'workspace/', ...renderTreeNodes(top, ''), '```'].join('\n');
}

// 按文件系统真相重写 spec-center/AGENTS.md 的 Module Map 与 Repository Structure 两处区块。
// 幂等:workspace/module/重跑结果一致,不解析旧内容,只看实际存在的模块目录。
export function updateSpecCenterAgents(workspaceDir, projectName) {
  const agentsPath = join(workspaceDir, `${projectName}${SPEC_CENTER_SUFFIX}`, 'AGENTS.md');
  const moduleNames = scanModuleNames(workspaceDir, projectName);
  let content = readFileSync(agentsPath, 'utf-8');
  content = replaceBetween(content, MODULE_MAP_START, MODULE_MAP_END, renderModuleMapRows(workspaceDir, projectName, moduleNames));
  content = replaceBetween(content, REPO_TREE_START, REPO_TREE_END, renderRepoTree(projectName, moduleNames));
  writeFileSync(agentsPath, content, 'utf-8');
}

// 从工作区里唯一的 <name>-spec-center 目录推断项目前缀;0 个返回 null,多个报错。
export function inferProjectName(workspaceDir) {
  const candidates = readdirSync(workspaceDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name.endsWith(SPEC_CENTER_SUFFIX))
    .map((e) => e.name.slice(0, -SPEC_CENTER_SUFFIX.length))
    .filter(Boolean);
  if (candidates.length === 1) return candidates[0];
  if (candidates.length === 0) return null;
  throw new Error(`Multiple spec-centers found in ${workspaceDir}; pass --name explicitly: ${candidates.join(', ')}`);
}

// workspace 子命令编排
export function runWorkspace(flags) {
  const name = flags.name;
  if (!name) throw new Error('workspace requires --name');
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
    return { mode: 'workspace', dryRun: true, dir, name, modules: modules.map((m) => m.name), skipped: parsed.skipped };
  }

  const created = [];
  try {
    mkdirSync(dir, { recursive: true });
    created.push(dir);   // workspace 前已校验 dir 为空/不存在,整个目录可安全清理
    copyAndReplace('root', dir, { PROJECT: name });
    for (const mod of modules) {
      const modDir = join(dir, `${name}-${mod.name}`);
      createModule(mod.templateRef, modDir, name, mod, { noGit: flags.noGit });
      created.push(modDir);
    }
    updateSpecCenterAgents(dir, name);
  } catch (err) {
    err.created = created;
    throw err;
  }

  return { mode: 'workspace', dir, name, modules: modules.map((m) => m.name), skipped: parsed.skipped };
}

// 汇总输出(简洁单行,便于转述)
export function printSummary(r) {
  if (r.mode === 'single') {
    const tag = r.dryRun ? '[dry-run] ' : '';
    console.log(`${tag}single: ${r.dir} (project ${r.name}, template ${r.template})`);
    if (!r.dryRun) console.log(`created: ${r.dir}`);
    return;
  }
  if (r.dryRun) {
    console.log(`[dry-run] ${r.mode}: ${r.dir} (project ${r.name})`);
    console.log(`[dry-run] modules: ${r.modules.join(', ') || '(none)'}`);
  } else {
    console.log(`${r.mode}: ${r.dir} (project ${r.name})`);
    console.log(`${r.mode === 'workspace' ? 'created' : 'added'}: ${r.modules.join(', ') || '(none)'}`);
  }
  for (const s of r.skipped || []) {
    console.log(`skipped: ${s.entry} (${s.reason})`);
  }
}

// module 子命令编排
export function runModule(flags) {
  const dir = resolve(flags.dir || '.');
  // --name 可省略:从工作区唯一的 <name>-spec-center 推断
  const name = flags.name || inferProjectName(dir);
  if (!name) throw new Error('module requires --name (no <name>-spec-center found in dir to infer from)');
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
    return { mode: 'module', dryRun: true, dir, name, modules: toCreate.map((m) => m.name), skipped };
  }

  const created = [];
  try {
    for (const mod of toCreate) {
      const modDir = join(dir, `${name}-${mod.name}`);
      createModule(mod.templateRef, modDir, name, mod, { noGit: flags.noGit });
      created.push(modDir);
    }
    updateSpecCenterAgents(dir, name);
  } catch (err) {
    err.created = created;   // module 只回收本次新建的模块目录,不碰既有模块
    throw err;
  }

  return { mode: 'module', dir, name, modules: toCreate.map((m) => m.name), skipped };
}

// 单仓库治理片段模板名(与 root 一样不进 workspace/module 的可选模块列表)
const SINGLE_TEMPLATE = 'single';
const MODULE_STACK_MARKER = '<!-- MODULE_STACK -->';

// 合并生成单仓库 AGENTS.md:把所选 stack 模板 AGENTS.md 从 "## Role" 起的模块片段
// 注入治理片段 templates/single/AGENTS.md 的 <!-- MODULE_STACK --> 锚点。
export function buildSingleAgents(stackTemplate, projectName) {
  const gov = readFileSync(resolveTemplatesDir(SINGLE_TEMPLATE, 'AGENTS.md'), 'utf-8');
  const stack = readFileSync(resolveTemplatesDir(stackTemplate, 'AGENTS.md'), 'utf-8');

  const roleIdx = stack.indexOf('## Role');
  let moduleSection = roleIdx >= 0 ? stack.slice(roleIdx).trimEnd() : '';
  // 单仓库:模块片段里指向兄弟 spec-center 仓的 conventions 路径改为本仓 docs/
  moduleSection = moduleSection.replace('../{{PROJECT}}-spec-center/conventions/', 'docs/');

  let merged = gov.replace(MODULE_STACK_MARKER, moduleSection);
  merged = merged.replace(new RegExp(`-${escapeRegExp(stackTemplate)}\\b`, 'g'), '');
  merged = merged.replace(/\{\{PROJECT\}\}/g, projectName);
  return merged;
}

// single 子命令编排:在目标目录原地初始化一个独立单仓库项目(非子模块、无 spec-center)
export function runSingle(flags) {
  const template = flags.template;
  if (!template) throw new Error('single requires --template');
  const stackTemplates = getAvailableTemplateNames().filter((t) => t !== SPEC_CENTER_NAME);
  if (!stackTemplates.includes(template)) {
    throw new Error(`Invalid --template "${template}": choose one of ${stackTemplates.join(', ')}`);
  }

  const dir = resolve(flags.dir || '.');
  const name = flags.name || basename(dir);
  const nameCheck = validateProjectName(name);
  if (nameCheck !== true) {
    throw new Error(`Invalid project name "${name}": ${nameCheck} (pass --name explicitly)`);
  }

  // 防覆盖:模板顶层条目已存在(.git 除外)即报错,绝不静默覆盖
  const topLevel = readdirSync(resolveTemplatesDir(template));
  const conflicts = existsSync(dir) ? topLevel.filter((n) => existsSync(join(dir, n))) : [];
  if (conflicts.length) {
    throw new Error(`Target dir already contains: ${conflicts.join(', ')} — refusing to overwrite (run in an empty/new dir or remove them)`);
  }

  if (flags.dryRun) {
    return { mode: 'single', dryRun: true, dir, name, template };
  }

  const created = [];
  try {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
      created.push(dir);   // 目录由本次创建,失败可整体清理
    }
    // 铺 stack 模板内容到 dir 根 + 去 -<template> 后缀
    copyAndReplace(template, dir, { PROJECT: name, STRIP_SUFFIX: template });
    for (const n of readdirSync(resolveTemplatesDir(template))) created.push(join(dir, n));
    // 用合并后的治理文档覆盖 dir/AGENTS.md(契约/约定文档直接放 docs/,无需额外子目录)
    writeFileSync(join(dir, 'AGENTS.md'), buildSingleAgents(template, name), 'utf-8');
    // git:已有 .git 则复用,否则 git init + main;--no-git 全跳过
    if (!flags.noGit && !existsSync(join(dir, '.git'))) gitInit(dir, name);
  } catch (err) {
    err.created = created;
    throw err;
  }

  return { mode: 'single', dir, name, template };
}

const HELP = `agents-scaffold — repo scaffolder (zero-dependency)

Usage:
  node scaffold.mjs workspace --name <project> [--dir <path>] [--modules <list>] [--no-git] [--dry-run]
  node scaffold.mjs module    [--name <project>] [--dir <path>]  --modules <list>  [--no-git] [--dry-run]
                              (module 省略 --name 时,从工作区唯一的 <name>-spec-center 推断)
  node scaffold.mjs single    --template <server|web|client> [--name <project>] [--dir <path>] [--no-git] [--dry-run]
                              (单仓库:在 dir 原地初始化一个独立项目;--name 省略时取 dir 目录名)

Module list (workspace/module):
  comma-separated; "name" (built-in template) or "name=template" (custom-named).
  Available templates: server, web, client, spec-center.

Notes:
  workspace always includes spec-center; module never recreates it.
  single is a standalone repo (no spec-center): reuses an existing .git, else "git init" + "git branch -M main";
  refuses to overwrite existing files in the target dir.
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
    else if (a === '--template') flags.template = argv[++i];
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
  if (command === 'workspace') result = runWorkspace(flags);
  else if (command === 'module') result = runModule(flags);
  else if (command === 'single') result = runSingle(flags);
  else throw new Error(`Unknown command: ${command} (expected workspace|module|single)`);

  printSummary(result);
}

// 主程序守卫:仅当直接执行此文件时才跑 CLI
const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  try {
    main(process.argv.slice(2));
  } catch (err) {
    console.error(`Error: ${err.message}`);
    // 中途失败:打印本次已落盘的路径,交由上层(LLM/用户)决定是否清理
    if (err.created?.length) {
      console.error('partial: created before failure (not rolled back):');
      for (const p of err.created) console.error(`  ${p}`);
    }
    process.exit(1);
  }
}
