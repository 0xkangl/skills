export const meta = {
  name: 'codebase-audit',
  description: 'Fan out dimension auditors, adversarially verify each, synthesize one report',
  phases: [
    { title: 'Audit', detail: 'one auditor per active dimension, in parallel' },
    { title: 'Verify', detail: 'one fresh verifier refutes each dimension\'s findings' },
    { title: 'Synthesize', detail: 'cluster survivors, order by severity, bucket into p0..p3' },
    { title: 'Fix', detail: 'one fix-solution agent per non-empty severity bucket, in parallel' },
    { title: 'Assemble', detail: 'stitch buckets P0→P3 into the final report + quick-fix list' },
  ],
}

// 维度元数据：key 同时作为产物文件名（docs/audit/<TS>/<key>.md），与 SKILL.md 表格一致
const DIMS = {
  arch:     { name: 'Architecture',                    prefix: 'ARCH', instruction: 'audit-architecture.md' },
  code:     { name: 'Code quality',                    prefix: 'CODE', instruction: 'audit-code-quality.md' },
  security: { name: 'Security',                        prefix: 'SEC',  instruction: 'audit-security.md' },
  testing:  { name: 'Testing',                         prefix: 'TEST', instruction: 'audit-testing.md' },
  deps:     { name: 'Dependencies & debt',             prefix: 'DEP',  instruction: 'audit-dependencies.md' },
  obs:      { name: 'Maintainability & observability', prefix: 'OBS',  instruction: 'audit-observability.md' },
  conv:     { name: 'Conventions compliance',          prefix: 'CONV', instruction: 'audit-conventions.md' },
}

// args 由主 agent 在 Scope 阶段算好后传入（脚本内不能取时钟，也无文件系统——scope 以文件路径传入，由 agent 自读）
// 守卫：args 被当成 JSON 字符串传入时解构出来全是 undefined，这里直接点破，而非在后面以「空输出」告终
if (typeof args !== 'object' || args === null) {
  throw new Error(`args 不是对象（typeof=${typeof args}）——大概率被当成 JSON 字符串传入，应传真正的 JSON 值`)
}
const { ts, scopeFile, language, agentsDir, meta: runMeta, dimensions } = args
const missing = ['ts', 'scopeFile', 'agentsDir'].filter((k) => args[k] == null)
if (missing.length) throw new Error(`args 缺字段：${missing.join(', ')}；收到的 keys：${Object.keys(args).join(', ') || '（空）'}`)
const outDir = `docs/audit/${ts}`
const fixDir = `${outDir}/fix`
const summaryPath = `${outDir}/_summary.md`
const reportPath = `docs/audit/report-${ts}.md`

const active = (dimensions || []).map((key) => ({ key, ...DIMS[key] })).filter((d) => d.name)
if (!active.length) throw new Error('no active dimensions passed in args.dimensions')

// 未知/拼错的维度 key 静默丢弃会让"请求的维度集"与"实际跑的"不一致——显式报出来
const dropped = (dimensions || []).filter((key) => !DIMS[key])
if (dropped.length) log(`忽略未知维度 key：${dropped.join(', ')}`)

const auditPrompt = (d) => `Read the scope brief at ${scopeFile} first for context.
Read ${agentsDir}/${d.instruction} and follow it. Pull the source you need yourself.
Write your findings to: ${outDir}/${d.key}.md
Reply with one line only: "${d.prefix}: P0=a P1=b P2=c P3=d".`

const verifyPrompt = (d) => `Read ${agentsDir}/verify.md and follow it.
Findings file (rewrite in place): ${outDir}/${d.key}.md
Dimension: ${d.name} (prefix ${d.prefix}).
Reply with one line only: "${d.prefix}: kept=x dropped=y".`

const synthPrompt = (dims) => `Read ${agentsDir}/synthesize.md and follow it (Mode B — severity buckets).
Verified findings files (active dimensions only):
${dims.map((d) => `- ${outDir}/${d.key}.md`).join('\n')}
Write severity-bucket files (only non-empty buckets) to: ${fixDir}/p0.md … ${fixDir}/p3.md
Write the report head to: ${summaryPath}
Meta — ${runMeta}, report language: ${language}.
Reply with one line only: "synthesize: buckets=<non-empty, comma-sep> P0×a P1×b P2×c P3×d".`

const fixPrompt = (bucket) => `Read ${agentsDir}/fix-solution.md and follow it.
Findings file (one severity bucket — rewrite in place, add a fix to each finding): ${fixDir}/${bucket}.md
Report language: ${language}.
Reply with one line only: "fix: ${bucket} n=x quick=y".`

const assemblePrompt = (buckets) => `Read ${agentsDir}/assemble.md and follow it.
Report head: ${summaryPath}
Bucket files (already fix-enriched; stitch in P0→P3 order, only those present):
${buckets.map((b) => `- ${fixDir}/${b}.md`).join('\n')}
Final report: ${reportPath}
Report language: ${language}.
Reply with one line only: "assemble: P0×a P1×b P2×c P3×d quick×q report=<path>".`

// Audit → Verify 流水线：每个维度的 audit 写文件、verify 原地重写，二者必为不同 agent（核心不变量）
phase('Audit')
const results = await pipeline(
  active,
  async (d) => {
    // agent() 失败时返回 null（非抛错），需显式抛错才能让 pipeline 把该 item 落为 null、跳过后续 verify
    const auditLine = await agent(auditPrompt(d), { label: `audit:${d.key}`, phase: 'Audit', agentType: 'general-purpose' })
    if (!auditLine) throw new Error(`auditor produced nothing: ${d.key}`)
    return { dim: d, auditLine }
  },
  async (prev) => ({ ...prev, verifyLine: await agent(verifyPrompt(prev.dim), { label: `verify:${prev.dim.key}`, phase: 'Verify', agentType: 'general-purpose' }) }),
)

// await pipeline 返回即所有 audit+verify 已完成，故 synthesize 在其后；失败的维度已落为 null，filter 跳过
const survivors = results.filter(Boolean).map((r) => r.dim)
if (!survivors.length) throw new Error('all dimension auditors failed; nothing to synthesize')

phase('Synthesize')
const synthLine = await agent(synthPrompt(survivors), { label: 'synthesize', phase: 'Synthesize', agentType: 'general-purpose' })

// 从 synthesize 回执解析非空桶（如 "buckets=p0,p1,p2"）。大小写敏感地只抓小写 p0..p3，避开 totals 里的大写 P0。
// 关键：区分"真的零桶"（buckets= 存在但为空，即全维度无 findings）与"回执没解析到"（连 buckets= 都没匹配）——
// 前者应跳过 Fix（无桶可修），后者才回退全四桶兜底。混为一谈会在零 findings 时白跑 4 个 fix agent 读不存在的桶文件。
const ALL_BUCKETS = ['p0', 'p1', 'p2', 'p3']
const matched = /buckets=([^\n]*)/.exec(synthLine || '')
const activeBuckets = (matched
  ? [...new Set(matched[1].match(/\bp[0-3]\b/g) || [])].filter((b) => ALL_BUCKETS.includes(b))
  : ALL_BUCKETS // 解析失败才回退全桶
).sort((a, b) => ALL_BUCKETS.indexOf(a) - ALL_BUCKETS.indexOf(b))

// Fix：每个非空桶一个 fix-solution agent，原地补 fix/quick-fix（整簇按最高 severity 已归桶，同根因不跨 agent）。
// 零桶（全维度无 findings）时无桶可修，跳过；assemble 仍要跑，从 _summary.md 头部产出仅含结论的报告。
phase('Fix')
const fixLines = activeBuckets.length
  ? await parallel(activeBuckets.map((b) => () =>
      agent(fixPrompt(b), { label: `fix:${b}`, phase: 'Fix', agentType: 'general-purpose' })))
  : []

// Assemble：1 个 agent 按 P0→P3 拼最终报告 + 批量清单（桶为空时只拼报告头）
phase('Assemble')
const assembleLine = await agent(assemblePrompt(activeBuckets), { label: 'assemble', phase: 'Assemble', agentType: 'general-purpose' })

return {
  reportPath,
  dimensions: results.filter(Boolean).map((r) => ({ key: r.dim.key, audit: r.auditLine, verify: r.verifyLine })),
  synthesize: synthLine,
  fix: fixLines.filter(Boolean),
  assemble: assembleLine,
}
