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
