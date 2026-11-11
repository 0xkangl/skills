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

使用 TypeScript 类型检查的项目，`tsconfig.json` MUST 开启 strict 全家桶，把错误挡在编译期；未接入 TypeScript 类型检查的纯 JS 项目不要求套用此配置。

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

采用 ESLint 的 TS 项目用 flat config + `typescript-eslint`。下例为 ESM 配置 `eslint.config.mjs`（用 `.js` 时需项目声明 `"type": "module"`），适用于支持 `projectService` 的 typescript-eslint v8；按项目已安装的 ESLint / typescript-eslint 版本核对配置 API，不为套用示例升级依赖。

```js
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    files: ['**/*.{ts,tsx,mts,cts}'],
    extends: [...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: dirname(fileURLToPath(import.meta.url)),
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      'no-console': 'warn',
    },
  },
)
```

- `recommendedTypeChecked` 必须配合类型服务。`projectService: true` 为文件查找最近的 `tsconfig.json`；确保 `files` 匹配的源码与测试均被对应 TSConfig 的 `include` / `files` 覆盖，且未被 `exclude` 排除。monorepo 按包核对范围，生成物通过 ESLint ignores 排除。参见 [官方 typed linting 配置](https://typescript-eslint.io/getting-started/typed-linting/)。
- 已安装版本不支持 `projectService` 时，按该版本文档改用 `parserOptions.project` 指向覆盖目标文件的 TSConfig（需要时用专用 `tsconfig.eslint.json`），并设置 `tsconfigRootDir`；不同时启用 `projectService` 与 `project`。
- 未纳入 TSConfig 的 JS / 配置脚本使用独立的非 type-checked 配置块；纯 JS 项目可用普通 ESLint 推荐规则，不强制引入 TSConfig 或 `tsc`。JS 若主动接入类型检查，再按项目约定配置 `allowJs` / `checkJs` 与文件覆盖范围。上述 type-checked 配置只匹配 TS 文件。
- 格式化交给 Prettier/Biome，ESLint 不管缩进等格式规则。

## 4. Package Manager

- 优先 **pnpm**：硬链接节省空间、严格依赖隔离、原生 workspace。
- 锁文件（`pnpm-lock.yaml`）入库保证可复现。
- 区分 `dependencies` 与 `devDependencies`；定期 `pnpm audit`（见 [ts-security.md](ts-security.md)）。

## 5. NPM Scripts

TS 项目的 `package.json` 提供统一命令入口，CI 复用；纯 JS 未接入类型检查时，省略 `typecheck`，并从 `check` 中去掉对应调用：

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

- [ ] 接入 TS 类型检查时，`tsconfig` strict 全开，`tsc --noEmit` 在 CI 阻断。
- [ ] 采用 ESLint 的 TS 文件启用 type-checked 规则与类型服务，TSConfig 覆盖所有匹配文件，无 `any`；纯 JS 按适用边界配置。
- [ ] Prettier / Biome 统一格式化，与 lint 不冲突。
- [ ] pnpm 管理依赖，锁文件入库。
- [ ] `package.json` 提供 lint/test/check 脚本，接入类型检查时另提供 typecheck。
