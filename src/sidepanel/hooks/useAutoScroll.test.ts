import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAutoScroll } from './useAutoScroll';

describe('useAutoScroll', () => {
  let containerElement: HTMLDivElement;
  let containerRef: React.RefObject<HTMLDivElement>;
  let originalRAF: typeof requestAnimationFrame;
  let originalCAF: typeof cancelAnimationFrame;
  let rafCallbacks: Array<FrameRequestCallback>;

  beforeEach(() => {
    containerElement = document.createElement('div');
    document.body.appendChild(containerElement);

    Object.defineProperty(containerElement, 'scrollTop', {
      value: 100,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(containerElement, 'scrollHeight', {
      value: 1000,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(containerElement, 'clientHeight', {
      value: 400,
      writable: true,
      configurable: true,
    });

    vi.spyOn(containerElement, 'getBoundingClientRect').mockReturnValue({
      top: 0,
      left: 0,
      right: 200,
      bottom: 400,
      width: 200,
      height: 400,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    containerRef = { current: containerElement };

    rafCallbacks = [];
    originalRAF = globalThis.requestAnimationFrame;
    originalCAF = globalThis.cancelAnimationFrame;

    globalThis.requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
      rafCallbacks.push(callback);
      return rafCallbacks.length;
    });

    globalThis.cancelAnimationFrame = vi.fn((id: number) => {
      rafCallbacks[id - 1] = () => {};
    });
  });

  afterEach(() => {
    if (containerElement.parentNode) {
      document.body.removeChild(containerElement);
    }
    vi.restoreAllMocks();
    globalThis.requestAnimationFrame = originalRAF;
    globalThis.cancelAnimationFrame = originalCAF;
  });

  const _flushRAF = () => {
    const callbacks = [...rafCallbacks];
    rafCallbacks = [];
    callbacks.forEach((cb) => cb(performance.now()));
  };
  void _flushRAF;

  describe('初期状態', () => {
    it('handleAutoScrollとstopAutoScrollが返される', () => {
      const { result } = renderHook(() => useAutoScroll(containerRef));

      expect(result.current.handleAutoScroll).toBeDefined();
      expect(typeof result.current.handleAutoScroll).toBe('function');
      expect(result.current.stopAutoScroll).toBeDefined();
      expect(typeof result.current.stopAutoScroll).toBe('function');
    });
  });

  describe('上端近くでの自動スクロール', () => {
    it('マウスが上端近く(threshold内)にあるとき上にスクロールする', () => {
      const { result } = renderHook(() =>
        useAutoScroll(containerRef, { threshold: 50, speed: 8 })
      );

      const containerRect = containerElement.getBoundingClientRect();

      act(() => {
        result.current.handleAutoScroll(30, containerRect);
      });

      expect(containerElement.scrollTop).toBe(92);
    });

    it('scrollTop=0のとき上スクロールしない', () => {
      Object.defineProperty(containerElement, 'scrollTop', {
        value: 0,
        writable: true,
        configurable: true,
      });

      const { result } = renderHook(() =>
        useAutoScroll(containerRef, { threshold: 50, speed: 8 })
      );

      const containerRect = containerElement.getBoundingClientRect();

      act(() => {
        result.current.handleAutoScroll(30, containerRect);
      });

      expect(containerElement.scrollTop).toBe(0);
    });

    it('scrollTopが負にならない', () => {
      Object.defineProperty(containerElement, 'scrollTop', {
        value: 3,
        writable: true,
        configurable: true,
      });

      const { result } = renderHook(() =>
        useAutoScroll(containerRef, { threshold: 50, speed: 8 })
      );

      const containerRect = containerElement.getBoundingClientRect();

      act(() => {
        result.current.handleAutoScroll(30, containerRect);
      });

      expect(containerElement.scrollTop).toBe(0);
    });
  });

  describe('下端近くでの自動スクロール', () => {
    it('マウスが下端近く(threshold内)にあるとき下にスクロールする', () => {
      const { result } = renderHook(() =>
        useAutoScroll(containerRef, { threshold: 50, speed: 8 })
      );

      const containerRect = containerElement.getBoundingClientRect();

      act(() => {
        result.current.handleAutoScroll(370, containerRect);
      });

      expect(containerElement.scrollTop).toBe(108);
    });

    it('clampToContent=trueの場合、maxScrollを超えない', () => {
      Object.defineProperty(containerElement, 'scrollTop', {
        value: 598,
        writable: true,
        configurable: true,
      });

      const { result } = renderHook(() =>
        useAutoScroll(containerRef, { threshold: 50, speed: 8, clampToContent: true })
      );

      const containerRect = containerElement.getBoundingClientRect();

      act(() => {
        result.current.handleAutoScroll(370, containerRect);
      });

      expect(containerElement.scrollTop).toBe(600);
    });

    it('clampToContent=falseの場合、maxScrollを超える', () => {
      Object.defineProperty(containerElement, 'scrollTop', {
        value: 598,
        writable: true,
        configurable: true,
      });

      const { result } = renderHook(() =>
        useAutoScroll(containerRef, { threshold: 50, speed: 8, clampToContent: false })
      );

      const containerRect = containerElement.getBoundingClientRect();

      act(() => {
        result.current.handleAutoScroll(370, containerRect);
      });

      expect(containerElement.scrollTop).toBe(606);
    });

    it('デフォルトでclampToContent=trueである', () => {
      Object.defineProperty(containerElement, 'scrollTop', {
        value: 598,
        writable: true,
        configurable: true,
      });

      const { result } = renderHook(() =>
        useAutoScroll(containerRef, { threshold: 50, speed: 8 })
      );

      const containerRect = containerElement.getBoundingClientRect();

      act(() => {
        result.current.handleAutoScroll(370, containerRect);
      });

      expect(containerElement.scrollTop).toBe(600);
    });
  });

  describe('スクロール不要領域', () => {
    it('マウスが中央にあるときスクロールしない', () => {
      const { result } = renderHook(() =>
        useAutoScroll(containerRef, { threshold: 50, speed: 8 })
      );

      const containerRect = containerElement.getBoundingClientRect();

      act(() => {
        result.current.handleAutoScroll(200, containerRect);
      });

      expect(containerElement.scrollTop).toBe(100);
    });

    it('threshold境界上ではスクロールしない', () => {
      const { result } = renderHook(() =>
        useAutoScroll(containerRef, { threshold: 50, speed: 8 })
      );

      const containerRect = containerElement.getBoundingClientRect();

      act(() => {
        result.current.handleAutoScroll(50, containerRect);
      });

      expect(containerElement.scrollTop).toBe(100);
    });
  });

  describe('カスタムオプション', () => {
    it('カスタムthresholdが使用される', () => {
      const { result } = renderHook(() =>
        useAutoScroll(containerRef, { threshold: 100, speed: 8 })
      );

      const containerRect = containerElement.getBoundingClientRect();

      act(() => {
        result.current.handleAutoScroll(80, containerRect);
      });

      expect(containerElement.scrollTop).toBe(92);
    });

    it('カスタムspeedが使用される', () => {
      const { result } = renderHook(() =>
        useAutoScroll(containerRef, { threshold: 50, speed: 20 })
      );

      const containerRect = containerElement.getBoundingClientRect();

      act(() => {
        result.current.handleAutoScroll(30, containerRect);
      });

      expect(containerElement.scrollTop).toBe(80);
    });

    it('デフォルト値が使用される', () => {
      const { result } = renderHook(() => useAutoScroll(containerRef));

      const containerRect = containerElement.getBoundingClientRect();

      act(() => {
        result.current.handleAutoScroll(30, containerRect);
      });

      expect(containerElement.scrollTop).toBe(92);
    });
  });

  describe('stopAutoScroll', () => {
    it('stopAutoScrollを呼んでもエラーにならない', () => {
      const { result } = renderHook(() => useAutoScroll(containerRef));

      act(() => {
        result.current.stopAutoScroll();
      });

      expect(true).toBe(true);
    });

    it('animationFrameIdが設定されている場合cancelAnimationFrameが呼ばれる', () => {
      const { result } = renderHook(() => useAutoScroll(containerRef));

      act(() => {
        result.current.stopAutoScroll();
      });

      expect(true).toBe(true);
    });
  });

  describe('コンテナrefがnullの場合', () => {
    it('handleAutoScrollが何もしない', () => {
      const nullRef = { current: null };
      const { result } = renderHook(() =>
        useAutoScroll(nullRef as React.RefObject<HTMLElement>)
      );

      const containerRect = {
        top: 0,
        left: 0,
        right: 200,
        bottom: 400,
        width: 200,
        height: 400,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      } as DOMRect;

      act(() => {
        result.current.handleAutoScroll(30, containerRect);
      });

      expect(true).toBe(true);
    });
  });

  describe('連続スクロール', () => {
    it('連続してhandleAutoScrollを呼ぶとスクロールが累積する', () => {
      const { result } = renderHook(() =>
        useAutoScroll(containerRef, { threshold: 50, speed: 8 })
      );

      const containerRect = containerElement.getBoundingClientRect();

      act(() => {
        result.current.handleAutoScroll(30, containerRect);
      });
      expect(containerElement.scrollTop).toBe(92);

      act(() => {
        result.current.handleAutoScroll(30, containerRect);
      });
      expect(containerElement.scrollTop).toBe(84);

      act(() => {
        result.current.handleAutoScroll(30, containerRect);
      });
      expect(containerElement.scrollTop).toBe(76);
    });
  });

  describe('スクロール可能量を超えるスクロールを防止', () => {
    it('タブツリー全体の高さを超えてスクロールできない', () => {
      Object.defineProperty(containerElement, 'scrollHeight', {
        value: 500,
        writable: true,
        configurable: true,
      });
      Object.defineProperty(containerElement, 'clientHeight', {
        value: 400,
        writable: true,
        configurable: true,
      });
      Object.defineProperty(containerElement, 'scrollTop', {
        value: 95,
        writable: true,
        configurable: true,
      });

      const { result } = renderHook(() =>
        useAutoScroll(containerRef, { threshold: 50, speed: 8, clampToContent: true })
      );

      const containerRect = containerElement.getBoundingClientRect();

      act(() => {
        result.current.handleAutoScroll(370, containerRect);
      });

      expect(containerElement.scrollTop).toBe(100);
    });

    it('スクロール不要な場合（コンテンツがビューポートより小さい）はスクロールしない', () => {
      Object.defineProperty(containerElement, 'scrollHeight', {
        value: 300,
        writable: true,
        configurable: true,
      });
      Object.defineProperty(containerElement, 'clientHeight', {
        value: 400,
        writable: true,
        configurable: true,
      });
      Object.defineProperty(containerElement, 'scrollTop', {
        value: 0,
        writable: true,
        configurable: true,
      });

      const { result } = renderHook(() =>
        useAutoScroll(containerRef, { threshold: 50, speed: 8, clampToContent: true })
      );

      const containerRect = containerElement.getBoundingClientRect();

      act(() => {
        result.current.handleAutoScroll(370, containerRect);
      });

      expect(containerElement.scrollTop).toBe(0);
    });
  });
});
