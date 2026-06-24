import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateProjectName,
  getAvailableTemplateNames,
  getModuleRole,
  parseModuleList,
} from './scaffold.mjs';

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
