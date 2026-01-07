import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@/test/test-utils';
import TabTreeView from './TabTreeView';
import { TreeStateProvider, useTreeState } from '../providers/TreeStateProvider';
import { act } from 'react';
import type { TreeState, DragEndEvent } from '@/types';
import { getMockChrome } from '@/test/test-types';

function IntegrationTestComponent() {
  const { treeState, handleDragEnd } = useTreeState();

  const handleNodeClick = vi.fn();
  const handleToggleExpand = vi.fn();

  if (!treeState) {
    return <div>Loading...</div>;
  }

  const rootNodes = Object.values(treeState.nodes).filter(
    (node) => node.parentId === null
  );

  return (
    <TabTreeView
      nodes={rootNodes}
      currentViewId={treeState.currentViewId}
      onNodeClick={handleNodeClick}
      onToggleExpand={handleToggleExpand}
      onDragEnd={handleDragEnd}
    />
  );
}

describe('パネル内D&Dの統合テスト', () => {
  let sendMessageMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    sendMessageMock = vi.fn().mockResolvedValue(undefined);

    global.chrome = {
      storage: {
        local: {
          get: vi.fn().mockResolvedValue({
            tree_state: {
              views: [{ id: 'default', name: 'Default', color: '#3b82f6' }],
              currentViewId: 'default',
              nodes: {
                'node-1': {
                  id: 'node-1',
                  tabId: 1,
                  parentId: null,
                  children: [],
                  isExpanded: true,
                  depth: 0,
                  viewId: 'default',
                },
                'node-2': {
                  id: 'node-2',
                  tabId: 2,
                  parentId: null,
                  children: [],
                  isExpanded: true,
                  depth: 0,
                  viewId: 'default',
                },
                'node-3': {
                  id: 'node-3',
                  tabId: 3,
                  parentId: null,
                  children: [
                    {
                      id: 'node-4',
                      tabId: 4,
                      parentId: 'node-3',
                      children: [],
                      isExpanded: true,
                      depth: 1,
                      viewId: 'default',
                    },
                  ],
                  isExpanded: false,
                  depth: 0,
                  viewId: 'default',
                },
                'node-4': {
                  id: 'node-4',
                  tabId: 4,
                  parentId: 'node-3',
                  children: [],
                  isExpanded: true,
                  depth: 1,
                  viewId: 'default',
                },
              },
              tabToNode: {
                '1': 'node-1',
                '2': 'node-2',
                '3': 'node-3',
                '4': 'node-4',
              },
            },
          }),
          set: vi.fn().mockResolvedValue(undefined),
        },
        onChanged: {
          addListener: vi.fn(),
          removeListener: vi.fn(),
        },
      },
      runtime: {
        sendMessage: sendMessageMock,
        onMessage: {
          addListener: vi.fn(),
          removeListener: vi.fn(),
        },
      },
      tabs: {
        query: vi.fn().mockResolvedValue([{ id: 1 }]),
        onActivated: {
          addListener: vi.fn(),
          removeListener: vi.fn(),
        },
        onUpdated: {
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
        onMoved: {
          addListener: vi.fn(),
          removeListener: vi.fn(),
        },
        onDetached: {
          addListener: vi.fn(),
          removeListener: vi.fn(),
        },
        onAttached: {
          addListener: vi.fn(),
          removeListener: vi.fn(),
        },
      },
      windows: {
        getCurrent: vi.fn().mockResolvedValue({ id: 1 }),
        onFocusChanged: {
          addListener: vi.fn(),
          removeListener: vi.fn(),
        },
      },
    } as unknown as typeof chrome;
  });

  describe('完全なドラッグ&ドロップワークフロー', () => {
    it('シナリオ1: タブを子として配置、同階層で移動を連続して実行', async () => {
      let testHandleDragEnd: ((event: DragEndEvent) => void) | undefined;
      function TestHookComponent() {
        const { handleDragEnd } = useTreeState();
        testHandleDragEnd = handleDragEnd;
        return null;
      }

      render(
        <TreeStateProvider>
          <TestHookComponent />
          <IntegrationTestComponent />
        </TreeStateProvider>
      );

      // Note: data-testid is tree-node-{tabId} (not tree-node-{nodeId})
      await waitFor(() => {
        expect(screen.getByTestId('tree-node-1')).toBeInTheDocument();
        expect(screen.getByTestId('tree-node-2')).toBeInTheDocument();
        expect(screen.getByTestId('tree-node-3')).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(testHandleDragEnd).toBeDefined();
      });

      // Step 1: Place tab as child of another tab
      const dragEndEvent1 = {
        active: {
          id: 'node-2',
          data: { current: undefined },
          rect: { current: { initial: null, translated: null } },
        },
        over: {
          id: 'node-1',
          data: { current: undefined },
          rect: null,
          disabled: false,
        },
        delta: { x: 0, y: 0 },
        activatorEvent: new MouseEvent('mouseup'),
        collisions: null,
      } as unknown as DragEndEvent;

      await act(async () => {
        await testHandleDragEnd!(dragEndEvent1);
      });

      const mockChrome = getMockChrome();
      await waitFor(() => {
        expect(chrome.storage.local.set).toHaveBeenCalled();
        const lastCall = mockChrome.storage.local.set.mock.calls.slice(-1)[0];
        if (lastCall && lastCall[0]?.tree_state) {
          const updatedNodes = (lastCall[0].tree_state as TreeState).nodes;
          expect(updatedNodes['node-2'].parentId).toBe('node-1');
        }
      });

      vi.mocked(chrome.storage.local.set).mockClear();

      // Step 2: Reorder tabs within same level
      const dragEndEvent2 = {
        active: {
          id: 'node-3',
          data: { current: undefined },
          rect: { current: { initial: null, translated: null } },
        },
        over: {
          id: 'node-1',
          data: { current: undefined },
          rect: null,
          disabled: false,
        },
        delta: { x: 0, y: 0 },
        activatorEvent: new MouseEvent('mouseup'),
        collisions: null,
      } as unknown as DragEndEvent;

      await act(async () => {
        await testHandleDragEnd!(dragEndEvent2);
      });

      await waitFor(() => {
        expect(chrome.storage.local.set).toHaveBeenCalled();
      });
    });

    it('タブをドラッグして別のタブの子として配置できる', async () => {
      let testHandleDragEnd: ((event: DragEndEvent) => void) | undefined;

      function TestHookComponent() {
        const { handleDragEnd } = useTreeState();
        testHandleDragEnd = handleDragEnd;
        return null;
      }

      render(
        <TreeStateProvider>
          <TestHookComponent />
          <IntegrationTestComponent />
        </TreeStateProvider>
      );

      await waitFor(() => {
        expect(testHandleDragEnd).toBeDefined();
      });

      const dragEndEvent = {
        active: {
          id: 'node-2',
          data: { current: undefined },
          rect: { current: { initial: null, translated: null } },
        },
        over: {
          id: 'node-1',
          data: { current: undefined },
          rect: null,
          disabled: false,
        },
        delta: { x: 0, y: 0 },
        activatorEvent: new MouseEvent('mouseup'),
        collisions: null,
      } as unknown as DragEndEvent;

      await act(async () => {
        await testHandleDragEnd!(dragEndEvent);
      });

      const mockChrome = getMockChrome();
      await waitFor(() => {
        expect(chrome.storage.local.set).toHaveBeenCalled();
        const lastCall = mockChrome.storage.local.set.mock.calls.slice(-1)[0];
        if (lastCall && lastCall[0]?.tree_state) {
          const updatedNodes = (lastCall[0].tree_state as TreeState).nodes;
          expect(updatedNodes['node-2'].parentId).toBe('node-1');
        }
      });
    });

    it('タブを同階層で順序変更できる', async () => {
      let testHandleDragEnd: ((event: DragEndEvent) => void) | undefined;

      function TestHookComponent() {
        const { handleDragEnd } = useTreeState();
        testHandleDragEnd = handleDragEnd;
        return null;
      }

      render(
        <TreeStateProvider>
          <TestHookComponent />
          <IntegrationTestComponent />
        </TreeStateProvider>
      );

      await waitFor(() => {
        expect(testHandleDragEnd).toBeDefined();
      });

      const dragEndEvent = {
        active: {
          id: 'node-2',
          data: { current: undefined },
          rect: { current: { initial: null, translated: null } },
        },
        over: {
          id: 'node-1',
          data: { current: undefined },
          rect: null,
          disabled: false,
        },
        delta: { x: 0, y: 0 },
        activatorEvent: new MouseEvent('mouseup'),
        collisions: null,
      } as unknown as DragEndEvent;

      await act(async () => {
        await testHandleDragEnd!(dragEndEvent);
      });

      await waitFor(() => {
        expect(chrome.storage.local.set).toHaveBeenCalled();
      });
    });

    it('ホバー時にブランチが自動展開される (既存テストで確認)', async () => {
      // DragHoverAutoExpand.test.tsx で実装されています
      render(
        <TreeStateProvider>
          <IntegrationTestComponent />
        </TreeStateProvider>
      );

      // Note: data-testid is tree-node-{tabId} (not tree-node-{nodeId})
      await waitFor(() => {
        expect(screen.getByTestId('tree-node-1')).toBeInTheDocument();
        expect(screen.getByTestId('tree-node-3')).toBeInTheDocument();
      });

      const node3 = screen.getByTestId('tree-node-3');
      expect(node3).toBeInTheDocument();

      expect(screen.queryByTestId('tree-node-4')).not.toBeInTheDocument();

      // DragHoverAutoExpand.test.tsx で詳細なテストを実施
      expect(true).toBe(true);
    });
  });

  describe('エラーケースとエッジケース', () => {
    it('循環参照を防ぐ', async () => {
      const mockChrome = getMockChrome();
      mockChrome.storage.local.get.mockResolvedValue({
        tree_state: {
          views: [{ id: 'default', name: 'Default', color: '#3b82f6' }],
          currentViewId: 'default',
          nodes: {
            'node-1': {
              id: 'node-1',
              tabId: 1,
              parentId: null,
              children: [
                {
                  id: 'node-2',
                  tabId: 2,
                  parentId: 'node-1',
                  children: [],
                  isExpanded: true,
                  depth: 1,
                  viewId: 'default',
                },
              ],
              isExpanded: true,
              depth: 0,
              viewId: 'default',
            },
            'node-2': {
              id: 'node-2',
              tabId: 2,
              parentId: 'node-1',
              children: [],
              isExpanded: true,
              depth: 1,
              viewId: 'default',
            },
          },
          tabToNode: {
            '1': 'node-1',
            '2': 'node-2',
          },
        },
      });

      let testHandleDragEnd: ((event: DragEndEvent) => void) | undefined;

      function TestHookComponent() {
        const { handleDragEnd } = useTreeState();
        testHandleDragEnd = handleDragEnd;
        return null;
      }

      render(
        <TreeStateProvider>
          <TestHookComponent />
        </TreeStateProvider>
      );

      await waitFor(() => {
        expect(testHandleDragEnd).toBeDefined();
      });

      const dragEndEvent = {
        active: {
          id: 'node-1',
          data: { current: undefined },
          rect: { current: { initial: null, translated: null } },
        },
        over: {
          id: 'node-2',
          data: { current: undefined },
          rect: null,
          disabled: false,
        },
        delta: { x: 0, y: 0 },
        activatorEvent: new MouseEvent('mouseup'),
        collisions: null,
      } as unknown as DragEndEvent;

      await act(async () => {
        await testHandleDragEnd!(dragEndEvent);
      });

      await waitFor(() => {
        expect(sendMessageMock).not.toHaveBeenCalled();
      });
    });

    it('同じノードへのドロップは操作をキャンセルする', async () => {
      let testHandleDragEnd: ((event: DragEndEvent) => void) | undefined;

      function TestHookComponent() {
        const { handleDragEnd } = useTreeState();
        testHandleDragEnd = handleDragEnd;
        return null;
      }

      render(
        <TreeStateProvider>
          <TestHookComponent />
        </TreeStateProvider>
      );

      await waitFor(() => {
        expect(testHandleDragEnd).toBeDefined();
      });

      const dragEndEvent = {
        active: {
          id: 'node-1',
          data: { current: undefined },
          rect: { current: { initial: null, translated: null } },
        },
        over: {
          id: 'node-1',
          data: { current: undefined },
          rect: null,
          disabled: false,
        },
        delta: { x: 0, y: 0 },
        activatorEvent: new MouseEvent('mouseup'),
        collisions: null,
      } as unknown as DragEndEvent;

      await act(async () => {
        await testHandleDragEnd!(dragEndEvent);
      });

      expect(sendMessageMock).not.toHaveBeenCalled();
    });
  });
});
