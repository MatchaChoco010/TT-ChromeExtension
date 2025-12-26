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

- **@dnd-kit**: ドラッグ&ドロップ機能（sortable tree実装）
- **React Testing Library + Vitest**: コンポーネントテスト
- **fake-indexeddb**: ストレージテスト用のモック

## Development Standards

### Type Safety
- TypeScript strict mode有効（`strict: true`）
- `noUnusedLocals`, `noUnusedParameters`でコード品質を保証
- Chrome APIは`@types/chrome`による型定義を使用

### Code Quality
- **ESLint**: TypeScript/React推奨設定 + Prettier統合
- **Prettier**: 自動フォーマット（`.ts`, `.tsx`, `.css`対象）
- **Linting**: `npm run lint`でチェック、`lint:fix`で自動修正

### Testing
- **Vitest**: 高速なユニット/統合テスト
- **Testing Library**: Reactコンポーネントのユーザー視点テスト
- テスト種別: `*.test.ts(x)`, `*.integration.test.tsx`, `*.e2e.test.tsx`

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
- **Path Alias `@/`**: `./src/`へのエイリアスで、深いネストでもインポートパスを簡潔に維持

---
_Document standards and patterns, not every dependency_
