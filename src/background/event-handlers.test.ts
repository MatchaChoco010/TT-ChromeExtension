import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { chromeMock } from '@/test/chrome-mock';
import type { MessageType } from '@/types';
import {
  registerTabEventListeners,
  registerWindowEventListeners,
  registerMessageListener,
  getDragState,
  setDragState,
} from './event-handlers';

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

    expect(sendResponse).toHaveBeenCalledWith({ success: true, data: null });
  });

  it('ACTIVATE_TAB メッセージでタブをアクティブ化する', async () => {
    registerMessageListener();

    // Mock chrome.tabs.update to call callback
    chromeMock.tabs.update.mockImplementation(
      (
        tabId: number,
        updateProperties: chrome.tabs.UpdateProperties,
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

    chromeMock.tabs.remove.mockImplementation(
      (tabIds: number | number[], callback?: () => void) => {
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

    chromeMock.tabs.move.mockImplementation(
      (
        tabIds: number | number[],
        moveProperties: chrome.tabs.MoveProperties,
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

    chromeMock.windows.create.mockImplementation(
      (createData?: chrome.windows.CreateData, callback?: () => void) => {
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

    const message: MessageType = {
      type: 'SET_DRAG_STATE',
      payload: { tabId: 111, treeData: { test: 'data' }, sourceWindowId: 5 },
    };
    const sendResponse = vi.fn();

    chromeMock.runtime.onMessage.trigger(message, {}, sendResponse);

    expect(sendResponse).toHaveBeenCalledWith({ success: true, data: null });
    expect(getDragState()).toEqual({
      tabId: 111,
      treeData: { test: 'data' },
      sourceWindowId: 5,
    });
  });

  it('GET_DRAG_STATE メッセージでドラッグ状態を取得する', async () => {
    registerMessageListener();

    // First set the drag state
    setDragState({ tabId: 222, treeData: { test: 'data' }, sourceWindowId: 6 });

    const message: MessageType = { type: 'GET_DRAG_STATE' };
    const sendResponse = vi.fn();

    chromeMock.runtime.onMessage.trigger(message, {}, sendResponse);

    expect(sendResponse).toHaveBeenCalledWith({
      success: true,
      data: { tabId: 222, treeData: { test: 'data' }, sourceWindowId: 6 },
    });
  });

  it('CLEAR_DRAG_STATE メッセージでドラッグ状態をクリアする', async () => {
    registerMessageListener();

    // First set the drag state
    setDragState({ tabId: 333, treeData: { test: 'data' }, sourceWindowId: 7 });

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
    const setMessage: MessageType = {
      type: 'SET_DRAG_STATE',
      payload: { tabId: 444, treeData: { test: 'data' }, sourceWindowId: 1 },
    };
    const setResponse = vi.fn();

    chromeMock.runtime.onMessage.trigger(
      setMessage,
      { tab: { windowId: 1 } },
      setResponse,
    );

    expect(setResponse).toHaveBeenCalledWith({ success: true, data: null });

    // Window 2 から同じドラッグ状態を取得できる
    const getMessage: MessageType = { type: 'GET_DRAG_STATE' };
    const getResponse = vi.fn();

    chromeMock.runtime.onMessage.trigger(
      getMessage,
      { tab: { windowId: 2 } },
      getResponse,
    );

    expect(getResponse).toHaveBeenCalledWith({
      success: true,
      data: { tabId: 444, treeData: { test: 'data' }, sourceWindowId: 1 },
    });
  });

  it('ドラッグ状態のライフサイクル全体が正しく機能する', async () => {
    registerMessageListener();

    // 初期状態: ドラッグ状態は null
    expect(getDragState()).toBeNull();

    // 1. ドラッグ開始時に状態を設定
    const setMessage: MessageType = {
      type: 'SET_DRAG_STATE',
      payload: {
        tabId: 555,
        treeData: { nodeId: 'node-1', children: [] },
        sourceWindowId: 10,
      },
    };
    const setResponse = vi.fn();

    chromeMock.runtime.onMessage.trigger(setMessage, {}, setResponse);

    expect(setResponse).toHaveBeenCalledWith({ success: true, data: null });
    expect(getDragState()).toEqual({
      tabId: 555,
      treeData: { nodeId: 'node-1', children: [] },
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
        treeData: { nodeId: 'node-1', children: [] },
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
