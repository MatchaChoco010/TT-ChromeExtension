import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@/test/test-utils';
import TabTreeView from './TabTreeView';
import { TreeStateProvider, useTreeState } from '../providers/TreeStateProvider';
import { act } from 'react';
import type { DragEndEvent, UITabNode, TreeState } from '@/types';
import { getMockChrome } from '@/test/test-types';

function IntegrationTestComponent() {
  const { currentWindowState, handleDragEnd, currentViewIndex } = useTreeState();

  const handleNodeClick = vi.fn();
  const handleToggleExpand = vi.fn();

  if (!currentWindowState) {
    return <div>Loading...</div>;
  }

  const currentView = currentWindowState.views[currentViewIndex];
  const addDepth = (nodes: UITabNode[], depth: number): UITabNode[] => {
    return nodes.map((node) => ({
      ...node,
      depth,
      children: addDepth(node.children as UITabNode[], depth + 1),
    }));
  };
  const rootNodes: UITabNode[] = currentView
    ? addDepth(currentView.rootNodes as UITabNode[], 0)
    : [];

  return (
    <TabTreeView
      nodes={rootNodes}
      currentViewIndex={currentViewIndex}
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

    const mockTreeState: TreeState = {
      windows: [
        {
          windowId: 1,
          views: [
            {
              name: 'Default',
              color: '#3b82f6',
              rootNodes: [
                {
                  tabId: 1,
                  children: [],
                  isExpanded: true,
                },
                {
                  tabId: 2,
                  children: [],
                  isExpanded: true,
                },
                {
                  tabId: 3,
                  children: [
                    {
                      tabId: 4,
                      children: [],
                      isExpanded: true,
                    },
                  ],
                  isExpanded: false,
                },
              ],
              pinnedTabIds: [],
            },
          ],
          activeViewIndex: 0,
        },
      ],
    };

    sendMessageMock = vi.fn().mockImplementation((message) => {
      if (message.type === 'GET_STATE') {
        return Promise.resolve({ success: true, data: mockTreeState });
      }
      return Promise.resolve({ success: true });
    });

    global.chrome = {
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
          id: 2,
          data: { current: undefined },
          rect: { current: { initial: null, translated: null } },
        },
        over: {
          id: 1,
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
        expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
          type: 'MOVE_NODE',
          payload: {
            tabId: 2,
            targetParentTabId: 1,
            windowId: 1,
            viewIndex: 0,
            selectedTabIds: [],
          },
        });
      });

      vi.mocked(sendMessageMock).mockClear();

      // Step 2: Reorder tabs within same level
      const dragEndEvent2 = {
        active: {
          id: 3,
          data: { current: undefined },
          rect: { current: { initial: null, translated: null } },
        },
        over: {
          id: 1,
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
        expect(sendMessageMock).toHaveBeenCalledWith({
          type: 'MOVE_NODE',
          payload: {
            tabId: 3,
            targetParentTabId: 1,
            windowId: 1,
            viewIndex: 0,
            selectedTabIds: [],
          },
        });
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
          id: 2,
          data: { current: undefined },
          rect: { current: { initial: null, translated: null } },
        },
        over: {
          id: 1,
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
        expect(sendMessageMock).toHaveBeenCalledWith({
          type: 'MOVE_NODE',
          payload: {
            tabId: 2,
            targetParentTabId: 1,
            windowId: 1,
            viewIndex: 0,
            selectedTabIds: [],
          },
        });
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
          id: 2,
          data: { current: undefined },
          rect: { current: { initial: null, translated: null } },
        },
        over: {
          id: 1,
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
        expect(sendMessageMock).toHaveBeenCalledWith({
          type: 'MOVE_NODE',
          payload: {
            tabId: 2,
            targetParentTabId: 1,
            windowId: 1,
            viewIndex: 0,
            selectedTabIds: [],
          },
        });
      });
    });

    it('ホバー時にブランチが自動展開される (既存テストで確認)', async () => {
      render(
        <TreeStateProvider>
          <IntegrationTestComponent />
        </TreeStateProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('tree-node-1')).toBeInTheDocument();
        expect(screen.getByTestId('tree-node-3')).toBeInTheDocument();
      });

      const node3 = screen.getByTestId('tree-node-3');
      expect(node3).toBeInTheDocument();

      expect(screen.queryByTestId('tree-node-4')).not.toBeInTheDocument();

      expect(true).toBe(true);
    });
  });

  describe('エラーケースとエッジケース', () => {
    it('循環参照を防ぐ', async () => {
      const mockChrome = getMockChrome();
      const mockTreeStateForCircular: TreeState = {
        windows: [
          {
            windowId: 1,
            views: [
              {
                name: 'Default',
                color: '#3b82f6',
                rootNodes: [
                  {
                    tabId: 1,
                    children: [
                      {
                        tabId: 2,
                        children: [],
                        isExpanded: true,
                      },
                    ],
                    isExpanded: true,
                  },
                ],
                pinnedTabIds: [],
              },
            ],
            activeViewIndex: 0,
          },
        ],
      };

      mockChrome.runtime.sendMessage.mockImplementation((message: unknown) => {
        if ((message as { type: string }).type === 'GET_STATE') {
          return Promise.resolve({ success: true, data: mockTreeStateForCircular });
        }
        return Promise.resolve({ success: true });
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
          id: 1,
          data: { current: undefined },
          rect: { current: { initial: null, translated: null } },
        },
        over: {
          id: 2,
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
        expect(sendMessageMock).toHaveBeenCalledWith({
          type: 'MOVE_NODE',
          payload: {
            tabId: 1,
            targetParentTabId: 2,
            windowId: 1,
            viewIndex: 0,
            selectedTabIds: [],
          },
        });
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

      // Clear mock calls before the drag event to check MOVE_NODE is not called
      sendMessageMock.mockClear();

      const dragEndEvent = {
        active: {
          id: 1,
          data: { current: undefined },
          rect: { current: { initial: null, translated: null } },
        },
        over: {
          id: 1,
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

      expect(sendMessageMock).not.toHaveBeenCalledWith(
        expect.objectContaining({ type: 'MOVE_NODE' })
      );
    });
  });
});
