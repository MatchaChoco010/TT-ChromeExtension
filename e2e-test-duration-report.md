# E2Eテスト実行時間レポート

## サマリー

| 条件 | テスト数 | 割合 |
|------|----------|------|
| テスト総数 | 520 | 100% |
| 1秒以上 | 167 | 32.1% |
| 2秒以上 | 27 | 5.2% |
| 3秒以上 | 8 | 1.5% |
| 4秒以上 | 3 | 0.6% |

## 4秒以上のテスト（3件）

| 時間 | ファイル | テスト名 |
|------|----------|----------|
| 11.6s | `e2e/view-switching.spec.ts` | 親タブを別ビューに移動すると、サブツリー全体が移動する |
| 11.5s | `e2e/view-switching.spec.ts` | 子タブだけを別ビューに移動すると、親子関係が切れる |
| 4.1s | `e2e/snapshot.spec.ts` | 既存タブを削除してスナップショットを復元できる |

## 3秒以上4秒未満のテスト（5件）

| 時間 | ファイル | テスト名 |
|------|----------|----------|
| 3.7s | `e2e/view-switching.spec.ts` | 各ビューで最後にアクティブだったタブを記憶する |
| 3.5s | `e2e/drag-drop-hover.spec.ts` | 折りたたまれた親タブの上にタブをホバーした場合、一定時間後に自動的に展開されること |
| 3.5s | `e2e/drag-drop-hover.spec.ts` | 深いツリー構造でルートノードへのホバーにより自動展開が機能すること |
| 3.3s | `e2e/drag-drop-hover.spec.ts` | 自動展開のタイムアウト前にホバーを離れた場合、その時点では展開されていないこと |
| 3.1s | `e2e/drag-drop-cross-depth.spec.ts` | 異なる深さのノード間のギャップにサブツリーをドロップした場合、下のノードの親の子として配置されること |

## 2秒以上3秒未満のテスト（19件）

| 時間 | ファイル | テスト名 |
|------|----------|----------|
| 2.9s | `e2e/snapshot.spec.ts` | スナップショットに現在のタブ情報が含まれる |
| 2.8s | `e2e/new-tab-button.spec.ts` | 複数回クリックすると複数のタブが順番に末尾に追加される |
| 2.8s | `e2e/drag-drop-child-reorder.spec.ts` | ネストしたサブツリーを親の直上にドロップすると、最後の子として配置されること |
| 2.7s | `e2e/side-panel.spec.ts` | 大量のタブがある場合、スクロールが滑らかに動作する |
| 2.6s | `e2e/view-switching.spec.ts` | ビュー切り替え時に、現在のビューのタブがアクティブになる |
| 2.6s | `e2e/snapshot.spec.ts` | スナップショット復元時に親子関係が正しく復元される |
| 2.5s | `e2e/snapshot.spec.ts` | 手動スナップショット作成でファイルがダウンロードされる |
| 2.5s | `e2e/snapshot.spec.ts` | スナップショット復元時にタブが正しいビューに配置される |
| 2.5s | `e2e/snapshot.spec.ts` | スナップショットのダウンロードリクエストが正しいパスを含む |
| 2.5s | `e2e/drag-drop-complex.spec.ts` | 子タブを持つ親タブを移動した場合、サブツリー全体が一緒に移動することを検証する |
| 2.4s | `e2e/parent-child-consistency.spec.ts` | 複数の独立した親子関係が、タブ操作の組み合わせ後も維持される |
| 2.3s | `e2e/drag-drop-child-reorder.spec.ts` | 子タブを親タブの直上にドロップすると、最後の子として配置されること |
| 2.2s | `e2e/drag-drop-reorder.spec.ts` | 複数の子を持つサブツリー内でタブを並び替えた場合、他の子タブの順序が正しく調整されること |
| 2.1s | `e2e/tab-duplicate.spec.ts` | 連続したタブを複数選択して複製すると、すべてのタブが複製される |
| 2.1s | `e2e/subtree-promotion.spec.ts` | 複数の子タブにそれぞれ孫がある場合、親を閉じても全ての親子関係が維持される |
| 2.1s | `e2e/drag-drop-scroll.spec.ts` | コンテンツがビューポートを超えている場合のみスクロールが許可されることを検証する |
| 2.0s | `e2e/utils/side-panel-utils.spec.ts` | assertSmoothScrollingは大量タブ時のスクロール動作を検証する |
| 2.0s | `e2e/drag-drop-subtree.spec.ts` | サブツリーを下方向にドラッグした場合、正しい移動数で正しい位置に配置されること |
| 2.0s | `e2e/drag-drop-child-independent.spec.ts` | 子タブをドラッグした際に親タブを追従させず、子タブのみ移動可能にすること |

## 1秒以上2秒未満のテスト（140件）

| 時間 | ファイル | テスト名 |
|------|----------|----------|
| 1.9s | `e2e/drag-drop-cross-depth.spec.ts` | サブツリーを別の親の子ノード間のギャップにドロップした場合、その親の子として配置されサブツリー構造が維持されること |
| 1.9s | `e2e/drag-drop-child-reorder.spec.ts` | 複数の子がある場合、任意の子を親にドロップすると最後の子になること |
| 1.9s | `e2e/active-tab-highlight.spec.ts` | 常に1つのタブのみがハイライト状態であることを確認（連続切替テスト） |
| 1.8s | `e2e/view-switching.spec.ts` | 新しいビューを作成できる |
| 1.8s | `e2e/tab-unread-status.spec.ts` | 未読状態のタブに青いドットが表示される |
| 1.8s | `e2e/subtree-promotion.spec.ts` | 複数の子タブがある場合、親を閉じると最初の子が新しい親になり他の子は孫になる |
| 1.8s | `e2e/drag-drop-subtree.spec.ts` | サブツリーを上方向にドラッグした場合、正しい移動数で正しい位置に配置されること |
| 1.8s | `e2e/drag-drop-depth.spec.ts` | ギャップへのドラッグでdepth選択機能が動作すること |
| 1.8s | `e2e/drag-drop-cross-depth.spec.ts` | 深いノードを浅いノードの後にドロップした場合、正しい深さに調整されること |
| 1.7s | `e2e/tab-multi-select.spec.ts` | Ctrl+クリックで複数のタブを選択できる |
| 1.7s | `e2e/subtree-promotion.spec.ts` | 複数ネストした親子関係がある場合、親を閉じると子孫の階層構造が維持される |
| 1.7s | `e2e/drag-drop-subtree.spec.ts` | サブツリーを子ノード間の中間にドロップした場合、サブツリー全体が正しく挿入されること |
| 1.7s | `e2e/drag-drop-subtree.spec.ts` | サブツリーをルートの最後にドロップした場合、正しい位置に配置されること |
| 1.7s | `e2e/drag-drop-reorder.spec.ts` | 子タブのグループ内で末尾から先頭に並び替えた場合、他の子タブが正しくシフトされること |
| 1.7s | `e2e/drag-drop-reorder.spec.ts` | 子タブのグループ内で先頭から末尾に並び替えた場合、他の子タブが正しくシフトされること |
| 1.7s | `e2e/drag-drop-cross-depth.spec.ts` | 異なる深さのノード間のギャップにドロップした場合、下のノードの親の子として配置されること |
| 1.7s | `e2e/context-menu.spec.ts` | コンテキストメニューから"複製する"を選択した場合、タブが複製される |
| 1.6s | `e2e/tab-unread-status.spec.ts` | 複数タブの未読状態が独立して管理される |
| 1.6s | `e2e/tab-multi-select.spec.ts` | Shift+クリックで範囲選択ができる |
| 1.6s | `e2e/subtree-promotion.spec.ts` | 親タブを閉じると、最初の子タブが新しい親に昇格し、他の子タブはその子になる |
| 1.6s | `e2e/pinned-tab.spec.ts` | ピン留めタブがあり通常タブもある場合、両方が正しく表示される |
| 1.6s | `e2e/link-open-child-tab.spec.ts` | リンクをCtrl+Shift+クリックして新しいウィンドウで開いた場合、現在のウィンドウのツリーには影響しない |
| 1.6s | `e2e/drag-drop-subtree.spec.ts` | サブツリーを子ノードの上にドロップした場合、その子の前に挿入されること |
| 1.6s | `e2e/drag-drop-reorder.spec.ts` | 同じ親を持つ子タブを並び替えた場合、親子関係が維持されながら順序のみが変わること |
| 1.6s | `e2e/drag-drop-depth.spec.ts` | depth選択で0から最大深さまで正しく選択できること |
| 1.6s | `e2e/drag-drop-cross-depth.spec.ts` | 異なる親を持つタブを別の親の子として移動した場合、正しく親子関係が更新されること |
| 1.6s | `e2e/active-tab-highlight.spec.ts` | 通常タブがアクティブになった時に該当タブのみがハイライトされる |
| 1.5s | `e2e/view-switching.spec.ts` | ビューを削除できる |
| 1.5s | `e2e/view-switching.spec.ts` | 複数のビューを作成して削除できる |
| 1.5s | `e2e/tab-unread-status.spec.ts` | タブを閉じた時に未読ドットがDOM上から消える |
| 1.5s | `e2e/tab-multi-select.spec.ts` | 選択したタブを一括削除できる |
| 1.5s | `e2e/tab-multi-select.spec.ts` | Ctrl+クリックで選択したタブの選択を解除できる |
| 1.5s | `e2e/tab-expand-collapse.spec.ts` | 折りたたまれた状態で子タブを追加すると展開される |
| 1.5s | `e2e/tab-expand-collapse.spec.ts` | 折りたたみボタンをクリックすると子タブが表示/非表示になる |
| 1.5s | `e2e/tab-duplicate.spec.ts` | サブツリーの親タブを複製しても、サブツリーは複製されない |
| 1.5s | `e2e/subtree-promotion.spec.ts` | 複数の子タブにそれぞれ孫がある場合、親を閉じると全ての孫が正しく昇格する |
| 1.5s | `e2e/pinned-tab.spec.ts` | ピン留めタブが存在する場合、ピン留めセクションが上部に表示される |
| 1.5s | `e2e/parent-child-consistency.spec.ts` | 親を閉じた後も残った子タブの親子関係が維持される |
| 1.5s | `e2e/drag-drop-subtree.spec.ts` | サブツリーをルートの先頭にドロップした場合、正しい位置に配置されること |
| 1.5s | `e2e/drag-drop-subtree.spec.ts` | 3階層以上のサブツリーを移動した場合、全ての階層が維持されること |
| 1.5s | `e2e/drag-drop-reorder.spec.ts` | ルートレベルのタブを上方向に並び替えた場合、親子関係のないタブが正しく位置交換されること |
| 1.5s | `e2e/drag-drop-reorder.spec.ts` | ルートレベルのタブを下方向に並び替えた場合、正しく位置交換されること |
| 1.5s | `e2e/drag-drop-multi-select.spec.ts` | 複数選択したタブをドラッグすると、すべてのタブが一緒に移動すること |
| 1.5s | `e2e/drag-drop-cross-depth.spec.ts` | 浅いノードを深いノードの前にドロップした場合、正しい深さに調整されること |
| 1.5s | `e2e/context-menu.spec.ts` | コンテキストメニューを開いている状態で別の場所をクリックすると、メニューが閉じる |
| 1.4s | `e2e/view-switching.spec.ts` | ビュー名を編集できる |
| 1.4s | `e2e/tab-unread-status.spec.ts` | タブをアクティブにすると未読状態が解除される |
| 1.4s | `e2e/tab-multi-select.spec.ts` | 複数選択したタブをグループ化できる |
| 1.4s | `e2e/tab-expand-collapse.spec.ts` | 折りたたまれた状態が維持される |
| 1.4s | `e2e/tab-duplicate.spec.ts` | タブを複製すると元のタブの兄弟として追加される |
| 1.4s | `e2e/subtree-promotion.spec.ts` | 子が1つだけの場合、親を閉じるとその子がルートに昇格する |
| 1.4s | `e2e/snapshot.spec.ts` | 保存されたスナップショットの一覧を表示できる |
| 1.4s | `e2e/pinned-tab.spec.ts` | タブをピン留め解除すると、通常のツリーに戻る |
| 1.4s | `e2e/pinned-tab.spec.ts` | タブをピン留めするとピン留めセクションに移動される |
| 1.4s | `e2e/parent-child-consistency.spec.ts` | 複数の子タブを連続してアクティブ化しても親子関係が変わらない |
| 1.4s | `e2e/link-open-child-tab.spec.ts` | 設定でnewTabPositionFromLinkをend-of-rootに変更すると、リンク開きタブがルート末尾に追加される |
| 1.4s | `e2e/link-open-child-tab.spec.ts` | リンクをCtrl+クリックして新しいタブで開いた場合、クリック元のタブの子として追加される |
| 1.4s | `e2e/drag-drop-to-pinned.spec.ts` | 通常タブをピン留めエリアにドラッグするとピン留めタブになること |
| 1.4s | `e2e/drag-drop-parent.spec.ts` | 祖先と子孫の関係にないタブを別のタブの子として移動した場合、正しく親子関係が確立されること |
| 1.4s | `e2e/drag-drop-multi-select.spec.ts` | 複数選択したタブをルート末尾にドロップした場合、正しく移動されること |
| 1.4s | `e2e/drag-drop-child-reorder.spec.ts` | 異なる親を持つ子タブを別の親の子として移動できること |
| 1.4s | `e2e/context-menu.spec.ts` | 複数選択中にコンテキストメニューから"選択したタブを閉じる"を選択した場合、全ての選択タブが閉じられる |
| 1.4s | `e2e/tab-lifecycle.spec.ts` | 子タブを持つ親タブを閉じた場合、子タブが昇格すること |
| 1.3s | `e2e/view-switching.spec.ts` | ビュー間でタブを移動できる |
| 1.3s | `e2e/tab-unread-status.spec.ts` | バックグラウンドでURLが変更されると未読状態になる |
| 1.3s | `e2e/tab-multi-select.spec.ts` | 非連続タブの選択状態が維持される |
| 1.3s | `e2e/tab-groups.spec.ts` | グループにタブを追加するとツリーでネストして表示される |
| 1.3s | `e2e/tab-expand-collapse.spec.ts` | 複数の親タブの展開状態が個別に管理される |
| 1.3s | `e2e/tab-duplicate.spec.ts` | 子タブを複製すると同じ親の下に追加される |
| 1.3s | `e2e/subtree-promotion.spec.ts` | 中間の親を閉じた場合、孫が新しい親（元の祖父母）の子になる |
| 1.3s | `e2e/snapshot.spec.ts` | スナップショットを削除できる |
| 1.3s | `e2e/pinned-tab.spec.ts` | ピン留めタブをドラッグで並べ替えられる |
| 1.3s | `e2e/parent-child-consistency.spec.ts` | タブをアクティブにしても親子関係が維持される |
| 1.3s | `e2e/new-tab-position.spec.ts` | 設定でnewTabPositionManualをend-of-rootに変更した場合、新規タブがルートの末尾に追加される |
| 1.3s | `e2e/new-tab-button.spec.ts` | 新規タブボタンをクリックするとタブがツリーの末尾に追加される |
| 1.3s | `e2e/link-open-child-tab.spec.ts` | リンクをCtrl+クリックして開いたタブにさらにリンクがある場合、親子関係が連鎖する |
| 1.3s | `e2e/link-open-child-tab.spec.ts` | Ctrl+クリックで複数のリンクを開くと、すべて同じ親の子タブになる |
| 1.3s | `e2e/drag-drop-scroll.spec.ts` | ドラッグ中に上端・下端に到達するとスクロールすることを検証する |
| 1.3s | `e2e/drag-drop-parent.spec.ts` | タブをタブの上にドロップした場合、ドロップ先の子として配置されること |
| 1.3s | `e2e/drag-drop-multi-select.spec.ts` | 複数選択中に非選択タブをドラッグした場合、選択がリセットされること |
| 1.3s | `e2e/drag-drop-depth.spec.ts` | 親の下にドロップした場合、depth=1が選択できること |
| 1.3s | `e2e/drag-drop-child-reorder.spec.ts` | 子タブを兄弟の間に並び替えできること |
| 1.3s | `e2e/drag-drop-cancel.spec.ts` | ドラッグ中にEscを押すとキャンセルされタブの位置が変わらないこと |
| 1.3s | `e2e/chrome-api-tabs.spec.ts` | chrome.tabs.remove()を呼び出した場合、タブが閉じられツリーから削除される |
| 1.2s | `e2e/view-switching.spec.ts` | ビューアイコンをドラッグして順序を入れ替えられる |
| 1.2s | `e2e/tab-multi-select.spec.ts` | 選択範囲外をクリックすると選択が解除される |
| 1.2s | `e2e/tab-lifecycle.spec.ts` | タブをクリックすると、Chromeでそのタブがアクティブになること |
| 1.2s | `e2e/tab-lifecycle.spec.ts` | タブの閉じるボタンをクリックするとタブが閉じる |
| 1.2s | `e2e/tab-groups.spec.ts` | グループのタイトルを変更するとツリーにも反映される |
| 1.2s | `e2e/tab-expand-collapse.spec.ts` | 展開状態でページをリロードすると展開状態が維持される |
| 1.2s | `e2e/tab-duplicate.spec.ts` | タブを複製すると同じURLで新しいタブが作成される |
| 1.2s | `e2e/settings.spec.ts` | Tailwindテーマカラーを変更できる |
| 1.2s | `e2e/settings.spec.ts` | 設定ページからテーマを変更できる |
| 1.2s | `e2e/settings.spec.ts` | 設定画面を開くとサイドパネルに設定UIが表示される |
| 1.2s | `e2e/pinned-tab.spec.ts` | ピン留めタブをクリックするとアクティブになる |
| 1.2s | `e2e/parent-child-consistency.spec.ts` | 新規タブを追加しても既存の親子関係が維持される |
| 1.2s | `e2e/parent-child-consistency.spec.ts` | 子タブを持つ親タブが存在する場合、親子関係がUI上で正しく表示される |
| 1.2s | `e2e/new-tab-position.spec.ts` | 設定でnewTabPositionManualをend-of-activeに変更すると、タブがアクティブなタブの次に追加される |
| 1.2s | `e2e/new-tab-position.spec.ts` | アクティブタブが子を持つ場合、end-of-activeで新規タブがサブツリーの末尾に追加される |
| 1.2s | `e2e/new-tab-button.spec.ts` | アクティブなタブがある状態で新規タブを作成すると末尾に追加される |
| 1.2s | `e2e/link-open-child-tab.spec.ts` | 親タブを閉じてもリンクから開いた子タブは残る |
| 1.2s | `e2e/drag-drop-visual.spec.ts` | ドラッグ中にドロップインジケーターが表示されること |
| 1.2s | `e2e/drag-drop-to-pinned.spec.ts` | 子タブをピン留めエリアにドラッグすると親子関係が解除されること |
| 1.2s | `e2e/drag-drop-parent.spec.ts` | サブツリーを別のタブの上にドロップした場合、サブツリー全体が子として配置されること |
| 1.2s | `e2e/drag-drop-multi-select.spec.ts` | 異なる階層のタブを複数選択してドラッグした場合、正しく移動されること |
| 1.2s | `e2e/drag-drop-cancel.spec.ts` | ドラッグ中のタブは視覚的にフィードバックがあること |
| 1.2s | `e2e/drag-drop-basic.spec.ts` | タブをドラッグアンドドロップで別の位置に移動できること |
| 1.2s | `e2e/context-menu.spec.ts` | コンテキストメニューから"タブを閉じる"を選択した場合、対象タブが閉じられる |
| 1.2s | `e2e/context-menu.spec.ts` | タブノードを右クリックした場合、コンテキストメニューが表示される |
| 1.2s | `e2e/chrome-api-windows.spec.ts` | chrome.windows.remove()でウィンドウを閉じた場合、ウィンドウ内の全タブがツリーから削除される |
| 1.2s | `e2e/chrome-api-windows.spec.ts` | chrome.windows.create()で新しいウィンドウを作成した場合、新しいウィンドウコンテキストが確立される |
| 1.1s | `e2e/tab-lifecycle.spec.ts` | ブラウザでタブを作成するとツリーに反映される |
| 1.1s | `e2e/tab-groups.spec.ts` | グループを解除するとタブがグループから外れる |
| 1.1s | `e2e/tab-expand-collapse.spec.ts` | 子タブがない場合、折りたたみボタンが表示されない |
| 1.1s | `e2e/pinned-tab.spec.ts` | コンテキストメニューからピン留めできる |
| 1.1s | `e2e/parent-child-consistency.spec.ts` | 子タブを閉じた場合、親タブはそのまま残り、他の子タブの親子関係は維持される |
| 1.1s | `e2e/new-tab-position.spec.ts` | デフォルトで新規タブがアクティブタブの子として追加される |
| 1.1s | `e2e/drag-drop-visual.spec.ts` | ドラッグ終了後にドロップインジケーターが消えること |
| 1.1s | `e2e/drag-drop-to-pinned.spec.ts` | サブツリーの親タブをピン留めエリアにドラッグすると子タブの親子関係が解除されること |
| 1.1s | `e2e/drag-drop-outside.spec.ts` | タブをウィンドウ外にドロップすると新しいウィンドウが作成されること |
| 1.1s | `e2e/drag-drop-multi-select.spec.ts` | 隣接していない複数タブを選択してドラッグした場合、正しく連続して配置されること |
| 1.1s | `e2e/chrome-api-tabs.spec.ts` | chrome.tabs.update()でURLを変更した場合、タブ情報が更新される |
| 1.1s | `e2e/chrome-api-tabs.spec.ts` | chrome.tabs.create()でopenerTabIdを指定した場合、親子関係が確立される |
| 1.0s | `e2e/tab-lifecycle.spec.ts` | タブのタイトルとFaviconが正しく表示されること |
| 1.0s | `e2e/tab-groups.spec.ts` | タブをグループに追加するとグループの色がUIに反映される |
| 1.0s | `e2e/side-panel.spec.ts` | サイドパネルを開くとタブツリーが表示される |
| 1.0s | `e2e/pinned-tab.spec.ts` | 複数のタブをピン留めすると横並びで表示される |
| 1.0s | `e2e/new-tab-position.spec.ts` | newTabPositionManualをchild-of-activeに設定時、アクティブタブの子として追加される |
| 1.0s | `e2e/drag-drop-parent.spec.ts` | ルートタブを別のルートタブの子として移動できること |
| 1.0s | `e2e/drag-drop-from-pinned.spec.ts` | ピン留めタブを通常エリアにドラッグするとピン留めが解除されること |
| 1.0s | `e2e/drag-drop-depth.spec.ts` | depth選択で選択した深さが実際に適用されること |
| 1.0s | `e2e/drag-drop-basic.spec.ts` | タブをドラッグすると視覚的なフィードバックがあること |
| 1.0s | `e2e/chrome-api-tabs.spec.ts` | chrome.tabs.create()を呼び出した場合、新しいタブが作成される |
