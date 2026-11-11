import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  existsSync, linkSync, mkdirSync, mkdtempSync, readFileSync,
  readdirSync, rmSync, statSync, symlinkSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('./merge-remediation.mjs', import.meta.url));
const header = '# 审计问题汇总\n\n> scope: demo · stack: Node · P0×1 P1×1 P2×1\n';
const security = '### [SEC-2] / [ARCH-1] 鉴权缺失\n- **severity**: P0\n- **evidence**: 原始证据  \n- **impact**: 未授权访问';
const performance = '### [PERF-1] 查询重复\n- **severity**: P1\n- **evidence**: N+1\n- **impact**: 延迟';
const testing = '### [TEST-1] 缺回归\n- **severity**: P2\n- **evidence**: 无覆盖\n- **impact**: 复发';
const reportText = `${header}\n## 🔴 P0 严重\n\n${security}\n\n## P1 高\n\n${performance}\n\n## 🟡 P2 中\n\n${testing}\n\n`;
const suggestion = '\n- **suggest**:\n  - 整体方案：添加鉴权。\n  - 落点：router.mjs\n  - 改动量：小';
const suggested = (block, extra = suggestion) => `${block}${extra}\n\n`;

function fixture(t, text = reportText) {
  const dir = mkdtempSync(join(tmpdir(), 'merge remediation '));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const report = join(dir, 'issues report.md');
  const output = join(dir, 'issues remediation.md');
  writeFileSync(report, text);
  const run = (...args) => spawnSync(process.execPath, [script, ...args], {
    encoding: 'utf8', cwd: dir, timeout: 10_000,
  });
  const fragment = (name, content) => {
    const path = join(dir, `${name}.md`);
    writeFileSync(path, content);
    return path;
  };
  const stamp = (path) => run('--report', report, '--stamp', path);
  const merge = (...paths) => run('--report', report, '--output', output,
    ...paths.flatMap((path) => ['--fragment', path]));
  return { dir, report, output, run, fragment, stamp, merge };
}

function ok(result) {
  assert.equal(result.status, 0, result.stderr || result.error?.message || result.stdout);
}

function rejected(result, id, reason) {
  assert.notEqual(result.status, 0, result.stdout);
  assert.match(result.stderr, new RegExp(id));
  if (reason) assert.match(result.stderr, reason);
}

function stamped(f, name, content) {
  const path = f.fragment(name, content);
  ok(f.stamp(path));
  return path;
}

test('CLI stamps and appends a subset in report order without losing existing fields', (t) => {
  const f = fixture(t);
  const perf = stamped(f, 'perf', suggested(performance));
  ok(f.merge(perf));
  const first = readFileSync(f.output, 'utf8');
  assert.ok(first.startsWith(header));
  assert.match(first, /只分析不修复/);
  assert.ok(first.includes(`${performance}${suggestion}`));
  assert.ok(!first.includes(security));
  assert.ok(!first.includes('## 🔴 P0'));
  assert.ok(!first.includes('source-sha256:'));

  const originalBlock = `${performance}${suggestion}\n- **status**: resolved — 用户手填\n- **custom**: 保留  `;
  writeFileSync(f.output, first.replace(`${performance}${suggestion}`, originalBlock));
  const sec = stamped(f, 'sec', suggested(security, `${suggestion}\n- **solution**:`));
  const last = stamped(f, 'test', suggested(testing));
  // 片段顺序与报告相反，产物仍遵循原报告。
  ok(f.merge(last, perf, sec));
  const merged = readFileSync(f.output, 'utf8');
  assert.ok(merged.includes(originalBlock));
  assert.ok(merged.indexOf(security) < merged.indexOf(performance));
  assert.ok(merged.indexOf(performance) < merged.indexOf(testing));
  assert.ok(merged.includes('## 🔴 P0 严重'));
  assert.equal(readFileSync(f.report, 'utf8'), reportText);
  assert.ok(existsSync(sec));
  assert.ok(existsSync(perf));
});

test('no-op preserves every output byte and inode with zero fragments or repeated findings', (t) => {
  const f = fixture(t);
  const part = stamped(f, 'part', suggested(security));
  ok(f.merge(part));
  const custom = `${readFileSync(f.output, 'utf8').trimEnd()}\n- **status**: 已确认\r\n\r\n\n`;
  writeFileSync(f.output, custom);
  const before = statSync(f.output);
  ok(f.merge());
  ok(f.merge(part));
  assert.equal(readFileSync(f.output, 'utf8'), custom);
  assert.equal(statSync(f.output).ino, before.ino);
});

test('same IDs with changed source invalidate a stamped fragment and an existing output', (t) => {
  const f = fixture(t);
  const part = stamped(f, 'part', suggested(security));
  const oldStamp = readFileSync(part, 'utf8').match(/<!-- source-sha256: [a-f0-9]{64} -->/)[0];
  ok(f.merge(part));
  const before = readFileSync(f.output);
  const changed = reportText.replace('原始证据', '已更新证据');
  writeFileSync(f.report, changed);
  rejected(f.merge(), 'SEC-2', /source|原文|源/i);
  assert.deepEqual(readFileSync(f.output), before);
  rmSync(f.output);
  // 原文已同步到新版但 stamp 仍旧：必须由摘要拒绝。
  writeFileSync(part, `${oldStamp}\n\n${suggested(security.replace('原始证据', '已更新证据'))}`);
  rejected(f.merge(part), 'SEC-2', /stamp|摘要|过期/i);
  assert.ok(!existsSync(f.output));
  ok(f.stamp(part));
  ok(f.merge(part));
});

test('stamp covers only the represented source findings', (t) => {
  const f = fixture(t);
  const part = stamped(f, 'part', suggested(security));
  const before = readFileSync(part, 'utf8');
  writeFileSync(f.report, reportText.replace('N+1', 'batch 查询'));
  ok(f.stamp(part));
  assert.equal(readFileSync(part, 'utf8'), before);
  ok(f.merge(part));
});

test('backtick and tilde fences hide fake headings, fields and stamp comments', (t) => {
  const block = `${security}\n- **details**:\n\n\`\`\`\`markdown\n### [UNKNOWN-1] fake\n## P3 fake\n\`\`\`\n- **suggest**: fake\n<!-- source-sha256: ${'0'.repeat(64)} -->\n\`\`\`\`\n\n  ~~~text\n### [SEC-2] duplicate fake\n## 🔴 P0 fake\n  ~~~`;
  const text = `${header}\n## P0\n\n${block}\n\n## P1\n\n${performance}\n`;
  const f = fixture(t, text);
  const part = stamped(f, 'fenced', suggested(block));
  ok(f.merge(part));
  assert.ok(readFileSync(f.output, 'utf8').includes(`${block}${suggestion}`));
});

test('multi-alias findings are indivisible and aliases cannot recur', (t) => {
  const f = fixture(t);
  const incomplete = f.fragment('incomplete', suggested(security.replace(' / [ARCH-1]', '')));
  rejected(f.stamp(incomplete), 'SEC-2', /alias|原文|source/i);
  const repeated = f.fragment('repeated', suggested(security.replace('[ARCH-1]', '[SEC-2]')));
  rejected(f.stamp(repeated), 'SEC-2', /重复|duplicate/i);
});

for (const [name, mutate, id, reason] of [
  ['unknown ID', () => suggested('### [UNKNOWN-9] 未知\n- **evidence**: x'), 'UNKNOWN-9', /未知|unknown/i],
  ['unknown dotted ID', () => suggested('### [SEC.foo-9] 未知\n- **evidence**: x'), 'SEC.foo-9', /未知|unknown/i],
  ['fence before suggest', () => suggested(security, `\n\n~~~text\n不应插入的内容\n~~~${suggestion}`), 'SEC-2', /suggest|字段|field/i],
  ['duplicate finding', () => suggested(security) + suggested(security), 'SEC-2', /重复|duplicate/i],
  ['duplicate alias in another finding', () => suggested(security) + suggested('### [ARCH-1] 冲突'), 'ARCH-1', /重复|duplicate/i],
  ['missing suggest', () => `${security}\n`, 'SEC-2', /suggest/i],
  ['empty suggest', () => suggested(security, '\n- **suggest**:  \n\t\n- **solution**:'), 'SEC-2', /suggest/i],
  ['rewritten evidence', () => suggested(security.replace('原始证据', '改过的证据')), 'SEC-2', /原文|source/i],
  ['rewritten title', () => suggested(security.replace('鉴权缺失', '新标题')), 'SEC-2', /原文|source/i],
  ['prepended suggest', () => security.replace('- **evidence**:', '- **suggest**: 提前插入\n- **evidence**:') + '\n', 'SEC-2', /原文|source|suggest/i],
  ['extra fragment field', () => suggested(security, `${suggestion}\n- **status**: 不该新增`), 'SEC-2', /status|字段|field/i],
  ['duplicate suggest', () => suggested(security, `${suggestion}\n- **suggest**: 另一个`), 'SEC-2', /suggest|重复|duplicate/i],
]) {
  test(`stamp rejects ${name} before modifying the fragment`, (t) => {
    const f = fixture(t);
    const part = f.fragment('invalid', mutate());
    const before = readFileSync(part);
    rejected(f.stamp(part), id, reason);
    assert.deepEqual(readFileSync(part), before);
    assert.ok(!existsSync(f.output));
  });
}

test('source duplicate aliases are rejected', (t) => {
  const f = fixture(t, `${reportText}\n${suggested('### [ARCH-1] 重复')}`);
  rejected(f.merge(), 'ARCH-1', /重复|duplicate/i);
  assert.ok(!existsSync(f.output));
});

test('merging requires a valid stamp and rejects invalid fragments without damaging output', (t) => {
  const f = fixture(t);
  const good = stamped(f, 'good', suggested(performance));
  ok(f.merge(good));
  const before = readFileSync(f.output);
  for (const [name, content, reason] of [
    ['missing stamp', suggested(security), /stamp|摘要/i],
    ['stale stamp', `<!-- source-sha256: ${'0'.repeat(64)} -->\n\n${suggested(security)}`, /stamp|摘要/i],
    ['malformed stamp', `<!-- source-sha256: bad -->\n${suggested(security)}`, /stamp|摘要/i],
    ['changed source', readFileSync(good, 'utf8').replace('N+1', 'tampered'), /原文|source/i],
    ['empty suggest', readFileSync(good, 'utf8').replace(suggestion, '\n- **suggest**: \n- **solution**:'), /suggest/i],
  ]) {
    const part = f.fragment(name, content);
    rejected(f.merge(part), name.includes('source') || name === 'empty suggest' ? 'PERF-1' : 'SEC-2', reason);
    assert.deepEqual(readFileSync(f.output), before);
  }
  assert.deepEqual(readdirSync(f.dir).filter((name) => name.endsWith('.tmp')), []);
});

test('conflicting fragments and repeated IDs across fragments are rejected', (t) => {
  const f = fixture(t);
  const first = stamped(f, 'first', suggested(security));
  const conflict = stamped(f, 'conflict', suggested(security, '\n- **suggest**: 完全不同方案'));
  rejected(f.merge(first, conflict), 'SEC-2', /冲突|重复|conflict|duplicate/i);
  assert.ok(!existsSync(f.output));
  rejected(f.merge(first, first), 'SEC-2', /重复|duplicate/i);
  ok(f.merge(first));
  const before = readFileSync(f.output);
  rejected(f.merge(conflict), 'SEC-2', /冲突|conflict/i);
  assert.deepEqual(readFileSync(f.output), before);
});

test('existing solution and status survive a duplicate fragment with a blank solution', (t) => {
  const f = fixture(t);
  const part = stamped(f, 'part', suggested(security, `${suggestion}\n- **solution**:`));
  ok(f.merge(part));
  writeFileSync(f.output, readFileSync(f.output, 'utf8').replace('- **solution**:', '- **solution**: B\n- **status**: resolved'));
  const before = readFileSync(f.output);
  ok(f.merge(part));
  assert.deepEqual(readFileSync(f.output), before);
});

test('--check validates without creating or updating output', (t) => {
  const f = fixture(t);
  const first = stamped(f, 'first', suggested(security));
  const second = stamped(f, 'second', suggested(performance));
  ok(f.run('--report', f.report, '--output', f.output, '--fragment', first, '--check'));
  assert.ok(!existsSync(f.output));
  ok(f.merge(first));
  const before = readFileSync(f.output);
  ok(f.run('--report', f.report, '--output', f.output, '--fragment', second, '--check'));
  assert.deepEqual(readFileSync(f.output), before);
  writeFileSync(second, readFileSync(second, 'utf8').replace('N+1', 'bad'));
  rejected(f.run('--report', f.report, '--output', f.output, '--fragment', second, '--check'), 'PERF-1');
  assert.deepEqual(readFileSync(f.output), before);
});

test('first merge with zero findings gives a normal explanation', (t) => {
  const text = '# 空报告\n\n> scope: demo · P0×0 P1×0 P2×0 P3×0\n';
  const f = fixture(t, text);
  ok(f.merge());
  const output = readFileSync(f.output, 'utf8');
  assert.ok(output.startsWith(text));
  assert.match(output, /0|暂无|没有/);
  assert.match(output, /finding/i);
  const before = readFileSync(f.output);
  ok(f.merge());
  assert.deepEqual(readFileSync(f.output), before);
});

test('zero fragments creates an empty subset and never consumes unlisted fragments', (t) => {
  const f = fixture(t);
  const ignored = f.fragment('unlisted', '### [UNKNOWN-1] broken');
  const nested = join(f.dir, 'fragments');
  mkdirSync(nested);
  writeFileSync(join(nested, 'invalid.md'), 'bad');
  ok(f.merge());
  assert.ok(!readFileSync(f.output, 'utf8').includes('### ['));
  assert.equal(readFileSync(ignored, 'utf8'), '### [UNKNOWN-1] broken');
  assert.deepEqual(readdirSync(nested), ['invalid.md']);
});

test('output refuses same paths, symlink aliases and hardlink aliases of every input', (t) => {
  const f = fixture(t);
  const part = stamped(f, 'fragment with spaces', suggested(security));
  for (const input of [f.report, part]) {
    const before = readFileSync(input);
    const symbolic = join(f.dir, `symbolic-${input === part ? 'part' : 'report'}.md`);
    const hard = join(f.dir, `hard-${input === part ? 'part' : 'report'}.md`);
    symlinkSync(input, symbolic);
    linkSync(input, hard);
    for (const output of [input, symbolic, hard]) {
      const result = f.run('--report', f.report, '--output', output, '--fragment', part);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /path|alias|input|覆盖|路径|输入/i);
      assert.deepEqual(readFileSync(input), before);
    }
  }
  const parentAlias = join(f.dir, 'directory alias');
  symlinkSync(f.dir, parentAlias, 'dir');
  assert.notEqual(f.run('--report', f.report, '--output', join(parentAlias, 'issues report.md')).status, 0);
  assert.deepEqual(readdirSync(f.dir).filter((name) => name.endsWith('.tmp')), []);
});

test('stamp cannot overwrite the report through a path alias', (t) => {
  const f = fixture(t);
  const alias = join(f.dir, 'report alias.md');
  linkSync(f.report, alias);
  const before = readFileSync(f.report);
  assert.notEqual(f.stamp(alias).status, 0);
  assert.deepEqual(readFileSync(f.report), before);
});

test('filesystem errors leave unrelated temps and existing output intact', (t) => {
  const f = fixture(t);
  const part = stamped(f, 'part', suggested(security));
  mkdirSync(f.output);
  const sentinel = join(f.dir, '.unrelated.tmp');
  writeFileSync(sentinel, 'keep');
  const result = f.merge(part);
  assert.notEqual(result.status, 0);
  assert.equal(readFileSync(sentinel, 'utf8'), 'keep');
  assert.ok(statSync(f.output).isDirectory());
  assert.deepEqual(readdirSync(f.dir).filter((name) => name.endsWith('.tmp')), ['.unrelated.tmp']);
});

test('--help works and stamp mode is mutually exclusive with merge options', (t) => {
  const f = fixture(t);
  const help = f.run('--help');
  ok(help);
  for (const option of ['--report', '--output', '--fragment', '--check', '--stamp']) assert.ok(help.stdout.includes(option));
  const part = f.fragment('part', suggested(security));
  for (const args of [
    ['--output', f.output], ['--fragment', part], ['--check'],
  ]) {
    assert.notEqual(f.run('--report', f.report, '--stamp', part, ...args).status, 0);
  }
  for (const args of [[], ['--report'], ['--report', f.report, '--unknown'], ['--report', f.report, '--output']]) {
    assert.notEqual(f.run(...args).status, 0);
  }
  assert.equal(readFileSync(part, 'utf8'), suggested(security));
});

test('importing the module has no CLI reads, writes, output or exit side effects', (t) => {
  const f = fixture(t);
  const result = spawnSync(process.execPath, ['--input-type=module', '-e',
    'await import(process.argv[1]); process.stdout.write("imported");',
    new URL('./merge-remediation.mjs', import.meta.url).href,
    '--report', f.report, '--output', f.output], { encoding: 'utf8', cwd: dirname(f.report) });
  ok(result);
  assert.equal(result.stdout, 'imported');
  assert.equal(result.stderr, '');
  assert.ok(!existsSync(f.output));
});


test('atomic replacement preserves the previous inode through an independent hardlink', (t) => {
  const f = fixture(t);
  const first = stamped(f, 'first', suggested(security));
  const second = stamped(f, 'second', suggested(performance));
  ok(f.merge(first));
  const previous = join(f.dir, 'previous output.md');
  linkSync(f.output, previous);
  const before = readFileSync(previous);
  ok(f.merge(second));
  assert.deepEqual(readFileSync(previous), before);
  assert.notEqual(statSync(f.output).ino, statSync(previous).ino);
  assert.ok(readFileSync(f.output, 'utf8').includes(performance));
  assert.deepEqual(readdirSync(f.dir).filter((name) => name.endsWith('.tmp')), []);
});

test('source and existing body line endings stay intact when adding a new finding', (t) => {
  const crlfSecurity = security.replaceAll('\n', '\r\n');
  const f = fixture(t, reportText.replaceAll('\n', '\r\n'));
  const first = stamped(f, 'first', suggested(crlfSecurity, suggestion.replaceAll('\n', '\r\n')));
  const second = stamped(f, 'second', suggested(performance.replaceAll('\n', '\r\n')));
  ok(f.merge(first));
  const original = `${crlfSecurity}${suggestion.replaceAll('\n', '\r\n')}\r\n- **status**: 保留  `;
  writeFileSync(f.output, readFileSync(f.output, 'utf8').replace(`${crlfSecurity}${suggestion.replaceAll('\n', '\r\n')}`, original));
  ok(f.merge(second));
  assert.ok(readFileSync(f.output, 'utf8').includes(original));
});

test('CLI executes through .agents and .claude directory symlink aliases', (t) => {
  const f = fixture(t);
  const agents = join(f.dir, '.agents');
  mkdirSync(agents);
  symlinkSync(dirname(script), join(agents, 'remediate-suggest'), 'dir');
  symlinkSync(agents, join(f.dir, '.claude'), 'dir');
  const runAlias = (alias, ...args) => spawnSync(process.execPath, [
    join(f.dir, alias, 'remediate-suggest', 'merge-remediation.mjs'), ...args,
  ], { encoding: 'utf8', cwd: f.dir, timeout: 10_000 });
  for (const alias of ['.agents', '.claude']) {
    const help = runAlias(alias, '--help');
    ok(help);
    assert.match(help.stdout, /--report/);
  }
  const part = f.fragment('part', suggested(security));
  ok(runAlias('.claude', '--report', f.report, '--stamp', part));
  assert.match(readFileSync(part, 'utf8'), /<!-- source-sha256: [a-f0-9]{64} -->/);
  ok(runAlias('.agents', '--report', f.report, '--output', f.output, '--fragment', part));
  assert.ok(readFileSync(f.output, 'utf8').includes(`${security}${suggestion}`));
});

test('pure module import with no argv entrypoint has no CLI side effects', (t) => {
  const f = fixture(t);
  const url = new URL('./merge-remediation.mjs', import.meta.url).href;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e',
    `await import(${JSON.stringify(url)}); process.stdout.write('imported');`,
  ], { encoding: 'utf8', cwd: f.dir });
  ok(result);
  assert.equal(result.stdout, 'imported');
  assert.equal(result.stderr, '');
  assert.deepEqual(readdirSync(f.dir), ['issues report.md']);
});

test('blank reports are allowed as empty subsets without general report meta validation', (t) => {
  const f = fixture(t, '');
  ok(f.merge());
  assert.match(readFileSync(f.output, 'utf8'), /0 条/);
  assert.equal(readFileSync(f.report, 'utf8'), '');
});

test('a real finding without a supported severity section is rejected with its ID', (t) => {
  const f = fixture(t, `${header}\n${security}\n`);
  rejected(f.merge(), 'SEC-2', /P0|严重度/);
  assert.ok(!existsSync(f.output));
});

test('real audit format uses section severity and preserves verified through stamp and append', (t) => {
  const realHeader = '# 项目审计报告 · 问题汇总\n\n> scope: demo · date: 2026-11-11 · stack: Node · 🔴 P0×1 🟠 P1×1 🟡 P2×0 🔵 P3×0\n';
  const sec = '### [SEC-2] / [ARCH-1] 鉴权缺失\n- **sub-area**: 认证授权\n- **location**: `router.mjs:42`\n- **evidence**: admin 仅挂 logger。\n- **impact**: 任意用户可写。\n> verified: 路由与中间件调用链已复核  ';
  const perf = '### [PERF-1] 查询重复\n- **sub-area**: 数据访问\n- **location**: `orders.mjs:12`\n- **evidence**: 循环中逐条查询。\n- **impact**: 查询次数随订单数增长。\n> verified: 复核循环与 SQL 日志。';
  const text = `${realHeader}\n## 🔴 P0\n${sec}\n\n## 🟠 P1\n${perf}\n`;
  const f = fixture(t, text);
  const perfPart = stamped(f, 'perf', suggested(perf));
  ok(f.merge(perfPart));
  const existingBlock = `${perf}${suggestion}\n- **status**: 用户后加状态`;
  writeFileSync(f.output, readFileSync(f.output, 'utf8').replace(`${perf}${suggestion}`, existingBlock));
  const secPart = stamped(f, 'security', suggested(sec));
  ok(f.merge(secPart, perfPart));
  const output = readFileSync(f.output, 'utf8');
  assert.ok(output.startsWith(realHeader));
  assert.ok(output.includes(`${sec}${suggestion}`));
  assert.ok(output.includes(existingBlock));
  assert.ok(output.indexOf(sec) < output.indexOf(perf));
  assert.ok(!output.includes('- **severity**:'));
  assert.equal(readFileSync(f.report, 'utf8'), text);
});
