# React Tooling Convention v1.0

> Applies to: 所有 React 项目 | Goal: 在 TS 工具链之上补 React 专属的构建、lint 与测试工具配置

For the full convention index, see [../../SKILL.md](../../SKILL.md).

React 共用 TypeScript 工具链——tsconfig / Prettier / 包管理见 [ts-tools.md](../typescript/ts-tools.md)。本篇只补 React 专属部分。

## 1. Build Tooling

| 场景 | 工具 |
|---|---|
| SPA / 库 | **Vite**（快、原生 ESM、Fast Refresh） |
| SSR / 全栈 | **Next.js**（App Router）/ Remix |
| 测试运行器 | **Vitest**（配 Vite）/ Jest（配 Next/CRA） |

- 新 SPA 用 Vite；新全栈应用用 Next.js App Router。
- 利用 **Fast Refresh** 保持组件状态热更新——保持组件纯净（顶层只导出组件）以免热更新失效。

## 2. ESLint for React

在 TS ESLint 基础上加 React 专属插件：

```js
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

export default [
  {
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,   // Hook 规则 + 依赖数组校验
      'react-refresh/only-export-components': 'warn',
    },
  },
]
```

- `eslint-plugin-react-hooks` 强制 Hook 调用规则与 `exhaustive-deps`。
- 新项目用 React 19+ 的新 JSX transform，无需 `import React`。

## 3. Test Setup

- 组件测试用 **React Testing Library** + Vitest/Jest，配 `jsdom` 环境。
- 网络边界用 **MSW**；详见 [react-testing.md](react-testing.md)。
- 在 setup 文件统一引入 `@testing-library/jest-dom` 匹配器。

```ts
// vitest.config.ts
export default defineConfig({
  test: { environment: 'jsdom', setupFiles: ['./src/test-setup.ts'] },
})
```

## 4. Checklist

- [ ] TS 工具链遵循 ts-tools.md；本项目按场景选 Vite / Next。
- [ ] ESLint 启用 react-hooks（含 exhaustive-deps）与 react-refresh 规则。
- [ ] 组件纯净以保 Fast Refresh 生效。
- [ ] 测试环境 jsdom + RTL + jest-dom 匹配器，网络用 MSW。
