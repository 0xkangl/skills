# Design Patterns Convention v1.0

> Applies to: 所有模块（与语言无关） | Goal: 统一几个高频结构模式——数据访问、服务分层、依赖注入、响应封套——的形态，让各语言实现保持一致心智模型

For the full convention index, see [../SKILL.md](../SKILL.md).

本篇只讲**语言无关**的结构模式与其落地约定。语言专属惯用法（Go functional options、Rust newtype/builder、Python Protocol 等）见各 `references/<lang>/<lang>-style.md`。HTTP 响应的字段与状态码以 [http-constitution.md](http-constitution.md) 为准，错误信封以 [error-codes.md](error-codes.md) 为准——本篇不与其冲突，只描述代码内部结构。

## 1. Layered Architecture

请求自外向内单向依赖，内层不感知外层：

```
handler / controller   ← 解析请求、调用 service、装配响应、响应缓存
      ↓
service / use-case     ← 业务逻辑编排、事务边界、业务缓存
      ↓
repository             ← 数据访问（DB / 外部 API，不使用缓存）
```

- 业务逻辑集中在 service 层，handler 负责请求/响应转换及响应缓存，repository 只做数据源存取。
- 依赖方向只能由外向内；repository 不调 service，service 不感知 HTTP。

这里的“层”指逻辑职责，不要求分别建立同名包或目录。Go 默认按业务模块建包、包内按文件区分职责，见 [Go 项目结构](golang/go-project.md)。

## 2. Repository Pattern

把数据访问封装在一致的接口之后，业务逻辑只依赖接口、不依赖具体存储：

- 定义标准操作：`findById` / `findAll` / `create` / `update` / `delete`。
- 具体实现处理数据源细节（Postgres / HTTP / 内存）；Redis 用作主存储时属于数据源，用作缓存时遵循下述层级约束。
- 业务层依赖**抽象接口**，便于替换数据源、用内存实现做测试。

```ts
interface UserRepository {
  findById(id: string): Promise<User | null>;
  save(user: User): Promise<User>;
  delete(id: string): Promise<void>;
}
// 业务层只见 UserRepository；PostgresUserRepository / InMemoryUserRepository 各自实现
```

### 缓存边界

- 缓存使用放在 **handler / service 层**：handler 负责响应缓存，service 负责业务数据缓存；缓存命中、回源、写入与失效策略由对应层编排。
- **禁止在 repository 中使用缓存**，包括缓存读写、失效以及带缓存的 repository 包装器；repository 的查询结果直接来自其数据源，避免隐藏缓存一致性和事务语义。
- 缓存客户端或抽象通过依赖注入提供给 handler / service；可复用的缓存适配器只封装技术细节，不承载业务缓存策略。

## 3. Dependency Injection

依赖通过**构造函数 / 入参**注入，不在内部 `new` 出来或读全局单例：

```ts
// Good —— 依赖显式注入，可替换、可测
class UserService {
  constructor(private repo: UserRepository, private logger: Logger) {}
}

// Bad —— 内部硬构造，无法替换
class UserService {
  private repo = new PostgresUserRepository(); // 耦合具体实现
}
```

- 注入使依赖显式、可在测试中替换为 fake / mock。
- 避免服务定位器 / 隐式全局：依赖应从签名可见。

## 4. API Response Envelope

对外响应使用统一封套，前端有稳定契约：

- 成功 / 失败有一致结构与判别字段。
- 错误体含业务错误码 + 泛化 message + 可选 `details`（字段级信息）。
- 分页响应带元信息（`total` / `page` / `limit`）。

> 字段名、状态码、分页 / 排序 / 时间格式以 [http-constitution.md](http-constitution.md) 为单一真相；错误码段与 `{code, message, details}` 信封以 [error-codes.md](error-codes.md) 为准。本节只强调「全模块统一封套、不各写各的」这一约束。

## 5. Make Illegal States Unrepresentable

用类型表达约束，把错误挡在编译期而非运行期：

- 用枚举 / 联合类型建模有限状态（连接的 `Connecting` / `Connected` / `Failed`），穷尽处理每个分支。
- 用 newtype / 包装类型区分同底层类型的不同语义（`UserId` vs `OrderId`），防参数错位。
- 必填与可选在类型上区分，不靠运行时 `null` 检查兜底。

具体语法见各语言 style 文档（Rust enum/newtype、TS 字面量联合、Dart sealed class 等）。

## 6. Checklist

- [ ] 分层清晰，依赖单向由外向内；业务逻辑在 service 层。
- [ ] 数据源访问经 repository 接口；缓存仅在 handler / service 层使用，repository 不读写或失效缓存。
- [ ] 依赖经构造函数 / 入参注入，无内部硬构造或隐式全局。
- [ ] 对外响应用统一封套，字段 / 错误码遵循 http-constitution.md 与 error-codes.md。
- [ ] 有限状态用类型建模并穷尽处理。
