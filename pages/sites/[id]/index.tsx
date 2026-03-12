import { GetServerSidePropsContext } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useTranslation } from 'next-i18next';
import { useState, useCallback, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import useSWR from 'swr';
import fetcher from '@/lib/fetcher';
import { Button } from 'react-daisyui';
import ProductionProgressPanel from '@/components/sites/ProductionProgressPanel';
import { PlusIcon, TrashIcon, MagnifyingGlassIcon, CheckCircleIcon } from '@heroicons/react/24/outline';

// 상태 신호등 색상
const STATUS_DOT: Record<string, string> = {
  '영업중': 'bg-red-500', '대기': 'bg-red-400',
  '계약완료': 'bg-yellow-400', '진행중': 'bg-green-500',
  '부분완료': 'bg-green-300', '완료': 'bg-gray-400', '보류': 'bg-gray-600',
};
const StatusDot = ({ status }: { status: string }) => (
  <span className={`inline-block w-2.5 h-2.5 rounded-full mr-2 ${STATUS_DOT[status] || 'bg-gray-400'}`} />
);

const allTabs = ['overview', 'sales', 'contract', 'production', 'painting', 'shipping', 'documents', 'requests', 'issues', 'changes', 'schedule', 'history', 'comments'];
const hiddenTabsByRole: Record<string, string[]> = {
  PARTNER: ['sales', 'contract'],
  GUEST: ['sales', 'contract', 'production', 'painting', 'shipping', 'requests', 'issues', 'changes', 'schedule', 'history'],
};

const SiteDetail = () => {
  const { t } = useTranslation('common');
  const router = useRouter();
  const { id } = router.query;
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    const tab = typeof router.query.tab === 'string' ? router.query.tab : '';
    if (tab && allTabs.includes(tab)) setActiveTab(tab);
  }, [router.query.tab]);
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
    await fetch('/api/comments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ siteId: id, content: comment }) });
    setComment(''); setSubmitting(false); mutate();
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
      <div className="space-y-4">
        {/* ===== 상단 고정 요약 ===== */}
        <div className="rounded-lg border border-gray-800 p-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center">
                <StatusDot status={site.status} />
                <h2 className="text-xl font-bold">{site.name}</h2>
                <span className="ml-2 text-sm text-gray-400">{site.status}</span>
              </div>
              <p className="text-sm text-gray-400 mt-1">
                {site.client?.name && <span className="mr-3">{site.client.name}</span>}
                {site.address && <span className="mr-3">{site.address}</span>}
                <span>{site.createdBy.position ? `${site.createdBy.position} ${site.createdBy.name}` : site.createdBy.name}</span>
              </p>
            </div>
            <div className="flex gap-2 items-center shrink-0">
              {site._count?.requests > 0 && <span className="badge badge-sm badge-warning">{t('v2-open-requests')}: {site._count.requests}</span>}
              {canDelete && <Button color="error" size="xs" onClick={handleDeleteSite}>{t('delete')}</Button>}
            </div>
          </div>
          {/* 요약 수치 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
            <div className="text-center p-2 rounded bg-gray-800/30">
              <p className="text-xs text-gray-500">{t('v2-assignments')}</p>
              <p className="text-lg font-bold">{site.assignments?.length || 0}</p>
            </div>
            <div className="text-center p-2 rounded bg-gray-800/30">
              <p className="text-xs text-gray-500">{t('v2-paint-specs')}</p>
              <p className="text-lg font-bold">{site.paintSpecs?.length || 0}</p>
            </div>
            <div className="text-center p-2 rounded bg-gray-800/30">
              <p className="text-xs text-gray-500">{t('v2-shipments')}</p>
              <p className="text-lg font-bold">{site.shipments?.length || 0}</p>
            </div>
            <div className="text-center p-2 rounded bg-gray-800/30">
              <p className="text-xs text-gray-500">{t('tab-documents')}</p>
              <p className="text-lg font-bold">{site._count?.documents || 0}</p>
            </div>
          </div>
        </div>

        {/* ===== 탭 ===== */}
        <div className="border-b border-gray-800">
          <div className="flex gap-1 overflow-x-auto">
            {tabs.map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${activeTab === tab ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-400 hover:text-gray-200'}`}>
                {t(`tab-${tab}`)}
              </button>
            ))}
          </div>
        </div>

        {/* ===== 탭 내용 ===== */}
        {activeTab === 'overview' && <OverviewPanel site={site} siteId={id as string} canManage={canManage} onMutate={mutate} />}
        {activeTab === 'sales' && <SalesPanel siteId={id as string} sales={site.sales} canManage={canManage} onMutate={mutate} />}
        {activeTab === 'contract' && <ContractPanel siteId={id as string} contracts={site.contracts} canManage={canManage} onMutate={mutate} />}
        {activeTab === 'production' && <ProductionProgressPanel site={site} canManage={canManage} onMutate={mutate} />}
        {activeTab === 'painting' && <PaintPanel siteId={id as string} specs={site.paintSpecs || []} canManage={canManage} onMutate={mutate} />}
        {activeTab === 'shipping' && <ShipmentPanel siteId={id as string} shipments={site.shipments || []} canManage={canManage} onMutate={mutate} />}
        {activeTab === 'documents' && <DocumentPanel siteId={id as string} canManage={canManage} />}
        {activeTab === 'requests' && <RequestPanel siteId={id as string} requests={site.requests || []} canManage={canManage} onMutate={mutate} />}
        {activeTab === 'issues' && <IssuePanel siteId={id as string} issues={site.issues || []} canManage={canManage} onMutate={mutate} />}
        {activeTab === 'changes' && <ChangePanel siteId={id as string} changes={site.changeLogs || []} canManage={canManage} onMutate={mutate} />}
        {activeTab === 'schedule' && <SchedulePanel siteId={id as string} schedules={site.schedules || []} canManage={canManage} onMutate={mutate} />}
        {activeTab === 'history' && <HistoryPanel history={site.statusHistory || []} />}
        {activeTab === 'comments' && (
          <div className="space-y-4">
            <div className="flex gap-3">
              <textarea className="textarea textarea-bordered flex-1" placeholder={t('comment-placeholder')} value={comment} onChange={(e) => setComment(e.target.value)} rows={2} />
              <Button color="primary" size="sm" loading={submitting} onClick={handleAddComment}>{t('comment-submit')}</Button>
            </div>
            {(site.comments || []).length === 0 ? <p className="text-sm text-gray-500">{t('comment-none')}</p> : (
              <div className="space-y-3">
                {site.comments.map((c: any) => (
                  <div key={c.id} className="rounded-lg border border-gray-800 p-4">
                    <div className="flex justify-between mb-2">
                      <span className="text-sm font-medium">{c.author.position ? `${c.author.position} ` : ''}{c.author.name}{c.author.department && <span className="text-gray-500 ml-1">({c.author.department})</span>}</span>
                      <span className="text-xs text-gray-500">{new Date(c.createdAt).toLocaleDateString('ko-KR')}</span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{c.content}</p>
                    {c.replies?.length > 0 && <div className="mt-3 ml-4 space-y-2 border-l-2 border-gray-800 pl-4">{c.replies.map((r: any) => <div key={r.id}><span className="text-xs font-medium">{r.author.position ? `${r.author.position} ` : ''}{r.author.name}</span><p className="text-sm">{r.content}</p></div>)}</div>}
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

// ========= 개요 =========
const siteStatuses = ['영업중', '대기', '계약완료', '진행중', '부분완료', '완료', '보류'];
const OverviewPanel = ({ site, siteId, canManage, onMutate }: any) => {
  const { t } = useTranslation('common');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ status: site.status, description: site.description || '', statusReason: '' });
  const [saving, setSaving] = useState(false);
  const handleSave = async () => {
    setSaving(true);
    await fetch(`/api/sites/${siteId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    setSaving(false); setEditing(false); onMutate();
  };
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-lg border border-gray-800 p-4">
          <p className="text-xs text-gray-500 mb-1">{t('site-client')}</p>
          <p className="font-medium">{site.client?.name || '-'}</p>
        </div>
        <div className="rounded-lg border border-gray-800 p-4">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-gray-500">{t('site-status-label')}</p>
            {canManage && !editing && <button className="btn btn-ghost btn-xs" onClick={() => setEditing(true)}>{t('edit')}</button>}
          </div>
          {editing ? (
            <div className="space-y-2">
              <select className="select select-bordered select-sm w-full" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {siteStatuses.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <input type="text" className="input input-bordered input-sm w-full" placeholder={t('v2-status-reason')} value={form.statusReason} onChange={(e) => setForm({ ...form, statusReason: e.target.value })} />
            </div>
          ) : <p className="font-medium"><StatusDot status={site.status} />{site.status}</p>}
        </div>
      </div>
      <div className="rounded-lg border border-gray-800 p-4">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs text-gray-500">{t('site-description')}</p>
          {canManage && !editing && <button className="btn btn-ghost btn-xs" onClick={() => setEditing(true)}>{t('edit')}</button>}
        </div>
        {editing ? <textarea className="textarea textarea-bordered w-full text-sm" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /> : <p className="text-sm whitespace-pre-wrap">{site.description || '-'}</p>}
        {editing && <div className="flex gap-2 justify-end mt-2"><Button size="xs" onClick={() => setEditing(false)}>{t('cancel')}</Button><Button size="xs" color="primary" loading={saving} onClick={handleSave}>{t('save-changes')}</Button></div>}
      </div>
      <AssignmentPanel siteId={siteId} assignments={site.assignments} canManage={canManage} onMutate={onMutate} />
    </div>
  );
};

// ========= 배정 =========
const AssignmentPanel = ({ siteId, assignments, canManage, onMutate }: any) => {
  const { t } = useTranslation('common');
  const [showSearch, setShowSearch] = useState(false);
  const [sq, setSq] = useState(''); const [sr, setSr] = useState<any[]>([]);
  const handleSearch = async (q: string) => { setSq(q); if (q.length < 1) { setSr([]); return; } const r = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`); if (r.ok) { const d = await r.json(); setSr(d.data || []); } };
  const handleAssign = async (userId: string) => { await fetch(`/api/sites/${siteId}/assignments`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId }) }); setSq(''); setSr([]); setShowSearch(false); onMutate(); };
  const handleRemove = async (userId: string) => { if (!confirm(t('assign-remove-confirm'))) return; await fetch(`/api/sites/${siteId}/assignments`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId }) }); onMutate(); };
  return (
    <div className="rounded-lg border border-gray-800 p-4">
      <div className="flex items-center justify-between mb-3"><p className="text-xs text-gray-500">{t('site-assigned-members')} ({assignments.length})</p>{canManage && <button className="btn btn-ghost btn-xs" onClick={() => setShowSearch(!showSearch)}><PlusIcon className="w-4 h-4" /> {t('assign-add')}</button>}</div>
      {showSearch && <div className="mb-4 space-y-2"><div className="relative"><MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input type="text" className="input input-bordered input-sm w-full pl-9" placeholder={t('assign-search-placeholder')} value={sq} onChange={(e) => handleSearch(e.target.value)} /></div>{sr.length > 0 && <div className="border border-gray-700 rounded max-h-40 overflow-y-auto">{sr.map((u) => <button key={u.id} onClick={() => handleAssign(u.id)} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-800">{u.position ? `${u.position} ` : ''}{u.name} <span className="text-gray-500">({u.email})</span></button>)}</div>}</div>}
      {assignments.length === 0 ? <p className="text-sm text-gray-500">{t('site-no-assignments')}</p> : <div className="space-y-1">{assignments.map((a: any) => <div key={a.id} className="flex items-center justify-between py-1"><p className="text-sm">{a.user.position ? `${a.user.position} ` : ''}{a.user.name}<span className="text-gray-500 ml-2">{a.user.department || ''}</span></p>{canManage && <button className="btn btn-ghost btn-xs text-error" onClick={() => handleRemove(a.user.id)}><TrashIcon className="w-3 h-3" /></button>}</div>)}</div>}
    </div>
  );
};

// ========= 영업 =========
const salesStatuses = ['영업접촉', '제안', '견적제출', '협상중', '수주확정', '실주'];
const SalesPanel = ({ siteId, sales, canManage, onMutate }: any) => {
  const { t } = useTranslation('common');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ status: '영업접촉', estimateAmount: '', meetingNotes: '' });
  const [sub, setSub] = useState(false);
  const handleSubmit = async () => { setSub(true); await fetch(`/api/sites/${siteId}/sales`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) }); setForm({ status: '영업접촉', estimateAmount: '', meetingNotes: '' }); setShowForm(false); setSub(false); onMutate(); };
  const handleDel = async (salesId: string) => { if (!confirm(t('sales-delete-confirm'))) return; await fetch(`/api/sites/${siteId}/sales`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ salesId }) }); onMutate(); };
  return (
    <div className="rounded-lg border border-gray-800 p-6">
      <div className="flex items-center justify-between mb-4"><h3 className="font-semibold">{t('tab-sales')}</h3>{canManage && <Button size="xs" color="primary" onClick={() => setShowForm(!showForm)}>{showForm ? t('cancel') : <><PlusIcon className="w-4 h-4 mr-1" />{t('sales-add')}</>}</Button>}</div>
      {showForm && <div className="border border-gray-700 rounded-lg p-4 mb-4 space-y-3"><div className="grid grid-cols-1 md:grid-cols-2 gap-3"><div><label className="label"><span className="label-text text-xs">{t('sales-status')}</span></label><select className="select select-bordered select-sm w-full" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{salesStatuses.map((s) => <option key={s} value={s}>{s}</option>)}</select></div><div><label className="label"><span className="label-text text-xs">{t('site-estimate')}</span></label><input type="number" className="input input-bordered input-sm w-full" value={form.estimateAmount} onChange={(e) => setForm({ ...form, estimateAmount: e.target.value })} /></div></div><div><label className="label"><span className="label-text text-xs">{t('sales-notes')}</span></label><textarea className="textarea textarea-bordered w-full text-sm" rows={2} value={form.meetingNotes} onChange={(e) => setForm({ ...form, meetingNotes: e.target.value })} /></div><div className="flex justify-end"><Button size="sm" color="primary" loading={sub} onClick={handleSubmit}>{t('save-changes')}</Button></div></div>}
      {sales.length === 0 ? <p className="text-sm text-gray-500">{t('site-no-data')}</p> : sales.map((s: any) => <div key={s.id} className="border-b border-gray-800 py-3 last:border-0"><div className="flex justify-between items-center"><span className="badge badge-sm">{s.status}</span><div className="flex items-center gap-2"><span className="text-xs text-gray-500">{new Date(s.createdAt).toLocaleDateString('ko-KR')}</span>{canManage && <button className="btn btn-ghost btn-xs text-error" onClick={() => handleDel(s.id)}><TrashIcon className="w-3 h-3" /></button>}</div></div>{s.estimateAmount && <p className="text-sm mt-1">{t('site-estimate')}: {Number(s.estimateAmount).toLocaleString()}</p>}{s.meetingNotes && <p className="text-sm text-gray-400 mt-1">{s.meetingNotes}</p>}</div>)}
    </div>
  );
};

// ========= 수주 =========
const contractStatuses = ['수주등록', '계약진행', '계약완료', '변경계약', '취소'];
const ContractPanel = ({ siteId, contracts, canManage, onMutate }: any) => {
  const { t } = useTranslation('common');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ status: '수주등록', contractAmount: '', specialNotes: '' });
  const [sub, setSub] = useState(false);
  const handleSubmit = async () => { setSub(true); await fetch(`/api/sites/${siteId}/contracts`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) }); setForm({ status: '수주등록', contractAmount: '', specialNotes: '' }); setShowForm(false); setSub(false); onMutate(); };
  const handleDel = async (contractId: string) => { if (!confirm(t('contract-delete-confirm'))) return; await fetch(`/api/sites/${siteId}/contracts`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contractId }) }); onMutate(); };
  return (
    <div className="rounded-lg border border-gray-800 p-6">
      <div className="flex items-center justify-between mb-4"><h3 className="font-semibold">{t('tab-contract')}</h3>{canManage && <Button size="xs" color="primary" onClick={() => setShowForm(!showForm)}>{showForm ? t('cancel') : <><PlusIcon className="w-4 h-4 mr-1" />{t('contract-add')}</>}</Button>}</div>
      {showForm && <div className="border border-gray-700 rounded-lg p-4 mb-4 space-y-3"><div className="grid grid-cols-1 md:grid-cols-2 gap-3"><div><label className="label"><span className="label-text text-xs">{t('contract-status')}</span></label><select className="select select-bordered select-sm w-full" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{contractStatuses.map((s) => <option key={s} value={s}>{s}</option>)}</select></div><div><label className="label"><span className="label-text text-xs">{t('site-contract-amount')}</span></label><input type="number" className="input input-bordered input-sm w-full" value={form.contractAmount} onChange={(e) => setForm({ ...form, contractAmount: e.target.value })} /></div></div><div><label className="label"><span className="label-text text-xs">{t('contract-notes')}</span></label><textarea className="textarea textarea-bordered w-full text-sm" rows={2} value={form.specialNotes} onChange={(e) => setForm({ ...form, specialNotes: e.target.value })} /></div><div className="flex justify-end"><Button size="sm" color="primary" loading={sub} onClick={handleSubmit}>{t('save-changes')}</Button></div></div>}
      {contracts.length === 0 ? <p className="text-sm text-gray-500">{t('site-no-data')}</p> : contracts.map((c: any) => <div key={c.id} className="border-b border-gray-800 py-3 last:border-0"><div className="flex justify-between items-center"><span className="badge badge-sm">{c.status}</span><div className="flex items-center gap-2"><span className="text-xs text-gray-500">{new Date(c.createdAt).toLocaleDateString('ko-KR')}</span>{canManage && <button className="btn btn-ghost btn-xs text-error" onClick={() => handleDel(c.id)}><TrashIcon className="w-3 h-3" /></button>}</div></div>{c.contractAmount && <p className="text-sm mt-1">{t('site-contract-amount')}: {Number(c.contractAmount).toLocaleString()}</p>}{c.specialNotes && <p className="text-sm text-gray-400 mt-1">{c.specialNotes}</p>}</div>)}
    </div>
  );
};

// ========= 도장 =========
const PaintPanel = ({ siteId, specs, canManage, onMutate }: any) => {
  const { t } = useTranslation('common');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ colorCode: '', colorName: '', manufacturer: '', finishType: '', area: '', quantity: '', isPrimary: false, notes: '' });
  const [sub, setSub] = useState(false);
  const handleSubmit = async () => { setSub(true); await fetch(`/api/sites/${siteId}/paints`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) }); setForm({ colorCode: '', colorName: '', manufacturer: '', finishType: '', area: '', quantity: '', isPrimary: false, notes: '' }); setShowForm(false); setSub(false); onMutate(); };
  const handleConfirm = async (specId: string) => { await fetch(`/api/sites/${siteId}/paints`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ specId, status: '확정' }) }); onMutate(); };
  const handleDel = async (specId: string) => { if (!confirm(t('v2-paint-delete-confirm'))) return; await fetch(`/api/sites/${siteId}/paints`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ specId }) }); onMutate(); };
  return (
    <div className="rounded-lg border border-gray-800 p-6">
      <div className="flex items-center justify-between mb-4"><h3 className="font-semibold">{t('tab-painting')}</h3>{canManage && <Button size="xs" color="primary" onClick={() => setShowForm(!showForm)}>{showForm ? t('cancel') : <><PlusIcon className="w-4 h-4 mr-1" />{t('v2-paint-add')}</>}</Button>}</div>
      {showForm && (
        <div className="border border-gray-700 rounded-lg p-4 mb-4 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div><label className="label"><span className="label-text text-xs">{t('v2-color-code')} *</span></label><input type="text" className="input input-bordered input-sm w-full" value={form.colorCode} onChange={(e) => setForm({ ...form, colorCode: e.target.value })} /></div>
            <div><label className="label"><span className="label-text text-xs">{t('v2-color-name')} *</span></label><input type="text" className="input input-bordered input-sm w-full" value={form.colorName} onChange={(e) => setForm({ ...form, colorName: e.target.value })} /></div>
            <div><label className="label"><span className="label-text text-xs">{t('v2-manufacturer')}</span></label><input type="text" className="input input-bordered input-sm w-full" value={form.manufacturer} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} /></div>
            <div><label className="label"><span className="label-text text-xs">{t('v2-finish-type')}</span></label><input type="text" className="input input-bordered input-sm w-full" value={form.finishType} onChange={(e) => setForm({ ...form, finishType: e.target.value })} /></div>
            <div><label className="label"><span className="label-text text-xs">{t('v2-area')}</span></label><input type="text" className="input input-bordered input-sm w-full" value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} /></div>
            <div><label className="label"><span className="label-text text-xs">{t('v2-quantity')}</span></label><input type="number" className="input input-bordered input-sm w-full" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} /></div>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="checkbox checkbox-sm" checked={form.isPrimary} onChange={(e) => setForm({ ...form, isPrimary: e.target.checked })} />{t('v2-primary-color')}</label>
          </div>
          <div><label className="label"><span className="label-text text-xs">{t('client-notes')}</span></label><textarea className="textarea textarea-bordered w-full text-sm" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          <div className="flex justify-end"><Button size="sm" color="primary" loading={sub} onClick={handleSubmit}>{t('save-changes')}</Button></div>
        </div>
      )}
      {specs.length === 0 ? <p className="text-sm text-gray-500">{t('site-no-data')}</p> : (
        <div className="overflow-x-auto"><table className="table w-full"><thead><tr><th>{t('v2-color-code')}</th><th>{t('v2-color-name')}</th><th>{t('v2-area')}</th><th>{t('v2-quantity')}</th><th>{t('site-status-label')}</th><th>{t('actions')}</th></tr></thead><tbody>
          {specs.map((s: any) => (
            <tr key={s.id} className={s.isPrimary ? 'bg-blue-900/10' : ''}>
              <td><div className="flex items-center gap-2"><span className="inline-block w-4 h-4 rounded border" style={{ backgroundColor: s.colorCode }} />{s.colorCode}</div></td>
              <td>{s.colorName}{s.isPrimary && <span className="badge badge-xs badge-info ml-1">{t('v2-primary')}</span>}</td>
              <td className="text-sm">{s.area || '-'}</td><td className="text-sm">{s.quantity ? Number(s.quantity).toLocaleString() : '-'}</td>
              <td><span className={`badge badge-sm ${s.status === '확정' ? 'badge-success' : s.status === '검토중' ? 'badge-warning' : 'badge-ghost'}`}>{s.status}</span></td>
              <td><div className="flex gap-1">{canManage && s.status !== '확정' && <button className="btn btn-ghost btn-xs text-success" onClick={() => handleConfirm(s.id)}><CheckCircleIcon className="w-3 h-3" /></button>}{canManage && <button className="btn btn-ghost btn-xs text-error" onClick={() => handleDel(s.id)}><TrashIcon className="w-3 h-3" /></button>}</div></td>
            </tr>
          ))}
        </tbody></table></div>
      )}
    </div>
  );
};

// ========= 출하 =========
const shipStatuses = ['출하예정', '상차완료', '출발', '현장도착', '인수완료', '반송', '취소'];
const ShipmentPanel = ({ siteId, shipments, canManage, onMutate }: any) => {
  const { t } = useTranslation('common');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ shippedAt: '', quantity: '', vehicleInfo: '', driverInfo: '', destination: '', notes: '' });
  const [sub, setSub] = useState(false);
  const handleSubmit = async () => { setSub(true); await fetch(`/api/sites/${siteId}/shipments`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) }); setForm({ shippedAt: '', quantity: '', vehicleInfo: '', driverInfo: '', destination: '', notes: '' }); setShowForm(false); setSub(false); onMutate(); };
  const handleStatus = async (recordId: string, status: string) => { await fetch(`/api/sites/${siteId}/shipments`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ recordId, status }) }); onMutate(); };
  const handleDel = async (recordId: string) => { if (!confirm(t('v2-ship-delete-confirm'))) return; await fetch(`/api/sites/${siteId}/shipments`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ recordId }) }); onMutate(); };
  return (
    <div className="rounded-lg border border-gray-800 p-6">
      <div className="flex items-center justify-between mb-4"><h3 className="font-semibold">{t('tab-shipping')}</h3>{canManage && <Button size="xs" color="primary" onClick={() => setShowForm(!showForm)}>{showForm ? t('cancel') : <><PlusIcon className="w-4 h-4 mr-1" />{t('v2-ship-add')}</>}</Button>}</div>
      {showForm && (
        <div className="border border-gray-700 rounded-lg p-4 mb-4 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div><label className="label"><span className="label-text text-xs">{t('v2-ship-date')}</span></label><input type="date" className="input input-bordered input-sm w-full" value={form.shippedAt} onChange={(e) => setForm({ ...form, shippedAt: e.target.value })} /></div>
            <div><label className="label"><span className="label-text text-xs">{t('v2-quantity')}</span></label><input type="number" className="input input-bordered input-sm w-full" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} /></div>
            <div><label className="label"><span className="label-text text-xs">{t('v2-vehicle')}</span></label><input type="text" className="input input-bordered input-sm w-full" value={form.vehicleInfo} onChange={(e) => setForm({ ...form, vehicleInfo: e.target.value })} /></div>
            <div><label className="label"><span className="label-text text-xs">{t('v2-driver')}</span></label><input type="text" className="input input-bordered input-sm w-full" value={form.driverInfo} onChange={(e) => setForm({ ...form, driverInfo: e.target.value })} /></div>
            <div><label className="label"><span className="label-text text-xs">{t('v2-destination')}</span></label><input type="text" className="input input-bordered input-sm w-full" value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} /></div>
          </div>
          <div><label className="label"><span className="label-text text-xs">{t('client-notes')}</span></label><textarea className="textarea textarea-bordered w-full text-sm" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          <div className="flex justify-end"><Button size="sm" color="primary" loading={sub} onClick={handleSubmit}>{t('save-changes')}</Button></div>
        </div>
      )}
      {shipments.length === 0 ? <p className="text-sm text-gray-500">{t('site-no-data')}</p> : (
        <div className="space-y-3">{shipments.map((s: any) => (
          <div key={s.id} className="rounded border border-gray-800 p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2"><span className="font-semibold text-sm">{s.shipmentNo || `#${s.sequence}`}</span><span className="text-xs text-gray-500">{t('v2-sequence')} {s.sequence}</span></div>
              <div className="flex items-center gap-2">
                {canManage && <select className="select select-bordered select-xs" value={s.status} onChange={(e) => handleStatus(s.id, e.target.value)}>{shipStatuses.map((st) => <option key={st} value={st}>{st}</option>)}</select>}
                {canManage && <button className="btn btn-ghost btn-xs text-error" onClick={() => handleDel(s.id)}><TrashIcon className="w-3 h-3" /></button>}
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
              <div><span className="text-gray-500">{t('v2-ship-date')}:</span> {s.shippedAt ? new Date(s.shippedAt).toLocaleDateString('ko-KR') : '-'}</div>
              <div><span className="text-gray-500">{t('v2-quantity')}:</span> {s.quantity ? Number(s.quantity).toLocaleString() : '-'}</div>
              <div><span className="text-gray-500">{t('v2-vehicle')}:</span> {s.vehicleInfo || '-'}</div>
              <div><span className="text-gray-500">{t('v2-destination')}:</span> {s.destination || '-'}</div>
            </div>
            {s.notes && <p className="text-sm text-gray-400 mt-2">{s.notes}</p>}
          </div>
        ))}</div>
      )}
    </div>
  );
};

// ========= 요청사항 =========
const reqTypes = ['고객 요청', '현장 요청', '내부 요청', '협력사 요청', '긴급 요청'];
const reqPriorities = ['낮음', '보통', '높음', '긴급'];
const reqStatuses = ['등록', '확인중', '처리중', '완료', '반려', '보류'];
const RequestPanel = ({ siteId, requests, canManage, onMutate }: any) => {
  const { t } = useTranslation('common');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', type: '내부 요청', priority: '보통', targetDept: '', deadline: '', description: '' });
  const [sub, setSub] = useState(false);
  const handleSubmit = async () => { if (!form.title) return; setSub(true); await fetch(`/api/sites/${siteId}/requests`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) }); setForm({ title: '', type: '내부 요청', priority: '보통', targetDept: '', deadline: '', description: '' }); setShowForm(false); setSub(false); onMutate(); };
  const handleStatus = async (requestId: string, status: string) => { await fetch(`/api/sites/${siteId}/requests`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requestId, status }) }); onMutate(); };
  return (
    <div className="rounded-lg border border-gray-800 p-6">
      <div className="flex items-center justify-between mb-4"><h3 className="font-semibold">{t('tab-requests')}</h3><Button size="xs" color="primary" onClick={() => setShowForm(!showForm)}>{showForm ? t('cancel') : <><PlusIcon className="w-4 h-4 mr-1" />{t('v2-req-add')}</>}</Button></div>
      {showForm && (
        <div className="border border-gray-700 rounded-lg p-4 mb-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><label className="label"><span className="label-text text-xs">{t('v2-req-title')} *</span></label><input type="text" className="input input-bordered input-sm w-full" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div><label className="label"><span className="label-text text-xs">{t('v2-req-type')}</span></label><select className="select select-bordered select-sm w-full" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>{reqTypes.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
            <div><label className="label"><span className="label-text text-xs">{t('v2-req-priority')}</span></label><select className="select select-bordered select-sm w-full" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>{reqPriorities.map((p) => <option key={p} value={p}>{p}</option>)}</select></div>
            <div><label className="label"><span className="label-text text-xs">{t('v2-req-deadline')}</span></label><input type="date" className="input input-bordered input-sm w-full" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} /></div>
          </div>
          <div><label className="label"><span className="label-text text-xs">{t('site-description')}</span></label><textarea className="textarea textarea-bordered w-full text-sm" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div className="flex justify-end"><Button size="sm" color="primary" loading={sub} onClick={handleSubmit}>{t('save-changes')}</Button></div>
        </div>
      )}
      {requests.length === 0 ? <p className="text-sm text-gray-500">{t('site-no-data')}</p> : (
        <div className="space-y-2">{requests.map((r: any) => (
          <div key={r.id} className="rounded border border-gray-800 p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2"><span className={`badge badge-xs ${r.priority === '긴급' ? 'badge-error' : r.priority === '높음' ? 'badge-warning' : 'badge-ghost'}`}>{r.priority}</span><span className="text-sm font-medium">{r.title}</span><span className="text-xs text-gray-500">{r.type}</span></div>
              <div className="flex items-center gap-2">{canManage && <select className="select select-bordered select-xs" value={r.status} onChange={(e) => handleStatus(r.id, e.target.value)}>{reqStatuses.map((s) => <option key={s} value={s}>{s}</option>)}</select>}{!canManage && <span className="badge badge-sm">{r.status}</span>}</div>
            </div>
            {r.description && <p className="text-sm text-gray-400 mt-1">{r.description}</p>}
            <div className="flex items-center gap-3 mt-2 text-xs text-gray-500"><span>{r.createdBy?.position ? `${r.createdBy.position} ` : ''}{r.createdBy?.name}</span>{r.deadline && <span>{t('v2-req-deadline')}: {new Date(r.deadline).toLocaleDateString('ko-KR')}</span>}<span>{new Date(r.createdAt).toLocaleDateString('ko-KR')}</span></div>
          </div>
        ))}</div>
      )}
    </div>
  );
};

// ========= 문서 =========
const DocumentPanel = ({ siteId, canManage }: { siteId: string; canManage: boolean }) => {
  const { t } = useTranslation('common');
  const [docs, setDocs] = useState<any[]>([]); const [loading, setLoading] = useState(true); const [uploading, setUploading] = useState(false);
  const fetchDocs = useCallback(async () => { setLoading(true); const r = await fetch(`/api/sites/${siteId}/documents`); if (r.ok) { const d = await r.json(); setDocs(d.data || []); } setLoading(false); }, [siteId]);
  useEffect(() => { fetchDocs(); }, [fetchDocs]);
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (!f) return; if (f.size > 5*1024*1024) { alert(t('doc-size-limit')); return; } setUploading(true); const reader = new FileReader(); reader.onload = async () => { const b64 = (reader.result as string).split(',')[1]; await fetch(`/api/sites/${siteId}/documents`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileName: f.name, fileData: b64, mimeType: f.type }) }); setUploading(false); fetchDocs(); }; reader.readAsDataURL(f); e.target.value = ''; };
  const handleDel = async (docId: string) => { if (!confirm(t('doc-delete-confirm'))) return; await fetch(`/api/sites/${siteId}/documents`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ documentId: docId }) }); fetchDocs(); };
  const fmtSize = (b: number|null) => { if (!b) return '-'; if (b<1024) return `${b}B`; if (b<1024*1024) return `${(b/1024).toFixed(1)}KB`; return `${(b/(1024*1024)).toFixed(1)}MB`; };
  return (
    <div className="rounded-lg border border-gray-800 p-6">
      <div className="flex items-center justify-between mb-4"><h3 className="font-semibold">{t('tab-documents')} ({docs.length})</h3>{canManage && <label className="btn btn-primary btn-sm cursor-pointer">{uploading ? <span className="loading loading-spinner loading-xs"></span> : <PlusIcon className="w-4 h-4 mr-1" />}{t('doc-upload')}<input type="file" className="hidden" onChange={handleUpload} disabled={uploading} /></label>}</div>
      {loading ? <div className="text-center py-4"><span className="loading loading-spinner loading-sm"></span></div> : docs.length === 0 ? <p className="text-sm text-gray-500">{t('site-no-data')}</p> : (
        <div className="overflow-x-auto"><table className="table w-full"><thead><tr><th>{t('doc-filename')}</th><th>{t('doc-size')}</th><th>{t('doc-uploader')}</th><th>{t('created-at')}</th><th>{t('actions')}</th></tr></thead><tbody>{docs.map((d: any) => <tr key={d.id}><td><a href={`/api/documents/${d.id}`} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline text-sm">{d.fileName}</a></td><td className="text-xs text-gray-500">{fmtSize(d.fileSize)}</td><td className="text-xs text-gray-500">{d.uploadedBy?.position ? `${d.uploadedBy.position} ` : ''}{d.uploadedBy?.name}</td><td className="text-xs text-gray-500">{new Date(d.createdAt).toLocaleDateString('ko-KR')}</td><td>{canManage && <button className="btn btn-ghost btn-xs text-error" onClick={() => handleDel(d.id)}><TrashIcon className="w-3 h-3" /></button>}</td></tr>)}</tbody></table></div>
      )}
    </div>
  );
};

// ========= 이슈/클레임 =========
const issueTypes = ['누수', '손상', '색상 오류', '치수 불일치', '반입 문제', '재작업', '민원', '기타'];
const issueStatuses = ['발생', '조사중', '조치중', '완료', '보류'];
const IssuePanel = ({ siteId, issues, canManage, onMutate }: any) => {
  const { t } = useTranslation('common');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', type: '기타', occurredAt: '', location: '', description: '', responsibility: '' });
  const [sub, setSub] = useState(false);
  const handleSubmit = async () => { if (!form.title) return; setSub(true); await fetch(`/api/sites/${siteId}/issues`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) }); setForm({ title: '', type: '기타', occurredAt: '', location: '', description: '', responsibility: '' }); setShowForm(false); setSub(false); onMutate(); };
  const handleStatus = async (issueId: string, status: string) => { await fetch(`/api/sites/${siteId}/issues`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ issueId, status }) }); onMutate(); };
  const handleDel = async (issueId: string) => { if (!confirm(t('v2-issue-delete-confirm'))) return; await fetch(`/api/sites/${siteId}/issues`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ issueId }) }); onMutate(); };
  return (
    <div className="rounded-lg border border-gray-800 p-6">
      <div className="flex items-center justify-between mb-4"><h3 className="font-semibold">{t('tab-issues')}</h3>{canManage && <Button size="xs" color="primary" onClick={() => setShowForm(!showForm)}>{showForm ? t('cancel') : <><PlusIcon className="w-4 h-4 mr-1" />{t('v2-issue-add')}</>}</Button>}</div>
      {showForm && (
        <div className="border border-gray-700 rounded-lg p-4 mb-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div><label className="label"><span className="label-text text-xs">{t('v2-issue-title')} *</span></label><input type="text" className="input input-bordered input-sm w-full" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div><label className="label"><span className="label-text text-xs">{t('v2-issue-type')}</span></label><select className="select select-bordered select-sm w-full" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>{issueTypes.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
            <div><label className="label"><span className="label-text text-xs">{t('v2-issue-date')}</span></label><input type="date" className="input input-bordered input-sm w-full" value={form.occurredAt} onChange={(e) => setForm({ ...form, occurredAt: e.target.value })} /></div>
            <div><label className="label"><span className="label-text text-xs">{t('v2-issue-location')}</span></label><input type="text" className="input input-bordered input-sm w-full" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
            <div><label className="label"><span className="label-text text-xs">{t('v2-issue-resp')}</span></label><input type="text" className="input input-bordered input-sm w-full" value={form.responsibility} onChange={(e) => setForm({ ...form, responsibility: e.target.value })} /></div>
          </div>
          <div><label className="label"><span className="label-text text-xs">{t('site-description')}</span></label><textarea className="textarea textarea-bordered w-full text-sm" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div className="flex justify-end"><Button size="sm" color="primary" loading={sub} onClick={handleSubmit}>{t('save-changes')}</Button></div>
        </div>
      )}
      {issues.length === 0 ? <p className="text-sm text-gray-500">{t('site-no-data')}</p> : (
        <div className="space-y-2">{issues.map((i: any) => (
          <div key={i.id} className="rounded border border-gray-800 p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2"><span className="badge badge-xs badge-error">{i.type}</span><span className="text-sm font-medium">{i.title}</span></div>
              <div className="flex items-center gap-2">{canManage && <select className="select select-bordered select-xs" value={i.status} onChange={(e) => handleStatus(i.id, e.target.value)}>{issueStatuses.map((s) => <option key={s} value={s}>{s}</option>)}</select>}{canManage && <button className="btn btn-ghost btn-xs text-error" onClick={() => handleDel(i.id)}><TrashIcon className="w-3 h-3" /></button>}</div>
            </div>
            {i.description && <p className="text-sm text-gray-400 mt-1">{i.description}</p>}
            <div className="flex gap-3 mt-1 text-xs text-gray-500">{i.location && <span>{t('v2-issue-location')}: {i.location}</span>}{i.occurredAt && <span>{new Date(i.occurredAt).toLocaleDateString('ko-KR')}</span>}<span>{i.createdBy?.position ? `${i.createdBy.position} ` : ''}{i.createdBy?.name}</span></div>
          </div>
        ))}</div>
      )}
    </div>
  );
};

// ========= 변경관리 =========
const changeTypes = ['설계변경', '물량증감', '색상변경', '일정변경', '출하변경', '기타'];
const ChangePanel = ({ siteId, changes, canManage, onMutate }: any) => {
  const { t } = useTranslation('common');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ type: '기타', beforeValue: '', afterValue: '', reason: '', impact: '' });
  const [sub, setSub] = useState(false);
  const handleSubmit = async () => { setSub(true); await fetch(`/api/sites/${siteId}/changes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) }); setForm({ type: '기타', beforeValue: '', afterValue: '', reason: '', impact: '' }); setShowForm(false); setSub(false); onMutate(); };
  const handleApprove = async (changeId: string, status: string) => { await fetch(`/api/sites/${siteId}/changes`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ changeId, status }) }); onMutate(); };
  return (
    <div className="rounded-lg border border-gray-800 p-6">
      <div className="flex items-center justify-between mb-4"><h3 className="font-semibold">{t('tab-changes')}</h3><Button size="xs" color="primary" onClick={() => setShowForm(!showForm)}>{showForm ? t('cancel') : <><PlusIcon className="w-4 h-4 mr-1" />{t('v2-change-add')}</>}</Button></div>
      {showForm && (
        <div className="border border-gray-700 rounded-lg p-4 mb-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><label className="label"><span className="label-text text-xs">{t('v2-change-type')} *</span></label><select className="select select-bordered select-sm w-full" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>{changeTypes.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><label className="label"><span className="label-text text-xs">{t('v2-change-before')}</span></label><textarea className="textarea textarea-bordered w-full text-sm" rows={2} value={form.beforeValue} onChange={(e) => setForm({ ...form, beforeValue: e.target.value })} /></div>
            <div><label className="label"><span className="label-text text-xs">{t('v2-change-after')}</span></label><textarea className="textarea textarea-bordered w-full text-sm" rows={2} value={form.afterValue} onChange={(e) => setForm({ ...form, afterValue: e.target.value })} /></div>
          </div>
          <div><label className="label"><span className="label-text text-xs">{t('v2-change-reason')}</span></label><textarea className="textarea textarea-bordered w-full text-sm" rows={2} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></div>
          <div><label className="label"><span className="label-text text-xs">{t('v2-change-impact')}</span></label><input type="text" className="input input-bordered input-sm w-full" value={form.impact} onChange={(e) => setForm({ ...form, impact: e.target.value })} /></div>
          <div className="flex justify-end"><Button size="sm" color="primary" loading={sub} onClick={handleSubmit}>{t('save-changes')}</Button></div>
        </div>
      )}
      {changes.length === 0 ? <p className="text-sm text-gray-500">{t('site-no-data')}</p> : (
        <div className="space-y-2">{changes.map((c: any) => (
          <div key={c.id} className="rounded border border-gray-800 p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2"><span className="badge badge-sm badge-warning">{c.type}</span><span className={`badge badge-sm ${c.status === '승인' ? 'badge-success' : c.status === '반려' ? 'badge-error' : 'badge-ghost'}`}>{c.status}</span></div>
              {canManage && c.status === '요청' && <div className="flex gap-1"><button className="btn btn-xs btn-success" onClick={() => handleApprove(c.id, '승인')}>{t('v2-approve')}</button><button className="btn btn-xs btn-error" onClick={() => handleApprove(c.id, '반려')}>{t('v2-reject')}</button></div>}
            </div>
            {c.beforeValue && <p className="text-sm"><span className="text-gray-500">{t('v2-change-before')}:</span> {c.beforeValue}</p>}
            {c.afterValue && <p className="text-sm"><span className="text-gray-500">{t('v2-change-after')}:</span> {c.afterValue}</p>}
            {c.reason && <p className="text-sm text-gray-400 mt-1">{c.reason}</p>}
            <div className="flex gap-3 mt-2 text-xs text-gray-500"><span>{c.requester?.position ? `${c.requester.position} ` : ''}{c.requester?.name}</span>{c.approver && <span>{t('v2-approver')}: {c.approver.position ? `${c.approver.position} ` : ''}{c.approver.name}</span>}<span>{new Date(c.createdAt).toLocaleDateString('ko-KR')}</span></div>
          </div>
        ))}</div>
      )}
    </div>
  );
};

// ========= 일정 =========
const scheduleTypes = ['미팅', '생산 시작', '도장 완료', '출하 예정', '현장 방문', '보고 마감', '기타'];
const SchedulePanel = ({ siteId, schedules, canManage, onMutate }: any) => {
  const { t } = useTranslation('common');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', type: '기타', startDate: '', endDate: '', notes: '' });
  const [sub, setSub] = useState(false);
  const handleSubmit = async () => { if (!form.title || !form.startDate) return; setSub(true); await fetch(`/api/sites/${siteId}/schedules`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) }); setForm({ title: '', type: '기타', startDate: '', endDate: '', notes: '' }); setShowForm(false); setSub(false); onMutate(); };
  const handleToggle = async (scheduleId: string, isDone: boolean) => { await fetch(`/api/sites/${siteId}/schedules`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scheduleId, isDone }) }); onMutate(); };
  const handleDel = async (scheduleId: string) => { if (!confirm(t('v2-schedule-delete-confirm'))) return; await fetch(`/api/sites/${siteId}/schedules`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scheduleId }) }); onMutate(); };
  const today = new Date().toISOString().split('T')[0];
  return (
    <div className="rounded-lg border border-gray-800 p-6">
      <div className="flex items-center justify-between mb-4"><h3 className="font-semibold">{t('tab-schedule')}</h3>{canManage && <Button size="xs" color="primary" onClick={() => setShowForm(!showForm)}>{showForm ? t('cancel') : <><PlusIcon className="w-4 h-4 mr-1" />{t('v2-schedule-add')}</>}</Button>}</div>
      {showForm && (
        <div className="border border-gray-700 rounded-lg p-4 mb-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div><label className="label"><span className="label-text text-xs">{t('v2-schedule-title')} *</span></label><input type="text" className="input input-bordered input-sm w-full" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div><label className="label"><span className="label-text text-xs">{t('v2-schedule-type')}</span></label><select className="select select-bordered select-sm w-full" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>{scheduleTypes.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
            <div><label className="label"><span className="label-text text-xs">{t('start-date')} *</span></label><input type="date" className="input input-bordered input-sm w-full" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></div>
            <div><label className="label"><span className="label-text text-xs">{t('end-date')}</span></label><input type="date" className="input input-bordered input-sm w-full" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></div>
          </div>
          <div><label className="label"><span className="label-text text-xs">{t('client-notes')}</span></label><textarea className="textarea textarea-bordered w-full text-sm" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          <div className="flex justify-end"><Button size="sm" color="primary" loading={sub} onClick={handleSubmit}>{t('save-changes')}</Button></div>
        </div>
      )}
      {schedules.length === 0 ? <p className="text-sm text-gray-500">{t('site-no-data')}</p> : (
        <div className="space-y-2">{schedules.map((s: any) => {
          const start = s.startDate?.split('T')[0] || '';
          const isOverdue = !s.isDone && start < today;
          return (
            <div key={s.id} className={`rounded border p-3 flex items-center gap-3 ${s.isDone ? 'border-gray-800 opacity-60' : isOverdue ? 'border-red-800 bg-red-900/10' : 'border-gray-800'}`}>
              {canManage && <input type="checkbox" className="checkbox checkbox-sm" checked={s.isDone} onChange={() => handleToggle(s.id, !s.isDone)} />}
              <div className="flex-1">
                <div className="flex items-center gap-2"><span className="text-xs text-gray-500">{s.type}</span><span className={`text-sm font-medium ${s.isDone ? 'line-through' : ''}`}>{s.title}</span>{isOverdue && <span className="badge badge-xs badge-error">{t('v2-overdue')}</span>}</div>
                <div className="text-xs text-gray-500 mt-1">{new Date(s.startDate).toLocaleDateString('ko-KR')}{s.endDate && ` ~ ${new Date(s.endDate).toLocaleDateString('ko-KR')}`}{s.assignee && ` · ${s.assignee.position ? `${s.assignee.position} ` : ''}${s.assignee.name}`}</div>
              </div>
              {canManage && <button className="btn btn-ghost btn-xs text-error" onClick={() => handleDel(s.id)}><TrashIcon className="w-3 h-3" /></button>}
            </div>
          );
        })}</div>
      )}
    </div>
  );
};

// ========= 상태 이력 =========
const HistoryPanel = ({ history }: { history: any[] }) => {
  const { t } = useTranslation('common');
  return (
    <div className="rounded-lg border border-gray-800 p-6">
      <h3 className="font-semibold mb-4">{t('tab-history')}</h3>
      {history.length === 0 ? <p className="text-sm text-gray-500">{t('site-no-data')}</p> : (
        <div className="space-y-3">{history.map((h: any) => (
          <div key={h.id} className="flex items-start gap-3 border-l-2 border-gray-700 pl-4 py-2">
            <div className="flex-1">
              <div className="flex items-center gap-2"><StatusDot status={h.fromStatus} /><span className="text-sm">{h.fromStatus}</span><span className="text-gray-500">→</span><StatusDot status={h.toStatus} /><span className="text-sm font-medium">{h.toStatus}</span></div>
              {h.reason && <p className="text-sm text-gray-400 mt-1">{h.reason}</p>}
            </div>
            <div className="text-right shrink-0"><p className="text-xs text-gray-500">{h.changedBy?.position ? `${h.changedBy.position} ` : ''}{h.changedBy?.name}</p><p className="text-xs text-gray-500">{new Date(h.createdAt).toLocaleString('ko-KR')}</p></div>
          </div>
        ))}</div>
      )}
    </div>
  );
};

export async function getServerSideProps({ locale }: GetServerSidePropsContext) {
  return { props: { ...(locale ? await serverSideTranslations(locale, ['common']) : {}) } };
}

export default SiteDetail;
