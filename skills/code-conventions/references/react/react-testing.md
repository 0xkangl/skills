# React Testing Convention v1.0

> Applies to: 所有 React 组件与 Hook | Goal: 测「用户所见所做」而非实现细节——RTL 查询优先可访问性，网络用 MSW，避免组件快照

For the full convention index, see [../../SKILL.md](../../SKILL.md).

在 [ts-testing.md](../typescript/ts-testing.md) 与通用 [testing.md](../testing.md) 之上扩展 React 专项。

## 1. Library Choice

- **React Testing Library (RTL)**：组件测试标准，经渲染后的 DOM 测行为。
- **Vitest**：Vite 项目首选运行器；**Jest**：Next/CRA 项目，RTL 用法一致。
- 一个仓库选一种组件测试运行器，不混用。

## 2. Core Principle

**测用户所见所做，不测实现细节。**

- 不断言内部 state、传给子组件的 props、调了哪个 Hook。
- 重构不破坏测试 = 测的是行为——这正是目标。

## 3. Query Priority

按可访问性优先级自上而下选 query：

1. **人人可及**：`getByRole(role, { name })`（首选）、`getByLabelText`（表单）、`getByText`（非交互文本）。
2. **语义**：`getByAltText`（图片）、`getByTitle`。
3. **测试 ID**：`getByTestId`——仅当前两类都不适用时的逃生口。

`getBy*` 无匹配即抛错；`queryBy*` 返回 null（断言不存在用）；`findBy*` 返回 Promise（异步用）。

## 4. User Interaction

优先 `userEvent` 而非 `fireEvent`——前者模拟真实浏览器事件序列：

```tsx
import userEvent from '@testing-library/user-event'

test('submits the form', async () => {
  const user = userEvent.setup()
  render(<UserForm onSubmit={handleSubmit} />)

  await user.type(screen.getByLabelText('Email'), 'user@example.com')
  await user.click(screen.getByRole('button', { name: /save/i }))

  expect(handleSubmit).toHaveBeenCalledWith({ email: 'user@example.com' })
})
```

- `userEvent` 调用都要 `await`；每测开头 `userEvent.setup()` 一次后复用。

## 5. Async Assertions

```tsx
// 异步出现的内容用 findBy*（返回 Promise、自动重试）
expect(await screen.findByText('Loaded')).toBeInTheDocument()

// 非元素断言用 waitFor
await waitFor(() => expect(saveSpy).toHaveBeenCalled())
```

绝不 `setTimeout` + 断言——必然 flaky。

## 6. Network Mocking — MSW

任何打到网络边界的测试用 **Mock Service Worker**，在网络层拦截：

```tsx
const server = setupServer(
  http.get('/api/users/:id', ({ params }) =>
    HttpResponse.json({ id: params.id, name: 'Alice' })),
)
beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
```

单测内用 `server.use(...)` 覆盖特定场景（如 500）。

## 7. Custom Hook Testing

```tsx
import { renderHook, act } from '@testing-library/react'

test('useCounter increments', () => {
  const { result } = renderHook(() => useCounter())
  act(() => result.current.increment())
  expect(result.current.count).toBe(1)
})
```

改状态的调用包在 `act` 里；只测 Hook 的公共 API，不碰内部实现。

## 8. Accessibility Assertions

```tsx
import { axe } from 'vitest-axe'   // 或 jest-axe

test('UserCard has no a11y violations', async () => {
  const { container } = render(<UserCard user={mockUser} />)
  expect(await axe(container)).toHaveNoViolations()
})
```

## 9. Setup Helpers

把 Provider 包一次，从 `test-utils.tsx` 导出复用：

```tsx
function renderWithProviders(ui: React.ReactElement) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <ThemeProvider theme={lightTheme}>{ui}</ThemeProvider>
    </QueryClientProvider>,
  )
}
```

## 10. Avoid Component Snapshots

渲染输出快照脆弱、难 review、易被橡皮图章。仅用于纯数据序列化。组件视觉回归用 Playwright / Cypress 截图，做真实视觉 diff 而非 DOM diff。

## 11. Coverage Targets

| 层 | 目标 |
|---|---|
| 纯工具函数 | ≥ 90% |
| 自定义 Hook | ≥ 85% |
| 展示型组件 | ≥ 80%（测行为非行数） |
| 容器组件 | ≥ 70%（黄金路径 + 错误态） |
| 页面 | 每路由至少冒烟（E2E 单独覆盖） |

## 12. Anti-Patterns

- 断言 `container.querySelector`——绕过可访问性查询。
- 断言渲染次数——实现细节。
- mock React Hook / 默认 mock 子组件——应重构组件而非 mock。
- 忽略 `act()` 警告——它们提示真实 bug。

## 13. Checklist

- [ ] 测行为非实现；query 按 role→label→text→testid 优先。
- [ ] 交互用 `userEvent` 并 `await`；异步用 `findBy*` / `waitFor`。
- [ ] 网络边界用 MSW；Hook 用 `renderHook` + `act`。
- [ ] 跑 axe 做 a11y 断言；Provider 经 test-utils 复用。
- [ ] 不用组件快照；覆盖率按层达标。
