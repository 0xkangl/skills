import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateProjectName,
  getAvailableTemplateNames,
  getModuleRole,
  parseModuleList,
  copyAndReplace,
  gitInit,
  createModule,
  runInit,
  runAdd,
  parseArgs,
  main,
  isTextFile,
} from './scaffold.mjs';
import { mkdtempSync, rmSync, readFileSync as fsReadFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

test('validateProjectName accepts kebab-case', () => {
  assert.equal(validateProjectName('my-app'), true);
  assert.equal(validateProjectName('app1'), true);
});

test('validateProjectName rejects bad names', () => {
  assert.notEqual(validateProjectName('My-App'), true);   // 大写
  assert.notEqual(validateProjectName('1app'), true);      // 数字开头
  assert.notEqual(validateProjectName('a'), true);         // 太短
  assert.notEqual(validateProjectName('app_x'), true);     // 下划线
});

test('getAvailableTemplateNames lists templates without root', () => {
  const names = getAvailableTemplateNames();
  assert.ok(names.includes('server'));
  assert.ok(names.includes('web'));
  assert.ok(names.includes('client'));
  assert.ok(names.includes('spec-center'));
  assert.ok(!names.includes('root'));
});

test('getModuleRole reads first line under ## Role', () => {
  // server 模板 AGENTS.md 的 ## Role 下首行
  const role = getModuleRole('server');
  assert.equal(typeof role, 'string');
  assert.ok(role.length > 0);
});

test('isTextFile recognizes dotfiles by basename (incl. .env.example)', () => {
  // 点文件 path.extname 不可靠(.env.example → .example),靠 basename 精确匹配
  assert.equal(isTextFile('.env.example'), true);
  assert.equal(isTextFile('.gitignore'), true);
  assert.equal(isTextFile('.cursorindexingignore'), true);
  assert.equal(isTextFile('.env'), true);
  assert.equal(isTextFile('.gitkeep'), true);
  assert.equal(isTextFile('README.md'), true);
  assert.equal(isTextFile('Makefile'), true);
});

test('parseModuleList parses built-in and custom modules', () => {
  const { modules, skipped } = parseModuleList('server,web');
  assert.deepEqual(modules, [
    { name: 'server', templateRef: 'server', isCustom: false },
    { name: 'web', templateRef: 'web', isCustom: false },
  ]);
  assert.equal(skipped.length, 0);
});

test('parseModuleList supports name=template (custom)', () => {
  const { modules } = parseModuleList('api-gateway=server,user-service=server');
  assert.deepEqual(modules, [
    { name: 'api-gateway', templateRef: 'server', isCustom: true },
    { name: 'user-service', templateRef: 'server', isCustom: true },
  ]);
});

test('parseModuleList skips invalid names / unknown templates / duplicates', () => {
  const { modules, skipped } = parseModuleList('server,server,Bad,x=nope,api=root');
  assert.deepEqual(modules.map((m) => m.name), ['server']);
  // 第二个 server(重复)、Bad(非法名)、x=nope(模板不存在)、api=root(root 不可用)→ 4 条 skipped
  assert.equal(skipped.length, 4);
});

test('copyAndReplace replaces {{PROJECT}} in built-in template', () => {
  const dir = mkdtempSync(join(tmpdir(), 'prs-'));
  try {
    const target = join(dir, 'myapp-server');
    copyAndReplace('server', target, { PROJECT: 'myapp' });
    const agents = fsReadFileSync(join(target, 'AGENTS.md'), 'utf-8');
    assert.ok(!agents.includes('{{PROJECT}}'));
    assert.ok(agents.includes('myapp'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('e2e: init then two adds create module dirs as git repos on main', () => {
  const dir = mkdtempSync(join(tmpdir(), 'prs-'));
  try {
    const ws = join(dir, 'myapp');
    runInit({ name: 'myapp', dir: ws, modules: 'server' });   // 默认建 git
    runAdd({ name: 'myapp', dir: ws, modules: 'web' });
    runAdd({ name: 'myapp', dir: ws, modules: 'mobile=client' });

    // 三个模块目录均落盘,各含 AGENTS.md
    for (const m of ['server', 'web', 'mobile']) {
      assert.ok(existsSync(join(ws, `myapp-${m}`, 'AGENTS.md')));
    }

    // 自定义模块 mobile=client:模块自身 AGENTS.md 完成改名 / role 替换
    const mobileAgents = fsReadFileSync(join(ws, 'myapp-mobile', 'AGENTS.md'), 'utf-8');
    assert.ok(mobileAgents.includes('myapp-mobile'));
    assert.ok(!mobileAgents.includes('myapp-client'));

    // 模块是独立 git 仓且在 main、无 commit
    const branch = execFileSync('git', ['symbolic-ref', '--short', 'HEAD'], {
      cwd: join(ws, 'myapp-server'), encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    assert.equal(branch, 'main');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('copyAndReplace renames template ref + role for custom module', () => {
  const dir = mkdtempSync(join(tmpdir(), 'prs-'));
  try {
    const target = join(dir, 'myapp-api-gateway');
    const originalRole = getModuleRole('server');
    copyAndReplace('server', target, {
      PROJECT: 'myapp',
      MODULE_NAME: 'api-gateway',
      TEMPLATE_REF: 'server',
      ORIGINAL_ROLE: originalRole,
    });
    const agents = fsReadFileSync(join(target, 'AGENTS.md'), 'utf-8');
    // 模板引用名 -server → -api-gateway
    assert.ok(!agents.includes('myapp-server'));
    assert.ok(agents.includes('myapp-api-gateway'));
    // role 文案替换为 "Api-gateway application"
    assert.ok(agents.includes('Api-gateway application'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('copyAndReplace throws on missing template', () => {
  const dir = mkdtempSync(join(tmpdir(), 'prs-'));
  try {
    assert.throws(() => copyAndReplace('nope', join(dir, 'x'), { PROJECT: 'myapp' }), /Template not found/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('gitInit creates a git repo on main with no commits', () => {
  const dir = mkdtempSync(join(tmpdir(), 'prs-'));
  try {
    const target = join(dir, 'repo');
    copyAndReplace('server', target, { PROJECT: 'myapp' });
    gitInit(target, 'server');
    assert.ok(existsSync(join(target, '.git')));
    // 当前分支为 main
    const branch = execFileSync('git', ['symbolic-ref', '--short', 'HEAD'], {
      cwd: target, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    assert.equal(branch, 'main');
    // 无任何 commit(rev-list 失败 / 计数为 0)
    let commitCount = '0';
    try {
      commitCount = execFileSync('git', ['rev-list', '--count', 'HEAD'], {
        cwd: target, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'],
      }).trim();
    } catch {
      commitCount = '0'; // unborn HEAD
    }
    assert.equal(commitCount, '0');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('createModule honors noGit', () => {
  const dir = mkdtempSync(join(tmpdir(), 'prs-'));
  try {
    const target = join(dir, 'myapp-web');
    createModule('web', target, 'myapp', { name: 'web', templateRef: 'web', isCustom: false }, { noGit: true });
    assert.ok(existsSync(join(target, 'AGENTS.md')));
    assert.ok(!existsSync(join(target, '.git')));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('runInit always includes spec-center and creates module dirs', () => {
  const dir = mkdtempSync(join(tmpdir(), 'prs-'));
  try {
    const ws = join(dir, 'myapp');
    const r = runInit({ name: 'myapp', dir: ws, modules: 'server,web' });
    assert.equal(r.mode, 'init');
    assert.deepEqual(r.modules.sort(), ['server', 'spec-center', 'web'].sort());
    assert.ok(existsSync(join(ws, 'AGENTS.md')));            // root 模板
    assert.ok(existsSync(join(ws, 'myapp-spec-center', 'AGENTS.md')));
    assert.ok(existsSync(join(ws, 'myapp-server', 'AGENTS.md')));
    assert.ok(existsSync(join(ws, 'myapp-web', 'AGENTS.md')));
    assert.ok(existsSync(join(ws, 'myapp-server', '.git'))); // 默认建 git
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('runInit rejects invalid name and non-empty dir', () => {
  const dir = mkdtempSync(join(tmpdir(), 'prs-'));
  try {
    assert.throws(() => runInit({ name: 'Bad', dir: join(dir, 'x') }), /Invalid project name/);
    // 非空目录
    const ws = join(dir, 'taken');
    runInit({ name: 'myapp', dir: ws, modules: '', noGit: true });
    assert.throws(() => runInit({ name: 'myapp', dir: ws, modules: '', noGit: true }), /not empty/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('runInit dry-run writes nothing', () => {
  const dir = mkdtempSync(join(tmpdir(), 'prs-'));
  try {
    const ws = join(dir, 'myapp');
    const r = runInit({ name: 'myapp', dir: ws, modules: 'server', dryRun: true });
    assert.equal(r.dryRun, true);
    assert.ok(!existsSync(ws)); // 未落盘
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('runAdd creates the new module dir', () => {
  const dir = mkdtempSync(join(tmpdir(), 'prs-'));
  try {
    const ws = join(dir, 'myapp');
    runInit({ name: 'myapp', dir: ws, modules: 'server', noGit: true });
    const r = runAdd({ name: 'myapp', dir: ws, modules: 'web', noGit: true });
    assert.equal(r.mode, 'add');
    assert.deepEqual(r.modules, ['web']);
    assert.ok(existsSync(join(ws, 'myapp-web', 'AGENTS.md')));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('runAdd skips existing modules and spec-center', () => {
  const dir = mkdtempSync(join(tmpdir(), 'prs-'));
  try {
    const ws = join(dir, 'myapp');
    runInit({ name: 'myapp', dir: ws, modules: 'server', noGit: true });
    const r = runAdd({ name: 'myapp', dir: ws, modules: 'server,spec-center,web', noGit: true });
    assert.deepEqual(r.modules, ['web']);
    const reasons = r.skipped.map((s) => s.entry).sort();
    assert.deepEqual(reasons, ['server', 'spec-center']);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('runAdd throws when spec-center is absent', () => {
  const dir = mkdtempSync(join(tmpdir(), 'prs-'));
  try {
    assert.throws(() => runAdd({ name: 'myapp', dir, modules: 'web' }), /spec-center not found/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('parseArgs parses subcommand and flags', () => {
  const { command, flags } = parseArgs(['init', '--name', 'myapp', '--modules', 'server,web', '--no-git', '--dry-run']);
  assert.equal(command, 'init');
  assert.equal(flags.name, 'myapp');
  assert.equal(flags.modules, 'server,web');
  assert.equal(flags.noGit, true);
  assert.equal(flags.dryRun, true);
});

test('parseArgs throws on unknown flag', () => {
  assert.throws(() => parseArgs(['init', '--bogus']), /Unknown argument/);
});

test('main runs init via subcommand (integration)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'prs-'));
  try {
    const ws = join(dir, 'myapp');
    main(['init', '--name', 'myapp', '--dir', ws, '--modules', 'server,web', '--no-git']);
    assert.ok(existsSync(join(ws, 'myapp-spec-center', 'AGENTS.md')));
    assert.ok(existsSync(join(ws, 'myapp-server', 'AGENTS.md')));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('init copies spec-center AGENTS.md as a clean template (no markers, no placeholders)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'prs-'));
  try {
    const ws = join(dir, 'myapp');
    runInit({ name: 'myapp', dir: ws, modules: 'server', noGit: true });
    const sc = fsReadFileSync(join(ws, 'myapp-spec-center', 'AGENTS.md'), 'utf-8');
    assert.ok(!sc.includes('{{PROJECT}}'));   // 占位符已替换
    assert.ok(!sc.includes('MODULE:'));        // 模板无遗留过滤标记
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
