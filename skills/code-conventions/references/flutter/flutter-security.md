# Flutter / Dart Security Convention v1.0

> Applies to: 所有 Flutter / Dart 模块 | Goal: 在通用安全基线上落实移动端的密钥存储、网络、平台加固与发布混淆

For the full convention index, see [../../SKILL.md](../../SKILL.md).

在通用 [security.md](../security.md) 之上扩展 Dart/Flutter 与移动端专项。

按模块能力与发布平台选用：纯 Dart 遵循适用的通用安全规则；平台安全存储、WebView、Android/iOS 加固只作用于实际采用这些能力的客户端，不能为纯 Dart 或 Web 模块引入移动端依赖。

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

- 支持混淆的 Flutter 原生 release 构建启用混淆；以下仅为 Android APK 示例：`flutter build apk --obfuscate --split-debug-info=./debug-info/`。其他原生目标使用对应平台的构建命令与适用选项，不能套用 APK 命令。
- 使用 `--split-debug-info` 时，输出排除版本控制并安全留存用于崩溃符号化；Flutter Web 不支持此混淆流程，纯 Dart 按自身发布工具处理。
- 发布前运行模块对应的 `dart analyze` / `flutter analyze`，零告警。

## 8. Checklist

- [ ] 无硬编码密钥；移动端运行时密钥存平台安全存储，其他模块使用平台适用的安全方案。
- [ ] 强制 HTTPS + 超时；高安全端点 pinning。
- [ ] 本地 SQL 参数化；深链校验 scheme/host。
- [ ] 敏感数据不进 SharedPreferences / 日志，登出清理。
- [ ] 发布到 Android/iOS 时只声明必需权限；Android 非必要组件 `exported=false`。
- [ ] 使用 WebView 时默认禁 JS + 校验导航；支持混淆的 Flutter 原生 release 构建启用混淆并保管符号文件。
