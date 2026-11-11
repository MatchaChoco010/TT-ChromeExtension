/**
 * 拡張ページからService Workerへの要求を、種別ごとの処理に振り分ける
 */
import type {
  MessageResponse,
  ServiceWorkerRequest,
  ServiceWorkerRequestPayload,
  ServiceWorkerRequestType,
  ServiceWorkerResponseData,
} from '@/types';
import { trackHandlerAfterInitialization } from '../handler-tracking';
import { handleGetState, handleMoveNode, handleMoveNodeAsSibling, handleToggleNodeExpand } from './tree-request-handlers';
import {
  handleActivateTab,
  handleCloseTab,
  handleCloseSubtree,
  handleCloseTabsWithCollapsedSubtrees,
  handleCloseOtherTabs,
  handleDuplicateTabs,
  handleDuplicateSubtree,
  handlePinTabs,
  handleUnpinTabs,
  handleReorderPinnedTab,
  handleReloadTabs,
  handleDiscardTabs,
  handleCreateNewTab,
  handleOpenSettingsTab,
} from './tab-request-handlers';
import { handleCreateWindowWithSubtree, handleMoveSubtreeToWindow, handleMoveTabsToNewWindow } from './window-request-handlers';
import {
  handleSwitchView,
  handleCreateView,
  handleDeleteView,
  handleUpdateView,
  handleReorderView,
  handleMoveTabsToView,
} from './view-request-handlers';
import {
  handleCreateGroup,
  handleDissolveGroup,
  handleUpdateGroupName,
  handleGetGroupInfo,
  handleDeleteTreeGroup,
  handleAddTabToTreeGroup,
  handleRemoveTabFromTreeGroup,
  handleSaveGroups,
} from './group-request-handlers';
import { handleCreateSnapshot, handleRestoreSnapshot } from './snapshot-request-handlers';
import { handleSaveUserSettings } from './settings-request-handlers';

type RequestHandlerMap = {
  [K in ServiceWorkerRequestType]: (payload: ServiceWorkerRequestPayload<K>) => Promise<ServiceWorkerResponseData<K>>;
};

const requestHandlers: RequestHandlerMap = {
  GET_STATE: () => handleGetState(),
  MOVE_NODE: (p) => handleMoveNode(p.tabId, p.targetParentTabId, p.selectedTabIds),
  MOVE_NODE_AS_SIBLING: (p) =>
    handleMoveNodeAsSibling(p.tabId, p.aboveTabId, p.belowTabId, p.selectedTabIds, p.targetDepth),
  TOGGLE_NODE_EXPAND: (p) => handleToggleNodeExpand(p.tabId),
  ACTIVATE_TAB: (p) => handleActivateTab(p.tabId),
  CLOSE_TAB: (p) => handleCloseTab(p.tabId),
  CLOSE_SUBTREE: (p) => handleCloseSubtree(p.tabId),
  CLOSE_TABS_WITH_COLLAPSED_SUBTREES: (p) => handleCloseTabsWithCollapsedSubtrees(p.tabIds),
  CLOSE_OTHER_TABS: (p) => handleCloseOtherTabs(p.excludeTabIds),
  DUPLICATE_TABS: (p) => handleDuplicateTabs(p.tabIds),
  DUPLICATE_SUBTREE: (p) => handleDuplicateSubtree(p.tabId),
  PIN_TABS: (p) => handlePinTabs(p.tabIds),
  UNPIN_TABS: (p) => handleUnpinTabs(p.tabIds),
  REORDER_PINNED_TAB: (p) => handleReorderPinnedTab(p.tabId, p.newIndex),
  RELOAD_TABS: (p) => handleReloadTabs(p.tabIds),
  DISCARD_TABS: (p) => handleDiscardTabs(p.tabIds),
  CREATE_NEW_TAB: () => handleCreateNewTab(),
  OPEN_SETTINGS_TAB: () => handleOpenSettingsTab(),
  CREATE_WINDOW_WITH_SUBTREE: (p) => handleCreateWindowWithSubtree(p.tabId),
  MOVE_SUBTREE_TO_WINDOW: (p) => handleMoveSubtreeToWindow(p.tabId, p.windowId),
  MOVE_TABS_TO_NEW_WINDOW: (p) => handleMoveTabsToNewWindow(p.tabIds),
  SWITCH_VIEW: (p) => handleSwitchView(p.viewIndex, p.windowId),
  CREATE_VIEW: (p) => handleCreateView(p.windowId),
  DELETE_VIEW: (p) => handleDeleteView(p.windowId, p.viewIndex),
  UPDATE_VIEW: (p) => handleUpdateView(p.windowId, p.viewIndex, p.updates),
  REORDER_VIEW: (p) => handleReorderView(p.viewIndex, p.newIndex, p.windowId),
  MOVE_TABS_TO_VIEW: (p) => handleMoveTabsToView(p.windowId, p.targetViewIndex, p.tabIds),
  CREATE_GROUP: (p) => handleCreateGroup(p.tabIds, p.groupName, p.contextMenuTabId),
  DISSOLVE_GROUP: (p) => handleDissolveGroup(p.tabIds),
  UPDATE_GROUP_NAME: (p) => handleUpdateGroupName(p.tabId, p.name),
  GET_GROUP_INFO: (p) => handleGetGroupInfo(p.tabId),
  DELETE_TREE_GROUP: (p) => handleDeleteTreeGroup(p.tabId),
  ADD_TAB_TO_TREE_GROUP: (p) => handleAddTabToTreeGroup(p.tabId, p.targetGroupTabId),
  REMOVE_TAB_FROM_TREE_GROUP: (p) => handleRemoveTabFromTreeGroup(p.tabId),
  SAVE_GROUPS: (p) => handleSaveGroups(p.groups),
  CREATE_SNAPSHOT: () => handleCreateSnapshot(),
  RESTORE_SNAPSHOT: (p) => handleRestoreSnapshot(p.jsonData, p.closeCurrentTabs),
  SAVE_USER_SETTINGS: (p) => handleSaveUserSettings(p.settings),
};

function isKnownRequestType(type: unknown): type is ServiceWorkerRequestType {
  return typeof type === 'string' && Object.hasOwn(requestHandlers, type);
}

/**
 * 要求を処理し、結果を返す
 * @throws 未知の種別の要求、または処理が失敗した場合
 */
async function dispatchRequest(request: ServiceWorkerRequest): Promise<unknown> {
  const { type } = request;
  if (!isKnownRequestType(type)) {
    throw new Error(`Unknown message type: ${String(type)}`);
  }
  const payload = 'payload' in request ? request.payload : undefined;
  // 要求の型とペイロードの型の対応はServiceWorkerRequestの定義で保証される
  const handler = requestHandlers[type] as (payload: unknown) => Promise<unknown>;
  return handler(payload);
}

function handleMessage(
  request: ServiceWorkerRequest,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response: MessageResponse<unknown>) => void,
): boolean {
  trackHandlerAfterInitialization(`runtime.onMessage(${request.type})`, () => dispatchRequest(request))
    .then((data) => sendResponse({ success: true, data: data ?? null }))
    .catch((error: unknown) => {
      sendResponse({ success: false, error: error instanceof Error ? error.message : String(error) });
    });
  return true;
}

export function registerRequestListener(): void {
  chrome.runtime.onMessage.addListener(handleMessage);
}
