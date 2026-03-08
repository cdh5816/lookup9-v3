import { GetServerSidePropsContext } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useTranslation } from 'next-i18next';
import { useSession } from 'next-auth/react';
import { useState, useCallback, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { UserCircleIcon, EnvelopeIcon, PencilSquareIcon, PlusIcon } from '@heroicons/react/24/outline';
import useSWR from 'swr';
import fetcher from '@/lib/fetcher';
import { Button } from 'react-daisyui';

const STATUS_DOT: Record<string, string> = {
  '영업중': 'bg-red-500', '대기': 'bg-red-400', '계약완료': 'bg-yellow-400',
  '진행중': 'bg-green-500', '부분완료': 'bg-green-300', '완료': 'bg-gray-400', '보류': 'bg-gray-600',
};

type MyTab = 'profile' | 'leave' | 'worklog' | 'sites' | 'activity';

const MyPage = () => {
  const { t } = useTranslation('common');
  const { data: session } = useSession();
  const user = session?.user;
  const { data: userData } = useSWR(user ? '/api/my/profile' : null, fetcher);
  const profile = userData?.data || {};
  const [activeTab, setActiveTab] = useState<MyTab>('profile');

  const tabs: { key: MyTab; label: string }[] = [
    { key: 'profile', label: t('my-tab-profile') },
    { key: 'leave', label: t('my-leave-status') },
    { key: 'worklog', label: t('my-tab-worklog') },
    { key: 'sites', label: t('my-sites') },
    { key: 'activity', label: t('my-tab-activity') },
  ];

  return (
    <>
      <Head><title>{t('my-page-title')} | LOOKUP9</title></Head>
      <div className="space-y-6">
        {/* 헤더 카드 */}
        <div className="rounded-lg border border-gray-800 p-5 flex items-center gap-4">
          <UserCircleIcon className="w-14 h-14 text-gray-500 shrink-0" />
          <div className="flex-1">
            <h2 className="text-lg font-bold">{profile.position && `${profile.position} `}{user?.name}</h2>
            <p className="text-sm text-gray-400">{user?.email}</p>
            <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
              {profile.teamMembers?.[0]?.role && <span className="badge badge-sm badge-ghost">{profile.teamMembers[0].role}</span>}
              {profile.department && <span>{profile.department}</span>}
              {profile.company && <span>{profile.company}</span>}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <Link href="/messages" className="flex items-center gap-1 text-sm text-gray-400 hover:text-white">
              <EnvelopeIcon className="w-4 h-4" />
              {(profile.unreadMessages || 0) > 0 && <span className="badge badge-xs badge-primary">{profile.unreadMessages}</span>}
            </Link>
          </div>
        </div>

        {/* 탭 */}
        <div className="border-b border-gray-800">
          <div className="flex gap-1">
            {tabs.map((tab) => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.key ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}>
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
      </div>
    </>
  );
};

// ========= 내 정보 탭 =========
const ProfileTab = ({ profile }: { profile: any }) => {
  const { t } = useTranslation('common');
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: t('admin-company'), value: profile.company },
          { label: t('admin-department'), value: profile.department },
          { label: t('admin-position'), value: profile.position },
          { label: t('admin-phone'), value: profile.phone },
        ].map((item) => (
          <div key={item.label} className="rounded-lg border border-gray-800 p-4">
            <p className="text-xs text-gray-500 mb-1">{item.label}</p>
            <p className="text-sm font-medium">{item.value || '-'}</p>
          </div>
        ))}
      </div>
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

  const fetchData = useCallback(async () => {
    const [bRes, rRes] = await Promise.all([
      fetch('/api/leave/balance'),
      fetch('/api/leave/requests'),
    ]);
    if (bRes.ok) { const d = await bRes.json(); setBalance(d.data); }
    if (rRes.ok) { const d = await rRes.json(); setRequests(d.data || []); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSubmit = async () => {
    if (!form.startDate || !form.endDate) { setError(t('leave-fill-dates')); return; }
    setSub(true); setError('');
    const res = await fetch('/api/leave/requests', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setForm({ type: '연차', startDate: '', endDate: '', days: '1', reason: '' });
      setShowForm(false); fetchData();
    } else { const d = await res.json(); setError(d.error?.message || ''); }
    setSub(false);
  };

  const total = balance ? Number(balance.totalDays) : 0;
  const used = balance ? Number(balance.usedDays) : 0;
  const remaining = total - used;

  const statusColors: Record<string, string> = {
    '신청': 'badge-info', '승인': 'badge-success', '반려': 'badge-error',
  };
  const stepLabels: Record<string, string> = {
    '부서장승인대기': t('leave-step-manager'),
    '최종승인대기': t('leave-step-admin'),
    '완료': t('leave-step-done'),
  };

  return (
    <div className="space-y-6">
      {/* 잔여 현황 */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-blue-800 bg-blue-900/10 p-4 text-center">
          <p className="text-2xl font-bold text-blue-400">{total}</p>
          <p className="text-xs text-gray-500 mt-1">{t('my-leave-total')}</p>
        </div>
        <div className="rounded-lg border border-yellow-800 bg-yellow-900/10 p-4 text-center">
          <p className="text-2xl font-bold text-yellow-400">{used}</p>
          <p className="text-xs text-gray-500 mt-1">{t('my-leave-used')}</p>
        </div>
        <div className="rounded-lg border border-green-800 bg-green-900/10 p-4 text-center">
          <p className="text-2xl font-bold text-green-400">{remaining}</p>
          <p className="text-xs text-gray-500 mt-1">{t('my-leave-remaining')}</p>
        </div>
      </div>

      {/* 신청 버튼 */}
      <div className="flex justify-end">
        <Button size="sm" color="primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? t('cancel') : <><PlusIcon className="w-4 h-4 mr-1" />{t('leave-apply')}</>}
        </Button>
      </div>

      {error && <div className="alert alert-error text-sm"><span>{error}</span></div>}

      {/* 신청 폼 */}
      {showForm && (
        <div className="border border-gray-700 rounded-lg p-5 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div><label className="label"><span className="label-text text-xs">{t('leave-type')}</span></label>
              <select className="select select-bordered select-sm w-full" value={form.type} onChange={(e) => {
                const t = e.target.value;
                setForm({ ...form, type: t, days: t.includes('반차') ? '0.5' : '1' });
              }}>{leaveTypes.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
            <div><label className="label"><span className="label-text text-xs">{t('start-date')} *</span></label>
              <input type="date" className="input input-bordered input-sm w-full" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></div>
            <div><label className="label"><span className="label-text text-xs">{t('end-date')} *</span></label>
              <input type="date" className="input input-bordered input-sm w-full" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></div>
            <div><label className="label"><span className="label-text text-xs">{t('leave-days')}</span></label>
              <input type="number" step="0.5" className="input input-bordered input-sm w-full" value={form.days} onChange={(e) => setForm({ ...form, days: e.target.value })} /></div>
          </div>
          <div><label className="label"><span className="label-text text-xs">{t('leave-reason')}</span></label>
            <textarea className="textarea textarea-bordered w-full text-sm" rows={2} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></div>
          <div className="flex justify-end"><Button size="sm" color="primary" loading={sub} onClick={handleSubmit}>{t('leave-submit')}</Button></div>
        </div>
      )}

      {/* 신청 목록 */}
      <div>
        <h3 className="text-sm font-semibold text-gray-400 mb-3">{t('leave-my-list')}</h3>
        {requests.length === 0 ? (
          <p className="text-sm text-gray-600 text-center py-4">{t('leave-no-requests')}</p>
        ) : (
          <div className="space-y-2">
            {requests.map((r: any) => (
              <div key={r.id} className="rounded border border-gray-800 p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{r.type}</span>
                    <span className="text-sm">{Number(r.days)}일</span>
                    <span className={`badge badge-xs ${statusColors[r.status] || 'badge-ghost'}`}>{r.status}</span>
                  </div>
                  <span className="text-xs text-gray-500">{stepLabels[r.currentStep] || r.currentStep}</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {new Date(r.startDate).toLocaleDateString('ko-KR')} ~ {new Date(r.endDate).toLocaleDateString('ko-KR')}
                  {r.reason && ` · ${r.reason}`}
                </p>
                {r.managerAction === '반려' && r.managerNote && <p className="text-xs text-red-400 mt-1">{t('leave-reject-reason')}: {r.managerNote}</p>}
                {r.adminAction === '반려' && r.adminNote && <p className="text-xs text-red-400 mt-1">{t('leave-reject-reason')}: {r.adminNote}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
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

  // 오늘 날짜 로그 불러오기
  const loadLog = useCallback(async (date: string) => {
    setSelectedDate(date);
    setSaved(false);
    const res = await fetch(`/api/my/worklog?date=${date}`);
    if (res.ok) {
      const data = await res.json();
      setContent(data.data?.content || '');
    } else {
      setContent('');
    }
  }, []);

  // 월별 목록
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
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: selectedDate, content }),
    });
    setSaving(false); setSaved(true); loadMonth();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* 작성 영역 */}
      <div className="lg:col-span-2 space-y-3">
        <div className="flex items-center gap-3">
          <input type="date" className="input input-bordered input-sm" value={selectedDate}
            onChange={(e) => loadLog(e.target.value)} />
          <span className="text-sm text-gray-400">
            {new Date(selectedDate).toLocaleDateString('ko-KR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </span>
        </div>
        <textarea className="textarea textarea-bordered w-full text-sm" rows={12} placeholder={t('worklog-placeholder')}
          value={content} onChange={(e) => { setContent(e.target.value); setSaved(false); }} />
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-500">
            {saved && <span className="text-green-400">{t('worklog-saved')}</span>}
          </p>
          <Button size="sm" color="primary" loading={saving} onClick={handleSave}>
            <PencilSquareIcon className="w-4 h-4 mr-1" />{t('worklog-save')}
          </Button>
        </div>
      </div>

      {/* 월별 목록 */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-gray-400">{t('worklog-history')}</h3>
        {logs.length === 0 ? (
          <p className="text-sm text-gray-600">{t('worklog-empty')}</p>
        ) : (
          <div className="space-y-1 max-h-96 overflow-y-auto">
            {logs.map((log: any) => {
              const d = new Date(log.date).toISOString().split('T')[0];
              const isActive = d === selectedDate;
              return (
                <button key={log.id} onClick={() => loadLog(d)}
                  className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${isActive ? 'bg-blue-900/30 border border-blue-800' : 'hover:bg-gray-800/50'}`}>
                  <div className="flex justify-between">
                    <span className={isActive ? 'text-blue-400 font-medium' : 'text-gray-300'}>
                      {new Date(log.date).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', weekday: 'short' })}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 truncate mt-0.5">{log.content.substring(0, 40)}...</p>
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
  const { t } = useTranslation('common');
  if (sites.length === 0) return <p className="text-sm text-gray-500 py-10 text-center">{t('my-no-sites')}</p>;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {sites.map((site: any) => (
        <Link key={site.id} href={`/sites/${site.id}`}>
          <div className="rounded-lg border border-gray-800 p-4 hover:border-gray-600 transition-colors cursor-pointer">
            <div className="flex items-center gap-2">
              <span className={`inline-block w-2 h-2 rounded-full ${STATUS_DOT[site.status] || 'bg-gray-400'}`} />
              <span className="font-medium text-sm">{site.name}</span>
              <span className="text-xs text-gray-500 ml-auto">{site.status}</span>
            </div>
            {site.address && <p className="text-xs text-gray-500 mt-1 ml-4">{site.address}</p>}
          </div>
        </Link>
      ))}
    </div>
  );
};

// ========= 내 활동 탭 =========
const ActivityTab = ({ comments }: { comments: any[] }) => {
  const { t } = useTranslation('common');
  if (comments.length === 0) return <p className="text-sm text-gray-500 py-10 text-center">{t('my-no-posts')}</p>;
  return (
    <div className="space-y-2">
      {comments.map((c: any) => (
        <Link key={c.id} href={`/sites/${c.site?.id}`}>
          <div className="flex items-center justify-between py-2 px-3 rounded hover:bg-gray-800/50 transition-colors cursor-pointer">
            <p className="text-sm truncate flex-1">
              <span className="text-gray-500">[{c.site?.name}]</span>{' '}
              {c.content.length > 60 ? c.content.slice(0, 60) + '...' : c.content}
            </p>
            <span className="text-xs text-gray-500 shrink-0 ml-3">{new Date(c.createdAt).toLocaleDateString('ko-KR')}</span>
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
