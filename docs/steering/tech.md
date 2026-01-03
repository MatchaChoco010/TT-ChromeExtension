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
- テスト実装時の予測・メモ（「これが失敗するはず」「この時点ではこうなるはず」など）

#### デバッグログの放置禁止（必須）

**調査目的でデバッグログを追加することは許可されています。ただし、調査完了後にログを残して放置することは禁止です。**

```typescript
// ✅ 許可: 調査中に一時的にログを追加
console.log('Storage BEFORE:', storageState);
console.log(`UI state: depth=${depth}`);

// ❌ 禁止: 調査が終わった後もログを残して放置
// → 調査完了後は必ず削除すること
```

**理由**:
- デバッグログはテストの一時的なデバッグ用途であり、永続的に残すべきものではない
- ログが残っているとテスト出力が汚染され、本来の失敗メッセージが見づらくなる
- 調査が完了したら速やかにログを削除すること

**例外**:
- ビルドスクリプト（`global-setup.ts`のビルド進捗表示など）のユーザー向けメッセージは許可

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

#### 内部状態だけでなくUIの見た目も検証する（必須）

**E2Eテストでは、内部状態（ストレージ、メモリ上の状態）だけでなく、実際のUI上の見た目も検証すること。**

E2Eテストの目的は「ユーザーが実際に見る画面が正しいこと」を保証することです。内部状態が正しくても、UIに反映されていなければユーザーにとってはバグです。

```typescript
// ❌ BAD: 内部状態のみ検証
const treeState = await getStorageState();
expect(treeState.nodes[childId].parentId).toBe(parentId);
// ストレージは正しいが、UIに反映されているかは不明

// ✅ GOOD: 内部状態 + UIの見た目を両方検証
await waitForParentChildRelation(extensionContext, childTabId, parentTabId);
await waitForTabDepthInUI(sidePanelPage, childTabId, 1, { timeout: 3000 });
// ストレージが正しく、かつUIにも正しく表示されていることを確認
```

**検証すべきUI要素の例**:
- `data-depth`属性による親子関係の深さ
- `data-testid`による要素の存在確認
- CSSクラス（`is-active`, `is-dragging`など）による状態表示
- 要素の表示/非表示（`toBeVisible()`）
- テキスト内容やアイコンの表示

**なぜ重要か**:
- Service WorkerとSide Panel間の状態同期問題を検出できる
- レンダリングロジックのバグを検出できる
- ユーザー視点での品質を保証できる

#### 事後条件確認関数による網羅的検証（必須）

**E2Eテストでは、場当たり的に条件を確認するのではなく、事後条件確認用の関数を使って事後条件を網羅的に確認すること。**

**原則**: 事後条件確認では、一部の条件だけでなく**全ての状態を網羅的に確認すること**。

事後条件確認関数は`e2e/utils/assertion-utils.ts`に定義されており、以下が利用可能:

| 関数名 | 用途 |
|--------|------|
| `assertTabStructure` | 通常タブのツリー構造（順序・depth・アクティブビュー）を網羅的に検証 |
| `assertPinnedTabStructure` | ピン留めタブの構造（順序・アクティブビュー）を網羅的に検証 |
| `assertViewStructure` | ビューの構造（順序・アクティブビュー）を網羅的に検証 |
| `assertWindowClosed` | ウィンドウが閉じられたことを検証 |
| `assertWindowExists` | ウィンドウが存在することを検証（作成直後の確認用） |

**部分的な確認関数は作成禁止**:

「タブ数だけ確認」「特定のタブが存在するか確認」のような部分的な確認関数を作成してはいけない。例えば以下のような関数は禁止:

```typescript
// ❌ 禁止: 部分的な確認関数
assertWindowTabCount(context, windowId, 3);  // タブ数だけ確認
assertTabsInWindow(context, windowId, [tabId1, tabId2]);  // 特定タブの存在だけ確認

// ✅ 正解: 全ての状態を網羅的に確認
await assertTabStructure(page, windowId, [
  { tabId: tab1, depth: 0 },
  { tabId: tab2, depth: 1 },
  { tabId: tab3, depth: 0 },
], 0);
```

**理由**: 部分的な確認では見落としが発生する。「タブが3つある」ことを確認しても、順序やdepthが正しいかは不明。「特定のタブが存在する」ことを確認しても、余計なタブが存在しないかは不明。全ての状態を明示的に確認することで、意図しない状態変化を確実に検出できる。

**関数シグネチャ**:

```typescript
// UIアサーション（Page + windowId が必須）
assertTabStructure(page, windowId, expectedStructure, expectedActiveViewIndex, options?)
assertPinnedTabStructure(page, windowId, expectedStructure, expectedActiveViewIndex, options?)
assertViewStructure(page, windowId, expectedStructure, activeViewIndex, timeout?)

// Chrome APIアサーション（BrowserContext + windowId が必須）
assertWindowClosed(context, windowId, timeout?)
assertWindowExists(context, windowId, timeout?)
```

**重要**: `expectedActiveViewIndex`は必須引数であり、オプションではない。常に明示的にアクティブなビューを指定すること。

#### タブ操作後の構造検証（必須）

**すべてのタブ操作（create, move, close, その他全てのタブ操作等）の後には必ず`assertTabStructure`を呼び出すこと。**

`assertTabStructure`は事後条件を確認する関数であり、タブ操作を行った後に呼ばなくてよい例外はない。
タブが0個になる場合も`await assertTabStructure(page, windowId, [], 0);`を呼び出して、タブが確実に0個になったことを検証すること。

タブ操作は非同期でUIに反映されるため、操作直後にUI上の順序やdepthが期待通りであることを検証する必要がある。
`assertTabStructure`は期待する構造になるまで待機し、タイムアウト時にはテストを失敗させる。

```typescript
import { assertTabStructure } from './utils/assertion-utils';

// ✅ GOOD: タブ操作後に必ず構造を検証（windowIdとexpectedActiveViewIndexは必須）
await moveTabToParent(page, child, parent);
await assertTabStructure(page, windowId, [
  { tabId: parent, depth: 0 },
  { tabId: child, depth: 1 },
], 0);  // activeViewIndex = 0

// ✅ GOOD: タブを閉じた後も必ず検証（0個になる場合も）
await closeTab(context, lastTabId);
await assertTabStructure(page, windowId, [], 0);  // タブが0個であることを検証

// ❌ BAD: 検証なしで次の操作に進む
await moveTabToParent(page, child, parent);
// 構造が正しいか確認せずに次へ...

// ❌ BAD: タブが0個になる場合に検証をスキップ
await closeTab(context, lastTabId);
// 「タブが0個だから検証不要」は間違い
```

**このルールを守る理由**:
- タブ操作のPromiseがresolveしても、UIへの反映は非同期で遅れることがある
- 検証なしだと、操作が失敗しても気づかずテストが進行し、後続で意味不明なエラーになる
- 順序やdepthの検証をスキップすると、フレーキーテストの原因になる
- タブが0個の場合でも、UIに余計なタブが残っていないことを確認する必要がある

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
- `waitForTabDepthInUI` - UIのdata-depth属性が期待値になるまで待機
- `waitForTabVisibleInUI` - タブがUIに表示されるまで待機
- その他多数

#### 親子関係テストのUI検証（具体例）

上記の原則を親子関係テストに適用する場合:

```typescript
// ストレージ + UI両方を検証
await waitForParentChildRelation(extensionContext, childTabId, parentTabId);
await waitForTabDepthInUI(sidePanelPage, parentTabId, 0, { timeout: 3000 });
await waitForTabDepthInUI(sidePanelPage, childTabId, 1, { timeout: 3000 });
```

**親子関係で検証すべきシナリオ**:
- ドラッグ&ドロップによる親子関係作成後
- タブ作成時の親子関係設定後
- 親タブ削除後のサブツリー昇格後
- タブ移動操作後

#### フレーキーテスト検証（必須）

新規E2Eテスト追加時は以下で安定性を検証:

```bash
# 10回以上繰り返し実行して100%通過を確認
npx playwright test --repeat-each=10 path/to/new.spec.ts
```

#### E2Eテスト成功の判定方法（必須）

**テスト成功の判定は「0 failed」を明示的に確認すること。**

```bash
# ❌ BAD: passedの数だけを見る（failedを見落とす可能性）
npm run test:e2e 2>&1 | grep -E 'passed' | tail -1
# → "536 passed" と表示されても、別の行に "1 failed" がある可能性

# ✅ GOOD: failedの有無を明示的に確認
npm run test:e2e 2>&1 | grep -E '^\s+\d+ (failed|passed)'
# → "1 failed" があれば失敗、"0 failed" または failedが無ければ成功
```

**よくあるミス**:
- passedの数だけを確認し、failedの行を見落とす
- passedの数がばらつく（535, 534, 533）場合、「skippedの差」と誤解して調査しない
  → 実際はfailedが発生している可能性が高い

**正しい確認手順**:
1. テスト実行後、出力全体で "failed" を検索
2. passedの数が一定でない場合は必ず原因を調査
3. 成功は「failed が 0」であることを確認して初めて判定する

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
