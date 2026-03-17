/* eslint-disable i18next/no-literal-string */
import { GetServerSidePropsContext } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useEffect, useCallback, useState } from 'react';
import Head from 'next/head';
import { MagnifyingGlassIcon, ArrowPathIcon, DocumentTextIcon } from '@heroicons/react/24/outline';
import useSWR from 'swr';
import fetcher from '@/lib/fetcher';
import { useRouter } from 'next/router';

type SearchUser = {
  id: string;
  name: string;
  department: string | null;
  position: string | null;
  email: string;
  _count?: { workLogs: number };
};

type WorklogItem = {
  id: string;
  date: string;
  content: string;
  createdAt: string;
  updatedAt: string;
};

const WorklogsPage = () => {
  const router = useRouter();
  const { data: profileData } = useSWR('/api/my/profile', fetcher);
  const myRole = profileData?.data?.role || profileData?.data?.teamMembers?.[0]?.role || '';

  // 업무일지: 내부 직원만 열람 가능
  if (profileData && ['PARTNER', 'GUEST', 'VIEWER'].includes(myRole)) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-lg font-semibold text-gray-300">접근 권한이 없습니다</p>
        <p className="text-sm text-gray-500 mt-1">업무일지는 내부 직원만 열람할 수 있습니다.</p>
        <button className="btn btn-ghost btn-sm mt-4" onClick={() => router.push('/dashboard')}>대시보드로</button>
      </div>
    );
  }

  const [keyword, setKeyword] = useState('');
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [searchUsers, setSearchUsers] = useState<SearchUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<SearchUser | null>(null);
  const [items, setItems] = useState<WorklogItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<WorklogItem | null>(null);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);
  const [error, setError] = useState('');

  const loadUsers = useCallback(async (q: string) => {
    setLoadingUsers(true);
    setError('');
    try {
      const res = await fetch(`/api/worklogs/search?q=${encodeURIComponent(q)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || '검색에 실패했습니다.');
      setSearchUsers(json.data?.users || []);
    } catch (err: any) {
      setError(err?.message || '검색에 실패했습니다.');
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  const loadUserLogs = useCallback(async (user: SearchUser, m: string) => {
    setLoadingItems(true);
    setSelectedUser(user);
    setSelectedItem(null);
    setError('');
    try {
      const res = await fetch(
        `/api/worklogs/search?targetUserId=${encodeURIComponent(user.id)}&month=${encodeURIComponent(m)}`
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || '조회에 실패했습니다.');
      setItems(json.data?.items || []);
    } catch (err: any) {
      setError(err?.message || '조회에 실패했습니다.');
    } finally {
      setLoadingItems(false);
    }
  }, []);

  useEffect(() => { loadUsers(''); }, [loadUsers]);

  // 월 변경 시 재조회
  useEffect(() => {
    if (selectedUser) loadUserLogs(selectedUser, month);
  }, [month, selectedUser, loadUserLogs]);

  const handleSelectUser = (user: SearchUser) => {
    loadUserLogs(user, month);
  };

  const headerTitle = selectedUser
    ? `${selectedUser.position ? `${selectedUser.position} ` : ''}${selectedUser.name} 업무일지`
    : '업무일지 열람';

  return (
    <>
      <Head><title>업무일지 열람 | LOOKUP9</title></Head>
      <div className="space-y-5">

        {/* 페이지 헤더 */}
        <div>
          <p className="text-xs text-gray-500 mb-0.5">경영관리</p>
          <h2 className="text-xl font-bold">업무일지 열람</h2>
          <p className="mt-0.5 text-xs text-gray-500">같은 회사 내부 직원의 업무일지를 검색하고 열람합니다.</p>
        </div>

        {error && (
          <div className="rounded-xl border border-red-800/50 bg-red-900/20 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">

          {/* 왼쪽: 직원 검색 */}
          <div className="space-y-3">
            <div className="rounded-xl border border-gray-800 bg-black/20 p-4">
              <p className="text-xs text-gray-500 mb-3">직원 검색</p>
              <div className="relative mb-3">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  className="input input-bordered input-sm w-full pl-9"
                  placeholder="이름 / 부서 / 직책"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') loadUsers(keyword); }}
                />
              </div>
              <div className="flex gap-2">
                <button
                  className={`btn btn-primary btn-sm flex-1 ${loadingUsers ? 'loading' : ''}`}
                  disabled={loadingUsers}
                  onClick={() => loadUsers(keyword)}
                >
                  검색
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    setKeyword('');
                    setSelectedUser(null);
                    setItems([]);
                    setSelectedItem(null);
                    loadUsers('');
                  }}
                >
                  <ArrowPathIcon className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* 직원 목록 */}
            <div className="rounded-xl border border-gray-800 bg-black/20 p-4">
              <p className="text-xs text-gray-500 mb-3">직원 목록 ({searchUsers.length}명)</p>
              {loadingUsers ? (
                <div className="py-6 text-center text-sm text-gray-500">불러오는 중...</div>
              ) : searchUsers.length === 0 ? (
                <div className="py-6 text-center text-sm text-gray-500">검색된 직원이 없습니다.</div>
              ) : (
                <div className="space-y-1.5 max-h-[420px] overflow-y-auto">
                  {searchUsers.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => handleSelectUser(user)}
                      className={`w-full rounded-lg border px-3 py-2.5 text-left transition ${
                        selectedUser?.id === user.id
                          ? 'border-blue-600/50 bg-blue-600/10'
                          : 'border-gray-800 hover:border-gray-700 hover:bg-gray-800/30'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {user.position ? `${user.position} ` : ''}{user.name}
                          </p>
                          <p className="text-xs text-gray-500 truncate mt-0.5">
                            {user.department || '-'}
                          </p>
                        </div>
                        <span className="shrink-0 rounded-full border border-gray-700 px-1.5 py-0.5 text-[10px] text-gray-400">
                          {(user._count?.workLogs || 0)}건
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 오른쪽: 업무일지 목록 + 상세 */}
          <div className="space-y-3">
            {/* 헤더 + 월 필터 */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-800 bg-black/20 px-4 py-3">
              <div>
                <p className="text-sm font-semibold">{headerTitle}</p>
                {selectedUser && (
                  <p className="text-xs text-gray-500 mt-0.5">{selectedUser.department || '-'} · {selectedUser.email}</p>
                )}
              </div>
              {selectedUser && (
                <input
                  type="month"
                  className="input input-bordered input-sm"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                />
              )}
            </div>

            {!selectedUser ? (
              <div className="flex min-h-[360px] items-center justify-center rounded-xl border border-dashed border-gray-700 text-sm text-gray-500">
                <div className="text-center">
                  <DocumentTextIcon className="mx-auto mb-2 h-8 w-8 text-gray-600" />
                  <p>왼쪽에서 직원을 선택하세요</p>
                </div>
              </div>
            ) : loadingItems ? (
              <div className="flex min-h-[360px] items-center justify-center rounded-xl border border-gray-800">
                <span className="loading loading-spinner loading-md text-gray-500" />
              </div>
            ) : items.length === 0 ? (
              <div className="flex min-h-[360px] items-center justify-center rounded-xl border border-dashed border-gray-700 text-sm text-gray-500">
                {month} 업무일지가 없습니다.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-[200px_minmax(0,1fr)]">
                {/* 날짜 목록 */}
                <div className="rounded-xl border border-gray-800 bg-black/20 p-3">
                  <p className="text-xs text-gray-500 mb-2">날짜 ({items.length}건)</p>
                  <div className="space-y-1 max-h-[480px] overflow-y-auto">
                    {items.map((item) => {
                      const d = new Date(item.date);
                      const isSelected = selectedItem?.id === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => setSelectedItem(item)}
                          className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                            isSelected
                              ? 'bg-blue-600/20 border border-blue-600/40 text-blue-300'
                              : 'hover:bg-gray-800/40 border border-transparent text-gray-300'
                          }`}
                        >
                          <p className="font-medium">
                            {d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', weekday: 'short' })}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5 truncate">
                            {item.content.slice(0, 20)}{item.content.length > 20 ? '…' : ''}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 내용 상세 */}
                <div className="rounded-xl border border-gray-800 bg-black/20 p-4">
                  {!selectedItem ? (
                    <div className="flex h-full min-h-[200px] items-center justify-center text-sm text-gray-500">
                      날짜를 선택하면 내용이 표시됩니다.
                    </div>
                  ) : (
                    <div>
                      <div className="mb-3 flex items-center justify-between border-b border-gray-800 pb-3">
                        <p className="text-sm font-semibold">
                          {new Date(selectedItem.date).toLocaleDateString('ko-KR', {
                            year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
                          })}
                        </p>
                        <p className="text-xs text-gray-500">
                          수정: {new Date(selectedItem.updatedAt).toLocaleString('ko-KR')}
                        </p>
                      </div>
                      <p className="whitespace-pre-wrap break-words text-sm leading-7 text-gray-200">
                        {selectedItem.content}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export async function getServerSideProps({ locale }: GetServerSidePropsContext) {
  return { props: { ...(locale ? await serverSideTranslations(locale, ['common']) : {}) } };
}

export default WorklogsPage;
