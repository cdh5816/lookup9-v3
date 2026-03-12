/*
 * AIRX (individual business) proprietary source.
 * Owner: AIRX / choe DONGHYUN. All rights reserved.
 */

import { GetServerSidePropsContext } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useTranslation } from 'next-i18next';
import { useState, useCallback, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import useSWR from 'swr';
import fetcher from '@/lib/fetcher';
import { Button } from 'react-daisyui';
import { PlusIcon, TrashIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';

const STATUS_DOT: Record<string, string> = {
  영업중: 'bg-red-500', 대기: 'bg-red-400', 계약완료: 'bg-yellow-400', 진행중: 'bg-green-500', 부분완료: 'bg-green-300', 완료: 'bg-gray-400', 보류: 'bg-gray-600',
};
const StatusDot = ({ status }: { status: string }) => <span className={`inline-block w-2.5 h-2.5 rounded-full mr-2 ${STATUS_DOT[status] || 'bg-gray-400'}`} />;
const allTabs = ['overview', 'sales', 'contract', 'production', 'painting', 'shipping', 'documents', 'requests', 'issues', 'changes', 'schedule', 'history', 'comments'];
const hiddenTabsByRole: Record<string, string[]> = { PARTNER: ['sales', 'contract'], GUEST: ['sales', 'contract', 'production', 'painting', 'shipping', 'requests', 'issues', 'changes', 'schedule', 'history'] };
const siteStatuses = ['영업중', '대기', '계약완료', '진행중', '부분완료', '완료', '보류'];

const parseLabeledValue = (text: string | null | undefined, label: string) => {
  if (!text) return '';
  const line = String(text)
    .split(/\r?\n/)
    .find((row) => row.trim().startsWith(`${label}:`) || row.trim().startsWith(`${label}：`));
  if (!line) return '';
  const value = line.split(/[:：]/).slice(1).join(':').trim();
  return value || '';
};
const upsertLabeledValue = (text: string | null | undefined, label: string, value: string) => {
  const rows = String(text || '').split(/\r?\n/).filter((row) => row.length > 0);
  const nextRow = `${label}: ${value}`;
  const index = rows.findIndex((row) => row.trim().startsWith(`${label}:`) || row.trim().startsWith(`${label}：`));
  if (index >= 0) {
    rows[index] = nextRow;
  } else {
    rows.push(nextRow);
  }
  return rows.join('
');
};
const parseNumberValue = (value: string | number | null | undefined) => {
  if (value === null || value === undefined) return 0;
  const num = Number(String(value).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(num) ? num : 0;
};
const clampPercent = (value: number) => !Number.isFinite(value) ? 0 : value < 0 ? 0 : value > 100 ? 100 : Math.round(value);
const parsePercentValue = (value: string | null | undefined) => clampPercent(parseNumberValue(value));
const parseBooleanValue = (value: string | null | undefined) => ['y', 'yes', 'true', '1', '완료', 'checked'].includes(String(value || '').trim().toLowerCase());
const getShipmentQuantity = (shipments: any[] = []) => shipments.reduce((sum, item) => sum + parseNumberValue(item?.quantity ?? item?.qty ?? item?.amount ?? item?.shippedQuantity ?? 0), 0);
const ProgressBar = ({ value }: { value: number }) => <div className="h-2 w-full overflow-hidden rounded-full bg-gray-800"><div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${clampPercent(value)}%` }} /></div>;

const SiteDetail = () => {
  const { t } = useTranslation('common');
  const router = useRouter();
  const { id } = router.query;
  const [activeTab, setActiveTab] = useState('overview');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showProgressDetails, setShowProgressDetails] = useState(false);
  const [processingSalesDone, setProcessingSalesDone] = useState(false);

  const { data, mutate } = useSWR(id ? `/api/sites/${id}` : null, fetcher, { refreshInterval: 30000 });
  const site = data?.data;
  const { data: profileData } = useSWR('/api/my/profile', fetcher);
  const userRole = profileData?.data?.role || profileData?.data?.teamMembers?.[0]?.role || 'USER';
  const hidden = hiddenTabsByRole[userRole] || [];
  const tabs = allTabs.filter((tab) => !hidden.includes(tab));
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

  const handleSalesDone = async () => {
    if (!id || !site || site.status !== '영업중') return;
    if (!confirm('이 현장을 영업완료 처리하고 계약완료 상태로 넘기시겠습니까?')) return;
    setProcessingSalesDone(true);
    await fetch(`/api/sites/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: '계약완료', statusReason: '영업완료 버튼 처리' }),
    });
    setProcessingSalesDone(false);
    mutate();
  };

  if (!site) return <div className="text-center py-10"><span className="loading loading-spinner loading-md"></span></div>;

  const contractQuantity = parseNumberValue(parseLabeledValue(site.description, '물량'));
  const pipeRate = parsePercentValue(parseLabeledValue(site.description, '하지파이프 진행률') || parseLabeledValue(site.description, '하지파이프 설치율'));
  const caulkingRate = parsePercentValue(parseLabeledValue(site.description, '코킹작업 진행률'));
  const startDocsDone = parseBooleanValue(parseLabeledValue(site.description, '착수서류 완료'));
  const completionDocsDone = parseBooleanValue(parseLabeledValue(site.description, '준공서류 완료'));
  const panelInQuantity = getShipmentQuantity(site.shipments || []);
  const panelRate = contractQuantity > 0 ? clampPercent((panelInQuantity / contractQuantity) * 100) : 0;
  const finalProgress = clampPercent((pipeRate + panelRate + caulkingRate + (startDocsDone ? 100 : 0) + (completionDocsDone ? 100 : 0)) / 5);

  return (
    <>
      <Head><title>{site.name} | LOOKUP9</title></Head>
      <div className="space-y-4">
        <div className="rounded-lg border border-gray-800 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center flex-wrap">
                <StatusDot status={site.status} />
                <h2 className="text-xl font-bold">{site.name}</h2>
                <span className="ml-2 text-sm text-gray-400">{site.status}</span>
              </div>
              <p className="mt-1 text-sm text-gray-400">{site.client?.name && <span className="mr-3">{site.client.name}</span>}{site.address && <span className="mr-3">{site.address}</span>}<span>{site.createdBy.position ? `${site.createdBy.position} ` : ''}{site.createdBy.name}</span></p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {canManage && site.status === '영업중' ? <Button color="warning" size="xs" loading={processingSalesDone} onClick={handleSalesDone}>영업완료 처리</Button> : null}
              {site._count?.requests > 0 ? <span className="badge badge-sm badge-warning">{t('v2-open-requests')}: {site._count.requests}</span> : null}
              {canDelete ? <Button color="error" size="xs" onClick={handleDeleteSite}>{t('delete')}</Button> : null}
            </div>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-5">
            <div className="md:col-span-2 rounded-xl border border-gray-700 bg-gray-900/40 p-4">
              <button type="button" onClick={() => setShowProgressDetails((prev) => !prev)} className="w-full text-left">
                <div className="flex items-center justify-between gap-3">
                  <div><p className="text-xs text-gray-500">최종 공정률</p><p className="mt-1 text-2xl font-bold">{finalProgress}%</p></div>
                  <div className="text-right text-xs text-gray-400"><p>클릭해서 세부 공정률 보기</p><p className="mt-1">{showProgressDetails ? '접기' : '펼치기'}</p></div>
                </div>
                <div className="mt-3"><ProgressBar value={finalProgress} /></div>
              </button>
              {showProgressDetails ? <div className="mt-4 border-t border-gray-800 pt-4"><ProgressDetailEditor site={site} siteId={id as string} canManage={canManage} panelRate={panelRate} panelInQuantity={panelInQuantity} contractQuantity={contractQuantity} onMutate={mutate} /></div> : null}
            </div>
            <CountCard label={t('v2-assignments')} value={site.assignments?.length || 0} />
            <CountCard label={t('v2-paint-specs')} value={site.paintSpecs?.length || 0} />
            <CountCard label={t('v2-shipments')} value={site.shipments?.length || 0} />
            <CountCard label={t('tab-documents')} value={site._count?.documents || 0} />
          </div>
        </div>

        <div className="border-b border-gray-800"><div className="flex gap-1 overflow-x-auto">{tabs.map((tab) => <button key={tab} onClick={() => setActiveTab(tab)} className={`px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${activeTab === tab ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-400 hover:text-gray-200'}`}>{t(`tab-${tab}`)}</button>)}</div></div>

        {activeTab === 'overview' && <OverviewPanel site={site} siteId={id as string} canManage={canManage} onMutate={mutate} />}
        {activeTab === 'sales' && <SalesPanel siteId={id as string} sales={site.sales} canManage={canManage} onMutate={mutate} />}
        {activeTab === 'contract' && <ContractPanel siteId={id as string} contracts={site.contracts} canManage={canManage} onMutate={mutate} />}
        {activeTab === 'production' && <div className="rounded-lg border border-gray-800 p-6 text-center"><p className="text-gray-500">{t('coming-soon')}</p></div>}
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
            {(site.comments || []).length === 0 ? <p className="text-sm text-gray-500">{t('comment-none')}</p> : <div className="space-y-3">{site.comments.map((c: any) => <div key={c.id} className="rounded-lg border border-gray-800 p-4"><div className="mb-2 flex justify-between"><span className="text-sm font-medium">{c.author.position ? `${c.author.position} ` : ''}{c.author.name}{c.author.department ? <span className="ml-1 text-gray-500">({c.author.department})</span> : null}</span><span className="text-xs text-gray-500">{new Date(c.createdAt).toLocaleDateString('ko-KR')}</span></div><p className="whitespace-pre-wrap text-sm">{c.content}</p></div>)}</div>}
          </div>
        )}
      </div>
    </>
  );
};

const CountCard = ({ label, value }: { label: string; value: number }) => <div className="rounded-xl bg-gray-800/30 p-2 text-center"><p className="text-xs text-gray-500">{label}</p><p className="text-lg font-bold">{value}</p></div>;

const ProgressDetailEditor = ({ site, siteId, canManage, panelRate, panelInQuantity, contractQuantity, onMutate }: any) => {
  const [pipeRate, setPipeRate] = useState(parsePercentValue(parseLabeledValue(site?.description, '하지파이프 진행률') || parseLabeledValue(site?.description, '하지파이프 설치율')));
  const [caulkingRate, setCaulkingRate] = useState(parsePercentValue(parseLabeledValue(site?.description, '코킹작업 진행률')));
  const [startDocsDone, setStartDocsDone] = useState(parseBooleanValue(parseLabeledValue(site?.description, '착수서류 완료')));
  const [completionDocsDone, setCompletionDocsDone] = useState(parseBooleanValue(parseLabeledValue(site?.description, '준공서류 완료')));
  const [savingProgress, setSavingProgress] = useState(false);

  useEffect(() => {
    setPipeRate(parsePercentValue(parseLabeledValue(site?.description, '하지파이프 진행률') || parseLabeledValue(site?.description, '하지파이프 설치율')));
    setCaulkingRate(parsePercentValue(parseLabeledValue(site?.description, '코킹작업 진행률')));
    setStartDocsDone(parseBooleanValue(parseLabeledValue(site?.description, '착수서류 완료')));
    setCompletionDocsDone(parseBooleanValue(parseLabeledValue(site?.description, '준공서류 완료')));
  }, [site?.description]);

  const handleSaveProgress = async () => {
    if (!canManage) return;
    setSavingProgress(true);
    let description = site?.description || '';
    description = upsertLabeledValue(description, '하지파이프 진행률', String(clampPercent(pipeRate)));
    description = upsertLabeledValue(description, '코킹작업 진행률', String(clampPercent(caulkingRate)));
    description = upsertLabeledValue(description, '착수서류 완료', startDocsDone ? '완료' : '미완료');
    description = upsertLabeledValue(description, '준공서류 완료', completionDocsDone ? '완료' : '미완료');
    await fetch(`/api/sites/${siteId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ description }) });
    setSavingProgress(false);
    onMutate();
  };

  return <div className="space-y-3"><div className="grid grid-cols-1 gap-3 md:grid-cols-3"><ProgressMetricCard title="하지파이프 진행률" value={pipeRate} editable={canManage} onChange={setPipeRate} /><div className="rounded-lg bg-black/20 p-3"><div className="mb-2 flex items-center justify-between text-xs text-gray-400"><span>판넬 입고 진행률</span><span>{panelRate}%</span></div><ProgressBar value={panelRate} /><p className="mt-2 text-xs text-gray-500">입고 {panelInQuantity.toLocaleString()} / 계약물량 {contractQuantity.toLocaleString()}</p></div><ProgressMetricCard title="코킹작업 진행률" value={caulkingRate} editable={canManage} onChange={setCaulkingRate} /></div><div className="grid grid-cols-1 gap-3 md:grid-cols-2"><label className="flex items-center justify-between rounded-lg border border-gray-700 bg-black/20 px-4 py-3 text-sm"><span>착수서류 완료</span><input type="checkbox" className="checkbox checkbox-sm checkbox-primary" checked={startDocsDone} onChange={(e) => setStartDocsDone(e.target.checked)} disabled={!canManage} /></label><label className="flex items-center justify-between rounded-lg border border-gray-700 bg-black/20 px-4 py-3 text-sm"><span>준공서류 완료</span><input type="checkbox" className="checkbox checkbox-sm checkbox-primary" checked={completionDocsDone} onChange={(e) => setCompletionDocsDone(e.target.checked)} disabled={!canManage} /></label></div>{canManage ? <div className="flex justify-end"><Button size="sm" color="primary" loading={savingProgress} onClick={handleSaveProgress}>세부공정률 저장</Button></div> : null}</div>;
};

const ProgressMetricCard = ({ title, value, editable, onChange }: { title: string; value: number; editable: boolean; onChange: (next: number) => void; }) => <div className="rounded-lg bg-black/20 p-3"><div className="mb-2 flex items-center justify-between text-xs text-gray-400"><span>{title}</span><span>{clampPercent(value)}%</span></div><ProgressBar value={value} />{editable ? <input type="range" min="0" max="100" step="1" value={value} onChange={(e) => onChange(Number(e.target.value))} className="range range-primary range-xs mt-3" /> : null}</div>;

const OverviewPanel = ({ site, siteId, canManage, onMutate }: any) => {
  const { t } = useTranslation('common');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ status: site.status, description: site.description || '', statusReason: '' });
  const [saving, setSaving] = useState(false);
  const handleSave = async () => { setSaving(true); await fetch(`/api/sites/${siteId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) }); setSaving(false); setEditing(false); onMutate(); };
  return <div className="space-y-4"><div className="grid grid-cols-1 gap-4 md:grid-cols-2"><div className="rounded-lg border border-gray-800 p-4"><p className="mb-1 text-xs text-gray-500">{t('site-client')}</p><p className="font-medium">{site.client?.name || '-'}</p></div><div className="rounded-lg border border-gray-800 p-4"><div className="mb-1 flex items-center justify-between"><p className="text-xs text-gray-500">{t('site-status-label')}</p>{canManage && !editing ? <button className="btn btn-ghost btn-xs" onClick={() => setEditing(true)}>{t('edit')}</button> : null}</div>{editing ? <div className="space-y-2"><select className="select select-bordered select-sm w-full" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{siteStatuses.map((s) => <option key={s} value={s}>{s}</option>)}</select><input type="text" className="input input-bordered input-sm w-full" placeholder={t('v2-status-reason')} value={form.statusReason} onChange={(e) => setForm({ ...form, statusReason: e.target.value })} /></div> : <p className="font-medium"><StatusDot status={site.status} />{site.status}</p>}</div></div><div className="rounded-lg border border-gray-800 p-4"><div className="mb-1 flex items-center justify-between"><p className="text-xs text-gray-500">{t('site-description')}</p>{canManage && !editing ? <button className="btn btn-ghost btn-xs" onClick={() => setEditing(true)}>{t('edit')}</button> : null}</div>{editing ? <textarea className="textarea textarea-bordered w-full text-sm" rows={5} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /> : <p className="whitespace-pre-wrap text-sm">{site.description || '-'}</p>}{editing ? <div className="mt-2 flex justify-end gap-2"><Button size="xs" onClick={() => setEditing(false)}>{t('cancel')}</Button><Button size="xs" color="primary" loading={saving} onClick={handleSave}>{t('save-changes')}</Button></div> : null}</div><AssignmentPanel siteId={siteId} assignments={site.assignments} canManage={canManage} onMutate={onMutate} /></div>;
};

const AssignmentPanel = ({ siteId, assignments, canManage, onMutate }: any) => {
  const { t } = useTranslation('common');
  const [showSearch, setShowSearch] = useState(false); const [sq, setSq] = useState(''); const [sr, setSr] = useState<any[]>([]);
  const handleSearch = async (q: string) => { setSq(q); if (q.length < 1) { setSr([]); return; } const r = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`); if (r.ok) { const d = await r.json(); setSr(d.data || []); } };
  const handleAssign = async (userId: string) => { await fetch(`/api/sites/${siteId}/assignments`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId }) }); setSq(''); setSr([]); setShowSearch(false); onMutate(); };
  const handleRemove = async (userId: string) => { if (!confirm(t('assign-remove-confirm'))) return; await fetch(`/api/sites/${siteId}/assignments`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId }) }); onMutate(); };
  return <div className="rounded-lg border border-gray-800 p-4"><div className="mb-3 flex items-center justify-between"><p className="text-xs text-gray-500">{t('site-assigned-members')} ({assignments.length})</p>{canManage ? <button className="btn btn-ghost btn-xs" onClick={() => setShowSearch(!showSearch)}><PlusIcon className="mr-1 h-4 w-4" />{t('assign-add')}</button> : null}</div>{showSearch ? <div className="mb-4 space-y-2"><div className="relative"><MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" /><input type="text" className="input input-bordered input-sm w-full pl-9" placeholder={t('assign-search-placeholder')} value={sq} onChange={(e) => handleSearch(e.target.value)} /></div>{sr.length > 0 ? <div className="max-h-40 overflow-y-auto rounded border border-gray-700">{sr.map((u) => <button key={u.id} onClick={() => handleAssign(u.id)} className="w-full px-3 py-2 text-left text-sm hover:bg-gray-800">{u.position ? `${u.position} ` : ''}{u.name} <span className="text-gray-500">({u.email})</span></button>)}</div> : null}</div> : null}{assignments.length === 0 ? <p className="text-sm text-gray-500">{t('site-no-assignments')}</p> : <div className="space-y-1">{assignments.map((a: any) => <div key={a.id} className="flex items-center justify-between py-1"><p className="text-sm">{a.user.position ? `${a.user.position} ` : ''}{a.user.name}<span className="ml-2 text-gray-500">{a.user.department || ''}</span></p>{canManage ? <button className="btn btn-ghost btn-xs text-error" onClick={() => handleRemove(a.user.id)}><TrashIcon className="h-3 w-3" /></button> : null}</div>)}</div>}</div>;
};

const SalesPanel = ({ sales }: any) => { const { t } = useTranslation('common'); return <div className="rounded-lg border border-gray-800 p-6">{sales.length === 0 ? <p className="text-sm text-gray-500">{t('site-no-data')}</p> : sales.map((s: any) => <div key={s.id} className="border-b border-gray-800 py-3 last:border-0"><div className="flex items-center justify-between"><span className="badge badge-sm">{s.status}</span><span className="text-xs text-gray-500">{new Date(s.createdAt).toLocaleDateString('ko-KR')}</span></div>{s.estimateAmount ? <p className="mt-1 text-sm">{t('site-estimate')}: {Number(s.estimateAmount).toLocaleString()}</p> : null}{s.meetingNotes ? <p className="mt-1 text-sm text-gray-400">{s.meetingNotes}</p> : null}</div>)}</div>; };
const ContractPanel = ({ contracts }: any) => { const { t } = useTranslation('common'); return <div className="rounded-lg border border-gray-800 p-6">{contracts.length === 0 ? <p className="text-sm text-gray-500">{t('site-no-data')}</p> : contracts.map((c: any) => <div key={c.id} className="border-b border-gray-800 py-3 last:border-0"><div className="flex items-center justify-between"><span className="badge badge-sm">{c.status}</span><span className="text-xs text-gray-500">{new Date(c.createdAt).toLocaleDateString('ko-KR')}</span></div>{c.contractAmount ? <p className="mt-1 text-sm">{t('site-contract-amount')}: {Number(c.contractAmount).toLocaleString()}</p> : null}{c.specialNotes ? <p className="mt-1 text-sm text-gray-400">{c.specialNotes}</p> : null}</div>)}</div>; };
const PaintPanel = ({ specs }: any) => { const { t } = useTranslation('common'); return <div className="rounded-lg border border-gray-800 p-6">{specs.length === 0 ? <p className="text-sm text-gray-500">{t('site-no-data')}</p> : <div className="space-y-2">{specs.map((s: any) => <div key={s.id} className="rounded-lg border border-gray-800 p-3"><p className="font-medium">{s.colorName || '-'}</p><p className="text-sm text-gray-400">{s.colorCode || '-'} / {s.manufacturer || '-'}</p></div>)}</div>}</div>; };
const ShipmentPanel = ({ shipments }: any) => { const { t } = useTranslation('common'); return <div className="rounded-lg border border-gray-800 p-6">{shipments.length === 0 ? <p className="text-sm text-gray-500">{t('site-no-data')}</p> : <div className="space-y-2">{shipments.map((s: any) => <div key={s.id} className="rounded-lg border border-gray-800 p-3"><p className="font-medium">{parseNumberValue(s.quantity).toLocaleString()}</p><p className="text-sm text-gray-400">{s.shippedAt ? new Date(s.shippedAt).toLocaleDateString('ko-KR') : new Date(s.createdAt).toLocaleDateString('ko-KR')}</p>{s.notes ? <p className="mt-1 text-sm">{s.notes}</p> : null}</div>)}</div>}</div>; };
const DocumentPanel = ({ siteId }: { siteId: string; canManage: boolean }) => { const { t } = useTranslation('common'); const { data } = useSWR(`/api/sites/${siteId}/documents`, fetcher); const docs = data?.data || []; return <div className="rounded-lg border border-gray-800 p-6">{docs.length === 0 ? <p className="text-sm text-gray-500">{t('site-no-data')}</p> : <div className="space-y-2">{docs.map((doc: any) => <div key={doc.id} className="rounded-lg border border-gray-800 p-3"><p className="font-medium">{doc.name || doc.title || '문서'}</p></div>)}</div>}</div>; };
const RequestPanel = ({ requests }: any) => { const { t } = useTranslation('common'); return <div className="rounded-lg border border-gray-800 p-6">{requests.length === 0 ? <p className="text-sm text-gray-500">{t('site-no-data')}</p> : <div className="space-y-2">{requests.map((r: any) => <div key={r.id} className="rounded-lg border border-gray-800 p-3"><p className="font-medium">{r.title || '요청사항'}</p><p className="mt-1 text-sm text-gray-400">{r.description || r.content || r.note || ''}</p></div>)}</div>}</div>; };
const IssuePanel = ({ issues }: any) => { const { t } = useTranslation('common'); return <div className="rounded-lg border border-gray-800 p-6">{issues.length === 0 ? <p className="text-sm text-gray-500">{t('site-no-data')}</p> : <div className="space-y-2">{issues.map((item: any) => <div key={item.id} className="rounded-lg border border-gray-800 p-3"><p className="font-medium">{item.title || '이슈'}</p><p className="mt-1 text-sm text-gray-400">{item.description || item.content || item.note || ''}</p></div>)}</div>}</div>; };
const ChangePanel = ({ changes }: any) => { const { t } = useTranslation('common'); return <div className="rounded-lg border border-gray-800 p-6">{changes.length === 0 ? <p className="text-sm text-gray-500">{t('site-no-data')}</p> : <div className="space-y-2">{changes.map((item: any) => <div key={item.id} className="rounded-lg border border-gray-800 p-3"><p className="font-medium">{item.title || item.changeType || '변경사항'}</p><p className="mt-1 text-sm text-gray-400">{item.description || item.content || item.note || ''}</p></div>)}</div>}</div>; };
const SchedulePanel = ({ schedules }: any) => { const { t } = useTranslation('common'); return <div className="rounded-lg border border-gray-800 p-6">{schedules.length === 0 ? <p className="text-sm text-gray-500">{t('site-no-data')}</p> : <div className="space-y-2">{schedules.map((item: any) => <div key={item.id} className="rounded-lg border border-gray-800 p-3"><p className="font-medium">{item.title || '일정'}</p><p className="mt-1 text-sm text-gray-400">{item.startDate ? new Date(item.startDate).toLocaleDateString('ko-KR') : ''}</p></div>)}</div>}</div>; };
const HistoryPanel = ({ history }: any) => { const { t } = useTranslation('common'); return <div className="rounded-lg border border-gray-800 p-6">{history.length === 0 ? <p className="text-sm text-gray-500">{t('site-no-data')}</p> : <div className="space-y-2">{history.map((item: any) => <div key={item.id} className="rounded-lg border border-gray-800 p-3"><p className="font-medium">{item.fromStatus || '-'} → {item.toStatus || '-'}</p><p className="mt-1 text-sm text-gray-400">{item.reason || ''}</p></div>)}</div>}</div>; };

export async function getServerSideProps({ locale }: GetServerSidePropsContext) { return { props: { ...(locale ? await serverSideTranslations(locale, ['common']) : {}) } }; }
export default SiteDetail;
