import React, { useEffect, useState, useCallback } from 'react';

interface ChildTabInfo {
  tabId: number;
  title: string;
  url: string;
}

interface GroupInfo {
  name: string;
  children: ChildTabInfo[];
}

type PageState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'loaded'; groupInfo: GroupInfo };

const POLLING_INTERVAL_MS = 2000;

function getTabIdFromQuery(): number | null {
  const params = new URLSearchParams(window.location.search);
  const tabIdStr = params.get('tabId');
  if (!tabIdStr) return null;
  const tabId = parseInt(tabIdStr, 10);
  return isNaN(tabId) ? null : tabId;
}

async function fetchGroupInfo(tabId: number): Promise<GroupInfo> {
  const response = await chrome.runtime.sendMessage({
    type: 'GET_GROUP_INFO',
    payload: { tabId },
  });

  if (!response?.success) {
    throw new Error(response?.error || 'Unknown error');
  }

  return response.data;
}

export const GroupPage: React.FC = () => {
  const [state, setState] = useState<PageState>({ status: 'loading' });
  const [tabId] = useState<number | null>(() => getTabIdFromQuery());

  const loadGroupInfo = useCallback(async () => {
    if (!tabId) {
      setState({ status: 'error', message: 'タブIDが指定されていません' });
      return;
    }

    try {
      const groupInfo = await fetchGroupInfo(tabId);
      setState({ status: 'loaded', groupInfo });
    } catch {
      setState({
        status: 'error',
        message: 'グループ情報の取得に失敗しました',
      });
    }
  }, [tabId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 初回マウント時のデータ読み込みパターン
    loadGroupInfo();
  }, [loadGroupInfo]);

  useEffect(() => {
    if (state.status !== 'loaded') return;

    const intervalId = setInterval(() => {
      loadGroupInfo();
    }, POLLING_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [state.status, loadGroupInfo]);

  if (state.status === 'loading') {
    return (
      <div className="group-page min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-gray-400">読み込み中...</div>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="group-page min-h-screen bg-gray-900 flex flex-col items-center justify-center gap-4">
        <div className="text-red-400">{state.message}</div>
        <button
          onClick={loadGroupInfo}
          className="px-4 py-2 bg-gray-700 text-gray-200 rounded hover:bg-gray-600"
        >
          再試行
        </button>
      </div>
    );
  }

  const { groupInfo } = state;

  return (
    <div className="group-page min-h-screen bg-gray-900 text-gray-100 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">{groupInfo.name}</h1>

        {groupInfo.children.length === 0 ? (
          <p className="text-gray-400">このグループにはタブがありません</p>
        ) : (
          <ul className="space-y-2">
            {groupInfo.children.map((child) => (
              <li
                key={child.tabId}
                className="p-3 bg-gray-800 rounded hover:bg-gray-700 cursor-pointer"
                onClick={() => {
                  chrome.runtime.sendMessage({
                    type: 'ACTIVATE_TAB',
                    payload: { tabId: child.tabId },
                  });
                }}
              >
                <div className="font-medium">{child.title}</div>
                <div className="text-sm text-gray-400 truncate">{child.url}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default GroupPage;
