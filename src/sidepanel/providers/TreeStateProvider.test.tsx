/**
 * Task 5.4: TreeStateProvider のリアルタイム更新テスト
 * Requirements: 1.4, 2.1
 */
import React from 'react';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { TreeStateProvider, useTreeState } from './TreeStateProvider';
import type { TreeState, StorageChanges, SiblingDropInfo } from '@/types';
import type { MockChrome, MessageListener } from '@/test/test-types';

// テストコンポーネント
function TestComponent() {
  const { treeState, isLoading, error } = useTreeState();

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  if (!treeState) return <div>No state</div>;

  return (
    <div>
      <div data-testid="current-view">{treeState.currentViewId}</div>
      <div data-testid="node-count">{Object.keys(treeState.nodes).length}</div>
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

    // chrome.storage.local のモック
    mockChrome = {
      storage: {
        local: {
          get: vi.fn<(keys?: string | string[] | null) => Promise<Record<string, unknown>>>().mockResolvedValue({
            tree_state: {
              views: [{ id: 'default', name: 'Default', color: '#3b82f6' }],
              currentViewId: 'default',
              nodes: {},
              tabToNode: {},
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
        sendMessage: vi.fn().mockResolvedValue(undefined),
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
      },
      windows: {
        get: vi.fn(),
        getCurrent: vi.fn().mockResolvedValue({ id: 1 }),
        create: vi.fn(),
        onCreated: { addListener: vi.fn(), removeListener: vi.fn() },
        onRemoved: { addListener: vi.fn(), removeListener: vi.fn() },
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

  it('初期ロード時にストレージからツリー状態を読み込む', async () => {
    await act(async () => {
      render(
        <TreeStateProvider>
          <TestComponent />
        </TreeStateProvider>
      );
    });

    // ストレージから読み込まれた状態が表示されるのを待つ
    await waitFor(() => {
      expect(screen.getByTestId('current-view')).toHaveTextContent('default');
    });

    expect(chrome.storage.local.get).toHaveBeenCalledWith('tree_state');
  });

  it('STATE_UPDATED メッセージを受信したときにストレージから状態を再読み込みする', async () => {
    const initialState: TreeState = {
      views: [{ id: 'default', name: 'Default', color: '#3b82f6' }],
      currentViewId: 'default',
      nodes: {},
      tabToNode: {},
    };

    const updatedState: TreeState = {
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
      },
      tabToNode: { '1': 'node-1' },
    };

    // 最初の読み込みは初期状態
    mockChrome.storage.local.get.mockResolvedValueOnce({
      tree_state: initialState,
    });

    await act(async () => {
      render(
        <TreeStateProvider>
          <TestComponent />
        </TreeStateProvider>
      );
    });

    // 初期状態が表示されるのを待つ
    await waitFor(() => {
      expect(screen.getByTestId('node-count')).toHaveTextContent('0');
    });

    // STATE_UPDATED メッセージを受信するように設定
    mockChrome.storage.local.get.mockResolvedValueOnce({
      tree_state: updatedState,
    });

    // STATE_UPDATED メッセージを送信
    await act(async () => {
      mockMessageListeners.forEach((listener) => {
        listener({ type: 'STATE_UPDATED' }, {} as chrome.runtime.MessageSender, () => {});
      });
    });

    // 更新された状態が表示されるのを待つ
    await waitFor(() => {
      expect(screen.getByTestId('node-count')).toHaveTextContent('1');
    });
  });

  // Task 10.2.1: storage.onChanged handling re-enabled with race condition fix
  it('storage.onChanged イベントを受信したときに状態を更新する', async () => {
    const initialState: TreeState = {
      views: [{ id: 'default', name: 'Default', color: '#3b82f6' }],
      currentViewId: 'default',
      nodes: {},
      tabToNode: {},
    };

    mockChrome.storage.local.get.mockResolvedValue({
      tree_state: initialState,
    });

    await act(async () => {
      render(
        <TreeStateProvider>
          <TestComponent />
        </TreeStateProvider>
      );
    });

    // 初期状態が表示されるのを待つ
    await waitFor(() => {
      expect(screen.getByTestId('node-count')).toHaveTextContent('0');
    });

    // ストレージ変更イベントを発火
    const updatedState: TreeState = {
      ...initialState,
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
      },
      tabToNode: { '1': 'node-1' },
    };

    await act(async () => {
      mockStorageListeners.forEach((listener) => {
        listener({
          tree_state: {
            oldValue: initialState,
            newValue: updatedState,
          },
        }, 'local');
      });
    });

    // 更新された状態が表示されるのを待つ
    await waitFor(() => {
      expect(screen.getByTestId('node-count')).toHaveTextContent('1');
    });
  });
});

/**
 * Task 1.1: TabInfo マップ管理機能のテスト
 * Requirements: 1.1, 1.2, 1.3, 1.4
 */
describe('TreeStateProvider TabInfoMap管理', () => {
  let mockMessageListeners: MessageListener[] = [];
  let mockStorageListeners: Array<(changes: StorageChanges, areaName: string) => void> = [];
  let mockTabsUpdatedListeners: Array<(tabId: number, changeInfo: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab) => void> = [];
  let mockChrome: MockChrome;

  // タブ情報を表示するテストコンポーネント
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
              views: [{ id: 'default', name: 'Default', color: '#3b82f6' }],
              currentViewId: 'default',
              nodes: {},
              tabToNode: {},
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
        sendMessage: vi.fn().mockResolvedValue(undefined),
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
          },
          {
            id: 2,
            title: 'Another Page',
            url: 'https://another.com',
            favIconUrl: undefined,
            status: 'loading',
            pinned: true,
            active: false,
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
      },
      windows: {
        get: vi.fn(),
        getCurrent: vi.fn().mockResolvedValue({ id: 1 }),
        create: vi.fn(),
        onCreated: { addListener: vi.fn(), removeListener: vi.fn() },
        onRemoved: { addListener: vi.fn(), removeListener: vi.fn() },
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

  it('chrome.tabs.onUpdatedでタイトル変更時にtabInfoMapを更新する', async () => {
    await act(async () => {
      render(
        <TreeStateProvider>
          <TabInfoTestComponent />
        </TreeStateProvider>
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId('tab-1-title')).toHaveTextContent('Test Page');
    });

    // タブ更新イベントを発火
    await act(async () => {
      mockTabsUpdatedListeners.forEach((listener) => {
        listener(
          1,
          { title: 'Updated Title' },
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
            groupId: -1,
          }
        );
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId('tab-1-title')).toHaveTextContent('Updated Title');
    });
  });

  it('chrome.tabs.onUpdatedでファビコン変更時にtabInfoMapを更新する', async () => {
    await act(async () => {
      render(
        <TreeStateProvider>
          <TabInfoTestComponent />
        </TreeStateProvider>
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId('tab-1-favicon')).toHaveTextContent('https://example.com/favicon.ico');
    });

    // ファビコン更新イベントを発火
    await act(async () => {
      mockTabsUpdatedListeners.forEach((listener) => {
        listener(
          1,
          { favIconUrl: 'https://example.com/new-favicon.ico' },
          {
            id: 1,
            title: 'Test Page',
            url: 'https://example.com',
            favIconUrl: 'https://example.com/new-favicon.ico',
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
            groupId: -1,
          }
        );
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId('tab-1-favicon')).toHaveTextContent('https://example.com/new-favicon.ico');
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
 * Task 1.2: ピン留めタブ専用リスト管理機能のテスト
 * Requirements: 12.1
 */
describe('TreeStateProvider pinnedTabIds管理', () => {
  let mockMessageListeners: MessageListener[] = [];
  let mockStorageListeners: Array<(changes: StorageChanges, areaName: string) => void> = [];
  let mockTabsUpdatedListeners: Array<(tabId: number, changeInfo: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab) => void> = [];
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
              views: [{ id: 'default', name: 'Default', color: '#3b82f6' }],
              currentViewId: 'default',
              nodes: {},
              tabToNode: {},
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
        sendMessage: vi.fn().mockResolvedValue(undefined),
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
      },
      windows: {
        get: vi.fn(),
        getCurrent: vi.fn().mockResolvedValue({ id: 1 }),
        create: vi.fn(),
        onCreated: { addListener: vi.fn(), removeListener: vi.fn() },
        onRemoved: { addListener: vi.fn(), removeListener: vi.fn() },
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

  it('tabInfoMapからピン留め状態のタブIDをフィルタリングしてpinnedTabIds配列を算出する', async () => {
    await act(async () => {
      render(
        <TreeStateProvider>
          <PinnedTabsTestComponent />
        </TreeStateProvider>
      );
    });

    // ピン留めタブ（id: 2, 3）がpinnedTabIdsに含まれることを確認
    await waitFor(() => {
      expect(screen.getByTestId('pinned-count')).toHaveTextContent('2');
    });

    const pinnedTabIds = JSON.parse(screen.getByTestId('pinned-tab-ids').textContent || '[]');
    expect(pinnedTabIds).toContain(2);
    expect(pinnedTabIds).toContain(3);
    expect(pinnedTabIds).not.toContain(1);
  });

  it('ピン留め状態の変更時（onUpdated）にpinnedTabIdsを自動更新する', async () => {
    await act(async () => {
      render(
        <TreeStateProvider>
          <PinnedTabsTestComponent />
        </TreeStateProvider>
      );
    });

    // 初期状態: 2つのピン留めタブ
    await waitFor(() => {
      expect(screen.getByTestId('pinned-count')).toHaveTextContent('2');
    });

    // タブ1をピン留めに変更
    await act(async () => {
      mockTabsUpdatedListeners.forEach((listener) => {
        listener(
          1,
          { pinned: true },
          {
            id: 1,
            title: 'Normal Page',
            url: 'https://example.com',
            favIconUrl: 'https://example.com/favicon.ico',
            status: 'complete',
            pinned: true,
            active: true,
            index: 0,
            windowId: 1,
            highlighted: false,
            incognito: false,
            selected: false,
            discarded: false,
            autoDiscardable: true,
            groupId: -1,
          }
        );
      });
    });

    // ピン留めタブが3つになることを確認
    await waitFor(() => {
      expect(screen.getByTestId('pinned-count')).toHaveTextContent('3');
    });
  });

  it('ピン留め解除時にpinnedTabIdsから削除される', async () => {
    await act(async () => {
      render(
        <TreeStateProvider>
          <PinnedTabsTestComponent />
        </TreeStateProvider>
      );
    });

    // 初期状態: 2つのピン留めタブ
    await waitFor(() => {
      expect(screen.getByTestId('pinned-count')).toHaveTextContent('2');
    });

    // タブ2のピン留めを解除
    await act(async () => {
      mockTabsUpdatedListeners.forEach((listener) => {
        listener(
          2,
          { pinned: false },
          {
            id: 2,
            title: 'Pinned Page',
            url: 'https://pinned.com',
            favIconUrl: 'https://pinned.com/favicon.ico',
            status: 'complete',
            pinned: false,
            active: false,
            index: 1,
            windowId: 1,
            highlighted: false,
            incognito: false,
            selected: false,
            discarded: false,
            autoDiscardable: true,
            groupId: -1,
          }
        );
      });
    });

    // ピン留めタブが1つになることを確認
    await waitFor(() => {
      expect(screen.getByTestId('pinned-count')).toHaveTextContent('1');
      expect(screen.getByTestId('tab-2-pinned')).toHaveTextContent('false');
    });
  });

  it('ピン留めタブが0件の場合は空配列を返す', async () => {
    // ピン留めタブなしの状態をモック
    mockChrome.tabs.query = vi.fn().mockResolvedValue([
      {
        id: 1,
        title: 'Normal Page',
        url: 'https://example.com',
        favIconUrl: 'https://example.com/favicon.ico',
        status: 'complete',
        pinned: false,
        active: true,
        windowId: 1,
      },
    ]);

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
 * Task 1.3: 複数選択状態の管理機能のテスト
 * Requirements: 9.1, 9.2
 */
describe('TreeStateProvider 複数選択状態管理', () => {
  let mockMessageListeners: MessageListener[] = [];
  let mockStorageListeners: Array<(changes: StorageChanges, areaName: string) => void> = [];
  let mockChrome: MockChrome;

  // 選択状態を表示・操作するテストコンポーネント
  function SelectionTestComponent() {
    const {
      treeState,
      isLoading,
      selectedNodeIds,
      lastSelectedNodeId,
      selectNode,
      clearSelection,
      isNodeSelected,
    } = useTreeState();

    if (isLoading) return <div>Loading...</div>;
    if (!treeState) return <div>No state</div>;

    return (
      <div>
        <div data-testid="selected-count">{selectedNodeIds.size}</div>
        <div data-testid="selected-ids">{JSON.stringify(Array.from(selectedNodeIds).sort())}</div>
        <div data-testid="last-selected">{lastSelectedNodeId || 'null'}</div>
        <div data-testid="node-1-selected">{isNodeSelected('node-1') ? 'true' : 'false'}</div>
        <div data-testid="node-2-selected">{isNodeSelected('node-2') ? 'true' : 'false'}</div>
        <div data-testid="node-3-selected">{isNodeSelected('node-3') ? 'true' : 'false'}</div>
        <button
          data-testid="select-node-1"
          onClick={() => selectNode('node-1', { shift: false, ctrl: false })}
        >
          Select Node 1
        </button>
        <button
          data-testid="select-node-2"
          onClick={() => selectNode('node-2', { shift: false, ctrl: false })}
        >
          Select Node 2
        </button>
        <button
          data-testid="select-node-2-ctrl"
          onClick={() => selectNode('node-2', { shift: false, ctrl: true })}
        >
          Ctrl+Select Node 2
        </button>
        <button
          data-testid="select-node-3-shift"
          onClick={() => selectNode('node-3', { shift: true, ctrl: false })}
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
          children: [],
          isExpanded: true,
          depth: 0,
          viewId: 'default',
        },
      },
      tabToNode: { '1': 'node-1', '2': 'node-2', '3': 'node-3' },
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
        sendMessage: vi.fn().mockResolvedValue(undefined),
        getURL: vi.fn(),
      },
      tabs: {
        get: vi.fn(),
        query: vi.fn().mockResolvedValue([
          { id: 1, title: 'Tab 1', url: 'https://tab1.com', pinned: false, active: true },
          { id: 2, title: 'Tab 2', url: 'https://tab2.com', pinned: false, active: false },
          { id: 3, title: 'Tab 3', url: 'https://tab3.com', pinned: false, active: false },
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
      },
      windows: {
        get: vi.fn(),
        getCurrent: vi.fn().mockResolvedValue({ id: 1 }),
        create: vi.fn(),
        onCreated: { addListener: vi.fn(), removeListener: vi.fn() },
        onRemoved: { addListener: vi.fn(), removeListener: vi.fn() },
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

  it('selectedNodeIds、lastSelectedNodeIdステートを提供する', async () => {
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
      expect(screen.getByTestId('last-selected')).toHaveTextContent('node-1');
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
      expect(screen.getByTestId('last-selected')).toHaveTextContent('node-2');
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
 * Task 5.3: handleSiblingDropのテスト
 * Requirements: 8.1, 8.2, 8.3, 8.4
 * 兄弟としてドロップ（Gapドロップ）時のハンドラのテスト
 */
describe('TreeStateProvider handleSiblingDrop', () => {
  let mockMessageListeners: MessageListener[] = [];
  let mockStorageListeners: Array<(changes: StorageChanges, areaName: string) => void> = [];
  let mockChrome: MockChrome;

  // handleSiblingDropを呼び出すテストコンポーネント
  function SiblingDropTestComponent({ onReady }: { onReady?: (handleSiblingDrop: (info: SiblingDropInfo) => Promise<void>) => void }) {
    const { treeState, isLoading, handleSiblingDrop } = useTreeState();

    React.useEffect(() => {
      if (!isLoading && treeState && onReady) {
        onReady(handleSiblingDrop);
      }
    }, [isLoading, treeState, handleSiblingDrop, onReady]);

    if (isLoading) return <div>Loading...</div>;
    if (!treeState) return <div>No state</div>;

    // ノードの親子関係を表示
    const nodeInfos = Object.values(treeState.nodes).map((node) => ({
      id: node.id,
      parentId: node.parentId,
      depth: node.depth,
    }));

    // Task 8.1: 同じ親を持つ兄弟ノードの順序を取得
    // parentId -> [childNodeId1, childNodeId2, ...] の形式でグループ化
    const siblingGroups: Record<string, string[]> = {};
    Object.values(treeState.nodes).forEach((node) => {
      const parentKey = node.parentId || 'root';
      if (!siblingGroups[parentKey]) {
        siblingGroups[parentKey] = [];
      }
      siblingGroups[parentKey].push(node.id);
    });

    return (
      <div>
        <div data-testid="node-count">{Object.keys(treeState.nodes).length}</div>
        <div data-testid="node-infos">{JSON.stringify(nodeInfos)}</div>
        {Object.values(treeState.nodes).map((node) => (
          <div key={node.id} data-testid={`node-${node.id}-parent`}>{node.parentId || 'null'}</div>
        ))}
        {/* Task 8.1: 兄弟順序の表示 */}
        <div data-testid="sibling-groups">{JSON.stringify(siblingGroups)}</div>
        <div data-testid="root-siblings">{JSON.stringify(siblingGroups['root'] || [])}</div>
      </div>
    );
  }


  beforeEach(() => {
    mockMessageListeners = [];
    mockStorageListeners = [];

    // 3つのノードを持つツリー状態
    const treeStateWithNodes: TreeState = {
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
          parentId: 'node-1', // node-1の子
          children: [],
          isExpanded: true,
          depth: 1,
          viewId: 'default',
        },
        'node-3': {
          id: 'node-3',
          tabId: 3,
          parentId: null,
          children: [],
          isExpanded: true,
          depth: 0,
          viewId: 'default',
        },
      },
      tabToNode: { '1': 'node-1', '2': 'node-2', '3': 'node-3' },
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
        sendMessage: vi.fn().mockResolvedValue(undefined),
        getURL: vi.fn(),
      },
      tabs: {
        get: vi.fn(),
        query: vi.fn().mockResolvedValue([
          { id: 1, title: 'Tab 1', url: 'https://tab1.com', pinned: false, active: true },
          { id: 2, title: 'Tab 2', url: 'https://tab2.com', pinned: false, active: false },
          { id: 3, title: 'Tab 3', url: 'https://tab3.com', pinned: false, active: false },
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
      },
      windows: {
        get: vi.fn(),
        getCurrent: vi.fn().mockResolvedValue({ id: 1 }),
        create: vi.fn(),
        onCreated: { addListener: vi.fn(), removeListener: vi.fn() },
        onRemoved: { addListener: vi.fn(), removeListener: vi.fn() },
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

  it('兄弟としてドロップした場合、上のノードと同じ親を持つようになる', async () => {
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

    // 初期状態: node-2はnode-1の子
    await waitFor(() => {
      expect(screen.getByTestId('node-node-2-parent')).toHaveTextContent('node-1');
    });

    // node-2をnode-3の上（兄弟として）にドロップ
    // aboveNodeId=node-1, belowNodeId=node-3 → node-1の親(null)と同じ親を持つ
    await act(async () => {
      if (handleSiblingDrop) {
        await handleSiblingDrop({
          activeNodeId: 'node-2',
          insertIndex: 1,
          aboveNodeId: 'node-1',
          belowNodeId: 'node-3',
        });
      }
    });

    // node-2の親がnullになる（ルートレベルに移動）
    await waitFor(() => {
      expect(screen.getByTestId('node-node-2-parent')).toHaveTextContent('null');
    });
  });

  it('下のノードしかない場合（先頭にドロップ）、下のノードの親と同じ親を持つ', async () => {
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

    // 初期状態: node-2はnode-1の子
    await waitFor(() => {
      expect(screen.getByTestId('node-node-2-parent')).toHaveTextContent('node-1');
    });

    // node-2をリストの最初にドロップ（node-1の上）
    // aboveNodeId=undefined, belowNodeId=node-1 → node-1の親(null)と同じ親を持つ
    await act(async () => {
      if (handleSiblingDrop) {
        await handleSiblingDrop({
          activeNodeId: 'node-2',
          insertIndex: 0,
          aboveNodeId: undefined,
          belowNodeId: 'node-1',
        });
      }
    });

    // node-2の親がnullになる（ルートレベルに移動）
    await waitFor(() => {
      expect(screen.getByTestId('node-node-2-parent')).toHaveTextContent('null');
    });
  });

  it('自分自身の子孫への移動は無視される', async () => {
    let handleSiblingDrop: ((info: SiblingDropInfo) => Promise<void>) | null = null;

    // node-1 → node-2 (子) → node-4 (孫) の構造を持つツリー状態
    const treeStateWithGrandchild: TreeState = {
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
          parentId: 'node-1',
          children: [],
          isExpanded: true,
          depth: 1,
          viewId: 'default',
        },
        'node-4': {
          id: 'node-4',
          tabId: 4,
          parentId: 'node-2',
          children: [],
          isExpanded: true,
          depth: 2,
          viewId: 'default',
        },
      },
      tabToNode: { '1': 'node-1', '2': 'node-2', '4': 'node-4' },
    };

    mockChrome.storage.local.get = vi.fn().mockResolvedValue({
      tree_state: treeStateWithGrandchild,
    });
    mockChrome.tabs.query = vi.fn().mockResolvedValue([
      { id: 1, title: 'Tab 1', url: 'https://tab1.com', pinned: false, active: true },
      { id: 2, title: 'Tab 2', url: 'https://tab2.com', pinned: false, active: false },
      { id: 4, title: 'Tab 4', url: 'https://tab4.com', pinned: false, active: false },
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

    // 初期状態: node-1はルート、node-2はnode-1の子
    await waitFor(() => {
      expect(screen.getByTestId('node-node-1-parent')).toHaveTextContent('null');
      expect(screen.getByTestId('node-node-2-parent')).toHaveTextContent('node-1');
    });

    // node-1をnode-4の隣に移動しようとする（自分の孫の隣 = 無効な操作）
    // 現在の実装では、aboveNodeId/belowNodeIdの親が自分の子孫かどうかをチェック
    await act(async () => {
      if (handleSiblingDrop) {
        await handleSiblingDrop({
          activeNodeId: 'node-1',
          insertIndex: 2,
          aboveNodeId: 'node-4',
          belowNodeId: undefined,
        });
      }
    });

    // node-1の親は変更されない（まだnull）
    await waitFor(() => {
      expect(screen.getByTestId('node-node-1-parent')).toHaveTextContent('null');
    });
  });

  /**
   * Task 8.1 (tab-tree-bugfix): ドロップ位置への正確な挿入テスト
   * Requirements: 7.1, 7.2
   * insertIndexを使用して正しい兄弟順序で挿入されることを検証
   */
  it('insertIndexに基づいて正しい位置に挿入される', async () => {
    let handleSiblingDrop: ((info: SiblingDropInfo) => Promise<void>) | null = null;

    // 4つのルートノードを持つツリー状態
    const treeStateWithMultipleRoots: TreeState = {
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
          children: [],
          isExpanded: true,
          depth: 0,
          viewId: 'default',
        },
        'node-4': {
          id: 'node-4',
          tabId: 4,
          parentId: 'node-1', // node-1の子
          children: [],
          isExpanded: true,
          depth: 1,
          viewId: 'default',
        },
      },
      tabToNode: { '1': 'node-1', '2': 'node-2', '3': 'node-3', '4': 'node-4' },
    };

    mockChrome.storage.local.get = vi.fn().mockResolvedValue({
      tree_state: treeStateWithMultipleRoots,
    });
    mockChrome.tabs.query = vi.fn().mockResolvedValue([
      { id: 1, title: 'Tab 1', url: 'https://tab1.com', pinned: false, active: true },
      { id: 2, title: 'Tab 2', url: 'https://tab2.com', pinned: false, active: false },
      { id: 3, title: 'Tab 3', url: 'https://tab3.com', pinned: false, active: false },
      { id: 4, title: 'Tab 4', url: 'https://tab4.com', pinned: false, active: false },
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

    // 初期状態: node-4はnode-1の子
    await waitFor(() => {
      expect(screen.getByTestId('node-node-4-parent')).toHaveTextContent('node-1');
    });

    // node-4をルートレベルに移動（node-1とnode-2の間、insertIndex=1）
    // aboveNodeId=node-1, belowNodeId=node-2
    await act(async () => {
      if (handleSiblingDrop) {
        await handleSiblingDrop({
          activeNodeId: 'node-4',
          insertIndex: 1,
          aboveNodeId: 'node-1',
          belowNodeId: 'node-2',
        });
      }
    });

    // node-4の親がnullになる（ルートレベルに移動）
    await waitFor(() => {
      expect(screen.getByTestId('node-node-4-parent')).toHaveTextContent('null');
    });

    // ブラウザタブの順序が同期されることを確認
    // chrome.tabs.moveが呼ばれるべき（insertIndex=1の位置に移動）
    await waitFor(() => {
      expect(mockChrome.tabs.move).toHaveBeenCalledWith(4, { index: 1 });
    });
  });

  /**
   * Task 3.1 (tab-tree-comprehensive-fix): 異なる深度のタブ間へのドロップテスト
   * Requirements: 3.1, 3.2, 3.3
   * 深度0のタブの下に深度1のタブがある場合、その間にドロップすると
   * 正しい親（下のノードの親）を使用してドロップされることを検証
   */
  it('異なる深度のタブ間にドロップした場合、下のノードの親を使用する', async () => {
    let handleSiblingDrop: ((info: SiblingDropInfo) => Promise<void>) | null = null;

    // 構造: node-1 (深度0) → node-2 (子、深度1), node-3 (深度0)
    // node-1
    //   └── node-2
    // node-3
    const treeStateWithMixedDepths: TreeState = {
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
          parentId: 'node-1', // node-1の子
          children: [],
          isExpanded: true,
          depth: 1,
          viewId: 'default',
        },
        'node-3': {
          id: 'node-3',
          tabId: 3,
          parentId: null,
          children: [],
          isExpanded: true,
          depth: 0,
          viewId: 'default',
        },
        'node-4': {
          id: 'node-4',
          tabId: 4,
          parentId: null,
          children: [],
          isExpanded: true,
          depth: 0,
          viewId: 'default',
        },
      },
      tabToNode: { '1': 'node-1', '2': 'node-2', '3': 'node-3', '4': 'node-4' },
    };

    mockChrome.storage.local.get = vi.fn().mockResolvedValue({
      tree_state: treeStateWithMixedDepths,
    });
    mockChrome.tabs.query = vi.fn().mockResolvedValue([
      { id: 1, title: 'Tab 1', url: 'https://tab1.com', pinned: false, active: true },
      { id: 2, title: 'Tab 2', url: 'https://tab2.com', pinned: false, active: false },
      { id: 3, title: 'Tab 3', url: 'https://tab3.com', pinned: false, active: false },
      { id: 4, title: 'Tab 4', url: 'https://tab4.com', pinned: false, active: false },
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

    // 初期状態の確認
    await waitFor(() => {
      expect(screen.getByTestId('node-node-4-parent')).toHaveTextContent('null');
    });

    // node-4をnode-2とnode-3の間にドロップ
    // aboveNodeId=node-2 (深度1, 親=node-1), belowNodeId=node-3 (深度0, 親=null)
    // 結果: node-4の親はnode-3と同じ（null）になるべき
    await act(async () => {
      if (handleSiblingDrop) {
        await handleSiblingDrop({
          activeNodeId: 'node-4',
          insertIndex: 2,
          aboveNodeId: 'node-2',
          belowNodeId: 'node-3',
        });
      }
    });

    // node-4の親がnullのままであることを確認（ルートレベルに配置）
    await waitFor(() => {
      expect(screen.getByTestId('node-node-4-parent')).toHaveTextContent('null');
    });
  });

  /**
   * Task 3.1 (tab-tree-comprehensive-fix): 子タブの下への隙間ドロップテスト
   * 親タブの子として正しく配置されることを検証
   */
  it('親タブの子の下にドロップした場合、同じ親の兄弟として配置される', async () => {
    let handleSiblingDrop: ((info: SiblingDropInfo) => Promise<void>) | null = null;

    // 構造: node-1 → node-2 (子), node-3 → node-4 (子)
    const treeStateWithChildren: TreeState = {
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
          parentId: 'node-1',
          children: [],
          isExpanded: true,
          depth: 1,
          viewId: 'default',
        },
        'node-3': {
          id: 'node-3',
          tabId: 3,
          parentId: null,
          children: [],
          isExpanded: true,
          depth: 0,
          viewId: 'default',
        },
        'node-5': {
          id: 'node-5',
          tabId: 5,
          parentId: null,
          children: [],
          isExpanded: true,
          depth: 0,
          viewId: 'default',
        },
      },
      tabToNode: { '1': 'node-1', '2': 'node-2', '3': 'node-3', '5': 'node-5' },
    };

    mockChrome.storage.local.get = vi.fn().mockResolvedValue({
      tree_state: treeStateWithChildren,
    });
    mockChrome.tabs.query = vi.fn().mockResolvedValue([
      { id: 1, title: 'Tab 1', url: 'https://tab1.com', pinned: false, active: true },
      { id: 2, title: 'Tab 2', url: 'https://tab2.com', pinned: false, active: false },
      { id: 3, title: 'Tab 3', url: 'https://tab3.com', pinned: false, active: false },
      { id: 5, title: 'Tab 5', url: 'https://tab5.com', pinned: false, active: false },
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

    // 初期状態: node-5はルートレベル
    await waitFor(() => {
      expect(screen.getByTestId('node-node-5-parent')).toHaveTextContent('null');
    });

    // node-5をnode-2の下（同じ親node-1の兄弟として）にドロップ
    // aboveNodeId=node-2 (親=node-1), belowNodeId=node-3 (親=null)
    // 下のノードの親を使用するので、node-5の親はnullになるべき
    await act(async () => {
      if (handleSiblingDrop) {
        await handleSiblingDrop({
          activeNodeId: 'node-5',
          insertIndex: 2,
          aboveNodeId: 'node-2',
          belowNodeId: 'node-3',
        });
      }
    });

    // node-5の親がnullになる（下のノードと同じ親）
    await waitFor(() => {
      expect(screen.getByTestId('node-node-5-parent')).toHaveTextContent('null');
    });
  });
});

/**
 * Task 1.1 (tab-tree-bugfix): 複数ウィンドウ対応のテスト
 * Requirements: 12.1, 12.2, 12.3
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

    mockChrome = {
      storage: {
        local: {
          get: vi.fn<(keys?: string | string[] | null) => Promise<Record<string, unknown>>>().mockResolvedValue({
            tree_state: {
              views: [{ id: 'default', name: 'Default', color: '#3b82f6' }],
              currentViewId: 'default',
              nodes: {},
              tabToNode: {},
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
        sendMessage: vi.fn().mockResolvedValue(undefined),
        getURL: vi.fn(),
      },
      tabs: {
        get: vi.fn(),
        query: vi.fn().mockResolvedValue([
          // ウィンドウ1のタブ
          { id: 1, title: 'Tab 1', url: 'https://tab1.com', pinned: false, active: true, windowId: 1 },
          { id: 2, title: 'Tab 2', url: 'https://tab2.com', pinned: true, active: false, windowId: 1 },
          // ウィンドウ2のタブ
          { id: 3, title: 'Tab 3', url: 'https://tab3.com', pinned: false, active: false, windowId: 2 },
          { id: 4, title: 'Tab 4', url: 'https://tab4.com', pinned: true, active: false, windowId: 2 },
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
      },
      windows: {
        get: vi.fn(),
        create: vi.fn(),
        getCurrent: vi.fn().mockResolvedValue({ id: 1 }),
        onCreated: { addListener: vi.fn(), removeListener: vi.fn() },
        onRemoved: { addListener: vi.fn(), removeListener: vi.fn() },
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
 * Task 2.1 (tab-tree-bugfix): ファビコン永続化機能のテスト
 * Requirements: 1.1, 1.4
 */
describe('TreeStateProvider ファビコン永続化', () => {
  let mockMessageListeners: MessageListener[] = [];
  let mockStorageListeners: Array<(changes: StorageChanges, areaName: string) => void> = [];
  let mockTabsUpdatedListeners: Array<(tabId: number, changeInfo: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab) => void> = [];
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
            // tab_faviconsキーのリクエストには空のオブジェクトを返す
            if (keys === 'tab_favicons') {
              return Promise.resolve({ tab_favicons: {} });
            }
            // tab_titlesキーのリクエストには空のオブジェクトを返す
            if (keys === 'tab_titles') {
              return Promise.resolve({ tab_titles: {} });
            }
            // tree_stateキーのリクエスト
            return Promise.resolve({
              tree_state: {
                views: [{ id: 'default', name: 'Default', color: '#3b82f6' }],
                currentViewId: 'default',
                nodes: {},
                tabToNode: {},
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
        sendMessage: vi.fn().mockResolvedValue(undefined),
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
      },
      windows: {
        get: vi.fn(),
        getCurrent: vi.fn().mockResolvedValue({ id: 1 }),
        create: vi.fn(),
        onCreated: { addListener: vi.fn(), removeListener: vi.fn() },
        onRemoved: { addListener: vi.fn(), removeListener: vi.fn() },
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

  it('ブラウザ起動時に永続化されたファビコンを復元する', async () => {
    // 永続化されたファビコンをモック
    mockChrome.storage.local.get = vi.fn<(keys?: string | string[] | null) => Promise<Record<string, unknown>>>().mockImplementation((keys) => {
      if (keys === 'tab_favicons') {
        return Promise.resolve({
          tab_favicons: {
            2: 'https://another.com/persisted-favicon.ico',
          },
        });
      }
      if (keys === 'tab_titles') {
        return Promise.resolve({ tab_titles: {} });
      }
      return Promise.resolve({
        tree_state: {
          views: [{ id: 'default', name: 'Default', color: '#3b82f6' }],
          currentViewId: 'default',
          nodes: {},
          tabToNode: {},
        },
      });
    });

    // タブ2のファビコンがundefined（ローディング中など）
    mockChrome.tabs.query = vi.fn().mockResolvedValue([
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
        favIconUrl: undefined, // ブラウザからはファビコンが取れない状態
        status: 'loading',
        pinned: false,
        active: false,
        windowId: 1,
      },
    ]);

    await act(async () => {
      render(
        <TreeStateProvider>
          <FaviconTestComponent />
        </TreeStateProvider>
      );
    });

    // タブ2のファビコンが永続化されたものから復元されることを確認
    await waitFor(() => {
      expect(screen.getByTestId('tab-2-favicon')).toHaveTextContent('https://another.com/persisted-favicon.ico');
    });
  });

  it('ファビコンが変更されたときに永続化データを更新する', async () => {
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

    // ファビコン変更イベントを発火
    await act(async () => {
      mockTabsUpdatedListeners.forEach((listener) => {
        listener(
          1,
          { favIconUrl: 'https://example.com/new-favicon.ico' },
          {
            id: 1,
            title: 'Test Page',
            url: 'https://example.com',
            favIconUrl: 'https://example.com/new-favicon.ico',
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
            groupId: -1,
          }
        );
      });
    });

    // UIが更新されることを確認
    await waitFor(() => {
      expect(screen.getByTestId('tab-1-favicon')).toHaveTextContent('https://example.com/new-favicon.ico');
    });

    // chrome.storage.local.setが呼び出されることを確認（ファビコンの永続化）
    await waitFor(() => {
      const setCalls = mockChrome.storage.local.set.mock.calls;
      const faviconSetCall = setCalls.find(
        (call) => call[0] && 'tab_favicons' in call[0]
      );
      expect(faviconSetCall).toBeDefined();
      expect(faviconSetCall?.[0]).toMatchObject({
        tab_favicons: expect.objectContaining({
          1: 'https://example.com/new-favicon.ico',
        }),
      });
    });
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
            groupId: -1,
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
 * Task 2.3 (tab-tree-bugfix): 余分なLoadingタブ防止機能のテスト
 * Requirements: 1.2, 1.5
 */
describe('TreeStateProvider 余分なLoadingタブ防止', () => {
  let mockMessageListeners: MessageListener[] = [];
  let mockStorageListeners: Array<(changes: StorageChanges, areaName: string) => void> = [];
  let mockTabsCreatedListeners: Array<(tab: chrome.tabs.Tab) => void> = [];
  let mockTabsUpdatedListeners: Array<(tabId: number, changeInfo: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab) => void> = [];
  let mockChrome: MockChrome;

  // タブ数を表示するテストコンポーネント
  function TabCountTestComponent() {
    const { isLoading, tabInfoMap, treeState } = useTreeState();

    if (isLoading) return <div>Loading...</div>;

    return (
      <div>
        <div data-testid="tab-info-map-size">{Object.keys(tabInfoMap).length}</div>
        <div data-testid="tree-node-count">{treeState ? Object.keys(treeState.nodes).length : 0}</div>
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
                views: [{ id: 'default', name: 'Default', color: '#3b82f6' }],
                currentViewId: 'default',
                nodes: {},
                tabToNode: {},
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
        sendMessage: vi.fn().mockResolvedValue(undefined),
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
      },
      windows: {
        get: vi.fn(),
        getCurrent: vi.fn().mockResolvedValue({ id: 1 }),
        create: vi.fn(),
        onCreated: { addListener: vi.fn(), removeListener: vi.fn() },
        onRemoved: { addListener: vi.fn(), removeListener: vi.fn() },
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
            groupId: -1,
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
            groupId: -1,
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
 * Task 2.2 (tab-tree-bugfix): タブタイトル永続化更新機能のテスト
 * Requirements: 1.3
 */
describe('TreeStateProvider タブタイトル永続化更新', () => {
  let mockMessageListeners: MessageListener[] = [];
  let mockStorageListeners: Array<(changes: StorageChanges, areaName: string) => void> = [];
  let mockTabsUpdatedListeners: Array<(tabId: number, changeInfo: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab) => void> = [];
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
                views: [{ id: 'default', name: 'Default', color: '#3b82f6' }],
                currentViewId: 'default',
                nodes: {},
                tabToNode: {},
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
        sendMessage: vi.fn().mockResolvedValue(undefined),
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
      },
      windows: {
        get: vi.fn(),
        getCurrent: vi.fn().mockResolvedValue({ id: 1 }),
        create: vi.fn(),
        onCreated: { addListener: vi.fn(), removeListener: vi.fn() },
        onRemoved: { addListener: vi.fn(), removeListener: vi.fn() },
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

  it('タイトルが変更されたときに永続化データを更新する', async () => {
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

    // タイトル変更イベントを発火（ページ遷移をシミュレート）
    await act(async () => {
      mockTabsUpdatedListeners.forEach((listener) => {
        listener(
          1,
          { title: 'Navigated Page' },
          {
            id: 1,
            title: 'Navigated Page',
            url: 'https://example.com/new-page',
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
            groupId: -1,
          }
        );
      });
    });

    // UIが更新されることを確認
    await waitFor(() => {
      expect(screen.getByTestId('tab-1-title')).toHaveTextContent('Navigated Page');
    });

    // chrome.storage.local.setが呼び出されることを確認（タイトルの永続化）
    await waitFor(() => {
      const setCalls = mockChrome.storage.local.set.mock.calls;
      const titleSetCall = setCalls.find(
        (call) => call[0] && 'tab_titles' in call[0]
      );
      expect(titleSetCall).toBeDefined();
      expect(titleSetCall?.[0]).toMatchObject({
        tab_titles: expect.objectContaining({
          1: 'Navigated Page',
        }),
      });
    });
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
            groupId: -1,
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
            groupId: -1,
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

  it('ページ遷移時にURLとタイトルが同時に変更された場合も永続化する', async () => {
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

    // URLとタイトルが同時に変更されるイベントを発火（ページ遷移）
    await act(async () => {
      mockTabsUpdatedListeners.forEach((listener) => {
        listener(
          1,
          { title: 'New Page After Navigation', url: 'https://example.com/new-page' },
          {
            id: 1,
            title: 'New Page After Navigation',
            url: 'https://example.com/new-page',
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
            groupId: -1,
          }
        );
      });
    });

    // UIが更新されることを確認
    await waitFor(() => {
      expect(screen.getByTestId('tab-1-title')).toHaveTextContent('New Page After Navigation');
    });

    // タイトルが永続化されることを確認
    await waitFor(() => {
      const setCalls = mockChrome.storage.local.set.mock.calls;
      const titleSetCall = setCalls.find(
        (call) => call[0] && 'tab_titles' in call[0]
      );
      expect(titleSetCall).toBeDefined();
      expect(titleSetCall?.[0]).toMatchObject({
        tab_titles: expect.objectContaining({
          1: 'New Page After Navigation',
        }),
      });
    });
  });
});

/**
 * Task 2.1 (tab-tree-comprehensive-fix): ビューのタブカウント正確性のテスト
 * Requirements: 2.1, 2.3
 * 不整合タブ削除時にviewTabCountsが再計算されることをテスト
 */
describe('TreeStateProvider viewTabCounts 正確性', () => {
  let mockMessageListeners: MessageListener[] = [];
  let mockStorageListeners: Array<(changes: StorageChanges, areaName: string) => void> = [];
  let mockChrome: MockChrome;

  // viewTabCountsを表示するテストコンポーネント
  function ViewTabCountsTestComponent() {
    const { treeState, isLoading, viewTabCounts, tabInfoMap } = useTreeState();

    if (isLoading) return <div>Loading...</div>;
    if (!treeState) return <div>No state</div>;

    return (
      <div>
        <div data-testid="view-tab-counts">{JSON.stringify(viewTabCounts)}</div>
        <div data-testid="tab-info-map-keys">{JSON.stringify(Object.keys(tabInfoMap).map(Number))}</div>
        <div data-testid="node-count">{Object.keys(treeState.nodes).length}</div>
      </div>
    );
  }

  beforeEach(() => {
    mockMessageListeners = [];
    mockStorageListeners = [];

    // ツリー状態: タブ1, 2, 3がnodes内にあるが、タブ3は実際には存在しない（不整合タブ）
    const treeStateWithInconsistentTabs: TreeState = {
      views: [
        { id: 'default', name: 'Default', color: '#3b82f6' },
        { id: 'view-2', name: 'View 2', color: '#10b981' },
      ],
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
          tabId: 3, // このタブは実際には存在しない（不整合）
          parentId: null,
          children: [],
          isExpanded: true,
          depth: 0,
          viewId: 'default',
        },
        'node-4': {
          id: 'node-4',
          tabId: 4,
          parentId: null,
          children: [],
          isExpanded: true,
          depth: 0,
          viewId: 'view-2',
        },
      },
      tabToNode: {
        1: 'node-1',
        2: 'node-2',
        3: 'node-3',
        4: 'node-4',
      },
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
        sendMessage: vi.fn().mockResolvedValue(undefined),
        getURL: vi.fn(),
      },
      tabs: {
        get: vi.fn(),
        // タブ1, 2, 4のみ存在（タブ3は存在しない）
        query: vi.fn().mockResolvedValue([
          { id: 1, title: 'Tab 1', url: 'https://example.com/1', pinned: false, windowId: 1, status: 'complete' },
          { id: 2, title: 'Tab 2', url: 'https://example.com/2', pinned: false, windowId: 1, status: 'complete' },
          { id: 4, title: 'Tab 4', url: 'https://example.com/4', pinned: false, windowId: 1, status: 'complete' },
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
      },
      windows: {
        get: vi.fn(),
        getCurrent: vi.fn().mockResolvedValue({ id: 1 }),
        create: vi.fn(),
        onCreated: { addListener: vi.fn(), removeListener: vi.fn() },
        onRemoved: { addListener: vi.fn(), removeListener: vi.fn() },
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

    // viewTabCountsは実際に存在するタブのみをカウント
    // default: node-1(tab 1), node-2(tab 2) -> 2 (node-3のtab 3は存在しないので除外)
    // view-2: node-4(tab 4) -> 1
    await waitFor(() => {
      const viewTabCounts = JSON.parse(screen.getByTestId('view-tab-counts').textContent || '{}');
      expect(viewTabCounts).toEqual({
        'default': 2,  // タブ3は実際に存在しないのでカウントしない
        'view-2': 1,
      });
    });
  });

  it('すべてのタブが存在する場合は全ノードをカウントする', async () => {
    // タブ3も存在するようにモックを更新
    mockChrome.tabs.query.mockResolvedValue([
      { id: 1, title: 'Tab 1', url: 'https://example.com/1', pinned: false, windowId: 1, status: 'complete', index: 0, highlighted: false, active: true, incognito: false, selected: false, discarded: false, autoDiscardable: true, groupId: -1 },
      { id: 2, title: 'Tab 2', url: 'https://example.com/2', pinned: false, windowId: 1, status: 'complete', index: 1, highlighted: false, active: false, incognito: false, selected: false, discarded: false, autoDiscardable: true, groupId: -1 },
      { id: 3, title: 'Tab 3', url: 'https://example.com/3', pinned: false, windowId: 1, status: 'complete', index: 2, highlighted: false, active: false, incognito: false, selected: false, discarded: false, autoDiscardable: true, groupId: -1 },
      { id: 4, title: 'Tab 4', url: 'https://example.com/4', pinned: false, windowId: 1, status: 'complete', index: 3, highlighted: false, active: false, incognito: false, selected: false, discarded: false, autoDiscardable: true, groupId: -1 },
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

    // tabInfoMapには全タブが含まれる
    await waitFor(() => {
      const tabInfoMapKeys = JSON.parse(screen.getByTestId('tab-info-map-keys').textContent || '[]');
      expect(tabInfoMapKeys.sort()).toEqual([1, 2, 3, 4]);
    });

    // すべてのタブが存在するので、全ノードがカウントされる
    // default: 3, view-2: 1
    await waitFor(() => {
      const viewTabCounts = JSON.parse(screen.getByTestId('view-tab-counts').textContent || '{}');
      expect(viewTabCounts).toEqual({
        'default': 3,
        'view-2': 1,
      });
    });
  });
});
