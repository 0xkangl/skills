#!/usr/bin/env node
import { createHash, randomUUID } from 'node:crypto';
import {
  closeSync, openSync, readFileSync, realpathSync, renameSync,
  statSync, unlinkSync, writeFileSync,
} from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const usage = `用法:
  node merge-remediation.mjs --report <path> --output <path> [--fragment <path> ...] [--check]
  node merge-remediation.mjs --report <path> --stamp <fragment>
  node merge-remediation.mjs --help

--fragment 可重复，只消费显式列出的片段。--check 只校验，不写文件。
--stamp 校验片段后写入 source-sha256 摘要，与 merge 参数互斥。
`;

// 只规范块间空行；内容行末的空格、缩进和 CRLF 均保留。
function trimSeparator(text) {
  return text.replace(/(?:\r?\n[\t ]*)+$/u, '');
}

// 按偏移读取行，以免 split/join 改写原文；不解析其它 Markdown 语法。
function* lines(text) {
  let fence;
  for (const match of text.matchAll(/[^\n]*(?:\n|$)/gu)) {
    if (!match[0]) break;
    const value = match[0].replace(/\r?\n$/u, '');
    let outside = !fence;
    const marker = value.match(/^ {0,3}(`{3,}|~{3,})(.*)$/u);
    if (fence) {
      if (marker && marker[1][0] === fence[0] && marker[1].length >= fence.length && !marker[2].trim()) {
        fence = undefined;
      }
    } else if (marker && !(marker[1][0] === '`' && marker[2].includes('`'))) {
      fence = marker[1];
      outside = false;
    }
    yield { value, outside, start: match.index, end: match.index + match[0].length };
  }
}

function parseDocument(text, label) {
  const events = [];
  for (const line of lines(text)) {
    if (!line.outside) continue;
    const severity = line.value.match(/^##[\t ]+(?:[🔴🟠🟡🔵][\t ]+)?(P[0-3])(?=[\t ]|$)/u);
    const finding = line.value.match(/^###[\t ]+(\[[^\]\r\n]+\](?:[\t ]*\/[\t ]*\[[^\]\r\n]+\])*)(?=[\t ]|$)/u);
    if (severity) events.push({ ...line, severity: severity[1] });
    else if (finding) events.push({ ...line, ids: [...finding[1].matchAll(/\[([^\]]+)\]/gu)].map((id) => id[1]) });
  }
  const findings = [];
  const byId = new Map();
  let section;
  for (let index = 0; index < events.length; index++) {
    const event = events[index];
    const raw = trimSeparator(text.slice(event.start, events[index + 1]?.start ?? text.length));
    if (event.severity) {
      section = { key: event.severity, raw };
      continue;
    }
    const block = { ids: event.ids, raw, section };
    for (const id of block.ids) {
      if (byId.has(id)) throw new Error(`${label}: 重复 alias / duplicate ID [${id}]`);
      byId.set(id, block);
    }
    findings.push(block);
  }
  return { header: text.slice(0, events[0]?.start ?? text.length), findings, byId };
}

function validateBlocks(document, report, label, existing = false) {
  for (const block of document.findings) {
    const ids = block.ids.map((id) => `[${id}]`).join(' / ');
    for (const id of block.ids) {
      if (!report.byId.has(id)) throw new Error(`${label}: 未知 ID [${id}]`);
    }
    const source = report.byId.get(block.ids[0]);
    if (source.ids.length !== block.ids.length || block.ids.some((id, index) => id !== source.ids[index])) {
      throw new Error(`${label}: ${ids} alias 必须完整保留 source 标题`);
    }
    if (block.section && block.section.key !== source.section.key) {
      throw new Error(`${label}: ${ids} source 严重度节不匹配`);
    }
    if (!block.raw.startsWith(source.raw)) throw new Error(`${label}: ${ids} source 原文被修改或已变化`);
    const appended = block.raw.slice(source.raw.length);
    if (appended && !/^\r?\n/u.test(appended)) throw new Error(`${label}: ${ids} source 原文末行被修改`);
    const fields = [];
    let firstContent;
    for (const line of lines(appended)) {
      if (line.value.trim() && !firstContent) firstContent = line.value;
      if (!line.outside) continue;
      const field = line.value.match(/^-[\t ]+\*\*([^*]+)\*\*:[\t ]*(.*)$/u);
      if (field) fields.push({ name: field[1], start: line.start, valueStart: line.start + line.value.length - field[2].length });
    }
    if (!existing && firstContent && !/^-[\t ]+\*\*suggest\*\*:/u.test(firstContent)) {
      throw new Error(`${label}: ${ids} 块末只能追加 suggest 与可选 solution 字段`);
    }
    const values = new Map();
    for (let index = 0; index < fields.length; index++) {
      const field = fields[index];
      if (!existing && !['suggest', 'solution'].includes(field.name)) {
        throw new Error(`${label}: ${ids} 片段不允许新增字段 ${field.name}`);
      }
      if (['suggest', 'solution'].includes(field.name) && values.has(field.name)) {
        throw new Error(`${label}: ${ids} 重复字段 ${field.name}`);
      }
      const value = trimSeparator(appended.slice(field.valueStart, fields[index + 1]?.start ?? appended.length)).trim();
      values.set(field.name, value);
    }
    if (!values.get('suggest')) throw new Error(`${label}: ${ids} 缺失或空 suggest`);
    block.suggest = values.get('suggest');
    block.solution = values.get('solution');
  }
}

function sourceDigest(document, report) {
  const sources = report.findings.filter((block) => document.byId.has(block.ids[0]));
  const payload = sources.map((block) => [block.ids, block.section.key, block.raw]);
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

function sourceStamp(document, label) {
  const stamps = [...lines(document.header)].filter((line) => line.outside && line.value.includes('<!-- source-sha256:'));
  const ids = document.findings.flatMap((block) => block.ids).map((id) => `[${id}]`).join(' / ') || '(0 finding)';
  if (stamps.length > 1) throw new Error(`${label}: ${ids} 重复 source-sha256 stamp`);
  if (!stamps.length) return undefined;
  const match = stamps[0].value.match(/^<!-- source-sha256: ([a-f0-9]{64}) -->[\t ]*$/u);
  if (!match) throw new Error(`${label}: ${ids} 无效 source-sha256 stamp`);
  return { hash: match[1], ...stamps[0] };
}

function fileIdentity(path, optional = false) {
  const absolute = resolve(path);
  try {
    const real = realpathSync(absolute);
    return { path: real, stat: statSync(real) };
  } catch (error) {
    if (!optional || error.code !== 'ENOENT') throw error;
    return { path: join(realpathSync(dirname(absolute)), basename(absolute)) };
  }
}

function protectInputs(target, inputs) {
  for (const input of inputs) {
    if (target.path === input.path || (target.stat && input.stat && target.stat.dev === input.stat.dev && target.stat.ino === input.stat.ino)) {
      throw new Error(`输出路径不能覆盖输入或其 alias: ${target.path} (input: ${input.path})`);
    }
  }
}

function atomicWrite(target, text) {
  const temp = join(dirname(target.path), `.${basename(target.path)}.${randomUUID()}.tmp`);
  let fd;
  let created = false;
  try {
    fd = openSync(temp, 'wx', target.stat ? target.stat.mode & 0o777 : 0o666);
    created = true;
    writeFileSync(fd, text, 'utf8');
    closeSync(fd);
    fd = undefined;
    renameSync(temp, target.path);
  } finally {
    if (fd !== undefined) closeSync(fd);
    if (created) {
      try {
        unlinkSync(temp);
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
    }
  }
}

function parseArgs(argv) {
  const options = { fragments: [], check: false };
  if (argv.length === 1 && argv[0] === '--help') return { help: true };
  for (let index = 0; index < argv.length; index++) {
    const flag = argv[index];
    if (flag === '--check') {
      if (options.check) throw new Error('重复参数 --check');
      options.check = true;
    } else if (['--report', '--output', '--fragment', '--stamp'].includes(flag)) {
      const value = argv[++index];
      if (!value || value.startsWith('--')) throw new Error(`${flag} 缺少路径`);
      const key = flag.slice(2);
      if (key === 'fragment') options.fragments.push(value);
      else {
        if (options[key]) throw new Error(`重复参数 ${flag}`);
        options[key] = value;
      }
    } else throw new Error(`未知参数 ${flag}; 使用 --help 查看用法`);
  }
  if (!options.report) throw new Error('必须提供 --report; 使用 --help 查看用法');
  if (options.stamp && (options.output || options.fragments.length || options.check)) {
    throw new Error('--stamp 与 merge 参数 --output / --fragment / --check 互斥');
  }
  if (!options.stamp && !options.output) throw new Error('合并必须提供 --output');
  return options;
}

function render(report, blocks) {
  const parts = [trimSeparator(report.header), '> remediate-suggest 产物 · 只分析不修复'];
  let previousSection;
  for (const source of report.findings) {
    const block = blocks.get(source.ids[0]);
    if (!block) continue;
    if (source.section !== previousSection) {
      parts.push(source.section.raw);
      previousSection = source.section;
    }
    parts.push(block.raw);
  }
  if (!blocks.size) parts.push('暂无已分析 finding（0 条）。');
  return `${parts.filter(Boolean).join('\n\n')}\n\n`;
}

/**
 * 校验并合并显式片段，或为片段盖章；返回 CLI 摘要，出错抛出异常。
 * @param {string[]} argv
 * @returns {string}
 */
export function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.help) return usage;
  const reportFile = fileIdentity(options.report);
  const report = parseDocument(readFileSync(reportFile.path, 'utf8'), options.report);
  for (const block of report.findings) {
    if (!block.section) throw new Error(`${options.report}: [${block.ids[0]}] 缺少 ## P0..P3 严重度节`);
  }
  if (options.stamp) {
    const fragmentFile = fileIdentity(options.stamp);
    protectInputs(fragmentFile, [reportFile]);
    const text = readFileSync(fragmentFile.path, 'utf8');
    const fragment = parseDocument(text, options.stamp);
    validateBlocks(fragment, report, options.stamp);
    if (!fragment.findings.length) throw new Error(`${options.stamp}: 没有 finding 可 stamp`);
    const stamp = sourceStamp(fragment, options.stamp);
    const hash = sourceDigest(fragment, report);
    if (stamp?.hash === hash) return `stamp 未变: ${fragment.findings.length} finding`;
    const content = stamp ? text.slice(0, stamp.start) + text.slice(stamp.end) : text;
    atomicWrite(fragmentFile, `<!-- source-sha256: ${hash} -->\n${content}`);
    return `stamp: ${fragment.findings.length} finding → ${options.stamp}`;
  }

  const outputFile = fileIdentity(options.output, true);
  const fragmentFiles = options.fragments.map((path) => fileIdentity(path));
  protectInputs(outputFile, [reportFile, ...fragmentFiles]);
  const existingText = outputFile.stat ? readFileSync(outputFile.path, 'utf8') : undefined;
  const existing = parseDocument(existingText ?? '', options.output);
  validateBlocks(existing, report, options.output, true);
  const blocks = new Map(existing.findings.map((block) => [block.ids[0], block]));
  const seen = new Set();
  let added = 0;
  for (let index = 0; index < fragmentFiles.length; index++) {
    const label = options.fragments[index];
    const fragment = parseDocument(readFileSync(fragmentFiles[index].path, 'utf8'), label);
    validateBlocks(fragment, report, label);
    const ids = fragment.findings.flatMap((block) => block.ids).map((id) => `[${id}]`).join(' / ') || '(0 finding)';
    const stamp = sourceStamp(fragment, label);
    if (!stamp || stamp.hash !== sourceDigest(fragment, report)) {
      throw new Error(`${label}: ${ids} 缺失或过期 source-sha256 stamp`);
    }
    if (!fragment.findings.length) throw new Error(`${label}: 没有 finding`);
    for (const block of fragment.findings) {
      const id = block.ids[0];
      if (seen.has(id)) throw new Error(`${label}: 重复 fragment ID [${id}]`);
      seen.add(id);
      const previous = blocks.get(id);
      if (previous) {
        if (previous.suggest !== block.suggest || (block.solution && block.solution !== previous.solution)) {
          throw new Error(`${label}: [${id}] 与已有 remediation 方案冲突 (conflict)`);
        }
      } else {
        blocks.set(id, block);
        added++;
      }
    }
  }
  if (!options.check && (existingText === undefined || added > 0)) atomicWrite(outputFile, render(report, blocks));
  return `${options.check ? 'check 通过' : '合并完成'}: 新增 ${added}，累计 ${blocks.size} / ${report.findings.length} finding${existingText !== undefined && !added ? '（原文件未变）' : ''}`;
}

// Node 会将 import.meta.url 解析为真实路径；argv[1] 仍可能是插件的符号链接别名。
function invokedDirectly() {
  if (!process.argv[1]) return false;
  try {
    return realpathSync(resolve(process.argv[1])) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (invokedDirectly()) {
  try {
    process.stdout.write(`${main()}\n`);
  } catch (error) {
    process.stderr.write(`merge-remediation: ${error.message}\n`);
    process.exitCode = 1;
  }
}
