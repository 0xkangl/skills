# React Style Convention v1.0

> Applies to: 所有 React 组件与 Hook | Goal: 写出可组合、可预测的函数组件——props 类型清晰、Hooks 规范、状态就近、列表 key 稳定

For the full convention index, see [../../SKILL.md](../../SKILL.md).

React 建在 TypeScript 之上，本篇在 [ts-style.md](../typescript/ts-style.md) 与通用 [coding-style.md](../coding-style.md) / [patterns.md](../patterns.md) 之上扩展。工具见 [react-tools.md](react-tools.md)，测试见 [react-testing.md](react-testing.md)，安全见 [react-security.md](react-security.md)。

## 1. File & Naming

- 含 JSX 的文件用 `.tsx`；纯逻辑 / 自定义 Hook / 类型用 `.ts`；测试 `*.test.tsx` 与源文件镜像。
- 组件 `PascalCase`（符号与文件名一致：`UserCard.tsx`）。
- 自定义 Hook `useCamelCase`（`useDebounce`）。
- 事件处理器组件内叫 `handleClick` / `handleSubmit`，接收它的 prop 叫 `onClick` / `onSubmit`。
- 布尔 prop 用 `isLoading` / `hasError` / `canSubmit`，不用裸 `loading` / `error`。

## 2. Component Shape

```tsx
type Props = {
  user: User;
  onSelect: (id: string) => void;
};

export function UserCard({ user, onSelect }: Props) {
  return (
    <button type="button" onClick={() => onSelect(user.id)}>
      {user.name}
    </button>
  );
}
```

- 函数组件，闭合 prop 形状用 `type Props = {}`；仅在需声明合并 / 公共扩展点时用 `interface`。
- 参数列表里解构 props，组件体内不写 `props.xxx`。
- 不用 `React.FC`；返回类型交给 JSX 推断。
- **新代码禁用 class 组件**；触碰旧 class 组件做非平凡改动时转为函数组件。

## 3. JSX

- 无子节点自闭合：`<img />`、`<UserCard user={u} />`。
- 不需要 DOM 元素时用 fragment `<>…</>`，不套多余 `<div>`。
- 条件渲染：布尔用 `{cond && <Foo />}`，二选一用三元，卫语句用早返回。
- 多行逻辑抽到 return 上方的 const / 函数，不内联进 JSX。

## 4. Hooks Discipline

- 自定义 Hook 必须 `use` 开头（`eslint-plugin-react-hooks` 强制）。
- 所有 Hook 调用集中在组件顶部、任何条件逻辑之前——不在条件 / 循环里调 Hook。
- 不为一行包装造 Hook；直接内联。
- 正确声明依赖数组，让 lint 规则把关。

## 5. State Location

就近原则，按决策树选位置（见 [patterns.md](../patterns.md)）：

1. 单组件用 → `useState`。
2. 父 + 少数子用 → 提升到最近公共祖先，props 下传。
3. 跨远端分支、低频读 → React Context（theme / auth / locale），**不**用于高频更新。
4. 高频共享 / 跨路由持久 → 外部 store（Zustand / Jotai / Redux Toolkit）。
5. 服务端派生数据 → server-state 库（TanStack Query / SWR / RSC），**不**当应用状态。

**绝不**复制可派生的状态——渲染时计算。Context 误用于高频值会让每个消费者每次更新都重渲染。

## 6. Performance

- 列表 `key` 必须跨渲染稳定且兄弟间唯一；**绝不**对可重排 / 增删的列表用数组 index 作 key。
- `memo` / `useMemo` / `useCallback` 用于实测的重渲染热点，不预防式滥用。
- 派生数据渲染时计算，不塞进 state 再同步。

## 7. Composition over Inheritance

- 用 `children` 做插槽式组合；render-prop / 组件类型 prop 做参数化渲染（`renderItem={UserRow}`）。
- 相关控件（Tabs / Accordion）用 compound component + Context 共享状态。
- 模态 / tooltip / toast 用 `createPortal` 逃出父级 `overflow` / `z-index`。
- **绝不**继承组件类来特化行为。

## 8. Data Fetching & Boundaries

- 优先用 server-state 库（TanStack Query / SWR）或 RSC `await`；**避免**在 `useEffect` 里 `fetch`（竞态、无缓存、无重试）。
- 每个 `Suspense` 边界上方配 Error Boundary，成对处理加载与错误；边界就近放数据需要处。
- Next.js App Router：新文件默认 Server Component，仅在用 state/effect/ref/浏览器 API/事件处理时加 `"use client"`（置于文件首行）。

## 9. Forms

- 有明确提交步骤的表单优先非受控 + form action（浏览器持有值，提交时经 `FormData` 读）。
- 值驱动其它 UI / 需实时校验 / 格式化时用受控输入。
- 复杂表单（多步、动态字段、跨字段校验）用库（React Hook Form / TanStack Form）。

## 10. Checklist

- [ ] 函数组件，props 解构 + `type Props`，无 class 组件、无 `React.FC`。
- [ ] Hook 集中在顶部、`use` 开头、依赖数组正确。
- [ ] 状态就近，不复制可派生状态，Context 不用于高频。
- [ ] 列表 key 稳定唯一，非 index；memo 仅用于实测热点。
- [ ] 组合优于继承；数据获取用 server-state 库，避免 `useEffect` fetch。
- [ ] Suspense 配 Error Boundary；RSC 边界 `"use client"` 用对。
