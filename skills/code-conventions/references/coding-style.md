# Coding Style Convention v1.0

> Applies to: 所有模块（与语言无关） | Goal: 统一命名、文件组织、注释与代码味道的跨语言基线，让任意技术栈的代码可读、可维护、风格一致

For the full convention index, see [../SKILL.md](../SKILL.md).

本篇只收**语言无关**的命名、文件组织、注释哲学与代码味道。各语言在其上扩展（见各 `references/<lang>/<lang>-style.md`）。

**边界声明**：工程**行为准则**——simplicity-first（最小可行解）、KISS/DRY/YAGNI、surgical-changes（外科手术式改动）、root-cause reasoning——不在本篇，属独立 skill **`engineering-guidelines`**。本篇与之互补、不重复：前者管「怎么决策与下手」，本篇管「落到代码上的命名与组织形态」。

## 1. Design Principles

- **可读优先**：为清晰而写，不为炫技。读代码的时间远多于写。
- **意图自明**：命名与结构本身表达意图，注释只补「为什么」。
- **小而聚焦**：文件、函数、类型各自单一职责，高内聚低耦合。
- **一致性**：同一项目内风格统一优先于个人偏好；遵循语言官方风格指南。

## 2. Naming

命名是最廉价的文档。规则随语言惯例微调（见各语言 style 文档），跨语言基线如下：

- **描述性**：名字说清「是什么 / 做什么」，避免 `data`、`tmp`、`obj`、`handle2` 等无信息名。
- **大小写约定**（按语言惯例选用，同一语言内一致）：
  - 变量 / 函数：`camelCase`（JS/TS/Dart/Java）或 `snake_case`（Python/Rust）。
  - 类型 / 类 / 组件：`PascalCase`。
  - 常量：`UPPER_SNAKE_CASE`。
- **布尔**：用 `is` / `has` / `should` / `can` 前缀，使条件读起来像断言（`isActive`、`hasPermission`）。
- **函数**：动词开头（`fetchUser`、`calculateTotal`），返回布尔的谓词函数用 `is/has`。
- **避免缩写**：除领域公认缩写（`id`、`url`、`http`）外不自造缩写。
- **避免类型噪声**：不在名字里复述类型（`userList` 可，`userArr`、`strName` 不必）。

## 3. File Organization

**MANY SMALL FILES > FEW LARGE FILES**：

- 典型文件 200–400 行，硬上限约 800 行；超出即拆分。
- **按领域 / 特性组织**，不按技术类型堆放（`user/` 内含其 model、service、handler，而非全工程一个 `models/`）。
- 单文件单一主题：一个文件聚焦一个职责，从大模块中抽出工具函数。
- 公共 API 与内部实现分离：导出面尽量小，内部细节不外泄。

## 4. Functions

- **短小**：函数体 < 50 行为宜；超长说明职责过载，应拆分。
- **单一职责**：一个函数只做一件事；「获取并校验并保存并通知」应拆成可组合的步骤。
- **参数克制**：参数超过 3–4 个时，用结构体 / 选项对象 / 具名参数承载。
- **早返回**：用卫语句处理错误与边界，避免深层嵌套（见 §6.1）。

## 5. Comments

注释解释**「为什么」**，不复述**「做什么」**——后者由代码本身表达。

- 写下非显而易见的决策：为何选此算法、为何固定某版本、绕过某 bug 的缘由、并发 / 安全约束。
- **不写废话注释**：`i++ // 自增`、`// 保存用户` 紧贴 `saveUser()` 都是噪声。
- 注释随代码同步更新；过期注释比没有更有害。
- 导出 / 公共符号按语言惯例写文档注释（godoc、JSDoc、docstring、rustdoc）。
- 用 `TODO(name):` / `FIXME(name):` 标记待办并署名，便于追溯。

## 6. Code Smells to Avoid

### 6.1 深层嵌套

逻辑一旦开始堆叠，用早返回压平，而非层层 `else`。

```js
// Bad —— 嵌套金字塔
function process(user) {
  if (user) {
    if (user.active) {
      if (user.hasPermission) {
        doWork(user);
      }
    }
  }
}

// Good —— 卫语句早返回
function process(user) {
  if (!user || !user.active || !user.hasPermission) return;
  doWork(user);
}
```

> 嵌套层级 > 4 视为警告。

### 6.2 魔法数 / 魔法串

有业务含义的阈值、延迟、上限用具名常量，不裸写字面量。

```js
// Bad
if (retries > 3) abort();
setTimeout(flush, 5000);

// Good
const MAX_RETRIES = 3;
const FLUSH_INTERVAL_MS = 5_000;
if (retries > MAX_RETRIES) abort();
setTimeout(flush, FLUSH_INTERVAL_MS);
```

### 6.3 长函数 / 重复块

- 长函数按职责拆成具名小函数，让调用处读起来像目录。
- **真实**重复（出现 ≥ 3 次且会同步漂移）才抽象；一次性相似不强行 DRY（避免错误抽象）。

### 6.4 可变共享状态

优先不可变更新：返回新对象而非原地改写，减少隐藏副作用、利于并发与调试。具体手法见各语言 style 文档（spread / `frozen` / `final` / 所有权）。

## 7. Checklist

提交前自检：

- [ ] 命名描述性、大小写约定与语言惯例一致。
- [ ] 文件聚焦单一主题，未超约 800 行。
- [ ] 函数短小（< 50 行）、单一职责、参数克制。
- [ ] 无 > 4 层嵌套（已用早返回压平）。
- [ ] 无裸魔法数 / 魔法串（已具名）。
- [ ] 注释只解释「为什么」，无废话、无过期注释。
- [ ] 导出符号有文档注释。
