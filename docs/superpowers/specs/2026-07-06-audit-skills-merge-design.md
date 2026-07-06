# 设计：api-audit 并入 codebase-audit，聚焦问题发现与整理

> 日期：2026-07-06 · 状态：已定稿（用户确认）

## 1. 背景与目标

现有 `codebase-audit` 与 `api-audit` 是两个独立的多 agent 审计 skill。本次改造目标：

1. **移除所有 fix / quick-fix / suggest 流程与步骤**——skill 只做问题发现与整理，不产出修复方案。
2. **api-audit 整体并入 codebase-audit**，接口/流程审计成为条件维度（仅 HTTP 服务激活），`skills/api-audit/` 目录彻底删除。
3. **产出统一到 `docs/audit/`**（平铺，不分子目录），报表与问题清单一一对应、命名一致。

### 决策记录（用户逐项确认）

| 决策点 | 结论 |
|---|---|
| 产出结构 | 拆「报告 + 问题汇总」两份，按严重度的问题清单只在汇总里 |
| HTTP 项目文档形态 | 固定两份：接口清单/业务流程作为 report 的章节，不单出接口篇 |
| suggest 移除尺度 | 彻底只留问题描述；「缺失接口」不给建议的接口形态 |
| 时间戳 | 最终文件名保留 `<TS>` 后缀，多次审计共存 |
| 旧目录处置 | `skills/api-audit/` 彻底删除，有用的 agent 指令与 evals 并入 codebase-audit |
| 规范统一 | finding 字段统一为 `impact`；接口/流程 finding id 带 key 防撞 |

## 2. 合并后的 skill 形态

只保留 `skills/codebase-audit/`。维度扩为 12 个：

- **通用 9 个**（不变）：arch、perf、code、security、testing、deps、obs、infra、conv。
- **条件 3 个**：
  - `fe`——检测到 web/前端栈时激活（现状不变）。
  - `api`（接口审计）、`flow`（业务流程审计）——**仅当 Scope 检测到 HTTP 服务**（路由注册 / OpenAPI spec）时激活；检测逻辑与端点枚举表（框架 grep 提示表、spec drift 处理）沿用原 api-audit Step 1。

并行粒度保留原 api-audit 设计：`api` 维度按接口分组各出一个 auditor、`flow` 按流程各出一个，其余维度各一个 auditor。自然语言收窄照常适用（「只审接口」「skip flow」「security only」等）。

find/verify 分离仍是唯一硬不变量；Agent/Workflow 派发降级阶梯不变（`ultracode` 才走 Workflow）。

## 3. 管道（6 步 → 5 步）

```
main agent (orchestrator)
  1. Scope      → 选维度 + 报告语言，检测栈；HTTP 项目额外枚举接口清单骨架、
                  分组、候选流程；TS 戳；mkdir docs/audit/<TS>/（HTTP 时加 api/ flow/）
  2. Audit      → 一批并行：常规维度 → docs/audit/<TS>/<dim>.md
                  接口组 → docs/audit/<TS>/api/<g>.md
                  流程   → docs/audit/<TS>/flow/<f>.md
  3. Verify     → 每个 auditor 文件一个全新 verifier，原地重写只留可证实的 findings
                  （接口/流程文件的描述层——接口清单/流程图——原样保留）
  4. Synthesize → 2 个合成器并行：
                  - report 合成器 → docs/audit/report-<TS>.md
                  - issues 合成器 → docs/audit/issues-report-<TS>.md
  5. Deliver    → 两份都确认写盘后才 rm -rf docs/audit/<TS>/；
                  任一合成器失败则保留现场供重试，并在摘要中说明
```

原 Step 5（fix-solution）与并行路径的 assemble 阶段整体删除；synthesize 不再有 Mode A/B。

## 4. 产出与命名

```
docs/audit/
├── <TS>/                      ← 运行期临时目录，交付后删除
│   ├── <dim>.md               （常规维度 findings）
│   ├── api/<group>.md         （HTTP 项目）
│   ├── flow/<flow>.md         （HTTP 项目）
│   └── scope.md               （Workflow 路径下的 scope brief）
├── report-<TS>.md             ← 审计报告
└── issues-report-<TS>.md      ← 问题汇总（按严重度清单唯一所在）
```

### report-<TS>.md 结构

```markdown
# 项目审计报告
> Scope · Date · Stack · Totals(🔴P0×N 🟠P1×N 🟡P2×N 🔵P3×N)

## Executive summary
## 各维度结论
### <维度名>                     ← 每个激活维度一小节：状态结论 +
                                   问题一览（一行一条 [PREFIX-N] 标题（Pn），无则「—」）
                                   api 维度结论覆盖 完备性/合理性/简化空间；flow 维度同理
## 接口清单与逐接口分析            ← HTTP 项目才有；逐接口五行
                                   （位置/使用时机/限制/配合/必要性）+ 问题行
## 重要功能与业务流程              ← HTTP 项目才有；逐流程 入口/步骤→接口/状态流转/问题行；
                                   保留「缺失的接口/功能」「矛盾与不一致」小节——
                                   只写 缺什么/哪一步需要/什么后果，不给接口形态建议
## Strengths
```

### issues-report-<TS>.md 结构

全部 findings 按 P0→P3 分节（沿用原 api-audit issues 模板），条目字段：sub-area / location / evidence / impact。规则：

- evidence 必须保留——issues-report 是唯一 triage 入口，运行目录会被清理。
- 跨维度/跨族同根因合并为一条，标题后并列多个 id，字段取信息更完整的一方。
- 严重度由所在小节体现；某档无问题整段省略。
- 报告与汇总通过 id 互相回溯：issues 条目可回到 report 对应维度/接口/流程条目。

### 规范统一（新增）

- **字段统一为 `impact`**：原 codebase 系 findings 的 `risk` 字段更名 `impact`，与接口/流程 findings 同构。
- **id 防撞**：接口/流程 finding id 带 key——`[API-<group>-N]`、`[FLOW-<flow>-N]`（原各分组独立编号会产生重复的 `[API-1]`）；常规维度 `[PREFIX-N]` 不变。

## 5. fix / suggest 移除清单

- 删除 `agents/fix-solution.md`、`agents/assemble.md` 及 SKILL.md 中对应阶段、quick-fix 标记、「可直接修复（批量）」清单、交付摘要的 `⚡ quick-fix×N`。
- `audit-endpoint.md` / `audit-flow.md` 模板删 `- **suggest**:` 行。
- report 合成器模板中「→ suggest 一行」改为只列 `[id] 标题（Pn）`；「简化/优化空间」结论只陈述哪里过度复杂/冗余，不给建议做法；「缺失的接口/功能」不给建议的接口形态。
- issues 合成器模板删 `**suggest**` 字段。
- `_finding-format.md` 的 no-fix 规则改为：**本 skill 只发现与整理问题，不产出修复方案/改进建议**（措辞用中文，避免文内字面出现 fix/suggest 干扰验收 grep）；问题描述必须自足（evidence + impact 讲清后果）。
- 「Constructive — every finding carries a fix」原则删除；strengths 照旧并报。
- 保留不动：`简化优化`/`必要性` sub-area（过度复杂/接口冗余本身是问题发现）；severity 定义中的「Fix now」字样（严重度语义，非流程步骤）。

## 6. 文件级变更清单

| 动作 | 文件 |
|---|---|
| 删除 | `skills/api-audit/` 整目录；`skills/codebase-audit/agents/fix-solution.md`、`agents/assemble.md`、`agents/synthesize.md` |
| 迁入并改 | `audit-endpoint.md`、`audit-flow.md` → `codebase-audit/agents/`（删 suggest、id 带 key、impact 字段、输出路径改 `docs/audit/<TS>/{api,flow}/`） |
| 重写 | `codebase-audit/SKILL.md`（frontmatter description 一并更新）；`agents/_finding-format.md`（合并两版：通用 severity 标尺 + 接口味注记、统一 finding shape、两族 sub-area）；`agents/verify.md`（合并两版：描述层不动 + 必要性/缺失类严格反驳指引）；`scripts/workflows.mjs` |
| 新增 | `agents/synthesize-report.md`、`agents/synthesize-issues.md` |
| 合并 | `api-audit/evals/evals.json` → `codebase-audit/evals/evals.json` |

### workflows.mjs 要点

- args：`{ ts, scopeFile, language, agentsDir, meta, dimensions, groups?, flows? }`。`dimensions` 只含常规维度 key（含 fe）；`groups`/`flows` 非空即激活 api/flow 维度（避免「声明了维度却没给清单」的不一致态）。字符串 args 的 JSON.parse 兜底保留。
- Audit→Verify pipeline：items = 常规维度 + group items + flow items，audit 与 verify 必为不同 agent；verify 失败显式抛错落 null（沿用 api 版的严格处理）。
- Synthesize：`parallel` 跑 2 个合成器（report + issues），二者都读全部已验证文件。
- 删除：桶解析（`buckets=` 正则）、Fix phase、Assemble phase。phases 变为 Audit / Verify / Synthesize。
- key 消毒（`safeKey`）沿用 api 版，防路径越界。
- 返回值：`{ reportPath, issuesReportPath, items(各 audit/verify 行), synthesize: { report, issues } }`。

### evals.json 要点

新建 `codebase-audit/evals/`，合并原 api-audit 三条 eval（prompt 改为 `/codebase-audit` 措辞，期望输出改为「两份文档、findings 只带证据与后果、缺失接口不给形态建议、按严重度清单只在 issues-report」），另加一条非 HTTP 项目 eval（断言 report 无接口清单/业务流程章节、api/flow 维度未激活）。

## 7. 仓库文档同步

- **README.md**：Skills 一览表删 api-audit 行；`npx skills add` 命令块同步；介绍段「api-audit 与 codebase-audit 正交」改为合并说明（codebase-audit 描述补充：HTTP 项目自动附带接口/流程审计）；目录树删 api-audit 条目。
- **AGENTS.md**：「当前四个 skill」改为三个；核心原则 3 的合并案例补充「api-audit 并入 codebase-audit（同为手动一次性审计、作用域重合）」。

## 8. 失败处理（合并两版）

- auditor 无产出 → verifier/合成器跳过该文件，摘要注明，不阻塞。
- 未发现路由但用户点名要接口审计 → 扩大 grep / 查 spec 文件 / 询问路由注册位置后再派发。
- 无明显业务流程 → 只跑 api 族，摘要注明。
- spec ↔ 代码漂移 → 作为 finding 种子。
- 生成的路由文件（如 gRPC-gateway）→ 列入清单但不深审生成胶水。
- 任一合成器失败 → 保留 `docs/audit/<TS>/`，摘要说明，不清理。
- 项目无测试 → testing auditor 记一条 P1（现状不变）。

## 9. 验收标准

1. `skills/api-audit/` 不存在；`rg -l "api-audit" skills/ README.md AGENTS.md` 无残留引用（spec 历史文档与未跟踪目录不在范围内）。
2. `rg -l "fix-solution|quick-fix|suggest" skills/codebase-audit/` 无匹配。
3. `node --check skills/codebase-audit/scripts/workflows.mjs` 通过。
4. SKILL.md `name` 与目录名一致；无跨 skill 内容级路径引用；无死链。
5. README 一览表 / 命令块 / 目录树、AGENTS.md skill 数目与原则案例均已同步。
6. 产出路径全仓统一为 `docs/audit/`（`report-<TS>.md`、`issues-report-<TS>.md`、临时 `<TS>/`），不再出现 `docs/api-audit/` 或 `docs/audit/{codebase,api}/`。
