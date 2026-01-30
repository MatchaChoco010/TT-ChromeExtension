# Product Overview

Vivaldi-TTは、Vivaldiブラウザ向けのツリー型タブマネージャー。タブを階層構造で管理し、効率的なブラウジング体験を提供する。

**主要機能**: 階層的タブ管理、ドラッグ&ドロップ操作、複数選択、ピン留めタブ、複数ウィンドウ対応、ビュー/グループ機能、スナップショット、カスタマイズ可能なUI

---

# Project Structure

## ディレクトリ構成

| ディレクトリ | 役割 | 主要ファイル |
|-------------|------|-------------|
| `/src/background/` | Service Worker（タブイベント処理、ツリー同期） | `service-worker.ts`, `event-handlers.ts` |
| `/src/sidepanel/` | React UI（サイドパネル） | `components/`, `providers/`, `hooks/` |
| `/src/settings/` | 設定画面 | `SettingsPage.tsx` |
| `/src/group/` | グループタブ専用ページ | `GroupPage.tsx` |
| `/src/services/` | ビジネスロジック | `TreeStateManager.ts`, `SnapshotManager.ts` |
| `/src/storage/` | データ永続化 | `StorageService.ts` |
| `/src/types/` | 型定義 | `index.ts` |
| `/e2e/` | E2Eテスト（Playwright） | `*.spec.ts`, `utils/`, `fixtures/` |

## 命名規則・パスエイリアス

- **Components**: PascalCase（`TreeNode.tsx`）
- **Tests**: `*.test.ts(x)`（unit）、`*.spec.ts`（E2E）
- **Types**: PascalCase（`TabNode`, `UserSettings`）
- **パスエイリアス**: `@/` → `./src/`

---

# Technology Stack

- **Language**: TypeScript 5.5+ (strict mode)
- **Framework**: React 18
- **Runtime**: Chrome Extensions API (Manifest V3)
- **Build**: Vite 5 + @crxjs/vite-plugin
- **Styling**: Tailwind CSS 3
- **Test**: Vitest + React Testing Library、Playwright（E2E）

---

# Development Standards

## タスク別skill参照（必須）

| タスク | 参照するskill |
|--------|--------------|
| 新機能実装・バグ修正の開始前 | `/feasibility-check` |
| バグ修正 | `/fix-bug` |
| リファクタリング | `/refactoring` |
| E2Eテスト実装・修正 | `/e2e-testing` |
| コメント規約チェック | `/fix-comment-rules` |
| 技術的制約の確認 | `/technical-constraints` |

## コード品質

- **型安全**: `npm run type-check`がエラーゼロ、`any`使用禁止
- **Lint**: `npm run lint`, `npm run lint:fix`
- **例外の握りつぶし禁止**: `.catch(() => {})`や空のcatchブロックは禁止

## 機能追加時の必須要件

1. `npm test` と `npm run test:e2e` が全てパス
2. `npm run type-check` がエラーなし
3. 新機能のテスト追加
4. UI削除時はE2Eテストも削除（`test.skip()`でなく完全削除）

---

# Development Environment

```bash
npm run dev        # Vite開発サーバー
npm run build      # TypeScript type-check + Vite bundle
npm test           # Vitest watch mode
npm run type-check # 型チェック
npm run test:e2e   # Playwright E2Eテスト
```

---

# Key Technical Decisions

## データ構造

**Window → View → Tab の階層構造**

```typescript
interface TreeState {
  windows: WindowState[];
}

interface WindowState {
  windowId: number;
  views: ViewState[];
  activeViewIndex: number;
}

interface ViewState {
  name: string;
  color: string;
  icon?: string;
  rootNodes: TabNode[];
  pinnedTabIds: number[];
}

interface TabNode {
  tabId: number;           // Chrome tabIdを直接使用
  isExpanded: boolean;
  groupInfo?: GroupInfo;
  children: TabNode[];     // 親子関係は配列で直接表現
}
```

**識別子体系**:
- タブ: `tabId: number`（Chrome tabIdを直接使用）
- ビュー: `viewIndex: number`（配列インデックス）
- 親子関係: `children: TabNode[]`（parentIdは使用しない）

## 状態管理アーキテクチャ（最重要）

**TreeStateManager（Service Worker）がSingle Source of Truth**

```
UI操作/Chromeイベント
    ↓
Service Worker (event-handlers.ts)
    ↓
TreeStateManager
    ├→ メモリ上の状態変更
    ├→ syncTreeStateToChromeTabs() → Chrome APIs
    ├→ persistState() → chrome.storage.local
    └→ sendMessage({ type: 'STATE_UPDATED', payload: state }) → Side Panel
```

**原則**:
1. TreeStateManager（Service Worker）が唯一の状態ソース
2. TreeStateManagerのメソッドは純粋にメモリ上の状態変更のみ（例外: addTab/duplicateTabのみtabId取得のためChrome API呼び出し）
3. `syncTreeStateToChromeTabs()`でChromeタブの状態をTreeStateManagerに合わせる
4. Chrome APIを直接呼ぶのはsyncメソッド内のみ
5. chrome.storage.localは永続化専用
6. リアルタイム同期にはメッセージの引数（payload）を使用
7. Side Panelは読み取り専用

### Side Panel側の禁止事項

- `chrome.storage.local.set()`を直接呼び出すこと
- `chrome.tabs.move()`、`chrome.tabs.update()`、`chrome.tabs.create()`を直接呼び出すこと
- `chrome.windows.create()`を直接呼び出すこと
- TreeStateManagerを経由しない状態変更

### ServiceWorker側の禁止事項

- イベントハンドラから直接`chrome.tabs.move()`、`chrome.tabs.update({pinned})`、`chrome.windows.create()`を呼び出すこと
- これらの操作はTreeStateManagerのメソッドでメモリ状態を変更後、`syncTreeStateToChromeTabs()`で一括反映する
- **Chrome → TreeStateManager 方向の同期は原則禁止**: 通常運用ではTreeStateManagerが正であり、Chromeタブの状態からTreeStateManagerを更新してはならない

### 唯一の例外: 拡張機能の新規インストール時

- `chrome.runtime.onInstalled`で`details.reason === 'install'`の場合のみ、`initializeFromChromeTabs()`でChromeタブをTreeStateManagerに取り込む
- これは拡張機能インストール前から存在するタブをサイドパネルに表示するための唯一の例外
- Chrome再起動、ServiceWorker再起動、拡張機能アップデート時にはこの方向の同期は行わない

**理由**: Side PanelとService Workerは別プロセスで動作する。共有メモリ（chrome.storage.local）を介した非同期処理はレースコンディションの温床となる。

## chrome.storage.localの役割

**永続化専用**（ブラウザ再起動時の状態復元のため）

| 用途 | 使用するもの |
|------|-------------|
| 永続化（再起動時の復元） | chrome.storage.local |
| リアルタイム同期（状態変更通知） | メッセージの引数（payload） |

**リアルタイム同期でストレージを使わない理由**:
- 「書き込み → 通知 → 読み込み」の間に別の書き込みが入る可能性
- 複数の非同期処理が同時に走るとレースコンディションが発生
- メッセージと状態の1対1対応が保証されない

## その他の技術決定

**タブイベント処理**:
- リンククリック検出: `chrome.webNavigation.onCreatedNavigationTarget`で「リンクから開いたタブ」と「手動で開いたタブ」を区別
- タブ休止時のtabId変更: `chrome.tabs.onReplaced`で検知し、TreeStateManagerで置換
- Chrome再起動時: `isRestoringState`フラグでセッション復元中のタブイベントを抑制

**ストレージ**:
- `chrome.storage.local`使用（`unlimitedStorage`権限）
- 15秒ごとの定期永続化
- 想定最大タブ数: 2500

**サイドパネルタブ除外**:
- `isOwnExtensionUrl()` + `isSidePanelUrl()`で判定
- TreeStateに追加しない（E2Eテストでの擬似サイドパネル対応のため）
