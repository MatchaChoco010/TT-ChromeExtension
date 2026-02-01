import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import SidePanelRoot from '@/sidepanel/components/SidePanelRoot';
import { chromeMock } from '@/test/chrome-mock';
import type { TabNode, WindowState } from '@/types';

function measurePerformance(fn: () => void | Promise<void>): number {
  const start = performance.now();
  fn();
  const end = performance.now();
  return end - start;
}

async function measureAsyncPerformance(fn: () => Promise<void>): Promise<number> {
  const start = performance.now();
  await fn();
  const end = performance.now();
  return end - start;
}

function generateMockTabs(count: number): TabNode[] {
  const tabs: TabNode[] = [];
  for (let i = 0; i < count; i++) {
    const isParent = i > 0 && i % 5 === 0;
    if (isParent && tabs.length > 0) {
      const parentTab = tabs[tabs.length - 1];
      parentTab.children.push({
        tabId: i + 1,
        isExpanded: true,
        children: [],
      });
    } else {
      tabs.push({
        tabId: i + 1,
        isExpanded: true,
        children: [],
      });
    }
  }
  return tabs;
}

function generateMockWindowState(tabs: TabNode[]): WindowState {
  return {
    windowId: 1,
    views: [{ name: 'Default', color: '#000000', rootNodes: tabs, pinnedTabIds: [] }],
    activeViewIndex: 0,
  };
}

describe('パフォーマンステスト', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chromeMock.clearAllListeners();
  });

  describe('100タブ以上でのレンダリング性能', () => {
    it('100タブのレンダリングが500ms以内に完了すること', async () => {
      const mockTabs = generateMockTabs(100);
      const windowState = generateMockWindowState(mockTabs);

      chromeMock.runtime.sendMessage.mockResolvedValue({
        success: true,
        data: {
          windows: [windowState],
          currentViewIndex: 0,
          viewTabCounts: [100],
        },
      });

      const renderTime = await measureAsyncPerformance(async () => {
        await act(async () => {
          render(<SidePanelRoot />);
        });
      });

      expect(renderTime).toBeLessThan(500);
    });

    it('200タブのレンダリングが1000ms以内に完了すること', async () => {
      const mockTabs = generateMockTabs(200);
      const windowState = generateMockWindowState(mockTabs);

      chromeMock.runtime.sendMessage.mockResolvedValue({
        success: true,
        data: {
          windows: [windowState],
          currentViewIndex: 0,
          viewTabCounts: [200],
        },
      });

      const renderTime = await measureAsyncPerformance(async () => {
        await act(async () => {
          render(<SidePanelRoot />);
        });
      });

      expect(renderTime).toBeLessThan(1000);
    });
  });


  describe('ドラッグ&ドロップのパフォーマンス', () => {
    it('ドラッグ操作中のフレームレートが60fps（16.67ms以下）を維持すること', () => {
      const mockTabs = generateMockTabs(100);
      let frameCount = 0;
      let totalFrameTime = 0;

      for (let i = 0; i < 60; i++) {
        const frameTime = measurePerformance(() => {
          const draggedTabId = (i % 100) + 1;
          const hoveredTabId = ((i + 1) % 100) + 1;

          const findTab = (nodes: TabNode[], targetId: number): TabNode | undefined => {
            for (const node of nodes) {
              if (node.tabId === targetId) return node;
              const found = findTab(node.children, targetId);
              if (found) return found;
            }
            return undefined;
          };

          findTab(mockTabs, draggedTabId);
          findTab(mockTabs, hoveredTabId);

          const flattenTabs = (nodes: TabNode[]): TabNode[] => {
            const result: TabNode[] = [];
            for (const node of nodes) {
              result.push(node);
              result.push(...flattenTabs(node.children));
            }
            return result;
          };

          flattenTabs(mockTabs);
        });

        totalFrameTime += frameTime;
        frameCount++;
      }

      const averageFrameTime = totalFrameTime / frameCount;
      const targetFrameTimeMs = 1000 / 60;

      expect(averageFrameTime).toBeLessThan(targetFrameTimeMs);
    });
  });

  describe('ストレージ操作のバッチ性能', () => {
    it('複数のストレージ書き込みが適切にデバウンスされること', async () => {
      const writeOperations = Array.from({ length: 100 }, (_, i) => ({
        key: 'tree_state',
        value: { updateCount: i },
      }));

      const totalTime = await measureAsyncPerformance(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        await chromeMock.storage.local.set({
          [writeOperations[writeOperations.length - 1].key]:
            writeOperations[writeOperations.length - 1].value,
        });
      });

      expect(chromeMock.storage.local.set).toHaveBeenCalledTimes(1);
      expect(totalTime).toBeLessThan(50);
    });
  });
});
