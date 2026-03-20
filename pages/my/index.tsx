/* eslint-disable i18next/no-literal-string */
import { GetServerSidePropsContext } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useTranslation } from 'next-i18next';
import { useSession } from 'next-auth/react';
import { useState, useCallback, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import {
  UserCircleIcon,
  EnvelopeIcon,
  PencilSquareIcon,
  ClipboardDocumentCheckIcon,
  UserPlusIcon,
  CheckCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import useSWR from 'swr';
import fetcher from '@/lib/fetcher';

const STATUS_DOT: Record<string, string> = {
  영업중: 'bg-red-500', 대기: 'bg-red-400', 계약완료: 'bg-yellow-400',
  진행중: 'bg-green-500', 부분완료: 'bg-green-300', 완료: 'bg-gray-400', 보류: 'bg-gray-600',
};

type MyTab = 'profile' | 'leave' | 'worklog' | 'sites' | 'activity' | 'approvals';

const MyPage = () => {
  const { t } = useTranslation('common');
  const { data: session } = useSession();
  const user = session?.user;
  const { data: userData } = useSWR(user ? '/api/my/profile' : null, fetcher);
  const profile = userData?.data || {};
  const [activeTab, setActiveTab] = useState<MyTab>('profile');

  const permissions = profile.permissions || {};
  const showApprovals = permissions.canApprove;

  const myRole = profile.role || profile.teamMembers?.[0]?.role || '';
  const isGuestOrViewer = ['GUEST', 'VIEWER'].includes(myRole);

  const tabs: { key: MyTab; label: string }[] = [
    { key: 'profile', label: '내 정보' },
    ...(!isGuestOrViewer ? [{ key: 'leave' as MyTab, label: '연차' }] : []),
    ...(!isGuestOrViewer ? [{ key: 'worklog' as MyTab, label: '업무일지' }] : []),
    { key: 'sites', label: '내 현장' },
    ...(!isGuestOrViewer ? [{ key: 'activity' as MyTab, label: '활동' }] : []),
    ...(showApprovals ? [{ key: 'approvals' as MyTab, label: '전자결재' }] : []),
  ];

  return (
    <>
      <Head><title>내 정보 | LOOKUP9</title></Head>
      <div className="space-y-5">

        {/* 프로필 헤더 카드 */}
        <div className="rounded-xl border border-gray-800 bg-black/20 p-5 flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gray-800">
            <UserCircleIcon className="h-9 w-9 text-gray-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold truncate">
              {profile.position ? `${profile.position} ` : ''}{user?.name}
            </h2>
            <p className="text-sm text-gray-400 truncate">{user?.email}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
              {profile.role && <span className="badge badge-sm badge-ghost">{profile.role}</span>}
              {profile.department && <span>{profile.department}</span>}
              {profile.company && <span>{profile.company}</span>}
            </div>
          </div>
          <div className="shrink-0 flex flex-col items-end gap-2">
            <Link href="/messages" className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition">
              <EnvelopeIcon className="h-4 w-4" />
              {(profile.unreadMessages || 0) > 0 && (
                <span className="badge badge-xs badge-primary">{profile.unreadMessages}</span>
              )}
            </Link>
          </div>
        </div>

        {/* 탭 */}
        <div className="border-b border-gray-800">
          <div className="flex gap-0.5 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`shrink-0 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {activeTab === 'profile' && <ProfileTab profile={profile} />}
        {activeTab === 'leave' && <LeaveTab />}
        {activeTab === 'worklog' && <WorkLogTab />}
        {activeTab === 'sites' && <MySitesTab sites={profile.mySites || []} />}
        {activeTab === 'activity' && <ActivityTab comments={profile.myComments || []} />}
        {activeTab === 'approvals' && <ApprovalsTab />}
      </div>
    </>
  );
};

// ========= 내 정보 탭 =========
const ProfileTab = ({ profile }: { profile: any }) => {
  const { t } = useTranslation('common');
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: '회사', value: profile.company },
          { label: '부서', value: profile.department },
          { label: '직책', value: profile.position },
          { label: '연락처', value: profile.phone },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border border-gray-800 bg-black/10 p-4">
            <p className="text-xs text-gray-500 mb-1">{item.label}</p>
            <p className="text-sm font-medium">{item.value || '-'}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Link href="/approvals" className="rounded-xl border border-gray-800 bg-black/10 p-4 hover:border-gray-600 transition">
          <div className="flex items-center gap-2 font-semibold mb-1">
            <ClipboardDocumentCheckIcon className="h-4 w-4 text-blue-400" />
            전자결재
          </div>
          <p className="text-xs text-gray-500 leading-5">승인/반려가 필요한 요청을 확인합니다.</p>
        </Link>
        <Link href="/guests" className="rounded-xl border border-gray-800 bg-black/10 p-4 hover:border-gray-600 transition">
          <div className="flex items-center gap-2 font-semibold mb-1">
            <UserPlusIcon className="h-4 w-4 text-blue-400" />
            게스트 관리
          </div>
          <p className="text-xs text-gray-500 leading-5">협력사/게스트 계정을 만들고 현장을 배정합니다.</p>
        </Link>
        <Link href="/worklogs" className="rounded-xl border border-gray-800 bg-black/10 p-4 hover:border-gray-600 transition">
          <div className="flex items-center gap-2 font-semibold mb-1">
            <PencilSquareIcon className="h-4 w-4 text-blue-400" />
            업무일지 열람
          </div>
          <p className="text-xs text-gray-500 leading-5">같은 회사 직원의 업무일지를 열람합니다.</p>
        </Link>
      </div>
    </div>
  );
};

// ========= 전자결재 탭 (실제 데이터) =========
const ApprovalsTab = () => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [working, setWorking] = useState('');

  const fetchItems = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/approvals');
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || '승인함을 불러오지 못했습니다.');
      setItems(json.data || []);
    } catch (err: any) {
      setError(err?.message || '승인함을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const act = async (requestId: string, action: 'approve' | 'reject') => {
    const note = window.prompt(action === 'approve' ? '승인 코멘트 (선택)' : '반려 사유', '') ?? '';
    setWorking(requestId);
    try {
      const res = await fetch('/api/approvals', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, action, result: note }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || '처리에 실패했습니다.');
      await fetchItems();
    } catch (err: any) {
      setError(err?.message || '처리에 실패했습니다.');
    } finally {
      setWorking('');
    }
  };

  const pending = items.filter((i) => !['승인완료', '반려'].includes(i.status));
  const done = items.filter((i) => ['승인완료', '반려'].includes(i.status));

  if (loading) return <div className="py-10 text-center"><span className="loading loading-spinner loading-md" /></div>;

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-xl border border-red-800/50 bg-red-900/20 px-4 py-3 text-sm text-red-300">{error}</div>
      )}

      <div className="flex items-center justify-between">
        <h3 className="font-semibold">전자결재 승인함</h3>
        <Link href="/approvals" className="text-xs text-blue-400 hover:underline">전체 보기 →</Link>
      </div>

      {pending.length === 0 && done.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-700 py-12 text-center text-sm text-gray-500">
          처리할 결재 항목이 없습니다.
        </div>
      ) : (
        <>
          {pending.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-gray-500 font-medium">대기중 ({pending.length})</p>
              {pending.map((item) => (
                <div key={item.id} className="rounded-xl border border-yellow-800/40 bg-yellow-900/10 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="badge badge-xs badge-warning">{item.type}</span>
                        <span className="text-sm font-medium">{item.title}</span>
                      </div>
                      <p className="text-xs text-gray-400">
                        [{item.site?.name}] · {item.createdBy?.position ? `${item.createdBy.position} ` : ''}{item.createdBy?.name}
                        {item.targetDept && ` → ${item.targetDept}`}
                      </p>
                      {item.description && (
                        <p className="mt-1 text-xs text-gray-500 line-clamp-2">{item.description}</p>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button
                        className={`btn btn-success btn-xs gap-1 ${working === item.id ? 'loading' : ''}`}
                        disabled={!!working}
                        onClick={() => act(item.id, 'approve')}
                      >
                        <CheckCircleIcon className="h-3.5 w-3.5" />
                        승인
                      </button>
                      <button
                        className={`btn btn-error btn-xs gap-1 ${working === item.id ? 'loading' : ''}`}
                        disabled={!!working}
                        onClick={() => act(item.id, 'reject')}
                      >
                        <XCircleIcon className="h-3.5 w-3.5" />
                        반려
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {done.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-gray-500 font-medium">처리 완료 ({done.length})</p>
              {done.slice(0, 5).map((item) => (
                <div key={item.id} className="rounded-xl border border-gray-800 bg-black/10 p-3 opacity-70">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`badge badge-xs ${item.status === '승인완료' ? 'badge-success' : 'badge-error'}`}>
                      {item.status}
                    </span>
                    <span className="text-sm">{item.title}</span>
                    <span className="text-xs text-gray-500 ml-auto">[{item.site?.name}]</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

// ========= 연차 탭 =========
const leaveTypes = ['연차', '반차(오전)', '반차(오후)', '병가', '경조', '기타'];
const LeaveTab = () => {
  const { t } = useTranslation('common');
  const [balance, setBalance] = useState<any>(null);
  const [requests, setRequests] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ type: '연차', startDate: '', endDate: '', days: '1', reason: '' });
  const [sub, setSub] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const res = await fetch('/api/leaves');
    if (res.ok) { const d = await res.json(); setBalance(d.data?.balance); setRequests(d.data?.requests || []); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async () => {
    if (!form.startDate) { setError('시작일을 선택하세요.'); return; }
    setSub(true); setError('');
    const res = await fetch('/api/leaves', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, days: Number(form.days) }),
    });
    const json = await res.json();
    if (!res.ok) { setError(json?.error?.message || '신청에 실패했습니다.'); setSub(false); return; }
    setForm({ type: '연차', startDate: '', endDate: '', days: '1', reason: '' });
    setShowForm(false); setSub(false); load();
  };

  const statusBadge = (s: string) =>
    s === '승인' ? 'badge-success' : s === '반려' ? 'badge-error' : s === '최종승인' ? 'badge-success' : 'badge-warning';

  return (
    <div className="space-y-4">
      {/* 잔여 연차 */}
      {balance && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: '총 연차', value: `${balance.total}일` },
            { label: '사용', value: `${balance.used}일` },
            { label: '잔여', value: `${balance.remaining}일` },
          ].map((b) => (
            <div key={b.label} className="rounded-xl border border-gray-800 bg-black/10 p-4 text-center">
              <p className="text-xs text-gray-500 mb-1">{b.label}</p>
              <p className="text-xl font-bold">{b.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* 신청 버튼 */}
      <div className="flex justify-end">
        <button className="btn btn-primary btn-sm" onClick={() => setShowForm(!showForm)}>
          {showForm ? '취소' : '연차 신청'}
        </button>
      </div>

      {showForm && (
        <div className="rounded-xl border border-gray-700 bg-black/20 p-4 space-y-3">
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">유형</label>
              <select className="select select-bordered select-sm w-full" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                {leaveTypes.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">일수</label>
              <input type="number" min="0.5" step="0.5" className="input input-bordered input-sm w-full" value={form.days} onChange={(e) => setForm({ ...form, days: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">시작일 *</label>
              <input type="date" className="input input-bordered input-sm w-full" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">종료일</label>
              <input type="date" className="input input-bordered input-sm w-full" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-gray-400 mb-1">사유</label>
              <textarea className="textarea textarea-bordered w-full text-sm" rows={2} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end">
            <button className={`btn btn-primary btn-sm ${sub ? 'loading' : ''}`} disabled={sub} onClick={handleSubmit}>신청</button>
          </div>
        </div>
      )}

      {/* 신청 목록 */}
      {requests.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-500">{t('leave-no-requests')}</p>
      ) : (
        <div className="space-y-2">
          {requests.map((r: any) => (
            <div key={r.id} className="rounded-xl border border-gray-800 p-3">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className={`badge badge-xs ${statusBadge(r.status)}`}>{r.status}</span>
                <span className="text-sm font-medium">{r.type}</span>
                <span className="text-xs text-gray-500">{r.days}일</span>
                <span className="ml-auto text-xs text-gray-500">
                  {new Date(r.startDate).toLocaleDateString('ko-KR')}
                  {r.endDate && ` ~ ${new Date(r.endDate).toLocaleDateString('ko-KR')}`}
                </span>
              </div>
              {r.reason && <p className="text-xs text-gray-400">{r.reason}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ========= 업무일지 탭 =========
const WorkLogTab = () => {
  const { t } = useTranslation('common');
  const today = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(today);
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);

  const loadLog = useCallback(async (date: string) => {
    setSelectedDate(date); setSaved(false);
    const res = await fetch(`/api/my/worklog?date=${date}`);
    if (res.ok) { const data = await res.json(); setContent(data.data?.content || ''); }
    else setContent('');
  }, []);

  const loadMonth = useCallback(async () => {
    const month = selectedDate.substring(0, 7);
    const res = await fetch(`/api/my/worklog?month=${month}`);
    if (res.ok) { const data = await res.json(); setLogs(data.data || []); }
  }, [selectedDate]);

  useEffect(() => { loadLog(today); }, [loadLog, today]);
  useEffect(() => { loadMonth(); }, [loadMonth]);

  const handleSave = async () => {
    if (!content.trim()) return;
    setSaving(true);
    await fetch('/api/my/worklog', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: selectedDate, content }),
    });
    setSaving(false); setSaved(true); loadMonth();
  };

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
      {/* 작성 영역 */}
      <div className="lg:col-span-2 space-y-3">
        <div className="flex items-center gap-3">
          <input
            type="date"
            className="input input-bordered input-sm"
            value={selectedDate}
            onChange={(e) => loadLog(e.target.value)}
          />
          <span className="text-sm text-gray-400">
            {new Date(selectedDate).toLocaleDateString('ko-KR', {
              weekday: 'short', year: 'numeric', month: 'long', day: 'numeric',
            })}
          </span>
        </div>
        <textarea
          className="textarea textarea-bordered w-full text-sm"
          rows={12}
          placeholder="오늘의 업무 내용을 기록하세요..."
          value={content}
          onChange={(e) => { setContent(e.target.value); setSaved(false); }}
        />
        <div className="flex items-center justify-between">
          <p className="text-xs">
            {saved && <span className="text-green-400">저장되었습니다 ✓</span>}
          </p>
          <button
            className={`btn btn-primary btn-sm ${saving ? 'loading' : ''}`}
            disabled={saving}
            onClick={handleSave}
          >
            <PencilSquareIcon className="h-4 w-4 mr-1" />
            저장
          </button>
        </div>
      </div>

      {/* 월별 목록 */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-gray-400">이번 달 기록</h3>
        {logs.length === 0 ? (
          <p className="text-sm text-gray-500">기록이 없습니다.</p>
        ) : (
          <div className="space-y-1 max-h-[480px] overflow-y-auto">
            {logs.map((log: any) => {
              const d = new Date(log.date).toISOString().split('T')[0];
              const isActive = d === selectedDate;
              return (
                <button
                  key={log.id}
                  onClick={() => loadLog(d)}
                  className={`w-full text-left rounded-lg px-3 py-2 text-sm transition ${
                    isActive
                      ? 'bg-blue-900/30 border border-blue-800 text-blue-300'
                      : 'hover:bg-gray-800/50 border border-transparent text-gray-300'
                  }`}
                >
                  <p className={`font-medium ${isActive ? 'text-blue-300' : ''}`}>
                    {new Date(log.date).toLocaleDateString('ko-KR', {
                      month: 'short', day: 'numeric', weekday: 'short',
                    })}
                  </p>
                  <p className="text-xs text-gray-500 truncate mt-0.5">
                    {log.content.substring(0, 40)}{log.content.length > 40 ? '…' : ''}
                  </p>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

// ========= 내 현장 탭 =========
const MySitesTab = ({ sites }: { sites: any[] }) => {
  if (sites.length === 0) return (
    <p className="py-10 text-center text-sm text-gray-500">배정된 현장이 없습니다.</p>
  );
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {sites.map((site: any) => (
        <Link key={site.id} href={`/sites/${site.id}`}>
          <div className="rounded-xl border border-gray-800 bg-black/10 p-4 hover:border-gray-600 transition cursor-pointer">
            <div className="flex items-center gap-2">
              <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[site.status] || 'bg-gray-400'}`} />
              <span className="font-medium text-sm truncate">{site.name}</span>
              <span className="text-xs text-gray-500 ml-auto shrink-0">{site.status}</span>
            </div>
            {site.address && <p className="text-xs text-gray-500 mt-1 ml-3.5 truncate">{site.address}</p>}
          </div>
        </Link>
      ))}
    </div>
  );
};

// ========= 내 활동 탭 =========
const ActivityTab = ({ comments }: { comments: any[] }) => {
  if (comments.length === 0) return (
    <p className="py-10 text-center text-sm text-gray-500">최근 활동이 없습니다.</p>
  );
  return (
    <div className="space-y-2">
      {comments.map((c: any) => (
        <Link key={c.id} href={`/sites/${c.site?.id}`}>
          <div className="flex items-start justify-between gap-3 rounded-lg border border-gray-800 px-3 py-2.5 hover:bg-gray-800/30 cursor-pointer">
            <p className="text-sm flex-1 min-w-0 truncate">
              <span className="text-gray-500">[{c.site?.name}]</span>{' '}
              {c.content.length > 60 ? c.content.slice(0, 60) + '…' : c.content}
            </p>
            <span className="shrink-0 text-xs text-gray-500">
              {new Date(c.createdAt).toLocaleDateString('ko-KR')}
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
};

export async function getServerSideProps({ locale }: GetServerSidePropsContext) {
  return { props: { ...(locale ? await serverSideTranslations(locale, ['common']) : {}) } };
}

export default MyPage;
