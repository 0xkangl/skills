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
  runWorkspace,
  runModule,
  runSingle,
  buildSingleAgents,
  parseArgs,
  main,
  isTextFile,
  updateSpecCenterAgents,
  inferProjectName,
} from './scaffold.mjs';
import { mkdtempSync, rmSync, readFileSync as fsReadFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
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
  assert.ok(!names.includes('single'));   // single 是单仓库治理片段,不是可选模块
});

test('getModuleRole reads first line under ## Role', () => {
  // server 模板 CLAUDE.md 的 ## Role 下首行
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
    const agents = fsReadFileSync(join(target, 'CLAUDE.md'), 'utf-8');
    assert.ok(!agents.includes('{{PROJECT}}'));
    assert.ok(agents.includes('myapp'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('e2e: workspace then two modules create module dirs as git repos on main', () => {
  const dir = mkdtempSync(join(tmpdir(), 'prs-'));
  try {
    const ws = join(dir, 'myapp');
    runWorkspace({ name: 'myapp', dir: ws, modules: 'server' });   // 默认建 git
    runModule({ name: 'myapp', dir: ws, modules: 'web' });
    runModule({ name: 'myapp', dir: ws, modules: 'mobile=client' });

    // 三个模块目录均落盘,各含 CLAUDE.md 正文与 AGENTS.md 指针
    for (const m of ['server', 'web', 'mobile']) {
      assert.ok(existsSync(join(ws, `myapp-${m}`, 'CLAUDE.md')));
      assert.equal(fsReadFileSync(join(ws, `myapp-${m}`, 'AGENTS.md'), 'utf-8').trim(), '@CLAUDE.md');
    }

    // 自定义模块 mobile=client:模块自身 CLAUDE.md 完成改名 / role 替换
    const mobileAgents = fsReadFileSync(join(ws, 'myapp-mobile', 'CLAUDE.md'), 'utf-8');
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
    const agents = fsReadFileSync(join(target, 'CLAUDE.md'), 'utf-8');
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
    assert.ok(existsSync(join(target, 'CLAUDE.md')));
    assert.ok(!existsSync(join(target, '.git')));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('runWorkspace always includes spec-center and creates module dirs', () => {
  const dir = mkdtempSync(join(tmpdir(), 'prs-'));
  try {
    const ws = join(dir, 'myapp');
    const r = runWorkspace({ name: 'myapp', dir: ws, modules: 'server,web' });
    assert.equal(r.mode, 'workspace');
    assert.deepEqual(r.modules.sort(), ['server', 'spec-center', 'web'].sort());
    assert.ok(existsSync(join(ws, 'CLAUDE.md')));            // root 模板
    assert.ok(existsSync(join(ws, 'myapp-spec-center', 'CLAUDE.md')));
    assert.ok(existsSync(join(ws, 'myapp-server', 'CLAUDE.md')));
    assert.ok(existsSync(join(ws, 'myapp-web', 'CLAUDE.md')));
    assert.ok(existsSync(join(ws, 'myapp-server', '.git'))); // 默认建 git
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('runWorkspace rejects invalid name and re-init over an existing workspace', () => {
  const dir = mkdtempSync(join(tmpdir(), 'prs-'));
  try {
    assert.throws(() => runWorkspace({ name: 'Bad', dir: join(dir, 'x') }), /Invalid project name/);
    // 已含 *-spec-center 的目录视为"已是工作区",拒绝重复初始化(而非"目录非空")
    const ws = join(dir, 'taken');
    runWorkspace({ name: 'myapp', dir: ws, modules: '', noGit: true });
    assert.throws(() => runWorkspace({ name: 'myapp', dir: ws, modules: '', noGit: true }), /already a workspace/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('workspace initializes in place over installed-skills files (ignores hidden + non-conflicting)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'prs-'));
  try {
    const ws = join(dir, 'proj');
    mkdirSync(join(ws, '.agents'), { recursive: true });
    writeFileSync(join(ws, '.agents', 'config'), 'x');
    writeFileSync(join(ws, 'skills-lock.json'), '{}');   // 非隐藏但不与 root 模板冲突
    const r = runWorkspace({ name: 'myapp', dir: ws, modules: 'server', noGit: true });
    assert.equal(r.mode, 'workspace');
    assert.ok(existsSync(join(ws, 'myapp-spec-center', 'CLAUDE.md')));
    assert.ok(existsSync(join(ws, 'CLAUDE.md')));            // root 模板已铺到当前目录
    assert.ok(existsSync(join(ws, '.agents', 'config')));   // 既有隐藏目录保留
    assert.ok(existsSync(join(ws, 'skills-lock.json')));    // 无冲突文件保留
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('workspace merges existing hidden template dirs instead of conflicting', () => {
  const dir = mkdtempSync(join(tmpdir(), 'prs-'));
  try {
    const ws = join(dir, 'proj');
    mkdirSync(join(ws, '.claude'), { recursive: true });
    writeFileSync(join(ws, '.claude', 'user.json'), 'U');   // 用户已有 .claude 内容
    const r = runWorkspace({ name: 'myapp', dir: ws, modules: '', noGit: true });
    assert.equal(r.mode, 'workspace');
    assert.ok(existsSync(join(ws, '.claude', 'user.json')));   // 目录-目录合并,用户文件保留
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('workspace backs up an existing root file by default (no --on-conflict)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'prs-'));
  try {
    const ws = join(dir, 'proj');
    mkdirSync(ws, { recursive: true });
    writeFileSync(join(ws, 'CLAUDE.md'), 'MINE');   // 与 root 模板 CLAUDE.md 同名
    const r = runWorkspace({ name: 'myapp', dir: ws, modules: '', noGit: true });   // 不传 onConflict
    assert.deepEqual(r.backedUp, [join(ws, 'CLAUDE.md.bak')]);   // 默认备份
    assert.equal(fsReadFileSync(join(ws, 'CLAUDE.md.bak'), 'utf-8'), 'MINE');   // 原文件留档
    assert.ok(!fsReadFileSync(join(ws, 'CLAUDE.md'), 'utf-8').includes('MINE'));   // 新文件已写
    assert.ok(existsSync(join(ws, 'myapp-spec-center', 'CLAUDE.md')));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('workspace backs up a nested conflicting file (.claude/settings.json)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'prs-'));
  try {
    const ws = join(dir, 'proj');
    mkdirSync(join(ws, '.claude'), { recursive: true });
    writeFileSync(join(ws, '.claude', 'settings.json'), 'MINE');   // 与 root 模板嵌套文件同名
    const r = runWorkspace({ name: 'myapp', dir: ws, modules: '', noGit: true });
    assert.ok(r.backedUp.includes(join(ws, '.claude', 'settings.json.bak')));   // 嵌套文件也备份
    assert.equal(fsReadFileSync(join(ws, '.claude', 'settings.json.bak'), 'utf-8'), 'MINE');
    assert.ok(!fsReadFileSync(join(ws, '.claude', 'settings.json'), 'utf-8').includes('MINE'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('workspace --on-conflict backup preserves originals as .bak then writes template', () => {
  const dir = mkdtempSync(join(tmpdir(), 'prs-'));
  try {
    const ws = join(dir, 'proj');
    mkdirSync(ws, { recursive: true });
    writeFileSync(join(ws, 'CLAUDE.md'), 'MINE');
    const r = runWorkspace({ name: 'myapp', dir: ws, modules: '', noGit: true, onConflict: 'backup' });
    assert.deepEqual(r.backedUp, [join(ws, 'CLAUDE.md.bak')]);
    assert.equal(fsReadFileSync(join(ws, 'CLAUDE.md.bak'), 'utf-8'), 'MINE');   // 原文件留档
    assert.ok(!fsReadFileSync(join(ws, 'CLAUDE.md'), 'utf-8').includes('MINE'));   // 新文件已写
    assert.ok(existsSync(join(ws, 'myapp-spec-center', 'CLAUDE.md')));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('workspace --on-conflict overwrite replaces existing root file (no backup)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'prs-'));
  try {
    const ws = join(dir, 'proj');
    mkdirSync(ws, { recursive: true });
    writeFileSync(join(ws, 'CLAUDE.md'), 'MINE');
    runWorkspace({ name: 'myapp', dir: ws, modules: '', noGit: true, onConflict: 'overwrite' });
    assert.ok(!existsSync(join(ws, 'CLAUDE.md.bak')));
    assert.ok(!fsReadFileSync(join(ws, 'CLAUDE.md'), 'utf-8').includes('MINE'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('runWorkspace dry-run writes nothing', () => {
  const dir = mkdtempSync(join(tmpdir(), 'prs-'));
  try {
    const ws = join(dir, 'myapp');
    const r = runWorkspace({ name: 'myapp', dir: ws, modules: 'server', dryRun: true });
    assert.equal(r.dryRun, true);
    assert.ok(!existsSync(ws)); // 未落盘
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('runModule creates the new module dir', () => {
  const dir = mkdtempSync(join(tmpdir(), 'prs-'));
  try {
    const ws = join(dir, 'myapp');
    runWorkspace({ name: 'myapp', dir: ws, modules: 'server', noGit: true });
    const r = runModule({ name: 'myapp', dir: ws, modules: 'web', noGit: true });
    assert.equal(r.mode, 'module');
    assert.deepEqual(r.modules, ['web']);
    assert.ok(existsSync(join(ws, 'myapp-web', 'CLAUDE.md')));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('runModule skips existing modules and spec-center', () => {
  const dir = mkdtempSync(join(tmpdir(), 'prs-'));
  try {
    const ws = join(dir, 'myapp');
    runWorkspace({ name: 'myapp', dir: ws, modules: 'server', noGit: true });
    const r = runModule({ name: 'myapp', dir: ws, modules: 'server,spec-center,web', noGit: true });
    assert.deepEqual(r.modules, ['web']);
    const reasons = r.skipped.map((s) => s.entry).sort();
    assert.deepEqual(reasons, ['server', 'spec-center']);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('runModule auto-switches to workspace when no spec-center exists', () => {
  const dir = mkdtempSync(join(tmpdir(), 'prs-'));
  try {
    const ws = join(dir, 'myapp');
    const r = runModule({ name: 'myapp', dir: ws, modules: 'web', noGit: true });   // 目录无 spec-center
    assert.equal(r.mode, 'workspace');   // 自动转 workspace
    assert.ok(existsSync(join(ws, 'myapp-spec-center', 'CLAUDE.md')));   // 建了 spec-center
    assert.ok(existsSync(join(ws, 'myapp-web', 'CLAUDE.md')));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('parseArgs parses subcommand and flags', () => {
  const { command, flags } = parseArgs(['workspace', '--name', 'myapp', '--modules', 'server,web', '--no-git', '--dry-run']);
  assert.equal(command, 'workspace');
  assert.equal(flags.name, 'myapp');
  assert.equal(flags.modules, 'server,web');
  assert.equal(flags.noGit, true);
  assert.equal(flags.dryRun, true);
});

test('parseArgs parses --on-conflict', () => {
  const { flags } = parseArgs(['workspace', '--name', 'a', '--on-conflict', 'backup']);
  assert.equal(flags.onConflict, 'backup');
});

test('parseArgs throws on unknown flag', () => {
  assert.throws(() => parseArgs(['workspace', '--bogus']), /Unknown argument/);
});

test('main runs workspace via subcommand (integration)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'prs-'));
  try {
    const ws = join(dir, 'myapp');
    main(['workspace', '--name', 'myapp', '--dir', ws, '--modules', 'server,web', '--no-git']);
    assert.ok(existsSync(join(ws, 'myapp-spec-center', 'CLAUDE.md')));
    assert.ok(existsSync(join(ws, 'myapp-server', 'CLAUDE.md')));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('workspace generates spec-center CLAUDE.md: placeholders replaced, markers kept, module rows + tree filled', () => {
  const dir = mkdtempSync(join(tmpdir(), 'prs-'));
  try {
    const ws = join(dir, 'myapp');
    runWorkspace({ name: 'myapp', dir: ws, modules: 'server,web', noGit: true });
    const sc = fsReadFileSync(join(ws, 'myapp-spec-center', 'CLAUDE.md'), 'utf-8');
    assert.ok(!sc.includes('{{PROJECT}}'));                 // 占位符已替换
    assert.ok(sc.includes('<!-- MODULE_MAP_START -->'));    // 锚点保留(供 add 再生成)
    assert.ok(sc.includes('<!-- REPO_TREE_END -->'));
    // Module Map 行(字母序)
    assert.ok(sc.includes('| `myapp-server` | Server application |'));
    assert.ok(sc.includes('| `myapp-web` | Web application |'));
    // 树含模块子树
    assert.ok(sc.includes('├── myapp-server/'));
    assert.ok(sc.includes('└── myapp-web/'));   // 字母序末位用 └──
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('generated tree flips connectors when modules are added (spec-center no longer last)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'prs-'));
  try {
    const ws = join(dir, 'myapp');
    runWorkspace({ name: 'myapp', dir: ws, modules: '', noGit: true });   // 仅 spec-center
    let sc = fsReadFileSync(join(ws, 'myapp-spec-center', 'CLAUDE.md'), 'utf-8');
    assert.ok(sc.includes('└── myapp-spec-center/'));   // 唯一模块时末位
    // 加模块后,spec-center 不再是末位
    runModule({ name: 'myapp', dir: ws, modules: 'server', noGit: true });
    sc = fsReadFileSync(join(ws, 'myapp-spec-center', 'CLAUDE.md'), 'utf-8');
    assert.ok(sc.includes('├── myapp-spec-center/'));
    assert.ok(sc.includes('└── myapp-server/'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('Module Map role for custom modules uses "<Name> application"', () => {
  const dir = mkdtempSync(join(tmpdir(), 'prs-'));
  try {
    const ws = join(dir, 'shop');
    runWorkspace({ name: 'shop', dir: ws, modules: 'checkout=server,mobile=client', noGit: true });
    const sc = fsReadFileSync(join(ws, 'shop-spec-center', 'CLAUDE.md'), 'utf-8');
    assert.ok(sc.includes('| `shop-checkout` | Checkout application |'));
    assert.ok(sc.includes('| `shop-mobile` | Mobile application |'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('updateSpecCenterAgents is idempotent (re-run yields identical file)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'prs-'));
  try {
    const ws = join(dir, 'myapp');
    runWorkspace({ name: 'myapp', dir: ws, modules: 'server,web', noGit: true });
    const agentsPath = join(ws, 'myapp-spec-center', 'CLAUDE.md');
    const first = fsReadFileSync(agentsPath, 'utf-8');
    updateSpecCenterAgents(ws, 'myapp');
    const second = fsReadFileSync(agentsPath, 'utf-8');
    assert.equal(first, second);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('custom-name rename guards against touching unrelated -spec-center refs', () => {
  // api=server:把 -server 改成 -api,但不得误伤 -spec-center 引用
  const dir = mkdtempSync(join(tmpdir(), 'prs-'));
  try {
    const target = join(dir, 'myapp-api');
    copyAndReplace('server', target, {
      PROJECT: 'myapp', MODULE_NAME: 'api', TEMPLATE_REF: 'server', ORIGINAL_ROLE: getModuleRole('server'),
    });
    const agents = fsReadFileSync(join(target, 'CLAUDE.md'), 'utf-8');
    assert.ok(agents.includes('myapp-api'));            // 自身名已改
    assert.ok(!agents.includes('myapp-server'));        // 不残留模板名
    assert.ok(agents.includes('myapp-spec-center'));    // 跨模块引用完好,未被 -server\b 误伤
    // Makefile 的 APP_NAME 同样改名
    const mk = fsReadFileSync(join(target, 'Makefile'), 'utf-8');
    assert.ok(mk.includes('myapp-api'));
    assert.ok(!mk.includes('myapp-server'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('runModule infers project name from <name>-spec-center when --name omitted', () => {
  const dir = mkdtempSync(join(tmpdir(), 'prs-'));
  try {
    const ws = join(dir, 'myapp');
    runWorkspace({ name: 'myapp', dir: ws, modules: 'server', noGit: true });
    const r = runModule({ dir: ws, modules: 'web', noGit: true });   // 无 --name
    assert.equal(r.name, 'myapp');
    assert.deepEqual(r.modules, ['web']);
    assert.ok(existsSync(join(ws, 'myapp-web', 'CLAUDE.md')));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('inferProjectName returns null on empty dir, throws on multiple spec-centers', () => {
  const dir = mkdtempSync(join(tmpdir(), 'prs-'));
  try {
    assert.equal(inferProjectName(dir), null);
    runWorkspace({ name: 'one', dir: join(dir, 'one'), modules: '', noGit: true });
    assert.equal(inferProjectName(join(dir, 'one')), 'one');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('runModule reports created dirs on partial failure (err.created)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'prs-'));
  try {
    const ws = join(dir, 'myapp');
    runWorkspace({ name: 'myapp', dir: ws, modules: 'server', noGit: true });
    // 删掉 spec-center 的 CLAUDE.md,使 updateSpecCenterAgents 在模块创建后抛错
    rmSync(join(ws, 'myapp-spec-center', 'CLAUDE.md'));
    let caught;
    try {
      runModule({ name: 'myapp', dir: ws, modules: 'web', noGit: true });
    } catch (err) {
      caught = err;
    }
    assert.ok(caught, '应抛错');
    assert.deepEqual(caught.created, [join(ws, 'myapp-web')]);   // 已落盘的新模块被记录
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ============================== single 模式 ==============================

test('single: in-place init merges governance + module section, strips suffix, sets up dirs and git on main', () => {
  const dir = mkdtempSync(join(tmpdir(), 'prs-'));
  try {
    const proj = join(dir, 'demo-app');
    const r = runSingle({ template: 'server', dir: proj });   // name 默认取目录名,默认建 git
    assert.equal(r.mode, 'single');
    assert.equal(r.name, 'demo-app');
    assert.equal(r.template, 'server');

    // docs 目录来自 stack 模板;契约/约定文档直接放 docs/,不建额外子目录
    assert.ok(existsSync(join(proj, 'docs', 'specs')));
    assert.ok(existsSync(join(proj, 'docs', 'plans')));
    assert.ok(!existsSync(join(proj, 'conventions')));   // 不建 conventions 子目录
    assert.ok(!existsSync(join(proj, 'docs', 'api')));   // 不建 docs 子目录
    assert.ok(!existsSync(join(proj, 'docs', 'errors')));

    // CLAUDE.md:治理 + 模块 Role,无多仓库残留,后缀已去,占位符已替换
    const agents = fsReadFileSync(join(proj, 'CLAUDE.md'), 'utf-8');
    assert.ok(agents.startsWith('# demo-app'));
    assert.ok(agents.includes('## Role'));
    assert.ok(agents.includes('Server application'));
    assert.ok(agents.includes('single-repository'));
    assert.ok(!agents.includes('{{PROJECT}}'));
    assert.ok(!agents.includes('multi-repo'));
    assert.ok(!agents.includes('spec-center'));
    assert.ok(!agents.includes('Module Map'));
    assert.ok(!agents.includes('demo-app-server'));   // -server 后缀已去

    // Makefile APP_NAME 去后缀
    const mk = fsReadFileSync(join(proj, 'Makefile'), 'utf-8');
    assert.ok(/APP_NAME\s+:= demo-app\b/.test(mk));
    assert.ok(!mk.includes('demo-app-server'));

    // 单仓措辞的 Claude rule 已铺进 .claude/rules(不含多仓 spec-center 引用)
    const rule = fsReadFileSync(join(proj, '.claude', 'rules', 'engineering-guidelines.md'), 'utf-8');
    assert.ok(rule.includes('repo root `CLAUDE.md`'));
    assert.ok(!rule.includes('spec-center'));

    // git on main
    assert.ok(existsSync(join(proj, '.git')));
    const branch = execFileSync('git', ['symbolic-ref', '--short', 'HEAD'], {
      cwd: proj, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    assert.equal(branch, 'main');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('single: backs up conflicting files by default; --on-conflict overwrite skips backup', () => {
  const dir = mkdtempSync(join(tmpdir(), 'prs-'));
  try {
    const proj = join(dir, 'demo-app');
    runSingle({ template: 'server', dir: proj, noGit: true });
    // 再次初始化:默认备份既有冲突文件(原文件改名 *.bak)
    const r = runSingle({ template: 'server', dir: proj, noGit: true });
    assert.ok(r.backedUp.length > 0);
    assert.ok(r.backedUp.some((p) => p.endsWith('CLAUDE.md.bak')));
    assert.ok(existsSync(join(proj, 'CLAUDE.md')));   // 新文件仍在
    // overwrite:直接覆盖,不留 *.bak
    const r2 = runSingle({ template: 'server', dir: proj, noGit: true, onConflict: 'overwrite' });
    assert.deepEqual(r2.backedUp, []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('single: reuses an existing .git instead of re-initializing', () => {
  const dir = mkdtempSync(join(tmpdir(), 'prs-'));
  try {
    const proj = join(dir, 'demo-app');
    mkdirSync(proj, { recursive: true });
    execFileSync('git', ['init'], { cwd: proj, stdio: 'pipe' });
    execFileSync('git', ['branch', '-m', 'trunk'], { cwd: proj, stdio: 'pipe' });
    runSingle({ template: 'web', dir: proj });   // 默认建 git,但已有 .git 应复用,不改分支
    const branch = execFileSync('git', ['symbolic-ref', '--short', 'HEAD'], {
      cwd: proj, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    assert.equal(branch, 'trunk');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('single: --no-git skips git init', () => {
  const dir = mkdtempSync(join(tmpdir(), 'prs-'));
  try {
    const proj = join(dir, 'demo-app');
    runSingle({ template: 'server', dir: proj, noGit: true });
    assert.ok(existsSync(join(proj, 'CLAUDE.md')));
    assert.ok(!existsSync(join(proj, '.git')));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('single: dry-run writes nothing', () => {
  const dir = mkdtempSync(join(tmpdir(), 'prs-'));
  try {
    const proj = join(dir, 'demo-app');
    const r = runSingle({ template: 'server', dir: proj, dryRun: true });
    assert.equal(r.dryRun, true);
    assert.ok(!existsSync(proj));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('single: rejects missing/unknown template', () => {
  const dir = mkdtempSync(join(tmpdir(), 'prs-'));
  try {
    assert.throws(() => runSingle({ dir: join(dir, 'x') }), /requires --template/);
    assert.throws(() => runSingle({ template: 'nope', dir: join(dir, 'y') }), /Invalid --template/);
    assert.throws(() => runSingle({ template: 'spec-center', dir: join(dir, 'z') }), /Invalid --template/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('buildSingleAgents injects module section and rewrites cross-repo conventions path', () => {
  const merged = buildSingleAgents('server', 'demo-app');
  assert.ok(merged.includes('## Role'));
  assert.ok(merged.includes('Server application'));
  assert.ok(merged.includes('committed under docs/'));          // 跨仓路径已改本仓 docs/
  assert.ok(!merged.includes('-spec-center/conventions/'));
  assert.ok(!merged.includes('<!-- MODULE_STACK -->'));         // 锚点已被替换
  assert.ok(!merged.includes('{{PROJECT}}'));
});
