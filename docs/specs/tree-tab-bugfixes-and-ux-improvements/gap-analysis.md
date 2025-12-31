# ギャップ分析ドキュメント

## 概要

本ドキュメントは、Vivaldi Tree Tab拡張機能の11件のバグ修正・UX改善に関する要件と既存コードベースのギャップを分析した結果をまとめたものである。

## 要件ごとのギャップ分析

### Requirement 1: E2Eテストの安定性

#### 現状分析

**対象テスト:**
1. `e2e/tab-grouping.spec.ts:853` - 「単一タブをグループ化しても実タブのグループ親が作成される」
2. `e2e/tab-persistence.spec.ts:201` - 「タブ内でのページ遷移時にタイトルの永続化データが更新されること」

**既存実装:**
- ポーリングユーティリティ: `e2e/utils/polling-utils.ts`
- `waitForCondition`、`waitForTabInTreeState`などの状態確定待機が実装済み

**ギャップ:**
- 両テストがフレーキーである原因の特定が必要
- 固定時間待機（`waitForTimeout`）の使用有無を確認

**実装アプローチ:**
| オプション | 内容 | メリット | デメリット |
|---------|------|---------|-----------|
| A. 待機処理の改善 | ポーリングベースの状態確定待機に修正 | 既存パターン踏襲 | 根本原因の特定が必要 |
| B. タイムアウト増加 | タイムアウト値を延長 | 簡単 | 根本解決ではない（禁止事項） |

**推奨:** オプションA - 根本原因を特定し、ポーリングベース待機に修正

**工数:** S（1-3日）
**リスク:** Low - 既存パターンが確立

---

### Requirement 2: ドラッグによるタブ並び替え

#### 現状分析

**関連ファイル:**
- `src/sidepanel/hooks/useDragDrop.ts` - 自前D&D実装
- `src/sidepanel/components/TabTreeView.tsx` - ドロップハンドリング
- `src/sidepanel/components/GapDropDetection.ts` - ドロップ位置判定
- `src/background/event-handlers.ts` - バックグラウンド同期

**既存機能:**
- ✅ ドラッグ開始・移動・終了イベント処理
- ✅ ドロップターゲット（Gap/Tab）判定
- ✅ DropIndicatorによる視覚的フィードバック

**ギャップ:**
- 「ドラッグして並び替えるとブラウザのタブは並び替わるが、拡張機能側のツリービューのタブが並び替わらない」問題
- Chrome APIの`chrome.tabs.move`呼び出し後のツリー状態更新処理を調査する必要あり
- `onTabMoved`イベントハンドラーの実装確認が必要

**実装アプローチ:**
| オプション | 内容 | メリット | デメリット |
|---------|------|---------|-----------|
| A. イベントハンドラー修正 | `handleTabMoved`でツリー状態を適切に更新 | 既存アーキテクチャ内で解決 | イベント順序の複雑さ |
| B. 楽観的UI更新 | ドラッグ終了時にまずUIを更新し、その後Chrome API呼び出し | 即時フィードバック | 同期ずれのリスク |

**推奨:** オプションA - バックグラウンドの`handleTabMoved`イベントハンドラーを調査・修正

**調査事項:**
- `chrome.tabs.onMoved`リスナーの存在と実装内容
- TreeStateManagerの並び替え処理

**工数:** M（3-7日）
**リスク:** Medium - イベント順序とステート同期の複雑さ

---

### Requirement 3: タブグループ化機能

#### 現状分析

**関連ファイル:**
- `src/sidepanel/components/ContextMenu.tsx` - 「タブをグループ化」メニュー
- `src/sidepanel/hooks/useMenuActions.ts` - `'group'`アクション実行
- `src/background/event-handlers.ts:849-913` - `handleCreateGroup`実装
- `src/services/TreeStateManager.ts:656-735` - `createGroupWithRealTab`
- `src/group/GroupPage.tsx` - グループページUI
- `group.html` - グループページエントリポイント

**既存機能:**
- ✅ コンテキストメニューに「タブをグループ化」項目あり
- ✅ `CREATE_GROUP`メッセージハンドラー実装済み
- ✅ `chrome-extension://xxx/group.html`ページ実装済み
- ✅ 単一タブのグループ化ロジック（Task 16.6）実装済み

**ギャップ:**
- 「グループ化が全く動いていない」という報告 → 実際の動作を検証する必要あり
- 以下の問題箇所を調査:
  1. `useMenuActions`の`'group'`アクションがメッセージを正しく送信しているか
  2. Service Workerがメッセージを受信・処理しているか
  3. グループタブ作成後の状態更新が正しく行われているか

**調査事項（Research Needed）:**
- グループ化が動作しない具体的なシナリオの特定
- コンソールエラーの確認
- Chrome DevToolsでのメッセージ送受信の確認

**実装アプローチ:**
| オプション | 内容 | メリット | デメリット |
|---------|------|---------|-----------|
| A. デバッグ・修正 | 既存実装の問題箇所を特定して修正 | 既存コードを活用 | 問題箇所の特定に時間がかかる可能性 |
| B. リファクタリング | グループ化フロー全体を再設計 | 根本的な解決 | 工数増大 |

**推奨:** オプションA - 既存実装のデバッグを優先

**工数:** M（3-7日）
**リスク:** Medium - 問題箇所の特定が必要

---

### Requirement 4: クロスウィンドウドラッグ

#### 現状分析

**関連ファイル:**
- `src/background/drag-session-manager.ts` - クロスウィンドウセッション管理
- `src/sidepanel/hooks/useCrossWindowDrag.ts` - クロスウィンドウ受信
- `src/sidepanel/components/CrossWindowDragHandler.tsx` - 統合コンポーネント
- `src/sidepanel/hooks/useDragDrop.ts` - 外部ドロップ判定（`dragOutBoundaryRef`）

**既存機能:**
- ✅ `DragSessionManager`による状態マシン管理
- ✅ `GET_DRAG_SESSION`、`BEGIN_CROSS_WINDOW_MOVE`メッセージ処理
- ✅ セッションタイムアウト処理（10秒、クロスウィンドウ2秒）
- ✅ `useCrossWindowDrag`フックでmouseenterイベント処理

**ギャップ:**
- 「別ウィンドウからタブをドラッグしてこれない」問題
- 現状ではドラッグアウト（新ウィンドウ作成）と判定される
- ターゲットウィンドウのサイドパネルへのmouseenter検出が機能していない可能性

**調査事項（Research Needed）:**
- サイドパネルがmouseenterイベントを受信しているか
- `GET_DRAG_SESSION`レスポンスが正しく返されているか
- 別ウィンドウからのドラッグ時のマウスイベント伝播

**実装アプローチ:**
| オプション | 内容 | メリット | デメリット |
|---------|------|---------|-----------|
| A. イベント検出修正 | mouseenterイベントの検出方法を改善 | 既存アーキテクチャ内 | ブラウザ制約の可能性 |
| B. メッセージング強化 | バックグラウンドからUIへのプッシュ通知追加 | より確実な検出 | 複雑さ増加 |
| C. drag-over検出追加 | ウィンドウ全体のdragoverイベントを監視 | HTML5 DnDの活用 | 自前D&Dとの統合が複雑 |

**推奨:** オプションA → Bの順で調査

**工数:** L（1-2週間）
**リスク:** High - ブラウザの制約やクロスウィンドウイベントの複雑さ

---

### Requirement 5: 空ウィンドウの自動クローズ

#### 現状分析

**関連ファイル:**
- `src/background/event-handlers.ts:655-735` - `handleCreateWindowWithSubtree`

**既存機能:**
- ✅ Task 14.1として実装済み
- ✅ サブツリー移動後に`chrome.tabs.query({ windowId })`で残りタブを確認
- ✅ タブが0件の場合`chrome.windows.remove(sourceWindowId)`を実行

**ギャップ:**
- 「ドラッグアウトでタブを全て移動させたウィンドウが自動的に閉じない」問題
- 実装コードは存在するが、以下の可能性を調査:
  1. `sourceWindowId`が正しく渡されていない
  2. `chrome.tabs.query`が正しいタブ数を返していない
  3. エラーが発生しているがサイレントに無視されている

**調査事項（Research Needed）:**
- ドラッグアウト時の`CREATE_WINDOW_WITH_SUBTREE`メッセージ送信を確認
- `sourceWindowId`パラメータの値を確認

**実装アプローチ:**
| オプション | 内容 | メリット | デメリット |
|---------|------|---------|-----------|
| A. デバッグ・修正 | 既存実装の問題箇所を修正 | 既存コードを活用 | - |
| B. イベント追加 | `onTabRemoved`時に空ウィンドウチェック | より確実 | 複数トリガー管理 |

**推奨:** オプションA - 既存実装のデバッグを優先

**工数:** S（1-3日）
**リスク:** Low - 既存実装の修正

---

### Requirement 6: ビューへの新規タブ追加

#### 現状分析

**関連ファイル:**
- `src/services/ViewManager.ts` - ビュー管理
- `src/sidepanel/providers/TreeStateProvider.tsx` - `switchView`実装
- `src/background/event-handlers.ts` - `handleTabCreated`での`getCurrentViewId()`
- `src/sidepanel/components/ViewSwitcher.tsx` - ビュー切り替えUI

**既存機能:**
- ✅ ビュー作成・削除・切り替え機能
- ✅ 新規タブ作成時に`currentViewId`を取得してタブに割り当て
- ✅ `TreeState.currentViewId`でアクティブビューを管理

**ギャップ:**
- 「ビューを開いた状態で新しいタブを開いてもそのビューが閉じてしまって元のビューに新しいタブが追加されてしまう」問題
- 根本原因：**非同期同期の競合**
  1. UIで`switchView('view-xxx')`を実行→ストレージ更新
  2. ほぼ同時にChrome APIで新規タブ作成→`handleTabCreated`実行
  3. `getCurrentViewId()`がストレージから読み込む時点で、まだビュー切り替えが反映されていない可能性

**調査事項（Research Needed）:**
- ストレージ更新のタイミングと`getCurrentViewId()`読み込みの競合
- `chrome.storage.onChanged`リスナーの発火タイミング

**実装アプローチ:**
| オプション | 内容 | メリット | デメリット |
|---------|------|---------|-----------|
| A. ストレージ同期強化 | `switchView`完了を確認してからタブ作成を許可 | 確実な同期 | UX遅延 |
| B. バックグラウンド状態管理 | Service Worker内で`currentViewId`をメモリ管理 | 高速な読み取り | 状態の二重管理 |
| C. メッセージベース同期 | タブ作成前にUIからビューIDを通知 | 確実 | フロー変更 |

**推奨:** オプションB - バックグラウンドでの状態キャッシュ

**工数:** M（3-7日）
**リスク:** Medium - 状態同期の複雑さ

---

### Requirement 7: 設定タブの名前表示

#### 現状分析

**関連ファイル:**
- `settings.html` - 設定ページHTMLエントリポイント
- `src/settings/SettingsPage.tsx` - 設定ページコンポーネント

**既存機能:**
- ✅ `settings.html`のtitleは「Vivaldi-TT 設定」と設定済み

**ギャップ:**
- 「設定タブの名前が『新しいタブ』になっている」問題
- `settings.html`には正しいtitleが設定されているため、以下を確認:
  1. ビルド後の`dist/settings.html`のtitle
  2. タブのタイトル更新タイミング（Reactマウント前のtitle表示）
  3. ブラウザによるデフォルトtitle表示

**調査事項（Research Needed）:**
- 実際のビルド成果物でtitleが正しいか確認
- Chrome拡張機能でのHTMLタイトル反映タイミング

**実装アプローチ:**
| オプション | 内容 | メリット | デメリット |
|---------|------|---------|-----------|
| A. HTMLタイトル確認・修正 | ビルド設定を確認し、titleが正しく出力されるように修正 | 根本解決 | - |
| B. document.title設定 | Reactコンポーネントで`document.title`を明示的に設定 | 確実 | 冗長 |

**推奨:** オプションA - ビルド成果物の確認を優先

**工数:** S（1-3日）
**リスク:** Low - 単純な修正

---

### Requirement 8: 未読インジケーターのUI改善

#### 現状分析

**関連ファイル:**
- `src/sidepanel/components/UnreadBadge.tsx` - 現在の未読バッジ実装
- `src/sidepanel/components/TreeNode.tsx` - タブノードコンポーネント

**既存機能:**
- ✅ `UnreadBadge`コンポーネント実装済み
- ✅ 現在のUI: 右側の青い丸（`w-2 h-2 bg-blue-500 rounded-full`）

**ギャップ:**
- 要件: 「左下の角に小さい三角形の切り欠きを重ねる」
- 現在のUI: 右側の青い丸

**実装アプローチ:**
| オプション | 内容 | メリット | デメリット |
|---------|------|---------|-----------|
| A. CSSで三角形実装 | border-hackまたはclip-pathで三角形を作成 | 軽量 | CSSの複雑さ |
| B. SVGアイコン | SVG要素で三角形を描画 | 自由度高い | ファイル追加 |
| C. Unicode文字 | 三角形のUnicode文字を使用 | シンプル | フォント依存 |

**推奨:** オプションA - CSSによる実装

**工数:** S（1-3日）
**リスク:** Low - UI変更のみ

---

### Requirement 9: ファビコンの永続化復元

#### 現状分析

**関連ファイル:**
- `src/background/event-handlers.ts:304-316` - ファビコン永続化
- `src/storage/StorageService.ts` - `TAB_FAVICONS`ストレージキー

**既存機能:**
- ✅ タブ更新時にファビコンURLを永続化
- ✅ タブ削除時にファビコンデータを削除

**ギャップ:**
- 「ブラウザを開き直したときにファビコンが復元されない」問題
- 永続化は実装済みだが、**復元時にストレージから読み込んでUIに反映する処理が不完全**
- Chrome APIの`chrome.tabs.Tab.favIconUrl`が空の場合にフォールバックとして永続化データを使用する処理が必要

**調査事項（Research Needed）:**
- `TabInfo`構築時のファビコンURL取得ロジック
- ブラウザ再起動直後のタブの`favIconUrl`の状態

**実装アプローチ:**
| オプション | 内容 | メリット | デメリット |
|---------|------|---------|-----------|
| A. TreeStateProviderで復元 | タブ情報構築時にストレージからフォールバック | 既存フローへの統合 | 非同期処理の追加 |
| B. Service Workerで復元 | 起動時にファビコンを一括復元してブロードキャスト | 一元管理 | メッセージング追加 |

**推奨:** オプションA - UI層でのフォールバック実装

**工数:** M（3-7日）
**リスク:** Medium - 非同期処理と状態同期

---

### Requirement 10: タブ複製時の配置

#### 現状分析

**関連ファイル:**
- `src/background/event-handlers.ts:53-65` - `pendingDuplicateSources`管理
- `src/background/event-handlers.ts:175-193` - 複製タブの配置ロジック
- `src/sidepanel/hooks/useMenuActions.ts` - `'duplicate'`アクション

**既存機能:**
- ✅ Task 4.2として実装済み
- ✅ `pendingDuplicateSources`セットで複製元タブを追跡
- ✅ 複製タブは元のタブの`parentId`を引き継いで兄弟として配置

**ギャップ:**
- 「タブを複製すると子タブになってしまう」問題
- 実装コードは存在するが、以下を確認:
  1. `pendingDuplicateSources`への登録タイミング
  2. `handleTabCreated`での`isDuplicatedTab`判定

**調査事項（Research Needed）:**
- `REGISTER_DUPLICATE_SOURCE`メッセージの送信タイミング
- `pendingDuplicateSources`のライフサイクル

**実装アプローチ:**
| オプション | 内容 | メリット | デメリット |
|---------|------|---------|-----------|
| A. デバッグ・修正 | 既存実装の問題箇所を修正 | 既存コードを活用 | - |
| B. Chrome API利用 | `chrome.tabs.duplicate`後の`openerTabId`を直接使用 | シンプル | Chrome API依存 |

**推奨:** オプションA - 既存実装のデバッグ

**工数:** S（1-3日）
**リスク:** Low - 既存実装の修正

---

### Requirement 11: 復元タブの未読状態

#### 現状分析

**関連ファイル:**
- `src/services/UnreadTracker.ts` - 未読状態管理
- `src/background/service-worker.ts:85-100` - 起動時の未読クリア処理

**既存機能:**
- ✅ `UnreadTracker.clear()`で起動時に未読状態を全削除
- ✅ `setInitialLoadComplete()`で起動完了をマーク
- ✅ `markAsUnread()`は`initialLoadComplete`がtrueの場合のみ動作

**ギャップ:**
- 「ブラウザを開き直したときに復元されたタブに未読インジケーターが付く」問題
- 理論上は起動時に`clear()`で未読状態がクリアされるはずだが、以下を確認:
  1. `loadFromStorage()`と`clear()`の実行順序
  2. UIレンダリングタイミングと未読状態の競合

**調査事項（Research Needed）:**
- Service Worker起動時の非同期処理順序
- `chrome.storage.onChanged`リスナーの発火タイミング

**実装アプローチ:**
| オプション | 内容 | メリット | デメリット |
|---------|------|---------|-----------|
| A. 順序保証強化 | `loadFromStorage`を`await`してから`clear`を実行 | 確実な順序 | 起動時間増加 |
| B. 復元タブフラグ | 復元タブを識別するフラグを追加 | 明示的な制御 | 状態追加 |

**推奨:** オプションA - 非同期処理の順序を厳密に制御

**工数:** S（1-3日）
**リスク:** Low - 非同期処理の順序修正

---

### Requirement 12: E2Eテスト品質基準

#### 現状分析

**関連ファイル:**
- `e2e/utils/polling-utils.ts` - ポーリングユーティリティ
- `docs/steering/tech.md` - E2Eテスト品質基準の記載

**既存機能:**
- ✅ ポーリングベース待機ユーティリティ多数実装済み
- ✅ Chrome Background Throttling対策（`bringToFront()`、`window.focus()`）

**ギャップ:**
- 各修正に対応するE2Eテストを追加・修正する必要がある
- `--repeat-each=10`での安定性検証が必要

**実装アプローチ:**
- 各Requirementの実装完了後にE2Eテストを追加
- 既存テストパターンを踏襲
- `waitForTimeout`は使用禁止、ポーリングベース待機を使用

**工数:** 各要件に含まれる
**リスク:** Low - 既存パターンが確立

---

## 全体サマリー

### 工数・リスク一覧

| Requirement | 工数 | リスク | 推奨アプローチ |
|------------|------|--------|--------------|
| 1. E2Eテスト安定性 | S | Low | ポーリングベース待機に修正 |
| 2. タブ並び替え | M | Medium | イベントハンドラー修正 |
| 3. タブグループ化 | M | Medium | 既存実装のデバッグ |
| 4. クロスウィンドウドラッグ | L | High | イベント検出修正 |
| 5. 空ウィンドウ自動クローズ | S | Low | 既存実装のデバッグ |
| 6. ビューへの新規タブ追加 | M | Medium | バックグラウンド状態管理 |
| 7. 設定タブ名 | S | Low | ビルド成果物確認 |
| 8. 未読インジケーターUI | S | Low | CSS三角形実装 |
| 9. ファビコン復元 | M | Medium | UI層でのフォールバック |
| 10. タブ複製配置 | S | Low | 既存実装のデバッグ |
| 11. 復元タブ未読状態 | S | Low | 非同期順序制御 |
| 12. E2Eテスト品質 | - | Low | 各要件に含む |

### 全体工数見積もり

- **S（1-3日）**: 6件（Req 1, 5, 7, 8, 10, 11）
- **M（3-7日）**: 4件（Req 2, 3, 6, 9）
- **L（1-2週間）**: 1件（Req 4）

**合計見積もり:** M〜L（2-3週間程度）

### 優先度推奨

**高優先度（機能に直接影響）:**
1. Requirement 3: タブグループ化（機能が動作しない）
2. Requirement 2: タブ並び替え（UXに重大な影響）
3. Requirement 4: クロスウィンドウドラッグ（機能が動作しない）

**中優先度（UX改善）:**
4. Requirement 6: ビューへの新規タブ追加
5. Requirement 9: ファビコン復元
6. Requirement 5: 空ウィンドウ自動クローズ
7. Requirement 10: タブ複製配置

**低優先度（軽微な問題）:**
8. Requirement 7: 設定タブ名
9. Requirement 8: 未読インジケーターUI
10. Requirement 11: 復元タブ未読状態
11. Requirement 1: E2Eテスト安定性

---

## 設計フェーズへの引き継ぎ事項

### Research Needed（設計フェーズで調査）

1. **タブ並び替え**: `chrome.tabs.onMoved`イベントの処理フローと状態同期
2. **タブグループ化**: 具体的な障害箇所のデバッグログ分析
3. **クロスウィンドウドラッグ**: サイドパネルでのmouseenterイベント受信状況
4. **ビュー新規タブ**: ストレージ更新と読み込みのタイミング競合
5. **ファビコン復元**: ブラウザ再起動直後のタブの`favIconUrl`状態

### 既存アセットの活用

- ポーリングユーティリティ: `e2e/utils/polling-utils.ts`
- ドラッグ&ドロップ: `useDragDrop`, `GapDropDetection`
- クロスウィンドウ: `DragSessionManager`, `useCrossWindowDrag`
- ストレージ: `StorageService`, `TreeStateManager`
- 未読管理: `UnreadTracker`

### アーキテクチャ上の考慮事項

1. **状態同期パターン**: Service Worker（バックグラウンド）とReact（UI）間の状態同期
2. **メッセージパッシング**: `chrome.runtime.sendMessage`による非同期通信
3. **ストレージ競合**: `chrome.storage.local`への同時書き込み
4. **イベント順序**: Chrome APIイベントと状態更新の順序保証
