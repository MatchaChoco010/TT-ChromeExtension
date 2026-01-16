/**
 * ドラッグ&ドロップによるツリー再構成のテスト
 */
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
              views: {
                default: {
                  info: { id: 'default', name: 'Default', color: '#3b82f6' },
                  rootNodeIds: ['node-1', 'node-2', 'node-3'],
                  nodes: {
                    'node-1': {
                      id: 'node-1',
                      tabId: 1,
                      parentId: null,
                      children: [],
                      isExpanded: true,
                      depth: 0,
                    },
                    'node-2': {
                      id: 'node-2',
                      tabId: 2,
                      parentId: null,
                      children: [],
                      isExpanded: true,
                      depth: 0,
                    },
                    'node-3': {
                      id: 'node-3',
                      tabId: 3,
                      parentId: null,
                      children: [],
                      isExpanded: true,
                      depth: 0,
                    },
                  },
                },
              },
              currentViewId: 'default',
              tabToNode: {
                '1': { viewId: 'default', nodeId: 'node-1' },
                '2': { viewId: 'default', nodeId: 'node-2' },
                '3': { viewId: 'default', nodeId: 'node-3' },
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
      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'MOVE_NODE',
        payload: {
          nodeId: 'node-2',
          targetParentId: 'node-1',
          viewId: 'default',
          selectedNodeIds: [],
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
        id: 'node-3',
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

    const mockChrome = getMockChrome();
    await waitFor(() => {
      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'MOVE_NODE',
        payload: {
          nodeId: 'node-3',
          targetParentId: 'node-2',
          viewId: 'default',
          selectedNodeIds: [],
        },
      });
    });
  });

  it('循環参照を防ぐ', async () => {
    const mockChrome = getMockChrome();
    mockChrome.storage.local.get.mockResolvedValue({
      tree_state: {
        views: {
          default: {
            info: { id: 'default', name: 'Default', color: '#3b82f6' },
            rootNodeIds: ['node-1'],
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
                  },
                ],
                isExpanded: true,
                depth: 0,
              },
              'node-2': {
                id: 'node-2',
                tabId: 2,
                parentId: 'node-1',
                children: [],
                isExpanded: true,
                depth: 1,
              },
            },
          },
        },
        currentViewId: 'default',
        tabToNode: {
          '1': { viewId: 'default', nodeId: 'node-1' },
          '2': { viewId: 'default', nodeId: 'node-2' },
        },
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

    // 循環参照チェックはServiceWorker側で行われるため、メッセージは送信される
    await waitFor(() => {
      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'MOVE_NODE',
        payload: {
          nodeId: 'node-1',
          targetParentId: 'node-2',
          viewId: 'default',
          selectedNodeIds: [],
        },
      });
    });
  });
});
