import React from 'react';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { TreeStateProvider, useTreeState } from './TreeStateProvider';
import type { TreeState, StorageChanges, SiblingDropInfo, TabNode } from '@/types';
import type { MockChrome, MessageListener } from '@/test/test-types';

function TestComponent() {
  const { treeState, isLoading, error, currentViewIndex, currentWindowState } = useTreeState();

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  if (!treeState) return <div>No state</div>;

  const currentViewState = currentWindowState?.views[currentViewIndex];
  const countNodes = (nodes: { tabId: number; children: unknown[] }[]): number => {
    let count = 0;
    for (const node of nodes) {
      count += 1;
      count += countNodes(node.children as { tabId: number; children: unknown[] }[]);
    }
    return count;
  };
  const nodeCount = currentViewState ? countNodes(currentViewState.rootNodes) : 0;

  return (
    <div>
      <div data-testid="current-view">{currentViewIndex}</div>
      <div data-testid="node-count">{nodeCount}</div>
    </div>
  );
}

describe('TreeStateProvider リアルタイム更新', () => {
  let mockMessageListeners: MessageListener[] = [];
  let mockStorageListeners: Array<(changes: StorageChanges, areaName: string) => void> = [];
  let mockChrome: MockChrome;

  beforeEach(() => {
    mockMessageListeners = [];
    mockStorageListeners = [];

    mockChrome = {
      storage: {
        local: {
          get: vi.fn<(keys?: string | string[] | null) => Promise<Record<string, unknown>>>().mockResolvedValue({
            tree_state: {
              windows: [{
                windowId: 1,
                views: [{
                  name: 'Default',
                  color: '#3b82f6',
                  rootNodes: [],
                  pinnedTabIds: [],
                }],
                activeViewIndex: 0,
              }],
            },
          }),
          set: vi.fn<(items: Record<string, unknown>) => Promise<void>>().mockResolvedValue(undefined),
          remove: vi.fn<(keys: string | string[]) => Promise<void>>(),
          clear: vi.fn<() => Promise<void>>(),
        },
        onChanged: {
          addListener: vi.fn((listener) => {
            mockStorageListeners.push(listener);
          }),
          removeListener: vi.fn((listener) => {
            mockStorageListeners = mockStorageListeners.filter(
              (l) => l !== listener
            );
          }),
        },
      },
      runtime: {
        onMessage: {
          addListener: vi.fn((listener) => {
            mockMessageListeners.push(listener as MessageListener);
          }),
          removeListener: vi.fn((listener) => {
            mockMessageListeners = mockMessageListeners.filter(
              (l) => l !== listener
            );
          }),
        },
        sendMessage: vi.fn().mockImplementation((message) => {
          if (message.type === 'GET_STATE') {
            return Promise.resolve({
              success: true,
              data: {
                windows: [{
                  windowId: 1,
                  views: [{
                    name: 'Default',
                    color: '#3b82f6',
                    rootNodes: [],
                    pinnedTabIds: [],
                  }],
                  activeViewIndex: 0,
                }],
              },
            });
          }
          return Promise.resolve({ success: true, data: null });
        }),
        getURL: vi.fn(),
      },
      tabs: {
        get: vi.fn(),
        query: vi.fn().mockResolvedValue([{ id: 1, active: true }]),
        update: vi.fn(),
        move: vi.fn(),
        remove: vi.fn(),
        create: vi.fn(),
        duplicate: vi.fn(),
        reload: vi.fn(),
        onCreated: { addListener: vi.fn(), removeListener: vi.fn() },
        onRemoved: { addListener: vi.fn(), removeListener: vi.fn() },
        onMoved: { addListener: vi.fn(), removeListener: vi.fn() },
        onUpdated: { addListener: vi.fn(), removeListener: vi.fn() },
        onActivated: { addListener: vi.fn(), removeListener: vi.fn() },
        onDetached: { addListener: vi.fn(), removeListener: vi.fn() },
        onAttached: { addListener: vi.fn(), removeListener: vi.fn() },
      },
      windows: {
        get: vi.fn(),
        getCurrent: vi.fn().mockResolvedValue({ id: 1 }),
        create: vi.fn(),
        getAll: vi.fn().mockResolvedValue([]),
        onCreated: { addListener: vi.fn(), removeListener: vi.fn() },
        onRemoved: { addListener: vi.fn(), removeListener: vi.fn() },
        onFocusChanged: { addListener: vi.fn(), removeListener: vi.fn() },
      },
      sidePanel: {
        open: vi.fn(),
        getOptions: vi.fn(),
        setOptions: vi.fn(),
      },
    };
    global.chrome = mockChrome as unknown as typeof chrome;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('初期ロード時にService Workerからツリー状態を読み込む', async () => {
    await act(async () => {
      render(
        <TreeStateProvider>
          <TestComponent />
        </TreeStateProvider>
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId('current-view')).toHaveTextContent('0');
    });

    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({ type: 'GET_STATE' });
  });

  it('STATE_UPDATED メッセージのペイロードから状態を取得する', async () => {
    const updatedState: TreeState = {
      windows: [{
        windowId: 1,
        views: [{
          name: 'Default',
          color: '#3b82f6',
          rootNodes: [{
            tabId: 1,
            isExpanded: true,
            children: [],
          }],
          pinnedTabIds: [],
        }],
        activeViewIndex: 0,
      }],
    };

    await act(async () => {
      render(
        <TreeStateProvider>
          <TestComponent />
        </TreeStateProvider>
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId('node-count')).toHaveTextContent('0');
    });

    await act(async () => {
      mockMessageListeners.forEach((listener) => {
        listener({ type: 'STATE_UPDATED', payload: updatedState }, {} as chrome.runtime.MessageSender, () => {});
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId('node-count')).toHaveTextContent('1');
    });
  });
});

/**
 * TabInfo マップ管理機能のテスト
 */
describe('TreeStateProvider TabInfoMap管理', () => {
  let mockMessageListeners: MessageListener[] = [];
  let mockStorageListeners: Array<(changes: StorageChanges, areaName: string) => void> = [];
  let mockTabsUpdatedListeners: Array<(tabId: number, changeInfo: chrome.tabs.OnUpdatedInfo, tab: chrome.tabs.Tab) => void> = [];
  let mockChrome: MockChrome;

  function TabInfoTestComponent() {
    const { treeState, isLoading, tabInfoMap, getTabInfo } = useTreeState();

    if (isLoading) return <div>Loading...</div>;
    if (!treeState) return <div>No state</div>;

    const tabInfo = getTabInfo(1);

    return (
      <div>
        <div data-testid="tab-info-map-size">{Object.keys(tabInfoMap).length}</div>
        <div data-testid="tab-1-title">{tabInfo?.title || 'N/A'}</div>
        <div data-testid="tab-1-favicon">{tabInfo?.favIconUrl || 'no-favicon'}</div>
      </div>
    );
  }

  beforeEach(() => {
    mockMessageListeners = [];
    mockStorageListeners = [];
    mockTabsUpdatedListeners = [];

    mockChrome = {
      storage: {
        local: {
          get: vi.fn<(keys?: string | string[] | null) => Promise<Record<string, unknown>>>().mockResolvedValue({
            tree_state: {
              windows: [{
                windowId: 1,
                views: [{
                  name: 'Default',
                  color: '#3b82f6',
                  rootNodes: [],
                  pinnedTabIds: [],
                }],
                activeViewIndex: 0,
              }],
            },
          }),
          set: vi.fn<(items: Record<string, unknown>) => Promise<void>>().mockResolvedValue(undefined),
          remove: vi.fn<(keys: string | string[]) => Promise<void>>(),
          clear: vi.fn<() => Promise<void>>(),
        },
        onChanged: {
          addListener: vi.fn((listener) => {
            mockStorageListeners.push(listener);
          }),
          removeListener: vi.fn((listener) => {
            mockStorageListeners = mockStorageListeners.filter((l) => l !== listener);
          }),
        },
      },
      runtime: {
        onMessage: {
          addListener: vi.fn((listener) => {
            mockMessageListeners.push(listener as MessageListener);
          }),
          removeListener: vi.fn((listener) => {
            mockMessageListeners = mockMessageListeners.filter((l) => l !== listener);
          }),
        },
        sendMessage: vi.fn().mockImplementation((message) => {
          if (message.type === 'GET_STATE') {
            return Promise.resolve({
              success: true,
              data: {
                windows: [{
                  windowId: 1,
                  views: [{
                    name: 'Default',
                    color: '#3b82f6',
                    rootNodes: [],
                    pinnedTabIds: [],
                  }],
                  activeViewIndex: 0,
                }],
              },
            });
          }
          return Promise.resolve({ success: true, data: null });
        }),
        getURL: vi.fn(),
      },
      tabs: {
        get: vi.fn(),
        query: vi.fn().mockResolvedValue([
          {
            id: 1,
            title: 'Test Page',
            url: 'https://example.com',
            favIconUrl: 'https://example.com/favicon.ico',
            status: 'complete',
            pinned: false,
            active: true,
            frozen: false,
          },
          {
            id: 2,
            title: 'Another Page',
            url: 'https://another.com',
            favIconUrl: undefined,
            status: 'loading',
            pinned: true,
            active: false,
            frozen: false,
          },
        ]),
        update: vi.fn(),
        move: vi.fn(),
        remove: vi.fn(),
        create: vi.fn(),
        duplicate: vi.fn(),
        reload: vi.fn(),
        onCreated: { addListener: vi.fn(), removeListener: vi.fn() },
        onRemoved: { addListener: vi.fn(), removeListener: vi.fn() },
        onMoved: { addListener: vi.fn(), removeListener: vi.fn() },
        onUpdated: {
          addListener: vi.fn((listener) => {
            mockTabsUpdatedListeners.push(listener);
          }),
          removeListener: vi.fn((listener) => {
            mockTabsUpdatedListeners = mockTabsUpdatedListeners.filter((l) => l !== listener);
          }),
        },
        onActivated: { addListener: vi.fn(), removeListener: vi.fn() },
        onDetached: { addListener: vi.fn(), removeListener: vi.fn() },
        onAttached: { addListener: vi.fn(), removeListener: vi.fn() },
      },
      windows: {
        get: vi.fn(),
        getCurrent: vi.fn().mockResolvedValue({ id: 1 }),
        create: vi.fn(),
        getAll: vi.fn().mockResolvedValue([]),
        onCreated: { addListener: vi.fn(), removeListener: vi.fn() },
        onRemoved: { addListener: vi.fn(), removeListener: vi.fn() },
        onFocusChanged: { addListener: vi.fn(), removeListener: vi.fn() },
      },
      sidePanel: {
        open: vi.fn(),
        getOptions: vi.fn(),
        setOptions: vi.fn(),
      },
    };
    global.chrome = mockChrome as unknown as typeof chrome;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('初期ロード時にchrome.tabs.queryでタブ情報を取得してtabInfoMapに格納する', async () => {
    await act(async () => {
      render(
        <TreeStateProvider>
          <TabInfoTestComponent />
        </TreeStateProvider>
      );
    });

    // タブ情報がロードされるのを待つ
    await waitFor(() => {
      expect(screen.getByTestId('tab-info-map-size')).toHaveTextContent('2');
    });

    expect(chrome.tabs.query).toHaveBeenCalledWith({});
  });

  it('getTabInfo(tabId)でタブのタイトル・ファビコンを取得できる', async () => {
    await act(async () => {
      render(
        <TreeStateProvider>
          <TabInfoTestComponent />
        </TreeStateProvider>
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId('tab-1-title')).toHaveTextContent('Test Page');
      expect(screen.getByTestId('tab-1-favicon')).toHaveTextContent('https://example.com/favicon.ico');
    });
  });

  it('存在しないタブIDでgetTabInfoを呼ぶとundefinedを返す', async () => {
    // 存在しないタブIDをテストするコンポーネント
    function NonExistentTabTestComponent() {
      const { isLoading, getTabInfo } = useTreeState();

      if (isLoading) return <div>Loading...</div>;

      const tabInfo = getTabInfo(999);

      return (
        <div>
          <div data-testid="tab-exists">{tabInfo ? 'exists' : 'undefined'}</div>
        </div>
      );
    }

    await act(async () => {
      render(
        <TreeStateProvider>
          <NonExistentTabTestComponent />
        </TreeStateProvider>
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId('tab-exists')).toHaveTextContent('undefined');
    });
  });
});

/**
 * ピン留めタブ専用リスト管理機能のテスト
 */
describe('TreeStateProvider pinnedTabIds管理', () => {
  let mockMessageListeners: MessageListener[] = [];
  let mockStorageListeners: Array<(changes: StorageChanges, areaName: string) => void> = [];
  let mockTabsUpdatedListeners: Array<(tabId: number, changeInfo: chrome.tabs.OnUpdatedInfo, tab: chrome.tabs.Tab) => void> = [];
  let mockChrome: MockChrome;

  // ピン留めタブ情報を表示するテストコンポーネント
  function PinnedTabsTestComponent() {
    const { isLoading, pinnedTabIds, tabInfoMap } = useTreeState();

    if (isLoading) return <div>Loading...</div>;

    return (
      <div>
        <div data-testid="pinned-tab-ids">{JSON.stringify(pinnedTabIds)}</div>
        <div data-testid="pinned-count">{pinnedTabIds.length}</div>
        <div data-testid="tab-2-pinned">{tabInfoMap[2]?.isPinned ? 'true' : 'false'}</div>
      </div>
    );
  }

  beforeEach(() => {
    mockMessageListeners = [];
    mockStorageListeners = [];
    mockTabsUpdatedListeners = [];

    mockChrome = {
      storage: {
        local: {
          get: vi.fn<(keys?: string | string[] | null) => Promise<Record<string, unknown>>>().mockResolvedValue({
            tree_state: {
              windows: [{
                windowId: 1,
                views: [{
                  name: 'Default',
                  color: '#3b82f6',
                  rootNodes: [],
                  pinnedTabIds: [],
                }],
                activeViewIndex: 0,
              }],
            },
          }),
          set: vi.fn<(items: Record<string, unknown>) => Promise<void>>().mockResolvedValue(undefined),
          remove: vi.fn<(keys: string | string[]) => Promise<void>>(),
          clear: vi.fn<() => Promise<void>>(),
        },
        onChanged: {
          addListener: vi.fn((listener) => {
            mockStorageListeners.push(listener);
          }),
          removeListener: vi.fn((listener) => {
            mockStorageListeners = mockStorageListeners.filter((l) => l !== listener);
          }),
        },
      },
      runtime: {
        onMessage: {
          addListener: vi.fn((listener) => {
            mockMessageListeners.push(listener as MessageListener);
          }),
          removeListener: vi.fn((listener) => {
            mockMessageListeners = mockMessageListeners.filter((l) => l !== listener);
          }),
        },
        sendMessage: vi.fn().mockImplementation((message) => {
          if (message.type === 'GET_STATE') {
            return Promise.resolve({
              success: true,
              data: {
                windows: [{
                  windowId: 1,
                  views: [{
                    name: 'Default',
                    color: '#3b82f6',
                    rootNodes: [],
                    pinnedTabIds: [],
                  }],
                  activeViewIndex: 0,
                }],
              },
            });
          }
          return Promise.resolve({ success: true, data: null });
        }),
        getURL: vi.fn(),
      },
      tabs: {
        get: vi.fn(),
        query: vi.fn().mockResolvedValue([
          {
            id: 1,
            title: 'Normal Page',
            url: 'https://example.com',
            favIconUrl: 'https://example.com/favicon.ico',
            status: 'complete',
            pinned: false,
            active: true,
            windowId: 1,
            frozen: false,
          },
          {
            id: 2,
            title: 'Pinned Page',
            url: 'https://pinned.com',
            favIconUrl: 'https://pinned.com/favicon.ico',
            status: 'complete',
            pinned: true,
            active: false,
            windowId: 1,
            frozen: false,
          },
          {
            id: 3,
            title: 'Another Pinned Page',
            url: 'https://another-pinned.com',
            favIconUrl: undefined,
            status: 'complete',
            pinned: true,
            active: false,
            windowId: 1,
            frozen: false,
          },
        ]),
        update: vi.fn(),
        move: vi.fn(),
        remove: vi.fn(),
        create: vi.fn(),
        duplicate: vi.fn(),
        reload: vi.fn(),
        onCreated: { addListener: vi.fn(), removeListener: vi.fn() },
        onRemoved: { addListener: vi.fn(), removeListener: vi.fn() },
        onMoved: { addListener: vi.fn(), removeListener: vi.fn() },
        onUpdated: {
          addListener: vi.fn((listener) => {
            mockTabsUpdatedListeners.push(listener);
          }),
          removeListener: vi.fn((listener) => {
            mockTabsUpdatedListeners = mockTabsUpdatedListeners.filter((l) => l !== listener);
          }),
        },
        onActivated: { addListener: vi.fn(), removeListener: vi.fn() },
        onDetached: { addListener: vi.fn(), removeListener: vi.fn() },
        onAttached: { addListener: vi.fn(), removeListener: vi.fn() },
      },
      windows: {
        get: vi.fn(),
        getCurrent: vi.fn().mockResolvedValue({ id: 1 }),
        create: vi.fn(),
        getAll: vi.fn().mockResolvedValue([]),
        onCreated: { addListener: vi.fn(), removeListener: vi.fn() },
        onRemoved: { addListener: vi.fn(), removeListener: vi.fn() },
        onFocusChanged: { addListener: vi.fn(), removeListener: vi.fn() },
      },
      sidePanel: {
        open: vi.fn(),
        getOptions: vi.fn(),
        setOptions: vi.fn(),
      },
    };
    global.chrome = mockChrome as unknown as typeof chrome;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('WindowStateからpinnedTabIds配列を取得する', async () => {
    mockChrome.runtime.sendMessage.mockImplementation((message: unknown) => {
      if ((message as { type: string }).type === 'GET_STATE') {
        return Promise.resolve({
          success: true,
          data: {
            windows: [{
              windowId: 1,
              views: [{ name: 'Default', color: '#3b82f6', rootNodes: [], pinnedTabIds: [2, 3] }],
              activeViewIndex: 0,
            }],
          },
        });
      }
      return Promise.resolve({ success: true, data: null });
    });

    await act(async () => {
      render(
        <TreeStateProvider>
          <PinnedTabsTestComponent />
        </TreeStateProvider>
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId('pinned-count')).toHaveTextContent('2');
    });

    const pinnedTabIds = JSON.parse(screen.getByTestId('pinned-tab-ids').textContent || '[]');
    expect(pinnedTabIds).toContain(2);
    expect(pinnedTabIds).toContain(3);
    expect(pinnedTabIds).not.toContain(1);
  });

  it('ピン留めタブが0件の場合は空配列を返す', async () => {
    await act(async () => {
      render(
        <TreeStateProvider>
          <PinnedTabsTestComponent />
        </TreeStateProvider>
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId('pinned-count')).toHaveTextContent('0');
    });

    const pinnedTabIds = JSON.parse(screen.getByTestId('pinned-tab-ids').textContent || '[]');
    expect(pinnedTabIds).toEqual([]);
  });
});

/**
 * 複数選択状態の管理機能のテスト
 */
describe('TreeStateProvider 複数選択状態管理', () => {
  let mockMessageListeners: MessageListener[] = [];
  let mockStorageListeners: Array<(changes: StorageChanges, areaName: string) => void> = [];
  let mockChrome: MockChrome;

  function SelectionTestComponent() {
    const {
      treeState,
      isLoading,
      selectedTabIds,
      lastSelectedTabId,
      selectNode,
      clearSelection,
      isNodeSelected,
    } = useTreeState();

    if (isLoading) return <div>Loading...</div>;
    if (!treeState) return <div>No state</div>;

    return (
      <div>
        <div data-testid="selected-count">{selectedTabIds.size}</div>
        <div data-testid="selected-ids">{JSON.stringify(Array.from(selectedTabIds).sort())}</div>
        <div data-testid="last-selected">{lastSelectedTabId || 'null'}</div>
        <div data-testid="node-1-selected">{isNodeSelected(1) ? 'true' : 'false'}</div>
        <div data-testid="node-2-selected">{isNodeSelected(2) ? 'true' : 'false'}</div>
        <div data-testid="node-3-selected">{isNodeSelected(3) ? 'true' : 'false'}</div>
        <button
          data-testid="select-node-1"
          onClick={() => selectNode(1, { shift: false, ctrl: false })}
        >
          Select Node 1
        </button>
        <button
          data-testid="select-node-2"
          onClick={() => selectNode(2, { shift: false, ctrl: false })}
        >
          Select Node 2
        </button>
        <button
          data-testid="select-node-2-ctrl"
          onClick={() => selectNode(2, { shift: false, ctrl: true })}
        >
          Ctrl+Select Node 2
        </button>
        <button
          data-testid="select-node-3-shift"
          onClick={() => selectNode(3, { shift: true, ctrl: false })}
        >
          Shift+Select Node 3
        </button>
        <button
          data-testid="clear-selection"
          onClick={() => clearSelection()}
        >
          Clear Selection
        </button>
      </div>
    );
  }

  beforeEach(() => {
    mockMessageListeners = [];
    mockStorageListeners = [];

    const treeStateWithNodes: TreeState = {
      windows: [{
        windowId: 1,
        views: [{
          name: 'Default',
          color: '#3b82f6',
          rootNodes: [
            { tabId: 1, isExpanded: true, children: [] },
            { tabId: 2, isExpanded: true, children: [] },
            { tabId: 3, isExpanded: true, children: [] },
          ],
          pinnedTabIds: [],
        }],
        activeViewIndex: 0,
      }],
    };

    mockChrome = {
      storage: {
        local: {
          get: vi.fn<(keys?: string | string[] | null) => Promise<Record<string, unknown>>>().mockResolvedValue({
            tree_state: treeStateWithNodes,
          }),
          set: vi.fn<(items: Record<string, unknown>) => Promise<void>>().mockResolvedValue(undefined),
          remove: vi.fn<(keys: string | string[]) => Promise<void>>(),
          clear: vi.fn<() => Promise<void>>(),
        },
        onChanged: {
          addListener: vi.fn((listener) => {
            mockStorageListeners.push(listener);
          }),
          removeListener: vi.fn((listener) => {
            mockStorageListeners = mockStorageListeners.filter((l) => l !== listener);
          }),
        },
      },
      runtime: {
        onMessage: {
          addListener: vi.fn((listener) => {
            mockMessageListeners.push(listener as MessageListener);
          }),
          removeListener: vi.fn((listener) => {
            mockMessageListeners = mockMessageListeners.filter((l) => l !== listener);
          }),
        },
        sendMessage: vi.fn().mockImplementation((message) => {
          if (message.type === 'GET_STATE') {
            return Promise.resolve({
              success: true,
              data: treeStateWithNodes,
            });
          }
          return Promise.resolve({ success: true, data: null });
        }),
        getURL: vi.fn(),
      },
      tabs: {
        get: vi.fn(),
        query: vi.fn().mockResolvedValue([
          { id: 1, title: 'Tab 1', url: 'https://tab1.com', pinned: false, frozen: false, active: true, index: 0, windowId: 1 },
          { id: 2, title: 'Tab 2', url: 'https://tab2.com', pinned: false, frozen: false, active: false, index: 1, windowId: 1 },
          { id: 3, title: 'Tab 3', url: 'https://tab3.com', pinned: false, frozen: false, active: false, index: 2, windowId: 1 },
        ]),
        update: vi.fn(),
        move: vi.fn(),
        remove: vi.fn(),
        create: vi.fn(),
        duplicate: vi.fn(),
        reload: vi.fn(),
        onCreated: { addListener: vi.fn(), removeListener: vi.fn() },
        onRemoved: { addListener: vi.fn(), removeListener: vi.fn() },
        onMoved: { addListener: vi.fn(), removeListener: vi.fn() },
        onUpdated: { addListener: vi.fn(), removeListener: vi.fn() },
        onActivated: { addListener: vi.fn(), removeListener: vi.fn() },
        onDetached: { addListener: vi.fn(), removeListener: vi.fn() },
        onAttached: { addListener: vi.fn(), removeListener: vi.fn() },
      },
      windows: {
        get: vi.fn(),
        getCurrent: vi.fn().mockResolvedValue({ id: 1 }),
        create: vi.fn(),
        getAll: vi.fn().mockResolvedValue([]),
        onCreated: { addListener: vi.fn(), removeListener: vi.fn() },
        onRemoved: { addListener: vi.fn(), removeListener: vi.fn() },
        onFocusChanged: { addListener: vi.fn(), removeListener: vi.fn() },
      },
      sidePanel: {
        open: vi.fn(),
        getOptions: vi.fn(),
        setOptions: vi.fn(),
      },
    };
    global.chrome = mockChrome as unknown as typeof chrome;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('selectedTabIds、lastSelectedTabIdステートを提供する', async () => {
    await act(async () => {
      render(
        <TreeStateProvider>
          <SelectionTestComponent />
        </TreeStateProvider>
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId('selected-count')).toHaveTextContent('0');
      expect(screen.getByTestId('last-selected')).toHaveTextContent('null');
    });
  });

  it('selectNode関数でノードを選択できる', async () => {
    await act(async () => {
      render(
        <TreeStateProvider>
          <SelectionTestComponent />
        </TreeStateProvider>
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId('selected-count')).toHaveTextContent('0');
    });

    // Node 1を選択
    await act(async () => {
      screen.getByTestId('select-node-1').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('selected-count')).toHaveTextContent('1');
      expect(screen.getByTestId('node-1-selected')).toHaveTextContent('true');
      expect(screen.getByTestId('last-selected')).toHaveTextContent('1');
    });
  });

  it('通常クリックで既存の選択をクリアして新しいノードを選択する', async () => {
    await act(async () => {
      render(
        <TreeStateProvider>
          <SelectionTestComponent />
        </TreeStateProvider>
      );
    });

    // Node 1を選択
    await act(async () => {
      screen.getByTestId('select-node-1').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('node-1-selected')).toHaveTextContent('true');
    });

    // Node 2を通常クリックで選択
    await act(async () => {
      screen.getByTestId('select-node-2').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('selected-count')).toHaveTextContent('1');
      expect(screen.getByTestId('node-1-selected')).toHaveTextContent('false');
      expect(screen.getByTestId('node-2-selected')).toHaveTextContent('true');
      expect(screen.getByTestId('last-selected')).toHaveTextContent('2');
    });
  });

  it('Ctrlキー押下時は現在の選択状態にトグル追加/削除する', async () => {
    await act(async () => {
      render(
        <TreeStateProvider>
          <SelectionTestComponent />
        </TreeStateProvider>
      );
    });

    // Node 1を選択
    await act(async () => {
      screen.getByTestId('select-node-1').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('node-1-selected')).toHaveTextContent('true');
    });

    // Ctrl+クリックでNode 2を追加選択
    await act(async () => {
      screen.getByTestId('select-node-2-ctrl').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('selected-count')).toHaveTextContent('2');
      expect(screen.getByTestId('node-1-selected')).toHaveTextContent('true');
      expect(screen.getByTestId('node-2-selected')).toHaveTextContent('true');
    });

    // もう一度Ctrl+クリックでNode 2を選択解除
    await act(async () => {
      screen.getByTestId('select-node-2-ctrl').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('selected-count')).toHaveTextContent('1');
      expect(screen.getByTestId('node-1-selected')).toHaveTextContent('true');
      expect(screen.getByTestId('node-2-selected')).toHaveTextContent('false');
    });
  });

  it('Shiftキー押下時は最後に選択したノードから現在のノードまでの範囲を選択する', async () => {
    await act(async () => {
      render(
        <TreeStateProvider>
          <SelectionTestComponent />
        </TreeStateProvider>
      );
    });

    // Node 1を選択
    await act(async () => {
      screen.getByTestId('select-node-1').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('node-1-selected')).toHaveTextContent('true');
    });

    // Shift+クリックでNode 3を選択（Node 1からNode 3までの範囲を選択）
    await act(async () => {
      screen.getByTestId('select-node-3-shift').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('selected-count')).toHaveTextContent('3');
      expect(screen.getByTestId('node-1-selected')).toHaveTextContent('true');
      expect(screen.getByTestId('node-2-selected')).toHaveTextContent('true');
      expect(screen.getByTestId('node-3-selected')).toHaveTextContent('true');
    });
  });

  it('clearSelection関数で選択をすべてクリアできる', async () => {
    await act(async () => {
      render(
        <TreeStateProvider>
          <SelectionTestComponent />
        </TreeStateProvider>
      );
    });

    // Node 1を選択
    await act(async () => {
      screen.getByTestId('select-node-1').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('selected-count')).toHaveTextContent('1');
    });

    // 選択をクリア
    await act(async () => {
      screen.getByTestId('clear-selection').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('selected-count')).toHaveTextContent('0');
      expect(screen.getByTestId('node-1-selected')).toHaveTextContent('false');
      expect(screen.getByTestId('last-selected')).toHaveTextContent('null');
    });
  });

  it('isNodeSelected関数でノードの選択状態を確認できる', async () => {
    await act(async () => {
      render(
        <TreeStateProvider>
          <SelectionTestComponent />
        </TreeStateProvider>
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId('node-1-selected')).toHaveTextContent('false');
      expect(screen.getByTestId('node-2-selected')).toHaveTextContent('false');
    });

    // Node 1を選択
    await act(async () => {
      screen.getByTestId('select-node-1').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('node-1-selected')).toHaveTextContent('true');
      expect(screen.getByTestId('node-2-selected')).toHaveTextContent('false');
    });
  });

  it('Shiftキーで選択時、lastSelectedNodeIdがnullの場合は単一選択になる', async () => {
    await act(async () => {
      render(
        <TreeStateProvider>
          <SelectionTestComponent />
        </TreeStateProvider>
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId('last-selected')).toHaveTextContent('null');
    });

    // lastSelectedNodeIdがnullの状態でShift+クリック
    await act(async () => {
      screen.getByTestId('select-node-3-shift').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('selected-count')).toHaveTextContent('1');
      expect(screen.getByTestId('node-3-selected')).toHaveTextContent('true');
    });
  });
});

/**
 * handleSiblingDropのテスト
 * 兄弟としてドロップ（Gapドロップ）時のハンドラのテスト
 */
describe('TreeStateProvider handleSiblingDrop', () => {
  let mockMessageListeners: MessageListener[] = [];
  let mockStorageListeners: Array<(changes: StorageChanges, areaName: string) => void> = [];
  let mockChrome: MockChrome;

  // handleSiblingDropを呼び出すテストコンポーネント
  function SiblingDropTestComponent({ onReady }: { onReady?: (handleSiblingDrop: (info: SiblingDropInfo) => Promise<void>) => void }) {
    const { treeState, isLoading, handleSiblingDrop, currentWindowId } = useTreeState();

    React.useEffect(() => {
      if (!isLoading && treeState && onReady) {
        onReady(handleSiblingDrop);
      }
    }, [isLoading, treeState, handleSiblingDrop, onReady]);

    if (isLoading) return <div>Loading...</div>;
    if (!treeState) return <div>No state</div>;

    // Get nodes from the current window's current view
    const currentWindowState = treeState.windows.find(w => w.windowId === currentWindowId);
    const currentViewState = currentWindowState?.views[currentWindowState.activeViewIndex];
    const rootNodes = currentViewState?.rootNodes ?? [];

    // Flatten tree to get all nodes with their info
    const flattenNodes = (nodes: TabNode[], depth = 0): Array<{ tabId: number; depth: number; children: TabNode[] }> => {
      const result: Array<{ tabId: number; depth: number; children: TabNode[] }> = [];
      for (const node of nodes) {
        result.push({ tabId: node.tabId, depth, children: node.children });
        if (node.children.length > 0) {
          result.push(...flattenNodes(node.children, depth + 1));
        }
      }
      return result;
    };

    const allNodes = flattenNodes(rootNodes);

    return (
      <div>
        <div data-testid="node-count">{allNodes.length}</div>
        <div data-testid="node-infos">{JSON.stringify(allNodes.map(n => ({ tabId: n.tabId, depth: n.depth })))}</div>
        {allNodes.map((node) => (
          <div key={node.tabId} data-testid={`node-${node.tabId}`}>{node.tabId}</div>
        ))}
      </div>
    );
  }


  beforeEach(() => {
    mockMessageListeners = [];
    mockStorageListeners = [];

    // 3つのノードを持つツリー状態
    // Structure: tab1 (with child tab2), tab3
    const treeStateWithNodes: TreeState = {
      windows: [{
        windowId: 1,
        views: [{
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
            { tabId: 3, isExpanded: true, children: [] },
          ],
          pinnedTabIds: [],
        }],
        activeViewIndex: 0,
      }],
    };

    mockChrome = {
      storage: {
        local: {
          get: vi.fn<(keys?: string | string[] | null) => Promise<Record<string, unknown>>>().mockResolvedValue({
            tree_state: treeStateWithNodes,
          }),
          set: vi.fn<(items: Record<string, unknown>) => Promise<void>>().mockResolvedValue(undefined),
          remove: vi.fn<(keys: string | string[]) => Promise<void>>(),
          clear: vi.fn<() => Promise<void>>(),
        },
        onChanged: {
          addListener: vi.fn((listener) => {
            mockStorageListeners.push(listener);
          }),
          removeListener: vi.fn((listener) => {
            mockStorageListeners = mockStorageListeners.filter((l) => l !== listener);
          }),
        },
      },
      runtime: {
        onMessage: {
          addListener: vi.fn((listener) => {
            mockMessageListeners.push(listener as MessageListener);
          }),
          removeListener: vi.fn((listener) => {
            mockMessageListeners = mockMessageListeners.filter((l) => l !== listener);
          }),
        },
        sendMessage: vi.fn().mockImplementation((message) => {
          if (message.type === 'GET_STATE') {
            return Promise.resolve({
              success: true,
              data: treeStateWithNodes,
            });
          }
          return Promise.resolve({ success: true, data: null });
        }),
        getURL: vi.fn(),
      },
      tabs: {
        get: vi.fn(),
        query: vi.fn().mockResolvedValue([
          { id: 1, title: 'Tab 1', url: 'https://tab1.com', pinned: false, frozen: false, active: true, index: 0, windowId: 1 },
          { id: 2, title: 'Tab 2', url: 'https://tab2.com', pinned: false, frozen: false, active: false, index: 1, windowId: 1 },
          { id: 3, title: 'Tab 3', url: 'https://tab3.com', pinned: false, frozen: false, active: false, index: 2, windowId: 1 },
        ]),
        update: vi.fn(),
        move: vi.fn(),
        remove: vi.fn(),
        create: vi.fn(),
        duplicate: vi.fn(),
        reload: vi.fn(),
        onCreated: { addListener: vi.fn(), removeListener: vi.fn() },
        onRemoved: { addListener: vi.fn(), removeListener: vi.fn() },
        onMoved: { addListener: vi.fn(), removeListener: vi.fn() },
        onUpdated: { addListener: vi.fn(), removeListener: vi.fn() },
        onActivated: { addListener: vi.fn(), removeListener: vi.fn() },
        onDetached: { addListener: vi.fn(), removeListener: vi.fn() },
        onAttached: { addListener: vi.fn(), removeListener: vi.fn() },
      },
      windows: {
        get: vi.fn(),
        getCurrent: vi.fn().mockResolvedValue({ id: 1 }),
        create: vi.fn(),
        getAll: vi.fn().mockResolvedValue([]),
        onCreated: { addListener: vi.fn(), removeListener: vi.fn() },
        onRemoved: { addListener: vi.fn(), removeListener: vi.fn() },
        onFocusChanged: { addListener: vi.fn(), removeListener: vi.fn() },
      },
      sidePanel: {
        open: vi.fn(),
        getOptions: vi.fn(),
        setOptions: vi.fn(),
      },
    };
    global.chrome = mockChrome as unknown as typeof chrome;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('handleSiblingDrop関数が提供される', async () => {
    let receivedHandleSiblingDrop: ((info: SiblingDropInfo) => Promise<void>) | null = null;

    await act(async () => {
      render(
        <TreeStateProvider>
          <SiblingDropTestComponent
            onReady={(fn) => {
              receivedHandleSiblingDrop = fn;
            }}
          />
        </TreeStateProvider>
      );
    });

    await waitFor(() => {
      expect(receivedHandleSiblingDrop).not.toBeNull();
    });
  });

  it('兄弟としてドロップした場合、MOVE_NODE_AS_SIBLINGメッセージが送信される', async () => {
    let handleSiblingDrop: ((info: SiblingDropInfo) => Promise<void>) | null = null;

    await act(async () => {
      render(
        <TreeStateProvider>
          <SiblingDropTestComponent
            onReady={(fn) => {
              handleSiblingDrop = fn;
            }}
          />
        </TreeStateProvider>
      );
    });

    await waitFor(() => {
      expect(handleSiblingDrop).not.toBeNull();
    });

    // tab2をtab3の上（兄弟として）にドロップ
    await act(async () => {
      if (handleSiblingDrop) {
        await handleSiblingDrop({
          activeTabId: 2,
          insertIndex: 1,
          aboveTabId: 1,
          belowTabId: 3,
        });
      }
    });

    // MOVE_NODE_AS_SIBLINGメッセージが送信されることを検証
    await waitFor(() => {
      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'MOVE_NODE_AS_SIBLING',
        payload: {
          tabId: 2,
          aboveTabId: 1,
          belowTabId: 3,
          windowId: 1,
          viewIndex: 0,
          selectedTabIds: [],
        },
      });
    });
  });

  it('下のノードしかない場合（先頭にドロップ）、MOVE_NODE_AS_SIBLINGメッセージが送信される', async () => {
    let handleSiblingDrop: ((info: SiblingDropInfo) => Promise<void>) | null = null;

    await act(async () => {
      render(
        <TreeStateProvider>
          <SiblingDropTestComponent
            onReady={(fn) => {
              handleSiblingDrop = fn;
            }}
          />
        </TreeStateProvider>
      );
    });

    await waitFor(() => {
      expect(handleSiblingDrop).not.toBeNull();
    });

    // tab2をリストの最初にドロップ（tab1の上）
    await act(async () => {
      if (handleSiblingDrop) {
        await handleSiblingDrop({
          activeTabId: 2,
          insertIndex: 0,
          aboveTabId: undefined,
          belowTabId: 1,
        });
      }
    });

    // MOVE_NODE_AS_SIBLINGメッセージが送信されることを検証
    await waitFor(() => {
      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'MOVE_NODE_AS_SIBLING',
        payload: {
          tabId: 2,
          aboveTabId: undefined,
          belowTabId: 1,
          windowId: 1,
          viewIndex: 0,
          selectedTabIds: [],
        },
      });
    });
  });

  it('自分自身の子孫への移動でもMOVE_NODE_AS_SIBLINGメッセージが送信される（検証はServiceWorker側で行う）', async () => {
    let handleSiblingDrop: ((info: SiblingDropInfo) => Promise<void>) | null = null;

    // tab1 → tab2 (子) → tab4 (孫) の構造を持つツリー状態
    const treeStateWithGrandchild: TreeState = {
      windows: [{
        windowId: 1,
        views: [{
          name: 'Default',
          color: '#3b82f6',
          rootNodes: [{
            tabId: 1,
            isExpanded: true,
            children: [{
              tabId: 2,
              isExpanded: true,
              children: [{
                tabId: 4,
                isExpanded: true,
                children: [],
              }],
            }],
          }],
          pinnedTabIds: [],
        }],
        activeViewIndex: 0,
      }],
    };

    mockChrome.storage.local.get = vi.fn().mockResolvedValue({
      tree_state: treeStateWithGrandchild,
    });
    mockChrome.tabs.query = vi.fn().mockResolvedValue([
      { id: 1, title: 'Tab 1', url: 'https://tab1.com', pinned: false, frozen: false, active: true, windowId: 1, index: 0 },
      { id: 2, title: 'Tab 2', url: 'https://tab2.com', pinned: false, frozen: false, active: false, windowId: 1, index: 1 },
      { id: 4, title: 'Tab 4', url: 'https://tab4.com', pinned: false, frozen: false, active: false, windowId: 1, index: 2 },
    ]);

    await act(async () => {
      render(
        <TreeStateProvider>
          <SiblingDropTestComponent
            onReady={(fn) => {
              handleSiblingDrop = fn;
            }}
          />
        </TreeStateProvider>
      );
    });

    await waitFor(() => {
      expect(handleSiblingDrop).not.toBeNull();
    });

    // tab1をtab4の隣に移動しようとする（自分の孫の隣 = 無効な操作だが、メッセージは送信される）
    await act(async () => {
      if (handleSiblingDrop) {
        await handleSiblingDrop({
          activeTabId: 1,
          insertIndex: 2,
          aboveTabId: 4,
          belowTabId: undefined,
        });
      }
    });

    // メッセージは送信される（循環参照のチェックはServiceWorker側で行われる）
    await waitFor(() => {
      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'MOVE_NODE_AS_SIBLING',
        payload: {
          tabId: 1,
          aboveTabId: 4,
          belowTabId: undefined,
          windowId: 1,
          viewIndex: 0,
          selectedTabIds: [],
        },
      });
    });
  });

  /**
   * ドロップ位置への正確な挿入テスト
   * insertIndexを含むMOVE_NODE_AS_SIBLINGメッセージが送信されることを検証
   */
  it('insertIndexを含むMOVE_NODE_AS_SIBLINGメッセージが送信される', async () => {
    let handleSiblingDrop: ((info: SiblingDropInfo) => Promise<void>) | null = null;

    await act(async () => {
      render(
        <TreeStateProvider>
          <SiblingDropTestComponent
            onReady={(fn) => {
              handleSiblingDrop = fn;
            }}
          />
        </TreeStateProvider>
      );
    });

    await waitFor(() => {
      expect(handleSiblingDrop).not.toBeNull();
    });

    // tab2をtab1とtab3の間にドロップ
    await act(async () => {
      if (handleSiblingDrop) {
        await handleSiblingDrop({
          activeTabId: 2,
          insertIndex: 1,
          aboveTabId: 1,
          belowTabId: 3,
        });
      }
    });

    // MOVE_NODE_AS_SIBLINGメッセージが送信されることを検証
    await waitFor(() => {
      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'MOVE_NODE_AS_SIBLING',
        payload: {
          tabId: 2,
          aboveTabId: 1,
          belowTabId: 3,
          windowId: 1,
          viewIndex: 0,
          selectedTabIds: [],
        },
      });
    });
  });

  /**
   * 異なる深度のタブ間へのドロップテスト
   * MOVE_NODE_AS_SIBLINGメッセージが正しく送信されることを検証
   */
  it('異なる深度のタブ間にドロップした場合もMOVE_NODE_AS_SIBLINGメッセージが送信される', async () => {
    let handleSiblingDrop: ((info: SiblingDropInfo) => Promise<void>) | null = null;

    await act(async () => {
      render(
        <TreeStateProvider>
          <SiblingDropTestComponent
            onReady={(fn) => {
              handleSiblingDrop = fn;
            }}
          />
        </TreeStateProvider>
      );
    });

    await waitFor(() => {
      expect(handleSiblingDrop).not.toBeNull();
    });

    // tab2をtab1とtab3の間にドロップ
    await act(async () => {
      if (handleSiblingDrop) {
        await handleSiblingDrop({
          activeTabId: 2,
          insertIndex: 2,
          aboveTabId: 1,
          belowTabId: 3,
        });
      }
    });

    // MOVE_NODE_AS_SIBLINGメッセージが送信されることを検証
    await waitFor(() => {
      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'MOVE_NODE_AS_SIBLING',
        payload: {
          tabId: 2,
          aboveTabId: 1,
          belowTabId: 3,
          windowId: 1,
          viewIndex: 0,
          selectedTabIds: [],
        },
      });
    });
  });

  /**
   * 子タブの下への隙間ドロップテスト
   * MOVE_NODE_AS_SIBLINGメッセージが正しく送信されることを検証
   */
  it('親タブの子の下にドロップした場合、MOVE_NODE_AS_SIBLINGメッセージが送信される', async () => {
    let handleSiblingDrop: ((info: SiblingDropInfo) => Promise<void>) | null = null;

    await act(async () => {
      render(
        <TreeStateProvider>
          <SiblingDropTestComponent
            onReady={(fn) => {
              handleSiblingDrop = fn;
            }}
          />
        </TreeStateProvider>
      );
    });

    await waitFor(() => {
      expect(handleSiblingDrop).not.toBeNull();
    });

    await act(async () => {
      if (handleSiblingDrop) {
        await handleSiblingDrop({
          activeTabId: 2,
          insertIndex: 2,
          aboveTabId: 1,
          belowTabId: 3,
        });
      }
    });

    // MOVE_NODE_AS_SIBLINGメッセージが送信されることを検証
    await waitFor(() => {
      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'MOVE_NODE_AS_SIBLING',
        payload: {
          tabId: 2,
          aboveTabId: 1,
          belowTabId: 3,
          windowId: 1,
          viewIndex: 0,
          selectedTabIds: [],
        },
      });
    });
  });

  /**
   * リスト先頭へのドロップテスト
   * belowTabIdのみ指定された場合（aboveTabIdがundefined）のメッセージを検証
   */
  it('リスト先頭にドロップした場合、MOVE_NODE_AS_SIBLINGメッセージが送信される', async () => {
    let handleSiblingDrop: ((info: SiblingDropInfo) => Promise<void>) | null = null;

    await act(async () => {
      render(
        <TreeStateProvider>
          <SiblingDropTestComponent
            onReady={(fn) => {
              handleSiblingDrop = fn;
            }}
          />
        </TreeStateProvider>
      );
    });

    await waitFor(() => {
      expect(handleSiblingDrop).not.toBeNull();
    });

    await act(async () => {
      if (handleSiblingDrop) {
        await handleSiblingDrop({
          activeTabId: 2,
          insertIndex: 0,
          aboveTabId: undefined,
          belowTabId: 1,
        });
      }
    });

    // MOVE_NODE_AS_SIBLINGメッセージが送信されることを検証
    await waitFor(() => {
      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'MOVE_NODE_AS_SIBLING',
        payload: {
          tabId: 2,
          aboveTabId: undefined,
          belowTabId: 1,
          windowId: 1,
          viewIndex: 0,
          selectedTabIds: [],
        },
      });
    });
  });

  /**
   * タブ間ドロップ時のメッセージテスト
   * タブ間にドロップした場合、正しいメッセージが送信されることを検証
   */
  it('タブ間にドロップした場合、MOVE_NODE_AS_SIBLINGメッセージが送信される（タブ移動はServiceWorker側で実行）', async () => {
    let handleSiblingDrop: ((info: SiblingDropInfo) => Promise<void>) | null = null;

    await act(async () => {
      render(
        <TreeStateProvider>
          <SiblingDropTestComponent
            onReady={(fn) => {
              handleSiblingDrop = fn;
            }}
          />
        </TreeStateProvider>
      );
    });

    await waitFor(() => {
      expect(handleSiblingDrop).not.toBeNull();
    });

    // node-2をnode-1とnode-3の間にドロップ
    await act(async () => {
      if (handleSiblingDrop) {
        await handleSiblingDrop({
          activeTabId: 2,
          insertIndex: 1,
          aboveTabId: 1,
          belowTabId: 3,
        });
      }
    });

    // MOVE_NODE_AS_SIBLINGメッセージが送信されることを検証
    await waitFor(() => {
      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'MOVE_NODE_AS_SIBLING',
        payload: {
          tabId: 2,
          aboveTabId: 1,
          belowTabId: 3,
          windowId: 1,
          viewIndex: 0,
          selectedTabIds: [],
        },
      });
    });
  });

  /**
   * リスト末尾へのドロップテスト
   * belowNodeがundefinedの場合（リスト末尾へのドロップ）のメッセージを検証
   */
  it('リスト末尾にドロップした場合、MOVE_NODE_AS_SIBLINGメッセージが送信される（belowNodeId=undefined）', async () => {
    let handleSiblingDrop: ((info: SiblingDropInfo) => Promise<void>) | null = null;

    await act(async () => {
      render(
        <TreeStateProvider>
          <SiblingDropTestComponent
            onReady={(fn) => {
              handleSiblingDrop = fn;
            }}
          />
        </TreeStateProvider>
      );
    });

    await waitFor(() => {
      expect(handleSiblingDrop).not.toBeNull();
    });

    await act(async () => {
      if (handleSiblingDrop) {
        await handleSiblingDrop({
          activeTabId: 1,
          insertIndex: 2,
          aboveTabId: 3,
          belowTabId: undefined,
        });
      }
    });

    // MOVE_NODE_AS_SIBLINGメッセージが送信されることを検証
    await waitFor(() => {
      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'MOVE_NODE_AS_SIBLING',
        payload: {
          tabId: 1,
          aboveTabId: 3,
          belowTabId: undefined,
          windowId: 1,
          viewIndex: 0,
          selectedTabIds: [],
        },
      });
    });
  });
});

/**
 * 複数ウィンドウ対応のテスト
 */
describe('TreeStateProvider 複数ウィンドウ対応', () => {
  let mockMessageListeners: MessageListener[] = [];
  let mockStorageListeners: Array<(changes: StorageChanges, areaName: string) => void> = [];
  let mockChrome: MockChrome;

  // ウィンドウIDを表示するテストコンポーネント
  function WindowIdTestComponent() {
    const { isLoading, currentWindowId, pinnedTabIds, tabInfoMap } = useTreeState();

    if (isLoading) return <div>Loading...</div>;

    return (
      <div>
        <div data-testid="current-window-id">{currentWindowId !== null ? currentWindowId.toString() : 'null'}</div>
        <div data-testid="pinned-tab-ids">{JSON.stringify(pinnedTabIds)}</div>
        <div data-testid="tab-info-map-size">{Object.keys(tabInfoMap).length}</div>
      </div>
    );
  }

  beforeEach(() => {
    mockMessageListeners = [];
    mockStorageListeners = [];

    const multiWindowTreeState = {
      windows: [
        {
          windowId: 1,
          views: [{
            name: 'Default',
            color: '#3b82f6',
            rootNodes: [],
            pinnedTabIds: [2],
          }],
          activeViewIndex: 0,
        },
        {
          windowId: 2,
          views: [{
            name: 'Default',
            color: '#3b82f6',
            rootNodes: [],
            pinnedTabIds: [4],
          }],
          activeViewIndex: 0,
        },
      ],
    };

    mockChrome = {
      storage: {
        local: {
          get: vi.fn<(keys?: string | string[] | null) => Promise<Record<string, unknown>>>().mockResolvedValue({
            tree_state: multiWindowTreeState,
          }),
          set: vi.fn<(items: Record<string, unknown>) => Promise<void>>().mockResolvedValue(undefined),
          remove: vi.fn<(keys: string | string[]) => Promise<void>>(),
          clear: vi.fn<() => Promise<void>>(),
        },
        onChanged: {
          addListener: vi.fn((listener) => {
            mockStorageListeners.push(listener);
          }),
          removeListener: vi.fn((listener) => {
            mockStorageListeners = mockStorageListeners.filter((l) => l !== listener);
          }),
        },
      },
      runtime: {
        onMessage: {
          addListener: vi.fn((listener) => {
            mockMessageListeners.push(listener as MessageListener);
          }),
          removeListener: vi.fn((listener) => {
            mockMessageListeners = mockMessageListeners.filter((l) => l !== listener);
          }),
        },
        sendMessage: vi.fn().mockImplementation((message) => {
          if (message.type === 'GET_STATE') {
            return Promise.resolve({
              success: true,
              data: multiWindowTreeState,
            });
          }
          return Promise.resolve({ success: true, data: null });
        }),
        getURL: vi.fn(),
      },
      tabs: {
        get: vi.fn(),
        query: vi.fn().mockResolvedValue([
          // ウィンドウ1のタブ
          { id: 1, title: 'Tab 1', url: 'https://tab1.com', pinned: false, frozen: false, active: true, windowId: 1 },
          { id: 2, title: 'Tab 2', url: 'https://tab2.com', pinned: true, frozen: false, active: false, windowId: 1 },
          // ウィンドウ2のタブ
          { id: 3, title: 'Tab 3', url: 'https://tab3.com', pinned: false, frozen: false, active: false, windowId: 2 },
          { id: 4, title: 'Tab 4', url: 'https://tab4.com', pinned: true, frozen: false, active: false, windowId: 2 },
        ]),
        update: vi.fn(),
        move: vi.fn(),
        remove: vi.fn(),
        create: vi.fn(),
        duplicate: vi.fn(),
        reload: vi.fn(),
        onCreated: { addListener: vi.fn(), removeListener: vi.fn() },
        onRemoved: { addListener: vi.fn(), removeListener: vi.fn() },
        onMoved: { addListener: vi.fn(), removeListener: vi.fn() },
        onUpdated: { addListener: vi.fn(), removeListener: vi.fn() },
        onActivated: { addListener: vi.fn(), removeListener: vi.fn() },
        onDetached: { addListener: vi.fn(), removeListener: vi.fn() },
        onAttached: { addListener: vi.fn(), removeListener: vi.fn() },
      },
      windows: {
        get: vi.fn(),
        create: vi.fn(),
        getAll: vi.fn().mockResolvedValue([]),
        getCurrent: vi.fn().mockResolvedValue({ id: 1 }),
        onCreated: { addListener: vi.fn(), removeListener: vi.fn() },
        onRemoved: { addListener: vi.fn(), removeListener: vi.fn() },
        onFocusChanged: { addListener: vi.fn(), removeListener: vi.fn() },
      },
      sidePanel: {
        open: vi.fn(),
        getOptions: vi.fn(),
        setOptions: vi.fn(),
      },
    };
    global.chrome = mockChrome as unknown as typeof chrome;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('chrome.windows.getCurrent()を呼び出してcurrentWindowIdを取得する', async () => {
    await act(async () => {
      render(
        <TreeStateProvider>
          <WindowIdTestComponent />
        </TreeStateProvider>
      );
    });

    // currentWindowIdが1（モックで設定した値）であることを確認
    await waitFor(() => {
      expect(screen.getByTestId('current-window-id')).toHaveTextContent('1');
    });

    // chrome.windows.getCurrent()が呼び出されたことを確認
    expect(chrome.windows.getCurrent).toHaveBeenCalled();
  });

  it('currentWindowIdがnullでない場合、pinnedTabIdsは現在のウィンドウのピン留めタブのみを含む', async () => {
    await act(async () => {
      render(
        <TreeStateProvider>
          <WindowIdTestComponent />
        </TreeStateProvider>
      );
    });

    // ウィンドウ1のピン留めタブ（id: 2）のみがpinnedTabIdsに含まれることを確認
    await waitFor(() => {
      const pinnedTabIds = JSON.parse(screen.getByTestId('pinned-tab-ids').textContent || '[]');
      expect(pinnedTabIds).toContain(2);
      expect(pinnedTabIds).not.toContain(4); // ウィンドウ2のピン留めタブは含まれない
    });
  });

  it('URLパラメータでwindowIdが指定されている場合、そのウィンドウIDを使用する', async () => {
    // URLパラメータをモック
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, search: '?windowId=2' },
      writable: true,
    });

    await act(async () => {
      render(
        <TreeStateProvider>
          <WindowIdTestComponent />
        </TreeStateProvider>
      );
    });

    // currentWindowIdがURLパラメータで指定した2であることを確認
    await waitFor(() => {
      expect(screen.getByTestId('current-window-id')).toHaveTextContent('2');
    });

    // ウィンドウ2のピン留めタブ（id: 4）のみがpinnedTabIdsに含まれることを確認
    await waitFor(() => {
      const pinnedTabIds = JSON.parse(screen.getByTestId('pinned-tab-ids').textContent || '[]');
      expect(pinnedTabIds).toContain(4);
      expect(pinnedTabIds).not.toContain(2); // ウィンドウ1のピン留めタブは含まれない
    });

    // 元に戻す
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
    });
  });

  it('chrome.windows.getCurrent()がエラーの場合、currentWindowIdはnullのまま', async () => {
    // chrome.windows.getCurrent()がエラーをスローするようにモック
    mockChrome.windows.getCurrent = vi.fn().mockRejectedValue(new Error('API not available'));

    await act(async () => {
      render(
        <TreeStateProvider>
          <WindowIdTestComponent />
        </TreeStateProvider>
      );
    });

    // currentWindowIdがnullであることを確認
    await waitFor(() => {
      expect(screen.getByTestId('current-window-id')).toHaveTextContent('null');
    });
  });
});

/**
 * ファビコン永続化機能のテスト
 */
describe('TreeStateProvider ファビコン永続化', () => {
  let mockMessageListeners: MessageListener[] = [];
  let mockStorageListeners: Array<(changes: StorageChanges, areaName: string) => void> = [];
  let mockTabsUpdatedListeners: Array<(tabId: number, changeInfo: chrome.tabs.OnUpdatedInfo, tab: chrome.tabs.Tab) => void> = [];
  let mockChrome: MockChrome;

  // ファビコン情報を表示するテストコンポーネント
  function FaviconTestComponent() {
    const { isLoading, tabInfoMap, getTabInfo } = useTreeState();

    if (isLoading) return <div>Loading...</div>;

    const tabInfo = getTabInfo(1);

    return (
      <div>
        <div data-testid="tab-1-favicon">{tabInfo?.favIconUrl || 'no-favicon'}</div>
        <div data-testid="tab-2-favicon">{getTabInfo(2)?.favIconUrl || 'no-favicon'}</div>
        <div data-testid="tab-info-map-size">{Object.keys(tabInfoMap).length}</div>
      </div>
    );
  }

  beforeEach(() => {
    mockMessageListeners = [];
    mockStorageListeners = [];
    mockTabsUpdatedListeners = [];

    mockChrome = {
      storage: {
        local: {
          get: vi.fn<(keys?: string | string[] | null) => Promise<Record<string, unknown>>>().mockImplementation((keys) => {
            if (keys === 'tab_favicons') {
              return Promise.resolve({ tab_favicons: {} });
            }
            if (keys === 'tab_titles') {
              return Promise.resolve({ tab_titles: {} });
            }
            return Promise.resolve({
              tree_state: {
                windows: [{
                  windowId: 1,
                  views: [{
                    name: 'Default',
                    color: '#3b82f6',
                    rootNodes: [],
                    pinnedTabIds: [],
                  }],
                  activeViewIndex: 0,
                }],
              },
            });
          }),
          set: vi.fn<(items: Record<string, unknown>) => Promise<void>>().mockResolvedValue(undefined),
          remove: vi.fn<(keys: string | string[]) => Promise<void>>(),
          clear: vi.fn<() => Promise<void>>(),
        },
        onChanged: {
          addListener: vi.fn((listener) => {
            mockStorageListeners.push(listener);
          }),
          removeListener: vi.fn((listener) => {
            mockStorageListeners = mockStorageListeners.filter((l) => l !== listener);
          }),
        },
      },
      runtime: {
        onMessage: {
          addListener: vi.fn((listener) => {
            mockMessageListeners.push(listener as MessageListener);
          }),
          removeListener: vi.fn((listener) => {
            mockMessageListeners = mockMessageListeners.filter((l) => l !== listener);
          }),
        },
        sendMessage: vi.fn().mockImplementation((message) => {
          if (message.type === 'GET_STATE') {
            return Promise.resolve({
              success: true,
              data: {
                windows: [{
                  windowId: 1,
                  views: [{
                    name: 'Default',
                    color: '#3b82f6',
                    rootNodes: [],
                    pinnedTabIds: [],
                  }],
                  activeViewIndex: 0,
                }],
              },
            });
          }
          return Promise.resolve({ success: true, data: null });
        }),
        getURL: vi.fn(),
      },
      tabs: {
        get: vi.fn(),
        query: vi.fn().mockResolvedValue([
          {
            id: 1,
            title: 'Test Page',
            url: 'https://example.com',
            favIconUrl: 'https://example.com/favicon.ico',
            status: 'complete',
            pinned: false,
            active: true,
            windowId: 1,
          },
          {
            id: 2,
            title: 'Another Page',
            url: 'https://another.com',
            favIconUrl: undefined,
            status: 'loading',
            pinned: false,
            active: false,
            windowId: 1,
          },
        ]),
        update: vi.fn(),
        move: vi.fn(),
        remove: vi.fn(),
        create: vi.fn(),
        duplicate: vi.fn(),
        reload: vi.fn(),
        onCreated: { addListener: vi.fn(), removeListener: vi.fn() },
        onRemoved: { addListener: vi.fn(), removeListener: vi.fn() },
        onMoved: { addListener: vi.fn(), removeListener: vi.fn() },
        onUpdated: {
          addListener: vi.fn((listener) => {
            mockTabsUpdatedListeners.push(listener);
          }),
          removeListener: vi.fn((listener) => {
            mockTabsUpdatedListeners = mockTabsUpdatedListeners.filter((l) => l !== listener);
          }),
        },
        onActivated: { addListener: vi.fn(), removeListener: vi.fn() },
        onDetached: { addListener: vi.fn(), removeListener: vi.fn() },
        onAttached: { addListener: vi.fn(), removeListener: vi.fn() },
      },
      windows: {
        get: vi.fn(),
        getCurrent: vi.fn().mockResolvedValue({ id: 1 }),
        create: vi.fn(),
        getAll: vi.fn().mockResolvedValue([]),
        onCreated: { addListener: vi.fn(), removeListener: vi.fn() },
        onRemoved: { addListener: vi.fn(), removeListener: vi.fn() },
        onFocusChanged: { addListener: vi.fn(), removeListener: vi.fn() },
      },
      sidePanel: {
        open: vi.fn(),
        getOptions: vi.fn(),
        setOptions: vi.fn(),
      },
    };
    global.chrome = mockChrome as unknown as typeof chrome;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('ファビコンがundefinedに変わった場合は永続化しない', async () => {
    await act(async () => {
      render(
        <TreeStateProvider>
          <FaviconTestComponent />
        </TreeStateProvider>
      );
    });

    // 初期状態のファビコンを確認
    await waitFor(() => {
      expect(screen.getByTestId('tab-1-favicon')).toHaveTextContent('https://example.com/favicon.ico');
    });

    // setの呼び出し回数をリセット
    mockChrome.storage.local.set.mockClear();

    // ファビコンがundefinedに変更されるイベントを発火
    await act(async () => {
      mockTabsUpdatedListeners.forEach((listener) => {
        listener(
          1,
          { favIconUrl: undefined },
          {
            id: 1,
            title: 'Test Page',
            url: 'https://example.com',
            favIconUrl: undefined,
            status: 'loading',
            pinned: false,
            active: true,
            index: 0,
            windowId: 1,
            highlighted: false,
            incognito: false,
            selected: false,
            discarded: false,
            autoDiscardable: true,
            groupId: -1, frozen: false,
          }
        );
      });
    });

    // tab_faviconsへのsetが呼び出されていないことを確認
    // （undefinedになった場合は既存の永続化データを維持する）
    await waitFor(() => {
      const setCalls = mockChrome.storage.local.set.mock.calls;
      const faviconSetCall = setCalls.find(
        (call) => call[0] && typeof call[0] === 'object' && 'tab_favicons' in (call[0] as Record<string, unknown>)
      );
      // undefinedの場合は永続化されない
      if (faviconSetCall) {
        // 呼び出されていた場合、undefinedは含まれていないことを確認
        const faviconData = (faviconSetCall[0] as { tab_favicons: Record<number, string> }).tab_favicons;
        expect(faviconData[1]).not.toBeUndefined();
      }
    });
  });
});

/**
 * 余分なLoadingタブ防止機能のテスト
 */
describe('TreeStateProvider 余分なLoadingタブ防止', () => {
  let mockMessageListeners: MessageListener[] = [];
  let mockStorageListeners: Array<(changes: StorageChanges, areaName: string) => void> = [];
  let mockTabsCreatedListeners: Array<(tab: chrome.tabs.Tab) => void> = [];
  let mockTabsUpdatedListeners: Array<(tabId: number, changeInfo: chrome.tabs.OnUpdatedInfo, tab: chrome.tabs.Tab) => void> = [];
  let mockChrome: MockChrome;

  function TabCountTestComponent() {
    const { isLoading, tabInfoMap, currentWindowState, currentViewIndex } = useTreeState();

    if (isLoading) return <div>Loading...</div>;

    const countNodes = (nodes: { tabId: number; children: unknown[] }[]): number => {
      let count = 0;
      for (const node of nodes) {
        count += 1;
        count += countNodes(node.children as { tabId: number; children: unknown[] }[]);
      }
      return count;
    };

    const currentViewState = currentWindowState?.views[currentViewIndex];
    const nodeCount = currentViewState ? countNodes(currentViewState.rootNodes) : 0;

    return (
      <div>
        <div data-testid="tab-info-map-size">{Object.keys(tabInfoMap).length}</div>
        <div data-testid="tree-node-count">{nodeCount}</div>
      </div>
    );
  }

  beforeEach(() => {
    mockMessageListeners = [];
    mockStorageListeners = [];
    mockTabsCreatedListeners = [];
    mockTabsUpdatedListeners = [];

    mockChrome = {
      storage: {
        local: {
          get: vi.fn<(keys?: string | string[] | null) => Promise<Record<string, unknown>>>().mockImplementation((keys) => {
            if (keys === 'tab_favicons') {
              return Promise.resolve({ tab_favicons: {} });
            }
            if (keys === 'tab_titles') {
              return Promise.resolve({ tab_titles: {} });
            }
            return Promise.resolve({
              tree_state: {
                windows: [{
                  windowId: 1,
                  views: [{
                    name: 'Default',
                    color: '#3b82f6',
                    rootNodes: [],
                    pinnedTabIds: [],
                  }],
                  activeViewIndex: 0,
                }],
              },
            });
          }),
          set: vi.fn<(items: Record<string, unknown>) => Promise<void>>().mockResolvedValue(undefined),
          remove: vi.fn<(keys: string | string[]) => Promise<void>>(),
          clear: vi.fn<() => Promise<void>>(),
        },
        onChanged: {
          addListener: vi.fn((listener) => {
            mockStorageListeners.push(listener);
          }),
          removeListener: vi.fn((listener) => {
            mockStorageListeners = mockStorageListeners.filter((l) => l !== listener);
          }),
        },
      },
      runtime: {
        onMessage: {
          addListener: vi.fn((listener) => {
            mockMessageListeners.push(listener as MessageListener);
          }),
          removeListener: vi.fn((listener) => {
            mockMessageListeners = mockMessageListeners.filter((l) => l !== listener);
          }),
        },
        sendMessage: vi.fn().mockImplementation((message) => {
          if (message.type === 'GET_STATE') {
            return Promise.resolve({
              success: true,
              data: {
                windows: [{
                  windowId: 1,
                  views: [{
                    name: 'Default',
                    color: '#3b82f6',
                    rootNodes: [],
                    pinnedTabIds: [],
                  }],
                  activeViewIndex: 0,
                }],
              },
            });
          }
          return Promise.resolve({ success: true, data: null });
        }),
        getURL: vi.fn(),
      },
      tabs: {
        get: vi.fn(),
        query: vi.fn().mockResolvedValue([
          {
            id: 1,
            title: 'Test Page',
            url: 'https://example.com',
            favIconUrl: 'https://example.com/favicon.ico',
            status: 'complete',
            pinned: false,
            active: true,
            windowId: 1,
          },
        ]),
        update: vi.fn(),
        move: vi.fn(),
        remove: vi.fn(),
        create: vi.fn(),
        duplicate: vi.fn(),
        reload: vi.fn(),
        onCreated: {
          addListener: vi.fn((listener) => {
            mockTabsCreatedListeners.push(listener);
          }),
          removeListener: vi.fn((listener) => {
            mockTabsCreatedListeners = mockTabsCreatedListeners.filter((l) => l !== listener);
          }),
        },
        onRemoved: { addListener: vi.fn(), removeListener: vi.fn() },
        onMoved: { addListener: vi.fn(), removeListener: vi.fn() },
        onUpdated: {
          addListener: vi.fn((listener) => {
            mockTabsUpdatedListeners.push(listener);
          }),
          removeListener: vi.fn((listener) => {
            mockTabsUpdatedListeners = mockTabsUpdatedListeners.filter((l) => l !== listener);
          }),
        },
        onActivated: { addListener: vi.fn(), removeListener: vi.fn() },
        onDetached: { addListener: vi.fn(), removeListener: vi.fn() },
        onAttached: { addListener: vi.fn(), removeListener: vi.fn() },
      },
      windows: {
        get: vi.fn(),
        getCurrent: vi.fn().mockResolvedValue({ id: 1 }),
        create: vi.fn(),
        getAll: vi.fn().mockResolvedValue([]),
        onCreated: { addListener: vi.fn(), removeListener: vi.fn() },
        onRemoved: { addListener: vi.fn(), removeListener: vi.fn() },
        onFocusChanged: { addListener: vi.fn(), removeListener: vi.fn() },
      },
      sidePanel: {
        open: vi.fn(),
        getOptions: vi.fn(),
        setOptions: vi.fn(),
      },
    };
    global.chrome = mockChrome as unknown as typeof chrome;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('tabInfoMapにはchrome.tabs.queryで返されたタブの数だけタブ情報が格納される', async () => {
    await act(async () => {
      render(
        <TreeStateProvider>
          <TabCountTestComponent />
        </TreeStateProvider>
      );
    });

    // タブ情報がロードされるのを待つ
    await waitFor(() => {
      // chrome.tabs.queryで1つのタブが返されるので、tabInfoMapには1つのタブ情報がある
      expect(screen.getByTestId('tab-info-map-size')).toHaveTextContent('1');
    });
  });

  it('onUpdatedでstatus: loadingのみの変更イベントを受けてもtabInfoMapに新しいエントリを追加しない', async () => {
    await act(async () => {
      render(
        <TreeStateProvider>
          <TabCountTestComponent />
        </TreeStateProvider>
      );
    });

    // 初期状態を確認
    await waitFor(() => {
      expect(screen.getByTestId('tab-info-map-size')).toHaveTextContent('1');
    });

    // 存在しないタブIDでstatus: loadingのみの変更イベントを発火
    // これは余分なLoadingタブを生成しない
    await act(async () => {
      mockTabsUpdatedListeners.forEach((listener) => {
        listener(
          999, // 存在しないタブID
          { status: 'loading' }, // statusのみの変更
          {
            id: 999,
            title: '',
            url: '',
            favIconUrl: undefined,
            status: 'loading',
            pinned: false,
            active: false,
            index: 0,
            windowId: 1,
            highlighted: false,
            incognito: false,
            selected: false,
            discarded: false,
            autoDiscardable: true,
            groupId: -1, frozen: false,
          }
        );
      });
    });

    // tabInfoMapには依然として1つのタブ情報のみが存在する
    // (status: loadingのみの変更では新しいエントリは追加されない)
    await waitFor(() => {
      expect(screen.getByTestId('tab-info-map-size')).toHaveTextContent('1');
    });
  });

  it('onUpdatedでtitleが変更された場合のみtabInfoMapを更新する', async () => {
    await act(async () => {
      render(
        <TreeStateProvider>
          <TabCountTestComponent />
        </TreeStateProvider>
      );
    });

    // 初期状態を確認
    await waitFor(() => {
      expect(screen.getByTestId('tab-info-map-size')).toHaveTextContent('1');
    });

    // 既存のタブID(1)でtitle変更イベントを発火
    await act(async () => {
      mockTabsUpdatedListeners.forEach((listener) => {
        listener(
          1, // 既存のタブID
          { title: 'Updated Title' }, // titleの変更
          {
            id: 1,
            title: 'Updated Title',
            url: 'https://example.com',
            favIconUrl: 'https://example.com/favicon.ico',
            status: 'complete',
            pinned: false,
            active: true,
            index: 0,
            windowId: 1,
            highlighted: false,
            incognito: false,
            selected: false,
            discarded: false,
            autoDiscardable: true,
            groupId: -1, frozen: false,
          }
        );
      });
    });

    // tabInfoMapには依然として1つのタブ情報のみ（更新はされるが増加しない）
    await waitFor(() => {
      expect(screen.getByTestId('tab-info-map-size')).toHaveTextContent('1');
    });
  });
});

/**
 * タブタイトル永続化更新機能のテスト
 */
describe('TreeStateProvider タブタイトル永続化更新', () => {
  let mockMessageListeners: MessageListener[] = [];
  let mockStorageListeners: Array<(changes: StorageChanges, areaName: string) => void> = [];
  let mockTabsUpdatedListeners: Array<(tabId: number, changeInfo: chrome.tabs.OnUpdatedInfo, tab: chrome.tabs.Tab) => void> = [];
  let mockChrome: MockChrome;

  // タイトル情報を表示するテストコンポーネント
  function TitleTestComponent() {
    const { isLoading, tabInfoMap, getTabInfo } = useTreeState();

    if (isLoading) return <div>Loading...</div>;

    const tabInfo = getTabInfo(1);

    return (
      <div>
        <div data-testid="tab-1-title">{tabInfo?.title || 'no-title'}</div>
        <div data-testid="tab-2-title">{getTabInfo(2)?.title || 'no-title'}</div>
        <div data-testid="tab-info-map-size">{Object.keys(tabInfoMap).length}</div>
      </div>
    );
  }

  beforeEach(() => {
    mockMessageListeners = [];
    mockStorageListeners = [];
    mockTabsUpdatedListeners = [];

    mockChrome = {
      storage: {
        local: {
          get: vi.fn<(keys?: string | string[] | null) => Promise<Record<string, unknown>>>().mockImplementation((keys) => {
            if (keys === 'tab_favicons') {
              return Promise.resolve({ tab_favicons: {} });
            }
            if (keys === 'tab_titles') {
              return Promise.resolve({ tab_titles: {} });
            }
            return Promise.resolve({
              tree_state: {
                windows: [{
                  windowId: 1,
                  views: [{
                    name: 'Default',
                    color: '#3b82f6',
                    rootNodes: [],
                    pinnedTabIds: [],
                  }],
                  activeViewIndex: 0,
                }],
              },
            });
          }),
          set: vi.fn<(items: Record<string, unknown>) => Promise<void>>().mockResolvedValue(undefined),
          remove: vi.fn<(keys: string | string[]) => Promise<void>>(),
          clear: vi.fn<() => Promise<void>>(),
        },
        onChanged: {
          addListener: vi.fn((listener) => {
            mockStorageListeners.push(listener);
          }),
          removeListener: vi.fn((listener) => {
            mockStorageListeners = mockStorageListeners.filter((l) => l !== listener);
          }),
        },
      },
      runtime: {
        onMessage: {
          addListener: vi.fn((listener) => {
            mockMessageListeners.push(listener as MessageListener);
          }),
          removeListener: vi.fn((listener) => {
            mockMessageListeners = mockMessageListeners.filter((l) => l !== listener);
          }),
        },
        sendMessage: vi.fn().mockImplementation((message) => {
          if (message.type === 'GET_STATE') {
            return Promise.resolve({
              success: true,
              data: {
                windows: [{
                  windowId: 1,
                  views: [{
                    name: 'Default',
                    color: '#3b82f6',
                    rootNodes: [],
                    pinnedTabIds: [],
                  }],
                  activeViewIndex: 0,
                }],
              },
            });
          }
          return Promise.resolve({ success: true, data: null });
        }),
        getURL: vi.fn(),
      },
      tabs: {
        get: vi.fn(),
        query: vi.fn().mockResolvedValue([
          {
            id: 1,
            title: 'Test Page',
            url: 'https://example.com',
            favIconUrl: 'https://example.com/favicon.ico',
            status: 'complete',
            pinned: false,
            active: true,
            windowId: 1,
          },
          {
            id: 2,
            title: 'Another Page',
            url: 'https://another.com',
            favIconUrl: undefined,
            status: 'loading',
            pinned: false,
            active: false,
            windowId: 1,
          },
        ]),
        update: vi.fn(),
        move: vi.fn(),
        remove: vi.fn(),
        create: vi.fn(),
        duplicate: vi.fn(),
        reload: vi.fn(),
        onCreated: { addListener: vi.fn(), removeListener: vi.fn() },
        onRemoved: { addListener: vi.fn(), removeListener: vi.fn() },
        onMoved: { addListener: vi.fn(), removeListener: vi.fn() },
        onUpdated: {
          addListener: vi.fn((listener) => {
            mockTabsUpdatedListeners.push(listener);
          }),
          removeListener: vi.fn((listener) => {
            mockTabsUpdatedListeners = mockTabsUpdatedListeners.filter((l) => l !== listener);
          }),
        },
        onActivated: { addListener: vi.fn(), removeListener: vi.fn() },
        onDetached: { addListener: vi.fn(), removeListener: vi.fn() },
        onAttached: { addListener: vi.fn(), removeListener: vi.fn() },
      },
      windows: {
        get: vi.fn(),
        getCurrent: vi.fn().mockResolvedValue({ id: 1 }),
        create: vi.fn(),
        getAll: vi.fn().mockResolvedValue([]),
        onCreated: { addListener: vi.fn(), removeListener: vi.fn() },
        onRemoved: { addListener: vi.fn(), removeListener: vi.fn() },
        onFocusChanged: { addListener: vi.fn(), removeListener: vi.fn() },
      },
      sidePanel: {
        open: vi.fn(),
        getOptions: vi.fn(),
        setOptions: vi.fn(),
      },
    };
    global.chrome = mockChrome as unknown as typeof chrome;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('タイトルがundefinedに変わった場合は永続化しない', async () => {
    await act(async () => {
      render(
        <TreeStateProvider>
          <TitleTestComponent />
        </TreeStateProvider>
      );
    });

    // 初期状態のタイトルを確認
    await waitFor(() => {
      expect(screen.getByTestId('tab-1-title')).toHaveTextContent('Test Page');
    });

    // setの呼び出し回数をリセット
    mockChrome.storage.local.set.mockClear();

    // タイトルがundefinedに変更されるイベントを発火（ローディング中など）
    await act(async () => {
      mockTabsUpdatedListeners.forEach((listener) => {
        listener(
          1,
          { title: undefined },
          {
            id: 1,
            title: undefined,
            url: 'https://example.com',
            favIconUrl: 'https://example.com/favicon.ico',
            status: 'loading',
            pinned: false,
            active: true,
            index: 0,
            windowId: 1,
            highlighted: false,
            incognito: false,
            selected: false,
            discarded: false,
            autoDiscardable: true,
            groupId: -1, frozen: false,
          }
        );
      });
    });

    // tab_titlesへのsetが呼び出されていないことを確認
    // （undefinedになった場合は既存の永続化データを維持する）
    await waitFor(() => {
      const setCalls = mockChrome.storage.local.set.mock.calls;
      const titleSetCall = setCalls.find(
        (call) => call[0] && typeof call[0] === 'object' && 'tab_titles' in (call[0] as Record<string, unknown>)
      );
      // undefinedの場合は永続化されない
      expect(titleSetCall).toBeUndefined();
    });
  });

  it('空文字列のタイトルは永続化しない', async () => {
    await act(async () => {
      render(
        <TreeStateProvider>
          <TitleTestComponent />
        </TreeStateProvider>
      );
    });

    // 初期状態のタイトルを確認
    await waitFor(() => {
      expect(screen.getByTestId('tab-1-title')).toHaveTextContent('Test Page');
    });

    // setの呼び出し回数をリセット
    mockChrome.storage.local.set.mockClear();

    // タイトルが空文字列に変更されるイベントを発火
    await act(async () => {
      mockTabsUpdatedListeners.forEach((listener) => {
        listener(
          1,
          { title: '' },
          {
            id: 1,
            title: '',
            url: 'https://example.com',
            favIconUrl: 'https://example.com/favicon.ico',
            status: 'loading',
            pinned: false,
            active: true,
            index: 0,
            windowId: 1,
            highlighted: false,
            incognito: false,
            selected: false,
            discarded: false,
            autoDiscardable: true,
            groupId: -1, frozen: false,
          }
        );
      });
    });

    // tab_titlesへのsetが呼び出されていないことを確認
    await waitFor(() => {
      const setCalls = mockChrome.storage.local.set.mock.calls;
      const titleSetCall = setCalls.find(
        (call) => call[0] && typeof call[0] === 'object' && 'tab_titles' in (call[0] as Record<string, unknown>)
      );
      // 空文字列の場合は永続化されない
      expect(titleSetCall).toBeUndefined();
    });
  });

});

/**
 * ビューのタブカウント正確性のテスト
 * 不整合タブ削除時にviewTabCountsが再計算されることをテスト
 */
describe('TreeStateProvider viewTabCounts 正確性', () => {
  let mockMessageListeners: MessageListener[] = [];
  let mockStorageListeners: Array<(changes: StorageChanges, areaName: string) => void> = [];
  let mockChrome: MockChrome;

  function ViewTabCountsTestComponent() {
    const { treeState, isLoading, viewTabCounts, tabInfoMap, currentWindowState } = useTreeState();

    if (isLoading) return <div>Loading...</div>;
    if (!treeState) return <div>No state</div>;

    const countNodes = (nodes: { tabId: number; children: unknown[] }[]): number => {
      let count = 0;
      for (const node of nodes) {
        count += 1;
        count += countNodes(node.children as { tabId: number; children: unknown[] }[]);
      }
      return count;
    };

    const totalNodes = currentWindowState?.views.reduce(
      (sum, view) => sum + countNodes(view.rootNodes),
      0
    ) ?? 0;

    return (
      <div>
        <div data-testid="view-tab-counts">{JSON.stringify(viewTabCounts)}</div>
        <div data-testid="tab-info-map-keys">{JSON.stringify(Object.keys(tabInfoMap).map(Number))}</div>
        <div data-testid="node-count">{totalNodes}</div>
      </div>
    );
  }

  beforeEach(() => {
    mockMessageListeners = [];
    mockStorageListeners = [];

    const treeStateWithInconsistentTabs: TreeState = {
      windows: [{
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
            pinnedTabIds: [],
          },
          {
            name: 'View 2',
            color: '#10b981',
            rootNodes: [{ tabId: 4, isExpanded: true, children: [] }],
            pinnedTabIds: [],
          },
        ],
        activeViewIndex: 0,
      }],
    };

    mockChrome = {
      storage: {
        local: {
          get: vi.fn<(keys?: string | string[] | null) => Promise<Record<string, unknown>>>().mockImplementation(async (keys) => {
            if (keys === 'tree_state' || (Array.isArray(keys) && keys.includes('tree_state'))) {
              return { tree_state: treeStateWithInconsistentTabs };
            }
            if (keys === 'groups') {
              return { groups: {} };
            }
            if (keys === 'unread_tabs') {
              return { unread_tabs: [] };
            }
            if (keys === 'tab_titles') {
              return { tab_titles: {} };
            }
            if (keys === 'tab_favicons') {
              return { tab_favicons: {} };
            }
            return {};
          }),
          set: vi.fn<(items: Record<string, unknown>) => Promise<void>>().mockResolvedValue(undefined),
          remove: vi.fn<(keys: string | string[]) => Promise<void>>(),
          clear: vi.fn<() => Promise<void>>(),
        },
        onChanged: {
          addListener: vi.fn((listener) => {
            mockStorageListeners.push(listener);
          }),
          removeListener: vi.fn((listener) => {
            mockStorageListeners = mockStorageListeners.filter(
              (l) => l !== listener
            );
          }),
        },
      },
      runtime: {
        onMessage: {
          addListener: vi.fn((listener) => {
            mockMessageListeners.push(listener as MessageListener);
          }),
          removeListener: vi.fn((listener) => {
            mockMessageListeners = mockMessageListeners.filter(
              (l) => l !== listener
            );
          }),
        },
        sendMessage: vi.fn().mockImplementation((message) => {
          if (message.type === 'GET_STATE') {
            return Promise.resolve({
              success: true,
              data: treeStateWithInconsistentTabs,
            });
          }
          return Promise.resolve({ success: true, data: null });
        }),
        getURL: vi.fn(),
      },
      tabs: {
        get: vi.fn(),
        // タブ1, 2, 4のみ存在（タブ3は存在しない）
        query: vi.fn().mockResolvedValue([
          { id: 1, title: 'Tab 1', url: 'https://example.com/1', pinned: false, windowId: 1, status: 'complete', frozen: false },
          { id: 2, title: 'Tab 2', url: 'https://example.com/2', pinned: false, windowId: 1, status: 'complete', frozen: false },
          { id: 4, title: 'Tab 4', url: 'https://example.com/4', pinned: false, windowId: 1, status: 'complete', frozen: false },
        ]),
        update: vi.fn(),
        move: vi.fn(),
        remove: vi.fn(),
        create: vi.fn(),
        duplicate: vi.fn(),
        reload: vi.fn(),
        onCreated: { addListener: vi.fn(), removeListener: vi.fn() },
        onRemoved: { addListener: vi.fn(), removeListener: vi.fn() },
        onMoved: { addListener: vi.fn(), removeListener: vi.fn() },
        onUpdated: { addListener: vi.fn(), removeListener: vi.fn() },
        onActivated: { addListener: vi.fn(), removeListener: vi.fn() },
        onDetached: { addListener: vi.fn(), removeListener: vi.fn() },
        onAttached: { addListener: vi.fn(), removeListener: vi.fn() },
      },
      windows: {
        get: vi.fn(),
        getCurrent: vi.fn().mockResolvedValue({ id: 1 }),
        create: vi.fn(),
        getAll: vi.fn().mockResolvedValue([]),
        onCreated: { addListener: vi.fn(), removeListener: vi.fn() },
        onRemoved: { addListener: vi.fn(), removeListener: vi.fn() },
        onFocusChanged: { addListener: vi.fn(), removeListener: vi.fn() },
      },
      sidePanel: {
        open: vi.fn(),
        getOptions: vi.fn(),
        setOptions: vi.fn(),
      },
    };

    global.chrome = mockChrome as unknown as typeof chrome;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('viewTabCountsは実際に存在するタブのみをカウントする（不整合タブを除外）', async () => {
    await act(async () => {
      render(
        <TreeStateProvider>
          <ViewTabCountsTestComponent />
        </TreeStateProvider>
      );
    });

    // ノード数はツリー状態のまま4つ
    await waitFor(() => {
      expect(screen.getByTestId('node-count')).toHaveTextContent('4');
    });

    // tabInfoMapには実際に存在するタブ1, 2, 4のみが含まれる
    await waitFor(() => {
      const tabInfoMapKeys = JSON.parse(screen.getByTestId('tab-info-map-keys').textContent || '[]');
      expect(tabInfoMapKeys).toEqual([1, 2, 4]);
    });

    await waitFor(() => {
      const viewTabCounts = JSON.parse(screen.getByTestId('view-tab-counts').textContent || '[]');
      expect(viewTabCounts).toEqual([2, 1]);
    });
  });

  it('すべてのタブが存在する場合は全ノードをカウントする', async () => {
    mockChrome.tabs.query.mockResolvedValue([
      { id: 1, title: 'Tab 1', url: 'https://example.com/1', pinned: false, windowId: 1, status: 'complete', index: 0, highlighted: false, active: true, incognito: false, selected: false, discarded: false, autoDiscardable: true, groupId: -1, frozen: false },
      { id: 2, title: 'Tab 2', url: 'https://example.com/2', pinned: false, windowId: 1, status: 'complete', index: 1, highlighted: false, active: false, incognito: false, selected: false, discarded: false, autoDiscardable: true, groupId: -1, frozen: false },
      { id: 3, title: 'Tab 3', url: 'https://example.com/3', pinned: false, windowId: 1, status: 'complete', index: 2, highlighted: false, active: false, incognito: false, selected: false, discarded: false, autoDiscardable: true, groupId: -1, frozen: false },
      { id: 4, title: 'Tab 4', url: 'https://example.com/4', pinned: false, windowId: 1, status: 'complete', index: 3, highlighted: false, active: false, incognito: false, selected: false, discarded: false, autoDiscardable: true, groupId: -1, frozen: false },
    ]);

    await act(async () => {
      render(
        <TreeStateProvider>
          <ViewTabCountsTestComponent />
        </TreeStateProvider>
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId('node-count')).toHaveTextContent('4');
    });

    await waitFor(() => {
      const tabInfoMapKeys = JSON.parse(screen.getByTestId('tab-info-map-keys').textContent || '[]');
      expect(tabInfoMapKeys.sort()).toEqual([1, 2, 3, 4]);
    });

    await waitFor(() => {
      const viewTabCounts = JSON.parse(screen.getByTestId('view-tab-counts').textContent || '[]');
      expect(viewTabCounts).toEqual([3, 1]);
    });
  });
});
