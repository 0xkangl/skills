---
name: code-conventions
description: Use when writing or modifying code - designing HTTP APIs, adding structured logging/observability, writing tests, formatting commit messages, defining error codes, designing error-handling flow, naming config/env vars or handling secrets/keys, writing Dockerfiles/containerizing services, applying the security baseline, naming/code-style or design patterns, or building services in Go, Python, TypeScript/JavaScript, Rust, React, or Flutter/Dart. Routes to the matching convention document before implementing.
---

# Code Conventions

> 横切规范的统一索引。每篇规范定义所有模块 MUST 遵循的跨领域规则。动手前先按下表加载对应文档。

## 通用规范（Universal）

适用于所有模块，与技术栈无关。

| 关注点 | 文档 | Scope | Description |
|---|---|---|---|
| 编码风格 | [references/coding-style.md](references/coding-style.md) | 所有模块 | 语言无关的命名、文件组织、注释哲学、代码味道；行为准则见 `engineering-guidelines` skill |
| 设计模式 | [references/patterns.md](references/patterns.md) | 所有模块 | 分层架构、Repository、依赖注入、统一响应封套、用类型表达不变量 |
| 安全基线 | [references/security.md](references/security.md) | 所有模块 | 密钥、边界校验、注入/XSS/CSRF、认证授权、依赖审计；各语言 `*-security` 在此扩展 |
| HTTP API 设计 | [references/http-constitution.md](references/http-constitution.md) | 所有 HTTP 服务 / API | 方法选择、状态码、响应结构、分页、排序、时间格式、版本化、`Accept-Language` 内容协商与 locale 归一化 |
| 配置 / 密钥 | [references/configuration.md](references/configuration.md) | 所有模块 | 环境变量命名、缓存/队列双前缀、模块间 internal token、密钥与 HKDF 派生、JWT TTL（web 短时效）、第三方 stub 模式、服务端口 |
| 日志 / 可观测性 | [references/observability.md](references/observability.md) | 所有模块 | 结构化日志（JSON/text）、日志级别、逻辑位置、traceId 关联、命名约定 |
| 测试 | [references/testing.md](references/testing.md) | 所有模块 | 测试分类、AAA 结构、命名、mock 哲学、覆盖率目标、集成测试 |
| 提交信息 | [references/conventional-commits.md](references/conventional-commits.md) | 所有模块 | Git 提交信息规范：type、scope、格式 |
| 错误码 | [references/error-codes.md](references/error-codes.md) | 所有 API | 业务错误码注册表：码段划分、`{code, message, details}` 信封 |
| 容器 / Docker | [references/docker.md](references/docker.md) | 所有容器化模块 | Dockerfile 规范：多阶段构建、层缓存顺序、非 root 用户、`.dockerignore`、必要注释 |

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
| [references/golang/go-security.md](references/golang/go-security.md) | 所有 Go 后端服务 | 安全：密钥、SQL 参数化、context 超时、SSRF/路径穿越、gosec/govulncheck、错误暴露 |

**参考配置**（normative 示例，非规范文档）：`references/golang/examples/` 存放 Go 后端的标准配置样例（`.air.toml`、`.golangci.yml`、`sqlc.yaml`）。采用 Go 技术栈时复制到服务仓库根目录；见 [go-tools.md](references/golang/go-tools.md) §2。

## 语言 / 框架专项规范

在通用规范之上扩展各技术栈。每个目录提供**四件套**：`-style`（风格与惯用法）、`-tools`（工具链）、`-testing`（测试）、`-security`（安全）。Go 见上方独立章节（更细的七篇）。

> **JavaScript 并入 `typescript/`**：JS ⊂ TS，`ts-style.md` 含「JavaScript 文件（JSDoc / 纯运行时）」子节，不单列 `javascript/`。

| 技术栈 | 目录 | 四件套 |
|---|---|---|
| Python | `references/python/` | [style](references/python/python-style.md) · [tools](references/python/python-tools.md) · [testing](references/python/python-testing.md) · [security](references/python/python-security.md) |
| TypeScript / JavaScript | `references/typescript/` | [style](references/typescript/ts-style.md) · [tools](references/typescript/ts-tools.md) · [testing](references/typescript/ts-testing.md) · [security](references/typescript/ts-security.md) |
| Rust | `references/rust/` | [style](references/rust/rust-style.md) · [tools](references/rust/rust-tools.md) · [testing](references/rust/rust-testing.md) · [security](references/rust/rust-security.md) |
| React | `references/react/` | [style](references/react/react-style.md) · [tools](references/react/react-tools.md) · [testing](references/react/react-testing.md) · [security](references/react/react-security.md) |
| Flutter / Dart | `references/flutter/` | [style](references/flutter/flutter-style.md) · [tools](references/flutter/flutter-tools.md) · [testing](references/flutter/flutter-testing.md) · [security](references/flutter/flutter-security.md) |

React 建在 TypeScript 之上，其文档相对互链 `references/typescript/`。

## 相关 Skill

- 规约驱动开发流程（spec-first、spec 划分/所有权、跨模块 plan 拆分、spec 索引维护）属于 polyrepo 工作区规范，见各项目 `<project>-spec-center/AGENTS.md`（由 `agents-scaffold` 模板生成）；本 skill 的 [references/testing.md](references/testing.md) 承载其实现阶段的 TDD workflow 与测试细则。
- 工程行为规范（think-before-code、simplicity-first、surgical-changes、root-cause reasoning 等 LLM/agent 编码行为准则）不在本 skill 内，见独立 skill **`engineering-guidelines`**。
