# skills-repo — Agent 须知

这是一个**编写和维护 Agent / Claude Code Skills** 的仓库。在此工作时遵循以下约定。

## 仓库性质

每个 skill 是 `skills/<name>/` 下的一个自包含目录，至少含一个 `SKILL.md`（带 YAML frontmatter）。skill 一览见 [README.md](README.md)。

## 核心原则

1. **Skill 独立性**：每个 skill 必须能单独启用，不得依赖其它 skill 的内部文件存在。
2. **只做 skill 级引用**：skill 之间需要关联时，**只提对方的 skill 名**（如「见 `code-conventions` skill」）。
   - ❌ 禁止：`[testing](../code-conventions/references/testing.md)`（内容级、跨目录路径引用）
   - ✅ 允许：「实现阶段的 TDD 细则见 `code-conventions` skill」
3. **正交不合并**：定位/触发频率不同的 skill 保持独立（如一次性的 `agents-scaffold`、手动审计的 `codebase-audit` 与高频的 `code-conventions`）。作用域重合、强耦合的能力则合并——spec-first/SDD 工作流全程依赖 polyrepo 结构，已并入 `agents-scaffold` 的 `spec-center/AGENTS.md` 模板，不单列 skill；接口/流程审计（原独立的接口审计 skill）同为手动一次性审计、与 `codebase-audit` 作用域重合，已并入其中成为条件维度。审计后处理链（`codebase-audit` → `remediate-suggest` → `remediate-apply`）保持三个独立 skill——发现、分析、执行定位不同，衔接只靠各自完成时的摘要提示下一步（不自动调用）。
4. **改动可追溯**：每一处改动都应直接服务于明确需求；不顺手「优化」无关内容。

## SKILL.md 规范

- frontmatter 必填 `name`（kebab-case，与目录名一致）和 `description`。
- `description` 用「Use when …」句式描述触发场景，措辞决定 agent 能否在正确时机命中该 skill。
  - **例外**：设了 `disable-model-invocation: true` 的 skill（仅手动 `/name` 调用，description 不进上下文、不参与自动触发判定），description 改为客观描述「这个 skill 做什么」即可，不必用「Use when …」句式（如 `codebase-audit`）。
- 正文：开头一句话点明定位，再给可执行的步骤/索引；保持精简。

## agents-scaffold 专项

- 所有确定性产物（拷模板、`{{PROJECT}}` 替换、`git init`，以及 `spec-center/AGENTS.md` 的 Module Map 表 + Repository Structure 树）都在 `scripts/scaffold.mjs`（**零依赖**，仅用 `node:` 内置模块）。表/树以工作区实际存在的 `<name>-<module>/` 目录为单一真相、幂等生成（角色取自各模块 `AGENTS.md` 的 `## Role`，连接线按结构计算）——不交给 LLM 手画。SKILL.md 负责意图判定、收集输入、确认计划、调脚本、(失败时)处理 `partial:` 残留、转述输出，不手工编辑生成产物。
- 模板在 `templates/`，用 `{{PROJECT}}` 占位。模板 `spec-center/AGENTS.md` 的 Module Map 表与 Repository Structure 树用锚点注释（`<!-- MODULE_MAP_START/END -->`、`<!-- REPO_TREE_START/END -->`）标出脚本维护区,初始只含 spec-center；脚本按实际模块重写锚点之间的内容（含自定义名模块）。正文方法论示例仍用 server/web/client 作具体举例，不代表工作区实际结构。
- 模板产出的工作区 `spec-center/conventions/` **初始为空**（仅 `.gitkeep`），不内联规范副本——规范来源是 `code-conventions` skill。新增/修改模板时不要重新引入指向不存在文件的死链。
- 改脚本或模板后必须跑测试：

```bash
cd skills/agents-scaffold && node --test scripts/scaffold.test.mjs
```

## 提交前检查

- [ ] 改动的 SKILL.md `name` 与目录名一致。
- [ ] 没有引入跨 skill 的内容级（文件路径）引用。
- [ ] 没有指向不存在文件的死链（尤其 agents-scaffold 模板）。
- [ ] 涉及 agents-scaffold 的改动已 `node --test` 全绿。
- [ ] 新增/重命名/删除 skill 时，README 的「Skills 一览」表与「使用 → 方式一」的 `npx skills add` 命令块已同步。
