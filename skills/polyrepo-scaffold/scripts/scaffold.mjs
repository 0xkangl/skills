// polyrepo-scaffold 零依赖脚手架脚本。仅用 node: 内置模块。
import { readdirSync, readFileSync, writeFileSync, existsSync, cpSync } from 'node:fs';
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

const MODULE_MARKER = /<!-- MODULE:([a-z0-9-]+) -->/;
const BEGIN_MARKER = /<!-- BEGIN MODULE:([a-z0-9-]+) -->/;
const END_MARKER = /<!-- END MODULE:([a-z0-9-]+) -->/;

// 按所选模块过滤 spec-center/AGENTS.md 的三类 HTML 标记
export function filterAgentsMd(templateContent, selectedModules) {
  const lines = templateContent.split('\n');
  const result = [];
  let skipMode = null;

  for (const line of lines) {
    const beginMatch = line.match(BEGIN_MARKER);
    const endMatch = line.match(END_MARKER);

    if (beginMatch) {
      if (!selectedModules.includes(beginMatch[1])) {
        skipMode = beginMatch[1];
      } else {
        const remainder = line.replace(/<!-- BEGIN MODULE:[a-z0-9-]+ -->\s?/, '');
        if (remainder) result.push(remainder);
      }
      continue;
    }

    if (endMatch) {
      if (skipMode === endMatch[1]) {
        skipMode = null;
      }
      const remainder = line.replace(/<!-- END MODULE:[a-z0-9-]+ -->\s?/, '');
      if (remainder) result.push(remainder);
      continue;
    }

    if (skipMode) continue;

    const singleMatch = line.match(MODULE_MARKER);
    if (singleMatch) {
      if (!selectedModules.includes(singleMatch[1])) continue;
      result.push(line.replace(/<!-- MODULE:[a-z0-9-]+ -->\s?/, ''));
      continue;
    }

   result.push(line);
 }
 return result.join('\n');
}

// 把一行插入 Module Map 表:按反引号内模块名字母序排序,重名跳过
export function insertIntoModuleMap(content, newRow, moduleName) {
  const lines = content.split('\n');
  let tableStart = -1;
  let separatorIdx = -1;
  let tableEnd = -1;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('| Module |')) tableStart = i;
    if (tableStart !== -1 && separatorIdx === -1 && /^\|[-:|]+\|/.test(lines[i])) {
      separatorIdx = i;
    }
    // 表尾判定从分隔符下一行开始,避免把分隔符行本身误判为非数据行
    if (separatorIdx !== -1 && tableEnd === -1 && i > separatorIdx) {
      if (!lines[i].match(/^\| .* \| .* \|/)) {
        tableEnd = i - 1;
        break;
      }
    }
  }
  if (tableEnd === -1 && separatorIdx !== -1) tableEnd = lines.length - 1;
  if (tableStart === -1 || separatorIdx === -1) return content;

  const dataRows = lines.slice(separatorIdx + 1, tableEnd + 1);
  const alreadyExists = dataRows.some((row) => row.includes(`\`${moduleName}\``));
  if (alreadyExists) return content;

  dataRows.push(newRow);
  dataRows.sort((a, b) => {
    const nameA = a.match(/`([^`]+)`/)?.[1] || '';
    const nameB = b.match(/`([^`]+)`/)?.[1] || '';
    return nameA.localeCompare(nameB);
  });

  lines.splice(separatorIdx + 1, tableEnd - separatorIdx, ...dataRows);
  return lines.join('\n');
}

// 把一段子树追加进 Repository Structure 目录树,并修正连接线
export function insertIntoRepoTree(content, treeEntry) {
  const lines = content.split('\n');

  // 最后一个代码块闭合 ``` 所在行 = 目录树范围
  let treeBlockClose = -1;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].trimStart() === '```') { treeBlockClose = i; break; }
  }

  // 最后一个顶层节点(├── 或 └──,前导最多 3 个 │/空格)
  let lastEntryStart = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^[│ ]{0,3}(├──|└──)/.test(lines[i])) lastEntryStart = i;
  }

  if (lastEntryStart === -1 || treeBlockClose === -1) {
    // 兜底:在最后一个 ``` 前追加
    const lastCodeBlock = content.lastIndexOf('```');
    if (lastCodeBlock === -1) return content;
    const before = content.substring(0, lastCodeBlock);
    const after = content.substring(lastCodeBlock);
    return before + treeEntry + '\n' + after;
  }

  // 找到最后一个顶层节点子树的末行
  let lastEntryEnd = lastEntryStart;
  for (let i = lastEntryStart + 1; i < treeBlockClose; i++) {
    if (/^[│ ]{0,3}(├──|└──)/.test(lines[i])) break;
    lastEntryEnd = i;
  }

  // 把旧末节点的 └── 改为 ├──,并把其子树的 4 空格缩进组替换为 "│   "
  if (lines[lastEntryStart].includes('└──')) {
    lines[lastEntryStart] = lines[lastEntryStart].replace('└──', '├──');
    for (let i = lastEntryStart + 1; i <= lastEntryEnd; i++) {
      lines[i] = lines[i].replace(/^( {4})+/g, (match) => '│   '.repeat(match.length / 4));
    }
  }

  // 在旧末节点子树之后插入新节点
  lines.splice(lastEntryEnd + 1, 0, treeEntry);
  return lines.join('\n');
}

const SPEC_CENTER_SUFFIX = '-spec-center';

// 内建模块用模板角色;自定义模块用 "<Name> application"
export function buildModuleRole(mod) {
  if (!mod.isCustom) return getModuleRole(mod.templateRef);
  const cap = mod.name.charAt(0).toUpperCase() + mod.name.slice(1);
  return `${cap} application`;
}

// 构造目录树子树片段(新节点初始为末节点 └──)
export function buildModuleTreeEntry(projectName, moduleName, role) {
  const dirName = `${projectName}-${moduleName}`;
  const cap = moduleName.charAt(0).toUpperCase() + moduleName.slice(1);
  return [
    `└── ${dirName}/            # ${role}`,
    `    ├── AGENTS.md                 # ${cap}-specific conventions`,
    '    └── docs/',
    `        ├── specs/                # ${cap}-specific specifications`,
    `        └── plans/                # ${cap}-specific implementation plans`,
  ].join('\n');
}

// 把新模块并入已存在的 spec-center/AGENTS.md(Module Map 表 + 目录树)
export function mergeAgentsMd(workspaceDir, projectName, newModules) {
  const agentsPath = join(workspaceDir, `${projectName}${SPEC_CENTER_SUFFIX}`, 'AGENTS.md');
  let content = readFileSync(agentsPath, 'utf-8');

  for (const mod of newModules) {
    const role = buildModuleRole(mod);
    const fullModuleName = `${projectName}-${mod.name}`;
    const tableRow = `| \`${fullModuleName}\` | ${role} |`;
    content = insertIntoModuleMap(content, tableRow, fullModuleName);
    content = insertIntoRepoTree(content, buildModuleTreeEntry(projectName, mod.name, role));
  }
  writeFileSync(agentsPath, content, 'utf-8');
}

// init 时生成 spec-center/AGENTS.md:从模板过滤 → 替换 {{PROJECT}} → 写盘 → 合并自定义模块
export function syncAgentsMd(workspaceDir, projectName, modules) {
  const srcPath = resolveTemplatesDir('spec-center', 'AGENTS.md');
  const templateContent = readFileSync(srcPath, 'utf-8');

  // 内建模块用自身名参与标记过滤;自定义模块用其 templateRef 参与过滤
  const builtInNames = modules.filter((m) => !m.isCustom).map((m) => m.name);
  const customRefs = modules.filter((m) => m.isCustom).map((m) => m.templateRef);
  const filterNames = [...new Set([...builtInNames, ...customRefs])];

  const filtered = filterAgentsMd(templateContent, filterNames);
  const replaced = filtered.replace(/\{\{PROJECT\}\}/g, projectName);
  const destPath = join(workspaceDir, `${projectName}${SPEC_CENTER_SUFFIX}`, 'AGENTS.md');
  writeFileSync(destPath, replaced, 'utf-8');

  // 把自定义模块条目 merge 进刚生成的文件
  const customModules = modules.filter((m) => m.isCustom);
  if (customModules.length > 0) {
    mergeAgentsMd(workspaceDir, projectName, customModules);
  }
}
