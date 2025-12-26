# Research & Design Decisions - Vivaldi-TT

---
**Purpose**: ツリー型タブ管理拡張機能の技術設計に必要な調査結果と設計判断を記録する。
---

## Summary
- **Feature**: vivaldi-tt
- **Discovery Scope**: New Feature（グリーンフィールド開発）
- **Key Findings**:
  - Chrome Side Panel APIはVivaldi 6.6以降でサポートされているが、動的サイドパネルに互換性問題あり
  - dnd-kitはツリー構造のドラッグ&ドロップに最適だが、クロスウィンドウD&DにはHTML5 D&D APIが必要
  - Manifest V3ではService Workerが永続的に動作しないため、状態管理に工夫が必要

## Research Log

### Chrome Side Panel API

- **Context**: サイドパネルにツリー型タブUIを表示するための基盤API調査
- **Sources Consulted**:
  - [Chrome Side Panel API Reference](https://developer.chrome.com/docs/extensions/reference/api/sidePanel)
  - [Side Panel Launch Blog](https://developer.chrome.com/blog/extension-side-panel-launch)
- **Findings**:
  - `sidePanel`権限が必須
  - `sidePanel.open()`はChrome 116+で利用可能（ユーザージェスチャー必須）
  - `sidePanel.setOptions()`でタブごとまたはグローバルにパネル設定可能
  - Chrome 140+で`getLayout()`（左右配置取得）、141+で`onOpened`イベント、142+で`onClosed`イベント追加
  - サイドパネルはすべてのChrome APIにアクセス可能
- **Implications**:
  - Manifest V3の`sidePanel`キーで`default_path`を設定
  - タブ固有とグローバルの両方のサイドパネルをサポート可能
  - Vivaldiでの動的サイドパネル問題への対策が必要

### Vivaldi Browser互換性

- **Context**: VivaldiでのChrome拡張機能サポート状況の確認
- **Sources Consulted**:
  - [Vivaldi Using Extensions](https://help.vivaldi.com/desktop/appearance-customization/extensions/)
  - [Vivaldi Forum - Side Panel API Discussion](https://forum.vivaldi.net/topic/27343/sidebar-side-panel-extension-api)
  - [Vivaldi 6.6 Release Notes](https://vivaldi.com/blog/vivaldi-on-desktop-6-6/)
- **Findings**:
  - VivaldiはChromiumベースでChrome Web Store拡張機能をサポート
  - Vivaldi 6.6（2024年2月）でSide Panel APIサポート追加
  - 動的サイドパネル（バックグラウンドページから設定）で`about:blank`が表示される既知のバグあり（VB-120826）
  - 一部の拡張機能でアクティブタブ検出が正常に動作しない問題
- **Implications**:
  - 静的サイドパネル設定（manifest.jsonの`default_path`）を優先使用
  - 動的パネル切り替えを避け、単一のサイドパネルHTMLで内部ルーティング実装
  - Vivaldi固有のフォールバック処理を検討

### Chrome Tabs API

- **Context**: タブの監視・操作・移動のためのAPI調査
- **Sources Consulted**:
  - [Chrome Tabs API Reference](https://developer.chrome.com/docs/extensions/reference/api/tabs)
- **Findings**:
  - 主要メソッド: `query()`, `create()`, `update()`, `remove()`, `move()`, `duplicate()`
  - 主要イベント: `onCreated`, `onRemoved`, `onActivated`, `onUpdated`, `onMoved`, `onAttached`, `onDetached`
  - `tabs`権限でURL/title/favIconUrlへのアクセス可能
  - タブ間・ウィンドウ間移動は`tabs.move()`で実現
  - `openerTabId`プロパティで親子関係を追跡可能
- **Implications**:
  - `openerTabId`を利用してツリー構造の自動構築が可能
  - すべてのタブイベントを監視してリアルタイム更新を実現
  - ウィンドウ間移動には`tabs.move()`と`windowId`の組み合わせ

### ドラッグ&ドロップライブラリ

- **Context**: ツリー構造のドラッグ&ドロップUI実装のためのライブラリ選定
- **Sources Consulted**:
  - [dnd-kit公式サイト](https://dndkit.com/)
  - [dnd-kit Documentation](https://docs.dndkit.com)
  - [dnd-kit-sortable-tree](https://github.com/Shaddix/dnd-kit-sortable-tree)
  - [Top 5 D&D Libraries for React 2025](https://puckeditor.com/blog/top-5-drag-and-drop-libraries-for-react)
- **Findings**:
  - dnd-kit: 軽量（~10kb）、React専用、アクセシブル、カスタマイズ性高い
  - dnd-kit-sortable-tree: ツリー構造専用のdnd-kitラッパー
  - HTML5 D&D APIを使用しないため、ウィンドウ間ドラッグは不可
  - 代替: react-dndはHTML5バックエンドでクロスウィンドウ対応可能だが重い
- **Implications**:
  - パネル内ドラッグにはdnd-kit + dnd-kit-sortable-treeを採用
  - クロスウィンドウドラッグには別アプローチが必要（メッセージパッシング + chrome.tabs API）

### クロスウィンドウタブ移動

- **Context**: 異なるウィンドウ間でタブをドラッグ&ドロップする方法の調査
- **Sources Consulted**:
  - [HTML5 D&D Browser Differences](https://github.com/leonadler/drag-and-drop-across-browsers)
  - [Move Tab to Next Window Extension](https://chromewebstore.google.com/detail/move-tab-to-next-window/ibpemckpjfpmhlagogddlajhaiemdjnaf)
- **Findings**:
  - HTML5 Drag and Drop APIはブラウザ間で挙動が異なる
  - Chrome拡張機能では`chrome.runtime.sendMessage`でウィンドウ間通信可能
  - `tabs.move(tabIds, {windowId})`でウィンドウ間移動を実現
  - ドラッグ開始時にタブ情報をシリアライズ、別ウィンドウでドロップ検出
- **Implications**:
  - サイドパネル外へのドラッグは`dragend`イベントで検出
  - ドロップ位置がサイドパネル外なら`chrome.windows.create()`で新規ウィンドウ作成
  - 別ウィンドウのサイドパネルへのドロップはruntime messagingで実装

### ストレージ戦略

- **Context**: ツリー状態・設定・スナップショットの永続化方法の調査
- **Sources Consulted**:
  - [Chrome Storage API](https://developer.chrome.com/docs/extensions/reference/api/storage)
  - [IndexedDB Performance Improvements](https://developer.chrome.com/docs/chromium/indexeddb-storage-improvements)
- **Findings**:
  - `chrome.storage.local`: 5MB制限（`unlimitedStorage`権限で解除可能）、JSON互換
  - `chrome.storage.sync`: 100KB制限、デバイス間同期
  - IndexedDB: 大容量対応、非同期、複雑なクエリ可能
  - Service Workerでは`localStorage`使用不可
- **Implications**:
  - 設定とツリー状態は`chrome.storage.local`で管理
  - スナップショット履歴はIndexedDBで大容量保存
  - `unlimitedStorage`権限を要求してスナップショット容量を確保

### 開発環境とホットリロード

- **Context**: Manifest V3での開発効率化手法の調査
- **Sources Consulted**:
  - [hot-reload-extension-vite Plugin](https://github.com/isaurssaurav/hot-reload-extension-vite-plugin)
  - [CRXJS Vite Plugin](https://crxjs.dev/vite-plugin)
- **Findings**:
  - CRXJS Vite Plugin: ゼロコンフィグでMV3対応、HMRサポート
  - hot-reload-extension-vite: v1.1.0以降でSide Panel対応
  - Vite + React + TypeScript + TailwindCSSが2025年の推奨スタック
- **Implications**:
  - Vite + CRXJS または hot-reload-extension-vite を採用
  - TypeScriptで型安全性を確保
  - TailwindCSSでスタイリング（カスタムCSS機能との共存を検討）

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| Flux/Redux | 単方向データフロー + 中央集権ストア | 予測可能な状態管理、デバッグ容易 | ボイラープレート多い、学習コスト | Chrome拡張機能では過剰な可能性 |
| Context + useReducer | React標準の状態管理 | 軽量、追加依存なし、十分な機能 | 大規模になると複雑化 | 推奨アプローチ |
| Zustand | 軽量な状態管理ライブラリ | シンプルAPI、ミドルウェア対応 | 追加依存 | Context複雑化時の代替 |

**選択**: Context + useReducer（React標準機能で十分、追加依存を最小化）

## Design Decisions

### Decision: UI フレームワーク選択

- **Context**: サイドパネルUIの実装フレームワーク選定
- **Alternatives Considered**:
  1. Vanilla JavaScript + Web Components — 依存なし、軽量
  2. React — コンポーネントベース、エコシステム豊富
  3. Vue.js — 学習コスト低い、軽量
  4. Preact — Reactと互換、より軽量
- **Selected Approach**: React + TypeScript
- **Rationale**:
  - dnd-kitがReact専用であり、ツリー構造D&Dの実装が容易
  - TypeScriptでChrome API型定義を活用可能
  - コンポーネントベースでUI分割が明確
- **Trade-offs**: バンドルサイズ増加（~40KB gzip）、ただし機能性で相殺
- **Follow-up**: Production buildでのバンドルサイズ最適化

### Decision: ドラッグ&ドロップ実装方式

- **Context**: パネル内とクロスウィンドウの両方のD&Dをサポート
- **Alternatives Considered**:
  1. dnd-kit単独 — パネル内完結
  2. HTML5 D&D API単独 — クロスウィンドウ対応だがツリー操作困難
  3. ハイブリッド — パネル内dnd-kit + クロスウィンドウHTML5 D&D
- **Selected Approach**: ハイブリッドアプローチ
- **Rationale**:
  - パネル内のツリー操作はdnd-kitの方が圧倒的に実装しやすい
  - クロスウィンドウはHTML5 D&D + runtime messaging + chrome.tabs APIで実現
- **Trade-offs**: 2つのD&Dシステムの統合が複雑
- **Follow-up**: ドラッグ開始時にモード判定ロジックを慎重に設計

### Decision: スナップショット保存形式

- **Context**: タブセッションの保存・復元機能のデータ形式
- **Alternatives Considered**:
  1. chrome.storage.local（JSON） — シンプル、容量制限あり
  2. IndexedDB — 大容量、複雑なクエリ可能
  3. File System Access API — ユーザーファイルとして保存
- **Selected Approach**: IndexedDB + chrome.storage.local併用
- **Rationale**:
  - 現在のツリー状態と設定はchrome.storage.localで即時アクセス
  - スナップショット履歴はIndexedDBで大容量管理
  - JSONエクスポートは手動操作時のみ生成
- **Trade-offs**: 2つのストレージ層の同期が必要
- **Follow-up**: IndexedDB操作のラッパーユーティリティを作成

### Decision: ビュー切り替え実装

- **Context**: 複数のタブツリービュー（仮想ワークスペース）の管理
- **Alternatives Considered**:
  1. 実タブグループ連携 — Chrome Tab Groups APIと統合
  2. 仮想ビュー — 拡張機能内で独自管理
  3. ウィンドウ単位 — ウィンドウごとに1ビュー
- **Selected Approach**: 仮想ビュー（拡張機能内独自管理）
- **Rationale**:
  - Chrome Tab Groups APIは制約が多く柔軟性に欠ける
  - 仮想ビューなら任意のグルーピングとネーミングが可能
  - ウィンドウとの1:1対応よりも柔軟
- **Trade-offs**: ブラウザネイティブのタブグループとは別管理になる
- **Follow-up**: ビューとタブの関連付けロジックを明確化

## Risks & Mitigations

- **Vivaldi互換性問題** — 動的サイドパネルが`about:blank`になる既知バグ
  - 緩和策: 静的サイドパネル + 内部ルーティングで回避

- **Service Worker終了によるステート喪失** — MV3ではService Workerが頻繁に終了
  - 緩和策: 状態変更時に即時chrome.storage.localへ永続化、起動時に復元

- **クロスウィンドウD&Dの複雑性** — 2つのD&Dシステムの統合
  - 緩和策: 明確なモード判定とフォールバック処理の実装

- **パフォーマンス劣化** — 大量タブ時のレンダリング遅延
  - 緩和策: 仮想スクロール（react-window）の導入、メモ化の徹底

## References

- [Chrome Side Panel API](https://developer.chrome.com/docs/extensions/reference/api/sidePanel) — 公式APIリファレンス
- [Chrome Tabs API](https://developer.chrome.com/docs/extensions/reference/api/tabs) — タブ操作の公式ドキュメント
- [Chrome Storage API](https://developer.chrome.com/docs/extensions/reference/api/storage) — ストレージの公式ドキュメント
- [dnd-kit Documentation](https://docs.dndkit.com) — ドラッグ&ドロップライブラリ
- [dnd-kit-sortable-tree](https://github.com/Shaddix/dnd-kit-sortable-tree) — ツリー構造専用コンポーネント
- [Vivaldi Extension Support](https://help.vivaldi.com/desktop/appearance-customization/extensions/) — Vivaldi拡張機能ガイド
- [CRXJS Vite Plugin](https://crxjs.dev/vite-plugin) — Manifest V3対応Viteプラグイン
