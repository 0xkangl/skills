# 设计：api-audit 并入 codebase-audit，聚焦问题发现与整理

> 日期：2026-07-06 · 状态：已定稿（用户确认；同日二次评审查缺补漏，修订已原位融入各节）

## 1. 背景与目标

现有 `codebase-audit` 与 `api-audit` 是两个独立的多 agent 审计 skill。本次改造目标：

1. **移除所有 fix / quick-fix / suggest 流程与步骤**——skill 只做问题发现与整理，不产出修复方案。
2. **api-audit 整体并入 codebase-audit**，接口/流程审计成为条件维度（接口审计仅 HTTP 服务激活；流程审计不限项目类型，识别出重要业务流程即激活），`skills/api-audit/` 目录彻底删除。
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
| 运行期产物命名 | `<TS>/` 下平铺：`api-<group>.md`、`flow-<flow>.md`，不设 `api/`、`flow/` 子目录 |
| flow 适用范围 | 不限 HTTP 项目；识别出重要业务流程即激活，步骤映射到接口或模块/函数等承载点 |

## 2. 合并后的 skill 形态

只保留 `skills/codebase-audit/`。维度扩为 12 个：

- **通用 9 个**（不变）：arch、perf、code、security、testing、deps、obs、infra、conv。
- **条件 3 个**：
  - `fe`——检测到 web/前端栈时激活（现状不变）。
  - `api`（接口审计）——**仅当 Scope 检测到 HTTP 服务**（路由注册 / OpenAPI spec）时激活；检测逻辑与端点枚举表（框架 grep 提示表、spec drift 处理）沿用原 api-audit Step 1。**分工句保留**：REST 语义、命名、错误码等规范符合性归 `conv` 维度（基准来自 code-conventions skill），api 维度只审接口逻辑的完备性/自洽性/必要性——这句写进 SKILL.md 的维度说明与 `audit-endpoint.md`，减少同一次 run 里 API 与 CONV/SEC 撞根因（issues 合成端的同根因合并只是兜底，上游少产重复更省）。
  - `flow`（业务流程审计）——**不限 HTTP 项目**：Scope 识别出重要业务流程（用户点名，或项目存在明显的多步核心路径）即激活。HTTP 项目的流程步骤映射到接口（接口清单为地图）；非 HTTP 项目映射到承载点（模块/函数/命令/消息处理器/定时任务）。

并行粒度保留原 api-audit 设计：`api` 维度按接口分组各出一个 auditor、`flow` 按流程各出一个，其余维度各一个 auditor。自然语言收窄照常适用（「只审接口」「skip flow」「security only」等）。

find/verify 分离仍是唯一硬不变量；Agent/Workflow 派发降级阶梯不变（`ultracode` 才走 Workflow）。

## 3. 管道（6 步 → 5 步）

```
main agent (orchestrator)
  1. Scope      → 选维度 + 报告语言，检测栈；HTTP 项目枚举接口清单骨架与分组；
                  凡识别出重要业务流程（不限 HTTP）即列候选流程；TS 戳；mkdir docs/audit/<TS>/
  2. Audit      → 一批并行：常规维度 → docs/audit/<TS>/<dim>.md
                  接口组 → docs/audit/<TS>/api-<group>.md
                  流程   → docs/audit/<TS>/flow-<flow>.md
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
├── <TS>/                      ← 运行期临时目录，交付后删除；产物平铺、无子目录
│   ├── <dim>.md               （常规维度 findings）
│   ├── api-<group>.md         （api 维度激活时，每接口组一份）
│   ├── flow-<flow>.md         （flow 维度激活时，每流程一份）
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
## 接口清单与逐接口分析            ← api 维度激活（HTTP 项目）才有；逐接口五行
                                   （位置/使用时机/限制/配合/必要性）+ 问题行
## 重要功能与业务流程              ← flow 维度激活才有（不限 HTTP）；逐流程 入口/
                                   步骤→承载点（接口，或模块/函数/命令）/状态流转/问题行；
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
| 迁入并改 | `audit-endpoint.md`、`audit-flow.md` → `codebase-audit/agents/`（删 suggest、id 带 key、impact 字段、输出路径改 `docs/audit/<TS>/api-<group>.md` / `flow-<flow>.md`）；`audit-flow.md` 措辞泛化：「步骤→接口」改「步骤→承载点」（HTTP 项目以接口为主形态，非 HTTP 为模块/函数/命令/消息处理器/定时任务），缺失类 = 该步骤在项目中无任何承载 |
| 重写 | `codebase-audit/SKILL.md`（frontmatter description 一并更新，**保留 `disable-model-invocation: true`**）；`agents/_finding-format.md`（合并两版：通用 severity 标尺 + 接口味注记、统一 finding shape、两族 sub-area）；`agents/verify.md`（合并两版：描述层不动 + 必要性/缺失类严格反驳指引）；`scripts/workflows.mjs` |
| 新增 | `agents/synthesize-report.md`、`agents/synthesize-issues.md` |
| 合并 | `api-audit/evals/evals.json` → `codebase-audit/evals/evals.json` |
| 核对 | 10 个常规维度指令文件（`audit-*.md`）逐一核对：sub-area 定义保留；**正文与示例中的 `**risk**` 全量改 `impact`**——不止示例块，`audit-infra/frontend/observability/security/performance/conventions` 六个文件的指令正文有「Frame each **risk** around …」句式，漏改任一处验收 7 的 grep 会挂；其余内容不动 |

### agents 指令文件合并细案（扬长补短、查缺补漏）

#### _finding-format.md（合并两版）

- **severity 标尺**：以 codebase 通用版为基底，附 api 版接口味注记（api/flow 维度下 P0 如「鉴权绕过、关键流转根本无法完成」、P1 如「缺失接口使重要场景无法支撑」）；保留「维度文件可收紧标尺」。
- **保留 api 版「简化优化 判定基准」**四条（逻辑可简化 / 流程可优化 / YAGNI 不过度设计 / 行业成熟方案）与「资深工程师会不会觉得过度复杂」自问。
- **文件骨架沿 codebase 版**（`# {…} — findings` + `## Strengths`（无则省）+ `## Findings`）；接口/流程文件的描述层模板仍在 `audit-endpoint.md` / `audit-flow.md`，本文件只定义所有 auditor 共享的 finding 块形状。
- **字段**：severity / sub-area / location / evidence / **impact**（`risk` 更名；含义合并两版——留着不管的具体后果：错误结果 / 事故 / 流程受阻 / 白费的接口）。
- **id 规则**：常规维度 `[<PREFIX>-N]`；接口/流程 `[API-<group>-N]` / `[FLOW-<flow>-N]`（key 与文件名一致，防跨组撞号）。
- **sub-area**：常规维度由各维度文件定义；endpoint 族（正确性/合理性/简化优化/必要性）与 flow 族（正确性/设计合理性/简化优化/矛盾/缺失）在本文件列出。
- **规则合并**：报告语言；evidence 必须可核（verifier 将反驳）；不推断未见上下文；一真问题一条不凑数；缺失类 finding 的 evidence = 无接口可用的那个流程步骤/调用方；不产出修复方案/改进建议；无统计无总结。

#### verify.md（合并两版）

- 独立性检查保留 codebase 版更全的措辞（self-checked ≠ verified）；判决三态 confirmed/adjusted/dropped、拿不准就 drop、`> verified:` 行照旧；删除旧版「fix 稍后添加」句。
- **描述层与 Strengths 保护（补漏）**：`## Strengths` 在**所有**文件中原样保留（codebase 旧版未提及，属漏洞）；接口/流程文件的 接口清单/流程图 原样保留，两条例外沿 api 版（描述与代码相悖时修正该行；drop 必要性 finding 时同步改 必要性 行）。
- **悬挂引用规则推广（补漏）**：描述层**任何** `见 [id]` / ⚠️ 标记，所指 finding 被 drop 时必须同步更新（改回正常表述或删去）——api 版只覆盖了 必要性 行，流程图步骤标记同样会悬挂。
- **分类反驳指引**：通用四问（证据是否误读 / 别处是否有 guard / 是否惯用且安全 / 是否依赖未见上下文）+ api 版两条从严（必要性：先 grep 调用方再同意冗余；缺失：最易夸大、确认无别处已覆盖——HTTP 看别的路由/动词/参数，非 HTTP 流程看别的函数/命令/路径）+ 新增一条（**简化优化**：确认「更简单的做法」不丢代码里真实存在的约束——并发/边界/兼容性；复杂度实际承重则 drop）。
- 回复行按文件类型：常规 `<PREFIX>: kept=x dropped=y`；接口/流程 `<PREFIX>[<key>]: kept=x dropped=y`。

#### synthesize-report.md（新增；融合旧 synthesize + synthesize-api + synthesize-flow）

- 输入：全部已验证文件的**显式列表**（`<TS>/` 下平铺的 `<dim>.md`、`api-<group>.md`、`flow-<flow>.md`；由编排方逐一列出，不用 glob——避免把 `scope.md` 误读为 findings）；只组织与下结论，**不重判、不发明 findings**。
- 结构即第 4 节 report 模板；继承规则：
  - **覆盖性**（api 版之长）：每个激活维度必有结论小节（零 findings 也写状态结论）；接口清单覆盖每个接口（无问题写「—」，必要性 行逐接口必写）；流程覆盖每条；清单字段逐行搬运不压缩。
  - 冗余/存疑接口与缺失接口在 概览 与对应章节突出（去掉建议形态，只述问题）。
  - **Strengths 跨维度去重、标注来源维度**（codebase 版之长）。
  - **反臃肿三禁令**（codebase 版之长）：不做子报告索引、不做每维统计表、不做修复时间线；按严重度问题清单**不出现在本报告**（分工线）。
  - prefix 图例**写全 12 个**：10 个常规前缀（ARCH/PERF/CODE/SEC/TEST/DEP/OBS/INFRA/FE/CONV）+ API/FLOW——旧 synthesize.md 图例漏了 PERF/INFRA/FE（预存缺陷），重写时不照抄。
- 回复行：`report: dims=<n> endpoints=<n|-> flows=<n|-> → <path>`。

#### synthesize-issues.md（自 api 版扩展为全维度）

- 输入同上，只读各文件 `## Findings`（描述层不搬运）；模板沿 api 版（P0→P3 分节；字段 sub-area / location / evidence / impact；维度由 id 前缀体现，不另设字段），但**文档标题改项目级**——「项目审计报告 · 问题汇总」（不照抄旧模板的「接口审计报告 · 问题汇总」，与 report 的「项目审计报告」配套）。
- **evidence 必留**及理由原话保留（唯一 triage 入口、运行目录会删，丢了无处可查）。
- **同根因合并推广（补漏）**：从「两族之间」推广到**任意维度之间**（如 SEC 与 ARCH 撞同一根因）——合并一条、标题后并列 id、字段取更完整方。
- **同档排序**：按影响大小；同模块/同文件条目相邻排列（吸收旧 clustering 的可读性价值）；跨档同根因不合并时各加一行 `- **related**: [id]` 互指。
- **空清单行为（补漏）**：零 findings 仍产出文档——头部 totals 全 0 + 一句「未发现可证实的问题」。
- 回复行：`issues-report: P0=a P1=b P2=c P3=d → <path>`（跨维度去重后的计数）；SKILL.md Step 5 摘要的 Totals **取自本行、不得累加各文件计数**（api 版防重复计数规则，推广到全维度）。

### workflows.mjs 要点

- args：`{ ts, scopeFile, language, agentsDir, meta, dimensions, groups?, flows? }`。`dimensions` 只含常规维度 key（含 fe）；`groups` 非空即激活 api 维度（仅 HTTP 项目会传），`flows` 非空即激活 flow 维度（不限 HTTP）——避免「声明了维度却没给清单」的不一致态。字符串 args 的 JSON.parse 兜底保留。
- **必填字段沿 api 版查全五个**：`ts / scopeFile / agentsDir / meta / language`（现 codebase 版只查前三，合并版统一）。
- **空校验改看总 items**：`dimensions` 允许为空数组（「只审接口」「只审流程」收窄时的合法态），仅当 常规维度 + groups + flows 的总 items 为空才抛错——这是对现 codebase 版「dimensions 为空即抛错」的行为变更；未知维度 key 的忽略日志（`忽略未知维度 key：…`）保留。
- Audit→Verify pipeline：items = 常规维度 + group items + flow items，audit 与 verify 必为不同 agent；verify 失败显式抛错落 null（沿用 api 版的严格处理）。
- 产物路径平铺：`${outDir}/api-<group>.md`、`${outDir}/flow-<flow>.md`（`safeKey` 消毒后拼前缀，无子目录）。
- Synthesize：`parallel` 跑 2 个合成器（report + issues），prompt 里传幸存文件的**显式列表**（不含 `scope.md`），不用 glob。
- 删除：桶解析（`buckets=` 正则）、Fix phase、Assemble phase。phases 变为 Audit / Verify / Synthesize。
- key 消毒（`safeKey`）沿用 api 版，防路径越界；**消毒后撞名加序号后缀去重**——两个 group/flow key 消毒后同名会互相覆盖产物文件（api 版预存问题，顺带修）。
- 返回值：`{ reportPath, issuesReportPath, items(各 audit/verify 行), synthesize: { report, issues } }`。**失败语义沿 api 版**：合成器失败时对应路径置 null（`reportPath: reportLine ? … : null`、`issuesReportPath: issuesLine ? … : null`）——Deliver 据 null 判断保留 `<TS>/` 现场，这是第 8 节「任一合成器失败保留现场」在 Workflow 路径上的可观测信号来源。

### evals.json 要点

新建 `codebase-audit/evals/`，合并原 api-audit 三条 eval（prompt 改为 `/codebase-audit` 措辞，期望输出改为「两份文档、findings 只带证据与后果、缺失接口不给形态建议、按严重度清单只在 issues-report」），另加一条非 HTTP 项目 eval（断言 report 无接口清单章节、api 维度未激活；若该项目识别出重要业务流程，flow 维度照常激活、报告含业务流程章节且步骤映射到模块/函数等承载点）。`skill_name` 字段改 `"codebase-audit"`、notes 同步改写；全文件（含期望输出文案）不得出现英文 `suggest` 字样——验收 2 的 grep 范围是整个 `skills/codebase-audit/`，含 `evals/`。

## 7. 仓库文档同步

- **README.md**：Skills 一览表删 api-audit 行；`npx skills add` 命令块同步；介绍段「api-audit 与 codebase-audit 正交」改为合并说明（codebase-audit 描述补充：HTTP 项目自动附带接口/流程审计）；**「Skill 之间的关系」ASCII 图删 api-audit 块**、合并说明并入其中的 codebase-audit 块；目录树删 api-audit 条目、**codebase-audit 行补 `evals/`**，并顺手修正目录树里现存的 codebase-audit 重复两行（预存 bug，同一编辑区）。
- **AGENTS.md**：「当前四个 skill」改为**六个**——README 一览表现有 7 个 skill，AGENTS.md 的「四个」本就过时，删 api-audit 后为 6，本次一并修正；核心原则 3 的合并案例补充「接口/流程审计（原独立的接口审计 skill）并入 codebase-audit——同为手动一次性审计、作用域重合」。
- **措辞约束**：README 与 AGENTS.md 的合并说明**不得出现字面 `api-audit`**（用「原独立的接口审计 skill」等表述）——验收 1 的 grep 范围含这两个文件，字面残留会挂验收。

## 8. 失败处理（合并两版）

- auditor 无产出 → verifier/合成器跳过该文件，摘要注明，不阻塞。
- 未发现路由但用户点名要接口审计 → 扩大 grep / 查 spec 文件 / 询问路由注册位置后再派发。
- 未识别出重要业务流程 → flow 维度不激活，摘要注明（HTTP 项目 api 族照常）。
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
6. 产出路径全仓统一为 `docs/audit/`（`report-<TS>.md`、`issues-report-<TS>.md`、临时 `<TS>/`），不再出现 `docs/api-audit/` 或 `docs/audit/{codebase,api}/`；`<TS>/` 内产物平铺（`api-<group>.md`、`flow-<flow>.md`），全仓 grep 不到 `<TS>/api/`、`<TS>/flow/` 子目录写法。
7. `rg -n '\*\*risk\*\*' skills/codebase-audit/agents/` 无匹配（finding 字段已全量统一为 `impact`）。
8. 回复行契约三处一致：SKILL.md 各 Step 的 prompt、`workflows.mjs` 各 prompt、对应 agents 文件末尾的回复行约定，逐字比对无出入。
