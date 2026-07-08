---
name: new-skill
description: 按本仓库约定在 skills/ 下创建一个新 skill——收集定位与触发方式，生成符合规范的 SKILL.md（frontmatter 规则、description 句式判定），并同步 README 的「Skills 一览」表与 npx skills add 命令块。用法：/new-skill <skill-name> [一句话定位]。
disable-model-invocation: true
---

# new-skill

按本仓约定创建新 skill 的引导式工作流。输入：`$ARGUMENTS`（skill 名，可附一句话定位）。与通用的 `skill-creator` 互补：本 skill 负责落实**本仓库的结构约定**；需要深度打磨内容或跑 evals 时再用 skill-creator。

## 流程

### 1. 收集输入

从 `$ARGUMENTS` 解析 skill 名（kebab-case）和定位描述。以下信息缺失时用 AskUserQuestion 一次性问齐：

- **定位/性质**：行为准则、规范索引、结构性操作、审计、修复流程……一句话说清它做什么。
- **触发方式**：agent 自动按场景触发，还是仅手动 `/name` 调用？
- **与现有 skill 的关系**：是否与某个现有 skill 定位重合？（重合且强耦合应考虑并入而非新建——先对照 CLAUDE.md「正交不合并」原则，向用户说明再继续。）

### 2. 生成 SKILL.md

创建 `skills/<name>/SKILL.md`，frontmatter 按触发方式二选一：

- **自动触发**：`description` 必须用「Use when …」句式描述触发场景——措辞决定 agent 能否在正确时机命中。
- **仅手动**：加 `disable-model-invocation: true`，`description` 改为客观描述「这个 skill 做什么」。

硬性规则：

- `name` 与目录名一致（kebab-case）。
- 正文开头一句话点明定位，再给可执行的步骤/索引，保持精简。
- 不引用其它 skill 的内部文件路径——需要关联时只提对方 skill 名。

### 3. 同步 README

- 在「Skills 一览」表中按现有行格式新增一行（Skill / 性质 / 触发时机 / 作用）。
- 检查「使用 → 方式一」的 `npx skills add` 命令块示例是否需要提及新 skill 名。
- 若新 skill 与现有 skill 有上下游关系，更新「Skill 之间的关系」图（仍然只提 skill 名）。

### 4. 验收

跑 `/skill-check` 确认全部通过，向用户汇报创建结果与文件清单。**不自动提交**——提交时机由用户掌控。
