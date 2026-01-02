# Technology Stack

## Architecture

Chrome Extension Manifest V3アーキテクチャを採用。Service WorkerとSide Panelで構成され、タブ管理ロジックとUIを分離しています。

## Core Technologies

- **Language**: TypeScript 5.5+ (strict mode)
- **Framework**: React 18 (react-jsx transform)
- **Runtime**: Chrome Extensions API (Manifest V3)
- **Build Tool**: Vite 5 + @crxjs/vite-plugin
- **Styling**: Tailwind CSS 3

## Key Libraries

- **自前D&D実装**: ドラッグ&ドロップ機能（useDragDrop, useAutoScroll, DragOverlay）
- **React Testing Library + Vitest**: コンポーネントテスト
- **Playwright**: Chrome拡張機能のE2Eテスト
- **fake-indexeddb**: ストレージテスト用のモック

## Development Standards

### Type Safety（必須）

- TypeScript strict mode有効（`strict: true`）
- `noUnusedLocals`, `noUnusedParameters`でコード品質を保証
- Chrome APIは`@types/chrome`による型定義を使用
- **型エラーゼロは必須**: 各機能追加で`npm run type-check`がエラーなしで通過すること
- **`any`の使用禁止**: プロダクションコード・テストコード両方で`any`は基本禁止
  - 例外: 外部ライブラリの型定義が`any`を使用している場合のみ許容
  - 自分が実装する範囲内では`any`を使う必要はない

### Code Quality
- **ESLint**: TypeScript/React推奨設定 + Prettier統合
- **Prettier**: 自動フォーマット（`.ts`, `.tsx`, `.css`対象）
- **Linting**: `npm run lint`でチェック、`lint:fix`で自動修正

### コメント規約（必須）

**タスク番号・Requirements番号・作業中メモのコメント禁止**

ソースコードにタスク番号、Requirements番号、作業中のメモをコメントとして残すことは**禁止**です。

```typescript
// ❌ 禁止: タスク番号コメント
// Task 13.1: ウィンドウID対応
// Task 2.1 (tab-tree-bugfix): ファビコン永続化

// ❌ 禁止: Requirements番号コメント
// Requirement 6.1: タブグループ機能
// Requirements: 8.1, 8.2, 8.3

// ❌ 禁止: 作業中メモ
// TODO: 後で修正
// FIXME: あとで直す
// WIP: 作業中

// ✅ 許可: 仕様・理由の説明
// ピン留めタブは通常タブと別管理するため除外
// Chrome APIの制約により非同期で取得
```

**理由**:
- タスク番号・Requirements番号は開発順序管理や追加機能開発時の増分の仕様管理用であり仕様のマスターデータではないため、コードを読む際には無関係
- 番号だけではどの機能・仕様を指すか判別できず、コードを読む際の邪魔になる
- 作業中メモは永続化すべき情報ではなく、コードベースを汚染する

**コメントに書くべきもの**:
- 「なぜ」そのコードが必要かの説明
- 非自明なロジックの意図
- Chrome API等の制約・仕様への言及（番号ではなく内容を説明）

**コメントに書くべきでないもの**:
- タスク番号（`Task X.X`）
- Requirements番号（`Requirement X.X`）
- 作業中メモ（TODO, FIXME, WIP）
- 一時的なデバッグ情報

### Error Handling（シンプルさ優先）

**方針**: 保守性を最優先し、コードに複雑性を追加してまで過剰なエラーハンドリングは行わない

- **エッジケースの割り切り**: ほとんど発生しない競合状態や異常系に対して、複雑なロジックを追加しない
- **サイレント無視**: エッジケースでの状態不整合やデータ消失は許容し、エラーを安全に無視する
- **シンプルな実装**: 失敗がほとんど起こり得ない部分について、デバウンス、リトライ、複雑な状態管理より、単純な処理フローを選択
- **保守性 > 完璧性**: ほとんど起こり得ないエラーに対処するためにコードに複雑性を追加してエラーハンドリングするのはコードベースの保守性を大きく低下させる

### Testing（必須要件）
- **Vitest**: 高速なユニット/統合テスト
- **Testing Library**: Reactコンポーネントのユーザー視点テスト
- **Playwright**: Chrome拡張機能のE2Eテスト
- テスト種別: `*.test.ts(x)`, `*.integration.test.tsx`, `e2e/*.spec.ts`

## 機能追加時の必須要件

### テスト完全通過（必須）

**全ての機能追加で以下を確認すること:**

1. **既存テストの通過**: `npm test` と `npm run test:e2e` が全てパスすること
2. **型チェック通過**: `npm run type-check` がエラーなしで通過すること
3. **新機能のテスト追加**: 新機能には対応するテスト（ユニット/統合/E2E）を追加すること

### E2Eテスト追加時の必須検証（タスク完了条件）

**タスクでE2Eテストを追加する場合、以下を必ず検証すること:**

1. **フレーキーでないことの確認**:
   - 新規E2Eテストは`--repeat-each=10`で10回連続成功すること
   - 固定時間待機（`waitForTimeout`）は禁止、ポーリングで状態確定を待つこと
   - 状態変化の検出は`is-dragging`クラスなどの**DOMの実際の状態**を監視すること

2. **実行時間の最適化**:
   - 各テストケースは**必要十分な短い時間**で完了すること
   - 不必要に長いタイムアウト設定（8秒→3秒など）は避けること
   - 遅いテストは原因を調査し根本解決すること（タイムアウト増加は対症療法）

```bash
# タスク完了前に必ず実行
npx playwright test --repeat-each=10 path/to/new.spec.ts

# 実行時間も確認（異常に長いテストがないか）
```

**これらの検証を行わずにE2Eテストタスクを完了とすることは禁止です。**

### 既存E2Eテストの確認と修正

新機能を追加する際は:
- **全E2Eテストを確認**: 既存テストに影響がないか確認
- **シナリオ修正の必要性を判断**: UIや挙動の変更により修正が必要なテストを特定
- **修正タスクの追加**: 必要な修正をタスクリストに積むこと

### UI削除時のE2Eテスト対応（必須）

**重要**: UIを削除した際は、そのUIに関連するE2Eテストも同時に削除すること。

- **テストのスキップは禁止**: `test.skip()`で一時的に無効化してコードを残してはいけない
- **不要なテストは完全削除**: 削除されたUIのE2Eテストファイルや関連フィクスチャも削除する
- **関連テストデータも削除**: `e2e/test-data/`内の関連フィクスチャファイルも削除する

```typescript
// ❌ BAD: スキップしてコードを残す
test.skip('削除されたUIの操作テスト', async () => { ... });

// ✅ GOOD: テストファイル・テストコード自体を削除
// （ファイルを削除、またはdescribe/testブロックを完全に削除）
```

**チェックリスト**:
1. 削除するUI要素を特定
2. そのUIに関連するE2Eテストを検索（`grep`で検索）
3. テストファイル全体が不要な場合はファイルを削除
4. テストの一部が不要な場合はそのテストブロックを削除
5. 関連するテストフィクスチャ・定数も削除

### E2Eテスト品質基準

#### フレーキーテストの回避（必須）

**固定時間待機（`waitForTimeout`）は禁止**。ポーリングで状態確定を待つこと:

```typescript
// ❌ BAD: 固定時間待機
await page.waitForTimeout(500);

// ✅ GOOD: ポーリングで状態確定を待機
await waitForTabInTreeState(context, tabId);
await waitForParentChildRelation(context, childTabId, parentTabId);
```

利用可能なポーリングユーティリティ（`e2e/utils/polling-utils.ts`）:
- `waitForTabInTreeState` - タブがツリーに追加されるまで待機
- `waitForTabRemovedFromTreeState` - タブがツリーから削除されるまで待機
- `waitForParentChildRelation` - 親子関係が反映されるまで待機
- `waitForTabActive` - タブがアクティブになるまで待機
- `waitForSidePanelReady` - Side Panelの準備完了まで待機
- その他多数

#### フレーキーテスト検証（必須）

新規E2Eテスト追加時は以下で安定性を検証:

```bash
# 10回以上繰り返し実行して100%通過を確認
npx playwright test --repeat-each=10 path/to/new.spec.ts
```

#### Chrome Background Throttling対策

**重要**: ChromeはバックグラウンドタブでタイマーとrequestAnimationFrameを1秒間隔にスロットリングします。

**解決策**: ドラッグ操作前にページをフォーカス状態にする

```typescript
// バックグラウンドスロットリングを回避
await sidePanelPage.bringToFront();
await sidePanelPage.evaluate(() => window.focus());

// この後でドラッグ操作を実行
await startDrag(sidePanelPage, tabId);
```

この対策を怠ると`mouse.move`が958ms（本来7ms）かかり、ドラッグ&ドロップの衝突検出が1秒間隔でしか動作しなくなります。

#### テスト実行時間の最適化

- E2Eテストは**必要十分な短い時間**で実行されること
- 本質的に待機が必要なタスク以外で時間がかかる場合は**原因を調査して修正**すること
- 遅いテストの原因例:
  - 不必要なwaitForTimeout
  - 非効率なセレクタ
  - 過度なリトライ設定

#### テストコードの均質性

新規テストを書く際は:
- **既存テストを参照**: 類似テストのコーディングパターンを踏襲
- **共通ユーティリティを活用**: `e2e/utils/`の関数を再利用
- **命名規則を遵守**: `*.spec.ts`形式、describe/test構造

#### Playwrightデバッグ用コードの使用禁止（必須）

**`page.pause()`などユーザー操作を待機するPlaywrightのデバッグ機能は使用禁止です。**

```typescript
// ❌ BAD: 使用禁止
await page.pause();  // Playwrightインスペクタが開きユーザーが閉じるまでブロック
```

**理由**: ローカルでClaude Codeがテスト実行・修正を行う際、ユーザーがウィンドウを閉じる操作を頻繁に求められると、コード修正をClaude Codeに任せられなくなります。テストは常に完全自動で実行できる状態を維持してください。

## Development Environment

### Required Tools
- Node.js 20+ (package.json `type: "module"`)
- npm (依存関係管理)
- Vivaldi Browser (動作確認用)

### Common Commands
```bash
# Dev: npm run dev (Vite開発サーバー)
# Build: npm run build (TypeScript type-check + Vite bundle)
# Test: npm test (Vitest watch mode)
# Type Check: npm run type-check
```

## Key Technical Decisions

- **Vite + @crxjs/vite-plugin**: 高速なHMRと拡張機能ビルドを両立
- **IndexedDB**: 大量タブデータの永続化（chrome.storageの容量制限回避）
- **Service Worker**: バックグラウンドでのタブイベント監視とツリー同期
- **Options Page**: 独立した設定画面（chrome.runtime.openOptionsPage()）でユーザー設定を管理
- **Path Alias `@/`**: `./src/`へのエイリアスで、深いネストでもインポートパスを簡潔に維持
- **複数ウィンドウ対応**: TreeStateProviderでwindowIdを取得し、各ウィンドウで自身のタブのみをフィルタリング表示
- **無彩色UIパレット**: Tailwind CSSの`gray`を`neutral`で上書きし、ダークブルーを排除した無彩色UIを実現
- **DragSessionManager**: クロスウィンドウドラッグでService Workerを中継点として使用。ドラッグセッション情報（タブID、ウィンドウID、状態）を一元管理し、異なるウィンドウのSide Panel間でドラッグ状態を共有

---
_Document standards and patterns, not every dependency_
