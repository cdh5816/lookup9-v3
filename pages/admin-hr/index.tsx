import { GetServerSidePropsContext } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useTranslation } from 'next-i18next';
import { useState, useCallback, useEffect } from 'react';
import Head from 'next/head';
import { Button } from 'react-daisyui';
import { PlusIcon, TrashIcon, XMarkIcon } from '@heroicons/react/24/outline';
import useSWR from 'swr';
import fetcher from '@/lib/fetcher';

type HrTab = 'notices' | 'stats' | 'leave';

const AdminHrPage = () => {
  const { t } = useTranslation('common');
  const [activeTab, setActiveTab] = useState<HrTab>('notices');

  const tabs: { key: HrTab; label: string }[] = [
    { key: 'notices', label: t('dash-notice') },
    { key: 'stats', label: t('hr-company-stats') },
    { key: 'leave', label: t('hr-leave-management') },
  ];

  return (
    <>
      <Head><title>{t('nav-admin-hr')} | LOOKUP9</title></Head>
      <div className="space-y-6">
        <h2 className="text-xl font-bold">{t('nav-admin-hr')}</h2>

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

        {activeTab === 'notices' && <NoticePanel />}
        {activeTab === 'stats' && <StatsPanel />}
        {activeTab === 'leave' && <LeaveAdminPanel />}
      </div>
    </>
  );
};

// ========= 공지 관리 =========
const NoticePanel = () => {
  const { t } = useTranslation('common');
  const [notices, setNotices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', content: '', isPinned: false });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const fetchNotices = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/notices');
    if (res.ok) { const data = await res.json(); setNotices(data.data || []); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchNotices(); }, [fetchNotices]);

  const handleCreate = async () => {
    if (!form.title || !form.content) { setError(t('msg-fill-all')); return; }
    setSubmitting(true); setError('');
    const res = await fetch('/api/notices', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setForm({ title: '', content: '', isPinned: false });
      setShowForm(false); fetchNotices();
    } else { const data = await res.json(); setError(data.error?.message || t('unknown-error')); }
    setSubmitting(false);
  };

  const handleDelete = async (noticeId: string) => {
    if (!confirm(t('notice-delete-confirm'))) return;
    await fetch('/api/notices', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ noticeId }),
    });
    fetchNotices();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button color="primary" size="sm" onClick={() => setShowForm(!showForm)}>
          {showForm ? <XMarkIcon className="w-4 h-4 mr-1" /> : <PlusIcon className="w-4 h-4 mr-1" />}
          {showForm ? t('cancel') : t('notice-create')}
        </Button>
      </div>

      {error && <div className="alert alert-error text-sm"><span>{error}</span></div>}

      {showForm && (
        <div className="border border-gray-700 rounded-lg p-5 space-y-3">
          <div>
            <label className="label"><span className="label-text text-xs">{t('notice-title')} *</span></label>
            <input type="text" className="input input-bordered w-full" value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div>
            <label className="label"><span className="label-text text-xs">{t('notice-content')} *</span></label>
            <textarea className="textarea textarea-bordered w-full" rows={4} value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })} />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" className="checkbox checkbox-sm" checked={form.isPinned}
              onChange={(e) => setForm({ ...form, isPinned: e.target.checked })} />
            <span className="text-sm">{t('notice-pin')}</span>
          </div>
          <div className="flex justify-end">
            <Button color="primary" size="sm" loading={submitting} onClick={handleCreate}>{t('save-changes')}</Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-10"><span className="loading loading-spinner loading-sm"></span></div>
      ) : notices.length === 0 ? (
        <div className="text-center py-10 text-gray-500">{t('dash-no-notice')}</div>
      ) : (
        <div className="space-y-2">
          {notices.map((n: any) => (
            <div key={n.id} className="rounded-lg border border-gray-800 p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {n.isPinned && <span className="badge badge-xs badge-error">PIN</span>}
                    <span className="font-semibold">{n.title}</span>
                  </div>
                  <p className="text-sm text-gray-300 whitespace-pre-wrap">{n.content}</p>
                  <p className="text-xs text-gray-500 mt-2">
                    {n.author?.position ? `${n.author.position} ` : ''}{n.author?.name}
                    {' · '}{new Date(n.createdAt).toLocaleDateString('ko-KR')}
                  </p>
                </div>
                <button className="btn btn-ghost btn-xs text-error shrink-0" onClick={() => handleDelete(n.id)}>
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ========= 회사 통계 =========
const StatsPanel = () => {
  const { t } = useTranslation('common');
  const { data } = useSWR('/api/dashboard/stats', fetcher);
  const stats = data?.data;

  const { data: usersData } = useSWR('/api/admin/users', fetcher);
  const users = usersData?.data || [];

  const deptCounts: Record<string, number> = {};
  users.forEach((u: any) => {
    const dept = u.department || '미지정';
    deptCounts[dept] = (deptCounts[dept] || 0) + 1;
  });

  return (
    <div className="space-y-6">
      {/* 현장 통계 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-lg border border-gray-800 p-4 text-center">
          <p className="text-xs text-gray-500">{t('production-total')}</p>
          <p className="text-2xl font-bold mt-1">{stats?.totalSites ?? '-'}</p>
        </div>
        <div className="rounded-lg border border-blue-800 bg-blue-900/20 p-4 text-center">
          <p className="text-xs text-blue-400">{t('site-status-active')}</p>
          <p className="text-2xl font-bold mt-1 text-blue-300">{stats?.activeSites ?? '-'}</p>
        </div>
        <div className="rounded-lg border border-gray-800 p-4 text-center">
          <p className="text-xs text-gray-500">{t('hr-total-users')}</p>
          <p className="text-2xl font-bold mt-1">{users.length}</p>
        </div>
        <div className="rounded-lg border border-gray-800 p-4 text-center">
          <p className="text-xs text-gray-500">{t('hr-total-depts')}</p>
          <p className="text-2xl font-bold mt-1">{Object.keys(deptCounts).length}</p>
        </div>
      </div>

      {/* 부서별 인원 */}
      <div className="rounded-lg border border-gray-800 p-5">
        <h3 className="font-semibold mb-3">{t('hr-dept-breakdown')}</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {Object.entries(deptCounts).map(([dept, count]) => (
            <div key={dept} className="flex items-center justify-between py-2 px-3 rounded bg-gray-800/30">
              <span className="text-sm">{dept}</span>
              <span className="text-sm font-bold">{count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ========= 연차 관리 (ADMIN_HR) =========
const LeaveAdminPanel = () => {
  const { t } = useTranslation('common');
  const [tab, setTab] = useState<'pending' | 'all'>('pending');
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [noteInput, setNoteInput] = useState<Record<string, string>>({});

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    const filter = tab === 'pending' ? 'pending-admin' : 'all';
    const res = await fetch(`/api/leave/requests?filter=${filter}`);
    if (res.ok) { const d = await res.json(); setRequests(d.data || []); }
    setLoading(false);
  }, [tab]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const handleAction = async (requestId: string, action: string) => {
    await fetch('/api/leave/requests', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId, action, note: noteInput[requestId] || '' }),
    });
    fetchRequests();
  };

  const statusColors: Record<string, string> = {
    '신청': 'badge-info', '승인': 'badge-success', '반려': 'badge-error',
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button className={`btn btn-sm ${tab === 'pending' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('pending')}>{t('leave-pending')}</button>
        <button className={`btn btn-sm ${tab === 'all' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('all')}>{t('leave-all')}</button>
      </div>

      {loading ? <div className="text-center py-10"><span className="loading loading-spinner loading-sm"></span></div> : requests.length === 0 ? (
        <div className="text-center py-10 text-gray-500">{t('leave-no-requests')}</div>
      ) : (
        <div className="space-y-3">
          {requests.map((r: any) => (
            <div key={r.id} className="rounded-lg border border-gray-800 p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{r.user?.position ? `${r.user.position} ` : ''}{r.user?.name}</span>
                  <span className="text-xs text-gray-500">{r.user?.department}</span>
                  <span className="text-sm">{r.type} {Number(r.days)}일</span>
                  <span className={`badge badge-xs ${statusColors[r.status] || 'badge-ghost'}`}>{r.status}</span>
                </div>
                <span className="text-xs text-gray-500">{r.currentStep}</span>
              </div>
              <p className="text-sm text-gray-400">
                {new Date(r.startDate).toLocaleDateString('ko-KR')} ~ {new Date(r.endDate).toLocaleDateString('ko-KR')}
                {r.reason && ` · ${r.reason}`}
              </p>
              {r.manager && <p className="text-xs text-gray-500 mt-1">{t('leave-manager-action')}: {r.managerAction} ({r.manager.position ? `${r.manager.position} ` : ''}{r.manager.name})</p>}

              {r.currentStep === '최종승인대기' && (
                <div className="mt-3 flex items-center gap-2">
                  <input type="text" className="input input-bordered input-xs flex-1" placeholder={t('leave-note-placeholder')}
                    value={noteInput[r.id] || ''} onChange={(e) => setNoteInput({ ...noteInput, [r.id]: e.target.value })} />
                  <button className="btn btn-xs btn-success" onClick={() => handleAction(r.id, '승인')}>{t('v2-approve')}</button>
                  <button className="btn btn-xs btn-error" onClick={() => handleAction(r.id, '반려')}>{t('v2-reject')}</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export async function getServerSideProps({ locale }: GetServerSidePropsContext) {
  return { props: { ...(locale ? await serverSideTranslations(locale, ['common']) : {}) } };
}

export default AdminHrPage;
