# 修复与脚手架 Skills 优化计划

**Goal:** 保持现有目标，修正五个 skill 的执行歧义与确定性处理缺口。
**Architecture:** 模型负责判断；自包含 Node 脚本负责可校验的片段合并。主 agent 处理用户交互与队列状态，子 agent 使用显式工作目录与边界。
**Tech Stack:** Markdown、Node 内置模块、node:test。
**Spec:** [审阅设计](../specs/2026-11-11-repair-skills-design.md)。

## 约束

零依赖；只提其它 skill 名；不改变方案选择、只分析、一问题一提交及状态文档不提交的目标。用户已授权执行与本地集成，无需追加流程确认。

## 执行

- [x] 基线：审阅五个 skill；记录 scaffold 现有测试；独立场景审查。
- [x] 修复诊断与 batch：精简元数据、交互转达、授权复用、最终验证顺序和失败残留。
- [x] 修复 scaffold：针对确认的 CLI/预检缺陷先复现，补测试再最小修正；同步命令示例与 README。
- [x] 修复 suggest：为片段校验/合并编写失败用例，实现源内容指纹、原文保留、重复/未知 ID 拒绝、无新增不覆盖和原子写入；同步说明。
- [x] 修复 apply：明确基线、状态文档排除、结果校验和失败隔离；复核关联消解与人工方案选择。
- [x] 验证：运行脚本测试、skill-check 清单、前后场景复核及独立 diff review。
- 集成收尾（以 Git 记录验收）：只暂存本次文件，Conventional Commit，本地 main 快进合并，核验 main 与工作区。
