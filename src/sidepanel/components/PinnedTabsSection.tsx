import React, { useState } from 'react';
import type { TabInfoMap } from '@/types';

interface PinnedTabsSectionProps {
  pinnedTabIds: number[];
  tabInfoMap: TabInfoMap;
  onTabClick: (tabId: number) => void;
  onTabClose: (tabId: number) => void;
}

/**
 * Task 3.1: ピン留めタブセクションコンポーネント
 * Requirements: 12.1, 12.2, 12.3, 12.4
 *
 * - ピン留めタブをツリービュー上部に配置
 * - ファビコンサイズで横並びグリッド表示
 * - 通常タブとの間に区切り線
 * - ピン留めタブが0件の場合は非表示
 */
const PinnedTabsSection: React.FC<PinnedTabsSectionProps> = ({
  pinnedTabIds,
  tabInfoMap,
  onTabClick,
  onTabClose,
}) => {
  const [hoveredTabId, setHoveredTabId] = useState<number | null>(null);

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

  const handleCloseClick = (e: React.MouseEvent, tabId: number) => {
    e.stopPropagation(); // 親のonTabClickが発火しないようにする
    onTabClose(tabId);
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
          const isHovered = hoveredTabId === tabId;

          return (
            <div
              key={tabId}
              data-testid={`pinned-tab-${tabId}`}
              className="relative flex items-center justify-center w-7 h-7 rounded cursor-pointer hover:bg-gray-700"
              title={tabInfo.title}
              onClick={() => handleTabClick(tabId)}
              onMouseEnter={() => setHoveredTabId(tabId)}
              onMouseLeave={() => setHoveredTabId(null)}
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

              {/* 閉じるボタン（ホバー時のみ表示） */}
              {isHovered && (
                <button
                  data-testid={`pinned-tab-${tabId}-close-button`}
                  className="absolute -top-1 -right-1 w-4 h-4 flex items-center justify-center bg-red-500 hover:bg-red-600 text-white rounded-full text-xs"
                  onClick={(e) => handleCloseClick(e, tabId)}
                  aria-label={`Close ${tabInfo.title}`}
                >
                  x
                </button>
              )}
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
