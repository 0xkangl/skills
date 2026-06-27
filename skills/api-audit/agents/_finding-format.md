# Shared: finding format & severity scale

Both auditor families (endpoint, flow) read this, then emit findings in the format below. Keep output dense — no filler, no restating these rules.

## Severity scale (interface-logic flavored)

- **P0 — Critical**: 接口逻辑错误使核心路径不可用 / 产生错误或可被破坏的数据 / 鉴权被绕过；或某业务流程存在矛盾或缺失接口，导致关键流转**根本无法完成**。Fix now.
- **P1 — High**: 逻辑缺陷很可能引发生产事故；接口设计缺陷阻碍扩展/维护；缺失接口使一个重要场景无法支撑。
- **P2 — Medium**: 真实的设计异味、冗余/可合并的接口、可简化的逻辑，但暂无运行时影响。
- **P3 — Low**: 打磨、轻微优化、可读性。

## Sub-area (pick the one that fits)

- Endpoint auditor: `正确性` | `合理性` | `简化优化` | `必要性`
- Flow auditor: `正确性` | `设计合理性` | `简化优化` | `矛盾` | `缺失`

**`简化优化` 的判定基准**——问的是「能不能更简单 / 更优」，不是「还能加什么」：

- **逻辑 / 流程可简化**：合并重复逻辑、减少往返与中间状态、删可达不到的死分支。
- **业务流程可优化**：把多次往返收敛成更短、更自洽的闭环（端点维度对应单接口逻辑，流程维度对应整条链路）。
- **不过度设计**：为单一用途造的抽象、未被要求的可配置 / 灵活性、多余的接口 / 参数 / 分层——按 YAGNI 砍掉。
- **符合行业最佳实践**：同类问题已有更简单的成熟、生产级方案时，按成熟方案给建议，而不是自创复杂解。

判定时自问「资深工程师会不会觉得这里过度复杂」；会，就落一条 `简化优化`。

## Finding shape

Write findings under the `## Findings` section of your file, in exactly this shape:

```markdown
### [{PREFIX}-1] <title>
- **severity**: P0|P1|P2|P3
- **sub-area**: <one of the sub-areas above>
- **location**: `path:line`            ← the endpoint/handler or the flow step in question; omit only if truly not pinpointable
- **evidence**: <the code construct that proves this — quote it, don't gesture>
- **impact**: <concrete consequence: wrong result / broken flow / wasted endpoint / blocked scenario>
```

Rules:

- Write prose fields in the caller's **Report language** (default 简体中文); keep field labels, severity codes, and the `[PREFIX-N]` ids as-is.
- Report only what the code you actually read supports; never infer unseen context. A "缺失接口" finding must point to the **flow step / caller** that has nothing to serve it — that's its evidence.
- One finding per real problem — don't pad to cover every sub-area.
- `evidence` is mandatory and checkable: an independent verifier will try to refute it.
- **No `fix` field is required in the finding body**, but add a one-line `- **suggest**:` with the concrete remedy/simplification — this skill's value is actionable improvement, and there is no separate fix stage.
- No statistics, no summary — the synthesizer aggregates.
