import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useLatestRequestGuard } from './useLatestRequestGuard';

describe('useLatestRequestGuard', () => {
  it('最後に開始した要求だけを最新と判定する', () => {
    const { result } = renderHook(() => useLatestRequestGuard());

    const isFirstLatest = result.current();
    expect(isFirstLatest()).toBe(true);

    const isSecondLatest = result.current();
    expect(isFirstLatest()).toBe(false);
    expect(isSecondLatest()).toBe(true);
  });

  it('再描画しても同じ関数を返す', () => {
    const { result, rerender } = renderHook(() => useLatestRequestGuard());
    const first = result.current;

    rerender();

    expect(result.current).toBe(first);
  });
});
