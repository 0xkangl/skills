# Go Project Structure Convention v1.0

> Applies to: All Go backend services | Goal: Organize code by business capability, keep package boundaries explicit, and grow the structure only when needed

默认按业务能力组织：**每个业务模块一个 Go package，包内按文件区分 HTTP、业务逻辑与数据访问职责。** 本文的“模块”指业务边界，不是 Go module；一个服务通常仍只有一个 `go.mod`。

## 目录

- [Package Boundaries](#package-boundaries)
- [Directory Structure](#directory-structure)
- [Module Internals](#module-internals)
- [Cross-Module Dependencies](#cross-module-dependencies)
- [Transactions](#transactions)
- [Server Lifecycle and Routing](#server-lifecycle-and-routing)
- [When to Split a Package](#when-to-split-a-package)
- [Migration from Layer Packages](#migration-from-layer-packages)
- [Related Conventions](#related-conventions)

## Package Boundaries

| 组织方式 | 取舍 | 本规范选择 |
|---|---|---|
| 全局 `handler` / `service` / `repository` 包 | 单个功能散落多个包；包边界表达技术职责，难以限制业务之间的耦合 | 不作为新代码的默认布局 |
| `user/handler` / `user/service` / `user/repository` 子包 | 业务聚合，但每个功能仍需维护多组包接口与类型流转 | 有实际隔离需求时局部采用 |
| `user` / `order` 业务包，包内按文件分职责 | 功能聚合、减少无意义导出；包内职责边界依靠设计、测试和评审维护 | **默认方案** |

- 按共同维护的业务规则、用例和数据所有权划分包，如 `user`、`order`、`inventory`；不按数据库表、单条接口或每个 CRUD 动作机械建包。
- 使用简短、有意义的小写包名；默认直接放在 `internal/<业务名>/`，不额外套没有独立作用的 `modules/`、`domains/` 层。
- 服务实现和服务内复用组件默认放在 `internal/`。`internal` 的导入范围由 Go 工具链限制在其父目录树内；根级 `internal/` 适合服务私有实现。
- `pkg/` 没有特殊的可见性语义，也不是“可能复用”的组件收纳箱。只有明确提供给其它项目、愿意维护公共 API 的库才考虑公开包；已有公共包保留其兼容性承诺。
- 小服务只建实际需要的包和文件；目录树是示例，不是必须生成的空目录清单。

该默认方案是本规范的架构选择。Go 官方并未规定唯一的服务分层布局；参考 [Organizing a Go module](https://go.dev/doc/modules/layout) 的 `cmd/`、`internal/` 指引，以及 [Package names](https://go.dev/blog/package-names) 对包职责、命名和避免大杂烩包的说明。

## Directory Structure

```text
{{PROJECT}}-server/
├── cmd/server/main.go          # 启动入口、进程信号与资源退出
├── internal/
│   ├── user/                   # 同目录业务文件均为 package user
│   │   ├── model.go            # 业务实体、值对象、用例输入/结果
│   │   ├── handler.go          # HTTP 适配、私有请求/响应 DTO
│   │   ├── routes.go           # 本模块的路由注册（较少时并入 handler.go）
│   │   ├── service.go          # 用例、业务规则、消费方接口
│   │   ├── repository.go       # Postgres/sqlc 适配及数据映射
│   │   ├── handler_test.go
│   │   └── service_test.go
│   ├── order/                  # 同样按业务聚合，不再拆三层子包
│   │   └── ...
│   ├── config/                 # 配置读取与校验
│   ├── db/                     # 使用 sqlc 时的生成代码；不手改
│   ├── database/               # 数据库连接与事务基础设施
│   ├── apperror/               # 统一错误载体与错误码
│   ├── response/               # 统一 HTTP 响应
│   ├── validator/              # chi 项目的结构体校验
│   ├── httpx/                  # 确有多模块复用时的 HTTP 辅助函数
│   ├── middleware/             # 认证、请求日志、panic recovery
│   └── server/                 # 装配入口：构造依赖、HTTP 生命周期
│       ├── server.go
│       └── routes.go
├── db/
│   ├── migrations/             # 统一排序的 SQL migrations
│   └── queries/                # 按业务分文件，如 users.sql、orders.sql
├── tests/
│   ├── integration/            # build tag: integration
│   └── e2e/                    # build tag: e2e
├── docs/
│   ├── specs/
│   └── plans/
├── go.mod
├── go.sum
├── Makefile
├── .air.toml                   # 采用 air 时配置
├── .golangci.yml
├── sqlc.yaml                   # 采用 sqlc 时配置
├── .env.example
├── .gitignore
├── AGENTS.md
├── CLAUDE.md
└── README.md
```

公共基础设施按具体能力命名，不建全局 `model`、`types`、`interfaces`、`common` 或 `utils` 包。上面的 `db` 是生成代码边界，`database` 是连接等运行时基础设施，二者职责不同。

## Module Internals

### 职责与类型归属

| 文件 / 角色 | 责任 | 依赖边界 |
|---|---|---|
| `handler.go` | HTTP 解析、格式校验、身份信息提取、响应序列化 | 调用用例；不直接访问存储 |
| `service.go` | 业务校验、授权规则、用例编排、确定事务边界 | 依赖所需的小接口；不感知路由框架、HTTP 请求或 sqlc 类型 |
| `repository.go` | 查询、数据库错误转换、持久化类型与业务类型映射 | 使用 `internal/db` / 驱动；不调用 handler 或反向调用业务用例 |
| `model.go` | 本模块的实体、值对象、用例输入和结果 | 不混入路由框架与数据库生成类型 |

- 保留 `handler → service → repository` 的逻辑调用方向；这些名称表示职责，**不要求三个 package，也不要求每层都声明接口**。只有转发、没有独立职责的类型不必为了凑层数创建。
- HTTP 专用 DTO 默认不导出，放在 `handler.go`，较多时拆 `dto.go`；用例参数按业务语义定义。字段恰好相同、被多层使用，都不是建立全局 DTO 包的理由。
- sqlc 行类型与参数类型只在存储适配和必要的装配代码中使用；模块对外 API 使用本模块的业务类型。已有业务类型适合直接序列化且无敏感字段时，无需机械复制一份响应 DTO。
- 对外仅导出装配和其它调用方实际需要的符号，如 `Service`、`Handler`、`NewService`、`NewHandler`、`NewPostgresStore`。内部字段、辅助函数和 DTO 保持私有；避免 `user.UserService`、`user.UserRepository` 等重复前缀。
- 包内文件没有访问隔离：`handler.go` 技术上可以访问同包私有存储字段。通过字段依赖、测试和评审维护边界；需要编译期隔离时按下文拆包。

### 接口与装配

接口放在消费方附近，以实际调用的方法为准（参考 [Go Code Review Comments — Interfaces](https://go.dev/wiki/CodeReviewComments#interfaces)）。例如 `user/service.go` 中：

```go
package user

import "context"

// User 定义在同包 model.go；此处只展示依赖边界。
type store interface {
	FindByID(ctx context.Context, id int64) (*User, error)
}

// Service 承载用户用例。
type Service struct {
	store store
}

// NewService 注入用户用例所需的存储能力。
func NewService(store store) *Service {
	return &Service{store: store}
}
```

- `repository.go` 提供满足该接口的具体实现；不导出包含所有表操作的大接口。构造函数返回具体类型，装配方可以把它传给上述私有接口，无需命名该接口。
- handler 可直接依赖 `*Service`；确有替换用例或独立测试 HTTP 适配的需要时，再在 `handler.go` 定义所需接口。
- 不传递整个 `Server`、全局容器或配置对象来隐藏依赖。共享的 JSON 绑定等 HTTP 辅助能力放在 `internal/httpx` 并按需导出（如 `httpx.BindJSON`），不能依赖原 `handler` 包内的私有函数仍然跨包可见。

## Cross-Module Dependencies

- 每个模块拥有自己的业务规则与写入入口。其它模块调用其用例 API，不直接使用其存储实现，不绕过所有者更新其数据。
- 依赖保持单向且无环。稳定业务类型可由所有者包导出并被调用方导入；不要为了消除一次 import 把所有实体搬到全局 `model` 包。
- 需要减少两个模块的耦合时，消费方声明小接口，由 `internal/server` 装配具体服务。比如 `order` 只声明 `IsActive(context.Context, int64) (bool, error)`，`user.Service` 满足它；`user` 无需导入 `order`。
- 小接口的签名也会产生依赖：若 `order` 接口返回 `user.User`，它仍需导入 `user`。需要彻底隔离时，使用稳定值类型，或由装配层的适配器转换为消费方类型；不要让 `user` 为此反向导入 `order`。
- 涉及多个模块的独立业务流程，可按需增加具名编排包，如 `internal/checkout`，由它依赖相关用例接口。相关模块不反向导入编排包；不要创建无业务含义的全局 `service` 包接管所有用例。
- 出现环依赖时，先检查业务边界、类型所有权与编排位置；不要用全局变量、运行时服务定位器或把类型塞入 `common` 来绕过。
- 模块边界不要求查询机械拆分；跨表只读投影可按用例放在查询所属模块中，避免为一次列表查询逐条调用其它服务。

## Transactions

- **用例决定原子性，存储实现执行事务。** 单模块可由一个表达业务意图的存储方法完成原子写入，或在确需多步编排时使用消费方定义的事务能力；不默认引入通用 Unit of Work 框架。
- 同一事务的所有查询使用同一个事务连接；sqlc 通过 `Queries.WithTx(tx)` 绑定（见 [sqlc 事务文档](https://docs.sqlc.dev/en/stable/howto/transactions.html)）。不能开启事务后仍调用绑定连接池的 repository，并误以为这些调用在事务内。
- 跨模块必须原子提交时，由拥有该流程的编排层协调事务能力，装配层提供绑定同一事务的存储与用例供流程使用；普通的服务串行调用不会自动形成事务。驱动事务类型留在存储/装配边界，不进入 HTTP DTO 或业务实体。
- 数据一致性边界长期跨越多个模块时，重新评估模块划分；跨数据库或外部服务的流程不能靠本地 SQL 事务保证原子性。只有业务确需时再设计补偿、outbox 等机制。

## Server Lifecycle and Routing

`cmd/server/main.go`：读取配置 → 初始化基础设施 → 构造 Server → 监听退出信号 → 启动并执行有超时的优雅关闭；数据库等资源由创建方在请求处理结束后释放。

`internal/server` 是装配入口，负责按依赖顺序连接模块，不承载业务规则：

- `New(...)` 接收配置和已初始化的基础设施，构造各模块的存储、服务和 handler，注册路由。
- `Start(addr)` 启动 HTTP 服务；`Shutdown(ctx)` 停止接收新请求并等待在途请求结束，调用方处理启动失败和关闭超时。
- `server/routes.go` 管理全局中间件、`/v1` 前缀和模块挂载；模块的 `routes.go` 管理自己的具体路径。不得让业务包反向导入 `server`。

装配示意（按项目路由框架调整注册签名）：

```go
store := user.NewPostgresStore(pool)
svc := user.NewService(store)
handler := user.NewHandler(svc)
handler.RegisterRoutes(api) // api 已挂载 /v1 前缀
```

- 中间件顺序：全局 → 路由组 → 单路由；跨模块共享的认证、日志和 recovery 放在 `internal/middleware`，业务授权仍由用例负责。
- `/health` 不加版本前缀；`/metrics` 的 `METRICS_PORT` 行为见 [HTTP Constitution](../http-constitution.md) §9。
- 请求日志与 traceId 见 [Observability Convention](../observability.md)；输入校验见 [Go Validation Convention](go-validation.md)；错误响应由 `response.Error()` 统一写出，见 [Go Error Handling Convention](go-error-handling.md)。

## When to Split a Package

每模块一包是起点，不是永久限制。文件变多时先按用例或能力拆文件（如 `register.go`、`password.go`），再根据实际边界拆包：

| 实际信号 | 处理方式 |
|---|---|
| 包内有独立的业务规则、数据所有权和变更节奏 | 拆成新的业务包；不以文件行数作为阈值 |
| HTTP / gRPC / 存储适配需独立演进，或 CLI / worker 需复用业务而不引入 HTTP 依赖 | 保留核心 `user` 包，按需拆 `userhttp`、`userpostgres` 等适配包 |
| 安全边界或团队维护需要编译器强制限制职责间访问 | 明确核心包与适配包的公开契约，接受额外接口和映射成本 |

适配包导入核心包，核心包不导入适配包，由 `server` 装配；例如 `userhttp → user ← userpostgres`。单包时包内所有源码的依赖会计入整个包，不能因为 HTTP 代码只在 `handler.go` 就宣称其它调用方无需承担其框架依赖。子目录也是独立 package，不会自动共享父包的私有符号。

## Migration from Layer Packages

1. 按一个完整业务能力迁移：把原 handler、service、repository 及相关 `model` 类型移入 `internal/<业务名>/`，保留职责与对外 HTTP 行为。
2. 更新 package、import 和构造函数；合并同包后重名的类型/辅助函数，收紧不再需要的导出。共享 HTTP 辅助函数单独归属，避免每个模块复制一份。
3. 在模块消费方定义所需的小接口，更新 `server` 装配；拆除循环依赖及跨模块直接写库的路径，核对事务绑定。
4. 将单元测试与源码一起移动，更新包路径、mock 和覆盖率命令；按 [Go Testing Convention](go-testing.md) 运行受影响测试，并验证原有 HTTP 契约和持久化行为。
5. 全部调用方迁移后再删除对应旧声明；最后一个模块迁完才删除旧全局层包和全局 `model` 包。已有公共 `pkg/` API 的迁移单独评估兼容性，不夹带在目录搬迁中。

## Related Conventions

| Topic | Document |
|---|---|
| Go style, naming, idioms | [go-style.md](go-style.md) |
| Dev tools, sqlc, Makefile targets | [go-tools.md](go-tools.md) |
| Testing layout and package tests | [go-testing.md](go-testing.md) |
| Error flow and response boundary | [go-error-handling.md](go-error-handling.md) |
| Input validation | [go-validation.md](go-validation.md) |
| Structured logging | [observability.md](../observability.md) |
| HTTP API design | [http-constitution.md](../http-constitution.md) |
