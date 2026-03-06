import { GetServerSidePropsContext } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useTranslation } from 'next-i18next';
import { useState, useCallback } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import useSWR from 'swr';
import fetcher from '@/lib/fetcher';
import { Button } from 'react-daisyui';
import { PlusIcon, TrashIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';

const allTabs = ['overview', 'sales', 'contract', 'production', 'painting', 'shipping', 'documents', 'memo', 'schedule', 'comments'];
const hiddenTabsByRole: Record<string, string[]> = {
  PARTNER: ['sales', 'contract'],
  GUEST: ['sales', 'contract', 'production', 'painting', 'shipping', 'memo', 'schedule'],
};

const SiteDetail = () => {
  const { t } = useTranslation('common');
  const router = useRouter();
  const { id } = router.query;
  const [activeTab, setActiveTab] = useState('overview');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { data, mutate } = useSWR(id ? `/api/sites/${id}` : null, fetcher, { refreshInterval: 30000 });
  const site = data?.data;

  const { data: profileData } = useSWR('/api/my/profile', fetcher);
  const userRole = profileData?.data?.teamMembers?.[0]?.role || 'USER';

  const hidden = hiddenTabsByRole[userRole] || [];
  const tabs = allTabs.filter((tab) => !hidden.includes(tab));

  const canManage = ['SUPER_ADMIN', 'OWNER', 'ADMIN_HR', 'ADMIN', 'MANAGER'].includes(userRole);
  const canDelete = ['SUPER_ADMIN', 'OWNER', 'ADMIN_HR', 'ADMIN'].includes(userRole);

  const handleAddComment = useCallback(async () => {
    if (!comment.trim() || !id) return;
    setSubmitting(true);
    await fetch('/api/comments', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ siteId: id, content: comment }),
    });
    setComment('');
    setSubmitting(false);
    mutate();
  }, [comment, id, mutate]);

  const handleDeleteSite = async () => {
    if (!confirm(t('site-delete-confirm'))) return;
    await fetch(`/api/sites/${id}`, { method: 'DELETE' });
    router.push('/sites');
  };

  if (!site) return <div className="text-center py-10"><span className="loading loading-spinner loading-md"></span></div>;

  return (
    <>
      <Head><title>{site.name} | LOOKUP9</title></Head>
      <div className="space-y-6">
        {/* 헤더 */}
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold">{site.name}</h2>
            <p className="text-sm text-gray-400 mt-1">
              {site.address && `${site.address} · `}
              {site.createdBy.position ? `${site.createdBy.position} ${site.createdBy.name}` : site.createdBy.name}
              {` · ${new Date(site.createdAt).toLocaleDateString('ko-KR')}`}
            </p>
          </div>
          <div className="flex gap-2">
            <span className={`badge ${site.status === '진행중' ? 'badge-info' : site.status === '완료' ? 'badge-success' : 'badge-ghost'}`}>
              {site.status}
            </span>
            {canDelete && <Button color="error" size="xs" onClick={handleDeleteSite}>{t('delete')}</Button>}
          </div>
        </div>

        {/* 탭 */}
        <div className="border-b border-gray-800">
          <div className="flex gap-1 overflow-x-auto">
            {tabs.map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === tab ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}>
                {t(`tab-${tab}`)}
              </button>
            ))}
          </div>
        </div>

        {/* 개요 탭 */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-lg border border-gray-800 p-4">
                <p className="text-xs text-gray-500 mb-1">{t('site-client')}</p>
                <p className="font-medium">{site.client?.name || '-'}</p>
              </div>
              <div className="rounded-lg border border-gray-800 p-4">
                <p className="text-xs text-gray-500 mb-1">{t('site-status-label')}</p>
                <p className="font-medium">{site.status}</p>
              </div>
            </div>
            {site.description && (
              <div className="rounded-lg border border-gray-800 p-4">
                <p className="text-xs text-gray-500 mb-1">{t('site-description')}</p>
                <p className="text-sm whitespace-pre-wrap">{site.description}</p>
              </div>
            )}
            {/* 배정 인원 */}
            <AssignmentPanel siteId={id as string} assignments={site.assignments} canManage={canManage} onMutate={mutate} />
          </div>
        )}

        {/* 영업 탭 */}
        {activeTab === 'sales' && (
          <SalesPanel siteId={id as string} sales={site.sales} canManage={canManage} onMutate={mutate} />
        )}

        {/* 수주 탭 */}
        {activeTab === 'contract' && (
          <ContractPanel siteId={id as string} contracts={site.contracts} canManage={canManage} onMutate={mutate} />
        )}

        {/* 준비중 탭들 */}
        {(['production', 'painting', 'shipping', 'memo', 'schedule'].includes(activeTab)) && (
          <div className="rounded-lg border border-gray-800 p-6 text-center">
            <p className="text-gray-500">{t('coming-soon')}</p>
          </div>
        )}

        {/* 문서 탭 */}
        {activeTab === 'documents' && (
          <div className="rounded-lg border border-gray-800 p-6">
            <h3 className="font-semibold mb-3">{t('tab-documents')}</h3>
            <p className="text-sm text-gray-500">{site._count.documents} {t('site-documents-count')}</p>
            <p className="text-xs text-gray-500 mt-2">{t('coming-soon')}</p>
          </div>
        )}

        {/* 댓글 탭 */}
        {activeTab === 'comments' && (
          <div className="space-y-4">
            <div className="flex gap-3">
              <textarea className="textarea textarea-bordered flex-1" placeholder={t('comment-placeholder')}
                value={comment} onChange={(e) => setComment(e.target.value)} rows={2} />
              <Button color="primary" size="sm" loading={submitting} onClick={handleAddComment}>{t('comment-submit')}</Button>
            </div>
            {site.comments.length === 0 ? (
              <p className="text-sm text-gray-500">{t('comment-none')}</p>
            ) : (
              <div className="space-y-3">
                {site.comments.map((c: any) => (
                  <div key={c.id} className="rounded-lg border border-gray-800 p-4">
                    <div className="flex justify-between mb-2">
                      <span className="text-sm font-medium">
                        {c.author.position ? `${c.author.position} ` : ''}{c.author.name}
                        {c.author.department && <span className="text-gray-500 ml-1">({c.author.department})</span>}
                      </span>
                      <span className="text-xs text-gray-500">{new Date(c.createdAt).toLocaleDateString('ko-KR')}</span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{c.content}</p>
                    {c.replies && c.replies.length > 0 && (
                      <div className="mt-3 ml-4 space-y-2 border-l-2 border-gray-800 pl-4">
                        {c.replies.map((r: any) => (
                          <div key={r.id}>
                            <span className="text-xs font-medium">{r.author.position ? `${r.author.position} ` : ''}{r.author.name}</span>
                            <p className="text-sm">{r.content}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
};

// ========= 배정 패널 =========
const AssignmentPanel = ({ siteId, assignments, canManage, onMutate }: {
  siteId: string; assignments: any[]; canManage: boolean; onMutate: () => void;
}) => {
  const { t } = useTranslation('common');
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  const handleSearch = async (q: string) => {
    setSearchQuery(q);
    if (q.length < 1) { setSearchResults([]); return; }
    setSearching(true);
    const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`);
    if (res.ok) { const data = await res.json(); setSearchResults(data.data || []); }
    setSearching(false);
  };

  const handleAssign = async (userId: string) => {
    await fetch(`/api/sites/${siteId}/assignments`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    setSearchQuery(''); setSearchResults([]); setShowSearch(false);
    onMutate();
  };

  const handleRemove = async (userId: string, userName: string) => {
    if (!confirm(`${userName} ${t('assign-remove-confirm')}`)) return;
    await fetch(`/api/sites/${siteId}/assignments`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    onMutate();
  };

  return (
    <div className="rounded-lg border border-gray-800 p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-gray-500">{t('site-assigned-members')} ({assignments.length})</p>
        {canManage && (
          <button className="btn btn-ghost btn-xs" onClick={() => setShowSearch(!showSearch)}>
            <PlusIcon className="w-4 h-4" /> {t('assign-add')}
          </button>
        )}
      </div>

      {/* 검색 UI */}
      {showSearch && (
        <div className="mb-4 space-y-2">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" className="input input-bordered input-sm w-full pl-9"
              placeholder={t('assign-search-placeholder')} value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)} />
          </div>
          {searching && <p className="text-xs text-gray-500">...</p>}
          {searchResults.length > 0 && (
            <div className="border border-gray-700 rounded max-h-40 overflow-y-auto">
              {searchResults.map((u) => (
                <button key={u.id} onClick={() => handleAssign(u.id)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-800 flex justify-between items-center">
                  <span>{u.position ? `${u.position} ` : ''}{u.name} <span className="text-gray-500">({u.email})</span></span>
                  <span className="text-xs text-gray-500">{u.department || ''}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 배정 목록 */}
      {assignments.length === 0 ? (
        <p className="text-sm text-gray-500">{t('site-no-assignments')}</p>
      ) : (
        <div className="space-y-1">
          {assignments.map((a: any) => (
            <div key={a.id} className="flex items-center justify-between py-1">
              <p className="text-sm">
                {a.user.position ? `${a.user.position} ` : ''}{a.user.name}
                <span className="text-gray-500 ml-2">{a.user.department || ''}</span>
              </p>
              {canManage && (
                <button className="btn btn-ghost btn-xs text-error" onClick={() => handleRemove(a.user.id, a.user.name)}>
                  <TrashIcon className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ========= 영업 패널 =========
const salesStatuses = ['영업접촉', '제안', '견적제출', '협상중', '수주확정', '실주'];

const SalesPanel = ({ siteId, sales, canManage, onMutate }: {
  siteId: string; sales: any[]; canManage: boolean; onMutate: () => void;
}) => {
  const { t } = useTranslation('common');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ status: '영업접촉', estimateAmount: '', meetingNotes: '' });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    await fetch(`/api/sites/${siteId}/sales`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setForm({ status: '영업접촉', estimateAmount: '', meetingNotes: '' });
    setShowForm(false); setSubmitting(false);
    onMutate();
  };

  const handleDelete = async (salesId: string) => {
    if (!confirm(t('sales-delete-confirm'))) return;
    await fetch(`/api/sites/${siteId}/sales`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ salesId }),
    });
    onMutate();
  };

  return (
    <div className="rounded-lg border border-gray-800 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">{t('tab-sales')}</h3>
        {canManage && (
          <Button size="xs" color="primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? t('cancel') : <><PlusIcon className="w-4 h-4 mr-1" />{t('sales-add')}</>}
          </Button>
        )}
      </div>

      {showForm && (
        <div className="border border-gray-700 rounded-lg p-4 mb-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="label"><span className="label-text text-xs">{t('sales-status')}</span></label>
              <select className="select select-bordered select-sm w-full" value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {salesStatuses.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="label"><span className="label-text text-xs">{t('site-estimate')}</span></label>
              <input type="number" className="input input-bordered input-sm w-full" value={form.estimateAmount}
                onChange={(e) => setForm({ ...form, estimateAmount: e.target.value })} placeholder="0" />
            </div>
          </div>
          <div>
            <label className="label"><span className="label-text text-xs">{t('sales-notes')}</span></label>
            <textarea className="textarea textarea-bordered w-full text-sm" rows={2} value={form.meetingNotes}
              onChange={(e) => setForm({ ...form, meetingNotes: e.target.value })} />
          </div>
          <div className="flex justify-end">
            <Button size="sm" color="primary" loading={submitting} onClick={handleSubmit}>{t('save-changes')}</Button>
          </div>
        </div>
      )}

      {sales.length === 0 ? (
        <p className="text-sm text-gray-500">{t('site-no-data')}</p>
      ) : (
        sales.map((s: any) => (
          <div key={s.id} className="border-b border-gray-800 py-3 last:border-0">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="badge badge-sm">{s.status}</span>
                <span className="text-xs text-gray-500">
                  {s.createdBy?.position ? `${s.createdBy.position} ` : ''}{s.createdBy?.name}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">{new Date(s.createdAt).toLocaleDateString('ko-KR')}</span>
                {canManage && (
                  <button className="btn btn-ghost btn-xs text-error" onClick={() => handleDelete(s.id)}>
                    <TrashIcon className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
            {s.estimateAmount && <p className="text-sm mt-1">{t('site-estimate')}: {Number(s.estimateAmount).toLocaleString()}</p>}
            {s.meetingNotes && <p className="text-sm text-gray-400 mt-1">{s.meetingNotes}</p>}
          </div>
        ))
      )}
    </div>
  );
};

// ========= 수주 패널 =========
const contractStatuses = ['수주등록', '계약진행', '계약완료', '변경계약', '취소'];

const ContractPanel = ({ siteId, contracts, canManage, onMutate }: {
  siteId: string; contracts: any[]; canManage: boolean; onMutate: () => void;
}) => {
  const { t } = useTranslation('common');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ status: '수주등록', contractAmount: '', specialNotes: '' });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    await fetch(`/api/sites/${siteId}/contracts`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setForm({ status: '수주등록', contractAmount: '', specialNotes: '' });
    setShowForm(false); setSubmitting(false);
    onMutate();
  };

  const handleDelete = async (contractId: string) => {
    if (!confirm(t('contract-delete-confirm'))) return;
    await fetch(`/api/sites/${siteId}/contracts`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contractId }),
    });
    onMutate();
  };

  return (
    <div className="rounded-lg border border-gray-800 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">{t('tab-contract')}</h3>
        {canManage && (
          <Button size="xs" color="primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? t('cancel') : <><PlusIcon className="w-4 h-4 mr-1" />{t('contract-add')}</>}
          </Button>
        )}
      </div>

      {showForm && (
        <div className="border border-gray-700 rounded-lg p-4 mb-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="label"><span className="label-text text-xs">{t('contract-status')}</span></label>
              <select className="select select-bordered select-sm w-full" value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {contractStatuses.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="label"><span className="label-text text-xs">{t('site-contract-amount')}</span></label>
              <input type="number" className="input input-bordered input-sm w-full" value={form.contractAmount}
                onChange={(e) => setForm({ ...form, contractAmount: e.target.value })} placeholder="0" />
            </div>
          </div>
          <div>
            <label className="label"><span className="label-text text-xs">{t('contract-notes')}</span></label>
            <textarea className="textarea textarea-bordered w-full text-sm" rows={2} value={form.specialNotes}
              onChange={(e) => setForm({ ...form, specialNotes: e.target.value })} />
          </div>
          <div className="flex justify-end">
            <Button size="sm" color="primary" loading={submitting} onClick={handleSubmit}>{t('save-changes')}</Button>
          </div>
        </div>
      )}

      {contracts.length === 0 ? (
        <p className="text-sm text-gray-500">{t('site-no-data')}</p>
      ) : (
        contracts.map((c: any) => (
          <div key={c.id} className="border-b border-gray-800 py-3 last:border-0">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="badge badge-sm">{c.status}</span>
                <span className="text-xs text-gray-500">
                  {c.createdBy?.position ? `${c.createdBy.position} ` : ''}{c.createdBy?.name}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">{new Date(c.createdAt).toLocaleDateString('ko-KR')}</span>
                {canManage && (
                  <button className="btn btn-ghost btn-xs text-error" onClick={() => handleDelete(c.id)}>
                    <TrashIcon className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
            {c.contractAmount && <p className="text-sm mt-1">{t('site-contract-amount')}: {Number(c.contractAmount).toLocaleString()}</p>}
            {c.specialNotes && <p className="text-sm text-gray-400 mt-1">{c.specialNotes}</p>}
          </div>
        ))
      )}
    </div>
  );
};

export async function getServerSideProps({ locale }: GetServerSidePropsContext) {
  return { props: { ...(locale ? await serverSideTranslations(locale, ['common']) : {}) } };
}

export default SiteDetail;
