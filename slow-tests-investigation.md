# 実行時間に問題があるテストの調査

## 問題のあるテスト一覧

### 6秒以上（マルチウィンドウ系）
| # | テスト | 時間 | ファイル:行 | 状態 |
|---|--------|-----|-------------|------|
| 1 | 連続切替テスト | 8.0s | active-tab-highlight.spec.ts:297 | 未調査 |
| 2 | 別ウィンドウに移動（既存） | 7.3s | context-menu.spec.ts:217 | 未調査 |
| 3 | moveTabToWindow | 6.3s | window-utils.spec.ts:31 | 未調査 |
| 4 | タブ移動（マルチウィンドウ） | 6.2s | multi-window-tree.spec.ts:73 | 未調査 |
| 5 | サブツリー移動（クロスウィンドウ） | 6.1s | window-utils.spec.ts:206 | 未調査 |
| 6 | クロスウィンドウタブ移動 | 6.1s | window-utils.spec.ts:79 | 未調査 |

### 5秒以上（D&D/状態検証系）
| # | テスト | 時間 | ファイル:行 | 状態 |
|---|--------|-----|-------------|------|
| 7 | SYNC_TABS後の親子関係維持 | 5.5s | drag-drop-hierarchy.spec.ts:873 | 未調査 |
| 8 | 展開/折りたたみ切替 | 5.4s | side-panel.spec.ts:189 | 未調査 |
| 9 | ストレージ破損からの復元 | 5.3s | drag-drop-hierarchy.spec.ts:967 | 未調査 |
| 10 | 新ウィンドウ後の親子関係維持 | 5.2s | drag-drop-hierarchy.spec.ts:752 | 未調査 |
| 11 | サブツリーを閉じる | 5.1s | context-menu.spec.ts:102 | 未調査 |

### 4秒以上（複雑なUI操作系）
| # | テスト | 時間 | ファイル:行 | 状態 |
|---|--------|-----|-------------|------|
| 12 | ピン留め解除 | 4.9s | pinned-tabs.spec.ts:429 | 未調査 |
| 13 | 異なる深さ間のサブツリー移動 | 4.9s | drag-drop-cross-depth.spec.ts:10 | 未調査 |
| 14 | ネストしたサブツリー移動 | 4.7s | drag-drop-child-reorder.spec.ts:403 | 未調査 |
| 15 | グループ化後の順序維持 | 4.5s | tab-grouping.spec.ts:1125 | 未調査 |
| 16 | D&D後の新規タブで親子関係維持 | 4.4s | drag-drop-hierarchy.spec.ts:325 | 未調査 |
| 17 | ホバー自動展開（深いツリー） | 4.3s | drag-drop-hover.spec.ts:247 | 未調査 |

---

## 調査記録

### 調査1: moveTabToWindow (6.3s) - window-utils.spec.ts:31

**調査日時**: 2026-01-08
**調査内容**: タイミングログを追加してボトルネックを特定

**発見した遅延箇所**:
- `context.close()`: 5057ms (テスト本体は約500ms)
- 原因: `openSidePanelForWindow`で作成した追加ページ(`newWindowSidePanel`)を閉じていなかった

**改善策**:
- テスト終了前に `newWindowSidePanel.close()` を呼び出す
- 結果: `context.close()` が 113ms に短縮 (5057ms → 113ms)

**結論**:
`openSidePanelForWindow`で作成した全てのページは、テスト終了前に明示的に閉じる必要がある。
これは全てのマルチウィンドウテストに適用される。

**修正したファイル**:
- e2e/utils/window-utils.spec.ts: 5テスト
- e2e/multi-window-tree.spec.ts: 3テスト
- e2e/context-menu.spec.ts: 1テスト
- e2e/chrome-api-windows.spec.ts: 2テスト

**改善結果**:
| テスト | 修正前 | 修正後 |
|--------|-------|--------|
| moveTabToWindow | 6.3s | 942ms |
| multi-window タブ移動 | 6.2s | 953ms |
| context-menu 別ウィンドウ移動 | 7.3s | 2.2s |

---

### 調査2: ドラッグ操作の遅延 - 完了

**調査日時**: 2026-01-08
**調査内容**: Playwrightの`mouse.move()`の`steps`パラメータを調査

**発見した遅延箇所**:
- `mouse.move()`の`steps`パラメータが高すぎた
- `steps`は中間点の数を制御し、各点で`mousemove`イベントが発火
- 例: `steps: 15`で約240ms、`steps: 5`で約80ms

**Playwrightの`steps`パラメータについて**:
- マウス移動時に生成される中間点の数を制御
- `steps: 1`は直接終点へ移動（中間点なし）
- `steps`を減らすと`mousemove`イベントの発火回数が減る
- 注意: `mouseenter`/`mouseleave`のタイミングを逃す可能性があるが、このプロジェクトのD&D実装では問題なし

**改善策**:
`e2e/utils/drag-drop-utils.ts`の全ドラッグ関数で`steps`を最適化:

| 関数 | 初期移動 | ドラッグ開始 | ターゲット移動 |
|------|---------|-------------|---------------|
| startDrag | 3→1 | 5→2 | - |
| hoverOverTab | - | - | 10→5 |
| moveTo | - | - | 5→3 |
| reorderTabs | 3→1 | 5→2 | 15→5 |
| moveTabToParent | 3→1 | 5→2 | 15→5 |
| dragOutside | 3→1 | 5→2 | 10→5 |
| moveTabToRoot | 3→1 | 5→2 | 10→5 |

**改善結果**:
- 各ドラッグ操作: 約400ms → 約150ms
- 全519テストが1.4分でパス（以前は約2分以上）

---

