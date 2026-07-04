export const meta = {
  name: 'api-audit',
  description: 'Fan out endpoint + flow auditors, adversarially verify each, synthesize three documents',
  phases: [
    { title: 'Audit', detail: 'one auditor per endpoint group + per business flow, in parallel' },
    { title: 'Verify', detail: 'one fresh verifier refutes each auditor\'s findings' },
    { title: 'Synthesize', detail: 'three synthesizers: interface report + business/flow report + consolidated issues summary' },
  ],
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
const { ts, scopeFile, language, agentsDir, meta: runMeta, groups, flows } = input
const missing = ['ts', 'scopeFile', 'agentsDir', 'meta', 'language'].filter((k) => input[k] == null)
if (missing.length) throw new Error(`args 缺字段：${missing.join(', ')}；收到的 keys：${Object.keys(input).join(', ') || '（空）'}`)
const outDir = `docs/api-audit/${ts}`
const apiReport = `docs/api-audit/api-report-${ts}.md`
const flowReport = `docs/api-audit/flow-report-${ts}.md`
const issuesReport = `docs/api-audit/issues-report-${ts}.md`

// key 来自主 agent 的 Scope，可能含 '/' 或 '..'；消毒成单段文件名，避免 outPath 越界写到 docs/api-audit/<TS>/ 之外
const safeKey = (k) => String(k ?? '').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'item'
const groupItems = (groups || []).map((g) => ({
  kind: 'api', key: safeKey(g.key), name: g.name, prefix: 'API',
  instruction: 'audit-endpoint.md', subdir: 'api',
}))
const flowItems = (flows || []).map((f) => ({
  kind: 'flow', key: safeKey(f.key), name: f.name, prefix: 'FLOW',
  instruction: 'audit-flow.md', subdir: 'flow',
}))
const items = [...groupItems, ...flowItems]
if (!items.length) throw new Error('no endpoint groups or flows passed in args.groups / args.flows')

const outPath = (it) => `${outDir}/${it.subdir}/${it.key}.md`

const auditPrompt = (it) => `Read the scope brief at ${scopeFile} first — its endpoint inventory is your map.
You audit the ${it.kind === 'api' ? 'endpoint group' : 'business flow'} "${it.name}".
Read ${agentsDir}/${it.instruction} and follow it. Pull the handler source yourself.
Write your file to: ${outPath(it)}
Reply with one line only: "${it.prefix}[${it.key}]: ${it.kind === 'api' ? 'endpoints' : 'steps'}=n P0=a P1=b P2=c P3=d".`

const verifyPrompt = (it) => `Read ${agentsDir}/verify.md and follow it.
File (rewrite in place — refute findings; leave the inventory/flow-map description intact): ${outPath(it)}
Reply with one line only: "${it.prefix}[${it.key}]: kept=x dropped=y".`

const synthApiPrompt = `Read ${agentsDir}/synthesize-api.md and follow it.
Verified endpoint files: ${outDir}/api/*.md
Final report: ${apiReport}
Meta — ${runMeta}, report language: ${language}.
Reply with one line only: "api-report: endpoints=n P0=a P1=b P2=c P3=d → ${apiReport}".`

const synthFlowPrompt = `Read ${agentsDir}/synthesize-flow.md and follow it.
Verified flow files: ${outDir}/flow/*.md
Also available for cross-reference: ${outDir}/api/*.md
Final report: ${flowReport}
Meta — ${runMeta}, report language: ${language}.
Reply with one line only: "flow-report: flows=n P0=a P1=b P2=c P3=d gaps=k → ${flowReport}".`

const synthIssuesPrompt = `Read ${agentsDir}/synthesize-issues.md and follow it.
Verified files: ${outDir}/api/*.md and ${outDir}/flow/*.md
Final report: ${issuesReport}
Meta — ${runMeta}, report language: ${language}.
Reply with one line only: "issues-report: P0=a P1=b P2=c P3=d → ${issuesReport}".`

// Audit → Verify 流水线：每个 item 的 audit 写文件、verify 原地重写，二者必为不同 agent（核心不变量）
phase('Audit')
const results = await pipeline(
  items,
  async (it) => {
    // agent() 失败时返回 null（非抛错），需显式抛错才能让 pipeline 把该 item 落为 null、跳过后续 verify
    const auditLine = await agent(auditPrompt(it), { label: `audit:${it.key}`, phase: 'Audit', agentType: 'general-purpose' })
    if (!auditLine) throw new Error(`auditor produced nothing: ${it.key}`)
    return { it, auditLine }
  },
  async (prev) => {
    const verifyLine = await agent(verifyPrompt(prev.it), { label: `verify:${prev.it.key}`, phase: 'Verify', agentType: 'general-purpose' })
    // 与 audit 阶段一致：agent() 失败只返回 null（非抛错），必须显式抛错才能让 pipeline 把该 item 落为 null、
    // 跳过后续合成。否则未验证的 auditor 文件会带着原始 findings 进入合成阶段，静默破坏 find/verify 分离这一核心不变量。
    if (!verifyLine) throw new Error(`verifier produced nothing: ${prev.it.key}`)
    return { ...prev, verifyLine }
  },
)

// await pipeline 返回即所有 audit+verify 已完成；失败的 item 已落为 null，filter 跳过
const survivors = results.filter(Boolean)
if (!survivors.length) throw new Error('all auditors failed; nothing to synthesize')

const haveApi = survivors.some((r) => r.it.kind === 'api')
const haveFlow = survivors.some((r) => r.it.kind === 'flow')

// api/flow 报告各读自己那一族的已验证文件（某一族全失败则跳过该报告）；
// 问题汇总整合两族 findings，只要有幸存者就产出。三者并行合成。
phase('Synthesize')
const [apiLine, flowLine, issuesLine] = await parallel([
  () => (haveApi ? agent(synthApiPrompt, { label: 'synthesize:api', phase: 'Synthesize', agentType: 'general-purpose' }) : Promise.resolve(null)),
  () => (haveFlow ? agent(synthFlowPrompt, { label: 'synthesize:flow', phase: 'Synthesize', agentType: 'general-purpose' }) : Promise.resolve(null)),
  () => agent(synthIssuesPrompt, { label: 'synthesize:issues', phase: 'Synthesize', agentType: 'general-purpose' }),
])

return {
  apiReport: haveApi ? apiReport : null,
  flowReport: haveFlow ? flowReport : null,
  issuesReport: issuesLine ? issuesReport : null,
  items: survivors.map((r) => ({ kind: r.it.kind, key: r.it.key, audit: r.auditLine, verify: r.verifyLine })),
  synthesize: { api: apiLine, flow: flowLine, issues: issuesLine },
}
