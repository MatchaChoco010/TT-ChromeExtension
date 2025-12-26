// Service Worker for Vivaldi-TT
import {
  registerTabEventListeners,
  registerWindowEventListeners,
  registerMessageListener,
} from './event-handlers';

console.log('Vivaldi-TT service worker loaded');

// Get TreeStateManager instance for initialization
import { testTreeStateManager } from './event-handlers';

// Initialize extension
chrome.runtime.onInstalled.addListener(async () => {
  console.log('Vivaldi-TT extension installed');

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

    console.log('TreeStateManager initialized and synced');
  } catch (error) {
    console.error('Failed to initialize TreeStateManager:', error);
  }
})();

// Register all event listeners
registerTabEventListeners();
registerWindowEventListeners();
registerMessageListener();
