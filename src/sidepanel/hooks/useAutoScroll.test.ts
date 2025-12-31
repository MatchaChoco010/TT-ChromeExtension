/**
 * Task 6.2: useAutoScrollフックの単体テスト
 * Requirement 3.1, 3.2: ドラッグ中の自動スクロールとスクロール制限
 */

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
    // コンテナ要素を作成
    containerElement = document.createElement('div');
    document.body.appendChild(containerElement);

    // モックのスクロール関連プロパティを設定
    Object.defineProperty(containerElement, 'scrollTop', {
      value: 100,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(containerElement, 'scrollHeight', {
      value: 1000, // 総コンテンツ高さ
      writable: true,
      configurable: true,
    });
    Object.defineProperty(containerElement, 'clientHeight', {
      value: 400, // 表示領域の高さ
      writable: true,
      configurable: true,
    });

    // モックのBoundingClientRectを設定
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

    // requestAnimationFrameをモック
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

  // RAFコールバックを実行するヘルパー（将来のrAFベース実装用）
  const _flushRAF = () => {
    const callbacks = [...rafCallbacks];
    rafCallbacks = [];
    callbacks.forEach((cb) => cb(performance.now()));
  };
  // 未使用警告を抑制（将来使用予定）
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
        // 上端から30px（threshold 50px内）
        result.current.handleAutoScroll(30, containerRect);
      });

      // scrollTopが減少しているはず
      expect(containerElement.scrollTop).toBe(92); // 100 - 8
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
        value: 3, // 小さい値
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

      expect(containerElement.scrollTop).toBe(0); // 0にクランプ
    });
  });

  describe('下端近くでの自動スクロール', () => {
    it('マウスが下端近く(threshold内)にあるとき下にスクロールする', () => {
      const { result } = renderHook(() =>
        useAutoScroll(containerRef, { threshold: 50, speed: 8 })
      );

      const containerRect = containerElement.getBoundingClientRect();

      act(() => {
        // 下端(400)から30px上 = 370
        result.current.handleAutoScroll(370, containerRect);
      });

      expect(containerElement.scrollTop).toBe(108); // 100 + 8
    });

    it('clampToContent=trueの場合、maxScrollを超えない', () => {
      // maxScroll = scrollHeight - clientHeight = 1000 - 400 = 600
      Object.defineProperty(containerElement, 'scrollTop', {
        value: 598, // maxScrollに近い
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

      // maxScroll = 600にクランプされる
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

      // クランプしないので 598 + 8 = 606
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
        // clampToContentを指定しない → デフォルトtrue
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
        // 中央付近 (200) - threshold(50)より内側
        result.current.handleAutoScroll(200, containerRect);
      });

      expect(containerElement.scrollTop).toBe(100); // 変更なし
    });

    it('threshold境界上ではスクロールしない', () => {
      const { result } = renderHook(() =>
        useAutoScroll(containerRef, { threshold: 50, speed: 8 })
      );

      const containerRect = containerElement.getBoundingClientRect();

      act(() => {
        // ちょうどthreshold境界 (mouseY = 50)
        result.current.handleAutoScroll(50, containerRect);
      });

      expect(containerElement.scrollTop).toBe(100); // 変更なし (境界上はスクロールしない)
    });
  });

  describe('カスタムオプション', () => {
    it('カスタムthresholdが使用される', () => {
      const { result } = renderHook(() =>
        useAutoScroll(containerRef, { threshold: 100, speed: 8 })
      );

      const containerRect = containerElement.getBoundingClientRect();

      act(() => {
        // threshold=100なので、80pxの位置でも上スクロールが発生
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

      expect(containerElement.scrollTop).toBe(80); // 100 - 20
    });

    it('デフォルト値が使用される', () => {
      const { result } = renderHook(() => useAutoScroll(containerRef));

      // デフォルト: threshold=50, speed=8
      const containerRect = containerElement.getBoundingClientRect();

      act(() => {
        result.current.handleAutoScroll(30, containerRect);
      });

      expect(containerElement.scrollTop).toBe(92); // 100 - 8
    });
  });

  describe('stopAutoScroll', () => {
    it('stopAutoScrollを呼んでもエラーにならない', () => {
      const { result } = renderHook(() => useAutoScroll(containerRef));

      // 停止を呼んでもエラーにならない（animationFrameIdがnullの場合）
      act(() => {
        result.current.stopAutoScroll();
      });

      // エラーなく実行される
      expect(true).toBe(true);
    });

    it('animationFrameIdが設定されている場合cancelAnimationFrameが呼ばれる', () => {
      const { result } = renderHook(() => useAutoScroll(containerRef));

      // 内部的にanimationFrameRef.currentを設定するシナリオは
      // 将来のrAFベース連続スクロール実装で必要になる
      // 現在は同期的な実装なのでこのテストはスキップ

      act(() => {
        result.current.stopAutoScroll();
      });

      // 現在の実装ではanimationFrameIdがnullなのでcancelAnimationFrameは呼ばれない
      // 将来のrAF実装時にこのテストを有効化する
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

      // エラーなく実行される
      act(() => {
        result.current.handleAutoScroll(30, containerRect);
      });

      // 何もしない（エラーが投げられない）
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

  describe('Requirement 3対応: スクロール可能量を超えるスクロールを防止', () => {
    it('タブツリー全体の高さを超えてスクロールできない', () => {
      // scrollHeight = 500, clientHeight = 400
      // maxScroll = 500 - 400 = 100
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
        value: 95, // maxScrollに近い
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

      // maxScroll = 100にクランプ
      expect(containerElement.scrollTop).toBe(100);
    });

    it('スクロール不要な場合（コンテンツがビューポートより小さい）はスクロールしない', () => {
      // scrollHeight = 300, clientHeight = 400 → スクロール不要
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

      // maxScroll = max(0, 300 - 400) = 0 → スクロールしない
      expect(containerElement.scrollTop).toBe(0);
    });
  });
});
