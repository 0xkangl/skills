export const meta = {
  name: 'api-audit',
  description: 'Fan out endpoint + flow auditors, adversarially verify each, synthesize two reports',
  phases: [
    { title: 'Audit', detail: 'one auditor per endpoint group + per business flow, in parallel' },
    { title: 'Verify', detail: 'one fresh verifier refutes each auditor\'s findings' },
    { title: 'Synthesize', detail: 'two synthesizers: interface report + business/flow report' },
  ],
}

// args 由主 agent 在 Scope 阶段算好后传入（脚本内不能取时钟，也无文件系统——scope 以文件路径传入，由 agent 自读）
// 守卫：args 被当成 JSON 字符串传入时解构出来全是 undefined，这里直接点破，而非在后面以「空输出」告终
if (typeof args !== 'object' || args === null) {
  throw new Error(`args 不是对象（typeof=${typeof args}）——大概率被当成 JSON 字符串传入，应传真正的 JSON 值`)
}
const { ts, scopeFile, language, agentsDir, meta: runMeta, groups, flows } = args
const missing = ['ts', 'scopeFile', 'agentsDir'].filter((k) => args[k] == null)
if (missing.length) throw new Error(`args 缺字段：${missing.join(', ')}；收到的 keys：${Object.keys(args).join(', ') || '（空）'}`)
const outDir = `docs/api-audit/${ts}`
const apiReport = `docs/api-audit/api-report-${ts}.md`
const flowReport = `docs/api-audit/flow-report-${ts}.md`

const groupItems = (groups || []).map((g) => ({
  kind: 'api', key: g.key, name: g.name, prefix: 'API',
  instruction: 'audit-endpoint.md', subdir: 'api',
}))
const flowItems = (flows || []).map((f) => ({
  kind: 'flow', key: f.key, name: f.name, prefix: 'FLOW',
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
  async (prev) => ({ ...prev, verifyLine: await agent(verifyPrompt(prev.it), { label: `verify:${prev.it.key}`, phase: 'Verify', agentType: 'general-purpose' }) }),
)

// await pipeline 返回即所有 audit+verify 已完成；失败的 item 已落为 null，filter 跳过
const survivors = results.filter(Boolean)
if (!survivors.length) throw new Error('all auditors failed; nothing to synthesize')

const haveApi = survivors.some((r) => r.it.kind === 'api')
const haveFlow = survivors.some((r) => r.it.kind === 'flow')

// 两份报告各读自己那一族的已验证文件，并行合成（某一族全失败则跳过该报告）
phase('Synthesize')
const [apiLine, flowLine] = await parallel([
  () => (haveApi ? agent(synthApiPrompt, { label: 'synthesize:api', phase: 'Synthesize', agentType: 'general-purpose' }) : Promise.resolve(null)),
  () => (haveFlow ? agent(synthFlowPrompt, { label: 'synthesize:flow', phase: 'Synthesize', agentType: 'general-purpose' }) : Promise.resolve(null)),
])

return {
  apiReport: haveApi ? apiReport : null,
  flowReport: haveFlow ? flowReport : null,
  items: survivors.map((r) => ({ kind: r.it.kind, key: r.it.key, audit: r.auditLine, verify: r.verifyLine })),
  synthesize: { api: apiLine, flow: flowLine },
}
