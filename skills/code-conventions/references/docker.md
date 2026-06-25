# Docker Convention v1.0

> Applies to: All containerized modules | Goal: Produce small, secure, cache-efficient, reproducible images

For the full convention index, see [../SKILL.md](../SKILL.md).

## 1. Design Principles

- **Multi-stage**: 构建依赖与运行时分离，最终镜像只含运行所需的产物。
- **Cache-friendly**: 指令顺序按「变更频率从低到高」排列，最大化层缓存命中。
- **Least privilege**: 容器以非 root 用户运行，不暴露多余端口、不留构建工具。
- **Reproducible**: 基础镜像与依赖版本固定（pin），避免 `latest` 漂移。
- **Self-documenting**: 关键决策（阶段职责、为何固定版本、非 root 配置）用注释说明意图，而非复述命令。

## 2. Multi-Stage Build

所有需要编译/打包的服务 MUST 使用多阶段构建：`builder` 阶段产出二进制或静态资源，最终阶段只 `COPY --from=builder` 拷贝产物。

- 阶段用 `AS <name>` 命名，最终阶段放在最后。
- 最终镜像基底优先 `distroless` / `alpine` / `-slim`，不含编译器、包管理器、shell（除非健康检查需要）。
- 通过 `--from=builder` 只拷贝运行时必需的文件，不整目录 `COPY` 构建产物。

```dockerfile
# ---- 构建阶段：含完整工具链，产物体积不进最终镜像 ----
FROM golang:1.23-alpine AS builder
WORKDIR /src

# 先拷依赖清单并下载，与源码分层 —— 源码变更不会让依赖层失效
COPY go.mod go.sum ./
RUN go mod download

# 再拷源码编译；静态链接以便在 distroless 基底运行
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/app ./cmd/server

# ---- 运行阶段：distroless，仅含二进制与非 root 用户 ----
FROM gcr.io/distroless/static-debian12:nonroot
WORKDIR /app
COPY --from=builder /out/app /app/app

# distroless:nonroot 已内置 uid 65532 的非 root 用户
USER nonroot:nonroot
EXPOSE 8080
ENTRYPOINT ["/app/app"]
```

## 3. Layer Caching

按变更频率从低到高排列指令，让高频变更（源码）不破坏低频层（依赖）的缓存。

- **依赖先行**：先 `COPY` 依赖清单（`go.mod`/`package.json`/`requirements.txt`）并安装，再 `COPY` 源码。
- **包管理用缓存挂载**：支持 BuildKit 时用 `RUN --mount=type=cache` 复用下载缓存，避免每次重拉。
- **合并易变层**：`apt-get update && apt-get install` 同一 `RUN`，并清理 `apt` 列表，避免脏缓存与额外层。
- **`.dockerignore` 必备**：排除 `.git`、`node_modules`、构建产物、密钥与本地配置，缩小构建上下文、保护缓存与镜像。

```dockerfile
# 依赖清单单独成层；仅当清单变化才重装，源码改动复用此层
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev
```

## 4. Non-Root User

容器 MUST 以非 root 用户运行（CIS Docker Benchmark 5.x）。

- 基底自带非 root 用户（如 distroless `nonroot`、`node`）时直接 `USER` 切换。
- 否则在最终阶段创建专用用户/组并切换：

```dockerfile
# 创建无登录、无 home 的专用运行账户
RUN addgroup -S app && adduser -S -G app -H -s /sbin/nologin app
# 仅对运行期需要写入的路径授权
COPY --from=builder --chown=app:app /out/app /app/app
USER app
```

- 监听端口 MUST 用非特权端口（>1024），非 root 无法绑定 80/443。
- 需要写入时仅对具体目录 `--chown`，不放宽整镜像权限。
- 不在最终镜像保留 `sudo`、setuid 二进制或构建期密钥。

## 5. Comments

注释说明「为什么这样做」，不复述命令本身。

- 每个 stage 顶部一行注释，点明该阶段职责（构建 / 运行 / 测试）。
- 解释非显而易见的决策：版本固定原因、`CGO_ENABLED=0` 等编译开关、缓存挂载、非 root/`--chown` 配置。
- 不写 `# install deps` 这类与 `RUN npm ci` 等价的废话注释。

## 6. Hardening Checklist

- [ ] 多阶段：最终镜像不含编译器/构建工具。
- [ ] 基础镜像固定 tag（避免 `latest`），优先 digest pin 关键镜像。
- [ ] 依赖层与源码层分离，缓存顺序正确。
- [ ] `.dockerignore` 已排除 `.git`、依赖目录、密钥、本地配置。
- [ ] 以非 root `USER` 运行，端口 >1024。
- [ ] 提供 `HEALTHCHECK`（或由编排层接管）。
- [ ] 关键决策有注释，无废话注释。
