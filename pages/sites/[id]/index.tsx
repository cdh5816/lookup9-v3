/* eslint-disable i18next/no-literal-string */
import { GetServerSidePropsContext } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useTranslation } from 'next-i18next';
import { useState, useCallback, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import useSWR from 'swr';
import fetcher from '@/lib/fetcher';
import { PlusIcon, TrashIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import ProductionProgressPanel from '@/components/sites/ProductionProgressPanel';

// 상태 색상
const STATUS_DOT: Record<string, string> = {
  영업중: 'bg-red-500', 대기: 'bg-red-400',
  계약완료: 'bg-yellow-400', 진행중: 'bg-green-500',
  부분완료: 'bg-green-300', 완료: 'bg-gray-400', 보류: 'bg-gray-600',
};
const StatusDot = ({ status }: { status: string }) => (
  <span className={`inline-block w-2 h-2 rounded-full mr-1.5 shrink-0 ${STATUS_DOT[status] || 'bg-gray-400'}`} />
);

const formatNumber = (value: any) => {
  if (value === null || value === undefined || value === '') return '-';
  const num = Number(value);
  return Number.isFinite(num) ? num.toLocaleString('ko-KR') : String(value);
};

const formatDate = (value: any) => {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString('ko-KR');
};

const allTabs = ['overview', 'sales', 'contract', 'production', 'painting', 'shipping', 'settlement', 'documents', 'requests', 'issues', 'changes', 'schedule', 'history', 'comments'];
const tabLabels: Record<string, string> = {
  overview: '개요', sales: '영업', contract: '수주', production: '생산',
  painting: '도장', shipping: '출하', settlement: '실정/정산', documents: '서류',
  requests: '요청', issues: '이슈', changes: '변경', schedule: '일정', history: '이력', comments: '댓글',
};

// 납품하차도는 영업/수주/도장 탭 불필요
const hiddenTabsBySiteType: Record<string, string[]> = {
  '납품하차도': ['sales', 'contract', 'painting'],
};

const hiddenTabsByRole: Record<string, string[]> = {
  PARTNER: ['sales', 'contract', 'settlement'],
  GUEST: ['sales', 'contract', 'production', 'painting', 'shipping', 'settlement', 'requests', 'issues', 'changes', 'schedule', 'history'],
};

// 부서별 탭 숨김 (USER 등 일반 직원)
function getHiddenByDept(dept: string, permissions: any): string[] {
  const hidden: string[] = [];
  if (!permissions.canViewSales) hidden.push('sales');
  if (!permissions.canViewContract) hidden.push('contract');
  return hidden;
}

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
  const userRole = profileData?.data?.role || profileData?.data?.teamMembers?.[0]?.role || 'USER';
  const permissions = profileData?.data?.permissions || {};

  const hiddenByRole = hiddenTabsByRole[userRole] || [];
  const hiddenBySiteType = site ? (hiddenTabsBySiteType[site.siteType || '납품설치도'] || []) : [];
  const hiddenByDept = ['SUPER_ADMIN', 'OWNER', 'ADMIN_HR', 'ADMIN', 'MANAGER'].includes(userRole) ? [] : getHiddenByDept(profileData?.data?.department || '', permissions);
  const hiddenAll = new Set([...hiddenByRole, ...hiddenBySiteType, ...hiddenByDept]);
  const tabs = allTabs.filter((tab) => !hiddenAll.has(tab));

  const canManage = ['SUPER_ADMIN', 'OWNER', 'ADMIN_HR', 'ADMIN', 'MANAGER'].includes(userRole);
  const canDelete = ['SUPER_ADMIN', 'OWNER', 'ADMIN_HR', 'ADMIN'].includes(userRole);

  const handleAddComment = useCallback(async () => {
    if (!comment.trim() || !id) return;
    setSubmitting(true);
    await fetch('/api/comments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ siteId: id, content: comment }) });
    setComment(''); setSubmitting(false); mutate();
  }, [comment, id, mutate]);

  const handleDeleteSite = async () => {
    if (!confirm('현장을 삭제합니다. 이 작업은 되돌릴 수 없습니다.')) return;
    await fetch(`/api/sites/${id}`, { method: 'DELETE' });
    router.push('/sites');
  };

  useEffect(() => {
    if (router.query.tab && allTabs.includes(router.query.tab as string)) {
      setActiveTab(router.query.tab as string);
    }
  }, [router.query.tab]);

  if (!site) return (
    <div className="flex items-center justify-center py-20">
      <span className="loading loading-spinner loading-lg text-gray-500" />
    </div>
  );

  return (
    <>
      <Head><title>{site.name} | LOOKUP9</title></Head>
      <div className="space-y-3">

        {/* ── 상단 요약 카드 ── */}
        <div className="rounded-xl border border-gray-800 bg-black/20 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              {/* 현장명 + 납품유형 */}
              <div className="flex flex-wrap items-center gap-2">
                <StatusDot status={site.status} />
                <h2 className="text-lg font-bold leading-tight break-words">{site.name}</h2>
              </div>
              {/* 뱃지 행 */}
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <span className={`rounded px-2 py-0.5 text-[11px] font-semibold ${site.siteType === '납품하차도' ? 'bg-purple-900/40 text-purple-300' : 'bg-blue-900/40 text-blue-300'}`}>
                  {site.siteType || '납품설치도'}
                </span>
                <span className="rounded-full border border-gray-700 px-2 py-0.5 text-xs text-gray-400">{site.status}</span>
                {site.salesStage && (
                  <span className="rounded px-2 py-0.5 text-[11px] bg-orange-900/30 text-orange-300">{site.salesStage}</span>
                )}
              </div>
              {/* 메타 */}
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">
                {site.client?.name && <span>{site.client.name}</span>}
                {site.address && <span>{site.address}</span>}
                {site.createdBy && (
                  <span>등록: {site.createdBy.position ? `${site.createdBy.position} ` : ''}{site.createdBy.name}</span>
                )}
                {site.updatedAt && <span>수정: {formatDate(site.updatedAt)}</span>}
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {(site._count?.requests || 0) > 0 && (
                <button onClick={() => setActiveTab('requests')} className="badge badge-sm badge-warning cursor-pointer">
                  미처리 요청 {site._count.requests}
                </button>
              )}
              {canDelete && (
                <button className="btn btn-error btn-xs" onClick={handleDeleteSite}>삭제</button>
              )}
            </div>
          </div>

          {/* 공정율 바 - 현장명 바로 아래 직관적으로 */}
          <SiteProgressBar site={site} />

          {/* 요약 수치 */}
          <div className="mt-3 grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
            {[
              { label: '배정인원', value: site.assignments?.length || 0 },
              { label: '도장사양', value: site.paintSpecs?.length || 0 },
              { label: '출하차수', value: site.shipments?.length || 0 },
              { label: '서류', value: site._count?.documents || 0 },
            ].map((item) => (
              <div key={item.label} className="rounded-lg bg-gray-800/30 py-2">
                <p className="text-[10px] text-gray-500">{item.label}</p>
                <p className="text-base font-bold">{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── 탭 ── */}
        <div className="border-b border-gray-800">
          <div className="flex gap-0 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`shrink-0 px-3 py-3 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-300'
                }`}
              >
                {tabLabels[tab] || t(`tab-${tab}`)}
              </button>
            ))}
          </div>
        </div>

        {/* ── 탭 내용 ── */}
        <div className="min-h-[200px]">
          {activeTab === 'overview' && <OverviewPanel site={site} siteId={id as string} canManage={canManage} onMutate={mutate} />}
          {activeTab === 'sales' && <SalesPanel siteId={id as string} sales={site.sales || []} canManage={canManage} onMutate={mutate} />}
          {activeTab === 'contract' && <ContractPanel siteId={id as string} contracts={site.contracts || []} canManage={canManage} onMutate={mutate} />}
          {activeTab === 'production' && <ProductionProgressPanel site={site} canManage={canManage} onMutate={mutate} />}
          {activeTab === 'painting' && <PaintPanel siteId={id as string} specs={site.paintSpecs || []} canManage={canManage} onMutate={mutate} />}
          {activeTab === 'shipping' && <ShipmentPanel siteId={id as string} shipments={site.shipments || []} canManage={canManage} onMutate={mutate} />}
          {activeTab === 'settlement' && <SettlementPanel siteId={id as string} canManage={canManage} onMutate={mutate} />}
          {activeTab === 'documents' && <DocumentPanel siteId={id as string} canManage={canManage} />}
          {activeTab === 'requests' && <RequestPanel siteId={id as string} requests={site.requests || []} canManage={canManage} onMutate={mutate} />}
          {activeTab === 'issues' && <IssuePanel siteId={id as string} issues={site.issues || []} canManage={canManage} onMutate={mutate} />}
          {activeTab === 'changes' && <ChangePanel siteId={id as string} changes={site.changeLogs || []} canManage={canManage} onMutate={mutate} />}
          {activeTab === 'schedule' && <SchedulePanel siteId={id as string} schedules={site.schedules || []} canManage={canManage} onMutate={mutate} />}
          {activeTab === 'history' && <HistoryPanel history={site.statusHistory || []} />}
          {activeTab === 'comments' && (
            <div className="space-y-4 rounded-xl border border-gray-800 p-4">
              <div className="flex gap-3">
                <textarea
                  className="textarea textarea-bordered flex-1 text-sm"
                  placeholder="댓글을 입력하세요..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={2}
                />
                <button
                  className={`btn btn-primary btn-sm self-end ${submitting ? 'loading' : ''}`}
                  disabled={submitting}
                  onClick={handleAddComment}
                >
                  등록
                </button>
              </div>
              {(site.comments || []).length === 0 ? (
                <p className="text-sm text-gray-500">댓글이 없습니다.</p>
              ) : (
                <div className="space-y-3">
                  {site.comments.map((c: any) => (
                    <div key={c.id} className="rounded-lg border border-gray-800 p-3">
                      <div className="mb-1.5 flex justify-between text-xs text-gray-500">
                        <span className="font-medium text-gray-300">
                          {c.author.position ? `${c.author.position} ` : ''}{c.author.name}
                          {c.author.department && <span className="ml-1 text-gray-600">({c.author.department})</span>}
                        </span>
                        <span>{formatDate(c.createdAt)}</span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{c.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

// ========= 현장명 아래 공정율 바 =========
const SiteProgressBar = ({ site }: { site: any }) => {
  const contract = site.contracts?.find((c: any) => !c.isAdditional);
  const contractQty = Number(contract?.quantity ?? 0);
  // 판넬 생산율은 productionOrders 합계 / 계약물량 - 여기선 shipments로 근사치
  const shippedQty = (site.shipments || []).reduce((s: number, r: any) => s + Number(r.quantity ?? 0), 0);
  const panelRate = contractQty > 0 ? Math.min(100, Math.round((shippedQty / contractQty) * 100)) : 0;
  const pipeRate = site.pipeRate ?? 0;
  const caulkingRate = site.caulkingRate ?? 0;
  const finalRate = Math.round(panelRate * 0.4 + pipeRate * 0.3 + caulkingRate * 0.3);
  const color = finalRate >= 80 ? 'bg-green-500' : finalRate >= 40 ? 'bg-blue-600' : 'bg-yellow-500';
  const textColor = finalRate >= 80 ? 'text-green-400' : finalRate >= 40 ? 'text-blue-400' : 'text-yellow-400';

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-500">전체 공정율</span>
        <span className={`text-sm font-bold ${textColor}`}>{finalRate}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-800">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${finalRate}%` }} />
      </div>
    </div>
  );
};

// ========= 개요 =========
const siteStatuses = ['영업중', '대기', '계약완료', '진행중', '부분완료', '완료', '보류'];
const siteTypes = ['납품설치도', '납품하차도'];
const salesStages = ['설계지원중', '영업진행중', '수주영업중', '영업완료', ''];
const OverviewPanel = ({ site, siteId, canManage, onMutate }: any) => {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    status: site.status,
    siteType: site.siteType || '납품설치도',
    salesStage: site.salesStage || '',
    description: site.description || '',
    statusReason: '',
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await fetch(`/api/sites/${siteId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setSaving(false); setEditing(false); onMutate();
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <InfoCard label="발주처" value={site.client?.name || '-'} />
        <div className="rounded-xl border border-gray-800 bg-black/10 p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-gray-500">현장 정보</p>
            {canManage && !editing && (
              <button className="btn btn-ghost btn-xs text-xs" onClick={() => setEditing(true)}>수정</button>
            )}
          </div>
          {editing ? (
            <div className="space-y-2">
              <div>
                <label className="block text-[10px] text-gray-500 mb-1">현장 상태</label>
                <select className="select select-bordered select-sm w-full" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  {siteStatuses.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-gray-500 mb-1">납품유형</label>
                <select className="select select-bordered select-sm w-full" value={form.siteType} onChange={(e) => setForm({ ...form, siteType: e.target.value })}>
                  {siteTypes.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-gray-500 mb-1">영업단계</label>
                <select className="select select-bordered select-sm w-full" value={form.salesStage} onChange={(e) => setForm({ ...form, salesStage: e.target.value })}>
                  <option value="">없음</option>
                  {salesStages.filter(Boolean).map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-gray-500 mb-1">변경 사유</label>
                <input className="input input-bordered input-sm w-full" placeholder="(선택)" value={form.statusReason} onChange={(e) => setForm({ ...form, statusReason: e.target.value })} />
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <p className="text-sm font-medium flex items-center gap-2">
                <StatusDot status={site.status} />{site.status}
              </p>
              <p className="text-xs text-gray-400">납품유형: <span className="text-gray-200">{site.siteType || '납품설치도'}</span></p>
              {site.salesStage && <p className="text-xs text-gray-400">영업단계: <span className="text-orange-300">{site.salesStage}</span></p>}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-gray-800 bg-black/10 p-4">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs text-gray-500">현장 메모</p>
          {canManage && !editing && (
            <button className="btn btn-ghost btn-xs text-xs" onClick={() => setEditing(true)}>수정</button>
          )}
        </div>
        {editing ? (
          <textarea className="textarea textarea-bordered w-full text-sm" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        ) : (
          <p className="text-sm whitespace-pre-wrap text-gray-300">{site.description || '-'}</p>
        )}
        {editing && (
          <div className="mt-2 flex justify-end gap-2">
            <button className="btn btn-ghost btn-xs" onClick={() => setEditing(false)}>취소</button>
            <button className={`btn btn-primary btn-xs ${saving ? 'loading' : ''}`} disabled={saving} onClick={handleSave}>저장</button>
          </div>
        )}
      </div>

      <AssignmentPanel siteId={siteId} assignments={site.assignments} canManage={canManage} onMutate={onMutate} />
    </div>
  );
};

const InfoCard = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-xl border border-gray-800 bg-black/10 p-4">
    <p className="text-xs text-gray-500 mb-1">{label}</p>
    <p className="font-medium text-gray-200">{value}</p>
  </div>
);

// ========= 영업 =========
const SalesPanel = ({ siteId, sales, canManage, onMutate }: any) => {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ status: '영업접촉', estimateAmount: '', meetingNotes: '' });
  const [sub, setSub] = useState(false);
  const salesStatuses = ['영업접촉', '견적제출', '협상중', '계약체결', '실패'];
  const handleSubmit = async () => {
    setSub(true);
    await fetch(`/api/sites/${siteId}/sales`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, estimateAmount: form.estimateAmount ? Number(form.estimateAmount.replace(/,/g, '')) : null }),
    });
    setForm({ status: '영업접촉', estimateAmount: '', meetingNotes: '' });
    setShowForm(false); setSub(false); onMutate();
  };
  return (
    <div className="rounded-xl border border-gray-800 p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold">영업 기록</h3>
        {canManage && (
          <button className="btn btn-primary btn-xs" onClick={() => setShowForm(!showForm)}>
            {showForm ? '취소' : <><PlusIcon className="w-3.5 h-3.5 mr-1" />추가</>}
          </button>
        )}
      </div>
      {showForm && (
        <div className="mb-4 rounded-lg border border-gray-700 bg-black/20 p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">상태</label>
              <select className="select select-bordered select-sm w-full" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {salesStatuses.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">예상금액</label>
              <input
                className="input input-bordered input-sm w-full"
                placeholder="예: 1,200,000"
                value={form.estimateAmount ? Number(form.estimateAmount.replace(/,/g, '')).toLocaleString() : ''}
                onChange={(e) => setForm({ ...form, estimateAmount: e.target.value.replace(/,/g, '') })}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">미팅 메모</label>
            <textarea className="textarea textarea-bordered w-full text-sm" rows={2} value={form.meetingNotes} onChange={(e) => setForm({ ...form, meetingNotes: e.target.value })} />
          </div>
          <div className="flex justify-end">
            <button className={`btn btn-primary btn-sm ${sub ? 'loading' : ''}`} disabled={sub} onClick={handleSubmit}>저장</button>
          </div>
        </div>
      )}
      {sales.length === 0 ? (
        <p className="text-sm text-gray-500">등록된 영업 기록이 없습니다.</p>
      ) : (
        <div className="space-y-2">
          {sales.map((s: any) => (
            <div key={s.id} className="rounded-lg border border-gray-800 p-3 text-sm">
              <div className="flex items-center justify-between mb-1">
                <span className="badge badge-sm badge-outline">{s.status}</span>
                <span className="text-xs text-gray-500">{formatDate(s.createdAt)}</span>
              </div>
              <p className="text-gray-400">예상금액: <span className="text-gray-200">{formatNumber(s.estimateAmount)}원</span></p>
              {s.meetingNotes && <p className="mt-1 text-gray-400 whitespace-pre-wrap">{s.meetingNotes}</p>}
              <p className="text-xs text-gray-600 mt-1">{s.createdBy?.position ? `${s.createdBy.position} ` : ''}{s.createdBy?.name}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ========= 수주/계약 =========
const ContractPanel = ({ siteId, contracts, canManage, onMutate }: any) => {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ status: '수주등록', contractAmount: '', specialNotes: '' });
  const [sub, setSub] = useState(false);
  const contractStatuses = ['수주등록', '계약검토', '계약완료', '변경중', '완료'];
  const handleSubmit = async () => {
    setSub(true);
    await fetch(`/api/sites/${siteId}/contracts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, contractAmount: form.contractAmount ? Number(form.contractAmount.replace(/,/g, '')) : null }),
    });
    setForm({ status: '수주등록', contractAmount: '', specialNotes: '' });
    setShowForm(false); setSub(false); onMutate();
  };
  return (
    <div className="rounded-xl border border-gray-800 p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold">수주 / 계약</h3>
        {canManage && (
          <button className="btn btn-primary btn-xs" onClick={() => setShowForm(!showForm)}>
            {showForm ? '취소' : <><PlusIcon className="w-3.5 h-3.5 mr-1" />추가</>}
          </button>
        )}
      </div>
      {showForm && (
        <div className="mb-4 rounded-lg border border-gray-700 bg-black/20 p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">상태</label>
              <select className="select select-bordered select-sm w-full" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {contractStatuses.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">계약금액</label>
              <input
                className="input input-bordered input-sm w-full"
                placeholder="예: 50,000,000"
                value={form.contractAmount ? Number(form.contractAmount.replace(/,/g, '')).toLocaleString() : ''}
                onChange={(e) => setForm({ ...form, contractAmount: e.target.value.replace(/,/g, '') })}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">특이사항</label>
            <textarea className="textarea textarea-bordered w-full text-sm" rows={2} value={form.specialNotes} onChange={(e) => setForm({ ...form, specialNotes: e.target.value })} />
          </div>
          <div className="flex justify-end">
            <button className={`btn btn-primary btn-sm ${sub ? 'loading' : ''}`} disabled={sub} onClick={handleSubmit}>저장</button>
          </div>
        </div>
      )}
      {contracts.length === 0 ? (
        <p className="text-sm text-gray-500">등록된 계약 기록이 없습니다.</p>
      ) : (
        <div className="space-y-2">
          {contracts.map((c: any) => (
            <div key={c.id} className="rounded-lg border border-gray-800 p-3 text-sm">
              <div className="flex items-center justify-between mb-1">
                <span className="badge badge-sm badge-outline">{c.status}</span>
                <span className="text-xs text-gray-500">{formatDate(c.createdAt)}</span>
              </div>
              <p className="text-gray-400">계약금액: <span className="text-gray-200 font-medium">{formatNumber(c.contractAmount)}원</span></p>
              {c.specialNotes && <p className="mt-1 text-gray-400 whitespace-pre-wrap">{c.specialNotes}</p>}
              <p className="text-xs text-gray-600 mt-1">{c.createdBy?.position ? `${c.createdBy.position} ` : ''}{c.createdBy?.name}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ========= 도장 =========
const PaintPanel = ({ siteId, specs, canManage, onMutate }: any) => {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ colorCode: '', colorName: '', manufacturer: '', finishType: '', area: '', quantity: '', isPrimary: false, notes: '' });
  const [sub, setSub] = useState(false);
  const handleSubmit = async () => {
    if (!form.colorCode || !form.colorName) { alert('색상 코드와 색상명은 필수입니다.'); return; }
    setSub(true);
    await fetch(`/api/sites/${siteId}/paints`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setForm({ colorCode: '', colorName: '', manufacturer: '', finishType: '', area: '', quantity: '', isPrimary: false, notes: '' });
    setShowForm(false); setSub(false); onMutate();
  };
  const paintStatuses = ['도료발주대기', '발주완료', '입고완료', '도장중', '검수완료'];
  const handleStatus = async (specId: string, status: string) => {
    await fetch(`/api/sites/${siteId}/paints`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ specId, status }),
    });
    onMutate();
  };
  return (
    <div className="rounded-xl border border-gray-800 p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold">도장 사양 / 도료 발주</h3>
        {canManage && (
          <button className="btn btn-primary btn-xs" onClick={() => setShowForm(!showForm)}>
            {showForm ? '취소' : <><PlusIcon className="w-3.5 h-3.5 mr-1" />추가</>}
          </button>
        )}
      </div>
      {showForm && (
        <div className="mb-4 rounded-lg border border-gray-700 bg-black/20 p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">컬러코드 *</label>
              <input className="input input-bordered input-sm w-full" value={form.colorCode} onChange={(e) => setForm({ ...form, colorCode: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">컬러명 *</label>
              <input className="input input-bordered input-sm w-full" value={form.colorName} onChange={(e) => setForm({ ...form, colorName: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">제조사</label>
              <input className="input input-bordered input-sm w-full" value={form.manufacturer} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">마감유형</label>
              <input className="input input-bordered input-sm w-full" value={form.finishType} onChange={(e) => setForm({ ...form, finishType: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">적용면적</label>
              <input className="input input-bordered input-sm w-full" value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">수량</label>
              <input type="number" className="input input-bordered input-sm w-full" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="checkbox checkbox-sm" checked={form.isPrimary} onChange={(e) => setForm({ ...form, isPrimary: e.target.checked })} />
            주요 색상
          </label>
          <div className="flex justify-end">
            <button className={`btn btn-primary btn-sm ${sub ? 'loading' : ''}`} disabled={sub} onClick={handleSubmit}>저장</button>
          </div>
        </div>
      )}
      {specs.length === 0 ? (
        <p className="text-sm text-gray-500">등록된 도장 사양이 없습니다.</p>
      ) : (
        <div className="space-y-2">
          {specs.map((s: any) => (
            <div key={s.id} className="rounded-lg border border-gray-800 p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-2">
                  {s.isPrimary && <span className="badge badge-xs badge-primary">주요</span>}
                  <span className="font-medium">{s.colorCode}</span>
                  <span className="text-gray-400">{s.colorName}</span>
                </div>
                {canManage ? (
                  <select
                    className="select select-bordered select-xs"
                    value={s.status}
                    onChange={(e) => handleStatus(s.id, e.target.value)}
                  >
                    {paintStatuses.map((st) => <option key={st} value={st}>{st}</option>)}
                  </select>
                ) : (
                  <span className="badge badge-sm badge-outline">{s.status}</span>
                )}
              </div>
              <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                {s.manufacturer && <span>제조사: {s.manufacturer}</span>}
                {s.quantity && <span>수량: {formatNumber(s.quantity)}</span>}
                {s.area && <span>면적: {s.area}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ========= 출하 =========
const shipStatuses = ['출하예정', '상차완료', '출발', '현장도착', '인수완료', '반송', '취소'];
const ShipmentPanel = ({ siteId, shipments, canManage, onMutate }: any) => {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    shippedAt: '',
    quantity: '',
    vehicleInfo: '',
    driverInfo: '',
    destination: '',
    receivedBy: '',
    notes: '',
  });
  const [sub, setSub] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setSub(true);
    setError('');
    const res = await fetch(`/api/sites/${siteId}/shipments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        quantity: form.quantity ? Number(form.quantity.replace(/,/g, '')) : null,
      }),
    });
    if (!res.ok) {
      const json = await res.json();
      setError(json?.error?.message || '저장에 실패했습니다.');
    } else {
      setForm({ shippedAt: '', quantity: '', vehicleInfo: '', driverInfo: '', destination: '', receivedBy: '', notes: '' });
      setShowForm(false);
      onMutate();
    }
    setSub(false);
  };

  const handleStatus = async (recordId: string, status: string) => {
    await fetch(`/api/sites/${siteId}/shipments`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recordId, status }),
    });
    onMutate();
  };

  const handleDel = async (recordId: string) => {
    if (!confirm('출하 기록을 삭제합니다.')) return;
    await fetch(`/api/sites/${siteId}/shipments`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recordId }),
    });
    onMutate();
  };

  return (
    <div className="rounded-xl border border-gray-800 p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold">출하 기록</h3>
        {canManage && (
          <button className="btn btn-primary btn-xs" onClick={() => setShowForm(!showForm)}>
            {showForm ? '취소' : <><PlusIcon className="w-3.5 h-3.5 mr-1" />출하 등록</>}
          </button>
        )}
      </div>

      {showForm && (
        <div className="mb-4 rounded-lg border border-gray-700 bg-black/20 p-4 space-y-3">
          {error && <div className="rounded bg-red-900/30 border border-red-800 p-2 text-xs text-red-400">{error}</div>}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">출고일 *</label>
              <input type="date" className="input input-bordered input-sm w-full" value={form.shippedAt} onChange={(e) => setForm({ ...form, shippedAt: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">수량</label>
              <input
                className="input input-bordered input-sm w-full"
                placeholder="예: 1,200"
                value={form.quantity ? Number(form.quantity.replace(/,/g, '')).toLocaleString() : ''}
                onChange={(e) => setForm({ ...form, quantity: e.target.value.replace(/,/g, '') })}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">화물 (차량번호/종류)</label>
              <input className="input input-bordered input-sm w-full" value={form.vehicleInfo} onChange={(e) => setForm({ ...form, vehicleInfo: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">기사 정보</label>
              <input className="input input-bordered input-sm w-full" placeholder="이름 / 연락처" value={form.driverInfo} onChange={(e) => setForm({ ...form, driverInfo: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">도착지</label>
              <input className="input input-bordered input-sm w-full" value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">인수자</label>
              <input className="input input-bordered input-sm w-full" value={form.receivedBy} onChange={(e) => setForm({ ...form, receivedBy: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">메모</label>
            <textarea className="textarea textarea-bordered w-full text-sm" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="flex justify-end">
            <button className={`btn btn-primary btn-sm ${sub ? 'loading' : ''}`} disabled={sub} onClick={handleSubmit}>저장</button>
          </div>
        </div>
      )}

      {shipments.length === 0 ? (
        <p className="text-sm text-gray-500">등록된 출하 기록이 없습니다.</p>
      ) : (
        <div className="space-y-2">
          {shipments.map((s: any) => (
            <div key={s.id} className="rounded-lg border border-gray-800 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">{s.shipmentNo || `#${s.sequence}`}</span>
                  <span className="text-xs text-gray-500">{s.sequence}차 출고</span>
                </div>
                <div className="flex items-center gap-2">
                  {canManage ? (
                    <select
                      className="select select-bordered select-xs"
                      value={s.status}
                      onChange={(e) => handleStatus(s.id, e.target.value)}
                    >
                      {shipStatuses.map((st) => <option key={st} value={st}>{st}</option>)}
                    </select>
                  ) : (
                    <span className="badge badge-sm badge-outline">{s.status}</span>
                  )}
                  {canManage && (
                    <button className="btn btn-ghost btn-xs text-error" onClick={() => handleDel(s.id)}>
                      <TrashIcon className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <span className="text-gray-500">출고일: <span className="text-gray-300">{s.shippedAt ? formatDate(s.shippedAt) : '-'}</span></span>
                <span className="text-gray-500">수량: <span className="text-gray-300">{s.quantity ? formatNumber(s.quantity) : '-'}</span></span>
                <span className="text-gray-500">차량: <span className="text-gray-300">{s.vehicleInfo || '-'}</span></span>
                <span className="text-gray-500">기사: <span className="text-gray-300">{s.driverInfo || '-'}</span></span>
                <span className="text-gray-500">도착지: <span className="text-gray-300">{s.destination || '-'}</span></span>
                <span className="text-gray-500">인수자: <span className="text-gray-300">{s.receivedBy || '-'}</span></span>
              </div>
              {s.notes && <p className="text-xs text-gray-400 mt-2">{s.notes}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ========= 실정/정산 =========
const settlementTypes = ['고소작업차', '물량증가', '설계변경', '추가공사', '기타'];
const settlementStatuses = ['검토중', '공문발송', '수요처승인', '정산완료', '반려'];

const SettlementPanel = ({ siteId, canManage, onMutate }: any) => {
  const { data, mutate } = useSWR(`/api/sites/${siteId}/changes`, fetcher);
  const settlements = (data?.data || []).filter((c: any) => c.type === '실정보고' || settlementTypes.includes(c.type));

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ type: '물량증가', beforeValue: '', afterValue: '', reason: '', impact: '' });
  const [sub, setSub] = useState(false);

  const handleSubmit = async () => {
    setSub(true);
    await fetch(`/api/sites/${siteId}/changes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form }),
    });
    setForm({ type: '물량증가', beforeValue: '', afterValue: '', reason: '', impact: '' });
    setShowForm(false); setSub(false); mutate(); onMutate();
  };

  const handleStatus = async (changeId: string, status: string) => {
    await fetch(`/api/sites/${siteId}/changes`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ changeId, status }),
    });
    mutate(); onMutate();
  };

  return (
    <div className="rounded-xl border border-gray-800 p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="font-semibold">실정보고 / 정산 이력</h3>
          <p className="text-xs text-gray-500 mt-0.5">고소작업차·물량증가 등 수요처 공문 발송 및 정산 관리</p>
        </div>
        {canManage && (
          <button className="btn btn-primary btn-xs" onClick={() => setShowForm(!showForm)}>
            {showForm ? '취소' : <><PlusIcon className="w-3.5 h-3.5 mr-1" />실정보고 등록</>}
          </button>
        )}
      </div>

      {showForm && (
        <div className="mb-4 rounded-lg border border-gray-700 bg-black/20 p-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs text-gray-400 mb-1">유형</label>
              <select className="select select-bordered select-sm w-full" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                {settlementTypes.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">기존 내용</label>
              <input className="input input-bordered input-sm w-full" placeholder="변경 전 상황" value={form.beforeValue} onChange={(e) => setForm({ ...form, beforeValue: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">변경/추가 내용</label>
              <input className="input input-bordered input-sm w-full" placeholder="변경 후 내용" value={form.afterValue} onChange={(e) => setForm({ ...form, afterValue: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">정산 금액 (원)</label>
              <input className="input input-bordered input-sm w-full" placeholder="예: 1,500,000" value={form.impact} onChange={(e) => setForm({ ...form, impact: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">사유 / 상세</label>
            <textarea className="textarea textarea-bordered w-full text-sm" rows={2} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
          </div>
          <div className="flex justify-end">
            <button className={`btn btn-primary btn-sm ${sub ? 'loading' : ''}`} disabled={sub} onClick={handleSubmit}>저장</button>
          </div>
        </div>
      )}

      {settlements.length === 0 ? (
        <p className="text-sm text-gray-500">등록된 실정보고/정산 이력이 없습니다.</p>
      ) : (
        <div className="space-y-2">
          {settlements.map((c: any) => (
            <div key={c.id} className="rounded-lg border border-gray-800 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className="badge badge-sm badge-warning">{c.type}</span>
                  <span className={`badge badge-sm ${
                    c.status === '정산완료' ? 'badge-success' :
                    c.status === '반려' ? 'badge-error' :
                    c.status === '수요처승인' ? 'badge-info' :
                    c.status === '공문발송' ? 'badge-warning' : 'badge-ghost'
                  }`}>{c.status || '검토중'}</span>
                </div>
                {canManage && (
                  <select
                    className="select select-bordered select-xs"
                    value={c.status || '검토중'}
                    onChange={(e) => handleStatus(c.id, e.target.value)}
                  >
                    {settlementStatuses.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                )}
              </div>
              <div className="space-y-1 text-xs">
                {c.beforeValue && <p className="text-gray-400">기존: <span className="text-gray-300">{c.beforeValue}</span></p>}
                {c.afterValue && <p className="text-gray-300 font-medium">변경: {c.afterValue}</p>}
                {c.impact && <p className="text-green-400">정산금액: {c.impact}</p>}
                {c.reason && <p className="text-gray-500 mt-1 whitespace-pre-wrap">{c.reason}</p>}
              </div>
              <p className="text-xs text-gray-600 mt-2">
                {c.requester?.position ? `${c.requester.position} ` : ''}{c.requester?.name} · {formatDate(c.createdAt)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ========= 서류 =========
const DocumentPanel = ({ siteId, canManage }: any) => {
  const { data } = useSWR(`/api/sites/${siteId}/documents`, fetcher);
  const docs = data?.data || [];
  return (
    <div className="rounded-xl border border-gray-800 p-5">
      <h3 className="font-semibold mb-4">서류 목록</h3>
      {docs.length === 0 ? (
        <p className="text-sm text-gray-500">등록된 서류가 없습니다.</p>
      ) : (
        <div className="space-y-2">
          {docs.map((d: any) => (
            <div key={d.id} className="flex items-center justify-between rounded-lg border border-gray-800 p-3 text-sm">
              <span className="text-gray-300">{d.fileName}</span>
              <span className="text-xs text-gray-500">{formatDate(d.createdAt)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ========= 요청사항 =========
const reqTypes = ['고객 요청', '현장 요청', '내부 요청', '협력사 요청', '긴급 요청'];
const reqPriorities = ['낮음', '보통', '높음', '긴급'];
const reqStatuses = ['등록', '확인중', '처리중', '완료', '반려', '보류'];
const RequestPanel = ({ siteId, requests, canManage, onMutate }: any) => {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', type: '내부 요청', priority: '보통', targetDept: '', deadline: '', description: '' });
  const [sub, setSub] = useState(false);
  const handleSubmit = async () => {
    if (!form.title) return;
    setSub(true);
    await fetch(`/api/sites/${siteId}/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setForm({ title: '', type: '내부 요청', priority: '보통', targetDept: '', deadline: '', description: '' });
    setShowForm(false); setSub(false); onMutate();
  };
  const handleStatus = async (requestId: string, status: string) => {
    await fetch(`/api/sites/${siteId}/requests`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId, status }),
    });
    onMutate();
  };
  const priorityBadge: Record<string, string> = { 낮음: 'badge-ghost', 보통: 'badge-info', 높음: 'badge-warning', 긴급: 'badge-error' };
  return (
    <div className="rounded-xl border border-gray-800 p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold">요청사항</h3>
        <button className="btn btn-primary btn-xs" onClick={() => setShowForm(!showForm)}>
          {showForm ? '취소' : <><PlusIcon className="w-3.5 h-3.5 mr-1" />요청 등록</>}
        </button>
      </div>
      {showForm && (
        <div className="mb-4 rounded-lg border border-gray-700 bg-black/20 p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs text-gray-400 mb-1">제목 *</label>
              <input className="input input-bordered input-sm w-full" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">유형</label>
              <select className="select select-bordered select-sm w-full" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                {reqTypes.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">우선순위</label>
              <select className="select select-bordered select-sm w-full" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                {reqPriorities.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">대상부서</label>
              <input className="input input-bordered input-sm w-full" value={form.targetDept} onChange={(e) => setForm({ ...form, targetDept: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">마감기한</label>
              <input type="date" className="input input-bordered input-sm w-full" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">내용</label>
            <textarea className="textarea textarea-bordered w-full text-sm" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="flex justify-end">
            <button className={`btn btn-primary btn-sm ${sub ? 'loading' : ''}`} disabled={sub} onClick={handleSubmit}>저장</button>
          </div>
        </div>
      )}
      {requests.length === 0 ? (
        <p className="text-sm text-gray-500">등록된 요청사항이 없습니다.</p>
      ) : (
        <div className="space-y-2">
          {requests.map((r: any) => (
            <div key={r.id} className="rounded-lg border border-gray-800 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-2">
                  <span className={`badge badge-xs ${priorityBadge[r.priority] || 'badge-ghost'}`}>{r.priority}</span>
                  <span className="text-sm font-medium">{r.title}</span>
                </div>
                {canManage ? (
                  <select
                    className="select select-bordered select-xs"
                    value={r.status}
                    onChange={(e) => handleStatus(r.id, e.target.value)}
                  >
                    {reqStatuses.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                ) : (
                  <span className="badge badge-sm badge-outline">{r.status}</span>
                )}
              </div>
              <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                <span>{r.type}</span>
                {r.targetDept && <span>→ {r.targetDept}</span>}
                {r.deadline && <span>마감: {formatDate(r.deadline)}</span>}
              </div>
              {r.description && <p className="text-xs text-gray-400 mt-1">{r.description}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ========= 이슈 =========
const issueTypes = ['누수', '손상', '색상 오류', '치수 불일치', '반입 문제', '재작업', '민원', '기타'];
const issueStatuses = ['발생', '조사중', '조치중', '완료', '보류'];
const IssuePanel = ({ siteId, issues, canManage, onMutate }: any) => {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', type: '기타', occurredAt: '', location: '', description: '', responsibility: '' });
  const [sub, setSub] = useState(false);
  const handleSubmit = async () => {
    if (!form.title) return;
    setSub(true);
    await fetch(`/api/sites/${siteId}/issues`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setForm({ title: '', type: '기타', occurredAt: '', location: '', description: '', responsibility: '' });
    setShowForm(false); setSub(false); onMutate();
  };
  const handleStatus = async (issueId: string, status: string) => {
    await fetch(`/api/sites/${siteId}/issues`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ issueId, status }),
    });
    onMutate();
  };
  const handleDel = async (issueId: string) => {
    if (!confirm('이슈를 삭제합니다.')) return;
    await fetch(`/api/sites/${siteId}/issues`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ issueId }),
    });
    onMutate();
  };
  return (
    <div className="rounded-xl border border-gray-800 p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold">이슈 관리</h3>
        {canManage && (
          <button className="btn btn-primary btn-xs" onClick={() => setShowForm(!showForm)}>
            {showForm ? '취소' : <><PlusIcon className="w-3.5 h-3.5 mr-1" />이슈 등록</>}
          </button>
        )}
      </div>
      {showForm && (
        <div className="mb-4 rounded-lg border border-gray-700 bg-black/20 p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs text-gray-400 mb-1">제목 *</label>
              <input className="input input-bordered input-sm w-full" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">유형</label>
              <select className="select select-bordered select-sm w-full" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                {issueTypes.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">발생일</label>
              <input type="date" className="input input-bordered input-sm w-full" value={form.occurredAt} onChange={(e) => setForm({ ...form, occurredAt: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">위치</label>
              <input className="input input-bordered input-sm w-full" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">책임소재</label>
              <input className="input input-bordered input-sm w-full" value={form.responsibility} onChange={(e) => setForm({ ...form, responsibility: e.target.value })} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-gray-400 mb-1">내용</label>
              <textarea className="textarea textarea-bordered w-full text-sm" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end">
            <button className={`btn btn-primary btn-sm ${sub ? 'loading' : ''}`} disabled={sub} onClick={handleSubmit}>저장</button>
          </div>
        </div>
      )}
      {issues.length === 0 ? (
        <p className="text-sm text-gray-500">등록된 이슈가 없습니다.</p>
      ) : (
        <div className="space-y-2">
          {issues.map((i: any) => (
            <div key={i.id} className="rounded-lg border border-gray-800 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="badge badge-xs badge-error">{i.type}</span>
                  <span className="text-sm font-medium">{i.title}</span>
                </div>
                <div className="flex items-center gap-2">
                  {canManage ? (
                    <select className="select select-bordered select-xs" value={i.status} onChange={(e) => handleStatus(i.id, e.target.value)}>
                      {issueStatuses.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  ) : (
                    <span className="badge badge-sm badge-outline">{i.status}</span>
                  )}
                  {canManage && (
                    <button className="btn btn-ghost btn-xs text-error" onClick={() => handleDel(i.id)}>
                      <TrashIcon className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
              {i.description && <p className="text-xs text-gray-400 mt-1">{i.description}</p>}
              <div className="flex gap-3 mt-1 text-xs text-gray-600">
                {i.location && <span>위치: {i.location}</span>}
                {i.occurredAt && <span>{formatDate(i.occurredAt)}</span>}
                <span>{i.createdBy?.position ? `${i.createdBy.position} ` : ''}{i.createdBy?.name}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ========= 변경관리 =========
const changeTypes = ['설계변경', '물량증감', '색상변경', '일정변경', '출하변경', '기타'];
const ChangePanel = ({ siteId, changes, canManage, onMutate }: any) => {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ type: '기타', beforeValue: '', afterValue: '', reason: '', impact: '' });
  const [sub, setSub] = useState(false);
  const handleSubmit = async () => {
    setSub(true);
    await fetch(`/api/sites/${siteId}/changes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setForm({ type: '기타', beforeValue: '', afterValue: '', reason: '', impact: '' });
    setShowForm(false); setSub(false); onMutate();
  };
  const handleApprove = async (changeId: string, status: string) => {
    await fetch(`/api/sites/${siteId}/changes`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ changeId, status }),
    });
    onMutate();
  };
  return (
    <div className="rounded-xl border border-gray-800 p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold">변경 관리</h3>
        <button className="btn btn-primary btn-xs" onClick={() => setShowForm(!showForm)}>
          {showForm ? '취소' : <><PlusIcon className="w-3.5 h-3.5 mr-1" />변경 요청</>}
        </button>
      </div>
      {showForm && (
        <div className="mb-4 rounded-lg border border-gray-700 bg-black/20 p-4 space-y-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">유형</label>
            <select className="select select-bordered select-sm w-full" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {changeTypes.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">변경 전</label>
              <textarea className="textarea textarea-bordered w-full text-sm" rows={2} value={form.beforeValue} onChange={(e) => setForm({ ...form, beforeValue: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">변경 후</label>
              <textarea className="textarea textarea-bordered w-full text-sm" rows={2} value={form.afterValue} onChange={(e) => setForm({ ...form, afterValue: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">변경 사유</label>
            <textarea className="textarea textarea-bordered w-full text-sm" rows={2} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
          </div>
          <div className="flex justify-end">
            <button className={`btn btn-primary btn-sm ${sub ? 'loading' : ''}`} disabled={sub} onClick={handleSubmit}>저장</button>
          </div>
        </div>
      )}
      {changes.length === 0 ? (
        <p className="text-sm text-gray-500">등록된 변경 기록이 없습니다.</p>
      ) : (
        <div className="space-y-2">
          {changes.map((c: any) => (
            <div key={c.id} className="rounded-lg border border-gray-800 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className="badge badge-sm badge-warning">{c.type}</span>
                  <span className={`badge badge-sm ${c.status === '승인' ? 'badge-success' : c.status === '반려' ? 'badge-error' : 'badge-ghost'}`}>{c.status}</span>
                </div>
                {canManage && c.status === '요청' && (
                  <div className="flex gap-1">
                    <button className="btn btn-xs btn-success" onClick={() => handleApprove(c.id, '승인')}>승인</button>
                    <button className="btn btn-xs btn-error" onClick={() => handleApprove(c.id, '반려')}>반려</button>
                  </div>
                )}
              </div>
              {c.beforeValue && <p className="text-xs text-gray-400">이전: {c.beforeValue}</p>}
              {c.afterValue && <p className="text-xs text-gray-300">변경: {c.afterValue}</p>}
              {c.reason && <p className="text-xs text-gray-500 mt-1">{c.reason}</p>}
              <p className="text-xs text-gray-600 mt-1">{c.requester?.name} · {formatDate(c.createdAt)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ========= 일정 =========
const scheduleTypes = ['미팅', '생산 시작', '도장 완료', '출하 예정', '현장 방문', '보고 마감', '기타'];
const SchedulePanel = ({ siteId, schedules, canManage, onMutate }: any) => {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', type: '기타', startDate: '', endDate: '', notes: '' });
  const [sub, setSub] = useState(false);
  const handleSubmit = async () => {
    if (!form.title || !form.startDate) return;
    setSub(true);
    await fetch(`/api/sites/${siteId}/schedules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setForm({ title: '', type: '기타', startDate: '', endDate: '', notes: '' });
    setShowForm(false); setSub(false); onMutate();
  };
  const handleToggle = async (scheduleId: string, isDone: boolean) => {
    await fetch(`/api/sites/${siteId}/schedules`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scheduleId, isDone }),
    });
    onMutate();
  };
  const handleDel = async (scheduleId: string) => {
    if (!confirm('일정을 삭제합니다.')) return;
    await fetch(`/api/sites/${siteId}/schedules`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scheduleId }),
    });
    onMutate();
  };
  const today = new Date().toISOString().split('T')[0];
  return (
    <div className="rounded-xl border border-gray-800 p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold">일정 관리</h3>
        {canManage && (
          <button className="btn btn-primary btn-xs" onClick={() => setShowForm(!showForm)}>
            {showForm ? '취소' : <><PlusIcon className="w-3.5 h-3.5 mr-1" />일정 추가</>}
          </button>
        )}
      </div>
      {showForm && (
        <div className="mb-4 rounded-lg border border-gray-700 bg-black/20 p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs text-gray-400 mb-1">제목 *</label>
              <input className="input input-bordered input-sm w-full" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">유형</label>
              <select className="select select-bordered select-sm w-full" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                {scheduleTypes.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">시작일 *</label>
              <input type="date" className="input input-bordered input-sm w-full" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">종료일</label>
              <input type="date" className="input input-bordered input-sm w-full" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end">
            <button className={`btn btn-primary btn-sm ${sub ? 'loading' : ''}`} disabled={sub} onClick={handleSubmit}>저장</button>
          </div>
        </div>
      )}
      {schedules.length === 0 ? (
        <p className="text-sm text-gray-500">등록된 일정이 없습니다.</p>
      ) : (
        <div className="space-y-2">
          {schedules.map((s: any) => {
            const start = s.startDate?.split('T')[0] || '';
            const isOverdue = !s.isDone && start < today;
            return (
              <div key={s.id} className={`flex items-center gap-3 rounded-lg border p-3 ${s.isDone ? 'border-gray-800 opacity-60' : isOverdue ? 'border-red-800 bg-red-900/10' : 'border-gray-800'}`}>
                {canManage && (
                  <input type="checkbox" className="checkbox checkbox-sm" checked={s.isDone} onChange={() => handleToggle(s.id, !s.isDone)} />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-gray-500">{s.type}</span>
                    <span className={`text-sm font-medium ${s.isDone ? 'line-through text-gray-600' : ''}`}>{s.title}</span>
                    {isOverdue && <span className="badge badge-xs badge-error">지연</span>}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {formatDate(s.startDate)}
                    {s.endDate && ` ~ ${formatDate(s.endDate)}`}
                  </p>
                </div>
                {canManage && (
                  <button className="btn btn-ghost btn-xs text-error shrink-0" onClick={() => handleDel(s.id)}>
                    <TrashIcon className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ========= 상태 이력 =========
const HistoryPanel = ({ history }: { history: any[] }) => (
  <div className="rounded-xl border border-gray-800 p-5">
    <h3 className="font-semibold mb-4">상태 이력</h3>
    {history.length === 0 ? (
      <p className="text-sm text-gray-500">상태 이력이 없습니다.</p>
    ) : (
      <div className="space-y-3">
        {history.map((h: any) => (
          <div key={h.id} className="flex items-start gap-3 border-l-2 border-gray-800 pl-4 py-1">
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <StatusDot status={h.fromStatus} /><span>{h.fromStatus}</span>
                <span className="text-gray-600">→</span>
                <StatusDot status={h.toStatus} /><span className="font-medium">{h.toStatus}</span>
              </div>
              {h.reason && <p className="text-xs text-gray-400 mt-0.5">{h.reason}</p>}
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs text-gray-500">{h.changedBy?.position ? `${h.changedBy.position} ` : ''}{h.changedBy?.name}</p>
              <p className="text-xs text-gray-600">{formatDate(h.createdAt)}</p>
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
);

// ========= 배정 =========
const AssignmentPanel = ({ siteId, assignments, canManage, onMutate }: any) => {
  const [showSearch, setShowSearch] = useState(false);
  const [sq, setSq] = useState('');
  const [sr, setSr] = useState<any[]>([]);
  const [showPartnerCreate, setShowPartnerCreate] = useState(false);
  const [creatingPartner, setCreatingPartner] = useState(false);
  const [partnerForm, setPartnerForm] = useState({ name: '', email: '', password: '', company: '', position: '', phone: '' });

  const handleSearch = async (q: string) => {
    setSq(q);
    if (q.length < 1) { setSr([]); return; }
    const r = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`);
    if (r.ok) { const d = await r.json(); setSr(d.data || []); }
  };

  const handleAssign = async (userId: string) => {
    await fetch(`/api/sites/${siteId}/assignments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    setSq(''); setSr([]); setShowSearch(false); onMutate();
  };

  const handleRemove = async (userId: string) => {
    if (!confirm('배정을 해제합니다.')) return;
    await fetch(`/api/sites/${siteId}/assignments`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    onMutate();
  };

  const handleCreatePartner = async () => {
    if (!partnerForm.name || !partnerForm.email || !partnerForm.password) {
      alert('이름, 이메일, 비밀번호를 입력하세요.');
      return;
    }
    setCreatingPartner(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...partnerForm, role: 'PARTNER', department: '협력사', siteIds: [siteId] }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || '협력사 생성 실패');
      setPartnerForm({ name: '', email: '', password: '', company: '', position: '', phone: '' });
      setShowPartnerCreate(false);
      onMutate();
      alert('협력사 계정이 생성되어 현재 현장에 자동 배정되었습니다.');
    } catch (error: any) {
      alert(error?.message || '협력사 생성 실패');
    } finally {
      setCreatingPartner(false);
    }
  };

  return (
    <div className="rounded-xl border border-gray-800 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-gray-500">배정 인원 ({assignments?.length || 0})</p>
        {canManage && (
          <div className="flex gap-2">
            <button className="btn btn-ghost btn-xs" onClick={() => setShowSearch(!showSearch)}>
              <PlusIcon className="h-3.5 w-3.5" /> 직원 배정
            </button>
            <button className="btn btn-ghost btn-xs" onClick={() => setShowPartnerCreate(!showPartnerCreate)}>
              <PlusIcon className="h-3.5 w-3.5" /> 협력사 생성
            </button>
          </div>
        )}
      </div>

      {showSearch && (
        <div className="mb-3 space-y-2">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              className="input input-bordered input-sm w-full pl-9"
              placeholder="이름 또는 이메일 검색"
              value={sq}
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>
          {sr.length > 0 && (
            <div className="max-h-40 overflow-y-auto rounded border border-gray-700">
              {sr.map((u) => (
                <button
                  key={u.id}
                  onClick={() => handleAssign(u.id)}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-gray-800"
                >
                  {u.position ? `${u.position} ` : ''}{u.name}
                  <span className="text-gray-500 ml-1">({u.email})</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {showPartnerCreate && (
        <div className="mb-4 rounded-xl border border-gray-700 bg-black/20 p-4">
          <p className="text-xs text-gray-400 mb-3">현재 현장에 자동 배정됩니다.</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { key: 'name', placeholder: '이름 *' },
              { key: 'email', placeholder: '이메일 *' },
              { key: 'password', placeholder: '비밀번호 *', type: 'password' },
              { key: 'company', placeholder: '회사명' },
              { key: 'position', placeholder: '직책' },
              { key: 'phone', placeholder: '연락처' },
            ].map((f) => (
              <input
                key={f.key}
                type={f.type || 'text'}
                className="input input-bordered input-sm w-full"
                placeholder={f.placeholder}
                value={(partnerForm as any)[f.key]}
                onChange={(e) => setPartnerForm({ ...partnerForm, [f.key]: e.target.value })}
              />
            ))}
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button className="btn btn-ghost btn-xs" onClick={() => setShowPartnerCreate(false)}>취소</button>
            <button
              className={`btn btn-primary btn-xs ${creatingPartner ? 'loading' : ''}`}
              disabled={creatingPartner}
              onClick={handleCreatePartner}
            >
              생성
            </button>
          </div>
        </div>
      )}

      {!assignments?.length ? (
        <p className="text-sm text-gray-500">배정된 인원이 없습니다.</p>
      ) : (
        <div className="space-y-1">
          {assignments.map((a: any) => (
            <div key={a.id} className="flex items-center justify-between py-1">
              <p className="text-sm">
                {a.user.position ? `${a.user.position} ` : ''}{a.user.name}
                <span className="ml-2 text-xs text-gray-500">{a.user.department || ''}</span>
              </p>
              {canManage && (
                <button className="btn btn-ghost btn-xs text-error" onClick={() => handleRemove(a.user.id)}>
                  <TrashIcon className="h-3.5 w-3.5" />
                </button>
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

export default SiteDetail;
