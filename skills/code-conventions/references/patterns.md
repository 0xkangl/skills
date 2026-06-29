# Design Patterns Convention v1.0

> Applies to: 所有模块（与语言无关） | Goal: 统一几个高频结构模式——数据访问、服务分层、依赖注入、响应封套——的形态，让各语言实现保持一致心智模型

For the full convention index, see [../SKILL.md](../SKILL.md).

本篇只讲**语言无关**的结构模式与其落地约定。语言专属惯用法（Go functional options、Rust newtype/builder、Python Protocol 等）见各 `references/<lang>/<lang>-style.md`。HTTP 响应的字段与状态码以 [http-constitution.md](http-constitution.md) 为准，错误信封以 [error-codes.md](error-codes.md) 为准——本篇不与其冲突，只描述代码内部结构。

## 1. Layered Architecture

请求自外向内单向依赖，内层不感知外层：

```
handler / controller   ← 解析请求、调用 service、装配响应
      ↓
service / use-case     ← 业务逻辑编排、事务边界
      ↓
repository             ← 数据访问（DB / 缓存 / 外部 API）
```

- 业务逻辑集中在 service 层，handler 只做请求/响应转换，repository 只做存取。
- 依赖方向只能由外向内；repository 不调 service，service 不感知 HTTP。

## 2. Repository Pattern

把数据访问封装在一致的接口之后，业务逻辑只依赖接口、不依赖具体存储：

- 定义标准操作：`findById` / `findAll` / `create` / `update` / `delete`。
- 具体实现处理存储细节（Postgres / Redis / HTTP / 内存）。
- 业务层依赖**抽象接口**，便于替换数据源、用内存实现做测试。

```ts
interface UserRepository {
  findById(id: string): Promise<User | null>;
  save(user: User): Promise<User>;
  delete(id: string): Promise<void>;
}
// 业务层只见 UserRepository；PostgresUserRepository / InMemoryUserRepository 各自实现
```

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
- [ ] 数据访问经 repository 接口，业务层不依赖具体存储。
- [ ] 依赖经构造函数 / 入参注入，无内部硬构造或隐式全局。
- [ ] 对外响应用统一封套，字段 / 错误码遵循 http-constitution.md 与 error-codes.md。
- [ ] 有限状态用类型建模并穷尽处理。
