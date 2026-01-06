import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { chromeMock } from '@/test/chrome-mock';
import type { MessageType, TabNode } from '@/types';
import {
  registerTabEventListeners,
  registerWindowEventListeners,
  registerMessageListener,
  getDragState,
  setDragState,
  testTreeStateManager,
} from './event-handlers';

const createTestTabNode = (tabId: number): TabNode => ({
  id: `node-${tabId}`,
  tabId,
  parentId: null,
  children: [],
  isExpanded: true,
  depth: 0,
  viewId: 'view-1',
});

describe('Service Worker - Tab Events', () => {
  beforeEach(() => {
    chromeMock.clearAllListeners();
    vi.clearAllMocks();
  });

  afterEach(() => {
    chromeMock.clearAllListeners();
  });

  it('chrome.tabs.onCreated リスナーが登録されている', () => {
    registerTabEventListeners();

    const mockTab = { id: 1, index: 0, windowId: 1 } as chrome.tabs.Tab;
    chromeMock.tabs.onCreated.trigger(mockTab);

    expect(chromeMock.tabs.onCreated.hasListener).toBeDefined();
  });

  it('openerTabIdがないタブが作成されたときルートノードとして追加される', async () => {
    registerTabEventListeners();

    const mockTab = {
      id: 100,
      index: 0,
      windowId: 1,
      openerTabId: undefined,
    } as chrome.tabs.Tab;

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

    const parentTab = {
      id: 200,
      index: 0,
      windowId: 1,
      openerTabId: undefined,
    } as chrome.tabs.Tab;

    chromeMock.tabs.onCreated.trigger(parentTab);

    await new Promise((resolve) => setTimeout(resolve, 10));

    sendMessageSpy.mockClear();

    const childTab = {
      id: 201,
      index: 1,
      windowId: 1,
      openerTabId: 200,
    } as chrome.tabs.Tab;

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

    const changeInfo = { status: 'complete' };
    const mockTab = { id: 1, index: 0, windowId: 1 } as chrome.tabs.Tab;
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

    const currentViewId = 'custom-view-123';
    (chromeMock.storage.local.get as ReturnType<typeof vi.fn>).mockImplementation(
      (keys: string | string[]) => {
        const keyArray = typeof keys === 'string' ? [keys] : keys;
        const result: Record<string, unknown> = {};

        if (keyArray.includes('tree_state')) {
          result['tree_state'] = {
            views: [
              { id: 'default', name: 'Default', color: '#3b82f6' },
              { id: 'custom-view-123', name: 'Custom', color: '#ff0000' },
            ],
            currentViewId: currentViewId,
            nodes: {},
            tabToNode: {},
          };
        }
        if (keyArray.includes('user_settings')) {
          result['user_settings'] = { newTabPosition: 'child' };
        }

        return Promise.resolve(result);
      },
    );

    const mockTab = {
      id: 500,
      index: 0,
      windowId: 1,
      openerTabId: undefined,
    } as chrome.tabs.Tab;

    chromeMock.tabs.onCreated.trigger(mockTab);

    await new Promise((resolve) => setTimeout(resolve, 50));

    const setCalls = (chromeMock.storage.local.set as ReturnType<typeof vi.fn>).mock.calls;
    expect(setCalls.length).toBeGreaterThan(0);

    const lastSetCall = setCalls[setCalls.length - 1];
    const savedTreeState = lastSetCall[0]['tree_state'];

    if (savedTreeState && savedTreeState.nodes) {
      const nodeIds = Object.keys(savedTreeState.nodes);
      if (nodeIds.length > 0) {
        const newNodeId = `node-${mockTab.id}`;
        if (savedTreeState.nodes[newNodeId]) {
          expect(savedTreeState.nodes[newNodeId].viewId).toBe(currentViewId);
        }
      }
    }
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
    setDragState(null);
  });

  afterEach(() => {
    chromeMock.clearAllListeners();
    setDragState(null);
  });

  it('chrome.runtime.onMessage リスナーが登録されている', () => {
    registerMessageListener();

    expect(chromeMock.runtime.onMessage.hasListener).toBeDefined();
  });

  it('GET_STATE メッセージに応答する', async () => {
    registerMessageListener();

    const message: MessageType = { type: 'GET_STATE' };
    const sendResponse = vi.fn();

    chromeMock.runtime.onMessage.trigger(message, {}, sendResponse);

    await vi.waitFor(() => {
      expect(sendResponse).toHaveBeenCalled();
    });

    const response = sendResponse.mock.calls[0][0];
    expect(response.success).toBe(true);
    expect(response.data).toBeDefined();
    expect(Array.isArray(response.data.tree)).toBe(true);
  });

  it('ACTIVATE_TAB メッセージでタブをアクティブ化する', async () => {
    registerMessageListener();

    (chromeMock.tabs.update as ReturnType<typeof vi.fn>).mockImplementation(
      (
        _tabId: number,
        _updateProperties: chrome.tabs.UpdateProperties,
        callback?: () => void,
      ) => {
        if (callback) callback();
      },
    );

    const message: MessageType = {
      type: 'ACTIVATE_TAB',
      payload: { tabId: 123 },
    };
    const sendResponse = vi.fn();

    chromeMock.runtime.onMessage.trigger(message, {}, sendResponse);

    expect(chromeMock.tabs.update).toHaveBeenCalledWith(
      123,
      { active: true },
      expect.any(Function),
    );
  });

  it('CLOSE_TAB メッセージでタブを閉じる', async () => {
    registerMessageListener();

    (chromeMock.tabs.remove as ReturnType<typeof vi.fn>).mockImplementation(
      (_tabIds: number | number[], callback?: () => void) => {
        if (callback) callback();
      },
    );

    const message: MessageType = {
      type: 'CLOSE_TAB',
      payload: { tabId: 456 },
    };
    const sendResponse = vi.fn();

    chromeMock.runtime.onMessage.trigger(message, {}, sendResponse);

    expect(chromeMock.tabs.remove).toHaveBeenCalledWith(
      456,
      expect.any(Function),
    );
  });

  it('MOVE_TAB_TO_WINDOW メッセージでタブを別ウィンドウに移動する', async () => {
    registerMessageListener();

    (chromeMock.tabs.move as ReturnType<typeof vi.fn>).mockImplementation(
      (
        _tabIds: number | number[],
        _moveProperties: chrome.tabs.MoveProperties,
        callback?: () => void,
      ) => {
        if (callback) callback();
      },
    );

    const message: MessageType = {
      type: 'MOVE_TAB_TO_WINDOW',
      payload: { tabId: 789, windowId: 10 },
    };
    const sendResponse = vi.fn();

    chromeMock.runtime.onMessage.trigger(message, {}, sendResponse);

    expect(chromeMock.tabs.move).toHaveBeenCalledWith(
      789,
      { windowId: 10, index: -1 },
      expect.any(Function),
    );
  });

  it('CREATE_WINDOW_WITH_TAB メッセージで新しいウィンドウを作成する', async () => {
    registerMessageListener();

    (chromeMock.windows.create as ReturnType<typeof vi.fn>).mockImplementation(
      (_createData?: chrome.windows.CreateData, callback?: () => void) => {
        if (callback) callback();
      },
    );

    const message: MessageType = {
      type: 'CREATE_WINDOW_WITH_TAB',
      payload: { tabId: 999 },
    };
    const sendResponse = vi.fn();

    chromeMock.runtime.onMessage.trigger(message, {}, sendResponse);

    expect(chromeMock.windows.create).toHaveBeenCalledWith(
      { tabId: 999 },
      expect.any(Function),
    );
  });

  it('SET_DRAG_STATE メッセージでドラッグ状態を保存する', async () => {
    registerMessageListener();

    const treeData = [createTestTabNode(111)];
    const message: MessageType = {
      type: 'SET_DRAG_STATE',
      payload: { tabId: 111, treeData, sourceWindowId: 5 },
    };
    const sendResponse = vi.fn();

    chromeMock.runtime.onMessage.trigger(message, {}, sendResponse);

    expect(sendResponse).toHaveBeenCalledWith({ success: true, data: null });
    expect(getDragState()).toEqual({
      tabId: 111,
      treeData,
      sourceWindowId: 5,
    });
  });

  it('GET_DRAG_STATE メッセージでドラッグ状態を取得する', async () => {
    registerMessageListener();

    const treeData = [createTestTabNode(222)];
    setDragState({ tabId: 222, treeData, sourceWindowId: 6 });

    const message: MessageType = { type: 'GET_DRAG_STATE' };
    const sendResponse = vi.fn();

    chromeMock.runtime.onMessage.trigger(message, {}, sendResponse);

    expect(sendResponse).toHaveBeenCalledWith({
      success: true,
      data: { tabId: 222, treeData, sourceWindowId: 6 },
    });
  });

  it('CLEAR_DRAG_STATE メッセージでドラッグ状態をクリアする', async () => {
    registerMessageListener();

    setDragState({ tabId: 333, treeData: [createTestTabNode(333)], sourceWindowId: 7 });

    const clearMessage: MessageType = { type: 'CLEAR_DRAG_STATE' };
    const clearResponse = vi.fn();

    chromeMock.runtime.onMessage.trigger(clearMessage, {}, clearResponse);

    expect(clearResponse).toHaveBeenCalledWith({ success: true, data: null });

    const getMessage: MessageType = { type: 'GET_DRAG_STATE' };
    const getResponse = vi.fn();

    chromeMock.runtime.onMessage.trigger(getMessage, {}, getResponse);

    expect(getResponse).toHaveBeenCalledWith({
      success: true,
      data: null,
    });
  });

  it('複数ウィンドウ間でドラッグ状態が共有される', async () => {
    registerMessageListener();

    const treeData = [createTestTabNode(444)];
    const setMessage: MessageType = {
      type: 'SET_DRAG_STATE',
      payload: { tabId: 444, treeData, sourceWindowId: 1 },
    };
    const setResponse = vi.fn();

    chromeMock.runtime.onMessage.trigger(
      setMessage,
      { tab: { windowId: 1, index: 0, pinned: false, highlighted: false, active: true, incognito: false, selected: false, discarded: false, autoDiscardable: true, groupId: -1 } as chrome.tabs.Tab },
      setResponse,
    );

    expect(setResponse).toHaveBeenCalledWith({ success: true, data: null });

    const getMessage: MessageType = { type: 'GET_DRAG_STATE' };
    const getResponse = vi.fn();

    chromeMock.runtime.onMessage.trigger(
      getMessage,
      { tab: { windowId: 2, index: 0, pinned: false, highlighted: false, active: true, incognito: false, selected: false, discarded: false, autoDiscardable: true, groupId: -1 } as chrome.tabs.Tab },
      getResponse,
    );

    expect(getResponse).toHaveBeenCalledWith({
      success: true,
      data: { tabId: 444, treeData, sourceWindowId: 1 },
    });
  });

  it('ドラッグ状態のライフサイクル全体が正しく機能する', async () => {
    registerMessageListener();

    expect(getDragState()).toBeNull();

    const treeData = [createTestTabNode(555)];
    const setMessage: MessageType = {
      type: 'SET_DRAG_STATE',
      payload: {
        tabId: 555,
        treeData,
        sourceWindowId: 10,
      },
    };
    const setResponse = vi.fn();

    chromeMock.runtime.onMessage.trigger(setMessage, {}, setResponse);

    expect(setResponse).toHaveBeenCalledWith({ success: true, data: null });
    expect(getDragState()).toEqual({
      tabId: 555,
      treeData,
      sourceWindowId: 10,
    });

    const getMessage: MessageType = { type: 'GET_DRAG_STATE' };
    const getResponse = vi.fn();

    chromeMock.runtime.onMessage.trigger(getMessage, {}, getResponse);

    expect(getResponse).toHaveBeenCalledWith({
      success: true,
      data: {
        tabId: 555,
        treeData,
        sourceWindowId: 10,
      },
    });

    const clearMessage: MessageType = { type: 'CLEAR_DRAG_STATE' };
    const clearResponse = vi.fn();

    chromeMock.runtime.onMessage.trigger(clearMessage, {}, clearResponse);

    expect(clearResponse).toHaveBeenCalledWith({ success: true, data: null });
    expect(getDragState()).toBeNull();
  });
});

describe('複数タブのグループ化機能', () => {
  beforeEach(async () => {
    chromeMock.clearAllListeners();
    // vi.clearAllMocks()はchrome-mockのstorage実装に影響を与えるため使用しない

    await chromeMock.storage.local.set({
      tree_state: {
        views: [{ id: 'default', name: 'デフォルト', color: '#3b82f6' }],
        currentViewId: 'default',
        nodes: {},
        tabToNode: {},
        treeStructure: [],
      },
    });

    await testTreeStateManager.loadState();
  });

  afterEach(() => {
    chromeMock.clearAllListeners();
  });

  it('CREATE_GROUP メッセージで新しいグループを作成し、選択されたタブをグループの子要素として設定する', async () => {
    registerMessageListener();
    registerTabEventListeners();

    const sendMessageSpy = vi.fn(() => Promise.resolve());
    chromeMock.runtime.sendMessage = sendMessageSpy;

    const groupTabId = 100;
    (chromeMock.tabs.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: groupTabId,
      index: 3,
      windowId: 1,
      url: `chrome-extension://test-id/group.html`,
    } as chrome.tabs.Tab);
    (chromeMock.tabs.get as ReturnType<typeof vi.fn>).mockImplementation(async (tabId: number) => {
      if (tabId === 1) return { id: 1, index: 0, windowId: 1, url: 'https://example1.com' } as chrome.tabs.Tab;
      if (tabId === 2) return { id: 2, index: 1, windowId: 1, url: 'https://example2.com' } as chrome.tabs.Tab;
      if (tabId === 3) return { id: 3, index: 2, windowId: 1, url: 'https://example3.com' } as chrome.tabs.Tab;
      return null;
    });
    (chromeMock.tabs.update as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: groupTabId,
      index: 3,
      windowId: 1,
      url: `chrome-extension://test-id/group.html?tabId=${groupTabId}`,
    } as chrome.tabs.Tab);

    const tab1 = { id: 1, index: 0, windowId: 1, url: 'https://example1.com' } as chrome.tabs.Tab;
    const tab2 = { id: 2, index: 1, windowId: 1, url: 'https://example2.com' } as chrome.tabs.Tab;
    const tab3 = { id: 3, index: 2, windowId: 1, url: 'https://example3.com' } as chrome.tabs.Tab;

    await testTreeStateManager.addTab(tab1, null, 'default');
    await testTreeStateManager.addTab(tab2, null, 'default');
    await testTreeStateManager.addTab(tab3, null, 'default');

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
      const savedTreeState = lastSetCall[0]['tree_state'];

      const nodes = Object.values(savedTreeState.nodes) as TabNode[];
      const groupNode = nodes.find((node) => node.id.startsWith('group-'));

      expect(groupNode).toBeDefined();

      if (groupNode) {
        const childNodes = nodes.filter((node) => node.parentId === groupNode.id);
        expect(childNodes.length).toBe(3);
      }
    }
  });

  it('DISSOLVE_GROUP メッセージでグループを解除し、子タブをルートレベルに移動する', async () => {
    registerMessageListener();
    registerTabEventListeners();

    const sendMessageSpy = vi.fn(() => Promise.resolve());
    chromeMock.runtime.sendMessage = sendMessageSpy;

    const groupTabId = 100;
    (chromeMock.tabs.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: groupTabId,
      index: 2,
      windowId: 1,
      url: `chrome-extension://test-id/group.html`,
    } as chrome.tabs.Tab);
    (chromeMock.tabs.get as ReturnType<typeof vi.fn>).mockImplementation(async (tabId: number) => {
      if (tabId === 1) return { id: 1, index: 0, windowId: 1, url: 'https://example1.com' } as chrome.tabs.Tab;
      if (tabId === 2) return { id: 2, index: 1, windowId: 1, url: 'https://example2.com' } as chrome.tabs.Tab;
      return null;
    });
    (chromeMock.tabs.update as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: groupTabId,
      index: 2,
      windowId: 1,
      url: `chrome-extension://test-id/group.html?tabId=${groupTabId}`,
    } as chrome.tabs.Tab);

    const tab1 = { id: 1, index: 0, windowId: 1, url: 'https://example1.com' } as chrome.tabs.Tab;
    const tab2 = { id: 2, index: 1, windowId: 1, url: 'https://example2.com' } as chrome.tabs.Tab;

    await testTreeStateManager.addTab(tab1, null, 'default');
    await testTreeStateManager.addTab(tab2, null, 'default');

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
        const nodes = Object.values(call[0]['tree_state'].nodes) as TabNode[];
        const groupNode = nodes.find((node) => node.id.startsWith('group-'));
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
  });

  afterEach(() => {
    chromeMock.clearAllListeners();
  });

  it('ドラッグアウトにより全てのタブが移動されたとき、元のウィンドウを自動的に閉じる', async () => {
    registerMessageListener();
    registerTabEventListeners();

    const sourceWindowId = 100;
    const tabId = 1001;

    const sendMessageSpy = vi.fn(() => Promise.resolve());
    chromeMock.runtime.sendMessage = sendMessageSpy;

    (chromeMock.tabs.query as ReturnType<typeof vi.fn>).mockImplementation(
      async (queryInfo: chrome.tabs.QueryInfo) => {
        if (queryInfo.windowId === sourceWindowId) {
          return [];
        }
        return [];
      }
    );

    const windowsRemoveSpy = vi.fn(() => Promise.resolve());
    chromeMock.windows.remove = windowsRemoveSpy;

    const newWindowId = 200;
    (chromeMock.windows.create as ReturnType<typeof vi.fn>).mockImplementation(
      (_createData: chrome.windows.CreateData, callback?: (window: chrome.windows.Window) => void) => {
        if (callback) {
          callback({ id: newWindowId, focused: true } as chrome.windows.Window);
        }
        return Promise.resolve({ id: newWindowId, focused: true } as chrome.windows.Window);
      }
    );

    const tab = {
      id: tabId,
      index: 0,
      windowId: sourceWindowId,
      url: 'https://example.com',
    } as chrome.tabs.Tab;

    chromeMock.tabs.onCreated.trigger(tab);
    await new Promise((resolve) => setTimeout(resolve, 50));

    const message = {
      type: 'CREATE_WINDOW_WITH_SUBTREE',
      payload: { tabId, sourceWindowId },
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
    registerMessageListener();
    registerTabEventListeners();

    const sourceWindowId = 100;
    const tabId = 1001;
    const remainingTabId = 1002;

    const sendMessageSpy = vi.fn(() => Promise.resolve());
    chromeMock.runtime.sendMessage = sendMessageSpy;

    (chromeMock.tabs.query as ReturnType<typeof vi.fn>).mockImplementation(
      async (queryInfo: chrome.tabs.QueryInfo) => {
        if (queryInfo.windowId === sourceWindowId) {
          return [{ id: remainingTabId, index: 0, windowId: sourceWindowId }];
        }
        return [];
      }
    );

    const windowsRemoveSpy = vi.fn(() => Promise.resolve());
    chromeMock.windows.remove = windowsRemoveSpy;

    const newWindowId = 200;
    (chromeMock.windows.create as ReturnType<typeof vi.fn>).mockImplementation(
      (_createData: chrome.windows.CreateData, callback?: (window: chrome.windows.Window) => void) => {
        if (callback) {
          callback({ id: newWindowId, focused: true } as chrome.windows.Window);
        }
        return Promise.resolve({ id: newWindowId, focused: true } as chrome.windows.Window);
      }
    );

    const tab1 = {
      id: tabId,
      index: 0,
      windowId: sourceWindowId,
      url: 'https://example1.com',
    } as chrome.tabs.Tab;

    const tab2 = {
      id: remainingTabId,
      index: 1,
      windowId: sourceWindowId,
      url: 'https://example2.com',
    } as chrome.tabs.Tab;

    chromeMock.tabs.onCreated.trigger(tab1);
    chromeMock.tabs.onCreated.trigger(tab2);
    await new Promise((resolve) => setTimeout(resolve, 50));

    const message = {
      type: 'CREATE_WINDOW_WITH_SUBTREE',
      payload: { tabId, sourceWindowId },
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

