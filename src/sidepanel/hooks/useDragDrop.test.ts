import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useDragDrop } from './useDragDrop';

const createMouseEvent = (
  type: string,
  clientX: number,
  clientY: number,
  // eslint-disable-next-line no-undef -- MouseEventInitはDOM標準型
  options: Partial<MouseEventInit> = {}
): MouseEvent => {
  return new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX,
    clientY,
    ...options,
  });
};

const createReactMouseEvent = (
  clientX: number,
  clientY: number
): React.MouseEvent => {
  const targetDiv = document.createElement('div');
  vi.spyOn(targetDiv, 'getBoundingClientRect').mockReturnValue({
    top: 0,
    left: 0,
    right: 100,
    bottom: 40,
    width: 100,
    height: 40,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
  const event = createMouseEvent('mousedown', clientX, clientY, { button: 0 });
  return {
    ...event,
    button: 0,
    nativeEvent: event,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    currentTarget: targetDiv,
    target: targetDiv,
    type: 'mousedown',
    clientX,
    clientY,
  } as unknown as React.MouseEvent;
};

describe('useDragDrop', () => {
  let containerElement: HTMLDivElement;
  let containerRef: React.RefObject<HTMLDivElement>;

  beforeEach(() => {
    containerElement = document.createElement('div');
    containerElement.style.width = '200px';
    containerElement.style.height = '400px';
    document.body.appendChild(containerElement);

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
  });

  afterEach(() => {
    document.body.removeChild(containerElement);
    vi.restoreAllMocks();
  });

  describe('初期状態', () => {
    it('ドラッグ状態が初期値で返される', () => {
      const { result } = renderHook(() =>
        useDragDrop({
          containerRef,
          items: [],
        })
      );

      expect(result.current.dragState.isDragging).toBe(false);
      expect(result.current.dragState.isPotentialDrag).toBe(false);
      expect(result.current.dragState.draggedItemId).toBeNull();
      expect(result.current.dragState.draggedTabId).toBeNull();
    });

    it('getItemPropsがマウスダウンハンドラを含むオブジェクトを返す', () => {
      const { result } = renderHook(() =>
        useDragDrop({
          containerRef,
          items: [{ id: 'node-1', tabId: 1 }],
        })
      );

      const props = result.current.getItemProps('node-1', 1);
      expect(props.onMouseDown).toBeDefined();
      expect(typeof props.onMouseDown).toBe('function');
    });
  });

  describe('ドラッグ開始（8px移動検知）', () => {
    it('mousedownで潜在的ドラッグ状態になる', () => {
      const { result } = renderHook(() =>
        useDragDrop({
          containerRef,
          items: [{ id: 'node-1', tabId: 1 }],
        })
      );

      const props = result.current.getItemProps('node-1', 1);

      act(() => {
        props.onMouseDown(createReactMouseEvent(100, 100));
      });

      expect(result.current.dragState.isPotentialDrag).toBe(true);
      expect(result.current.dragState.isDragging).toBe(false);
    });

    it('8px未満の移動ではドラッグが開始されない', async () => {
      const { result } = renderHook(() =>
        useDragDrop({
          containerRef,
          items: [{ id: 'node-1', tabId: 1 }],
        })
      );

      const props = result.current.getItemProps('node-1', 1);

      act(() => {
        props.onMouseDown(createReactMouseEvent(100, 100));
      });

      act(() => {
        document.dispatchEvent(createMouseEvent('mousemove', 105, 100));
      });

      expect(result.current.dragState.isPotentialDrag).toBe(true);
      expect(result.current.dragState.isDragging).toBe(false);
    });

    it('8px以上の移動でドラッグが開始される', async () => {
      const onDragStart = vi.fn();
      const { result } = renderHook(() =>
        useDragDrop({
          containerRef,
          items: [{ id: 'node-1', tabId: 1 }],
          onDragStart,
        })
      );

      const props = result.current.getItemProps('node-1', 1);

      act(() => {
        props.onMouseDown(createReactMouseEvent(100, 100));
      });

      act(() => {
        document.dispatchEvent(createMouseEvent('mousemove', 110, 100));
      });

      expect(result.current.dragState.isDragging).toBe(true);
      expect(result.current.dragState.isPotentialDrag).toBe(false);
      expect(result.current.dragState.draggedItemId).toBe('node-1');
      expect(result.current.dragState.draggedTabId).toBe(1);
      expect(onDragStart).toHaveBeenCalledWith('node-1', 1);
    });

    it('カスタムactivationDistanceが使用される', async () => {
      const { result } = renderHook(() =>
        useDragDrop({
          containerRef,
          items: [{ id: 'node-1', tabId: 1 }],
          activationDistance: 16, // カスタム16px
        })
      );

      const props = result.current.getItemProps('node-1', 1);

      act(() => {
        props.onMouseDown(createReactMouseEvent(100, 100));
      });

      act(() => {
        document.dispatchEvent(createMouseEvent('mousemove', 110, 100));
      });

      expect(result.current.dragState.isDragging).toBe(false);

      act(() => {
        document.dispatchEvent(createMouseEvent('mousemove', 120, 100));
      });

      expect(result.current.dragState.isDragging).toBe(true);
    });
  });

  describe('ドラッグ中の状態更新', () => {
    it('mousemoveで現在位置が更新される', async () => {
      const { result } = renderHook(() =>
        useDragDrop({
          containerRef,
          items: [{ id: 'node-1', tabId: 1 }],
        })
      );

      const props = result.current.getItemProps('node-1', 1);

      act(() => {
        props.onMouseDown(createReactMouseEvent(100, 100));
      });

      act(() => {
        document.dispatchEvent(createMouseEvent('mousemove', 110, 120));
      });

      expect(result.current.dragState.currentPosition).toEqual({ x: 110, y: 120 });
    });

    it('deltaが正しく計算される', async () => {
      const { result } = renderHook(() =>
        useDragDrop({
          containerRef,
          items: [{ id: 'node-1', tabId: 1 }],
        })
      );

      const props = result.current.getItemProps('node-1', 1);

      act(() => {
        props.onMouseDown(createReactMouseEvent(100, 100));
      });

      act(() => {
        document.dispatchEvent(createMouseEvent('mousemove', 150, 180));
      });

      expect(result.current.dragState.delta).toEqual({ x: 50, y: 80 });
    });
  });

  describe('ドラッグ終了・キャンセル', () => {
    it('mouseupでドラッグが終了する', async () => {
      const onDragEnd = vi.fn();
      const { result } = renderHook(() =>
        useDragDrop({
          containerRef,
          items: [{ id: 'node-1', tabId: 1 }],
          onDragEnd,
        })
      );

      const props = result.current.getItemProps('node-1', 1);

      act(() => {
        props.onMouseDown(createReactMouseEvent(100, 100));
      });

      act(() => {
        document.dispatchEvent(createMouseEvent('mousemove', 110, 100));
      });

      expect(result.current.dragState.isDragging).toBe(true);

      act(() => {
        document.dispatchEvent(createMouseEvent('mouseup', 110, 100));
      });

      // handleMouseUpはasync関数なので、状態更新を待つ
      await waitFor(() => {
        expect(result.current.dragState.isDragging).toBe(false);
      });
      expect(result.current.dragState.draggedItemId).toBeNull();
      expect(onDragEnd).toHaveBeenCalledWith('node-1', { type: 'none' });
    });

    it('cancelDragでドラッグがキャンセルされる', async () => {
      const onDragCancel = vi.fn();
      const { result } = renderHook(() =>
        useDragDrop({
          containerRef,
          items: [{ id: 'node-1', tabId: 1 }],
          onDragCancel,
        })
      );

      const props = result.current.getItemProps('node-1', 1);

      act(() => {
        props.onMouseDown(createReactMouseEvent(100, 100));
      });

      act(() => {
        document.dispatchEvent(createMouseEvent('mousemove', 110, 100));
      });

      expect(result.current.dragState.isDragging).toBe(true);

      act(() => {
        result.current.cancelDrag();
      });

      expect(result.current.dragState.isDragging).toBe(false);
      expect(onDragCancel).toHaveBeenCalled();
    });

    it('潜在的ドラッグ中にmouseupで状態がリセットされる', () => {
      const { result } = renderHook(() =>
        useDragDrop({
          containerRef,
          items: [{ id: 'node-1', tabId: 1 }],
        })
      );

      const props = result.current.getItemProps('node-1', 1);

      act(() => {
        props.onMouseDown(createReactMouseEvent(100, 100));
      });

      expect(result.current.dragState.isPotentialDrag).toBe(true);

      act(() => {
        document.dispatchEvent(createMouseEvent('mouseup', 102, 100)); // 8px未満
      });

      expect(result.current.dragState.isPotentialDrag).toBe(false);
    });
  });

  describe('垂直モードの移動距離計算', () => {
    it('垂直モードで斜め移動も含めて距離計算される', async () => {
      const { result } = renderHook(() =>
        useDragDrop({
          containerRef,
          items: [{ id: 'node-1', tabId: 1 }],
          direction: 'vertical',
        })
      );

      const props = result.current.getItemProps('node-1', 1);

      act(() => {
        props.onMouseDown(createReactMouseEvent(100, 100));
      });

      act(() => {
        document.dispatchEvent(createMouseEvent('mousemove', 106, 106));
      });

      expect(result.current.dragState.isDragging).toBe(true);
    });
  });

  describe('外部ドロップ検知', () => {
    it('コンテナ外でmouseupすると外部ドロップコールバックが呼ばれる', async () => {
      const onExternalDrop = vi.fn();
      const { result } = renderHook(() =>
        useDragDrop({
          containerRef,
          items: [{ id: 'node-1', tabId: 1 }],
          onExternalDrop,
        })
      );

      const props = result.current.getItemProps('node-1', 1);

      act(() => {
        props.onMouseDown(createReactMouseEvent(100, 100));
      });

      act(() => {
        document.dispatchEvent(createMouseEvent('mousemove', 110, 100));
      });

      act(() => {
        document.dispatchEvent(createMouseEvent('mouseup', 250, 100));
      });

      expect(onExternalDrop).toHaveBeenCalledWith(1);
    });
  });

  describe('プログラマティックドラッグ開始', () => {
    it('startDragProgrammaticallyで即座にドラッグが開始される', () => {
      const onDragStart = vi.fn();
      const { result } = renderHook(() =>
        useDragDrop({
          containerRef,
          items: [{ id: 'node-1', tabId: 1 }],
          onDragStart,
        })
      );

      act(() => {
        result.current.startDragProgrammatically('node-1', 1, { x: 150, y: 200 });
      });

      expect(result.current.dragState.isDragging).toBe(true);
      expect(result.current.dragState.isPotentialDrag).toBe(false);
      expect(result.current.dragState.draggedItemId).toBe('node-1');
      expect(result.current.dragState.draggedTabId).toBe(1);
      expect(result.current.dragState.currentPosition).toEqual({ x: 150, y: 200 });
      expect(onDragStart).toHaveBeenCalledWith('node-1', 1);
    });

    it('プログラマティック開始後はmousemoveで位置が更新される', async () => {
      const { result } = renderHook(() =>
        useDragDrop({
          containerRef,
          items: [{ id: 'node-1', tabId: 1 }],
        })
      );

      act(() => {
        result.current.startDragProgrammatically('node-1', 1, { x: 150, y: 200 });
      });

      act(() => {
        document.dispatchEvent(createMouseEvent('mousemove', 180, 250));
      });

      expect(result.current.dragState.currentPosition).toEqual({ x: 180, y: 250 });
    });
  });

  describe('getDragOverlayStyle', () => {
    it('ドラッグ中でない場合はnullを返す', () => {
      const { result } = renderHook(() =>
        useDragDrop({
          containerRef,
          items: [],
        })
      );

      expect(result.current.getDragOverlayStyle()).toBeNull();
    });

    it('ドラッグ中はtransformスタイルを返す', async () => {
      const { result } = renderHook(() =>
        useDragDrop({
          containerRef,
          items: [{ id: 'node-1', tabId: 1 }],
        })
      );

      const props = result.current.getItemProps('node-1', 1);

      act(() => {
        props.onMouseDown(createReactMouseEvent(100, 100));
      });

      act(() => {
        document.dispatchEvent(createMouseEvent('mousemove', 150, 200));
      });

      const style = result.current.getDragOverlayStyle();
      expect(style).not.toBeNull();
      expect(style?.transform).toBeDefined();
    });
  });

  describe('クリーンアップ', () => {
    it('アンマウント時にイベントリスナーが削除される', () => {
      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

      const { result, unmount } = renderHook(() =>
        useDragDrop({
          containerRef,
          items: [{ id: 'node-1', tabId: 1 }],
        })
      );

      const props = result.current.getItemProps('node-1', 1);

      // ドラッグ開始
      act(() => {
        props.onMouseDown(createReactMouseEvent(100, 100));
      });

      // アンマウント
      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalled();
    });
  });

  describe('水平ドラッグモード', () => {
    it('水平モードでは水平方向の移動距離のみが判定に使われる', async () => {
      const { result } = renderHook(() =>
        useDragDrop({
          containerRef,
          items: [{ id: 'node-1', tabId: 1 }],
          direction: 'horizontal',
          activationDistance: 8,
        })
      );

      const props = result.current.getItemProps('node-1', 1);

      act(() => {
        props.onMouseDown(createReactMouseEvent(100, 100));
      });

      act(() => {
        document.dispatchEvent(createMouseEvent('mousemove', 100, 110));
      });

      expect(result.current.dragState.isDragging).toBe(false);
      expect(result.current.dragState.isPotentialDrag).toBe(true);

      act(() => {
        document.dispatchEvent(createMouseEvent('mousemove', 108, 110));
      });

      expect(result.current.dragState.isDragging).toBe(true);
    });

    it('水平モードで水平方向のドロップターゲットが計算される', async () => {
      const horizontalContainer = document.createElement('div');
      horizontalContainer.style.display = 'flex';
      horizontalContainer.style.flexDirection = 'row';
      horizontalContainer.style.width = '400px';
      horizontalContainer.style.height = '40px';
      document.body.appendChild(horizontalContainer);

      const tab1 = document.createElement('div');
      tab1.setAttribute('data-node-id', 'pinned-1');
      tab1.setAttribute('data-pinned-index', '0');
      tab1.style.width = '40px';
      tab1.style.height = '40px';
      horizontalContainer.appendChild(tab1);

      const tab2 = document.createElement('div');
      tab2.setAttribute('data-node-id', 'pinned-2');
      tab2.setAttribute('data-pinned-index', '1');
      tab2.style.width = '40px';
      tab2.style.height = '40px';
      horizontalContainer.appendChild(tab2);

      const tab3 = document.createElement('div');
      tab3.setAttribute('data-node-id', 'pinned-3');
      tab3.setAttribute('data-pinned-index', '2');
      tab3.style.width = '40px';
      tab3.style.height = '40px';
      horizontalContainer.appendChild(tab3);

      vi.spyOn(horizontalContainer, 'getBoundingClientRect').mockReturnValue({
        top: 0,
        left: 0,
        right: 400,
        bottom: 40,
        width: 400,
        height: 40,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      });

      vi.spyOn(tab1, 'getBoundingClientRect').mockReturnValue({
        top: 0, left: 0, right: 40, bottom: 40, width: 40, height: 40, x: 0, y: 0, toJSON: () => ({}),
      });

      vi.spyOn(tab2, 'getBoundingClientRect').mockReturnValue({
        top: 0, left: 40, right: 80, bottom: 40, width: 40, height: 40, x: 40, y: 0, toJSON: () => ({}),
      });

      vi.spyOn(tab3, 'getBoundingClientRect').mockReturnValue({
        top: 0, left: 80, right: 120, bottom: 40, width: 40, height: 40, x: 80, y: 0, toJSON: () => ({}),
      });

      const horizontalRef = { current: horizontalContainer };
      const onDragMove = vi.fn();

      const { result } = renderHook(() =>
        useDragDrop({
          containerRef: horizontalRef,
          items: [
            { id: 'pinned-1', tabId: 1 },
            { id: 'pinned-2', tabId: 2 },
            { id: 'pinned-3', tabId: 3 },
          ],
          direction: 'horizontal',
          onDragMove,
        })
      );

      const props = result.current.getItemProps('pinned-1', 1);

      act(() => {
        props.onMouseDown(createReactMouseEvent(20, 20));
      });

      act(() => {
        document.dispatchEvent(createMouseEvent('mousemove', 50, 20));
      });

      expect(result.current.dragState.isDragging).toBe(true);

      act(() => {
        document.dispatchEvent(createMouseEvent('mousemove', 60, 20));
      });

      expect(onDragMove).toHaveBeenCalled();
      expect(result.current.dragState.dropTarget).toBeDefined();

      document.body.removeChild(horizontalContainer);
    });

    it('水平モードでアイテム間の隙間にドロップできる', async () => {
      const horizontalContainer = document.createElement('div');
      document.body.appendChild(horizontalContainer);

      const tabs = [1, 2, 3].map((i) => {
        const tab = document.createElement('div');
        tab.setAttribute('data-node-id', `pinned-${i}`);
        tab.setAttribute('data-pinned-index', String(i - 1));
        horizontalContainer.appendChild(tab);
        return tab;
      });

      vi.spyOn(horizontalContainer, 'getBoundingClientRect').mockReturnValue({
        top: 0, left: 0, right: 120, bottom: 40, width: 120, height: 40, x: 0, y: 0, toJSON: () => ({}),
      });

      tabs.forEach((tab, i) => {
        vi.spyOn(tab, 'getBoundingClientRect').mockReturnValue({
          top: 0, left: i * 40, right: (i + 1) * 40, bottom: 40, width: 40, height: 40, x: i * 40, y: 0, toJSON: () => ({}),
        });
      });

      const horizontalRef = { current: horizontalContainer };
      const onDragEnd = vi.fn();

      const { result } = renderHook(() =>
        useDragDrop({
          containerRef: horizontalRef,
          items: [
            { id: 'pinned-1', tabId: 1 },
            { id: 'pinned-2', tabId: 2 },
            { id: 'pinned-3', tabId: 3 },
          ],
          direction: 'horizontal',
          onDragEnd,
        })
      );

      const props = result.current.getItemProps('pinned-1', 1);

      act(() => {
        props.onMouseDown(createReactMouseEvent(20, 20));
      });

      act(() => {
        document.dispatchEvent(createMouseEvent('mousemove', 100, 20));
      });

      expect(result.current.dragState.isDragging).toBe(true);

      act(() => {
        document.dispatchEvent(createMouseEvent('mouseup', 100, 20));
      });

      await waitFor(() => {
        expect(onDragEnd).toHaveBeenCalled();
      });

      document.body.removeChild(horizontalContainer);
    });

    it('水平モードで正しいドロップインデックスが計算される（先頭へのドロップ）', async () => {
      const horizontalContainer = document.createElement('div');
      document.body.appendChild(horizontalContainer);

      const tabs = [1, 2, 3].map((i) => {
        const tab = document.createElement('div');
        tab.setAttribute('data-node-id', `pinned-${i}`);
        tab.setAttribute('data-pinned-index', String(i - 1));
        horizontalContainer.appendChild(tab);
        return tab;
      });

      vi.spyOn(horizontalContainer, 'getBoundingClientRect').mockReturnValue({
        top: 0, left: 0, right: 120, bottom: 40, width: 120, height: 40, x: 0, y: 0, toJSON: () => ({}),
      });

      tabs.forEach((tab, i) => {
        vi.spyOn(tab, 'getBoundingClientRect').mockReturnValue({
          top: 0, left: i * 40, right: (i + 1) * 40, bottom: 40, width: 40, height: 40, x: i * 40, y: 0, toJSON: () => ({}),
        });
      });

      const horizontalRef = { current: horizontalContainer };

      const { result } = renderHook(() =>
        useDragDrop({
          containerRef: horizontalRef,
          items: [
            { id: 'pinned-1', tabId: 1 },
            { id: 'pinned-2', tabId: 2 },
            { id: 'pinned-3', tabId: 3 },
          ],
          direction: 'horizontal',
        })
      );

      const props = result.current.getItemProps('pinned-3', 3);

      act(() => {
        props.onMouseDown(createReactMouseEvent(100, 20));
      });

      act(() => {
        document.dispatchEvent(createMouseEvent('mousemove', 5, 20));
      });

      expect(result.current.dragState.isDragging).toBe(true);
      expect(result.current.dragState.dropTarget).not.toBeNull();
      expect(result.current.dragState.dropTarget?.type).toBe('horizontal_gap');

      document.body.removeChild(horizontalContainer);
    });

    it('水平モードで正しいドロップインデックスが計算される（中間へのドロップ）', async () => {
      const horizontalContainer = document.createElement('div');
      document.body.appendChild(horizontalContainer);

      const tabs = [1, 2, 3].map((i) => {
        const tab = document.createElement('div');
        tab.setAttribute('data-node-id', `pinned-${i}`);
        tab.setAttribute('data-pinned-index', String(i - 1));
        horizontalContainer.appendChild(tab);
        return tab;
      });

      vi.spyOn(horizontalContainer, 'getBoundingClientRect').mockReturnValue({
        top: 0, left: 0, right: 120, bottom: 40, width: 120, height: 40, x: 0, y: 0, toJSON: () => ({}),
      });

      tabs.forEach((tab, i) => {
        vi.spyOn(tab, 'getBoundingClientRect').mockReturnValue({
          top: 0, left: i * 40, right: (i + 1) * 40, bottom: 40, width: 40, height: 40, x: i * 40, y: 0, toJSON: () => ({}),
        });
      });

      const horizontalRef = { current: horizontalContainer };

      const { result } = renderHook(() =>
        useDragDrop({
          containerRef: horizontalRef,
          items: [
            { id: 'pinned-1', tabId: 1 },
            { id: 'pinned-2', tabId: 2 },
            { id: 'pinned-3', tabId: 3 },
          ],
          direction: 'horizontal',
        })
      );

      const props = result.current.getItemProps('pinned-1', 1);

      act(() => {
        props.onMouseDown(createReactMouseEvent(20, 20));
      });

      act(() => {
        document.dispatchEvent(createMouseEvent('mousemove', 50, 20));
      });

      expect(result.current.dragState.isDragging).toBe(true);
      expect(result.current.dragState.dropTarget).not.toBeNull();
      expect(result.current.dragState.dropTarget?.type).toBe('horizontal_gap');
      expect(result.current.dragState.dropTarget?.insertIndex).toBe(1);

      document.body.removeChild(horizontalContainer);
    });

    it('水平モードでタブ中心の右側にドロップすると次のインデックスに挿入', async () => {
      const horizontalContainer = document.createElement('div');
      document.body.appendChild(horizontalContainer);

      const tabs = [1, 2, 3].map((i) => {
        const tab = document.createElement('div');
        tab.setAttribute('data-node-id', `pinned-${i}`);
        tab.setAttribute('data-pinned-index', String(i - 1));
        horizontalContainer.appendChild(tab);
        return tab;
      });

      vi.spyOn(horizontalContainer, 'getBoundingClientRect').mockReturnValue({
        top: 0, left: 0, right: 120, bottom: 40, width: 120, height: 40, x: 0, y: 0, toJSON: () => ({}),
      });

      tabs.forEach((tab, i) => {
        vi.spyOn(tab, 'getBoundingClientRect').mockReturnValue({
          top: 0, left: i * 40, right: (i + 1) * 40, bottom: 40, width: 40, height: 40, x: i * 40, y: 0, toJSON: () => ({}),
        });
      });

      const horizontalRef = { current: horizontalContainer };

      const { result } = renderHook(() =>
        useDragDrop({
          containerRef: horizontalRef,
          items: [
            { id: 'pinned-1', tabId: 1 },
            { id: 'pinned-2', tabId: 2 },
            { id: 'pinned-3', tabId: 3 },
          ],
          direction: 'horizontal',
        })
      );

      const props = result.current.getItemProps('pinned-1', 1);

      act(() => {
        props.onMouseDown(createReactMouseEvent(20, 20));
      });

      act(() => {
        document.dispatchEvent(createMouseEvent('mousemove', 70, 20));
      });

      expect(result.current.dragState.isDragging).toBe(true);
      expect(result.current.dragState.dropTarget).not.toBeNull();
      expect(result.current.dragState.dropTarget?.type).toBe('horizontal_gap');
      expect(result.current.dragState.dropTarget?.insertIndex).toBe(2);

      document.body.removeChild(horizontalContainer);
    });
  });
});
