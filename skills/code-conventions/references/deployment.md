# Deployment & Release Convention v1.0

> Applies to: All deployable modules | Goal: 让每次发版都有可复现的资料清单、固定的执行顺序、明确的配置归属，以及一条随时可走的回滚路径

For the full convention index, see [../SKILL.md](../SKILL.md).

## 1. Design Principles

- **构建物不可变**：一次构建出的镜像 / bundle 原样晋级 staging → production，不为不同环境重新构建。环境差异只来自配置。
- **配置与代码分离**：变量怎么命名、是否必填由 [configuration.md](./configuration.md) 规定；本文只规定「哪一类配置落在平台的哪个位置」。
- **单一部署入口**：部署只经 CLI，本地与 CI 跑同一条命令。**禁止在平台面板手改生产配置**——面板改动不可 review、不可复现、不进版本历史，且与仓库里的配置文件长期不一致。
- **可回滚**：发版前就要能回答「回滚到哪个版本、用哪条命令」。天然不可回滚的变更（数据迁移、破坏性契约）必须拆成多次可前滚的发布。
- **前置检查是阻断项**：lint / 测试 / 漏洞扫描未全绿不发版。
- **密钥永不入仓**：仓库里只出现密钥的**名字**（`.env.example`），不出现值。

## 2. Prerequisites — 发版前要备齐的资料

首次上线前一次性备齐。缺任何一项都不要开始部署——中途补料是生产事故的高发区。

| 资料 | 从哪拿 | 存到哪 | 入仓 |
|---|---|---|---|
| 平台账号 + 组织/团队 + 付费方式 | 平台控制台 | 团队密码管理器 | 否 |
| 部署 CLI | `brew install flyctl` / `npm i -D wrangler` | 本地 + CI 镜像 | 版本入仓（依赖清单 / `make tools-check`） |
| 本地登录态 | `flyctl auth login` / `wrangler login` | 本地 keychain | 否 |
| CI 部署 token（最小权限、可撤销） | 平台生成（§5.1 / §6.2） | CI secret | 否 |
| 账号 / 应用标识（Account ID、app 名、project 名） | 平台 | 平台配置文件 | **是** |
| 环境划分（staging / production 各自的 app 名） | 项目决定 | 各自配置文件 | **是** |
| 域名与 DNS 管理权 | 注册商 / DNS 服务商 | 平台域名绑定 | 否 |
| 数据库 / 缓存实例与连接串 | 托管服务控制台 | 平台 secret | 否（名字入 `.env.example`） |
| 运行时密钥（JWT 签名密钥、pepper、第三方 key） | `openssl rand -hex 32` / 第三方控制台 | 平台 secret | 否（名字入 `.env.example`） |
| 非敏感运行时配置清单 | [configuration.md](./configuration.md) §3 | 平台配置文件的 `[env]` / `vars` | **是** |
| 日志 / 指标去向 | 平台自带或外部服务 | 配置文件（接入密钥走 secret） | 去向入仓 |
| 回滚预案与责任人 | 项目决定 | 模块 `CLAUDE.md` / `docs/` | **是** |

**准备顺序**：账号与付费 → 安装并登录 CLI → 创建 app / project（**先不部署**）→ 准备外部依赖（DB / KV / 队列）→ 灌密钥 → 首次部署 → 绑定域名与 TLS → 配置日志与告警。

## 3. 配置归属：配置文件 `[env]` vs 平台 secret

每个运行时变量按三问归位：

1. **值敏感吗**（泄露即事故）？→ secret。
2. **启动后基本不变、且随代码一起 review 更有价值吗**？→ 平台配置文件。
3. **多环境复用同一份配置吗**？→ 仍留在配置文件，用各环境的 override 段区分。

| 分类 | 判据 | Fly.io | Cloudflare | 典型 key |
|---|---|---|---|---|
| 非敏感 · 稳定 | 不敏感 + 启动后通常不改 | `fly.toml` 的 `[env]` | `wrangler.jsonc` 的 `vars` | `APP_ENV`、`PORT`、`LOG_LEVEL`、`LOG_FORMAT`、`METRICS_PORT`、`DEFAULT_LOCALE`、`CACHE_KEY_PREFIX`、feature flag |
| 敏感 · 或随环境变 | 泄露即事故 / 每个环境不同 | `flyctl secrets set` | `wrangler secret put` | `DATABASE_URL`、`REDIS_URL`、`JWT_SIGNING_KEY`、`APP_PEPPER`、`<MODULE>_INTERNAL_TOKEN`、第三方 API key |
| 本地开发 | 只在本机生效 | `.env`（已 gitignore） | `.dev.vars`（已 gitignore） | 上述两类的本地值 |

**规则：**

- **同一个 key 不得同时出现在配置文件与 secret 中**。两个平台都是 secret 覆盖同名普通变量，重复定义会制造「改了配置文件却不生效」的幻觉，排查成本极高。
- **生效方式不同**：改 `[env]` / `vars` 必须重新 `deploy` 才生效；`flyctl secrets set` 默认触发滚动重启（`--stage` 可暂存，随下次 deploy 生效），`wrangler secret put` 会立刻产生新版本。
- 敏感变量的**名字**仍必须出现在 `.env.example`（[configuration.md](./configuration.md) §2），否则接手的人不知道该设哪些。
- 变量名、是否必填、默认值一律以 [configuration.md](./configuration.md) §3 为准，平台配置文件里不重新定义语义。
- 平台配置文件（`fly.toml` / `wrangler.jsonc`）**入仓并参与 code review**；它属于契约的一部分，不是本地草稿。

## 4. Release Flow — 平台无关的执行顺序

```
1 前置检查 → 2 版本标记 → 3 构建 → 4 迁移(expand) → 5 部署 → 6 验证 → 7 记录 / 回滚
```

1. **前置检查**：工作树干净（脏树部署等于版本号说谎）；`make release-check`（lint + 漏洞扫描 + 测试）全绿；契约变更已按 spec 落地；`.env.example` 与代码实际读取的变量同步；**新增/变更的配置与密钥已在目标环境设好**——先设配置、后部署，否则新代码启动即 fail-fast。
2. **版本标记**：版本号、commit、构建时间进构建参数，运行实例要能回显自己的版本。这是第 6 步验证与回滚定位的前提。
3. **构建**：容器化模块见 [docker.md](./docker.md)。产物一次构建、多环境复用，不在 production 重新 build。
4. **迁移**：**先跑向后兼容的 expand 迁移，再部署新代码**；破坏性变更（删列、改名）拆成两次发布，见 [db-migrations.md](./db-migrations.md)。迁移与部署绝不合成一个不可分动作。
5. **部署**：staging 先行并观察，再 production。多模块按依赖顺序发：**提供契约的一端先上**（通常 server → web → client）。
6. **验证**（**退出码 0 不算生效证据**）：
   - 健康端点返回 200；
   - 实例回显的版本号 == 本次发布的版本（证明新版本真的在跑，而不是旧实例还没换）；
   - 关键路径 smoke（登录 / 下单 / 首屏）实测通过；
   - 观察窗（≥5 分钟）内错误率、延迟、重启次数无异常，日志无新的 error 级条目，见 [observability.md](./observability.md)。
   - 任一项不过 → **立即回滚**，不要「再观察一会儿」。
7. **记录**：把版本、内容、验证结果写进项目的进度/变更记录。

**回滚三条路径：**

- **代码**：重新部署上一个已知良好的构建物（见 §5.7 / §6.7）。
- **配置**：改回配置文件或 secret，再走一次部署。
- **数据库**：**不回滚迁移**，前滚修复（[db-migrations.md](./db-migrations.md)）。正因如此，第 4 步的向后兼容是回滚能力的前提——旧代码必须能在新 schema 上正常跑。

## 5. 方案 A：Fly.io（容器化长驻服务）

### 5.1 准备

- Fly 账号与组织，`flyctl auth login`。
- app 名（建议与仓库名一致，如 `acme-server`；staging 用 `acme-server-staging`）、`primary_region`。
- CI 部署 token：`flyctl tokens create deploy --app <app>` → 存为 CI secret `FLY_API_TOKEN`。**不要用账号级个人 token 做 CI 部署**，deploy token 只能部署这一个 app，泄露面最小。
- 外部依赖（Postgres / Redis）先建好，拿到连接串。

### 5.2 首次上线顺序

```bash
flyctl launch --no-deploy            # 只生成 fly.toml 与 app，不部署
#  → 编辑 fly.toml：[env]、[http_service]、健康检查、[[vm]]（见 5.3）
flyctl secrets set DATABASE_URL=... JWT_SIGNING_KEY=... --app <app>
flyctl deploy --app <app> --config fly.toml
flyctl status --app <app>            # 确认机器起来、版本号正确
flyctl certs add app.example.com --app <app>   # 绑域名（DNS 按提示配）
```

### 5.3 `fly.toml` 骨架

`[env]` 只放非敏感、启动后通常不改的配置（§3）：

```toml
app            = "acme-server"
primary_region = "sjc"

[build]
  dockerfile = "Dockerfile"

# 非敏感、启动后通常不改的运行时配置；改这里必须重新 deploy 才生效
# 敏感项（DATABASE_URL / JWT_SIGNING_KEY 等）一律走 flyctl secrets，不写在此
[env]
  APP_ENV        = "production"
  PORT           = "8080"
  LOG_LEVEL      = "info"
  LOG_FORMAT     = "json"
  METRICS_PORT   = "9090"
  DEFAULT_LOCALE = "en"

[http_service]
  internal_port       = 8080          # 必须与 PORT 一致
  force_https         = true
  auto_stop_machines  = "suspend"     # 低流量自动挂起；常驻服务设 "off"
  auto_start_machines = true
  min_machines_running = 1            # 生产至少 1，避免冷启动打到用户

  [[http_service.checks]]
    interval = "30s"
    timeout  = "3s"
    method   = "GET"
    path     = "/health"

[[vm]]
  size = "shared-cpu-1x"
  memory = "512mb"
```

### 5.4 例行发版

```bash
make release-check                                   # lint + 漏洞扫描 + 测试
flyctl deploy --app <app> --config fly.toml \
  --build-arg VERSION=$(git describe --tags --always)
flyctl status --app <app>                            # 验证版本与实例状态
flyctl logs --app <app>                              # 观察窗内盯错误
```

### 5.5 密钥

```bash
flyctl secrets set KEY=value --app <app>     # 设置并滚动重启
flyctl secrets set KEY=value --stage --app <app>   # 只暂存，随下次 deploy 生效（批量改用）
flyctl secrets list --app <app>              # 只列名字与摘要，永远看不到值
flyctl secrets unset KEY --app <app>
```

批量变更用 `--stage` 全部暂存后一次 `deploy`，避免每设一个就重启一轮。

### 5.6 多环境

一个环境一个 app、一份配置文件：`fly.toml`（production）、`fly.staging.toml`（staging）。用 `--config` 切换，**不要靠改同一个文件切环境**——那会让「当前部署的是哪份配置」无从判断。

### 5.7 回滚与排查

```bash
flyctl releases --app <app>          # 找上一个已知良好的版本 / 镜像 tag
flyctl deploy --app <app> --image registry.fly.io/<app>:<previous-tag>   # 重放旧镜像
flyctl status --app <app>            # 确认回滚后的版本号
flyctl ssh console --app <app>       # 进实例排查
```

回滚走与正常发版相同的路径（重新部署一个已知良好的镜像），比任何特殊回滚通道都可靠。

## 6. 方案 B：Cloudflare Workers / Pages（wrangler + API Token）

### 6.1 为什么不用面板的 Git 集成

Cloudflare 面板可以安装 GitHub App、把仓库接上 Workers Builds / Pages 的自动构建。**本规范不采用该方案**，统一用 `wrangler deploy`：

- **部署配置不可 review**：构建命令、输出目录、环境变量散落在第三方面板，改动不进版本历史，出问题无法 `git log` 追溯。
- **本地不可复现**：CI 里跑的构建与本地不是同一条命令，「本地好好的」类问题无法定位。
- **权限过宽**：GitHub App 通常要求组织级仓库读写权限，远超「部署一个 Worker」所需。
- **触发条件隐式**：谁的 push 会触发生产部署由面板设置决定，不在仓库里表达。

`wrangler deploy` 让本地与 CI 跑同一条命令，配置在 `wrangler.jsonc` 里入仓，凭据是一个可撤销的最小权限 token。

### 6.2 准备

- Cloudflare 账号、**Account ID**（面板可查，入仓写进 `wrangler.jsonc` 或 CI 变量）。
- 自定义域所在的 **Zone**（如果要绑域名）。
- **API Token**：用 “Edit Cloudflare Workers” 模板，或自定义最小权限：
  - Account → **Workers Scripts: Edit**（必需）
  - Account → Workers KV Storage / D1 / R2 / Queues: **Edit**（**仅按实际用到的绑定勾选**）
  - Account → Cloudflare Pages: Edit（部署 Pages 时）
  - Zone → **Workers Routes: Edit** + Zone: Read（绑自定义域时）
  - 限定到具体 Account / Zone，不要给 “All accounts”。
- token 存放：CI secret `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`；本地放 `.env` / shell profile，**绝不入仓**。wrangler 自动读取这两个环境变量，因此 CI 里无需 `wrangler login`。
- token 轮换：泄露或成员离职即在面板 Roll/Delete，仓库无需改动。

### 6.3 首次上线顺序

```bash
npm i -D wrangler
#  → 写 wrangler.jsonc（见 6.4）
wrangler kv namespace create CACHE          # 按需创建绑定资源，把返回的 id 写进配置
wrangler secret put JWT_SIGNING_KEY         # 交互输入，值不进 shell 历史
wrangler deploy --dry-run --outdir dist     # 预检：只构建不发布
wrangler deploy
wrangler tail                               # 观察窗内盯日志
```

### 6.4 `wrangler.jsonc` 骨架

`vars` 只放非敏感配置（§3）；密钥一律 `wrangler secret put`：

```jsonc
{
  "name": "acme-web",
  "main": "src/index.ts",
  // 固定运行时行为，避免平台默认值随时间漂移
  "compatibility_date": "2026-01-01",
  "observability": { "enabled": true },

  // 非敏感、启动后通常不改的配置；改这里必须重新 deploy 才生效
  // 敏感项走 `wrangler secret put`，不写在 vars 里（vars 明文入仓且面板可见）
  "vars": {
    "APP_ENV": "production",
    "LOG_LEVEL": "info",
    "DEFAULT_LOCALE": "en"
  },

  "env": {
    "staging": {
      "name": "acme-web-staging",
      "vars": { "APP_ENV": "staging", "LOG_LEVEL": "debug" }
    }
  }
}
```

### 6.5 例行发版

```bash
make check                                   # lint + 测试
wrangler deploy --env staging                # 先 staging
wrangler deploy                              # 验证通过后 production
wrangler deployments list                    # 确认当前活跃版本
```

### 6.6 密钥

```bash
wrangler secret put KEY                 # 交互输入（推荐）
wrangler secret put KEY --env staging   # 每个环境各设一份
wrangler secret list                    # 只列名字
wrangler secret delete KEY
```

本地开发把同名密钥写进 `.dev.vars`（必须 gitignore），`wrangler dev` 会自动加载——不要为了本地方便把值挪进 `vars`。

### 6.7 回滚

```bash
wrangler deployments list      # 找上一个已知良好的 version id
wrangler rollback [<version-id>]
```

### 6.8 Pages（纯静态前端）

```bash
wrangler pages deploy ./dist --project-name=acme-web
wrangler pages secret put API_TOKEN --project-name=acme-web
```

Pages 同样只用 CLI + API token：项目在面板创建一次（或 `wrangler pages project create`），此后所有部署与变量设置都走命令行，不接 Git 集成。

## 7. CI 集成

CI 只做三件事：拉代码 → 跑检查与构建 → 用 token 部署。凭据来自仓库 secret，命令与本地完全一致。

```yaml
# Fly.io
- run: make release-check
- run: flyctl deploy --app acme-server --config fly.toml
  env:
    FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
```

```yaml
# Cloudflare
- run: make check
- run: npx wrangler deploy
  env:
    CLOUDFLARE_API_TOKEN:  ${{ secrets.CLOUDFLARE_API_TOKEN }}
    CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

- 生产部署只从受保护分支/tag 触发，并要求人工审批。
- CI 日志绝不回显密钥值；只打印 key 名与部署结果。
- token 只授予目标环境所需的最小权限（§5.1 / §6.2）。

## 8. Release Checklist

- [ ] §2 的资料齐全，密钥已在目标环境设好（**先配置、后部署**）。
- [ ] 每个变量按 §3 归位：非敏感稳定项在 `[env]` / `vars`，敏感项在 secret，**无一项两处重复**。
- [ ] 工作树干净，`release-check`（lint + 漏洞扫描 + 测试）全绿。
- [ ] 构建物带版本号，运行实例可回显版本。
- [ ] 数据库迁移向后兼容，且**先于**新代码部署完成；破坏性变更已拆成多次发布。
- [ ] staging 已部署并验证，再动 production。
- [ ] 多模块按依赖顺序发（提供契约的一端先上）。
- [ ] 部署后验证：健康端点 + 版本回显 + 关键路径 smoke + 观察窗内错误率正常（**退出码 0 不算证据**）。
- [ ] 回滚命令与目标版本已确认可用。
- [ ] 平台配置文件改动已入仓 review，无人在面板手改生产配置。
