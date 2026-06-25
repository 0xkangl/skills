export const meta = {
  name: 'codebase-audit',
  description: 'Fan out dimension auditors, adversarially verify each, synthesize one report',
  phases: [
    { title: 'Audit', detail: 'one auditor per active dimension, in parallel' },
    { title: 'Verify', detail: 'one fresh verifier refutes each dimension\'s findings' },
    { title: 'Synthesize', detail: 'cluster survivors, order by severity, write report' },
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

// args 由主 agent 在 Scope 阶段算好后传入（脚本内不能取时钟）
const { ts, scope, language, agentsDir, meta: runMeta, dimensions } = args
const outDir = `docs/audit/${ts}`
const reportPath = `docs/audit/report-${ts}.md`

const active = (dimensions || []).map((key) => ({ key, ...DIMS[key] })).filter((d) => d.name)
if (!active.length) throw new Error('no active dimensions passed in args.dimensions')

// 未知/拼错的维度 key 静默丢弃会让"请求的维度集"与"实际跑的"不一致——显式报出来
const dropped = (dimensions || []).filter((key) => !DIMS[key])
if (dropped.length) log(`忽略未知维度 key：${dropped.join(', ')}`)

const auditPrompt = (d) => `<scope>
${scope}
</scope>
Read ${agentsDir}/${d.instruction} and follow it. Pull the source you need yourself.
Write your findings to: ${outDir}/${d.key}.md
Reply with one line only: "${d.prefix}: P0=a P1=b P2=c P3=d".`

const verifyPrompt = (d) => `Read ${agentsDir}/verify.md and follow it.
Findings file (rewrite in place): ${outDir}/${d.key}.md
Dimension: ${d.name} (prefix ${d.prefix}).
Reply with one line only: "${d.prefix}: kept=x dropped=y".`

const synthPrompt = (dims) => `Read ${agentsDir}/synthesize.md and follow it.
Verified findings files (active dimensions only):
${dims.map((d) => `- ${outDir}/${d.key}.md`).join('\n')}
Final report: ${reportPath}
Meta — ${runMeta}, report language: ${language}.`

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

return {
  reportPath,
  dimensions: results.filter(Boolean).map((r) => ({ key: r.dim.key, audit: r.auditLine, verify: r.verifyLine })),
  synthesize: synthLine,
}
