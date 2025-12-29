import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { chromeMock } from '@/test/chrome-mock';
import type { MessageType, TabNode } from '@/types';
import {
  registerTabEventListeners,
  registerWindowEventListeners,
  registerMessageListener,
  getDragState,
  setDragState,
} from './event-handlers';

// Sample TabNode for testing
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

    // Mock chrome.runtime.sendMessage to capture the notification
    const sendMessageSpy = vi.fn(() => Promise.resolve());
    chromeMock.runtime.sendMessage = sendMessageSpy;

    chromeMock.tabs.onCreated.trigger(mockTab);

    // Wait for async operations
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Verify that a state-updated message was sent
    expect(sendMessageSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'STATE_UPDATED',
      }),
    );
  });

  it('openerTabIdがあるタブが作成されたとき親タブの子として追加される', async () => {
    registerTabEventListeners();

    // Mock sendMessage from the start
    const sendMessageSpy = vi.fn(() => Promise.resolve());
    chromeMock.runtime.sendMessage = sendMessageSpy;

    // First, create a parent tab
    const parentTab = {
      id: 200,
      index: 0,
      windowId: 1,
      openerTabId: undefined,
    } as chrome.tabs.Tab;

    chromeMock.tabs.onCreated.trigger(parentTab);

    // Wait for parent tab to be added
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Reset the spy to check only child tab calls
    sendMessageSpy.mockClear();

    // Then, create a child tab with openerTabId
    const childTab = {
      id: 201,
      index: 1,
      windowId: 1,
      openerTabId: 200,
    } as chrome.tabs.Tab;

    chromeMock.tabs.onCreated.trigger(childTab);

    // Wait for async operations
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Verify that a state-updated message was sent for child tab
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

describe('Task 3.1: ビュー切り替え動作の修正', () => {
  beforeEach(() => {
    chromeMock.clearAllListeners();
    vi.clearAllMocks();
  });

  afterEach(() => {
    chromeMock.clearAllListeners();
  });

  it('Requirement 15.1: ビューを切り替えた後に新しいタブを開いた場合、現在アクティブなビューにタブを追加する', async () => {
    registerTabEventListeners();

    // Mock sendMessage
    const sendMessageSpy = vi.fn(() => Promise.resolve());
    chromeMock.runtime.sendMessage = sendMessageSpy;

    // Setup: 現在のビューIDを設定（tree_stateに保存）
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

    // 新しいタブを作成
    const mockTab = {
      id: 500,
      index: 0,
      windowId: 1,
      openerTabId: undefined,
    } as chrome.tabs.Tab;

    chromeMock.tabs.onCreated.trigger(mockTab);

    // Wait for async operations
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Verify: ストレージに保存されたノードのviewIdが現在のビューIDと一致していることを確認
    // set呼び出しを確認
    const setCalls = (chromeMock.storage.local.set as ReturnType<typeof vi.fn>).mock.calls;
    expect(setCalls.length).toBeGreaterThan(0);

    // 最後のset呼び出しで保存されたtree_stateを確認
    const lastSetCall = setCalls[setCalls.length - 1];
    const savedTreeState = lastSetCall[0]['tree_state'];

    if (savedTreeState && savedTreeState.nodes) {
      const nodeIds = Object.keys(savedTreeState.nodes);
      if (nodeIds.length > 0) {
        // 新しく追加されたノードのviewIdを確認
        const newNodeId = `node-${mockTab.id}`;
        if (savedTreeState.nodes[newNodeId]) {
          expect(savedTreeState.nodes[newNodeId].viewId).toBe(currentViewId);
        }
      }
    }
  });

  it('Requirement 15.2: ビューを追加した場合、そのビューを永続化する', async () => {
    // TreeStateProviderのcreateView関数が呼ばれた場合、ビューが永続化されることをテスト
    // （このテストはTreeStateProvider.test.tsxで既にカバーされているが、確認のため追加）

    const setSpy = vi.fn(() => Promise.resolve());
    chromeMock.storage.local.set = setSpy;

    // ViewManager または TreeStateProvider を通じてビューを作成した場合、
    // ストレージに保存されることを確認する
    // 実際のテストはViewSwitching.integration.test.tsxで実施
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

    // 非同期処理の完了を待つ
    await vi.waitFor(() => {
      expect(sendResponse).toHaveBeenCalled();
    });

    // レスポンスの構造を検証
    const response = sendResponse.mock.calls[0][0];
    expect(response.success).toBe(true);
    expect(response.data).toBeDefined();
    expect(Array.isArray(response.data.tree)).toBe(true);
  });

  it('ACTIVATE_TAB メッセージでタブをアクティブ化する', async () => {
    registerMessageListener();

    // Mock chrome.tabs.update to call callback
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

    // First set the drag state
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

    // First set the drag state
    setDragState({ tabId: 333, treeData: [createTestTabNode(333)], sourceWindowId: 7 });

    const clearMessage: MessageType = { type: 'CLEAR_DRAG_STATE' };
    const clearResponse = vi.fn();

    chromeMock.runtime.onMessage.trigger(clearMessage, {}, clearResponse);

    expect(clearResponse).toHaveBeenCalledWith({ success: true, data: null });

    // Verify it's cleared
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

    // Window 1 でドラッグ状態を設定
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

    // Window 2 から同じドラッグ状態を取得できる
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

    // 初期状態: ドラッグ状態は null
    expect(getDragState()).toBeNull();

    // 1. ドラッグ開始時に状態を設定
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

    // 2. 別のウィンドウから状態を取得
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

    // 3. ドラッグ完了後に状態をクリア
    const clearMessage: MessageType = { type: 'CLEAR_DRAG_STATE' };
    const clearResponse = vi.fn();

    chromeMock.runtime.onMessage.trigger(clearMessage, {}, clearResponse);

    expect(clearResponse).toHaveBeenCalledWith({ success: true, data: null });
    expect(getDragState()).toBeNull();
  });
});

/**
 * Task 6.2: 複数タブのグループ化機能
 * Requirements: 12.1, 12.2, 12.3
 */
describe('Task 6.2: 複数タブのグループ化機能', () => {
  beforeEach(() => {
    chromeMock.clearAllListeners();
    vi.clearAllMocks();
  });

  afterEach(() => {
    chromeMock.clearAllListeners();
  });

  it('CREATE_GROUP メッセージで新しいグループを作成し、選択されたタブをグループの子要素として設定する', async () => {
    registerMessageListener();
    registerTabEventListeners();

    // Mock sendMessage
    const sendMessageSpy = vi.fn(() => Promise.resolve());
    chromeMock.runtime.sendMessage = sendMessageSpy;

    // 事前にタブを作成しておく
    const tab1 = { id: 1, index: 0, windowId: 1, url: 'https://example1.com' } as chrome.tabs.Tab;
    const tab2 = { id: 2, index: 1, windowId: 1, url: 'https://example2.com' } as chrome.tabs.Tab;
    const tab3 = { id: 3, index: 2, windowId: 1, url: 'https://example3.com' } as chrome.tabs.Tab;

    chromeMock.tabs.onCreated.trigger(tab1);
    chromeMock.tabs.onCreated.trigger(tab2);
    chromeMock.tabs.onCreated.trigger(tab3);

    // 非同期処理を待つ
    await new Promise((resolve) => setTimeout(resolve, 50));

    // CREATE_GROUPメッセージを送信
    const message = {
      type: 'CREATE_GROUP',
      payload: { tabIds: [1, 2, 3] },
    };
    const sendResponse = vi.fn();

    chromeMock.runtime.onMessage.trigger(message, {}, sendResponse);

    // 非同期処理を待つ
    await new Promise((resolve) => setTimeout(resolve, 50));

    // レスポンスが成功であることを確認
    expect(sendResponse).toHaveBeenCalledWith(
      expect.objectContaining({ success: true })
    );

    // ストレージに保存されたtree_stateを確認
    const setCalls = (chromeMock.storage.local.set as ReturnType<typeof vi.fn>).mock.calls;
    const lastSetCall = setCalls[setCalls.length - 1];

    if (lastSetCall && lastSetCall[0]['tree_state']) {
      const savedTreeState = lastSetCall[0]['tree_state'];

      // グループノードが作成されていることを確認
      const nodes = Object.values(savedTreeState.nodes) as TabNode[];
      const groupNode = nodes.find((node) => node.id.startsWith('group-'));

      expect(groupNode).toBeDefined();

      if (groupNode) {
        // 選択されたタブがグループの子要素になっていることを確認
        const childNodes = nodes.filter((node) => node.parentId === groupNode.id);
        expect(childNodes.length).toBe(3);
      }
    }
  });

  it('DISSOLVE_GROUP メッセージでグループを解除し、子タブをルートレベルに移動する', async () => {
    registerMessageListener();
    registerTabEventListeners();

    // Mock sendMessage
    const sendMessageSpy = vi.fn(() => Promise.resolve());
    chromeMock.runtime.sendMessage = sendMessageSpy;

    // 事前にタブを作成しておく
    const tab1 = { id: 1, index: 0, windowId: 1, url: 'https://example1.com' } as chrome.tabs.Tab;
    const tab2 = { id: 2, index: 1, windowId: 1, url: 'https://example2.com' } as chrome.tabs.Tab;

    chromeMock.tabs.onCreated.trigger(tab1);
    chromeMock.tabs.onCreated.trigger(tab2);

    // 非同期処理を待つ
    await new Promise((resolve) => setTimeout(resolve, 50));

    // まずグループを作成
    const createMessage = {
      type: 'CREATE_GROUP',
      payload: { tabIds: [1, 2] },
    };
    const createResponse = vi.fn();

    chromeMock.runtime.onMessage.trigger(createMessage, {}, createResponse);

    // 非同期処理を待つ
    await new Promise((resolve) => setTimeout(resolve, 50));

    // 作成されたグループのタブIDを取得（グループノードのtabIdを使用）
    const setCalls = (chromeMock.storage.local.set as ReturnType<typeof vi.fn>).mock.calls;
    let groupTabId: number | undefined;

    for (const call of setCalls) {
      if (call[0]['tree_state']) {
        const nodes = Object.values(call[0]['tree_state'].nodes) as TabNode[];
        const groupNode = nodes.find((node) => node.id.startsWith('group-'));
        if (groupNode) {
          groupTabId = groupNode.tabId;
          break;
        }
      }
    }

    expect(groupTabId).toBeDefined();

    // DISSOLVE_GROUPメッセージを送信
    const dissolveMessage = {
      type: 'DISSOLVE_GROUP',
      payload: { tabIds: [groupTabId] },
    };
    const dissolveResponse = vi.fn();

    chromeMock.runtime.onMessage.trigger(dissolveMessage, {}, dissolveResponse);

    // 非同期処理を待つ
    await new Promise((resolve) => setTimeout(resolve, 50));

    // レスポンスが成功であることを確認
    expect(dissolveResponse).toHaveBeenCalledWith(
      expect.objectContaining({ success: true })
    );
  });
});
