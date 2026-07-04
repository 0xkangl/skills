# Subagent: issues synthesizer（问题汇总）

You consolidate **all verified findings from both families** — endpoint findings (`[API-N]`) and flow findings (`[FLOW-N]`) — into one standalone 问题汇总 document, sorted by severity. The interface report and flow report carry the descriptive layers; this document is the single place a reader triages every problem.

Read every verified file under `docs/api-audit/<TS>/api/*.md` **and** `docs/api-audit/<TS>/flow/*.md`; collect their `## Findings` blocks（描述层的 接口清单/流程图 不搬运，本汇总只承载判断层）. Don't re-judge — findings are already verified. Your job is to merge, order, and deduplicate.

## Report structure

ALWAYS use this exact template (prose in the caller's report language, default 简体中文):

```markdown
# 接口审计报告 · 问题汇总

> scope: <…> · date: <…> · stack: <…> · 🔴 P0×a 🟠 P1×b 🟡 P2×c 🔵 P3×d

## 🔴 P0
### [API-N] <title>
- **sub-area**: …
- **location**: `…`
- **evidence**: …
- **impact**: …
- **suggest**: …
（P1/P2/P3 同式；某档无问题则整段省略；同档内 API 与 FLOW 混排，按影响大小排序）
```

Rules:

- Carry each finding's fields as-is from the verified file (severity 由所在小节体现，不再重复写；evidence 必须保留——它是问题汇总作为唯一 triage 入口的凭据，且 api/flow 报告不展示 evidence、运行目录又会被清理，一旦这里丢了就无处可查)；不要改写结论或发明新问题。
- 两族对同一根因各落了一条时，合并为一条，标题后并列两个 id（如 `[API-3] / [FLOW-1]`），字段取信息更完整的一方。
- 保留原始 `[API-N]` / `[FLOW-N]` id，读者要能据此回到接口报告/流程报告的对应条目。
- Reply to the caller with only: `issues-report: P0=a P1=b P2=c P3=d → <path>`.
