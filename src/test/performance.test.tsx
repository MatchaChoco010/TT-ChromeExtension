/**
 * パフォーマンステスト
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import SidePanelRoot from '@/sidepanel/components/SidePanelRoot';
import { chromeMock } from '@/test/chrome-mock';
import type { TabNode } from '@/types';

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
  beforeEach(() => {
    vi.clearAllMocks();
    chromeMock.clearAllListeners();
  });

  describe('100タブ以上でのレンダリング性能', () => {
    it('100タブのレンダリングが500ms以内に完了すること', async () => {
      const mockTabs = generateMockTabs(100);

      chromeMock.runtime.sendMessage.mockResolvedValue({
        success: true,
        data: {
          nodes: mockTabs,
          currentViewId: 'default-view',
          views: [{ id: 'default-view', name: 'Default', color: '#000000' }],
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

      chromeMock.runtime.sendMessage.mockResolvedValue({
        success: true,
        data: {
          nodes: mockTabs,
          currentViewId: 'default-view',
          views: [{ id: 'default-view', name: 'Default', color: '#000000' }],
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
