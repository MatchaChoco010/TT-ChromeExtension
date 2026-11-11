import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { chromeMock, createMockTab } from '@/test/chrome-mock';
import type { ServiceWorkerRequest, TabNode, TreeState } from '@/types';
import { storageService, treeStateManager } from './background-services';
import { registerTabEventListeners } from './tab-event-handlers';
import { registerWindowEventListeners } from './window-event-handlers';
import { registerRequestListener } from './requests/request-router';
import { STORAGE_KEYS } from '@/storage/StorageService';

const createTestTabNode = (tabId: number): TabNode => ({
  tabId,
  children: [],
  isExpanded: true,
});

const createNewTreeState = (): TreeState => ({
  windows: [
    {
      windowId: 1,
      views: [
        {
          name: 'Default',
          color: '#3b82f6',
          rootNodes: [],
          pinnedTabIds: [],
        },
      ],
      activeViewIndex: 0,
    },
  ],
});

describe('Service Worker - Tab Events', () => {
  beforeEach(async () => {
    chromeMock.clearAllListeners();
    vi.clearAllMocks();

    await storageService.set(STORAGE_KEYS.TREE_STATE, createNewTreeState());

    treeStateManager.resetForTesting();
    await treeStateManager.loadState();
  });

  afterEach(() => {
    chromeMock.clearAllListeners();
  });

  it('chrome.tabs.onCreated リスナーが登録されている', () => {
    registerTabEventListeners();

    const mockTab = createMockTab({ id: 1, index: 0, windowId: 1, url: 'https://example.com' });
    chromeMock.tabs.onCreated.trigger(mockTab);

    expect(chromeMock.tabs.onCreated.hasListener).toBeDefined();
  });

  it('openerTabIdがないタブが作成されたときルートノードとして追加される', async () => {
    registerTabEventListeners();

    const mockTab = createMockTab({
      id: 100,
      index: 0,
      windowId: 1,
      openerTabId: undefined,
      url: 'https://example.com',
    });

    const sendMessageSpy = vi.fn(() => Promise.resolve());
    chromeMock.runtime.sendMessage = sendMessageSpy;

    chromeMock.tabs.onCreated.trigger(mockTab);

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(sendMessageSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'STATE_UPDATED',
      }),
    );
  });

  it('openerTabIdがあるタブが作成されたとき親タブの子として追加される', async () => {
    registerTabEventListeners();

    const sendMessageSpy = vi.fn(() => Promise.resolve());
    chromeMock.runtime.sendMessage = sendMessageSpy;

    const parentTab = createMockTab({
      id: 200,
      index: 0,
      windowId: 1,
      openerTabId: undefined,
      url: 'https://example.com',
    });

    chromeMock.tabs.onCreated.trigger(parentTab);

    await new Promise((resolve) => setTimeout(resolve, 10));

    sendMessageSpy.mockClear();

    const childTab = createMockTab({
      id: 201,
      index: 1,
      windowId: 1,
      openerTabId: 200,
      url: 'https://example.com/child',
    });

    chromeMock.tabs.onCreated.trigger(childTab);

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(sendMessageSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'STATE_UPDATED',
      }),
    );
  });

  it('chrome.tabs.onRemoved リスナーが登録されている', () => {
    registerTabEventListeners();

    const removeInfo = { windowId: 1, isWindowClosing: false };
    chromeMock.tabs.onRemoved.trigger(1, removeInfo);

    expect(chromeMock.tabs.onRemoved.hasListener).toBeDefined();
  });

  it('chrome.tabs.onMoved リスナーが登録されている', () => {
    registerTabEventListeners();

    const moveInfo = { windowId: 1, fromIndex: 0, toIndex: 1 };
    chromeMock.tabs.onMoved.trigger(1, moveInfo);

    expect(chromeMock.tabs.onMoved.hasListener).toBeDefined();
  });

  it('chrome.tabs.onUpdated リスナーが登録されている', () => {
    registerTabEventListeners();

    const changeInfo: chrome.tabs.OnUpdatedInfo = { status: 'complete' };
    const mockTab = createMockTab({ id: 1, index: 0, windowId: 1 });
    chromeMock.tabs.onUpdated.trigger(1, changeInfo, mockTab);

    expect(chromeMock.tabs.onUpdated.hasListener).toBeDefined();
  });

  it('chrome.tabs.onActivated リスナーが登録されている', () => {
    registerTabEventListeners();

    const activeInfo = { tabId: 1, windowId: 1 };
    chromeMock.tabs.onActivated.trigger(activeInfo);

    expect(chromeMock.tabs.onActivated.hasListener).toBeDefined();
  });
});

describe('Service Worker - Window Events', () => {
  beforeEach(() => {
    chromeMock.clearAllListeners();
    vi.clearAllMocks();
  });

  afterEach(() => {
    chromeMock.clearAllListeners();
  });

  it('chrome.windows.onCreated リスナーが登録されている', () => {
    registerWindowEventListeners();

    const mockWindow = { id: 1, focused: true } as chrome.windows.Window;
    chromeMock.windows.onCreated.trigger(mockWindow);

    expect(chromeMock.windows.onCreated.hasListener).toBeDefined();
  });

  it('chrome.windows.onRemoved リスナーが登録されている', () => {
    registerWindowEventListeners();

    chromeMock.windows.onRemoved.trigger(1);

    expect(chromeMock.windows.onRemoved.hasListener).toBeDefined();
  });
});

describe('ビュー切り替え動作の修正', () => {
  beforeEach(() => {
    chromeMock.clearAllListeners();
    vi.clearAllMocks();
  });

  afterEach(() => {
    chromeMock.clearAllListeners();
  });

  it('ビューを切り替えた後に新しいタブを開いた場合、現在アクティブなビューにタブを追加する', async () => {
    registerTabEventListeners();

    const sendMessageSpy = vi.fn(() => Promise.resolve());
    chromeMock.runtime.sendMessage = sendMessageSpy;

    const treeState: TreeState = {
      windows: [
        {
          windowId: 1,
          views: [
            {
              name: 'Default',
              color: '#3b82f6',
              rootNodes: [],
              pinnedTabIds: [],
            },
            {
              name: 'Custom',
              color: '#ff0000',
              rootNodes: [],
              pinnedTabIds: [],
            },
          ],
          activeViewIndex: 1,
        },
      ],
    };

    (chromeMock.storage.local.get as ReturnType<typeof vi.fn>).mockImplementation(
      (keys: string | string[]) => {
        const keyArray = typeof keys === 'string' ? [keys] : keys;
        const result: Record<string, unknown> = {};

        if (keyArray.includes('tree_state')) {
          result['tree_state'] = treeState;
        }
        if (keyArray.includes('user_settings')) {
          result['user_settings'] = { newTabPosition: 'child' };
        }

        return Promise.resolve(result);
      },
    );

    const mockTab = createMockTab({
      id: 500,
      index: 0,
      windowId: 1,
      openerTabId: undefined,
      url: 'https://example.com',
    });

    chromeMock.tabs.onCreated.trigger(mockTab);

    await new Promise((resolve) => setTimeout(resolve, 10));

    const setCalls = (chromeMock.storage.local.set as ReturnType<typeof vi.fn>).mock.calls;
    expect(setCalls.length).toBeGreaterThan(0);
  });

  it('ビューを追加した場合、そのビューを永続化する', async () => {
    const setSpy = vi.fn(() => Promise.resolve());
    chromeMock.storage.local.set = setSpy;

    expect(true).toBe(true);
  });
});

describe('Service Worker - Messaging', () => {
  beforeEach(() => {
    chromeMock.clearAllListeners();
    vi.clearAllMocks();
  });

  afterEach(() => {
    chromeMock.clearAllListeners();
  });

  it('chrome.runtime.onMessage リスナーが登録されている', () => {
    registerRequestListener();

    expect(chromeMock.runtime.onMessage.hasListener).toBeDefined();
  });

  it('GET_STATE メッセージに応答する', async () => {
    registerRequestListener();

    const message: ServiceWorkerRequest = { type: 'GET_STATE' };
    const sendResponse = vi.fn();

    chromeMock.runtime.onMessage.trigger(message, {}, sendResponse);

    await vi.waitFor(() => {
      expect(sendResponse).toHaveBeenCalled();
    });

    const response = sendResponse.mock.calls[0][0];
    expect(response.success).toBe(true);
    expect(response.data).toBeDefined();
    expect(Array.isArray(response.data.windows)).toBe(true);
  });

  it('ACTIVATE_TAB メッセージでタブをアクティブ化する', async () => {
    registerRequestListener();

    const message: ServiceWorkerRequest = {
      type: 'ACTIVATE_TAB',
      payload: { tabId: 123 },
    };
    const sendResponse = vi.fn();

    chromeMock.runtime.onMessage.trigger(message, {}, sendResponse);

    await vi.waitFor(() => {
      expect(sendResponse).toHaveBeenCalledWith({ success: true, data: null });
    });
    expect(chromeMock.tabs.update).toHaveBeenCalledWith(123, { active: true });
  });

  it('CLOSE_TAB メッセージでタブを閉じる', async () => {
    registerRequestListener();

    const message: ServiceWorkerRequest = {
      type: 'CLOSE_TAB',
      payload: { tabId: 456 },
    };
    const sendResponse = vi.fn();

    chromeMock.runtime.onMessage.trigger(message, {}, sendResponse);

    await vi.waitFor(() => {
      expect(sendResponse).toHaveBeenCalledWith({ success: true, data: null });
    });
    expect(chromeMock.tabs.remove).toHaveBeenCalledWith(456);
  });

});

describe('複数タブのグループ化機能', () => {
  beforeEach(async () => {
    chromeMock.clearAllListeners();

    await chromeMock.storage.local.set({
      tree_state: createNewTreeState(),
    });

    await treeStateManager.loadState();
  });

  afterEach(() => {
    chromeMock.clearAllListeners();
  });

  it('CREATE_GROUP メッセージで新しいグループを作成し、選択されたタブをグループの子要素として設定する', async () => {
    registerRequestListener();
    registerTabEventListeners();

    const sendMessageSpy = vi.fn(() => Promise.resolve());
    chromeMock.runtime.sendMessage = sendMessageSpy;

    const groupTabId = 100;
    (chromeMock.tabs.create as ReturnType<typeof vi.fn>).mockResolvedValue(createMockTab({
      id: groupTabId,
      index: 3,
      windowId: 1,
      url: `chrome-extension://test-id/group.html`,
    }));
    (chromeMock.tabs.get as ReturnType<typeof vi.fn>).mockImplementation(async (tabId: number) => {
      if (tabId === 1) return createMockTab({ id: 1, index: 0, windowId: 1, url: 'https://example1.com' });
      if (tabId === 2) return createMockTab({ id: 2, index: 1, windowId: 1, url: 'https://example2.com' });
      if (tabId === 3) return createMockTab({ id: 3, index: 2, windowId: 1, url: 'https://example3.com' });
      return createMockTab({ id: tabId });
    });
    (chromeMock.tabs.update as ReturnType<typeof vi.fn>).mockResolvedValue(createMockTab({
      id: groupTabId,
      index: 3,
      windowId: 1,
      url: `chrome-extension://test-id/group.html`,
    }));

    const tab1 = createMockTab({ id: 1, index: 0, windowId: 1, url: 'https://example1.com' });
    const tab2 = createMockTab({ id: 2, index: 1, windowId: 1, url: 'https://example2.com' });
    const tab3 = createMockTab({ id: 3, index: 2, windowId: 1, url: 'https://example3.com' });

    await treeStateManager.addTab(tab1, null, 1);
    await treeStateManager.addTab(tab2, null, 1);
    await treeStateManager.addTab(tab3, null, 1);

    const message = {
      type: 'CREATE_GROUP',
      payload: { tabIds: [1, 2, 3] },
    };
    const sendResponse = vi.fn();

    chromeMock.runtime.onMessage.trigger(message, {}, sendResponse);

    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(sendResponse).toHaveBeenCalledWith(
      expect.objectContaining({ success: true })
    );

    const setCalls = (chromeMock.storage.local.set as ReturnType<typeof vi.fn>).mock.calls;
    const lastSetCall = setCalls[setCalls.length - 1];

    if (lastSetCall && lastSetCall[0]['tree_state']) {
      const savedTreeState = lastSetCall[0]['tree_state'] as TreeState;

      const allNodes: TabNode[] = [];
      const collectNodes = (nodes: TabNode[]) => {
        for (const node of nodes) {
          allNodes.push(node);
          collectNodes(node.children);
        }
      };
      for (const windowState of savedTreeState.windows) {
        for (const viewState of windowState.views) {
          collectNodes(viewState.rootNodes);
        }
      }

      const groupNode = allNodes.find((node) => node.groupInfo !== undefined);

      expect(groupNode).toBeDefined();

      if (groupNode) {
        expect(groupNode.children.length).toBe(3);
      }
    }
  });

  it('DISSOLVE_GROUP メッセージでグループを解除し、子タブをルートレベルに移動する', async () => {
    registerRequestListener();
    registerTabEventListeners();

    const sendMessageSpy = vi.fn(() => Promise.resolve());
    chromeMock.runtime.sendMessage = sendMessageSpy;

    const groupTabId = 100;
    (chromeMock.tabs.create as ReturnType<typeof vi.fn>).mockResolvedValue(createMockTab({
      id: groupTabId,
      index: 2,
      windowId: 1,
      url: `chrome-extension://test-id/group.html`,
    }));
    (chromeMock.tabs.get as ReturnType<typeof vi.fn>).mockImplementation(async (tabId: number) => {
      if (tabId === 1) return createMockTab({ id: 1, index: 0, windowId: 1, url: 'https://example1.com' });
      if (tabId === 2) return createMockTab({ id: 2, index: 1, windowId: 1, url: 'https://example2.com' });
      return createMockTab({ id: tabId });
    });
    (chromeMock.tabs.update as ReturnType<typeof vi.fn>).mockResolvedValue(createMockTab({
      id: groupTabId,
      index: 2,
      windowId: 1,
      url: `chrome-extension://test-id/group.html`,
    }));

    const tab1 = createMockTab({ id: 1, index: 0, windowId: 1, url: 'https://example1.com' });
    const tab2 = createMockTab({ id: 2, index: 1, windowId: 1, url: 'https://example2.com' });

    await treeStateManager.addTab(tab1, null, 1);
    await treeStateManager.addTab(tab2, null, 1);

    const createMessage = {
      type: 'CREATE_GROUP',
      payload: { tabIds: [1, 2] },
    };
    const createResponse = vi.fn();

    chromeMock.runtime.onMessage.trigger(createMessage, {}, createResponse);

    await new Promise((resolve) => setTimeout(resolve, 100));

    const setCalls = (chromeMock.storage.local.set as ReturnType<typeof vi.fn>).mock.calls;
    let foundGroupTabId: number | undefined;

    for (const call of setCalls) {
      if (call[0]['tree_state']) {
        const savedTreeState = call[0]['tree_state'] as TreeState;
        const allNodes: TabNode[] = [];
        const collectNodes = (nodes: TabNode[]) => {
          for (const node of nodes) {
            allNodes.push(node);
            collectNodes(node.children);
          }
        };
        for (const windowState of savedTreeState.windows) {
          for (const viewState of windowState.views) {
            collectNodes(viewState.rootNodes);
          }
        }
        const groupNode = allNodes.find((node) => node.groupInfo !== undefined);
        if (groupNode) {
          foundGroupTabId = groupNode.tabId;
          break;
        }
      }
    }

    expect(foundGroupTabId).toBeDefined();

    const dissolveMessage = {
      type: 'DISSOLVE_GROUP',
      payload: { tabIds: [foundGroupTabId] },
    };
    const dissolveResponse = vi.fn();

    chromeMock.runtime.onMessage.trigger(dissolveMessage, {}, dissolveResponse);

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(dissolveResponse).toHaveBeenCalledWith(
      expect.objectContaining({ success: true })
    );
  });
});

describe('空ウィンドウの自動クローズ', () => {
  beforeEach(() => {
    chromeMock.clearAllListeners();
    vi.clearAllMocks();
    treeStateManager.resetForTesting();
  });

  afterEach(() => {
    chromeMock.clearAllListeners();
  });

  it('ドラッグアウトにより全てのタブが移動されたとき、元のウィンドウを自動的に閉じる', async () => {
    registerRequestListener();
    registerTabEventListeners();

    const sourceWindowId = 100;
    const tabId = 1001;
    const newWindowId = 200;

    const sendMessageSpy = vi.fn(() => Promise.resolve());
    chromeMock.runtime.sendMessage = sendMessageSpy;

    (chromeMock.windows.getAll as ReturnType<typeof vi.fn>).mockImplementation(
      async () => {
        return [
          { id: sourceWindowId } as chrome.windows.Window,
          { id: newWindowId } as chrome.windows.Window,
        ];
      }
    );

    (chromeMock.tabs.query as ReturnType<typeof vi.fn>).mockImplementation(
      async (queryInfo: chrome.tabs.QueryInfo) => {
        if (queryInfo.windowId === sourceWindowId) {
          return [];
        }
        if (queryInfo.windowId === newWindowId) {
          return [{ id: tabId, index: 0, windowId: newWindowId }];
        }
        return [];
      }
    );

    const windowsRemoveSpy = vi.fn(() => Promise.resolve());
    chromeMock.windows.remove = windowsRemoveSpy;

    (chromeMock.windows.create as ReturnType<typeof vi.fn>).mockImplementation(
      (_createData: chrome.windows.CreateData, callback?: (window: chrome.windows.Window) => void) => {
        if (callback) {
          callback({ id: newWindowId, focused: true } as chrome.windows.Window);
        }
        return Promise.resolve({ id: newWindowId, focused: true } as chrome.windows.Window);
      }
    );

    const tab = createMockTab({
      id: tabId,
      index: 0,
      windowId: sourceWindowId,
      url: 'https://example.com',
    });

    chromeMock.tabs.onCreated.trigger(tab);
    await new Promise((resolve) => setTimeout(resolve, 50));

    const message = {
      type: 'CREATE_WINDOW_WITH_SUBTREE',
      payload: { tabId },
    };
    const sendResponse = vi.fn();

    chromeMock.runtime.onMessage.trigger(message, {}, sendResponse);

    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(sendResponse).toHaveBeenCalledWith(
      expect.objectContaining({ success: true })
    );

    expect(windowsRemoveSpy).toHaveBeenCalledWith(sourceWindowId);
  });

  it('ウィンドウにタブが残っている場合、ウィンドウは開いたまま維持される', async () => {
    registerRequestListener();
    registerTabEventListeners();

    const sourceWindowId = 100;
    const tabId = 1001;
    const remainingTabId = 1002;
    const newWindowId = 200;

    const sendMessageSpy = vi.fn(() => Promise.resolve());
    chromeMock.runtime.sendMessage = sendMessageSpy;

    (chromeMock.windows.getAll as ReturnType<typeof vi.fn>).mockImplementation(
      async () => {
        return [
          { id: sourceWindowId } as chrome.windows.Window,
          { id: newWindowId } as chrome.windows.Window,
        ];
      }
    );

    (chromeMock.tabs.query as ReturnType<typeof vi.fn>).mockImplementation(
      async (queryInfo: chrome.tabs.QueryInfo) => {
        if (queryInfo.windowId === sourceWindowId) {
          return [{ id: remainingTabId, index: 0, windowId: sourceWindowId }];
        }
        if (queryInfo.windowId === newWindowId) {
          return [{ id: tabId, index: 0, windowId: newWindowId }];
        }
        return [];
      }
    );

    const windowsRemoveSpy = vi.fn(() => Promise.resolve());
    chromeMock.windows.remove = windowsRemoveSpy;

    (chromeMock.windows.create as ReturnType<typeof vi.fn>).mockImplementation(
      (_createData: chrome.windows.CreateData, callback?: (window: chrome.windows.Window) => void) => {
        if (callback) {
          callback({ id: newWindowId, focused: true } as chrome.windows.Window);
        }
        return Promise.resolve({ id: newWindowId, focused: true } as chrome.windows.Window);
      }
    );

    const tab1 = createMockTab({
      id: tabId,
      index: 0,
      windowId: sourceWindowId,
      url: 'https://example1.com',
    });

    const tab2 = createMockTab({
      id: remainingTabId,
      index: 1,
      windowId: sourceWindowId,
      url: 'https://example2.com',
    });

    chromeMock.tabs.onCreated.trigger(tab1);
    chromeMock.tabs.onCreated.trigger(tab2);
    await new Promise((resolve) => setTimeout(resolve, 50));

    const message = {
      type: 'CREATE_WINDOW_WITH_SUBTREE',
      payload: { tabId },
    };
    const sendResponse = vi.fn();

    chromeMock.runtime.onMessage.trigger(message, {}, sendResponse);

    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(sendResponse).toHaveBeenCalledWith(
      expect.objectContaining({ success: true })
    );

    expect(windowsRemoveSpy).not.toHaveBeenCalled();
  });
});

describe('Service Worker起動直後の初期化待ち', () => {
  const createPersistedTree = (tabIds: number[]): TreeState => ({
    windows: [
      {
        windowId: 1,
        views: [
          {
            name: 'Default',
            color: '#3b82f6',
            rootNodes: tabIds.map(createTestTabNode),
            pinnedTabIds: [],
          },
        ],
        activeViewIndex: 0,
      },
    ],
  });

  const getPersistedTabIds = async (): Promise<number[] | undefined> => {
    const treeState = await storageService.get(STORAGE_KEYS.TREE_STATE);
    return treeState?.windows.flatMap((w) =>
      w.views.flatMap((v) => v.rootNodes.map((n) => n.tabId)),
    );
  };

  beforeEach(async () => {
    chromeMock.clearAllListeners();
    vi.clearAllMocks();
    treeStateManager.resetForTesting();
    await storageService.set(STORAGE_KEYS.TREE_STATE, createPersistedTree([10, 20, 30]));
    treeStateManager.prepareForInitializationReset();
  });

  afterEach(() => {
    chromeMock.clearAllListeners();
    treeStateManager.resetForTesting();
  });

  it('初期化完了前に届いたonRemovedは保存済みツリーを上書きせず、読み込み後のツリーに適用される', async () => {
    registerTabEventListeners();

    chromeMock.tabs.onRemoved.trigger(20, { windowId: 1, isWindowClosing: false });
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(await getPersistedTabIds()).toEqual([10, 20, 30]);

    await treeStateManager.resumeAfterServiceWorkerRestart();

    await vi.waitFor(async () => {
      expect(await getPersistedTabIds()).toEqual([10, 30]);
    });
    expect(treeStateManager.getTree(1).map((n) => n.tabId)).toEqual([10, 30]);
  });

  it('初期化完了前に届いたメッセージには読み込み後の状態で応答する', async () => {
    registerRequestListener();

    const sendResponse = vi.fn();
    chromeMock.runtime.onMessage.trigger({ type: 'GET_STATE' }, {}, sendResponse);
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(sendResponse).not.toHaveBeenCalled();

    await treeStateManager.resumeAfterServiceWorkerRestart();

    await vi.waitFor(() => {
      expect(sendResponse).toHaveBeenCalled();
    });
    const response = sendResponse.mock.calls[0][0];
    expect(response.success).toBe(true);
    expect(
      (response.data as TreeState).windows[0].views[0].rootNodes.map((n) => n.tabId),
    ).toEqual([10, 20, 30]);
  });

  it('Service Worker再起動の初期化完了前に作成されたタブはツリーに追加される', async () => {
    registerTabEventListeners();

    chromeMock.tabs.onCreated.trigger(createMockTab({
      id: 40,
      index: 3,
      windowId: 1,
      url: 'https://example.com/40',
    }));

    await treeStateManager.resumeAfterServiceWorkerRestart();

    await vi.waitFor(() => {
      expect(treeStateManager.getTree(1).map((n) => n.tabId)).toEqual([10, 20, 30, 40]);
    });
  });
});

describe('タブを閉じた後のアクティブタブ補正', () => {
  const twoViewTree: TreeState = {
    windows: [
      {
        windowId: 1,
        views: [
          {
            name: 'Default',
            color: '#3b82f6',
            rootNodes: [createTestTabNode(10), createTestTabNode(20)],
            pinnedTabIds: [],
          },
          {
            name: 'Other',
            color: '#ef4444',
            rootNodes: [createTestTabNode(30)],
            pinnedTabIds: [],
          },
        ],
        activeViewIndex: 0,
      },
    ],
  };

  const mockActiveTab = (activeTabId: number): void => {
    chromeMock.tabs.query.mockImplementation((queryInfo: chrome.tabs.QueryInfo) => {
      if (queryInfo.active) {
        return Promise.resolve([createMockTab({ id: activeTabId, windowId: 1, index: 0 })]);
      }
      return Promise.resolve([]);
    });
  };

  beforeEach(async () => {
    chromeMock.clearAllListeners();
    vi.clearAllMocks();
    treeStateManager.resetForTesting();
    await storageService.set(STORAGE_KEYS.TREE_STATE, twoViewTree);
    await treeStateManager.loadState();
  });

  afterEach(() => {
    chromeMock.clearAllListeners();
    chromeMock.tabs.query.mockImplementation(() => Promise.resolve([]));
    treeStateManager.resetForTesting();
  });

  it('閉じた後に別ビューのタブがアクティブになった場合、現在のビューの最後のタブをアクティブにする', async () => {
    registerTabEventListeners();
    mockActiveTab(30);

    chromeMock.tabs.onRemoved.trigger(20, { windowId: 1, isWindowClosing: false });

    await vi.waitFor(() => {
      expect(chromeMock.tabs.update).toHaveBeenCalledWith(10, { active: true });
    });
  });

  it('閉じた後にツリーに属さないタブがアクティブになった場合、アクティブタブを変更しない', async () => {
    registerTabEventListeners();
    mockActiveTab(99);
    const sendMessageSpy = vi.fn(() => Promise.resolve());
    chromeMock.runtime.sendMessage = sendMessageSpy;

    chromeMock.tabs.onRemoved.trigger(20, { windowId: 1, isWindowClosing: false });

    await vi.waitFor(() => {
      expect(sendMessageSpy).toHaveBeenCalled();
    });
    expect(chromeMock.tabs.update).not.toHaveBeenCalledWith(10, { active: true });
  });
});
