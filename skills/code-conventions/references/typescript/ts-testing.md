# TypeScript / JavaScript Testing Convention v1.0

> Applies to: 所有 TypeScript 与 JavaScript 模块 | Goal: 用 Vitest/Jest 写确定性、隔离测试，网络边界用 MSW，关键流程用 Playwright

For the full convention index, see [../../SKILL.md](../../SKILL.md).

在通用 [testing.md](../testing.md) 之上扩展。React 组件测试见 [react-testing.md](../react/react-testing.md)。

## 1. Framework

- **Vitest**：新项目首选——快、原生 ESM、与 Jest API 兼容。
- **Jest**：既有项目沿用即可，API 基本一致。
- 一个仓库选定一种单测运行器，不混用。

## 2. Structure (AAA)

```typescript
import { describe, it, expect } from 'vitest'

describe('calculateTotal', () => {
  it('applies discount to cart total', () => {
    // Arrange
    const cart = { items: [{ price: 100 }, { price: 50 }] }
    // Act
    const total = calculateTotal(cart, 0.1)
    // Assert
    expect(total).toBe(135)
  })
})
```

- 一测一行为；`it` / `test` 名描述期望行为。
- 文件就近放（`*.test.ts`）或 `__tests__/`，与源码同构。

## 3. Mocking Philosophy

- 优先真实对象 / 内存 fake，mock 只用于外部边界。
- 用 `vi.fn()` / `vi.mock()`（Jest 对应 `jest.fn` / `jest.mock`）。
- 不 mock 被测对象内部实现；时间用 `vi.useFakeTimers()`。

## 4. Network Boundary — MSW

任何打到网络边界的测试用 **Mock Service Worker**，在网络层拦截，让 fetch / 客户端表现与生产一致：

```typescript
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'

const server = setupServer(
  http.get('/api/users/:id', ({ params }) =>
    HttpResponse.json({ id: params.id, name: 'Alice' }),
  ),
)

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
```

不用手写 `fetch` mock——MSW 更贴近真实、可复用。

## 5. E2E

- 关键用户流程用 **Playwright** 做端到端测试，覆盖跨页面交互与真实浏览器行为。
- E2E 独立于单测运行，CI 分阶段执行；只覆盖关键路径，不替代单测。

## 6. Coverage & Determinism

```bash
vitest run --coverage
```

- 业务逻辑覆盖率目标 ≥ 80%，关注分支与异常路径。
- 测试不依赖时钟 / 随机 / 外部状态；无共享可变状态、无顺序依赖。

## 7. Checklist

- [ ] 用 Vitest/Jest，一仓一种运行器，遵循 AAA。
- [ ] mock 仅限外部边界，不 mock 内部实现。
- [ ] 网络边界用 MSW，不手写 fetch mock。
- [ ] 关键流程有 Playwright E2E，独立运行。
- [ ] 覆盖分支与异常路径，无时钟 / 随机依赖。
