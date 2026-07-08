---
name: skill-check
description: Use when preparing to commit changes in this repo, after adding/renaming/removing a skill, or when asked to verify skill integrity — runs the repo's pre-commit checklist (SKILL.md name/dir match, cross-skill content-level references, dead links, README sync, agents-scaffold tests).
---

# skill-check

一键执行本仓的提交前检查清单，逐项验证并输出 ✅/❌ 结果汇总。只检查不修改；发现问题时列出定位与修复建议，由用户决定是否修复。

## 检查项

依次执行以下检查（全部只读，agents-scaffold 测试除外）：

### 1. SKILL.md `name` 与目录名一致

对每个 `skills/*/SKILL.md`，读取 frontmatter 的 `name`，与所在目录名比对：

```bash
for f in skills/*/SKILL.md; do
  dir=$(basename "$(dirname "$f")")
  name=$(sed -n 's/^name:[[:space:]]*//p' "$f" | head -1)
  [ "$dir" = "$name" ] || echo "MISMATCH: $f (name=$name, dir=$dir)"
done
```

### 2. 无跨 skill 的内容级引用

在所有 skill 文件中搜索指向其它 skill 目录内部文件的路径引用（skill 之间只允许提 skill 名）：

```bash
grep -rn --include='*.md' -E '\]\(\.\./[a-z-]+/' skills/ || echo "OK"
```

命中后人工判读：指向**另一个 skill 目录内部文件**的才算违规；skill 自身目录内的相对引用（如 `references/`、`agents/`、`templates/`）合法。

### 3. 无死链

对每个 skill 的 Markdown 相对链接（`](...)` 形式、非 http），验证目标文件存在。重点覆盖 `skills/agents-scaffold/templates/` 下的模板文件。注意：模板中含 `{{PROJECT}}` 占位符的链接属于生成期产物，跳过存在性检查。

### 4. agents-scaffold 测试（条件执行）

`git status`/`git diff` 显示 `skills/agents-scaffold/` 下有改动时才执行：

```bash
cd skills/agents-scaffold && node --test scripts/scaffold.test.mjs
```

必须全绿。无改动时标记 SKIPPED。

### 5. README 同步

- `skills/` 下每个 skill 目录都出现在 README「Skills 一览」表中，且表中没有指向不存在目录的行。
- 「使用 → 方式一」的 `npx skills add` 命令块与当前 skill 集合不矛盾（示例中提到的 skill 名必须真实存在）。

## 输出

按检查项顺序输出汇总表（✅ 通过 / ❌ 失败 / ⏭️ 跳过），失败项附文件位置和一句话修复建议。全部通过时明确说「提交前检查全部通过」。
