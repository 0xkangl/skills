# AGENTS.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

这是一个**编写和维护 Agent / Claude Code Skills** 的仓库。正文维护在本文件；`CLAUDE.md` 只是指向这里的 `@AGENTS.md` 一行指针，不要往里写内容。

## 仓库性质

- 每个 skill 是 `skills/<name>/` 下的自包含目录，至少含一个 `SKILL.md`（带 YAML frontmatter）。skill 一览见 [README.md](README.md)。
- 无 lint/format 工具链、无构建/测试 CI（唯一的 workflow 是 release-please 发版自动化）——所有脚本**零依赖**（仅 `node:` 内置模块）。这是刻意设计，不要引入依赖或构建工具。
- 仓库根即 Claude Code plugin（`.claude-plugin/plugin.json` + 自指 `marketplace.json`，plugin 名 `kang-skills`）。skills 由 Claude Code 从根 `skills/` 自动发现——新增/删除 skill 无需改 manifest。版本由 release-please 依 Conventional Commits 自动管理（`feat:`→minor、`fix:`→patch、`!`→major；`docs:` 等类型不触发发版，随下次发版带出）——**不要手改** `plugin.json` 的 `version`、`version.txt` 和 `CHANGELOG.md`。
- `docs/superpowers/`（计划/设计文档）与 `.superpowers/`（SDD 执行产物）是长期保留的 spec-driven 工作流目录。
- `.claude/skills/` 用于本地安装的 skill，目录中的条目默认由 Git 忽略。

## 核心原则

1. **Skill 独立性**：每个 skill 必须能单独启用，不得依赖其它 skill 的内部文件存在。
2. **只做 skill 级引用**：skill 之间需要关联时，**只提对方的 skill 名**（如「见 `code-conventions` skill」）。
   - ❌ 禁止：`[testing](../code-conventions/references/testing.md)`（内容级、跨目录路径引用）
   - ✅ 允许：「实现阶段的 TDD 细则见 `code-conventions` skill」
3. **正交不合并**：定位/触发频率不同的 skill 保持独立；作用域重合、强耦合的能力才合并。现状：spec-first/SDD 工作流已并入 `agents-scaffold` 的治理模板（高频判定在 `AGENTS.md`，详细流程在按需加载的 `WORKFLOW.md`），不单列；接口/流程审计已并入 `codebase-audit` 作条件维度；审计后处理链 `codebase-audit` → `remediate-suggest` → `remediate-apply` 保持三个独立 skill——发现、分析、执行定位不同，衔接只靠各自完成时的摘要提示下一步（不自动调用）。
4. **改动可追溯**：每一处改动都应直接服务于明确需求；不顺手「优化」无关内容。
5. **引入外部机制只抄机制**：从别的仓库/插件集借鉴时——① 只抄想法与结构，**不抄实现与依赖**，一律重写成本仓形态（零依赖、自包含、只提 skill 名）；② 范围有增删就改用本仓原生命名，不沿用上游名；③ 落地前自问「不知道上游那个仓的人，能否看懂这个 skill 是干什么的」，答不上就说明抄的是别人的产品身份而不是能力。

## SKILL.md 规范

- frontmatter 必填 `name`（kebab-case，与目录名一致）和 `description`。
- `description` 用「Use when …」句式描述触发场景，措辞决定 agent 能否在正确时机命中该 skill。
  - **例外**：设了 `disable-model-invocation: true` 的 skill（仅手动 `/name` 调用，description 不进上下文、不参与自动触发判定），description 改为客观描述「这个 skill 做什么」即可（如 `codebase-audit`）。
- 正文：开头一句话点明定位，再给可执行的步骤/索引；保持精简。

## agents-scaffold 专项

- `scripts/scaffold.mjs` 负责在目标目录渲染单仓库模板、处理冲突和初始化 Git。`SKILL.md` 负责收集输入、执行 dry-run、核对冲突授权，并汇报备份和失败残留。
- `templates/common/` 提供共用治理文档和 Agent 配置；`server/`、`web/`、`client/` 技术栈模板提供脚手架文件和并入根 `AGENTS.md` 的技术栈说明。项目名使用 `{{PROJECT}}` 占位。`CLAUDE.md` 只含一行 `@AGENTS.md`，详细开发流程放在 `WORKFLOW.md`。
- 改脚本或模板后必须跑测试：

```bash
cd skills/agents-scaffold && node --test scripts/scaffold.test.mjs
```

## 提交规范

- Conventional Commits：`type(scope): subject`。scope 常用 skill 名或模块名；subject 中英文不限。

## 提交前检查

- [ ] 改动的 SKILL.md `name` 与目录名一致。
- [ ] 没有引入跨 skill 的内容级（文件路径）引用。
- [ ] 没有指向不存在文件的死链（尤其 agents-scaffold 模板）。
- [ ] 涉及 agents-scaffold 的改动已 `node --test` 全绿。
- [ ] 新增、重命名或删除 skill 时，更新 README 的「Skills 一览」表，并核对「单个 skill」一节的安装示例。
