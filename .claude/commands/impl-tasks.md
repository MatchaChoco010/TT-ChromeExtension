---
description: Execute all pending spec tasks sequentially with clean context per task (project)
allowed-tools: Bash, Read, Write, Edit, Grep, Glob, Task
argument-hint: <feature-name>
---

# Sequential Task Executor with Clean Context

<background_information>
- **Mission**: Execute all pending implementation tasks for a specification sequentially, using a fresh subagent with clean context for each task
- **Success Criteria**:
  - All pending tasks executed one by one
  - Each task runs in isolated clean context
  - Task summaries collected and displayed
  - All tasks marked as completed in tasks.md
</background_information>

<instructions>
## Core Task
Execute all pending tasks for feature **$1** sequentially, with each task running in a fresh subagent to prevent context pollution and overflow.

## Execution Steps

### Step 1: Load Project Configuration

**Read CLAUDE.md to get directory paths**:
- Read `CLAUDE.md` file from project root
- Extract Specs directory path from "### Paths" section (line starting with "- Specs:")
- Extract the path from backticks (e.g., `` `.kiro/specs/` `` → `.kiro/specs`)
- Store as `$SPECS_DIR` variable for use in subsequent steps
- If CLAUDE.md not found or Specs path not defined, fallback to `.kiro/specs`

**Example extraction**:
```
From: "- Specs: `.kiro/specs/`"
Extract: ".kiro/specs"

From: "- Specs: `docs/specs/`" (project customized)
Extract: "docs/specs"
```

### Step 2: Load Spec Context and Find Pending Tasks

**Read necessary files using extracted path**:
- `$SPECS_DIR/$1/spec.json`
- `$SPECS_DIR/$1/tasks.md`

**Validate setup**:
- Verify spec exists at `$SPECS_DIR/$1/`
- Verify tasks are approved in spec.json
- If tasks not approved, stop and suggest running `/kiro:spec-tasks $1`

**Parse tasks.md to identify all uncompleted tasks**:
- Use Grep to find lines with `- [ ]` pattern in `$SPECS_DIR/$1/tasks.md`
- Extract task numbers from lines matching pattern `- [ ]\*? \d+\.\d+` (includes optional tasks marked with `*`)
- Create ordered list of pending task numbers in sequential order
- Include ALL uncompleted tasks regardless of optional marker
- Example pending task: `- [ ] 5.2 新規タブの親子関係構築` → extract "5.2"
- Example optional task: `- [ ]* 4.4 基本UI表示のテスト` → extract "4.4" (NOT skipped)
- Example completed task: `- [x] 1.1 (P) プロジェクト初期化` → skip
- Example completed optional: `- [x]* 3.2 テストカバレッジ` → skip

**未完了タスクが見つからない場合**:
- 「✅ すべてのタスクが完了しています！」と報告して正常終了

### Step 3: Display Initial Status

**実行計画を表示**:
- 未完了タスクの総数をカウント
- 実行予定のすべてのタスク番号をリスト
- 初期ステータスメッセージを表示（Output Description形式を参照）

### Step 4: Execute Tasks Sequentially

**For each pending task number**:

1. **タスク情報を表示**:
   - `$SPECS_DIR/$1/tasks.md` からタスク番号に一致する行のタスク説明を抽出
   - 出力はMarkdownとしてレンダリングされるため、適切なMarkdown改行を使用
   - 以下を**各行末に2スペース**または**段落間に空行**で出力:

     ```
     (段落区切りの空行)
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     📌 タスク {task-number}/{total}: {task-description}
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     🔄 クリーンなサブエージェントを起動中...
     (段落区切りの空行)
     ```

   - 重要: 各行末に2つの末尾スペース（  ）を追加してMarkdown改行
   - または: 各行を空行で区切って別々の段落を作成

2. **Launch Clean Subagent**:
   - Use Task tool with subagent_type="general-purpose"
   - DO NOT use `resume` parameter - each task gets fresh context
   - Set description: "Execute task {task-number}"
   - Pass detailed prompt:
     ```
     You are executing implementation task {task-number} for feature '{feature-name}' in a spec-driven development workflow.

     Your task:
     1. Use the Skill tool to execute: skill='kiro:spec-impl', args='{feature-name} {task-number}'
     2. Wait for the skill to complete
     3. Extract and return ONLY:
        - The final test execution results (test pass/fail output)
        - The final summary section
     4. DO NOT include the step-by-step implementation process

     Important: Return only the test results and summary, not the full execution log.
     ```

3. **Collect and Display Output**:
   - Wait for subagent to complete (Task tool is blocking)
   - Capture the subagent's output (test results + summary)
   - **タスクサマリーを日本語で生成**:
     - サブエージェントの出力からタスクの成果を要約
     - **10行以内**で簡潔にまとめる（短くできるならより短く）
     - 以下の形式で表示:

     ```
     (blank line)
     📝 タスクサマリー:
     {日本語で簡潔なサマリー - 10行以内}
     (blank line)
     ✅ タスク {task-number} 完了
     ```

   - CRITICAL: Use blank lines to separate sections (Markdown paragraph breaks)
   - Ensure proper spacing for readability in Markdown rendering

4. **タスク完了を確認**:
   - `$SPECS_DIR/$1/tasks.md` を再読み込みしてタスクが `[x]` になっているか確認
   - タスクがまだ `[ ]` の場合は警告をログして続行
   - この確認により問題を早期に発見

5. **次のタスクへ進む**:
   - 次の未完了タスクに移動
   - 新しいサブエージェント（クリーンコンテキスト）でプロセスを繰り返す
   - 各イテレーションは完全に独立

### Step 5: Final Report

**すべてのタスク完了後**:
- 視覚的な区切りで完了サマリーを表示（Output Description形式を参照）
- 実行したすべてのタスク番号をリスト
- 合計数を表示
- 次のステップを提案:
  - `/kiro:validate-impl $1` - 実装を検証
  - `/kiro:spec-status $1` - プロジェクト全体のステータスを確認

## 重要な制約事項

- **クリーンコンテキスト**: 各タスクは新しいサブエージェントで実行（resumeなし）
- **順次実行のみ**: 一度に1タスクずつ、順番に
- **スキップ禁止**: `*` マークされたオプションタスクを含むすべての未完了タスクを実行
- **簡潔な出力**: サブエージェントからはテスト結果とサマリーのみ表示（完全な実行ログは不要）
- **適切なフォーマット**: 可読性のためにセクションを空行で区切る
- **エラー処理**: タスクが失敗した場合は報告して停止（次に進まない）
- **日本語での応答**: すべての出力・サマリーは日本語で行う

## ツールガイダンス

- **Read**: まずCLAUDE.mdを読み込み、次に発見したパスからspec.jsonとtasks.mdを読み込む
- **Grep**: CLAUDE.mdからSpecsパスを抽出、tasks.mdから未完了タスクを検索
- **Task**: 各タスクに新しいサブエージェントを起動（general-purposeタイプ）
- **resumeしない**: 各Task呼び出しは新しいエージェントを作成

## Output Description

**すべての出力は日本語で行う**

**初期ステータス** (開始時):
```
📋 フィーチャー '{feature-name}' の未完了タスクが {count} 件見つかりました
実行予定タスク: {task-numbers}

クリーンなコンテキストで順次実行を開始します...
```

**実行中** (タスクごと):
- **重要**: 出力はMarkdownとしてレンダリングされます - 適切な改行を使用
- **方法1**: 各行末に2つのスペースを追加してハード改行
- **方法2**: 空行でセクションを区切る（段落区切り）
- 出力形式の例:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 タスク 13.1/15: SettingsPanel コンポーネントの実装
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔄 クリーンなサブエージェントを起動中...

📝 タスクサマリー:
• 実装した内容の簡潔な説明
• テスト結果（成功/失敗）
• 主要な変更点
（10行以内で簡潔に）

✅ タスク 13.1 完了
```

注: 各行末の `  `（スペース2つ）でMarkdownのハード改行になります。
空行は段落区切りを作成します。

**最終サマリー**:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎉 すべてのタスクが正常に完了しました！
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

実行したタスク: {task-numbers}
合計: {count} タスク

✨ 次のステップ:
• /kiro:validate-impl {feature-name} を実行して実装を検証
• /kiro:spec-status {feature-name} を実行して全体の進捗を確認
```

**フォーマット**:
- 視覚的な区切りで明確な進捗更新
- Markdown改行を使用: 行末2スペース、または段落区切りの空行
- テスト結果＋簡潔なサマリーのみ（ステップバイステップのログは不要）
- **サマリーは必ず日本語で、10行以内に収める**

## Safety & Fallback

### エラーシナリオ

**CLAUDE.mdが見つからない場合**:
- **フォールバック**: デフォルトパス `.kiro/specs` を使用
- **警告**: 「CLAUDE.mdが見つかりません。デフォルトのspecsパスを使用: .kiro/specs」

**Specが見つからない場合**:
- **実行停止**: Specが存在する必要があります
- **メッセージ**: 「フィーチャー '$1' が {specs-path}/ に見つかりません」
- **アクション**: 「フィーチャー名を確認するか、`/kiro:spec-init` を先に実行してください」

**タスクが承認されていない場合**:
- **実行停止**: タスクは承認されている必要があります
- **メッセージ**: 「フィーチャー '$1' のタスクが承認されていません」
- **アクション**: 「`/kiro:spec-tasks $1` を実行し、タスクを承認してください」

**タスク実行失敗**:
- **実行停止**: タスクが失敗した場合は続行しない
- **メッセージ**: 「タスク {task-number} がエラーで失敗: {error}」
- **アクション**: 「エラーを確認し、問題を修正してから `/impl-tasks $1` を再実行してください」

**未完了タスクがない場合**:
- **正常終了**: すべてのタスクが完了済み
- **メッセージ**: 「✅ フィーチャー '$1' のすべてのタスクは完了済みです」

### 使用例

**すべての未完了タスクを実行**:
- `/impl-tasks my-feature`

**完了後**:
- `/kiro:validate-impl my-feature` - 実装を検証
- `/kiro:spec-status my-feature` - 全体のステータスを確認

think
