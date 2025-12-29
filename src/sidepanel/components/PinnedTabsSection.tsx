import React from 'react';
import type { TabInfoMap } from '@/types';

interface PinnedTabsSectionProps {
  pinnedTabIds: number[];
  tabInfoMap: TabInfoMap;
  onTabClick: (tabId: number) => void;
  /** ピン留めタブの右クリック時に呼ばれるコールバック (要件1.6, 1.7) */
  onContextMenu?: (tabId: number, position: { x: number; y: number }) => void;
}

/**
 * Task 3.1: ピン留めタブセクションコンポーネント
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5 (tree-tab-ux-improvements)
 *
 * - ピン留めタブをツリービュー上部に配置
 * - ファビコンサイズで横並びグリッド表示
 * - 通常タブとの間に区切り線
 * - ピン留めタブが0件の場合は非表示
 * - 閉じるボタンは表示しない（要件1.1）
 * - ピン留めタブに対する閉じる操作は無効化（要件1.3）
 */
const PinnedTabsSection: React.FC<PinnedTabsSectionProps> = ({
  pinnedTabIds,
  tabInfoMap,
  onTabClick,
  onContextMenu,
}) => {

  // ピン留めタブが0件の場合は何も表示しない
  if (pinnedTabIds.length === 0) {
    return null;
  }

  // tabInfoMapに存在するピン留めタブのみをフィルタリング
  const validPinnedTabs = pinnedTabIds.filter(tabId => tabInfoMap[tabId]);

  // 有効なピン留めタブがない場合も非表示
  if (validPinnedTabs.length === 0) {
    return null;
  }

  const handleTabClick = (tabId: number) => {
    onTabClick(tabId);
  };

  /**
   * 右クリックハンドラ（要件1.6, 1.7対応）
   * ピン留めタブを右クリックした場合にコンテキストメニューを表示するため
   */
  const handleContextMenu = (tabId: number, event: React.MouseEvent) => {
    event.preventDefault();
    if (onContextMenu) {
      onContextMenu(tabId, { x: event.clientX, y: event.clientY });
    }
  };

  return (
    <>
      {/* ピン留めタブセクション */}
      <div
        data-testid="pinned-tabs-section"
        className="flex flex-wrap gap-1 p-2"
      >
        {validPinnedTabs.map(tabId => {
          const tabInfo = tabInfoMap[tabId];

          return (
            <div
              key={tabId}
              data-testid={`pinned-tab-${tabId}`}
              className="relative flex items-center justify-center w-7 h-7 rounded cursor-pointer hover:bg-gray-700"
              title={tabInfo.title}
              onClick={() => handleTabClick(tabId)}
              onContextMenu={(e) => handleContextMenu(tabId, e)}
            >
              {/* ファビコン */}
              {tabInfo.favIconUrl ? (
                <img
                  src={tabInfo.favIconUrl}
                  alt={tabInfo.title}
                  className="w-4 h-4"
                  onError={(e) => {
                    // ファビコンの読み込みに失敗した場合は非表示にしてデフォルトアイコンを表示
                    e.currentTarget.style.display = 'none';
                    const defaultIcon = e.currentTarget.parentElement?.querySelector('[data-default-icon]');
                    if (defaultIcon) {
                      (defaultIcon as HTMLElement).style.display = 'block';
                    }
                  }}
                />
              ) : (
                <div
                  data-testid={`pinned-tab-${tabId}-default-icon`}
                  className="w-4 h-4 bg-gray-400 rounded"
                />
              )}
              {/* 閉じるボタンは表示しない（要件1.1）*/}
            </div>
          );
        })}
      </div>

      {/* 区切り線 */}
      <div
        data-testid="pinned-tabs-separator"
        className="border-b border-gray-700 mx-2"
      />
    </>
  );
};

export default PinnedTabsSection;
