import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateProjectName,
  resolveTemplatesDir,
  getAvailableTemplateNames,
  getModuleRole,
  parseModuleList,
  copyAndReplace,
  gitInit,
  createModule,
  filterAgentsMd,
  insertIntoModuleMap,
  insertIntoRepoTree,
  mergeAgentsMd,
  buildModuleRole,
  buildModuleTreeEntry,
  syncAgentsMd,
  runInit,
} from './scaffold.mjs';
import { writeFileSync as writeFileToDisk } from 'node:fs';
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

const MARKER_FIXTURE = [
  'Line top',
  '<!-- MODULE:client -->| `x-client` | Client |',
  '<!-- MODULE:server -->| `x-server` | Server |',
  '| `x-spec-center` | SSOT |',
  '<!-- BEGIN MODULE:server -->### Server',
  'server body',
  '<!-- END MODULE:server -->',
  '<!-- BEGIN MODULE:web -->### Web',
  'web body',
  '<!-- END MODULE:web -->',
  'Line bottom',
].join('\n');

test('filterAgentsMd keeps selected single-line markers, drops others', () => {
  const out = filterAgentsMd(MARKER_FIXTURE, ['server']);
  assert.ok(out.includes('| `x-server` | Server |'));   // 选中 → 保留且去标记
  assert.ok(!out.includes('| `x-client` | Client |'));   // 未选 → 整行删除
  assert.ok(!out.includes('<!-- MODULE:server -->'));    // 标记被去掉
  assert.ok(out.includes('| `x-spec-center` | SSOT |')); // 无标记行恒保留
});

test('filterAgentsMd keeps selected block markers, drops unselected blocks', () => {
  const out = filterAgentsMd(MARKER_FIXTURE, ['server']);
  assert.ok(out.includes('### Server'));
  assert.ok(out.includes('server body'));
  assert.ok(!out.includes('### Web'));   // web 块整段删除
  assert.ok(!out.includes('web body'));
  assert.ok(!out.includes('BEGIN MODULE'));
  assert.ok(!out.includes('END MODULE'));
});

const MAP_FIXTURE = [
  '### Module Map',
  '',
  '| Module | Role |',
  '|---|---|',
  '| `myapp-server` | Server application |',
  '| `myapp-spec-center` | SSOT |',
  '',
  '> note after table',
].join('\n');

test('insertIntoModuleMap inserts row in alphabetical order', () => {
  const out = insertIntoModuleMap(MAP_FIXTURE, '| `myapp-api` | Api application |', 'myapp-api');
  const lines = out.split('\n');
  const dataRows = lines.filter((l) => l.startsWith('| `myapp-'));
  // 字母序:api < server < spec-center
  assert.deepEqual(dataRows, [
    '| `myapp-api` | Api application |',
    '| `myapp-server` | Server application |',
    '| `myapp-spec-center` | SSOT |',
  ]);
  assert.ok(out.includes('> note after table')); // 表后内容保留
});

test('insertIntoModuleMap is idempotent for duplicate module', () => {
  const out = insertIntoModuleMap(MAP_FIXTURE, '| `myapp-server` | dup |', 'myapp-server');
  assert.equal(out, MAP_FIXTURE); // 重名不插入,原样返回
});

// 最小目录树 fixture(含一个有子树的末节点 spec-center)
const TREE_FIXTURE = [
  '## Repository Structure',
  '',
  '```',
  'workspace/',
  '├── AGENTS.md',
  '└── myapp-spec-center/',
  '    └── AGENTS.md',
  '```',
].join('\n');

const SERVER_ENTRY = [
  '└── myapp-server/            # Server application',
  '    ├── AGENTS.md                 # Server-specific conventions',
  '    └── docs/',
  '        ├── specs/                # Server-specific specifications',
  '        └── plans/                # Server-specific implementation plans',
].join('\n');

const WEB_ENTRY = [
  '└── myapp-web/            # Web application',
  '    ├── AGENTS.md                 # Web-specific conventions',
  '    └── docs/',
  '        ├── specs/                # Web-specific specifications',
  '        └── plans/                # Web-specific implementation plans',
].join('\n');

test('insertIntoRepoTree fixes connectors on first add', () => {
  const out = insertIntoRepoTree(TREE_FIXTURE, SERVER_ENTRY);
  const lines = out.split('\n');
  // 原末节点 └── 变为 ├──,其子树缩进加竖线
  assert.ok(lines.includes('├── myapp-spec-center/'));
  assert.ok(lines.includes('│   └── AGENTS.md'));
  // 新节点为新的末节点 └──
  assert.ok(lines.includes('└── myapp-server/            # Server application'));
  // 顶层 ├── AGENTS.md 不受影响
  assert.ok(lines.includes('├── AGENTS.md'));
  // 整棵树只有一个顶层 └──(新末节点)
  const topLevelLast = lines.filter((l) => /^└── /.test(l));
  assert.equal(topLevelLast.length, 1);
  assert.equal(topLevelLast[0], '└── myapp-server/            # Server application');
});

test('insertIntoRepoTree handles consecutive adds (server then web)', () => {
  const afterServer = insertIntoRepoTree(TREE_FIXTURE, SERVER_ENTRY);
  const afterWeb = insertIntoRepoTree(afterServer, WEB_ENTRY);
  const lines = afterWeb.split('\n');

  // server 现在变成 ├──,其子树缩进升级为竖线
  assert.ok(lines.includes('├── myapp-server/            # Server application'));
  assert.ok(lines.includes('│   ├── AGENTS.md                 # Server-specific conventions'));
  assert.ok(lines.includes('│   └── docs/'));
  assert.ok(lines.includes('│   │   ├── specs/                # Server-specific specifications'));
  assert.ok(lines.includes('│   │   └── plans/                # Server-specific implementation plans'));

  // web 是唯一的顶层末节点 └──
  const topLevelLast = lines.filter((l) => /^└── /.test(l));
  assert.equal(topLevelLast.length, 1);
  assert.equal(topLevelLast[0], '└── myapp-web/            # Web application');

  // spec-center 依旧是 ├──(更早被转换)
  assert.ok(lines.includes('├── myapp-spec-center/'));
});

test('buildModuleRole returns template role for built-in, "<Name> application" for custom', () => {
  assert.equal(typeof buildModuleRole({ name: 'server', templateRef: 'server', isCustom: false }), 'string');
  assert.equal(
    buildModuleRole({ name: 'api-gateway', templateRef: 'server', isCustom: true }),
    'Api-gateway application'
  );
});

test('buildModuleTreeEntry builds a 5-line subtree starting with └──', () => {
  const entry = buildModuleTreeEntry('myapp', 'server', 'Server application');
  const lines = entry.split('\n');
  assert.equal(lines.length, 5);
  assert.ok(lines[0].startsWith('└── myapp-server/'));
  assert.ok(lines[0].includes('# Server application'));
  assert.ok(lines[1].includes('AGENTS.md'));
});

test('mergeAgentsMd merges modules into Module Map + tree of an on-disk file', () => {
  const dir = mkdtempSync(join(tmpdir(), 'prs-'));
  try {
    // 先 init 出一个 spec-center(借用 syncAgentsMd 还没实现,这里手写最小 AGENTS.md)
    const scDir = join(dir, 'myapp-spec-center');
    copyAndReplace('spec-center', scDir, { PROJECT: 'myapp' });
    // 用真实模板内容直接写一份过滤后的 AGENTS.md(只选 server)
    const tpl = fsReadFileSync(resolveTemplatesDir('spec-center', 'AGENTS.md'), 'utf-8');
    const filtered = filterAgentsMd(tpl, ['server']).replace(/\{\{PROJECT\}\}/g, 'myapp');
    writeFileToDisk(join(scDir, 'AGENTS.md'), filtered);

    mergeAgentsMd(dir, 'myapp', [{ name: 'api-gateway', templateRef: 'server', isCustom: true }]);
    const out = fsReadFileSync(join(scDir, 'AGENTS.md'), 'utf-8');
    assert.ok(out.includes('| `myapp-api-gateway` | Api-gateway application |'));
    assert.ok(out.includes('myapp-api-gateway/'));
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

test('syncAgentsMd writes filtered spec-center AGENTS.md for selected modules', () => {
  const dir = mkdtempSync(join(tmpdir(), 'prs-'));
  try {
    const scDir = join(dir, 'myapp-spec-center');
    copyAndReplace('spec-center', scDir, { PROJECT: 'myapp' });
    const modules = [
      { name: 'spec-center', templateRef: 'spec-center', isCustom: false },
      { name: 'server', templateRef: 'server', isCustom: false },
    ];
    syncAgentsMd(dir, 'myapp', modules);
    const out = fsReadFileSync(join(scDir, 'AGENTS.md'), 'utf-8');
    assert.ok(!out.includes('{{PROJECT}}'));        // 占位符全部替换
    assert.ok(!out.includes('MODULE:'));            // 标记被处理掉
    assert.ok(out.includes('myapp-server'));        // 选中的 server 保留
    // 未选 web/client 的标记专属块(Module Map 行 / 目录树子树)被删
    assert.ok(!out.includes('| `myapp-web` |'));
    assert.ok(!out.includes('| `myapp-client` |'));
    assert.ok(!out.includes('# Web application'));
    assert.ok(!out.includes('# Client application'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('syncAgentsMd merges custom modules after filtering', () => {
  const dir = mkdtempSync(join(tmpdir(), 'prs-'));
  try {
    const scDir = join(dir, 'myapp-spec-center');
    copyAndReplace('spec-center', scDir, { PROJECT: 'myapp' });
    const modules = [
      { name: 'spec-center', templateRef: 'spec-center', isCustom: false },
      { name: 'api-gateway', templateRef: 'server', isCustom: true },
    ];
    syncAgentsMd(dir, 'myapp', modules);
    const out = fsReadFileSync(join(scDir, 'AGENTS.md'), 'utf-8');
    assert.ok(out.includes('| `myapp-api-gateway` | Api-gateway application |'));
    assert.ok(out.includes('myapp-api-gateway/'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
