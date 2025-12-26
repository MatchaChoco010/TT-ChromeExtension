// Service Worker for Vivaldi-TT
import {
  registerTabEventListeners,
  registerWindowEventListeners,
  registerMessageListener,
} from './event-handlers';

console.log('Vivaldi-TT service worker loaded');

// Initialize extension
chrome.runtime.onInstalled.addListener(() => {
  console.log('Vivaldi-TT extension installed');
});

// Register all event listeners
registerTabEventListeners();
registerWindowEventListeners();
registerMessageListener();
