import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateProjectName,
  getAvailableTemplateNames,
  getModuleRole,
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
