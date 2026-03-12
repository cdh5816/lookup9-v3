import { GetServerSidePropsContext } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useTranslation } from 'next-i18next';
import { useState, useCallback, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import useSWR from 'swr';
import fetcher from '@/lib/fetcher';
import { Button } from 'react-daisyui';
import { PlusIcon, TrashIcon, MagnifyingGlassIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';

const STATUS_DOT: Record<string, string> = {
  영업중: 'bg-red-500', 대기: 'bg-red-400', 계약완료: 'bg-yellow-400', 진행중: 'bg-green-500', 부분완료: 'bg-green-300', 완료: 'bg-gray-400', 보류: 'bg-gray-600',
};
const StatusDot = ({ status }: { status: string }) => <span className={`inline-block h-2.5 w-2.5 rounded-full ${STATUS_DOT[status] || 'bg-gray-400'}`} />;

const parseLabel = (text: string | null | undefined, label: string) => {
  if (!text) return '';
  const esc = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = text.match(new RegExp(`${esc}\\s*[:：]\\s*([^\\n\\r]+)`, 'i'));
  return m?.[1]?.trim() || '';
};
const toNum = (value: string | number | null | undefined) => {
  const num = Number(String(value || '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(num) ? num : 0;
};
const pct = (v: number) => Math.max(0, Math.min(100, Math.round(v)));
const upsertLabel = (text: string | null | undefined, label: string, value: string) => {
  const source = text || '';
  const esc = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`${esc}\\s*[:：]\\s*([^\\n\\r]+)`, 'i');
  if (pattern.test(source)) return source.replace(pattern, `${label}: ${value}`);
  return [source.trim(), `${label}: ${value}`].filter(Boolean).join('\n');
};

const allTabs = ['overview', 'sales', 'contract', 'production', 'painting', 'shipping', 'documents', 'requests', 'issues', 'changes', 'schedule', 'history', 'comments'];

const SiteDetail = () => {
  const { t } = useTranslation('common');
  const router = useRouter();
  const { id, tab } = router.query;
  const [activeTab, setActiveTab] = useState('overview');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { data, mutate } = useSWR(id ? `/api/sites/${id}` : null, fetcher, { refreshInterval: 30000 });
  const site = data?.data;
  const { data: profileData } = useSWR('/api/my/profile', fetcher);
  const profile = profileData?.data;
  const userRole = profile?.role || profile?.teamMembers?.[0]?.role || 'USER';
  const permissions = profile?.permissions || {};

  useEffect(() => {
    if (typeof tab === 'string' && allTabs.includes(tab)) setActiveTab(tab);
  }, [tab]);

  const hidden = [
    !permissions.canSeeSales ? 'sales' : null,
    !permissions.canSeeContract ? 'contract' : null,
    !permissions.canSeeProduction ? 'production' : null,
    !permissions.canSeePainting ? 'painting' : null,
    !permissions.canSeeShipping ? 'shipping' : null,
  ].filter(Boolean) as string[];
  if (['PARTNER', 'GUEST', 'VIEWER'].includes(userRole)) hidden.push('sales', 'contract');

  const tabs = allTabs.filter((tabName) => !hidden.includes(tabName));
  const canManage = ['SUPER_ADMIN', 'OWNER', 'ADMIN_HR', 'ADMIN', 'MANAGER'].includes(userRole);
  const canDelete = ['SUPER_ADMIN', 'OWNER', 'ADMIN_HR', 'ADMIN'].includes(userRole);

  const handleAddComment = useCallback(async () => {
    if (!comment.trim() || !id) return;
    setSubmitting(true);
    await fetch('/api/comments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ siteId: id, content: comment }) });
    setComment('');
    setSubmitting(false);
    mutate();
  }, [comment, id, mutate]);

  const handleDeleteSite = async () => {
    if (!confirm(t('site-delete-confirm'))) return;
    await fetch(`/api/sites/${id}`, { method: 'DELETE' });
    router.push('/sites');
  };

  if (!site) return <div className="py-10 text-center"><span className="loading loading-spinner loading-md"></span></div>;

  const description = site.description || '';
  const pipeRate = pct(toNum(parseLabel(description, '하지파이프 진행률')));
  const caulkRate = pct(toNum(parseLabel(description, '코킹작업 진행률')));
  const quantity = toNum(parseLabel(description, '물량'));
  const incoming = (site.shipments || []).reduce((sum: number, item: any) => sum + toNum(item.quantity), 0);
  const panelRate = quantity > 0 ? pct((incoming / quantity) * 100) : 0;
  const startDocDone = parseLabel(description, '착수서류 완료') === 'Y';
  const finishDocDone = parseLabel(description, '준공서류 완료') === 'Y';
  const finalProgress = pct((pipeRate + caulkRate + panelRate + (startDocDone ? 100 : 0) + (finishDocDone ? 100 : 0)) / 5);

  return (
    <>
      <Head><title>{site.name} | LOOKUP9</title></Head>
      <div className="space-y-4">
        <div className="rounded-2xl border border-gray-800 p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <StatusDot status={site.status} />
                <h2 className="max-w-full break-words text-xl font-bold leading-7">{site.name}</h2>
                <span className="rounded-full border border-gray-700 px-2 py-0.5 text-xs text-gray-300">{site.status}</span>
              </div>
              <p className="mt-2 break-words text-sm leading-6 text-gray-400">
                {site.client?.name ? <span className="mr-3">{site.client.name}</span> : null}
                {site.address ? <span className="mr-3">{site.address}</span> : null}
                <span>{site.createdBy?.position ? `${site.createdBy.position} ${site.createdBy.name}` : site.createdBy?.name}</span>
              </p>
              <div className="mt-4 rounded-2xl border border-gray-800 bg-black/20 p-4">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="text-gray-400">최종 공정률</span>
                  <span className="font-bold">{finalProgress}%</span>
                </div>
                <div className="h-3 w-full overflow-hidden rounded-full bg-gray-800"><div className="h-full rounded-full bg-blue-600" style={{ width: `${finalProgress}%` }} /></div>
                <p className="mt-2 text-xs text-gray-500">세부 항목은 생산 탭에서 수정하고, 도장·출하 탭에서 실무 정보를 입력한다.</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {site._count?.requests > 0 ? <span className="badge badge-sm badge-warning">{t('v2-open-requests')}: {site._count.requests}</span> : null}
              {canDelete ? <Button color="error" size="xs" onClick={handleDeleteSite}>{t('delete')}</Button> : null}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MiniCard label="배정 인원" value={site.assignments?.length || 0} />
            <MiniCard label="도장 사양" value={site.paintSpecs?.length || 0} />
            <MiniCard label="출하 기록" value={site.shipments?.length || 0} />
            <MiniCard label="문서 수" value={site._count?.documents || 0} />
          </div>
        </div>

        <div className="border-b border-gray-800">
          <div className="flex gap-1 overflow-x-auto pb-1">
            {tabs.map((tabName) => (
              <button key={tabName} onClick={() => setActiveTab(tabName)} className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors ${activeTab === tabName ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-400 hover:text-gray-200'}`}>
                {t(`tab-${tabName}`)}
              </button>
            ))}
          </div>
        </div>

        {activeTab === 'overview' && <OverviewPanel site={site} siteId={id as string} canManage={canManage} onMutate={mutate} />}
        {activeTab === 'sales' && <SalesPanel siteId={id as string} sales={site.sales || []} canManage={canManage || permissions.canSeeSales} onMutate={mutate} />}
        {activeTab === 'contract' && <ContractPanel siteId={id as string} contracts={site.contracts || []} canManage={canManage || permissions.canSeeContract} onMutate={mutate} />}
        {activeTab === 'production' && <ProductionPanel site={site} siteId={id as string} canManage={canManage || permissions.canManageProgress} onMutate={mutate} />}
        {activeTab === 'painting' && <PaintPanel siteId={id as string} specs={site.paintSpecs || []} canManage={canManage || permissions.canSeePainting} onMutate={mutate} />}
        {activeTab === 'shipping' && <ShipmentPanel siteId={id as string} shipments={site.shipments || []} canManage={canManage || permissions.canSeeShipping} onMutate={mutate} />}
        {activeTab === 'documents' && <DocumentPanel siteId={id as string} />}
        {activeTab === 'requests' && <RequestPanel siteId={id as string} requests={site.requests || []} canManage={canManage || permissions.canSeeApprovals} onMutate={mutate} />}
        {activeTab === 'issues' && <SimpleListPanel title="이슈" items={site.issues || []} emptyText="등록된 이슈가 없습니다." />}
        {activeTab === 'changes' && <SimpleListPanel title="변경관리" items={site.changeLogs || []} emptyText="등록된 변경관리가 없습니다." />}
        {activeTab === 'schedule' && <SimpleListPanel title="일정" items={site.schedules || []} emptyText="등록된 일정이 없습니다." />}
        {activeTab === 'history' && <HistoryPanel history={site.statusHistory || []} />}
        {activeTab === 'comments' && (
          <div className="space-y-4">
            <div className="flex flex-col gap-3 md:flex-row">
              <textarea className="textarea textarea-bordered min-h-[100px] flex-1" placeholder={t('comment-placeholder')} value={comment} onChange={(e) => setComment(e.target.value)} rows={3} />
              <Button color="primary" size="sm" loading={submitting} onClick={handleAddComment}>{t('comment-submit')}</Button>
            </div>
            {(site.comments || []).length === 0 ? <p className="text-sm text-gray-500">{t('comment-none')}</p> : (
              <div className="space-y-3">
                {site.comments.map((c: any) => (
                  <div key={c.id} className="rounded-lg border border-gray-800 p-4">
                    <div className="mb-2 flex justify-between gap-3">
                      <span className="text-sm font-medium break-words">{c.author.position ? `${c.author.position} ` : ''}{c.author.name}{c.author.department ? <span className="ml-1 text-gray-500">({c.author.department})</span> : null}</span>
                      <span className="text-xs text-gray-500">{new Date(c.createdAt).toLocaleDateString('ko-KR')}</span>
                    </div>
                    <p className="whitespace-pre-wrap break-words text-sm leading-6">{c.content}</p>
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

const MiniCard = ({ label, value }: { label: string; value: number }) => (
  <div className="rounded-xl bg-gray-900/40 p-3 text-center">
    <p className="text-xs text-gray-500">{label}</p>
    <p className="mt-1 text-lg font-bold">{value}</p>
  </div>
);

const siteStatuses = ['영업중', '대기', '계약완료', '진행중', '부분완료', '완료', '보류'];
const OverviewPanel = ({ site, siteId, canManage, onMutate }: any) => {
  const { t } = useTranslation('common');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ status: site.status, description: site.description || '', statusReason: '' });
  const [saving, setSaving] = useState(false);
  const handleSave = async () => {
    setSaving(true);
    await fetch(`/api/sites/${siteId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    setSaving(false);
    setEditing(false);
    onMutate();
  };
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="rounded-lg border border-gray-800 p-4">
        <div className="mb-3 flex items-center justify-between"><h3 className="font-semibold">{t('tab-overview')}</h3>{canManage ? <Button size="xs" onClick={() => setEditing(!editing)}>{editing ? t('cancel') : t('edit')}</Button> : null}</div>
        <div className="space-y-3">
          <div>
            <p className="text-xs text-gray-500">{t('site-status')}</p>
            {editing ? <select className="select select-bordered select-sm mt-1 w-full" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{siteStatuses.map((status) => <option key={status} value={status}>{status}</option>)}</select> : <p className="mt-1 text-sm">{site.status}</p>}
          </div>
          <div>
            <p className="text-xs text-gray-500">{t('site-description')}</p>
            {editing ? <textarea className="textarea textarea-bordered mt-1 h-48 w-full" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /> : <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6">{site.description || '-'}</p>}
          </div>
        </div>
        {editing ? <div className="mt-3 flex justify-end gap-2"><Button size="xs" onClick={() => setEditing(false)}>{t('cancel')}</Button><Button size="xs" color="primary" loading={saving} onClick={handleSave}>{t('save-changes')}</Button></div> : null}
      </div>
      <AssignmentPanel siteId={siteId} assignments={site.assignments || []} canManage={canManage} onMutate={onMutate} />
    </div>
  );
};

const AssignmentPanel = ({ siteId, assignments, canManage, onMutate }: any) => {
  const { t } = useTranslation('common');
  const [showSearch, setShowSearch] = useState(false);
  const [sq, setSq] = useState('');
  const [sr, setSr] = useState<any[]>([]);
  const handleSearch = async (q: string) => {
    setSq(q);
    if (q.length < 1) return setSr([]);
    const r = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`);
    if (r.ok) {
      const d = await r.json();
      setSr(d.data || []);
    }
  };
  const handleAssign = async (userId: string) => {
    await fetch(`/api/sites/${siteId}/assignments`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId }) });
    setSq('');
    setSr([]);
    setShowSearch(false);
    onMutate();
  };
  const handleRemove = async (userId: string) => {
    if (!confirm(t('assign-remove-confirm'))) return;
    await fetch(`/api/sites/${siteId}/assignments`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId }) });
    onMutate();
  };
  return <div className="rounded-lg border border-gray-800 p-4"><div className="mb-3 flex items-center justify-between"><p className="text-xs text-gray-500">{t('site-assigned-members')} ({assignments.length})</p>{canManage ? <button className="btn btn-ghost btn-xs" onClick={() => setShowSearch(!showSearch)}><PlusIcon className="h-4 w-4" /> {t('assign-add')}</button> : null}</div>{showSearch ? <div className="mb-4 space-y-2"><div className="relative"><MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" /><input type="text" className="input input-bordered input-sm w-full pl-9" placeholder={t('assign-search-placeholder')} value={sq} onChange={(e) => handleSearch(e.target.value)} /></div>{sr.length > 0 ? <div className="max-h-40 overflow-y-auto rounded border border-gray-700">{sr.map((u) => <button key={u.id} onClick={() => handleAssign(u.id)} className="w-full px-3 py-2 text-left text-sm hover:bg-gray-800">{u.position ? `${u.position} ` : ''}{u.name} <span className="text-gray-500">({u.email})</span></button>)}</div> : null}</div> : null}{assignments.length === 0 ? <p className="text-sm text-gray-500">{t('site-no-assignments')}</p> : <div className="space-y-1">{assignments.map((a: any) => <div key={a.id} className="flex items-center justify-between gap-3 py-1"><p className="min-w-0 break-words text-sm">{a.user.position ? `${a.user.position} ` : ''}{a.user.name}<span className="ml-2 text-gray-500">{a.user.department || ''}</span></p>{canManage ? <button className="btn btn-ghost btn-xs text-error" onClick={() => handleRemove(a.user.id)}><TrashIcon className="h-3 w-3" /></button> : null}</div>)}</div>}</div>;
};

const SalesPanel = ({ siteId, sales, canManage, onMutate }: any) => {
  const { t } = useTranslation('common');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ status: '영업접촉', estimateAmount: '', meetingNotes: '' });
  const [sub, setSub] = useState(false);
  const statuses = ['영업접촉', '제안', '견적제출', '협상중', '수주확정', '실주'];
  const handleSubmit = async () => {
    setSub(true);
    await fetch(`/api/sites/${siteId}/sales`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    setSub(false); setShowForm(false); setForm({ status: '영업접촉', estimateAmount: '', meetingNotes: '' }); onMutate();
  };
  return <CrudTimelinePanel title={t('tab-sales')} items={sales} canManage={canManage} showForm={showForm} setShowForm={setShowForm} formNode={<div className="space-y-3"><select className="select select-bordered select-sm w-full" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{statuses.map((s) => <option key={s}>{s}</option>)}</select><input className="input input-bordered input-sm w-full" placeholder="견적금액" value={form.estimateAmount} onChange={(e) => setForm({ ...form, estimateAmount: e.target.value })} /><textarea className="textarea textarea-bordered w-full text-sm" rows={3} placeholder="미팅 메모" value={form.meetingNotes} onChange={(e) => setForm({ ...form, meetingNotes: e.target.value })} /></div>} onSubmit={handleSubmit} submitLoading={sub} renderItem={(s: any) => <><div className="flex items-center gap-2"><span className="badge badge-sm">{s.status}</span><span className="text-xs text-gray-500">{new Date(s.createdAt).toLocaleDateString('ko-KR')}</span></div>{s.estimateAmount ? <p className="mt-2 text-sm">견적금액: {Number(s.estimateAmount).toLocaleString()}</p> : null}{s.meetingNotes ? <p className="mt-2 break-words text-sm text-gray-400">{s.meetingNotes}</p> : null}</>} />;
};

const ContractPanel = ({ siteId, contracts, canManage, onMutate }: any) => {
  const { t } = useTranslation('common');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ status: '수주등록', contractAmount: '', specialNotes: '' });
  const [sub, setSub] = useState(false);
  const statuses = ['수주등록', '계약진행', '계약완료', '변경계약', '취소'];
  const handleSubmit = async () => {
    setSub(true);
    await fetch(`/api/sites/${siteId}/contracts`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    setSub(false); setShowForm(false); setForm({ status: '수주등록', contractAmount: '', specialNotes: '' }); onMutate();
  };
  return <CrudTimelinePanel title={t('tab-contract')} items={contracts} canManage={canManage} showForm={showForm} setShowForm={setShowForm} formNode={<div className="space-y-3"><select className="select select-bordered select-sm w-full" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{statuses.map((s) => <option key={s}>{s}</option>)}</select><input className="input input-bordered input-sm w-full" placeholder="계약금액" value={form.contractAmount} onChange={(e) => setForm({ ...form, contractAmount: e.target.value })} /><textarea className="textarea textarea-bordered w-full text-sm" rows={3} placeholder="특이사항" value={form.specialNotes} onChange={(e) => setForm({ ...form, specialNotes: e.target.value })} /></div>} onSubmit={handleSubmit} submitLoading={sub} renderItem={(c: any) => <><div className="flex items-center gap-2"><span className="badge badge-sm">{c.status}</span><span className="text-xs text-gray-500">{new Date(c.createdAt).toLocaleDateString('ko-KR')}</span></div>{c.contractAmount ? <p className="mt-2 text-sm">계약금액: {Number(c.contractAmount).toLocaleString()}</p> : null}{c.specialNotes ? <p className="mt-2 break-words text-sm text-gray-400">{c.specialNotes}</p> : null}</>} />;
};

const ProductionPanel = ({ site, siteId, canManage, onMutate }: any) => {
  const description = site.description || '';
  const [open, setOpen] = useState(true);
  const [form, setForm] = useState({
    pipeRate: String(pct(toNum(parseLabel(description, '하지파이프 진행률')))),
    caulkRate: String(pct(toNum(parseLabel(description, '코킹작업 진행률')))),
    startDocDone: parseLabel(description, '착수서류 완료') === 'Y',
    finishDocDone: parseLabel(description, '준공서류 완료') === 'Y',
  });
  const quantity = toNum(parseLabel(description, '물량'));
  const incoming = (site.shipments || []).reduce((sum: number, item: any) => sum + toNum(item.quantity), 0);
  const panelRate = quantity > 0 ? pct((incoming / quantity) * 100) : 0;
  const finalProgress = pct((pct(toNum(form.pipeRate)) + panelRate + pct(toNum(form.caulkRate)) + (form.startDocDone ? 100 : 0) + (form.finishDocDone ? 100 : 0)) / 5);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    let next = description;
    next = upsertLabel(next, '하지파이프 진행률', String(pct(toNum(form.pipeRate))));
    next = upsertLabel(next, '코킹작업 진행률', String(pct(toNum(form.caulkRate))));
    next = upsertLabel(next, '착수서류 완료', form.startDocDone ? 'Y' : 'N');
    next = upsertLabel(next, '준공서류 완료', form.finishDocDone ? 'Y' : 'N');
    await fetch(`/api/sites/${siteId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ description: next }) });
    setSaving(false);
    onMutate();
  };
  return <div className="rounded-2xl border border-gray-800 p-4"><button type="button" className="flex w-full items-center justify-between" onClick={() => setOpen((v) => !v)}><div><h3 className="font-semibold">생산 공정률 관리</h3><p className="mt-1 text-sm text-gray-500">최종 공정률 {finalProgress}%</p></div>{open ? <ChevronUpIcon className="h-5 w-5" /> : <ChevronDownIcon className="h-5 w-5" />}</button>{open ? <div className="mt-4 space-y-4"><ProgressInput label="하지파이프 진행률" value={form.pipeRate} onChange={(value) => setForm({ ...form, pipeRate: value })} disabled={!canManage} /><ReadOnlyProgress label="판넬 입고 진행률" value={panelRate} helper={`입고량 ${incoming.toLocaleString()} / 계약물량 ${quantity.toLocaleString()}`} /><ProgressInput label="코킹작업 진행률" value={form.caulkRate} onChange={(value) => setForm({ ...form, caulkRate: value })} disabled={!canManage} /><div className="grid grid-cols-1 gap-3 md:grid-cols-2"><label className="flex items-center gap-3 rounded-xl border border-gray-800 p-3"><input type="checkbox" className="checkbox checkbox-sm" checked={form.startDocDone} disabled={!canManage} onChange={(e) => setForm({ ...form, startDocDone: e.target.checked })} /><span>착수서류 완료</span></label><label className="flex items-center gap-3 rounded-xl border border-gray-800 p-3"><input type="checkbox" className="checkbox checkbox-sm" checked={form.finishDocDone} disabled={!canManage} onChange={(e) => setForm({ ...form, finishDocDone: e.target.checked })} /><span>준공서류 완료</span></label></div>{canManage ? <div className="flex justify-end"><Button color="primary" size="sm" loading={saving} onClick={save}>세부 공정률 저장</Button></div> : null}</div> : null}</div>;
};

const ProgressInput = ({ label, value, onChange, disabled }: any) => <div className="rounded-xl border border-gray-800 p-4"><div className="mb-2 flex items-center justify-between"><span className="text-sm text-gray-400">{label}</span><span className="font-semibold">{pct(toNum(value))}%</span></div><input type="range" min={0} max={100} step={1} value={pct(toNum(value))} disabled={disabled} onChange={(e) => onChange(e.target.value)} className="range range-sm" /><input className="input input-bordered input-sm mt-3 w-full" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} /></div>;
const ReadOnlyProgress = ({ label, value, helper }: any) => <div className="rounded-xl border border-gray-800 p-4"><div className="mb-2 flex items-center justify-between"><span className="text-sm text-gray-400">{label}</span><span className="font-semibold">{value}%</span></div><div className="h-2 w-full overflow-hidden rounded-full bg-gray-800"><div className="h-full rounded-full bg-blue-600" style={{ width: `${value}%` }} /></div><p className="mt-2 text-xs text-gray-500">{helper}</p></div>;

const PaintPanel = ({ siteId, specs, canManage, onMutate }: any) => {
  const [form, setForm] = useState({ colorCode: '', colorName: '', manufacturer: '', finishType: '', area: '', quantity: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    setSaving(true);
    await fetch(`/api/sites/${siteId}/paints`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    setSaving(false); setForm({ colorCode: '', colorName: '', manufacturer: '', finishType: '', area: '', quantity: '', notes: '' }); onMutate();
  };
  return <div className="space-y-4">{canManage ? <div className="rounded-2xl border border-gray-800 p-4"><h3 className="font-semibold">도료 발주 현황 등록</h3><div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2"><input className="input input-bordered input-sm w-full" placeholder="색상코드" value={form.colorCode} onChange={(e) => setForm({ ...form, colorCode: e.target.value })} /><input className="input input-bordered input-sm w-full" placeholder="색상명" value={form.colorName} onChange={(e) => setForm({ ...form, colorName: e.target.value })} /><input className="input input-bordered input-sm w-full" placeholder="제조사" value={form.manufacturer} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} /><input className="input input-bordered input-sm w-full" placeholder="마감타입" value={form.finishType} onChange={(e) => setForm({ ...form, finishType: e.target.value })} /><input className="input input-bordered input-sm w-full" placeholder="적용위치" value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} /><input className="input input-bordered input-sm w-full" placeholder="수량" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} /><textarea className="textarea textarea-bordered md:col-span-2" rows={3} placeholder="비고" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div><div className="mt-4 flex justify-end"><Button color="primary" size="sm" loading={saving} onClick={submit}>도료 발주 등록</Button></div></div> : null}<div className="grid grid-cols-1 gap-3">{specs.length === 0 ? <div className="rounded-2xl border border-gray-800 p-6 text-sm text-gray-500">등록된 도장 항목이 없습니다.</div> : specs.map((spec: any) => <div key={spec.id} className="rounded-2xl border border-gray-800 p-4"><div className="flex flex-wrap items-center gap-2"><span className="badge badge-sm">{spec.status || '임시'}</span><span className="font-semibold">{spec.colorName}</span><span className="text-sm text-gray-500">{spec.colorCode}</span></div><div className="mt-2 grid grid-cols-2 gap-2 text-sm text-gray-400 md:grid-cols-4"><span>제조사: {spec.manufacturer || '-'}</span><span>마감: {spec.finishType || '-'}</span><span>위치: {spec.area || '-'}</span><span>수량: {spec.quantity || '-'}</span></div>{spec.notes ? <p className="mt-2 break-words text-sm leading-6">{spec.notes}</p> : null}</div>)}</div></div>;
};

const ShipmentPanel = ({ siteId, shipments, canManage, onMutate }: any) => {
  const [form, setForm] = useState({ shipmentType: '출고예정', quantity: '', vehicleInfo: '', driverInfo: '', destination: '', receivedBy: '', notes: '', shippedAt: '' });
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    setSaving(true);
    await fetch(`/api/sites/${siteId}/shipments`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    setSaving(false); setForm({ shipmentType: '출고예정', quantity: '', vehicleInfo: '', driverInfo: '', destination: '', receivedBy: '', notes: '', shippedAt: '' }); onMutate();
  };
  return <div className="space-y-4">{canManage ? <div className="rounded-2xl border border-gray-800 p-4"><h3 className="font-semibold">화물 / 기사 정보 등록</h3><div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2"><input className="input input-bordered input-sm w-full" placeholder="출하유형" value={form.shipmentType} onChange={(e) => setForm({ ...form, shipmentType: e.target.value })} /><input className="input input-bordered input-sm w-full" placeholder="수량" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} /><input className="input input-bordered input-sm w-full" placeholder="차량정보" value={form.vehicleInfo} onChange={(e) => setForm({ ...form, vehicleInfo: e.target.value })} /><input className="input input-bordered input-sm w-full" placeholder="기사정보" value={form.driverInfo} onChange={(e) => setForm({ ...form, driverInfo: e.target.value })} /><input className="input input-bordered input-sm w-full" placeholder="목적지" value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} /><input className="input input-bordered input-sm w-full" placeholder="인수자" value={form.receivedBy} onChange={(e) => setForm({ ...form, receivedBy: e.target.value })} /><input type="date" className="input input-bordered input-sm w-full" value={form.shippedAt} onChange={(e) => setForm({ ...form, shippedAt: e.target.value })} /><textarea className="textarea textarea-bordered md:col-span-2" rows={3} placeholder="전달 메모" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div><div className="mt-4 flex justify-end"><Button color="primary" size="sm" loading={saving} onClick={submit}>출하 정보 등록</Button></div></div> : null}<div className="grid grid-cols-1 gap-3">{shipments.length === 0 ? <div className="rounded-2xl border border-gray-800 p-6 text-sm text-gray-500">등록된 출하 정보가 없습니다.</div> : shipments.map((record: any) => <div key={record.id} className="rounded-2xl border border-gray-800 p-4"><div className="flex flex-wrap items-center gap-2"><span className="badge badge-sm">{record.status || '출하예정'}</span><span className="font-semibold">{record.shipmentNo || `차수 ${record.sequence}`}</span><span className="text-sm text-gray-500">수량 {record.quantity || '-'}</span></div><div className="mt-2 grid grid-cols-1 gap-2 text-sm text-gray-400 md:grid-cols-2"><span>차량: {record.vehicleInfo || '-'}</span><span>기사: {record.driverInfo || '-'}</span><span>도착지: {record.destination || '-'}</span><span>인수자: {record.receivedBy || '-'}</span></div>{record.notes ? <p className="mt-2 break-words text-sm leading-6">{record.notes}</p> : null}</div>)}</div></div>;
};

const RequestPanel = ({ siteId, requests, canManage, onMutate }: any) => {
  const [form, setForm] = useState({ title: '', type: '내부 요청', priority: '보통', targetDept: '생산관리팀', deadline: '', description: '' });
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    setSaving(true);
    await fetch(`/api/sites/${siteId}/requests`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    setSaving(false); setForm({ title: '', type: '내부 요청', priority: '보통', targetDept: '생산관리팀', deadline: '', description: '' }); onMutate();
  };
  return <div className="space-y-4">{canManage ? <div className="rounded-2xl border border-gray-800 p-4"><h3 className="font-semibold">요청사항 / 미팅요청 / 전자결재 등록</h3><div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2"><input className="input input-bordered input-sm w-full md:col-span-2" placeholder="제목" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /><select className="select select-bordered select-sm w-full" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}><option>내부 요청</option><option>미팅요청</option><option>전자결재</option><option>변경승인</option></select><select className="select select-bordered select-sm w-full" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}><option>낮음</option><option>보통</option><option>높음</option><option>긴급</option></select><select className="select select-bordered select-sm w-full" value={form.targetDept} onChange={(e) => setForm({ ...form, targetDept: e.target.value })}><option>영업부</option><option>수주팀</option><option>생산관리팀</option><option>도장팀</option><option>출하팀</option><option>공사팀</option><option>경영지원부</option></select><input type="date" className="input input-bordered input-sm w-full" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} /><textarea className="textarea textarea-bordered md:col-span-2" rows={4} placeholder="상세 내용" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div><div className="mt-4 flex justify-end"><Button color="primary" size="sm" loading={saving} onClick={submit}>요청 등록</Button></div></div> : null}<div className="space-y-3">{requests.length === 0 ? <div className="rounded-2xl border border-gray-800 p-6 text-sm text-gray-500">등록된 요청사항이 없습니다.</div> : requests.map((item: any) => <div key={item.id} className="rounded-2xl border border-gray-800 p-4"><div className="flex flex-wrap items-center gap-2"><span className="badge badge-sm">{item.type}</span><span className="badge badge-sm badge-outline">{item.status}</span><span className="font-semibold break-words">{item.title}</span></div><div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-500"><span>우선순위 {item.priority || '-'}</span><span>대상부서 {item.targetDept || '-'}</span><span>기한 {item.deadline ? new Date(item.deadline).toLocaleDateString('ko-KR') : '-'}</span></div>{item.description ? <p className="mt-2 break-words text-sm leading-6">{item.description}</p> : null}{item.result ? <div className="mt-2 rounded-lg bg-gray-900/40 p-3 text-sm text-gray-300">처리결과: {item.result}</div> : null}</div>)}</div></div>;
};

const DocumentPanel = ({ siteId }: { siteId: string }) => {
  const { data } = useSWR(`/api/sites/${siteId}/documents`, fetcher);
  const docs = data?.data || [];
  return <div className="rounded-2xl border border-gray-800 p-4">{docs.length === 0 ? <p className="text-sm text-gray-500">등록된 문서가 없습니다.</p> : <div className="space-y-2">{docs.map((doc: any) => <div key={doc.id} className="rounded-xl border border-gray-800 p-3"><p className="font-medium">{doc.name || doc.title || '문서'}</p></div>)}</div>}</div>;
};

const SimpleListPanel = ({ title, items, emptyText }: any) => <div className="rounded-2xl border border-gray-800 p-4"><h3 className="font-semibold">{title}</h3>{items.length === 0 ? <p className="mt-3 text-sm text-gray-500">{emptyText}</p> : <div className="mt-3 space-y-2">{items.map((item: any) => <div key={item.id} className="rounded-xl border border-gray-800 p-3"><p className="font-medium">{item.title || item.fromStatus || '항목'}</p><p className="mt-1 break-words text-sm text-gray-400">{item.content || item.note || item.reason || item.message || '-'}</p></div>)}</div>}</div>;

const HistoryPanel = ({ history }: any) => <div className="rounded-2xl border border-gray-800 p-4">{history.length === 0 ? <p className="text-sm text-gray-500">상태이력이 없습니다.</p> : <div className="space-y-2">{history.map((item: any) => <div key={item.id} className="rounded-xl border border-gray-800 p-3"><p className="font-medium">{item.fromStatus || '-'} → {item.toStatus || '-'}</p><p className="mt-1 text-sm text-gray-400">{item.reason || '사유 미입력'}</p><p className="mt-1 text-xs text-gray-500">{item.changedBy?.name || '-'} · {new Date(item.createdAt).toLocaleDateString('ko-KR')}</p></div>)}</div>}</div>;

const CrudTimelinePanel = ({ title, items, canManage, showForm, setShowForm, formNode, onSubmit, submitLoading, renderItem }: any) => (
  <div className="rounded-2xl border border-gray-800 p-4">
    <div className="mb-4 flex items-center justify-between">
      <h3 className="font-semibold">{title}</h3>
      {canManage ? <Button size="xs" color="primary" onClick={() => setShowForm(!showForm)}>{showForm ? '취소' : <><PlusIcon className="mr-1 h-4 w-4" />추가</>}</Button> : null}
    </div>
    {showForm ? <div className="mb-4 rounded-xl border border-gray-700 p-4">{formNode}<div className="mt-4 flex justify-end"><Button size="sm" color="primary" loading={submitLoading} onClick={onSubmit}>저장</Button></div></div> : null}
    {items.length === 0 ? <p className="text-sm text-gray-500">등록된 항목이 없습니다.</p> : <div className="space-y-3">{items.map((item: any) => <div key={item.id} className="rounded-xl border border-gray-800 p-3">{renderItem(item)}</div>)}</div>}
  </div>
);

export async function getServerSideProps({ locale }: GetServerSidePropsContext) {
  return { props: { ...(locale ? await serverSideTranslations(locale, ['common']) : {}) } };
}

export default SiteDetail;
