/**
 * 非同期の読み込みで、最後に始めた要求の結果だけを反映するためのフック
 */

import { useCallback, useRef } from 'react';

/**
 * 要求の開始を記録する関数を返す
 * 開始時に得た判定関数は、その後に別の要求が開始されるとfalseを返す。
 * 古い要求の結果が新しい要求より後に届いた場合に、新しい結果を上書きしないために使う
 * @returns 要求を開始し、その要求が最新かを判定する関数を返す関数
 */
export function useLatestRequestGuard(): () => () => boolean {
  const latestRequestIdRef = useRef(0);

  return useCallback(() => {
    latestRequestIdRef.current += 1;
    const requestId = latestRequestIdRef.current;
    return () => requestId === latestRequestIdRef.current;
  }, []);
}
