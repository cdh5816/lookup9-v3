/*
 * AIRX (individual business) proprietary source.
 * Owner: AIRX / choe DONGHYUN. All rights reserved.
 */

import { GetServerSidePropsContext } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import { MagnifyingGlassIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { Button } from 'react-daisyui';

type SearchUser = {
  id: string;
  name: string;
  department: string | null;
  position: string | null;
  email: string;
  _count?: {
    workLogs: number;
  };
};

type WorklogItem = {
  id: string;
  content: string;
  date: string;
  createdAt: string;
  user?: {
    id: string;
    name: string;
    department?: string | null;
    position?: string | null;
  };
};

type RecentViewItem = {
  targetUserId: string;
  viewedAt: string;
  keyword?: string | null;
  targetUser: {
    id: string;
    name: string;
    department?: string | null;
    position?: string | null;
  };
};

const WorklogsPage = () => {
  const [keyword, setKeyword] = useState('');
  const [searchUsers, setSearchUsers] = useState<SearchUser[]>([]);
  const [recentViews, setRecentViews] = useState<RecentViewItem[]>([]);
  const [selectedUser, setSelectedUser] = useState<SearchUser | null>(null);
  const [items, setItems] = useState<WorklogItem[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);
  const [error, setError] = useState('');

  const loadUsers = async (q = '') => {
    setLoadingUsers(true);
    setError('');

    try {
      const res = await fetch(`/api/worklogs/search?q=${encodeURIComponent(q)}`);
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error?.message || '업무일지 검색에 실패했습니다.');
      }

      setSearchUsers(json.data?.users || []);
      setRecentViews(json.data?.recentViews || []);
    } catch (err: any) {
      setError(err?.message || '업무일지 검색에 실패했습니다.');
    } finally {
      setLoadingUsers(false);
    }
  };

  const loadUserLogs = async (user: SearchUser, q = '') => {
    setLoadingItems(true);
    setError('');

    try {
      const res = await fetch(
        `/api/worklogs/search?targetUserId=${encodeURIComponent(user.id)}&q=${encodeURIComponent(q)}`
      );
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error?.message || '업무일지 조회에 실패했습니다.');
      }

      setSelectedUser({
        id: json.data?.targetUser?.id,
        name: json.data?.targetUser?.name,
        department: json.data?.targetUser?.department,
        position: json.data?.targetUser?.position,
        email: json.data?.targetUser?.email || '',
      });
      setItems(json.data?.items || []);
      await loadUsers(keyword);
    } catch (err: any) {
      setError(err?.message || '업무일지 조회에 실패했습니다.');
    } finally {
      setLoadingItems(false);
    }
  };

  useEffect(() => {
    loadUsers('');
  }, []);

  const headerTitle = useMemo(() => {
    if (!selectedUser) return '업무일지 검색';
    return `${selectedUser.position ? `${selectedUser.position} ` : ''}${selectedUser.name} 업무일지`;
  }, [selectedUser]);

  return (
    <>
      <Head>
        <title>업무일지 열람 | LOOKUP9</title>
      </Head>

      <div className="space-y-6">
        <div className="rounded-2xl border border-gray-800 bg-black/20 p-5">
          <h1 className="text-2xl font-bold">업무일지 열람</h1>
          <p className="mt-2 text-sm text-gray-400">
            같은 회사 내부 직원의 업무일지를 검색하고 열람할 수 있습니다. 열람 기록은 저장됩니다.
          </p>
        </div>

        {error ? (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <div className="space-y-4">
            <div className="rounded-2xl border border-gray-800 bg-black/20 p-4">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  className="input input-bordered w-full pl-10"
                  placeholder="이름 / 부서 / 직책 / 이메일 검색"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') loadUsers(keyword);
                  }}
                />
              </div>

              <div className="mt-3 flex gap-2">
                <Button color="primary" size="sm" onClick={() => loadUsers(keyword)} loading={loadingUsers}>
                  검색
                </Button>
                <Button
                  color="ghost"
                  size="sm"
                  onClick={() => {
                    setKeyword('');
                    setSelectedUser(null);
                    setItems([]);
                    loadUsers('');
                  }}
                >
                  <ArrowPathIcon className="mr-1 h-4 w-4" />
                  초기화
                </Button>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-800 bg-black/20 p-4">
              <h2 className="mb-3 text-sm font-semibold text-gray-300">직원 검색 결과</h2>

              {loadingUsers ? (
                <div className="py-6 text-center text-sm text-gray-500">불러오는 중...</div>
              ) : searchUsers.length === 0 ? (
                <div className="py-6 text-center text-sm text-gray-500">검색된 직원이 없습니다.</div>
              ) : (
                <div className="space-y-2">
                  {searchUsers.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => loadUserLogs(user, keyword)}
                      className={`w-full rounded-xl border p-3 text-left transition ${
                        selectedUser?.id === user.id
                          ? 'border-blue-500/50 bg-blue-500/10'
                          : 'border-gray-800 bg-black/10 hover:border-gray-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-semibold">
                            {user.position ? `${user.position} ` : ''}
                            {user.name}
                          </p>
                          <p className="mt-1 truncate text-xs text-gray-500">
                            {user.department || '-'} · {user.email}
                          </p>
                        </div>
                        <span className="rounded-full border border-gray-700 px-2 py-0.5 text-xs text-gray-300">
                          {(user._count?.workLogs || 0).toLocaleString()}건
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-gray-800 bg-black/20 p-4">
              <h2 className="mb-3 text-sm font-semibold text-gray-300">내 최근 열람기록</h2>

              {recentViews.length === 0 ? (
                <div className="py-4 text-sm text-gray-500">열람기록이 없습니다.</div>
              ) : (
                <div className="space-y-2">
                  {recentViews.map((item) => (
                    <button
                      key={`${item.targetUserId}-${item.viewedAt}`}
                      type="button"
                      onClick={() =>
                        loadUserLogs(
                          {
                            id: item.targetUser.id,
                            name: item.targetUser.name,
                            department: item.targetUser.department || null,
                            position: item.targetUser.position || null,
                            email: '',
                          },
                          item.keyword || ''
                        )
                      }
                      className="w-full rounded-xl border border-gray-800 bg-black/10 p-3 text-left hover:border-gray-700"
                    >
                      <p className="font-medium">
                        {item.targetUser.position ? `${item.targetUser.position} ` : ''}
                        {item.targetUser.name}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        {item.targetUser.department || '-'} ·{' '}
                        {new Date(item.viewedAt).toLocaleString('ko-KR')}
                      </p>
                      {item.keyword ? (
                        <p className="mt-1 text-xs text-blue-300">검색어: {item.keyword}</p>
                      ) : null}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-gray-800 bg-black/20 p-5">
            <div className="flex items-center justify-between gap-3 border-b border-gray-800 pb-4">
              <div>
                <h2 className="text-xl font-bold">{headerTitle}</h2>
                {selectedUser ? (
                  <p className="mt-1 text-sm text-gray-500">
                    {selectedUser.department || '-'} / {selectedUser.email || '-'}
                  </p>
                ) : (
                  <p className="mt-1 text-sm text-gray-500">왼쪽에서 직원을 선택하면 업무일지가 표시됩니다.</p>
                )}
              </div>
            </div>

            {!selectedUser ? (
              <div className="flex min-h-[420px] items-center justify-center text-sm text-gray-500">
                직원 선택 대기 중
              </div>
            ) : loadingItems ? (
              <div className="flex min-h-[420px] items-center justify-center text-sm text-gray-500">
                업무일지 불러오는 중...
              </div>
            ) : items.length === 0 ? (
              <div className="flex min-h-[420px] items-center justify-center text-sm text-gray-500">
                업무일지가 없습니다.
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {items.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-gray-800 bg-black/10 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-gray-700 px-2 py-0.5 text-xs text-gray-300">
                        업무일지
                      </span>
                      <span className="text-sm font-semibold">{new Date(item.date).toLocaleDateString('ko-KR')}</span>
                      <span className="text-xs text-gray-500">
                        {new Date(item.createdAt).toLocaleString('ko-KR')}
                      </span>
                    </div>

                    <div className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-gray-100">
                      {item.content}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export async function getServerSideProps({ locale }: GetServerSidePropsContext) {
  return {
    props: {
      ...(locale ? await serverSideTranslations(locale, ['common']) : {}),
    },
  };
}

export default WorklogsPage;
