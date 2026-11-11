import 'fake-indexeddb/auto';
import './chrome-mock';
import '@testing-library/jest-dom/vitest';

/**
 * jsdomはResizeObserverを実装していないため、観測しても通知しないスタブを置く
 */
class ResizeObserverStub implements ResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
globalThis.ResizeObserver = ResizeObserverStub;
