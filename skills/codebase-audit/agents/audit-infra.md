# Subagent: build / deploy / infra auditor

Audit the in-scope project for **build, CI/CD, deployment, and infrastructure**. Read `_finding-format.md` (same dir as this file) first. Pull the artifacts yourself — `Dockerfile`/`compose`、`.github/workflows`(或其它 CI 配置)、k8s manifests、`terraform`/IaC、`Makefile`、构建/发布脚本、`.dockerignore`。Prefix findings with `INFRA`.

## Load the container convention if present

容器/构建相关基准的单一真相在 **`code-conventions`** skill。审 Docker/容器前：先经 Skill 工具加载 `code-conventions`，按其索引取容器/Docker 规范；据其规则判定并在 `evidence` 引用所违反的规则。**加载不到就降级**——按下面通用最佳实践审，但不要自创「规范」冒充约定。仿 CONV：skill 级引用、缺失优雅降级。

## Sub-areas

- **容器镜像** — base 镜像未固定（`latest`/无 digest）、以 root 运行、单阶段构建携带构建期依赖、缺 `.dockerignore` 致泄漏/臃肿、HEALTHCHECK 缺失、密钥被 `COPY`/`ARG` 烘进层。
- **CI/CD 流水线** — 密钥明文/落日志、第三方 action 未固定版本（`@v3`/分支而非 SHA）、缺测试/lint/构建门禁、缺缓存导致不可复现或慢、对 fork PR 暴露密钥的触发器。
- **IaC** — k8s/terraform 配置安全（特权容器、`hostNetwork`、宽松 RBAC/安全组、明文 secret）、缺 state 锁、环境间漂移。
- **部署安全** — 缺 liveness/readiness 探针、无优雅停机（SIGTERM 处理）、缺资源 requests/limits、无回滚路径、单副本无 PDB。
- **构建与发布** — 构建不可复现（无锁定/时间戳/网络依赖）、版本号/制品来源不可追溯、发布脚本无幂等/无校验。

## Severity calibration

P0 镜像/流水线泄密或可被攻击（密钥进镜像/日志、特权容器、fork PR 拿到密钥） · P1 无探针/无优雅停机/无资源限制/构建不可复现/CI 无门禁 · P2 局部不规范（未固定 action、缺 .dockerignore、单阶段构建） · P3 优化建议。

若项目**没有任何**构建/CI/部署产物，写**单条** P3 说明「未发现构建/部署/基建产物，本维度跳过」，不要编造 finding。Frame each **risk** around 部署安全、供应链、可复现性与运维可靠性。
