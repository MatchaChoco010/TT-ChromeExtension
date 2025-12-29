/**
 * Task 5.4: TreeStateProvider のリアルタイム更新テスト
 * Requirements: 1.4, 2.1
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { TreeStateProvider, useTreeState } from './TreeStateProvider';
import type { TreeState, StorageChanges } from '@/types';
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
          },
          {
            id: 2,
            title: 'Pinned Page',
            url: 'https://pinned.com',
            favIconUrl: 'https://pinned.com/favicon.ico',
            status: 'complete',
            pinned: true,
            active: false,
          },
          {
            id: 3,
            title: 'Another Pinned Page',
            url: 'https://another-pinned.com',
            favIconUrl: undefined,
            status: 'complete',
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
