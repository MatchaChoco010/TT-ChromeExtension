/**
 * 拡張ページ（サイドパネル・ポップアップ等）からService Workerへ要求を送るクライアント
 */
import type {
  MessageResponse,
  ServiceWorkerRequestPayload,
  ServiceWorkerRequestType,
  ServiceWorkerResponseData,
} from '@/types';

type PayloadArgs<K extends ServiceWorkerRequestType> =
  ServiceWorkerRequestPayload<K> extends undefined ? [] : [payload: ServiceWorkerRequestPayload<K>];

/**
 * Service Workerに要求を送り、応答データを返す
 * @param type - 要求の種別
 * @param payload - 要求の内容（内容を持たない種別では省略する）
 * @throws Service Workerが処理に失敗した、または応答がなかった場合
 */
export async function sendServiceWorkerRequest<K extends ServiceWorkerRequestType>(
  type: K,
  ...[payload]: PayloadArgs<K>
): Promise<ServiceWorkerResponseData<K>> {
  const request = payload === undefined ? { type } : { type, payload };
  const response: MessageResponse<ServiceWorkerResponseData<K>> | undefined =
    await chrome.runtime.sendMessage(request);
  if (!response) {
    throw new Error(`No response from service worker for ${type}`);
  }
  if (!response.success) {
    throw new Error(response.error);
  }
  return response.data;
}

/**
 * 結果を待たずにService Workerへ要求を送る。失敗はコンソールに記録する
 * UIのイベントハンドラーなど、呼び出し元で結果や失敗を扱わない場所で使う
 * @param type - 要求の種別
 * @param payload - 要求の内容（内容を持たない種別では省略する）
 */
export function dispatchServiceWorkerRequest<K extends ServiceWorkerRequestType>(
  type: K,
  ...payload: PayloadArgs<K>
): void {
  sendServiceWorkerRequest(type, ...payload).catch((error: unknown) => {
    console.error(`[${type}] Request failed:`, error);
  });
}
