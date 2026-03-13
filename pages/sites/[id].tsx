/* eslint-disable i18next/no-literal-string */
import { GetServerSidePropsContext } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useState, useCallback, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import useSWR from 'swr';
import fetcher from '@/lib/fetcher';
import {
  PlusIcon, TrashIcon, MagnifyingGlassIcon,
  ExclamationTriangleIcon, ChatBubbleLeftRightIcon,
  ClockIcon, ArrowPathIcon, CheckCircleIcon,
  ChevronDownIcon, ChevronUpIcon, XMarkIcon,
} from '@heroicons/react/24/outline';

// ── 상수 ──────────────────────────────────────────────
const STATUS_DOT: Record<string, string> = {
  영업중: 'bg-red-500', 대기: 'bg-red-400', 계약완료: 'bg-yellow-400',
  진행중: 'bg-green-500', 부분완료: 'bg-green-300', 완료: 'bg-gray-400', 보류: 'bg-gray-600',
};
const SITE_STATUSES = ['영업중', '대기', '계약완료', '진행중', '부분완료', '완료', '보류'];
const ISSUE_TYPES = ['누수', '손상', '색상 오류', '치수 불일치', '반입 문제', '재작업', '민원', '기타'];
const ISSUE_STATUSES = ['발생', '조사중', '조치중', '완료', '보류'];
const SHIP_STATUSES = ['출하예정', '상차완료', '출발', '현장도착', '인수완료', '반송', '취소'];

// ── 유틸 ──────────────────────────────────────────────
const fmt = (v: any) => (v === null || v === undefined || v === '') ? '-' : String(v);
const fmtNum = (v: any) => {
  if (!v) return '-';
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString('ko-KR') : String(v);
};
const fmtDate = (v: any) => {
  if (!v) return '-';
  try { return new Date(v).toLocaleDateString('ko-KR'); } catch { return String(v); }
};
const fmtDatetime = (v: any) => {
  if (!v) return '-';
  try { return new Date(v).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }); } catch { return String(v); }
};
const userName = (u: any) => !u ? '-' : u.position ? `${u.position} ${u.name}` : u.name;

const calcProgress = (site: any) => {
  const c = site.contracts?.find((x: any) => !x.isAdditional);
  const totalQty = Number(c?.quantity ?? 0);
  if (totalQty > 0) {
    const shipped = (site.shipments ?? []).reduce((s: number, r: any) => s + Number(r.quantity ?? 0), 0);
    return { pct: Math.min(100, Math.round((shipped / totalQty) * 100)), shipped, totalQty };
  }
  const map: Record<string, number> = { 영업중: 12, 대기: 8, 계약완료: 35, 진행중: 65, 부분완료: 85, 완료: 100, 보류: 0 };
  return { pct: map[site.status] ?? 0, shipped: null, totalQty: null };
};

// ── 탭 정의 ──────────────────────────────────────────
type TabKey = 'overview' | 'contract' | 'production' | 'activity' | 'requests' | 'documents' | 'comments';

interface TabDef { key: TabKey; label: string; badge?: (site: any) => number }
const ALL_TABS: TabDef[] = [
  { key: 'overview', label: '기본정보' },
  { key: 'contract', label: '계약' },
  { key: 'production', label: '생산·출하' },
  { key: 'activity', label: '활동', badge: (s) => (s.issues?.filter((i: any) => i.status !== '완료').length ?? 0) },
  { key: 'requests', label: '요청', badge: (s) => (s.requests?.filter((r: any) => !['완료','반려'].includes(r.status)).length ?? 0) },
  { key: 'documents', label: '서류' },
  { key: 'comments', label: '댓글' },
];

// PARTNER: 영업/계약 숨김 여부만 다름
const getVisibleTabs = (role: string): TabKey[] => {
  if (role === 'GUEST' || role === 'VIEWER')
    return ['overview', 'production', 'activity', 'requests', 'documents', 'comments'];
  if (role === 'PARTNER')
    return ['overview', 'production', 'activity', 'requests', 'documents', 'comments'];
  return ['overview', 'contract', 'production', 'activity', 'requests', 'documents', 'comments'];
};

// ── 메인 ──────────────────────────────────────────────
const SiteDetail = () => {
  const router = useRouter();
  const { id } = router.query;
  const [activeTab, setActiveTab] = useState<TabKey>('overview');

  const { data, mutate } = useSWR(id ? `/api/sites/${id}` : null, fetcher, { refreshInterval: 30000 });
  const { data: profileData } = useSWR('/api/my/profile', fetcher);

  const site = data?.data;
  const profile = profileData?.data;
  const role = profile?.role || profile?.teamMembers?.[0]?.role || 'USER';

  // PARTNER도 배정된 현장은 전체 수정 가능
  const canManage = ['SUPER_ADMIN', 'OWNER', 'ADMIN_HR', 'ADMIN', 'MANAGER', 'USER', 'MEMBER', 'PARTNER'].includes(role);
  const canDelete = ['SUPER_ADMIN', 'OWNER', 'ADMIN_HR', 'ADMIN'].includes(role);
  const isExternal = ['PARTNER', 'GUEST', 'VIEWER'].includes(role);

  const visibleTabs = getVisibleTabs(role);
  const tabs = ALL_TABS.filter((t) => visibleTabs.includes(t.key));

  const handleDeleteSite = async () => {
    if (!confirm('이 현장을 삭제하시겠습니까? 모든 데이터가 삭제됩니다.')) return;
    await fetch(`/api/sites/${id}`, { method: 'DELETE' });
    router.push('/sites');
  };

  if (!site) return (
    <div className="flex h-64 items-center justify-center">
      <span className="loading loading-spinner loading-md" />
    </div>
  );

  const progress = calcProgress(site);
  const openIssues = site.issues?.filter((i: any) => i.status !== '완료') ?? [];
  const openRequests = site.requests?.filter((r: any) => !['완료', '반려'].includes(r.status)) ?? [];
  const hasAlert = openIssues.length > 0;

  return (
    <>
      <Head><title>{site.name} | LOOKUP9</title></Head>
      <div className="space-y-3">

        {/* ── 상단 헤더 카드 ── */}
        <div className={`rounded-xl border p-4 ${hasAlert ? 'border-red-800/60 bg-red-950/10' : 'border-gray-800 bg-black/20'}`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${STATUS_DOT[site.status] || 'bg-gray-400'}`} />
                <h2 className="text-xl font-bold">{site.name}</h2>
                <span className="rounded-full border border-gray-700 px-2 py-0.5 text-xs text-gray-300">{site.status}</span>
                {hasAlert && (
                  <span className="flex items-center gap-1 rounded-full bg-red-900/50 px-2 py-0.5 text-xs font-semibold text-red-300">
                    <ExclamationTriangleIcon className="h-3.5 w-3.5" />
                    이슈 {openIssues.length}건
                  </span>
                )}
                {openRequests.length > 0 && (
                  <span className="rounded-full bg-yellow-900/30 px-2 py-0.5 text-xs text-yellow-300">
                    미처리 요청 {openRequests.length}건
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-gray-400">
                {site.client?.name && <span className="mr-2">{site.client.name}</span>}
                {site.address && <span className="mr-2">{site.address}</span>}
                <span className="text-gray-500">{userName(site.createdBy)}</span>
              </p>
            </div>
            {canDelete && (
              <button className="btn btn-ghost btn-xs text-red-400" onClick={handleDeleteSite}>삭제</button>
            )}
          </div>

          {/* 진행률 */}
          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between text-xs text-gray-400">
              <span>전체 진행률</span>
              <span className="font-semibold">
                {progress.pct}%
                {progress.shipped !== null && progress.totalQty !== null && (
                  <span className="ml-2 text-gray-500">
                    ({fmtNum(progress.shipped)} / {fmtNum(progress.totalQty)} m²)
                  </span>
                )}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-gray-800">
              <div className={`h-full rounded-full transition-all
                ${progress.pct >= 100 ? 'bg-gray-500' : progress.pct >= 60 ? 'bg-green-600' : 'bg-blue-500'}`}
                style={{ width: `${progress.pct}%` }} />
            </div>
          </div>
        </div>

        {/* ── 탭 바 ── */}
        <div className="border-b border-gray-800">
          <div className="flex gap-0 overflow-x-auto">
            {tabs.map((tab) => {
              const badge = tab.badge ? tab.badge(site) : 0;
              return (
                <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                  className={`relative flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors
                    ${activeTab === tab.key ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-400 hover:text-gray-200'}`}>
                  {tab.label}
                  {badge > 0 && (
                    <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                      {badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── 탭 콘텐츠 ── */}
        {activeTab === 'overview' && (
          <OverviewPanel site={site} siteId={id as string} canManage={canManage} isExternal={isExternal} onMutate={mutate} />
        )}
        {activeTab === 'contract' && (
          <ContractPanel site={site} siteId={id as string} canManage={canManage} onMutate={mutate} />
        )}
        {activeTab === 'production' && (
          <ProductionPanel site={site} siteId={id as string} canManage={canManage} onMutate={mutate} />
        )}
        {activeTab === 'activity' && (
          <ActivityPanel site={site} siteId={id as string} canManage={canManage} onMutate={mutate} />
        )}
        {activeTab === 'requests' && (
          <RequestPanel site={site} siteId={id as string} canManage={canManage} onMutate={mutate} />
        )}
        {activeTab === 'documents' && (
          <DocumentPanel siteId={id as string} canManage={canManage} />
        )}
        {activeTab === 'comments' && (
          <CommentsPanel site={site} siteId={id as string} onMutate={mutate} />
        )}
      </div>
    </>
  );
};

// ══════════════════════════════════════════════════════
// 기본정보 탭
// ══════════════════════════════════════════════════════
const OverviewPanel = ({ site, siteId, canManage, isExternal, onMutate }: any) => {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ status: site.status, description: site.description || '', statusReason: '' });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await fetch(`/api/sites/${siteId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setSaving(false); setEditing(false); onMutate();
  };

  return (
    <div className="space-y-4">
      {/* 기본 정보 카드 */}
      <div className="rounded-xl border border-gray-800 bg-black/20 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">현장 정보</p>
          {canManage && !editing && <button className="btn btn-ghost btn-xs" onClick={() => setEditing(true)}>수정</button>}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <InfoRow label="수요처/발주처" value={site.client?.name} />
          <InfoRow label="현장 주소" value={site.address} />
          <InfoRow label="등록자" value={userName(site.createdBy)} />
          <InfoRow label="등록일" value={fmtDate(site.createdAt)} />
        </div>
        {editing ? (
          <div className="space-y-3 border-t border-gray-800 pt-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">상태</label>
              <div className="flex flex-wrap gap-2">
                {SITE_STATUSES.map((s) => (
                  <button key={s} type="button" onClick={() => setForm({ ...form, status: s })}
                    className={`rounded-full border px-3 py-1 text-xs transition
                      ${form.status === s ? 'border-blue-500 bg-blue-900/30 text-blue-300' : 'border-gray-700 text-gray-400'}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
            {form.status !== site.status && (
              <input type="text" className="input input-bordered input-sm w-full"
                placeholder="상태 변경 사유 (선택)"
                value={form.statusReason} onChange={(e) => setForm({ ...form, statusReason: e.target.value })} />
            )}
            <div>
              <label className="block text-xs text-gray-400 mb-1">현장 메모</label>
              <textarea className="textarea textarea-bordered w-full text-sm" rows={3}
                value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="flex gap-2 justify-end">
              <button className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>취소</button>
              <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
                {saving ? <span className="loading loading-spinner loading-xs" /> : '저장'}
              </button>
            </div>
          </div>
        ) : (
          site.description && (
            <div className="border-t border-gray-800 pt-3">
              <p className="text-xs text-gray-400 mb-1">메모</p>
              <p className="text-sm whitespace-pre-wrap text-gray-300">{site.description}</p>
            </div>
          )
        )}
      </div>

      {/* 담당자 배정 */}
      <AssignmentPanel siteId={siteId} assignments={site.assignments} canManage={canManage} isExternal={isExternal} onMutate={onMutate} />
    </div>
  );
};

const InfoRow = ({ label, value }: { label: string; value?: string | null }) => (
  <div>
    <p className="text-[11px] text-gray-500">{label}</p>
    <p className="text-sm mt-0.5">{value || '-'}</p>
  </div>
);

// ══════════════════════════════════════════════════════
// 담당자 배정 (협력사 생성 + 게스트 생성 + 현장배정 포함)
// ══════════════════════════════════════════════════════
const AssignmentPanel = ({ siteId, assignments, canManage, isExternal, onMutate }: any) => {
  const [showSearch, setShowSearch] = useState(false);
  const [sq, setSq] = useState('');
  const [sr, setSr] = useState<any[]>([]);
  const [mode, setMode] = useState<null | 'partner' | 'guest'>(null);
  const [form, setForm] = useState({ name: '', email: '', password: '', company: '', position: '', phone: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = async (q: string) => {
    setSq(q);
    if (!q) { setSr([]); return; }
    const r = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`);
    if (r.ok) { const d = await r.json(); setSr(d.data || []); }
  };

  const handleAssign = async (userId: string) => {
    await fetch(`/api/sites/${siteId}/assignments`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    setSq(''); setSr([]); setShowSearch(false); onMutate();
  };

  const handleRemove = async (userId: string) => {
    if (!confirm('담당자를 제거하시겠습니까?')) return;
    await fetch(`/api/sites/${siteId}/assignments`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    onMutate();
  };

  const handleCreate = async () => {
    if (!form.name || !form.email || !form.password) { setError('이름, 이메일, 비밀번호는 필수입니다.'); return; }
    setSaving(true); setError('');
    const role = mode === 'partner' ? 'PARTNER' : 'GUEST';
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, role, department: role === 'PARTNER' ? '협력사' : '게스트', assignedSiteIds: [siteId] }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || '생성 실패');
      setForm({ name: '', email: '', password: '', company: '', position: '', phone: '' });
      setMode(null); onMutate();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const roleBadge = (role: string) => {
    const map: Record<string, string> = {
      PARTNER: 'badge-warning', GUEST: 'badge-ghost', VIEWER: 'badge-ghost',
      MANAGER: 'badge-info', ADMIN_HR: 'badge-primary', USER: 'badge-neutral',
    };
    const labels: Record<string, string> = {
      PARTNER: '협력사', GUEST: '게스트', VIEWER: '게스트',
      MANAGER: '매니저', ADMIN_HR: '관리자', USER: '직원',
    };
    return <span className={`badge badge-xs ${map[role] || 'badge-neutral'}`}>{labels[role] || role}</span>;
  };

  return (
    <div className="rounded-xl border border-gray-800 bg-black/20 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          담당자 · 협력사 ({assignments.length})
        </p>
        {canManage && (
          <div className="flex gap-1.5 flex-wrap justify-end">
            <button className="btn btn-ghost btn-xs gap-1" onClick={() => { setShowSearch((p) => !p); setMode(null); }}>
              <PlusIcon className="h-3.5 w-3.5" />직원 추가
            </button>
            <button className="btn btn-ghost btn-xs gap-1" onClick={() => { setMode('partner'); setShowSearch(false); }}>
              <PlusIcon className="h-3.5 w-3.5" />협력사 생성
            </button>
            {/* 협력사도 게스트 생성 가능 */}
            <button className="btn btn-ghost btn-xs gap-1" onClick={() => { setMode('guest'); setShowSearch(false); }}>
              <PlusIcon className="h-3.5 w-3.5" />게스트 생성
            </button>
          </div>
        )}
      </div>

      {/* 직원 검색 */}
      {showSearch && (
        <div className="space-y-2">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input type="text" className="input input-bordered input-sm w-full pl-9"
              placeholder="이름으로 검색" value={sq} onChange={(e) => handleSearch(e.target.value)} />
          </div>
          {sr.length > 0 && (
            <div className="max-h-40 overflow-y-auto rounded-lg border border-gray-700 divide-y divide-gray-800">
              {sr.map((u) => (
                <button key={u.id} onClick={() => handleAssign(u.id)}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-gray-800/60 flex items-center gap-2">
                  <PlusIcon className="h-3.5 w-3.5 text-gray-500" />
                  {u.position ? `${u.position} ` : ''}{u.name}
                  <span className="text-gray-500 text-xs">({u.email})</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 협력사/게스트 생성 폼 */}
      {mode && (
        <div className="rounded-lg border border-gray-700 bg-black/30 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold">
              {mode === 'partner' ? '협력사 계정 생성' : '게스트 계정 생성'}
              <span className="ml-2 text-xs font-normal text-gray-400">→ 이 현장에 자동 배정됩니다</span>
            </h4>
            <button onClick={() => setMode(null)}><XMarkIcon className="h-4 w-4 text-gray-500" /></button>
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {[
              { key: 'name', label: '이름 *' },
              { key: 'email', label: '이메일 *' },
              { key: 'password', label: '비밀번호 *', type: 'password' },
              { key: 'company', label: '회사명' },
              { key: 'position', label: '직책' },
              { key: 'phone', label: '연락처' },
            ].map(({ key, label, type }) => (
              <div key={key}>
                <label className="block text-[11px] text-gray-400 mb-0.5">{label}</label>
                <input type={type || 'text'} className="input input-bordered input-xs w-full"
                  value={(form as any)[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
              </div>
            ))}
          </div>
          <div className="flex gap-2 justify-end">
            <button className="btn btn-ghost btn-xs" onClick={() => setMode(null)}>취소</button>
            <button className="btn btn-primary btn-xs" onClick={handleCreate} disabled={saving}>
              {saving ? <span className="loading loading-spinner loading-xs" /> : '생성'}
            </button>
          </div>
        </div>
      )}

      {/* 담당자 목록 */}
      {assignments.length === 0 ? (
        <p className="text-sm text-gray-500">배정된 담당자가 없습니다.</p>
      ) : (
        <div className="divide-y divide-gray-800/60">
          {assignments.map((a: any) => (
            <div key={a.id} className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2">
                {roleBadge(a.user.company ? 'PARTNER' : 'USER')}
                <span className="text-sm">{a.user.position ? `${a.user.position} ` : ''}{a.user.name}</span>
                {a.user.company && <span className="text-xs text-gray-500">({a.user.company})</span>}
                {a.user.department && <span className="text-xs text-gray-500">{a.user.department}</span>}
              </div>
              {canManage && (
                <button className="btn btn-ghost btn-xs text-red-400" onClick={() => handleRemove(a.user.id)}>
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

// ══════════════════════════════════════════════════════
// 계약 탭
// ══════════════════════════════════════════════════════
const ContractPanel = ({ site, siteId, canManage, onMutate }: any) => {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ contractAmount: '', quantity: '', unitPrice: '', specification: '', contractDate: '', isAdditional: false, specialNotes: '' });
  const [saving, setSaving] = useState(false);

  const fmtMoney = (v: any) => { if (!v) return '-'; return `${Math.round(Number(v) / 10000).toLocaleString()}만원`; };

  const handleSubmit = async () => {
    setSaving(true);
    await fetch(`/api/sites/${siteId}/contracts`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setForm({ contractAmount: '', quantity: '', unitPrice: '', specification: '', contractDate: '', isAdditional: false, specialNotes: '' });
    setShowForm(false); setSaving(false); onMutate();
  };

  const contracts = site.contracts ?? [];
  const main = contracts.find((c: any) => !c.isAdditional);
  const extras = contracts.filter((c: any) => c.isAdditional);
  const totalAmount = contracts.reduce((s: number, c: any) => s + Number(c.contractAmount ?? 0), 0);

  return (
    <div className="space-y-4">
      {/* 요약 */}
      {main && (
        <div className="rounded-xl border border-blue-900/40 bg-blue-950/20 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-blue-300 uppercase tracking-wider">본 계약</p>
            {extras.length > 0 && (
              <span className="text-xs text-gray-400">
                추가계약 {extras.length}건 포함 합계 <strong className="text-white">{fmtMoney(totalAmount)}</strong>
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <ContractCell label="계약물량" value={main.quantity ? `${fmtNum(main.quantity)} m²` : '-'} />
            <ContractCell label="단가" value={main.unitPrice ? `${fmtNum(main.unitPrice)} 원/m²` : '-'} />
            <ContractCell label="계약금액" value={fmtMoney(main.contractAmount)} highlight />
            <ContractCell label="사양" value={fmt(main.specification)} />
          </div>
          {main.specialNotes && <p className="text-xs text-gray-400 border-t border-gray-800 pt-2">{main.specialNotes}</p>}
        </div>
      )}

      {/* 추가계약 */}
      {extras.map((c: any) => (
        <div key={c.id} className="rounded-xl border border-gray-700 bg-black/20 p-4 space-y-2">
          <div className="flex items-center gap-2">
            <span className="badge badge-xs badge-warning">추가계약</span>
            <span className="text-xs text-gray-500">{fmtDate(c.contractDate)}</span>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <ContractCell label="물량" value={c.quantity ? `${fmtNum(c.quantity)} m²` : '-'} />
            <ContractCell label="금액" value={fmtMoney(c.contractAmount)} />
            <ContractCell label="사양" value={fmt(c.specification)} />
            <ContractCell label="비고" value={fmt(c.specialNotes)} />
          </div>
        </div>
      ))}

      {/* 등록 없는 경우 */}
      {contracts.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-700 py-10 text-center text-sm text-gray-500">
          등록된 계약 정보가 없습니다.
        </div>
      )}

      {/* 추가 등록 폼 */}
      {canManage && (
        <div>
          <button className="btn btn-ghost btn-sm gap-1.5" onClick={() => setShowForm((p) => !p)}>
            <PlusIcon className="h-4 w-4" />{showForm ? '취소' : '계약 추가 / 추가계약 등록'}
          </button>
          {showForm && (
            <div className="mt-3 rounded-xl border border-gray-700 p-4 space-y-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="checkbox checkbox-sm" checked={form.isAdditional}
                  onChange={(e) => setForm({ ...form, isAdditional: e.target.checked })} />
                추가계약 (변경계약)
              </label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {[
                  { key: 'specification', label: '사양' },
                  { key: 'quantity', label: '물량 (m²)' },
                  { key: 'unitPrice', label: '단가 (원/m²)' },
                  { key: 'contractAmount', label: '계약금액 (원)' },
                  { key: 'contractDate', label: '계약일', type: 'date' },
                ].map(({ key, label, type }) => (
                  <div key={key}>
                    <label className="block text-xs text-gray-400 mb-1">{label}</label>
                    <input type={type || 'text'} className="input input-bordered input-sm w-full"
                      value={(form as any)[key]}
                      onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
                  </div>
                ))}
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">특이사항</label>
                <textarea className="textarea textarea-bordered w-full text-sm" rows={2}
                  value={form.specialNotes} onChange={(e) => setForm({ ...form, specialNotes: e.target.value })} />
              </div>
              <div className="flex justify-end">
                <button className="btn btn-primary btn-sm" onClick={handleSubmit} disabled={saving}>
                  {saving ? <span className="loading loading-spinner loading-xs" /> : '저장'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const ContractCell = ({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) => (
  <div>
    <p className="text-[11px] text-gray-500">{label}</p>
    <p className={`text-sm font-medium mt-0.5 ${highlight ? 'text-blue-300 text-base' : ''}`}>{value}</p>
  </div>
);

// ══════════════════════════════════════════════════════
// 생산·출하 탭 (도장사양 + 출하기록 통합)
// ══════════════════════════════════════════════════════
const ProductionPanel = ({ site, siteId, canManage, onMutate }: any) => {
  const [showShipForm, setShowShipForm] = useState(false);
  const [shipForm, setShipForm] = useState({ shippedAt: '', quantity: '', vehicleInfo: '', driverInfo: '', destination: '', receivedBy: '', notes: '' });
  const [saving, setSaving] = useState(false);

  const handleShipSubmit = async () => {
    setSaving(true);
    await fetch(`/api/sites/${siteId}/shipments`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(shipForm),
    });
    setShipForm({ shippedAt: '', quantity: '', vehicleInfo: '', driverInfo: '', destination: '', receivedBy: '', notes: '' });
    setShowShipForm(false); setSaving(false); onMutate();
  };

  const handleShipStatus = async (recordId: string, status: string) => {
    await fetch(`/api/sites/${siteId}/shipments`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recordId, status }),
    });
    onMutate();
  };

  const shipments = site.shipments ?? [];
  const paintSpecs = site.paintSpecs ?? [];

  return (
    <div className="space-y-4">
      {/* 도장 사양 */}
      {paintSpecs.length > 0 && (
        <div className="rounded-xl border border-gray-800 bg-black/20 p-4">
          <p className="text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wider">도장 사양</p>
          <div className="space-y-2">
            {paintSpecs.map((s: any) => (
              <div key={s.id} className="flex flex-wrap items-center gap-3 text-sm rounded-lg border border-gray-800 px-3 py-2">
                <span className="font-mono font-semibold text-yellow-300">{s.colorCode}</span>
                <span>{s.colorName}</span>
                {s.manufacturer && <span className="text-gray-500">{s.manufacturer}</span>}
                {s.quantity && <span className="text-gray-400">{fmtNum(s.quantity)} m²</span>}
                <span className={`badge badge-xs ${s.status === '확정' ? 'badge-success' : 'badge-ghost'}`}>{s.status}</span>
                {s.isPrimary && <span className="badge badge-xs badge-info">주색상</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 출하 기록 */}
      <div className="rounded-xl border border-gray-800 bg-black/20 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            출하 기록 ({shipments.length}차)
          </p>
          {canManage && (
            <button className="btn btn-ghost btn-xs gap-1" onClick={() => setShowShipForm((p) => !p)}>
              <PlusIcon className="h-3.5 w-3.5" />{showShipForm ? '취소' : '출하 추가'}
            </button>
          )}
        </div>

        {showShipForm && (
          <div className="rounded-lg border border-gray-700 p-3 space-y-3">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[
                { key: 'shippedAt', label: '출하일', type: 'date' },
                { key: 'quantity', label: '수량 (m²)', type: 'number' },
                { key: 'vehicleInfo', label: '차량번호' },
                { key: 'driverInfo', label: '기사명' },
                { key: 'destination', label: '도착지' },
                { key: 'receivedBy', label: '인수자' },
              ].map(({ key, label, type }) => (
                <div key={key}>
                  <label className="block text-[11px] text-gray-400 mb-0.5">{label}</label>
                  <input type={type || 'text'} className="input input-bordered input-xs w-full"
                    value={(shipForm as any)[key]}
                    onChange={(e) => setShipForm({ ...shipForm, [key]: e.target.value })} />
                </div>
              ))}
            </div>
            <textarea className="textarea textarea-bordered w-full text-sm" rows={2} placeholder="비고"
              value={shipForm.notes} onChange={(e) => setShipForm({ ...shipForm, notes: e.target.value })} />
            <div className="flex justify-end">
              <button className="btn btn-primary btn-sm" onClick={handleShipSubmit} disabled={saving}>
                {saving ? <span className="loading loading-spinner loading-xs" /> : '저장'}
              </button>
            </div>
          </div>
        )}

        {shipments.length === 0 ? (
          <p className="text-sm text-gray-500 py-4 text-center">출하 기록이 없습니다.</p>
        ) : (
          <div className="space-y-2">
            {shipments.map((s: any, idx: number) => (
              <div key={s.id} className="rounded-lg border border-gray-800 p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm">{idx + 1}차 출하</span>
                    {s.shippedAt && <span className="text-xs text-gray-400">{fmtDate(s.shippedAt)}</span>}
                    {s.quantity && <span className="text-xs text-blue-300 font-semibold">{fmtNum(s.quantity)} m²</span>}
                  </div>
                  {canManage ? (
                    <select className="select select-bordered select-xs" value={s.status}
                      onChange={(e) => handleShipStatus(s.id, e.target.value)}>
                      {SHIP_STATUSES.map((st) => <option key={st} value={st}>{st}</option>)}
                    </select>
                  ) : (
                    <span className="badge badge-sm">{s.status}</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-gray-400">
                  {s.vehicleInfo && <span>차량: {s.vehicleInfo}</span>}
                  {s.driverInfo && <span>기사: {s.driverInfo}</span>}
                  {s.destination && <span>도착: {s.destination}</span>}
                  {s.receivedBy && <span>인수: {s.receivedBy}</span>}
                </div>
                {s.notes && <p className="text-xs text-gray-500 mt-1">{s.notes}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════════════
// 활동 탭 (이슈 + 일정 + 변경 + 상태이력 통합 타임라인)
// ══════════════════════════════════════════════════════
type ActivityItem = {
  id: string; type: 'issue' | 'schedule' | 'change' | 'history';
  date: Date; label: string; title: string; status?: string;
  meta?: string; resolved?: boolean;
};

const ActivityPanel = ({ site, siteId, canManage, onMutate }: any) => {
  const [showIssueForm, setShowIssueForm] = useState(false);
  const [issueForm, setIssueForm] = useState({ title: '', type: '기타', occurredAt: '', location: '', description: '', responsibility: '' });
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<'all' | 'issue' | 'schedule' | 'change'>('all');

  const handleIssueSubmit = async () => {
    if (!issueForm.title) return;
    setSaving(true);
    await fetch(`/api/sites/${siteId}/issues`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(issueForm),
    });
    setIssueForm({ title: '', type: '기타', occurredAt: '', location: '', description: '', responsibility: '' });
    setShowIssueForm(false); setSaving(false); onMutate();
  };

  const handleIssueStatus = async (issueId: string, status: string) => {
    await fetch(`/api/sites/${siteId}/issues`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ issueId, status }),
    });
    onMutate();
  };

  // 타임라인 통합
  const timeline: ActivityItem[] = [
    ...(site.issues ?? []).map((i: any) => ({
      id: i.id, type: 'issue' as const,
      date: new Date(i.occurredAt || i.createdAt),
      label: i.type, title: i.title, status: i.status,
      meta: [i.location, i.responsibility, userName(i.createdBy)].filter(Boolean).join(' · '),
      resolved: i.status === '완료',
    })),
    ...(site.schedules ?? []).map((s: any) => ({
      id: s.id, type: 'schedule' as const,
      date: new Date(s.startDate),
      label: s.type, title: s.title, status: s.isDone ? '완료' : '예정',
      meta: userName(s.assignee),
      resolved: s.isDone,
    })),
    ...(site.changeLogs ?? []).map((c: any) => ({
      id: c.id, type: 'change' as const,
      date: new Date(c.createdAt),
      label: c.type, title: `${c.beforeValue ? `${c.beforeValue} → ` : ''}${c.afterValue || c.reason || '변경'}`,
      status: c.status,
      meta: userName(c.requester),
      resolved: c.status === '승인',
    })),
    ...(site.statusHistory ?? []).map((h: any) => ({
      id: h.id, type: 'history' as const,
      date: new Date(h.createdAt),
      label: '상태변경', title: `${h.fromStatus} → ${h.toStatus}`,
      meta: [h.reason, userName(h.changedBy)].filter(Boolean).join(' · '),
      resolved: true,
    })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  const filtered = filter === 'all' ? timeline : timeline.filter((t) => t.type === filter);

  const typeStyle: Record<string, { dot: string; badge: string }> = {
    issue: { dot: 'bg-red-500', badge: 'bg-red-900/40 text-red-300' },
    schedule: { dot: 'bg-blue-500', badge: 'bg-blue-900/30 text-blue-300' },
    change: { dot: 'bg-yellow-500', badge: 'bg-yellow-900/30 text-yellow-300' },
    history: { dot: 'bg-gray-500', badge: 'bg-gray-800 text-gray-400' },
  };

  const openIssues = (site.issues ?? []).filter((i: any) => i.status !== '완료');

  return (
    <div className="space-y-4">
      {/* 미해결 이슈 요약 */}
      {openIssues.length > 0 && (
        <div className="rounded-xl border border-red-800/60 bg-red-950/15 p-4 space-y-2">
          <div className="flex items-center gap-2 text-red-300 font-semibold text-sm">
            <ExclamationTriangleIcon className="h-4 w-4" />
            미해결 이슈 {openIssues.length}건
          </div>
          {openIssues.map((i: any) => (
            <div key={i.id} className="flex items-center justify-between rounded-lg border border-red-800/30 bg-black/20 px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="badge badge-xs badge-error">{i.type}</span>
                <span className="text-sm">{i.title}</span>
              </div>
              {canManage && (
                <select className="select select-bordered select-xs"
                  value={i.status} onChange={(e) => handleIssueStatus(i.id, e.target.value)}>
                  {ISSUE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 필터 + 이슈 등록 버튼 */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-1">
          {([['all', '전체'], ['issue', '이슈'], ['schedule', '일정'], ['change', '변경']] as const).map(([v, l]) => (
            <button key={v} onClick={() => setFilter(v)}
              className={`btn btn-xs ${filter === v ? 'btn-primary' : 'btn-ghost'}`}>{l}</button>
          ))}
        </div>
        {canManage && (
          <button className="btn btn-ghost btn-xs gap-1" onClick={() => setShowIssueForm((p) => !p)}>
            <PlusIcon className="h-3.5 w-3.5" />{showIssueForm ? '취소' : '이슈 등록'}
          </button>
        )}
      </div>

      {/* 이슈 등록 폼 */}
      {showIssueForm && (
        <div className="rounded-xl border border-red-900/40 bg-red-950/10 p-4 space-y-3">
          <p className="text-sm font-semibold text-red-300">이슈 등록</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className="block text-xs text-gray-400 mb-1">제목 *</label>
              <input type="text" className="input input-bordered input-sm w-full"
                value={issueForm.title} onChange={(e) => setIssueForm({ ...issueForm, title: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">분류</label>
              <select className="select select-bordered select-sm w-full"
                value={issueForm.type} onChange={(e) => setIssueForm({ ...issueForm, type: e.target.value })}>
                {ISSUE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">발생일</label>
              <input type="date" className="input input-bordered input-sm w-full"
                value={issueForm.occurredAt} onChange={(e) => setIssueForm({ ...issueForm, occurredAt: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">위치</label>
              <input type="text" className="input input-bordered input-sm w-full"
                value={issueForm.location} onChange={(e) => setIssueForm({ ...issueForm, location: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">책임구분</label>
              <input type="text" className="input input-bordered input-sm w-full"
                value={issueForm.responsibility} onChange={(e) => setIssueForm({ ...issueForm, responsibility: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">상세내용</label>
            <textarea className="textarea textarea-bordered w-full text-sm" rows={3}
              value={issueForm.description} onChange={(e) => setIssueForm({ ...issueForm, description: e.target.value })} />
          </div>
          <div className="flex justify-end">
            <button className="btn btn-primary btn-sm" onClick={handleIssueSubmit} disabled={saving}>
              {saving ? <span className="loading loading-spinner loading-xs" /> : '등록'}
            </button>
          </div>
        </div>
      )}

      {/* 타임라인 */}
      {filtered.length === 0 ? (
        <div className="py-10 text-center text-sm text-gray-500">기록된 활동이 없습니다.</div>
      ) : (
        <div className="relative space-y-0 pl-5">
          <div className="absolute left-2 top-0 bottom-0 w-px bg-gray-800" />
          {filtered.map((item) => {
            const style = typeStyle[item.type];
            return (
              <div key={`${item.type}-${item.id}`} className="relative pb-4">
                <span className={`absolute -left-3 top-1.5 h-3 w-3 rounded-full border-2 border-gray-900 ${item.resolved ? 'bg-gray-600' : style.dot}`} />
                <div className={`ml-3 rounded-lg border border-gray-800 bg-black/20 px-3 py-2.5 ${item.resolved ? 'opacity-60' : ''}`}>
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${style.badge}`}>{item.label}</span>
                    <span className="text-sm font-medium">{item.title}</span>
                    {item.status && (
                      <span className="text-[11px] text-gray-500 border border-gray-700 rounded-full px-1.5">{item.status}</span>
                    )}
                  </div>
                  <div className="flex gap-3 text-[11px] text-gray-500">
                    <span>{fmtDate(item.date)}</span>
                    {item.meta && <span>{item.meta}</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ══════════════════════════════════════════════════════
// 요청 탭 (게스트가 쓰는 요청 + 내부 요청 처리)
// ══════════════════════════════════════════════════════
const RequestPanel = ({ site, siteId, canManage, onMutate }: any) => {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', type: '현장 요청', priority: '보통', description: '' });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!form.title) return;
    setSaving(true);
    await fetch(`/api/sites/${siteId}/requests`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setForm({ title: '', type: '현장 요청', priority: '보통', description: '' });
    setShowForm(false); setSaving(false); onMutate();
  };

  const handleStatus = async (requestId: string, status: string) => {
    await fetch(`/api/sites/${siteId}/requests`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId, status }),
    });
    onMutate();
  };

  const requests = site.requests ?? [];
  const open = requests.filter((r: any) => !['완료', '반려'].includes(r.status));
  const done = requests.filter((r: any) => ['완료', '반려'].includes(r.status));

  const priorityColor = (p: string) => {
    if (p === '긴급') return 'badge-error';
    if (p === '높음') return 'badge-warning';
    return 'badge-ghost';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-400">
          미처리 <strong className="text-white">{open.length}</strong>건 · 완료 {done.length}건
        </p>
        <button className="btn btn-ghost btn-sm gap-1" onClick={() => setShowForm((p) => !p)}>
          <PlusIcon className="h-4 w-4" />{showForm ? '취소' : '요청 등록'}
        </button>
      </div>

      {showForm && (
        <div className="rounded-xl border border-gray-700 p-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className="block text-xs text-gray-400 mb-1">제목 *</label>
              <input type="text" className="input input-bordered input-sm w-full"
                value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">유형</label>
              <select className="select select-bordered select-sm w-full"
                value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                {['현장 요청', '고객 요청', '협력사 요청', '내부 요청', '긴급 요청'].map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">우선순위</label>
              <select className="select select-bordered select-sm w-full"
                value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                {['낮음', '보통', '높음', '긴급'].map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">내용</label>
            <textarea className="textarea textarea-bordered w-full text-sm" rows={3}
              value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="flex justify-end">
            <button className="btn btn-primary btn-sm" onClick={handleSubmit} disabled={saving}>
              {saving ? <span className="loading loading-spinner loading-xs" /> : '등록'}
            </button>
          </div>
        </div>
      )}

      {/* 미처리 요청 */}
      {open.length > 0 && (
        <div className="space-y-2">
          {open.map((r: any) => (
            <div key={r.id} className="rounded-xl border border-yellow-900/30 bg-yellow-950/10 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className={`badge badge-xs ${priorityColor(r.priority)}`}>{r.priority}</span>
                    <span className="text-sm font-medium">{r.title}</span>
                    <span className="text-xs text-gray-500">{r.type}</span>
                  </div>
                  {r.description && <p className="text-sm text-gray-400">{r.description}</p>}
                  <p className="text-[11px] text-gray-500 mt-1">{userName(r.createdBy)} · {fmtDate(r.createdAt)}</p>
                </div>
                {canManage && (
                  <select className="select select-bordered select-xs flex-shrink-0"
                    value={r.status} onChange={(e) => handleStatus(r.id, e.target.value)}>
                    {['등록', '확인중', '처리중', '완료', '반려', '보류'].map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 완료 요청 */}
      {done.length > 0 && (
        <details className="rounded-xl border border-gray-800">
          <summary className="cursor-pointer px-4 py-2.5 text-xs text-gray-500 hover:text-gray-300">
            완료된 요청 {done.length}건 보기
          </summary>
          <div className="divide-y divide-gray-800 px-4 pb-3 space-y-0">
            {done.map((r: any) => (
              <div key={r.id} className="py-2 opacity-60">
                <div className="flex items-center gap-2">
                  <span className={`badge badge-xs ${r.status === '완료' ? 'badge-success' : 'badge-error'}`}>{r.status}</span>
                  <span className="text-sm">{r.title}</span>
                </div>
              </div>
            ))}
          </div>
        </details>
      )}

      {requests.length === 0 && (
        <div className="py-10 text-center text-sm text-gray-500">등록된 요청이 없습니다.</div>
      )}
    </div>
  );
};

// ══════════════════════════════════════════════════════
// 서류 탭
// ══════════════════════════════════════════════════════
const DocumentPanel = ({ siteId, canManage }: { siteId: string; canManage: boolean }) => {
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    const r = await fetch(`/api/sites/${siteId}/documents`);
    if (r.ok) { const d = await r.json(); setDocs(d.data || []); }
    setLoading(false);
  }, [siteId]);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) { alert('5MB 이하 파일만 업로드 가능합니다.'); return; }
    setUploading(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const b64 = (reader.result as string).split(',')[1];
      await fetch(`/api/sites/${siteId}/documents`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: f.name, fileData: b64, mimeType: f.type }),
      });
      setUploading(false); fetchDocs();
    };
    reader.readAsDataURL(f);
    e.target.value = '';
  };

  const handleDel = async (docId: string) => {
    if (!confirm('서류를 삭제하시겠습니까?')) return;
    await fetch(`/api/sites/${siteId}/documents`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentId: docId }),
    });
    fetchDocs();
  };

  const fmtSize = (b: number | null) => {
    if (!b) return '-';
    if (b < 1024) return `${b}B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)}KB`;
    return `${(b / (1024 * 1024)).toFixed(1)}MB`;
  };

  return (
    <div className="rounded-xl border border-gray-800 bg-black/20 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">서류 ({docs.length})</p>
        {canManage && (
          <label className="btn btn-ghost btn-xs gap-1 cursor-pointer">
            {uploading ? <span className="loading loading-spinner loading-xs" /> : <PlusIcon className="h-3.5 w-3.5" />}
            파일 업로드
            <input type="file" className="hidden" onChange={handleUpload} disabled={uploading} />
          </label>
        )}
      </div>

      {loading ? (
        <div className="py-6 text-center"><span className="loading loading-spinner loading-sm" /></div>
      ) : docs.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-500">등록된 서류가 없습니다.</p>
      ) : (
        <div className="divide-y divide-gray-800">
          {docs.map((d: any) => (
            <div key={d.id} className="flex items-center justify-between py-2.5">
              <div>
                <a href={`/api/documents/${d.id}`} target="_blank" rel="noreferrer"
                  className="text-sm text-blue-400 hover:underline">{d.fileName}</a>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  {fmtSize(d.fileSize)} · {userName(d.uploadedBy)} · {fmtDate(d.createdAt)}
                </p>
              </div>
              {canManage && (
                <button className="btn btn-ghost btn-xs text-red-400" onClick={() => handleDel(d.id)}>
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

// ══════════════════════════════════════════════════════
// 댓글 탭
// ══════════════════════════════════════════════════════
const CommentsPanel = ({ site, siteId, onMutate }: any) => {
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!comment.trim()) return;
    setSubmitting(true);
    await fetch('/api/comments', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ siteId, content: comment }),
    });
    setComment(''); setSubmitting(false); onMutate();
  };

  const comments = site.comments ?? [];

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <textarea className="textarea textarea-bordered flex-1 text-sm" rows={2}
          placeholder="댓글을 입력하세요..."
          value={comment} onChange={(e) => setComment(e.target.value)} />
        <button className="btn btn-primary btn-sm self-end" onClick={handleSubmit} disabled={submitting || !comment.trim()}>
          {submitting ? <span className="loading loading-spinner loading-xs" /> : '등록'}
        </button>
      </div>

      {comments.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-500">댓글이 없습니다.</p>
      ) : (
        <div className="space-y-3">
          {comments.map((c: any) => (
            <div key={c.id} className="rounded-xl border border-gray-800 p-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-medium">{userName(c.author)}</span>
                <span className="text-[11px] text-gray-500">{fmtDatetime(c.createdAt)}</span>
              </div>
              <p className="text-sm whitespace-pre-wrap">{c.content}</p>
              {c.replies?.length > 0 && (
                <div className="mt-2 ml-4 space-y-2 border-l-2 border-gray-800 pl-3">
                  {c.replies.map((r: any) => (
                    <div key={r.id}>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-300">{userName(r.author)}</span>
                        <span className="text-[11px] text-gray-500">{fmtDatetime(r.createdAt)}</span>
                      </div>
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
  );
};

export async function getServerSideProps({ locale }: GetServerSidePropsContext) {
  return { props: { ...(locale ? await serverSideTranslations(locale, ['common']) : {}) } };
}

export default SiteDetail;
