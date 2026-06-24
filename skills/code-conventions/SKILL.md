---
name: code-conventions
description: Use when writing or modifying code - designing HTTP APIs, adding structured logging/observability, writing tests, formatting commit messages, defining error codes, designing error-handling flow, or building Go backend services. Routes to the matching convention document before implementing.
---

# Code Conventions

> 横切规范的统一索引。每篇规范定义所有模块 MUST 遵循的跨领域规则。动手前先按下表加载对应文档。

## 通用规范（Universal）

适用于所有模块，与技术栈无关。

| 关注点 | 文档 | Scope | Description |
|---|---|---|---|
| HTTP API 设计 | [references/http-constitution.md](references/http-constitution.md) | 所有 HTTP 服务 / API | 方法选择、状态码、响应结构、分页、排序、时间格式、版本化 |
| 日志 / 可观测性 | [references/observability.md](references/observability.md) | 所有模块 | 结构化日志（JSON/text）、日志级别、逻辑位置、traceId 关联、命名约定 |
| 测试 | [references/testing.md](references/testing.md) | 所有模块 | 测试分类、AAA 结构、命名、mock 哲学、覆盖率目标、集成测试 |
| 提交信息 | [references/conventional-commits.md](references/conventional-commits.md) | 所有模块 | Git 提交信息规范：type、scope、格式 |
| 错误码 | [references/error-codes.md](references/error-codes.md) | 所有 API | 业务错误码注册表：码段划分、`{code, message, details}` 信封 |

## Go 专项规范（`references/golang/`）

在通用规范之上扩展 Go 技术栈。

| 文档 | Scope | Description |
|---|---|---|
| [references/golang/go-project.md](references/golang/go-project.md) | 所有 Go 后端服务 | 项目结构：目录布局、分层架构 |
| [references/golang/go-style.md](references/golang/go-style.md) | 所有 Go 后端服务 | 风格与惯用法：命名、控制流、错误、接口、并发（基于 Effective Go） |
| [references/golang/go-error-handling.md](references/golang/go-error-handling.md) | 所有 Go 后端服务 | 错误处理：`HTTPError` 接口、`AppError` 载体、分层错误流、堆栈捕获、单一响应出口 |
| [references/golang/go-tools.md](references/golang/go-tools.md) | 所有 Go 后端服务 | 开发工具：air、golangci-lint、goimports、govulncheck、migrate、配置文件、Makefile 目标 |
| [references/golang/go-testing.md](references/golang/go-testing.md) | 所有 Go 后端服务 | Go 测试：表驱动测试、httptest、build tag、接口 mock、覆盖率命令 |
| [references/golang/go-validation.md](references/golang/go-validation.md) | 所有 Go 后端服务 | 输入校验：库选型、字段规则、错误格式、自定义校验器 |

**参考配置**（normative 示例，非规范文档）：`references/golang/examples/` 存放 Go 后端的标准配置样例（`.air.toml`、`.golangci.yml`、`sqlc.yaml`）。采用 Go 技术栈时复制到服务仓库根目录；见 [go-tools.md](references/golang/go-tools.md) §2。

## 相关 Skill

- 规约驱动开发流程（spec-first、spec 划分/所有权、跨模块 plan 拆分、spec 索引维护）属于 polyrepo 工作区规范，见各项目 `<project>-spec-center/AGENTS.md`（由 `polyrepo-scaffold` 模板生成）；本 skill 的 [references/testing.md](references/testing.md) 承载其实现阶段的 TDD workflow 与测试细则。
- 工程行为规范（think-before-code、simplicity-first、surgical-changes、root-cause reasoning 等 LLM/agent 编码行为准则）不在本 skill 内，见独立 skill **`engineering-guidelines`**。
