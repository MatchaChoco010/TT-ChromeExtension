import React, { useEffect, useState, useCallback, useRef } from 'react';

interface ChildTabInfo {
  tabId: number;
  title: string;
  url: string;
}

interface GroupInfo {
  nodeId: string;
  name: string;
  children: ChildTabInfo[];
}

type PageState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'loaded'; groupInfo: GroupInfo };

const POLLING_INTERVAL_MS = 2000;

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
  const [tabId, setTabId] = useState<number | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    chrome.tabs.getCurrent().then((tab) => {
      if (tab?.id) {
        setTabId(tab.id);
      }
    });
  }, []);

  const loadGroupInfo = useCallback(async () => {
    if (!tabId) {
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadGroupInfo();
  }, [loadGroupInfo]);

  useEffect(() => {
    if (state.status !== 'loaded') return;

    const intervalId = setInterval(() => {
      loadGroupInfo();
    }, POLLING_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [state.status, loadGroupInfo]);

  const handleStartEdit = useCallback(() => {
    if (state.status === 'loaded') {
      setEditedTitle(state.groupInfo.name);
      setIsEditing(true);
    }
  }, [state]);

  const handleSaveTitle = useCallback(async () => {
    if (state.status !== 'loaded' || !editedTitle.trim()) {
      setIsEditing(false);
      return;
    }

    try {
      await chrome.runtime.sendMessage({
        type: 'UPDATE_GROUP_NAME',
        payload: { nodeId: state.groupInfo.nodeId, name: editedTitle.trim() },
      });
      await loadGroupInfo();
    } catch {
      // エラーは無視
    }
    setIsEditing(false);
  }, [state, editedTitle, loadGroupInfo]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSaveTitle();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
    }
  }, [handleSaveTitle]);

  useEffect(() => {
    if (isEditing && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditing]);

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
        <div className="flex items-center gap-3 mb-6">
          {isEditing ? (
            <input
              ref={titleInputRef}
              type="text"
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              onBlur={handleSaveTitle}
              onKeyDown={handleKeyDown}
              className="text-2xl font-bold bg-gray-800 text-gray-100 px-2 py-1 rounded border border-gray-600 focus:outline-none focus:border-blue-500 flex-1"
              data-testid="group-title-input"
            />
          ) : (
            <>
              <h1 className="text-2xl font-bold">{groupInfo.name}</h1>
              <button
                onClick={handleStartEdit}
                className="p-1 text-gray-400 hover:text-gray-200 hover:bg-gray-700 rounded"
                title="タイトルを編集"
                data-testid="edit-group-title-button"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                  <path d="m15 5 4 4" />
                </svg>
              </button>
            </>
          )}
        </div>

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
