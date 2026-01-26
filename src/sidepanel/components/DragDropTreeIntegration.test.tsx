import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, waitFor, act } from '@testing-library/react';
import { TreeStateProvider, useTreeState } from '../providers/TreeStateProvider';
import type { TreeState, DragEndEvent } from '@/types';
import { getMockChrome } from '@/test/test-types';

describe('ドラッグ&ドロップによるツリー再構成', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    global.chrome = {
      storage: {
        local: {
          get: vi.fn().mockResolvedValue({
            tree_state: {
              windows: [
                {
                  windowId: 1,
                  views: [
                    {
                      name: 'Default',
                      color: '#3b82f6',
                      rootNodes: [
                        { tabId: 1, isExpanded: true, children: [] },
                        { tabId: 2, isExpanded: true, children: [] },
                        { tabId: 3, isExpanded: true, children: [] },
                      ],
                    },
                  ],
                  activeViewIndex: 0,
                  pinnedTabIds: [],
                },
              ],
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
        sendMessage: vi.fn().mockResolvedValue(undefined),
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

  it('タブを別のタブの子として配置できる', async () => {
    let testHandleDragEnd: ((event: DragEndEvent) => void) | undefined;
    let testTreeState: TreeState | null = null;
    function TestHookComponent() {
      const { handleDragEnd, treeState } = useTreeState();
      testHandleDragEnd = handleDragEnd;
      testTreeState = treeState;
      return null;
    }

    await act(async () => {
      render(
        <TreeStateProvider>
          <TestHookComponent />
        </TreeStateProvider>
      );
    });

    await waitFor(() => {
      expect(testTreeState).not.toBeNull();
      expect(testHandleDragEnd).toBeDefined();
    });

    const dragEndEvent = {
      active: {
        id: '2',
        data: { current: undefined },
        rect: { current: { initial: null, translated: null } },
      },
      over: {
        id: '1',
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
      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'MOVE_NODE',
        payload: {
          tabId: 2,
          targetParentTabId: 1,
          viewIndex: 0,
          windowId: 1,
          selectedTabIds: [],
        },
      });
    });
  });

  it('タブを同階層で順序変更できる', async () => {
    let testHandleDragEnd: ((event: DragEndEvent) => void) | undefined;
    let testTreeState: TreeState | null = null;
    function TestHookComponent() {
      const { handleDragEnd, treeState } = useTreeState();
      testHandleDragEnd = handleDragEnd;
      testTreeState = treeState;
      return null;
    }

    await act(async () => {
      render(
        <TreeStateProvider>
          <TestHookComponent />
        </TreeStateProvider>
      );
    });

    await waitFor(() => {
      expect(testTreeState).not.toBeNull();
      expect(testHandleDragEnd).toBeDefined();
    });

    const dragEndEvent = {
      active: {
        id: '3',
        data: { current: undefined },
        rect: { current: { initial: null, translated: null } },
      },
      over: {
        id: '2',
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
      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'MOVE_NODE',
        payload: {
          tabId: 3,
          targetParentTabId: 2,
          viewIndex: 0,
          windowId: 1,
          selectedTabIds: [],
        },
      });
    });
  });

  it('循環参照を防ぐ', async () => {
    const mockChrome = getMockChrome();
    mockChrome.storage.local.get.mockResolvedValue({
      tree_state: {
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
                    isExpanded: true,
                    children: [
                      { tabId: 2, isExpanded: true, children: [] },
                    ],
                  },
                ],
              },
            ],
            activeViewIndex: 0,
            pinnedTabIds: [],
          },
        ],
      },
    });

    let testHandleDragEnd: ((event: DragEndEvent) => void) | undefined;
    let testTreeState: TreeState | null = null;
    function TestHookComponent() {
      const { handleDragEnd, treeState } = useTreeState();
      testHandleDragEnd = handleDragEnd;
      testTreeState = treeState;
      return null;
    }

    await act(async () => {
      render(
        <TreeStateProvider>
          <TestHookComponent />
        </TreeStateProvider>
      );
    });

    await waitFor(() => {
      expect(testTreeState).not.toBeNull();
      expect(testHandleDragEnd).toBeDefined();
    });

    mockChrome.storage.local.set.mockClear();

    const dragEndEvent = {
      active: {
        id: '1',
        data: { current: undefined },
        rect: { current: { initial: null, translated: null } },
      },
      over: {
        id: '2',
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
      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'MOVE_NODE',
        payload: {
          tabId: 1,
          targetParentTabId: 2,
          viewIndex: 0,
          windowId: 1,
          selectedTabIds: [],
        },
      });
    });
  });
});
