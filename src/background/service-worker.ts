// Service Worker for Vivaldi-TT
import {
  registerTabEventListeners,
  registerWindowEventListeners,
  registerMessageListener,
} from './event-handlers';

// Get TreeStateManager instance for initialization
import { testTreeStateManager } from './event-handlers';

// Initialize extension
chrome.runtime.onInstalled.addListener(async () => {
  // Load state from storage
  await testTreeStateManager.loadState();

  // Sync with existing Chrome tabs
  await testTreeStateManager.syncWithChromeTabs();
});

// Initialize on service worker startup
(async () => {
  try {
    // Load existing state
    await testTreeStateManager.loadState();

    // Sync with current Chrome tabs
    await testTreeStateManager.syncWithChromeTabs();
  } catch (_error) {
    // Failed to initialize TreeStateManager silently
  }
})();

// Register all event listeners
registerTabEventListeners();
registerWindowEventListeners();
registerMessageListener();
