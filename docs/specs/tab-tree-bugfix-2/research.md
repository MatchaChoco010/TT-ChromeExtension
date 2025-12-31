# Research & Design Decisions

## Summary
- **Feature**: `tab-tree-bugfix-2`
- **Discovery Scope**: Extension（既存システムのバグ修正と機能改善）
- **Key Findings**:
  - 既存のpolling-utils.tsは包括的なポーリングユーティリティを提供しており、フレーキーなテストの修正に活用できる
  - dnd-kitのautoScrollはconfigurableであり、スクロール範囲の制限を実装可能
  - クロスウィンドウドラッグにはService Workerを介した状態共有が既に実装されている

## Research Log

### E2Eテストのフレーキー問題
- **Context**: `tab-persistence.spec.ts:201:5`のテストが不安定に失敗する
- **Sources Consulted**: 既存のE2Eテストコード、polling-utils.ts
- **Findings**:
  - 現在のテストはwaitForConditionを使用しているが、ネットワーク遅延によりタイトル更新の検出が不安定になる可能性がある
  - example.com → example.orgへのナビゲーションでタイトル変更を待機するが、タイトル取得タイミングにフレーキー性がある
- **Implications**: より堅牢なポーリング戦略とタイムアウト設定の最適化が必要

### タブ間ドロップ位置の問題
- **Context**: タブとタブの隙間にドロップするとブラウザタブは並び替わるがツリービューが追従しない
- **Sources Consulted**: TabTreeView.tsx、GapDropDetection.ts、DragDropProvider.tsx
- **Findings**:
  - GapDropDetectionは隙間検出ロジックを持っている
  - handleDragEndでGap判定時にonSiblingDropを呼び出している
  - chrome.tabs.moveとツリー状態の同期に問題がある可能性
- **Implications**: ドロップ後のchrome.tabs.move呼び出しとツリー状態更新の同期を修正する必要がある

### ドラッグ時スクロール制限
- **Context**: ドラッグ中にコンテンツ範囲を超えたスクロールが発生する
- **Sources Consulted**: dnd-kit公式ドキュメント、TabTreeView.tsx
- **Findings**:
  - AUTO_SCROLL_CONFIGでスクロール設定をカスタマイズしている
  - layoutShiftCompensation: falseで補正を無効化している
  - スクロール可能量の制限はdnd-kitのautoScrollだけでは不十分な場合がある
- **Implications**: カスタムスクロール制限ロジックの実装が必要

### ドラッグアウト判定の問題
- **Context**: サイドパネル内の空白領域でもドラッグアウトと判定される
- **Sources Consulted**: DragMonitor、TabTreeView.tsx
- **Findings**:
  - DragMonitorはcontainerRectを基準にisOutsideを判定している
  - タブツリーの高さではなくサイドパネル全体の境界を使用する必要がある
- **Implications**: ドラッグアウト判定のコンテナ境界を修正する必要がある

### タブグループ化機能
- **Context**: コンテキストメニューからのグループ化が動作しない
- **Sources Consulted**: event-handlers.ts、TreeStateManager（参照）
- **Findings**:
  - handleCreateGroupがtreeStateManager.createGroupFromTabsを呼び出している
  - グループノードはid='group-'プレフィックス、負のtabIdで識別される
  - UIでの表示はTreeGroupNodeHeaderで処理される
- **Implications**: グループ化ロジックとUI表示の実装を確認・修正する必要がある

### クロスウィンドウドラッグ
- **Context**: 別ウィンドウからのタブドラッグが新規ウィンドウを開いてしまう
- **Sources Consulted**: CrossWindowDragHandler.tsx、event-handlers.ts
- **Findings**:
  - SET_DRAG_STATE/GET_DRAG_STATEメッセージでService Worker経由の状態共有が実装されている
  - dragStateにsourceWindowIdが含まれている
- **Implications**: 別ウィンドウからのドラッグインを検出し、ドラッグアウトとして扱わないロジックが必要

### 空ウィンドウの自動クローズ
- **Context**: ドラッグアウトで全タブを移動してもウィンドウが残る
- **Sources Consulted**: chrome.windows API
- **Findings**:
  - chrome.windows.removeでウィンドウを閉じることができる
  - タブ移動後にchrome.tabs.queryでウィンドウ内のタブ数をチェックする必要がある
- **Implications**: ドラッグアウト完了後にソースウィンドウのタブ数をチェックし、0ならウィンドウを閉じる

### 新規タブボタンの簡素化
- **Context**: 「新規タブ」テキストが不要
- **Sources Consulted**: NewTabButton.tsx
- **Findings**:
  - 現在は「+」アイコンと「新規タブ」テキストを表示している
  - テキスト部分の削除のみで対応可能
- **Implications**: JSXからテキスト要素を削除する軽微な変更

### ビューアイコン選択の即時反映
- **Context**: プリセットからアイコンを選んでも反映されない
- **Sources Consulted**: IconPicker.tsx、ViewEditModal.tsx
- **Findings**:
  - IconPickerはonSelectコールバックを提供
  - 「Select」ボタンクリック時にのみonSelectが呼ばれる現在の実装
  - handleIconSelectでアイコン名を更新しているが、即時反映されていない
- **Implications**: アイコン選択時に即座にonSelectを呼び出すよう変更が必要

### ビューへの新規タブ追加
- **Context**: ビューを開いた状態で新規タブを追加するとビューが閉じる
- **Sources Consulted**: event-handlers.ts、getCurrentViewId関数
- **Findings**:
  - handleTabCreatedでgetCurrentViewId()を呼び出して現在のビューIDを取得
  - ストレージからtree_stateのcurrentViewIdを読み込んでいる
- **Implications**: ビュー情報の取得と新規タブ追加のタイミングを確認する必要がある

### 新規タブのURL問題
- **Context**: ツリービューの新規タブがVivaldiスタートページを開かない
- **Sources Consulted**: NewTabButton.tsx
- **Findings**:
  - chrome.tabs.create({ active: true })のみで、URLを指定していない
  - Vivaldiスタートページは`chrome://vivaldi-webui/startpage`
- **Implications**: 新規タブ作成時にVivaldiスタートページURLを明示的に指定する必要がある

### 未読インジケーター位置
- **Context**: 未読インジケーターがタイトル末尾にある
- **Sources Consulted**: TreeNode.tsx、TabTreeView.tsx内のSortableTreeNodeItem
- **Findings**:
  - UnreadBadgeはタイトルエリア内に配置されている
  - justify-betweenでレイアウトしているが、未読インジケーターはタイトルエリア内
- **Implications**: 未読インジケーターを右端固定コンテナに移動する必要がある

### ファビコン永続化復元
- **Context**: ブラウザ再起動後にファビコンが表示されない
- **Sources Consulted**: TitlePersistenceService、types/index.ts
- **Findings**:
  - tab_faviconsストレージキーが定義されている
  - TitlePersistenceServiceはタイトルの永続化を担当
  - ファビコン復元ロジックの実装状況を確認する必要がある
- **Implications**: ファビコン永続化サービスの実装または修正が必要

### 選択状態の自動解除
- **Context**: タブ選択後に他の操作をしても選択が解除されない
- **Sources Consulted**: TabTreeView.tsx
- **Findings**:
  - onSelectコールバックで選択状態を管理
  - 新規タブ作成時などのイベントで選択解除が呼ばれていない
- **Implications**: 各種操作のイベントハンドラで選択解除を呼び出す必要がある

### タブ複製時の配置
- **Context**: 複製タブが子タブになってしまう
- **Sources Consulted**: event-handlers.ts、useMenuActions.ts（参照）
- **Findings**:
  - chrome.tabs.duplicateでタブを複製
  - openerTabIdが設定されるため子タブとして扱われる
- **Implications**: 複製時は兄弟として配置するよう位置ルールを適用する必要がある

### 新規タブ位置設定
- **Context**: 手動タブの位置設定が反映されない場合がある
- **Sources Consulted**: event-handlers.ts、UserSettings型
- **Findings**:
  - newTabPositionFromLink（リンククリック）とnewTabPositionManual（手動）の設定がある
  - openerTabIdの有無で判定している
- **Implications**: タブ開き方の判定ロジックの精査と修正が必要

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| 既存アーキテクチャ拡張 | Service Worker + React UIの現行構成を維持 | 既存コードとの整合性、学習コスト最小 | 大規模変更には不向き | 本バグ修正に最適 |

## Design Decisions

### Decision: E2Eテストのフレーキー修正アプローチ
- **Context**: ネットワーク依存のテストが不安定
- **Alternatives Considered**:
  1. より長いタイムアウトを設定
  2. リトライロジックを追加
  3. ポーリング戦略の最適化
- **Selected Approach**: ポーリング戦略の最適化 + 状態変化の確実な検出
- **Rationale**: 根本的な解決が可能で、テスト実行時間も最適化できる
- **Trade-offs**: 実装の複雑さが増すが、長期的な安定性が向上
- **Follow-up**: --repeat-each=10で安定性を検証

### Decision: ドラッグアウト判定の修正
- **Context**: サイドパネル内の空白領域でドラッグアウトと誤判定
- **Alternatives Considered**:
  1. containerRectの取得元を変更
  2. ドラッグアウト判定に追加条件を設ける
- **Selected Approach**: サイドパネル全体の境界を使用するよう修正
- **Rationale**: ユーザーの期待する動作と一致する
- **Trade-offs**: なし
- **Follow-up**: E2Eテストで境界ケースを検証

### Decision: 新規タブURLの指定
- **Context**: 新規タブでVivaldiスタートページを開く必要がある
- **Alternatives Considered**:
  1. 固定URL指定
  2. ブラウザ設定から取得
- **Selected Approach**: 固定URL指定（chrome://vivaldi-webui/startpage）
- **Rationale**: シンプルで確実、Vivaldi専用拡張のため問題なし
- **Trade-offs**: ユーザーカスタマイズ不可（現時点では要件外）
- **Follow-up**: なし

## Risks & Mitigations
- **E2Eテストの安定性**: ポーリング戦略の最適化で対応、--repeat-each=10で検証
- **ドラッグ&ドロップ操作の複雑さ**: 既存のdnd-kit統合を活用、段階的な修正
- **クロスウィンドウ操作のタイミング問題**: Service Worker経由の状態共有で同期

## References
- [@dnd-kit/core ドキュメント](https://docs.dndkit.com/)
- [Chrome Extensions API - tabs](https://developer.chrome.com/docs/extensions/reference/tabs/)
- [Chrome Extensions API - windows](https://developer.chrome.com/docs/extensions/reference/windows/)
- [Playwright Testing Library](https://playwright.dev/docs/test-assertions)
