# Flutter / Dart Security Convention v1.0

> Applies to: 所有 Flutter / Dart 模块 | Goal: 在通用安全基线上落实移动端的密钥存储、网络、平台加固与发布混淆

For the full convention index, see [../../SKILL.md](../../SKILL.md).

在通用 [security.md](../security.md) 之上扩展 Dart/Flutter 与移动端专项。

## 1. Secrets Management

- **绝不**硬编码密钥 / token 到 Dart 源码。
- 编译期可配置项用 `--dart-define` / `--dart-define-from-file`（注意：这些值**不是真密钥**，服务端密钥须经后端代理）。
- 运行时密钥存平台安全存储 **flutter_secure_storage**（iOS Keychain / Android EncryptedSharedPreferences）。

```dart
// Bad
const apiKey = 'sk-abc123...';

// Good —— 编译期配置（可配置，非密钥）
const apiKey = String.fromEnvironment('API_KEY');

// Good —— 运行时密钥取自安全存储
final token = await secureStorage.read(key: 'auth_token');
```

## 2. Network Security

- 生产环境强制 HTTPS，无 `http://`；Android 配 `network_security_config.xml` 阻断明文，iOS 配 ATS。
- 所有 HTTP 客户端设连接 / 读取超时，不留默认。
- 高安全端点考虑证书 pinning。

```dart
final dio = Dio(BaseOptions(
  baseUrl: 'https://api.example.com',
  connectTimeout: const Duration(seconds: 10),
  receiveTimeout: const Duration(seconds: 30),
));
```

## 3. Input Validation

- 所有用户输入发往 API / 存储前校验、净化。
- 本地数据库（sqflite / drift）用参数化查询，绝不拼接 SQL。
- 深链 URL 导航前校验 scheme / host / path。

```dart
// Good —— 参数化
await db.query('users', where: 'email = ?', whereArgs: [userInput]);

// Good —— 校验深链
final uri = Uri.tryParse(incomingLink);
if (uri != null && uri.host == 'myapp.com' && _allowedPaths.contains(uri.path)) {
  context.go(uri.path);
}
```

## 4. Data Protection

- token / PII / 凭据只存 `flutter_secure_storage`，不写 `SharedPreferences` 或明文文件。
- 登出时清理 token、缓存用户数据、cookie。
- 敏感操作用生物认证（`local_auth`）；敏感屏用 `FLAG_SECURE` 防截屏。
- 不日志敏感数据（`print(token)` 禁止）。

## 5. Platform Hardening

- **Android**：只声明必需权限；非必要组件加 `android:exported="false"`；审查 intent filter。
- **iOS**：`Info.plist` 只声明必需用途描述；密钥存 Keychain；启用 ATS。

```xml
<activity android:name=".SensitiveActivity" android:exported="false" />
```

## 6. WebView Security

- 用 `webview_flutter` v4+；非必要禁用 JS（`JavaScriptMode.disabled`）。
- 加载前校验 URL，用 `NavigationDelegate.onNavigationRequest` 拦截非受信导航。
- 不向 JS 暴露 Dart 回调，除非确有必要并严格沙箱。

## 7. Build & Release

- release 启用混淆：`flutter build apk --obfuscate --split-debug-info=./debug-info/`。
- `--split-debug-info` 输出排除版本控制（仅用于崩溃符号化）。
- 发布前 `flutter analyze` 零告警。

## 8. Checklist

- [ ] 无硬编码密钥；运行时密钥存 flutter_secure_storage。
- [ ] 强制 HTTPS + 超时；高安全端点 pinning。
- [ ] 本地 SQL 参数化；深链校验 scheme/host。
- [ ] 敏感数据不进 SharedPreferences / 日志，登出清理。
- [ ] Android/iOS 只声明必需权限，非必要组件 `exported=false`。
- [ ] WebView 默认禁 JS + 校验导航；release 启用混淆。
