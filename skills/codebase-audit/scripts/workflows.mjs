export const meta = {
  name: 'codebase-audit',
  description: 'Fan out dimension + endpoint-group + flow auditors, adversarially verify each, synthesize report + issues summary',
  phases: [
    { title: 'Audit', detail: 'one auditor per active dimension / endpoint group / business flow, in parallel' },
    { title: 'Verify', detail: 'one fresh verifier refutes each auditor\'s findings' },
    { title: 'Synthesize', detail: 'two synthesizers in parallel: audit report + consolidated issues summary' },
  ],
}

// 维度元数据：key 同时作为产物文件名（docs/audit/<TS>/<key>.md），与 SKILL.md 表格一致
const DIMS = {
  arch:     { name: 'Architecture',                    prefix: 'ARCH',  instruction: 'audit-architecture.md' },
  perf:     { name: 'Performance & scalability',       prefix: 'PERF',  instruction: 'audit-performance.md' },
  code:     { name: 'Code quality',                    prefix: 'CODE',  instruction: 'audit-code-quality.md' },
  security: { name: 'Security',                        prefix: 'SEC',   instruction: 'audit-security.md' },
  testing:  { name: 'Testing',                         prefix: 'TEST',  instruction: 'audit-testing.md' },
  deps:     { name: 'Dependencies & debt',             prefix: 'DEP',   instruction: 'audit-dependencies.md' },
  obs:      { name: 'Maintainability & observability', prefix: 'OBS',   instruction: 'audit-observability.md' },
  infra:    { name: 'Build / deploy / infra',          prefix: 'INFRA', instruction: 'audit-infra.md' },
  fe:       { name: 'Frontend a11y / i18n',            prefix: 'FE',    instruction: 'audit-frontend.md' },
  conv:     { name: 'Conventions compliance',          prefix: 'CONV',  instruction: 'audit-conventions.md' },
}

// args 由主 agent 在 Scope 阶段算好后传入（脚本内不能取时钟，也无文件系统——scope 以文件路径传入，由 agent 自读）
// 兜底：本入口由 LLM 反复调用，易把 JSON 字面量误传成字符串（skill 已专门警告）。
// 这里做一次幂等的 string→object 反解，既兼容正确的对象传参，也容错被序列化成字符串的情形。
let input = args
if (typeof input === 'string') {
  try {
    input = JSON.parse(input)
  } catch (e) {
    throw new Error(`args 是字符串且无法 JSON.parse（${e.message}）——应传真正的 JSON 对象；前 120 字符：${input.slice(0, 120)}`)
  }
}
if (typeof input !== 'object' || input === null) {
  throw new Error(`args 不是对象（typeof=${typeof input}）——应传真正的 JSON 对象`)
}
const { ts, scopeFile, language, agentsDir, meta: runMeta, dimensions, groups, flows, maxConcurrency } = input
const missing = ['ts', 'scopeFile', 'agentsDir', 'meta', 'language'].filter((k) => input[k] == null)
if (missing.length) throw new Error(`args 缺字段：${missing.join(', ')}；收到的 keys：${Object.keys(input).join(', ') || '（空）'}`)
const outDir = `docs/audit/${ts}`
const reportPath = `docs/audit/report-${ts}.md`
const issuesReportPath = `docs/audit/issues-report-${ts}.md`

// 常规维度 items。dimensions 允许为空数组——「只审接口/流程」的合法收窄态，最终只校验总 items 非空
const dimItems = (dimensions || []).filter((key) => DIMS[key]).map((key) => ({
  kind: 'dim', key, name: DIMS[key].name, prefix: DIMS[key].prefix,
  instruction: DIMS[key].instruction, file: `${outDir}/${key}.md`,
}))
// 未知/拼错的维度 key 静默丢弃会让「请求的维度集」与「实际跑的」不一致——显式报出来
const droppedKeys = (dimensions || []).filter((key) => !DIMS[key])
if (droppedKeys.length) log(`忽略未知维度 key：${droppedKeys.join(', ')}`)

// key 来自主 agent 的 Scope，可能含 '/' 或 '..'；消毒成单段文件名防越界；同族消毒后撞名加序号，避免产物互相覆盖
const safeKey = (k) => String(k ?? '').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'item'
const usedKeys = new Set()
const uniqueKey = (raw, family) => {
  const base = safeKey(raw)
  let key = base
  let i = 2
  while (usedKeys.has(`${family}:${key}`)) key = `${base}-${i++}`
  usedKeys.add(`${family}:${key}`)
  return key
}
// groups 非空即激活 api 维度（仅 HTTP 项目会传）；flows 非空即激活 flow 维度（不限 HTTP）
const groupItems = (groups || []).map((g) => {
  const key = uniqueKey(g.key, 'api')
  return { kind: 'api', key, name: g.name, prefix: 'API', instruction: 'audit-endpoint.md', file: `${outDir}/api-${key}.md` }
})
const flowItems = (flows || []).map((f) => {
  const key = uniqueKey(f.key, 'flow')
  return { kind: 'flow', key, name: f.name, prefix: 'FLOW', instruction: 'audit-flow.md', file: `${outDir}/flow-${key}.md` }
})

const items = [...dimItems, ...groupItems, ...flowItems]
if (!items.length) throw new Error('no items：args.dimensions / args.groups / args.flows 全为空')

// —— 超限熔断（circuit breaker）——
// agent() 因终端 API 错误死掉时只返回 null，脚本拿不到错误码；而 429/限流/配额超限
//（第三方中转 provider 尤其常见）是系统性故障，会让并发中的所有子 agent 接连失败。
// 单个 null 可能只是用户手动 skip；连续 ≥TRIP_AFTER 个 null 即判定系统性超限——立即熔断：
// 不再派发任何新子 agent（已在飞的无法取消，等其自然结束），抛错保留现场，
// 等配额重置后用 Workflow({scriptPath, resumeFromRunId}) 续跑。
const TRIP_AFTER = 2
let consecutiveFails = 0
let tripped = false

// 脚本层并发闸：harness 对超额 agent() 调用的排队发生在 agent() 内部，已进内部队列的
// 调用熔断拦不住；让排队发生在这里，tripped 才能拦下所有尚未派发的调用。
// 上限由 args.maxConcurrency 控制（默认 5，clamp 到 [1, 16]——16 为 harness 硬上限）；
// 越低，超限熔断时已在飞、无法取消的调用越少，适合第三方限流严格的场景。
const rawMax = Number(maxConcurrency)
const MAX_INFLIGHT = Number.isFinite(rawMax) && rawMax >= 1 ? Math.min(16, Math.floor(rawMax)) : 5
let inflight = 0
const waiters = []
const acquire = () => {
  if (inflight < MAX_INFLIGHT) { inflight++; return Promise.resolve() }
  return new Promise((resolve) => waiters.push(resolve))
}
const release = () => {
  const next = waiters.shift()
  if (next) next() // 槽位直接转交给下一个等待者，inflight 不变
  else inflight--
}

const guardedAgent = async (prompt, opts) => {
  await acquire()
  try {
    if (tripped) throw new Error(`已熔断，未派发：${opts.label}`)
    const line = await agent(prompt, opts)
    if (line == null) {
      consecutiveFails++
      if (!tripped && consecutiveFails >= TRIP_AFTER) {
        tripped = true
        log(`⛔ 连续 ${consecutiveFails} 个子 agent 终端失败——疑似 LLM 配额/限流超限，已暂停派发剩余子任务`)
      }
    } else {
      consecutiveFails = 0
    }
    return line
  } finally {
    release()
  }
}

const auditPrompt = (it) => it.kind === 'dim'
  ? `Read the scope brief at ${scopeFile} first for context.
Read ${agentsDir}/${it.instruction} and follow it. Pull the source you need yourself.
Write your findings to: ${it.file}
Reply with one line only: "${it.prefix}: P0=a P1=b P2=c P3=d".`
  : `Read the scope brief at ${scopeFile} first — its endpoint inventory / flow list is your map.
You audit the ${it.kind === 'api' ? 'endpoint group' : 'business flow'} "${it.name}" (key: ${it.key}).
Read ${agentsDir}/${it.instruction} and follow it. Pull the source yourself.
Write your file to: ${it.file}
Reply with one line only: "${it.prefix}[${it.key}]: ${it.kind === 'api' ? 'endpoints' : 'steps'}=n P0=a P1=b P2=c P3=d".`

const verifyPrompt = (it) => it.kind === 'dim'
  ? `Read ${agentsDir}/verify.md and follow it.
Findings file (rewrite in place): ${it.file}
Dimension: ${it.name} (prefix ${it.prefix}).
Reply with one line only: "${it.prefix}: kept=x dropped=y".`
  : `Read ${agentsDir}/verify.md and follow it.
File (rewrite in place — refute findings; leave the 接口清单/流程图 description layer intact): ${it.file}
Reply with one line only: "${it.prefix}[${it.key}]: kept=x dropped=y".`

// Audit → Verify 流水线：每个 item 的 audit 写文件、verify 原地重写，二者必为不同 agent（核心不变量）
phase('Audit')
const results = await pipeline(
  items,
  async (it) => {
    // agent() 失败时返回 null（非抛错），需显式抛错才能让 pipeline 把该 item 落为 null、跳过后续 verify
    const auditLine = await guardedAgent(auditPrompt(it), { label: `audit:${it.key}`, phase: 'Audit', agentType: 'general-purpose' })
    if (!auditLine) throw new Error(`auditor produced nothing: ${it.key}`)
    return { it, auditLine }
  },
  async (prev) => {
    const verifyLine = await guardedAgent(verifyPrompt(prev.it), { label: `verify:${prev.it.key}`, phase: 'Verify', agentType: 'general-purpose' })
    // 与 audit 阶段一致：verify 失败必须显式抛错、让该 item 落为 null 并跳过合成。
    // 否则未验证的 auditor 文件会带着原始 findings 进入合成阶段，静默破坏 find/verify 分离这一核心不变量。
    if (!verifyLine) throw new Error(`verifier produced nothing: ${prev.it.key}`)
    return { ...prev, verifyLine }
  },
)

// await pipeline 返回即所有 audit+verify 已完成；失败的 item 已落为 null，filter 跳过
const survivors = results.filter(Boolean)

// 熔断触发时不进合成——半程结果出报告会误导；抛错让主 agent 保留现场、告知用户等配额重置
if (tripped) {
  throw new Error(
    `疑似 LLM 配额/限流超限（连续子 agent 终端失败），已暂停全部剩余子任务：` +
    `audit+verify 完成 ${survivors.length}/${items.length}。` +
    `docs/audit/${ts}/ 现场已保留；等配额重置后用 Workflow({scriptPath, resumeFromRunId}) 续跑（已完成调用命中缓存）。`
  )
}
if (!survivors.length) throw new Error('all auditors failed; nothing to synthesize')

// 幸存文件的显式列表（不含 scope.md）——合成器只读这些、不 glob，避免把 scope.md 误读为 findings
const fileList = survivors.map((r) => `- ${r.it.file}`).join('\n')

const synthReportPrompt = `Read ${agentsDir}/synthesize-report.md and follow it.
Verified auditor files (read exactly these — do not glob):
${fileList}
Final report: ${reportPath}
Meta — ${runMeta}, report language: ${language}.
Reply with one line only: "report: dims=<n> endpoints=<n|-> flows=<n|-> → ${reportPath}".`

const synthIssuesPrompt = `Read ${agentsDir}/synthesize-issues.md and follow it.
Verified auditor files (read exactly these — do not glob):
${fileList}
Final report: ${issuesReportPath}
Meta — ${runMeta}, report language: ${language}.
Reply with one line only: "issues-report: P0=a P1=b P2=c P3=d → ${issuesReportPath}".`

// 两个合成器并行：report（结论+描述层）与 issues（按严重度问题清单的唯一所在）
phase('Synthesize')
const [reportLine, issuesLine] = await parallel([
  () => guardedAgent(synthReportPrompt, { label: 'synthesize:report', phase: 'Synthesize', agentType: 'general-purpose' }),
  () => guardedAgent(synthIssuesPrompt, { label: 'synthesize:issues', phase: 'Synthesize', agentType: 'general-purpose' }),
])

// 合成器失败时对应路径置 null——Deliver 据此保留 docs/audit/<TS>/ 现场、不清理
return {
  reportPath: reportLine ? reportPath : null,
  issuesReportPath: issuesLine ? issuesReportPath : null,
  items: survivors.map((r) => ({ kind: r.it.kind, key: r.it.key, audit: r.auditLine, verify: r.verifyLine })),
  synthesize: { report: reportLine, issues: issuesLine },
}
