# TypeScript / JavaScript Style Convention v1.0

> Applies to: 所有 TypeScript 与 JavaScript 模块 | Goal: 用类型表达契约、避免 `any`、保持不可变，写出类型安全且地道的 TS/JS 代码

For the full convention index, see [../../SKILL.md](../../SKILL.md).

在通用 [coding-style.md](../coding-style.md) 与 [patterns.md](../patterns.md) 之上扩展。本目录覆盖 **TypeScript 与 JavaScript**（JS ⊂ TS，§7 列 JS 专属约定）。工具见 [ts-tools.md](ts-tools.md)，测试见 [ts-testing.md](ts-testing.md)，安全见 [ts-security.md](ts-security.md)。

## 1. Types on Public APIs

- 导出函数、共享工具、公共类方法 MUST 标注参数与返回类型。
- 局部显而易见的变量交给类型推断，不冗余标注。
- 重复出现的内联对象形状抽成具名 `type` / `interface`。

```typescript
interface User {
  firstName: string
  lastName: string
}

export function formatUser(user: User): string {
  return `${user.firstName} ${user.lastName}`
}
```

## 2. interface vs type

- `interface`：对象形状、可被扩展 / 实现的契约。
- `type`：联合、交叉、元组、映射类型、工具类型。
- 字面量联合优于 `enum`（除非需与外部互操作）：`type Role = 'admin' | 'member'`。

## 3. Avoid `any`

- 应用代码**避免** `any`——它关闭类型检查。
- 外部 / 不可信输入用 `unknown`，再安全收窄。
- 类型随调用者变化时用泛型。

```typescript
// Bad
function getErrorMessage(error: any) { return error.message }

// Good
function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unexpected error'
}
```

## 4. Immutability

用 spread 做不可变更新，入参用 `Readonly` 表达不修改：

```typescript
function updateUser(user: Readonly<User>, name: string): User {
  return { ...user, name }
}
```

- 常量数据用 `as const`；只读集合用 `ReadonlyArray<T>` / `readonly T[]`。
- 不原地 `push` / 改写入参；返回新数组 / 对象。

## 5. Error Handling

`async/await` + `try/catch`，把 `unknown` 错误安全收窄：

```typescript
async function loadUser(id: string): Promise<User> {
  try {
    return await fetchUser(id)
  } catch (error: unknown) {
    logger.error('load user failed', error)
    throw new Error(getErrorMessage(error))
  }
}
```

- `catch` 变量类型是 `unknown`，先 `instanceof Error` 再用。
- 不吞错；需换语义时包装并保留 `cause`：`new Error(msg, { cause: error })`。

## 6. Modules & Misc

- 用 ESM `import` / `export`；优先具名导出，避免无意义 default 导出。
- 生产代码**无 `console.log`**，用结构化日志库（见 [observability.md](../observability.md)）。
- 用 `===` / `!==`，不用 `==`；用 `const` 优先、`let` 次之，禁 `var`。
- 可空访问用可选链 `?.` 与空值合并 `??`。

## 7. JavaScript 文件（JSDoc / 纯运行时）

`.js` / `.jsx` 文件（无法迁移 TS 时）：

- 用 **JSDoc** 在关键边界补类型，提升可读性与 IDE 提示；保持与运行时行为一致。
- 启用 `// @ts-check` 让 tsc 校验 JSDoc 类型。
- 其余风格（命名、不可变、错误处理、无 `console.log`）与 TS 一致。

```javascript
// @ts-check
/**
 * @param {{ firstName: string, lastName: string }} user
 * @returns {string}
 */
export function formatUser(user) {
  return `${user.firstName} ${user.lastName}`
}
```

## 8. Checklist

- [ ] 导出 API 标注参数 / 返回类型；局部交给推断。
- [ ] 用 `interface`/`type` 区分得当，字面量联合优于 `enum`。
- [ ] 应用代码无 `any`，外部输入用 `unknown` 收窄。
- [ ] 不可变更新（spread / `Readonly` / `as const`），不改写入参。
- [ ] `catch (e: unknown)` 安全收窄，不吞错。
- [ ] ESM 具名导出，无 `console.log`，用 `===` / `const`。
- [ ] `.js` 文件用 JSDoc + `@ts-check`。
