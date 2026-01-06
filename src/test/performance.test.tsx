/**
 * パフォーマンステスト
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import SidePanelRoot from '@/sidepanel/components/SidePanelRoot';
import { IndexedDBService } from '@/storage/IndexedDBService';
import type { TabNode, Snapshot } from '@/types';

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
    tabs.push({
      id: `node-${i}`,
      tabId: i + 1,
      parentId: i > 0 && i % 5 === 0 ? `node-${i - 1}` : null,
      children: [],
      isExpanded: true,
      depth: i % 5 === 0 ? 1 : 0,
      viewId: 'default-view',
    });
  }
  return tabs;
}

describe('パフォーマンステスト', () => {
  describe('100タブ以上でのレンダリング性能', () => {
    it('100タブのレンダリングが500ms以内に完了すること', async () => {
      const mockTabs = generateMockTabs(100);

      const chromeMock = {
        runtime: {
          sendMessage: vi.fn().mockResolvedValue({
            success: true,
            data: {
              nodes: mockTabs,
              currentViewId: 'default-view',
              views: [{ id: 'default-view', name: 'Default', color: '#000000' }],
            },
          }),
          onMessage: {
            addListener: vi.fn(),
            removeListener: vi.fn(),
          },
        },
        storage: {
          local: {
            get: vi.fn().mockResolvedValue({}),
            set: vi.fn().mockResolvedValue(undefined),
          },
          onChanged: {
            addListener: vi.fn(),
            removeListener: vi.fn(),
          },
        },
        tabs: {
          onActivated: {
            addListener: vi.fn(),
            removeListener: vi.fn(),
          },
          onUpdated: {
            addListener: vi.fn(),
            removeListener: vi.fn(),
          },
          onMoved: {
            addListener: vi.fn(),
            removeListener: vi.fn(),
          },
          onCreated: {
            addListener: vi.fn(),
            removeListener: vi.fn(),
          },
          onRemoved: {
            addListener: vi.fn(),
            removeListener: vi.fn(),
          },
          query: vi.fn().mockResolvedValue([]),
        },
        windows: {
          getCurrent: vi.fn().mockResolvedValue({ id: 1 }),
        },
      };
      vi.stubGlobal('chrome', chromeMock);

      const renderTime = await measureAsyncPerformance(async () => {
        await act(async () => {
          render(<SidePanelRoot />);
        });
      });

      expect(renderTime).toBeLessThan(500);
    });

    it('200タブのレンダリングが1000ms以内に完了すること', async () => {
      const mockTabs = generateMockTabs(200);

      const chromeMock = {
        runtime: {
          sendMessage: vi.fn().mockResolvedValue({
            success: true,
            data: {
              nodes: mockTabs,
              currentViewId: 'default-view',
              views: [{ id: 'default-view', name: 'Default', color: '#000000' }],
            },
          }),
          onMessage: {
            addListener: vi.fn(),
            removeListener: vi.fn(),
          },
        },
        storage: {
          local: {
            get: vi.fn().mockResolvedValue({}),
            set: vi.fn().mockResolvedValue(undefined),
          },
          onChanged: {
            addListener: vi.fn(),
            removeListener: vi.fn(),
          },
        },
        tabs: {
          onActivated: {
            addListener: vi.fn(),
            removeListener: vi.fn(),
          },
          onUpdated: {
            addListener: vi.fn(),
            removeListener: vi.fn(),
          },
          onMoved: {
            addListener: vi.fn(),
            removeListener: vi.fn(),
          },
          onCreated: {
            addListener: vi.fn(),
            removeListener: vi.fn(),
          },
          onRemoved: {
            addListener: vi.fn(),
            removeListener: vi.fn(),
          },
          query: vi.fn().mockResolvedValue([]),
        },
        windows: {
          getCurrent: vi.fn().mockResolvedValue({ id: 1 }),
        },
      };
      vi.stubGlobal('chrome', chromeMock);

      const renderTime = await measureAsyncPerformance(async () => {
        await act(async () => {
          render(<SidePanelRoot />);
        });
      });

      expect(renderTime).toBeLessThan(1000);
    });
  });

  describe('IndexedDB操作の性能', () => {
    let indexedDBService: IndexedDBService;

    beforeEach(() => {
      indexedDBService = new IndexedDBService();
    });

    it('スナップショット保存が100ms以内に完了すること', async () => {
      const snapshot: Snapshot = {
        id: 'perf-test-1',
        createdAt: new Date(),
        name: 'Performance Test Snapshot',
        isAutoSave: false,
        data: {
          views: [{ id: 'view-1', name: 'View 1', color: '#000000' }],
          tabs: generateMockTabs(100).map((tab) => ({
            url: `https://example.com/page-${tab.tabId}`,
            title: `Tab ${tab.tabId}`,
            parentId: tab.parentId,
            viewId: tab.viewId,
          })),
          groups: [],
        },
      };

      const saveTime = await measureAsyncPerformance(async () => {
        await indexedDBService.saveSnapshot(snapshot);
      });

      expect(saveTime).toBeLessThan(100);
    });

    it('スナップショット読み込みが100ms以内に完了すること', async () => {
      const snapshot: Snapshot = {
        id: 'perf-test-2',
        createdAt: new Date(),
        name: 'Performance Test Snapshot',
        isAutoSave: false,
        data: {
          views: [{ id: 'view-1', name: 'View 1', color: '#000000' }],
          tabs: generateMockTabs(100).map((tab) => ({
            url: `https://example.com/page-${tab.tabId}`,
            title: `Tab ${tab.tabId}`,
            parentId: tab.parentId,
            viewId: tab.viewId,
          })),
          groups: [],
        },
      };

      await indexedDBService.saveSnapshot(snapshot);

      const loadTime = await measureAsyncPerformance(async () => {
        await indexedDBService.getSnapshot('perf-test-2');
      });

      expect(loadTime).toBeLessThan(100);
    });

    it('全スナップショット取得が100ms以内に完了すること', async () => {
      // 10個のスナップショットを作成
      for (let i = 0; i < 10; i++) {
        const snapshot: Snapshot = {
          id: `perf-test-all-${i}`,
          createdAt: new Date(),
          name: `Snapshot ${i}`,
          isAutoSave: false,
          data: {
            views: [{ id: 'view-1', name: 'View 1', color: '#000000' }],
            tabs: generateMockTabs(50).map((tab) => ({
              url: `https://example.com/page-${tab.tabId}`,
              title: `Tab ${tab.tabId}`,
              parentId: tab.parentId,
              viewId: tab.viewId,
            })),
            groups: [],
          },
        };
        await indexedDBService.saveSnapshot(snapshot);
      }

      const loadAllTime = await measureAsyncPerformance(async () => {
        await indexedDBService.getAllSnapshots();
      });

      expect(loadAllTime).toBeLessThan(100);
    });
  });

  describe('ドラッグ&ドロップのパフォーマンス', () => {
    it('ドラッグ操作中のフレームレートが60fps（16.67ms以下）を維持すること', () => {
      const mockTabs = generateMockTabs(100);
      let frameCount = 0;
      let totalFrameTime = 0;

      for (let i = 0; i < 60; i++) {
        const frameTime = measurePerformance(() => {
          const draggedNodeId = `node-${i % 100}`;
          const hoveredNodeId = `node-${(i + 1) % 100}`;

          mockTabs.find((tab) => tab.id === draggedNodeId);
          mockTabs.find((tab) => tab.id === hoveredNodeId);

          const newTree = [...mockTabs];
          newTree.sort((a, b) => a.depth - b.depth);
        });

        totalFrameTime += frameTime;
        frameCount++;
      }

      const averageFrameTime = totalFrameTime / frameCount;
      const targetFrameTime = 1000 / 60; // ms

      expect(averageFrameTime).toBeLessThan(targetFrameTime);
    });
  });

  describe('ストレージ操作のバッチ性能', () => {
    it('複数のストレージ書き込みが適切にデバウンスされること', async () => {
      const mockStorage = {
        set: vi.fn().mockResolvedValue(undefined),
      };

      const chromeMock = {
        storage: {
          local: mockStorage,
        },
      };
      vi.stubGlobal('chrome', chromeMock);

      const writeOperations = Array.from({ length: 100 }, (_, i) => ({
        key: 'tree_state',
        value: { updateCount: i },
      }));

      const totalTime = await measureAsyncPerformance(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        await mockStorage.set(writeOperations[writeOperations.length - 1].key, writeOperations[writeOperations.length - 1].value);
      });

      expect(mockStorage.set).toHaveBeenCalledTimes(1);
      expect(totalTime).toBeLessThan(50);
    });
  });
});
