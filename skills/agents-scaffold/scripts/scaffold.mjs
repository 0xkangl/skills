// agents-scaffold 零依赖脚手架脚本。仅用 node: 内置模块。
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const templatesDir = fileURLToPath(new URL('../templates/', import.meta.url));
const stacks = ['server', 'web', 'client'];

const help = `Usage:
  node scaffold.mjs --template <${stacks.join('|')}> [--name <project>] [--dir <path>]
                    [--on-conflict backup|overwrite] [--no-git] [--dry-run]

Initializes the target directory in place (default "."). The project name defaults
to the directory name. Existing directories merge and conflicting files are backed
up as *.bak unless overwrite is selected. Use --dry-run to preview conflicts.
Reuses an existing .git or initializes an empty repository on main.`;

function* listFiles(root, prefix = '') {
  for (const entry of readdirSync(join(root, prefix), { withFileTypes: true })) {
    const path = join(prefix, entry.name);
    if (entry.isDirectory()) yield* listFiles(root, path);
    else yield { path, source: join(root, path) };
  }
}

function backupFile(path) {
  let backup = `${path}.bak`;
  let i = 1;
  while (existsSync(backup)) backup = `${path}.bak.${i++}`;
  renameSync(path, backup);
  return backup;
}

function scaffold(options) {
  const { template, 'on-conflict': policy } = options;
  if (!stacks.includes(template)) {
    throw new Error(`Expected --template to be one of: ${stacks.join(', ')}`);
  }
  if (policy !== 'overwrite' && policy !== 'backup') {
    throw new Error(`Invalid --on-conflict "${policy}": choose backup|overwrite`);
  }
  const dir = resolve(options.dir);
  const name = options.name ?? basename(dir);
  if (name.length < 2 || name.length > 50 || !/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(name)) {
    throw new Error(`Invalid project name "${name}": pass a 2–50 character lowercase kebab-case name with --name`);
  }

  const stackDir = join(templatesDir, template);
  // 技术栈的 AGENTS.md 是共用文档的片段，只生成一份根 AGENTS.md。
  const stackGuide = join(stackDir, 'AGENTS.md');
  const files = [
    ...listFiles(join(templatesDir, 'common')),
    ...Array.from(listFiles(stackDir)).filter(({ source }) => source !== stackGuide),
  ];
  const target = `${dir} (project ${name}, template ${template})`;
  if (options['dry-run']) {
    console.log(`[dry-run] ${target}`);
    const conflicts = files.map(({ path }) => join(dir, path)).filter(existsSync);
    if (conflicts.length) {
      const action = policy === 'overwrite' ? 'overwrite' : 'back up';
      console.log(`[dry-run] conflicts (will ${action}): ${conflicts.join(', ')}`);
    }
    return;
  }

  const created = [];
  const backedUp = [];
  try {
    const newRoot = !existsSync(dir);
    if (newRoot) {
      mkdirSync(dir, { recursive: true });
      created.push(dir);
    }
    for (const { path, source } of files) {
      const dest = join(dir, path);
      let content = readFileSync(source, 'utf8');
      if (path === 'AGENTS.md') {
        content = content.replace('<!-- STACK_GUIDE -->', () => readFileSync(stackGuide, 'utf8').trimEnd());
      }
      const existed = existsSync(dest);
      if (existed && policy === 'backup') backedUp.push(backupFile(dest));
      mkdirSync(dirname(dest), { recursive: true });
      writeFileSync(dest, content.replaceAll('{{PROJECT}}', name));
      // 已有仓库按文件报告可回收项，覆盖且无备份的文件不能清理。
      if (!newRoot && (!existed || policy === 'backup')) created.push(dest);
    }
    if (!options['no-git'] && !existsSync(join(dir, '.git'))) {
      execFileSync('git', ['init', '-b', 'main'], { cwd: dir, stdio: 'pipe' });
    }
  } catch (err) {
    err.created = created;
    err.backedUp = backedUp;
    throw err;
  }

  console.log(`created: ${target}`);
  for (const path of backedUp) console.log(`backed up: ${path}`);
}

try {
  const { values } = parseArgs({
    options: {
      template: { type: 'string' },
      name: { type: 'string' },
      dir: { type: 'string', default: '.' },
      'on-conflict': { type: 'string', default: 'backup' },
      'no-git': { type: 'boolean' },
      'dry-run': { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
    },
  });
  if (values.help || process.argv.length === 2) console.log(help);
  else scaffold(values);
} catch (err) {
  console.error(`Error: ${err.message}`);
  if (err.created?.length) {
    console.error('partial: created before failure (not rolled back):');
    for (const path of err.created) console.error(`  ${path}`);
  }
  if (err.backedUp?.length) {
    console.error('backed up (originals preserved, not rolled back):');
    for (const path of err.backedUp) console.error(`  ${path}`);
  }
  process.exitCode = 1;
}
