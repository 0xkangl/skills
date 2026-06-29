# TypeScript / JavaScript Tooling Convention v1.0

> Applies to: 所有 TypeScript 与 JavaScript 模块 | Goal: 统一 tsconfig、lint、格式化、构建与包管理，让类型与风格在本地与 CI 一致

For the full convention index, see [../../SKILL.md](../../SKILL.md).

风格见 [ts-style.md](ts-style.md)。本篇定工具链与配置。

## 1. Toolchain

| 关注点 | 工具 | 说明 |
|---|---|---|
| 类型检查 | **tsc** `--noEmit` | strict 全开，CI 阻断 |
| Lint | **ESLint**（flat config）或 **Biome** | 二选一；Biome 集 lint+format 更快 |
| 格式化 | **Prettier** 或 **Biome** | 与 lint 不冲突；统一一种 |
| 测试 | **Vitest**（新项目）/ Jest | 见 [ts-testing.md](ts-testing.md) |
| 包管理 | **pnpm**（推荐）/ npm | 锁文件入库；monorepo 用 workspace |

## 2. tsconfig strict

`tsconfig.json` MUST 开启 strict 全家桶，把错误挡在编译期：

```jsonc
{
  "compilerOptions": {
    "strict": true,                       // 含 noImplicitAny、strictNullChecks 等
    "noUncheckedIndexedAccess": true,     // 索引访问返回 T | undefined
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "verbatimModuleSyntax": true,
    "moduleResolution": "bundler",        // 或 nodenext，按构建目标
    "target": "ES2022"
  }
}
```

## 3. ESLint (flat config)

新项目用 flat config（`eslint.config.js`）+ `typescript-eslint`：

```js
import tseslint from 'typescript-eslint'

export default tseslint.config(
  ...tseslint.configs.recommendedTypeChecked,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      'no-console': 'warn',
    },
  },
)
```

- 启用 type-checked 规则集，捕获类型层面的 lint 问题。
- 格式化交给 Prettier/Biome，ESLint 不管缩进等格式规则。

## 4. Package Manager

- 优先 **pnpm**：硬链接节省空间、严格依赖隔离、原生 workspace。
- 锁文件（`pnpm-lock.yaml`）入库保证可复现。
- 区分 `dependencies` 与 `devDependencies`；定期 `pnpm audit`（见 [ts-security.md](ts-security.md)）。

## 5. NPM Scripts

`package.json` 提供统一命令入口，CI 复用：

```json
{
  "scripts": {
    "typecheck": "tsc --noEmit",
    "lint": "eslint .",
    "format": "prettier --write .",
    "test": "vitest run --coverage",
    "check": "pnpm typecheck && pnpm lint && pnpm test"
  }
}
```

## 6. Checklist

- [ ] `tsconfig` strict 全开，`tsc --noEmit` 在 CI 阻断。
- [ ] ESLint flat config / Biome 启用 type-checked 规则，无 `any`。
- [ ] Prettier / Biome 统一格式化，与 lint 不冲突。
- [ ] pnpm 管理依赖，锁文件入库。
- [ ] `package.json` 提供 typecheck/lint/test/check 脚本。
