# Security Baseline Convention v1.0

> Applies to: 所有模块（与语言无关） | Goal: 给出一条跨语言的安全基线——密钥、输入、注入、认证、依赖、错误暴露——各语言 `*-security.md` 在此之上扩展

For the full convention index, see [../SKILL.md](../SKILL.md).

本篇是**通用安全基线**。语言/框架专属手法（gosec、bandit、npm audit、flutter_secure_storage 等）见各 `references/<lang>/<lang>-security.md`。密钥的命名与派生细则见 [configuration.md](configuration.md)。

## 1. Design Principles

- **零信任输入**：所有跨边界数据（用户输入、API 响应、文件、环境）默认不可信，先校验再使用。
- **最小权限**：进程、令牌、数据库账户只授予完成任务所需的最小权限。
- **纵深防御**：单层防护不足时仍有第二道（校验 + 参数化 + 最小权限叠加）。
- **失败安全**：异常路径默认拒绝（deny by default），不因出错而放行。
- **不泄露**：错误信息、日志、响应体不含密钥、令牌、完整 PII 或内部栈细节。

## 2. Secret Management

- **绝不硬编码**密钥、密码、令牌、连接串到源码或前端 bundle。
- 一律走环境变量或密钥管理器（Vault / KMS / 平台 secret store）。命名与双前缀见 [configuration.md](configuration.md)。
- **启动即校验**：必需密钥缺失时启动失败并明确报错，不带默认值兜底进生产。
- 疑似泄露立即轮换，并全仓排查同类用法。
- `.gitignore` / `.dockerignore` 必须排除 `.env`、私钥、本地凭据。

## 3. Input Validation

- 在**系统边界**校验：HTTP handler、消息消费者、CLI 入口、反序列化点。
- 优先 **schema 校验**（zod / pydantic / validator 等），fail-fast 给清晰错误。
- 校验类型、范围、长度、格式、枚举值；拒绝未知字段（按需）。
- 对外部 URL（深链、回调、webhook、图片地址）校验 scheme / host / path，防 SSRF 与开放重定向。

## 4. Injection Prevention

- **SQL**：一律参数化查询 / 预编译语句 / ORM 绑定参数；**绝不**字符串拼接 SQL。
- **命令注入**：不把用户输入拼进 shell；用参数数组形式调用子进程，必要时白名单校验。
- **XSS**：输出到 HTML 前转义；框架默认转义不要绕过（避免 `dangerouslySetInnerHTML`、`v-html`、`innerHTML` 直传用户内容）。
- **路径穿越**：拼接文件路径前规范化并校验，限制在允许目录内。
- **反序列化**：不反序列化不可信数据为任意类型；用安全格式与白名单。

## 5. Authentication & Authorization

- 认证（你是谁）与授权（你能做什么）分离，**每个**受保护端点都做授权检查，不依赖前端隐藏入口。
- 令牌短时效 + 可轮换；敏感操作二次校验。JWT TTL 见 [configuration.md](configuration.md)。
- 所有面向公网的端点加**限流**，防爆破与滥用。
- 密码用强哈希（bcrypt / argon2 / scrypt）加盐存储，绝不明文或可逆加密。

## 6. Transport & Data Protection

- 生产环境强制 HTTPS / TLS，禁明文传输凭据与 PII。
- 所有外部 HTTP 客户端设连接 / 读取**超时**，不留默认无限等待。
- 静态敏感数据加密存储；日志、缓存、临时文件不落明文密钥与完整 PII。

## 7. Error & Logging Hygiene

- 对外错误信息泛化（「系统错误，请稍后重试」+ 错误码），内部细节只进服务端日志。错误码规范见 [error-codes.md](error-codes.md)。
- 日志**绝不**记录密钥、令牌、密码、完整卡号 / 身份证等；需要时脱敏。日志规范见 [observability.md](observability.md)。

## 8. Dependency & Supply Chain

- 锁定依赖版本（lockfile 入库），定期跑漏洞扫描（各语言工具见 `*-security.md`）。
- 引入第三方包前评估维护活跃度与许可；最小化依赖面。
- CI 中将高危漏洞设为阻断项。

## 9. Pre-Commit Security Checklist

提交前确认：

- [ ] 无硬编码密钥 / 令牌 / 密码（含前端 bundle 与测试夹具）。
- [ ] 所有边界输入已校验，外部 URL 已校验 scheme/host。
- [ ] SQL 全参数化，无字符串拼接；无命令 / 路径注入面。
- [ ] HTML 输出已转义，未绕过框架默认转义。
- [ ] 受保护端点均有授权检查，公网端点有限流。
- [ ] 错误信息与日志不泄露密钥 / 内部栈 / 完整 PII。
- [ ] 依赖已锁版本并通过漏洞扫描。
