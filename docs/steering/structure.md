# Project Structure

## Organization Philosophy

機能ドメイン別の階層構造を採用。拡張機能の実行コンテキスト（Background / UI）と責務（Services / Storage / Types）を明確に分離しています。

## Directory Patterns

### Background Logic (`/src/background/`)
**Purpose**: Service Worker実行環境のコード（タブイベント処理、ツリー同期、ウィンドウ間状態管理）
**Key Components**:
- `event-handlers.ts`: Chrome APIイベントハンドリング
- `drag-session-manager.ts`: クロスウィンドウドラッグのセッション管理

**Example**: `service-worker.ts`, `event-handlers.ts`, `drag-session-manager.ts`

### Side Panel UI (`/src/sidepanel/`)
**Purpose**: Reactベースのユーザーインターフェース（メインのサイドパネル）
**Subdirectories**:
- `components/`: UIコンポーネント（TreeNode, TabTreeView, SettingsPanel等）
- `providers/`: Reactコンテキストプロバイダー（TreeStateProvider, ThemeProvider）
- `hooks/`: カスタムフック（useMenuActions等）
- `utils/`: UI固有のユーティリティ関数

**Example**: `components/TreeNode.tsx`, `providers/TreeStateProvider.tsx`

### Settings Page (`/src/settings/`)
**Purpose**: 独立した設定画面（chrome.runtime.openOptionsPage()で開く）
**Scope**: フォントカスタマイズ、テーマ設定、新規タブ位置設定などのユーザー設定UI

**Example**: `SettingsPage.tsx`, `index.tsx`

### Group Page (`/src/group/`)
**Purpose**: グループタブ専用ページ（chrome-extension://スキームで表示）
**Scope**: タブグループの親タブとして機能する拡張機能内ページ。グループ名と子タブリストを表示

**Example**: `GroupPage.tsx`, `index.tsx`

### Services (`/src/services/`)
**Purpose**: ビジネスロジック層（スナップショット管理等）
**Example**: `SnapshotManager.ts`

### Storage (`/src/storage/`)
**Purpose**: データ永続化の抽象化層（IndexedDB操作）
**Example**: `IndexedDBService.ts`, `StorageService.ts`

### Types (`/src/types/`)
**Purpose**: 型定義の集約（プロジェクト全体で共有）
**Example**: `index.ts` (TabNode, TabInfo, UserSettings等)

### Testing (`/src/test/`)
**Purpose**: クロスカッティングな統合テスト（パフォーマンス、互換性）
**Example**: `performance.test.tsx`, `vivaldi-compatibility.test.tsx`

### E2E Tests (`/e2e/`)
**Purpose**: Playwrightによる実ブラウザE2Eテスト
**Subdirectories**:
- `fixtures/`: カスタムフィクスチャ（拡張機能ロード等）
- `utils/`: テストユーティリティ（tab-utils, drag-drop-utils, polling-utils等）
- `test-data/`: テストデータとフィクスチャ
- `types/`: E2Eテスト用の型定義
- `scripts/`: E2Eテスト用のヘルパースクリプト

**Example**: `tab-lifecycle.spec.ts`, `drag-drop-reorder.spec.ts`, `utils/polling-utils.ts`

## Naming Conventions

- **Components**: PascalCase（`TreeNode.tsx`, `SettingsPanel.tsx`）
- **Unit/Integration Tests**: `*.test.ts(x)` (unit), `*.integration.test.tsx` (integration)
- **E2E Tests**: `e2e/*.spec.ts`（Playwright形式）
- **Services/Utilities**: PascalCase for classes, camelCase for functions
- **Types**: PascalCase interfaces/types（`TabNode`, `UserSettings`）

## Import Organization

```typescript
// 外部ライブラリ
import React from 'react';

// 内部モジュール（@/ alias使用）
import type { TabNode, TabInfo, DragEndEvent } from '@/types';
import { TreeStateProvider } from '@/sidepanel/providers/TreeStateProvider';
import UnreadBadge from './UnreadBadge'; // 同階層コンポーネントは相対パス
```

**Path Aliases**:
- `@/`: `./src/` へのマッピング（tsconfig.json + vite.config.ts）

## Code Organization Principles

- **Context分離**: Background（Service Worker）とSidepanel（React UI）は独立して動作
- **Type-first**: 共通型は`@/types`に集約、import時はtype-only importを活用
- **Colocation**: コンポーネントとテストは同ディレクトリに配置（関連性を明示）
- **Provider Pattern**: グローバル状態はReact Contextで管理（TreeState, DragDrop, Theme）

---
_Document patterns, not file trees. New files following patterns shouldn't require updates_
