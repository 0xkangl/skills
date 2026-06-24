import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateProjectName } from './scaffold.mjs';

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
