import type { IDownloadService } from '@/types';

/**
 * chrome.downloads APIを使用したスナップショットダウンロードサービス
 */
export class DownloadService implements IDownloadService {
  /**
   * スナップショットをJSONファイルとしてダウンロード
   *
   * @param jsonContent - JSON文字列
   * @param filename - ファイル名
   * @param subfolder - サブフォルダ名（省略時はダウンロードフォルダ直下）
   * @returns ダウンロードID
   */
  async downloadSnapshot(
    jsonContent: string,
    filename: string,
    subfolder?: string,
  ): Promise<number> {
    // Service Workerでは URL.createObjectURL が使えないため、data URL を使用
    const base64Content = btoa(unescape(encodeURIComponent(jsonContent)));
    const dataUrl = `data:application/json;base64,${base64Content}`;

    const path = subfolder ? `${subfolder}/${filename}` : filename;

    const downloadId = await chrome.downloads.download({
      url: dataUrl,
      filename: path,
      saveAs: false,
      conflictAction: 'uniquify',
    });

    await this.waitForDownloadComplete(downloadId);

    return downloadId;
  }

  /**
   * ダウンロードが完了するまで待機
   */
  private async waitForDownloadComplete(downloadId: number): Promise<void> {
    return new Promise((resolve, reject) => {
      let resolved = false;

      const cleanup = () => {
        chrome.downloads.onChanged.removeListener(listener);
      };

      const listener = (delta: chrome.downloads.DownloadDelta) => {
        if (delta.id !== downloadId || resolved) return;

        if (delta.state?.current === 'complete') {
          resolved = true;
          cleanup();
          resolve();
        } else if (delta.state?.current === 'interrupted') {
          resolved = true;
          cleanup();
          reject(new Error(`Download interrupted: ${delta.error?.current || 'Unknown error'}`));
        }
      };

      // リスナーを先に追加
      chrome.downloads.onChanged.addListener(listener);

      // リスナー追加後に現在の状態を確認（既に完了している場合への対応）
      chrome.downloads.search({ id: downloadId }).then(([item]) => {
        if (resolved) return;

        if (item?.state === 'complete') {
          resolved = true;
          cleanup();
          resolve();
        } else if (item?.state === 'interrupted') {
          resolved = true;
          cleanup();
          reject(new Error(`Download interrupted: ${item.error || 'Unknown error'}`));
        }
      });

      // タイムアウト設定（30秒）
      setTimeout(() => {
        if (resolved) return;
        resolved = true;
        cleanup();
        reject(new Error('Download timed out'));
      }, 30000);
    });
  }
}

export const downloadService = new DownloadService();
