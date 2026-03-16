/* eslint-disable i18next/no-literal-string */
import { GetServerSidePropsContext } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useState, useMemo } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import useSWR from 'swr';
import fetcher from '@/lib/fetcher';
import {
  PlusIcon, MagnifyingGlassIcon, FunnelIcon,
  BuildingOffice2Icon, ArrowRightIcon, LockClosedIcon,
} from '@heroicons/react/24/outline';

const SALES_STAGE_ORDER = ['영업접촉', '제안', '협의중', '수주확정', '실패'];
const SALES_STAGE_COLOR: Record<string, string> = {
  '영업접촉': 'bg-gray-700 text-gray-300 border-gray-600',
  '제안': 'bg-orange-900/50 text-orange-300 border-orange-800/50',
  '협의중': 'bg-yellow-900/50 text-yellow-300 border-yellow-800/50',
  '수주확정': 'bg-green-900/50 text-green-300 border-green-800/50',
  '실패': 'bg-red-900/30 text-red-400 border-red-900/40',
};

const fmtDate = (v: any) => {
  if (!v) return '-';
  try { return new Date(v).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' }); } catch { return '-'; }
};
const fmtMoney = (v: any) => {
  if (!v) return null;
  const n = Number(v);
  if (n >= 100000000) return `${(n / 100000000).toFixed(1)}억`;
  return `${Math.round(n / 10000).toLocaleString()}만`;
};

// ── 영업관리 메인 ──────────────────────────────────────
const SalesPage = () => {
  const router = useRouter();
  const { data: profileData } = useSWR('/api/my/profile', fetcher);
  const { data: sitesData, mutate } = useSWR('/api/sites?salesOnly=true', fetcher, { refreshInterval: 30000 });

  const profile = profileData?.data;
  const role = profile?.role || profile?.teamMembers?.[0]?.role || 'USER';
  const permissions = profile?.permissions || {};

  // 영업관리 접근 권한: 영업부서 소속 또는 SUPER_ADMIN/ADMIN_HR
  const canAccessSales = permissions.canAccessSalesMenu ?? false;
  const canCreate = canAccessSales && !['PARTNER', 'GUEST', 'VIEWER'].includes(role);
  const canConvert = ['SUPER_ADMIN', 'OWNER', 'ADMIN_HR', 'ADMIN', 'MANAGER'].includes(role);

  const sites: any[] = sitesData?.data ?? [];

  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let list = sites.filter(s => ['SALES_PIPELINE', 'SALES_CONFIRMED', 'FAILED'].includes(s.status));
    if (search) list = list.filter(s =>
      s.name?.toLowerCase().includes(search.toLowerCase()) ||
      s.client?.name?.toLowerCase().includes(search.toLowerCase()) ||
      s.address?.toLowerCase().includes(search.toLowerCase())
    );
    if (stageFilter !== 'all') list = list.filter(s => s.salesStage === stageFilter);
    return list;
  }, [sites, search, stageFilter]);

  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    SALES_STAGE_ORDER.forEach(s => { counts[s] = 0; });
    sites.filter(s => ['SALES_PIPELINE', 'SALES_CONFIRMED'].includes(s.status))
      .forEach(s => { if (s.salesStage) counts[s.salesStage] = (counts[s.salesStage] || 0) + 1; });
    return counts;
  }, [sites]);

  const activeCount = sites.filter(s => ['SALES_PIPELINE', 'SALES_CONFIRMED'].includes(s.status)).length;
  const failedCount = sites.filter(s => s.status === 'FAILED').length;

  // 프로필 로딩 중
  if (!profileData) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="loading loading-spinner loading-lg text-gray-500" />
      </div>
    );
  }

  // 접근 권한 없음
  if (!canAccessSales) {
    return (
      <>
        <Head><title>영업관리 | LOOKUP9</title></Head>
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <LockClosedIcon className="h-12 w-12 text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-400">접근 권한이 없습니다</h2>
          <p className="text-sm text-gray-600 text-center max-w-xs">
            영업관리 메뉴는 영업부서 소속 임직원만 이용할 수 있습니다.<br />
            접근이 필요한 경우 관리자에게 문의하세요.
          </p>
          <button className="btn btn-ghost btn-sm" onClick={() => router.push('/dashboard')}>
            대시보드로 돌아가기
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <Head><title>영업관리 | LOOKUP9</title></Head>
      <div className="space-y-4">

        {/* 헤더 */}
        <div className="flex items-end justify-between gap-3 rounded-2xl border border-gray-800 bg-black/30 p-4">
          <div>
            <h2 className="text-xl font-bold">영업관리</h2>
            <p className="mt-0.5 text-xs text-gray-500">
              진행중 {activeCount}건 · 실패/보류 {failedCount}건
            </p>
          </div>
          {canCreate && (
            <button className="btn btn-primary btn-sm gap-1.5" onClick={() => setShowCreateModal(true)}>
              <PlusIcon className="h-4 w-4" />영업현장 등록
            </button>
          )}
        </div>

        {/* 파이프라인 요약 */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {SALES_STAGE_ORDER.filter(s => s !== '실패').map(stage => (
            <button key={stage}
              onClick={() => setStageFilter(stageFilter === stage ? 'all' : stage)}
              className={`rounded-xl border px-3 py-3 text-center transition-all ${
                stageFilter === stage ? 'border-blue-500 bg-blue-950/30' : 'border-gray-800 bg-black/20 hover:border-gray-600'
              }`}>
              <p className="text-lg font-bold text-white">{stageCounts[stage] || 0}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">{stage}</p>
            </button>
          ))}
          <button
            onClick={() => setStageFilter(stageFilter === '실패' ? 'all' : '실패')}
            className={`rounded-xl border px-3 py-3 text-center transition-all ${
              stageFilter === '실패' ? 'border-red-800 bg-red-950/30' : 'border-gray-800 bg-black/20 hover:border-gray-600'
            }`}>
            <p className="text-lg font-bold text-red-400">{stageCounts['실패'] || 0}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">실패</p>
          </button>
        </div>

        {/* 검색 + 필터 */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input type="text" className="input input-bordered input-sm w-full pl-9 bg-black/20"
              placeholder="현장명, 수요기관, 주소 검색..."
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          {stageFilter !== 'all' && (
            <button className="btn btn-ghost btn-sm gap-1" onClick={() => setStageFilter('all')}>
              <FunnelIcon className="h-4 w-4" />초기화
            </button>
          )}
        </div>

        {/* 현장 목록 */}
        {filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-700 py-16 text-center">
            <BuildingOffice2Icon className="h-10 w-10 mx-auto text-gray-600 mb-3" />
            <p className="text-sm text-gray-500">
              {search || stageFilter !== 'all' ? '검색 결과가 없습니다.' : '등록된 영업현장이 없습니다.'}
            </p>
            {canCreate && !search && stageFilter === 'all' && (
              <button className="btn btn-ghost btn-sm mt-3 gap-1" onClick={() => setShowCreateModal(true)}>
                <PlusIcon className="h-4 w-4" />영업현장 등록
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(site => (
              <SalesSiteCard
                key={site.id}
                site={site}
                canConvert={canConvert}
                isSelected={selectedSiteId === site.id}
                onSelect={() => setSelectedSiteId(selectedSiteId === site.id ? null : site.id)}
                onMutate={mutate}
              />
            ))}
          </div>
        )}

        {/* 영업현장 등록 모달 - 등록 후 영업관리 내에서 유지 */}
        {showCreateModal && (
          <CreateSalesModal
            onClose={() => setShowCreateModal(false)}
            onCreated={(id) => {
              setShowCreateModal(false);
              setSelectedSiteId(id);
              mutate();
            }}
          />
        )}

        {/* 영업현장 인라인 상세 패널 */}
        {selectedSiteId && (
          <SalesDetailPanel
            siteId={selectedSiteId}
            canConvert={canConvert}
            onClose={() => setSelectedSiteId(null)}
            onMutate={mutate}
          />
        )}
      </div>
    </>
  );
};

// ── 영업 현장 카드 ────────────────────────────────────
const SalesSiteCard = ({ site, canConvert, isSelected, onSelect, onMutate }: {
  site: any; canConvert: boolean; isSelected: boolean;
  onSelect: () => void; onMutate: () => void;
}) => {
  const lastSale = site.sales?.[site.sales.length - 1];
  const isFailed = site.status === 'FAILED';
  const isConfirmed = site.status === 'SALES_CONFIRMED';

  const handleConvert = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`"${site.name}"을 현장관리로 전환하시겠습니까?\n계약서(분할납품요구서)를 업로드하여 정식 현장으로 개설합니다.`)) return;
    await fetch(`/api/sites/${site.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'CONTRACT_ACTIVE' }),
    });
    onMutate();
  };

  return (
    <div
      onClick={onSelect}
      className={`rounded-xl border p-4 cursor-pointer transition-all ${
        isSelected ? 'border-blue-500 bg-blue-950/10' :
        isFailed ? 'border-gray-800 bg-black/10 opacity-60 hover:opacity-80' :
        isConfirmed ? 'border-green-800/40 bg-green-950/10 hover:border-green-700/50' :
        'border-gray-800 bg-black/20 hover:border-gray-600'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            {site.salesStage && (
              <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${SALES_STAGE_COLOR[site.salesStage] || 'bg-gray-700 text-gray-300 border-gray-600'}`}>
                {site.salesStage}
              </span>
            )}
            {isConfirmed && (
              <span className="rounded-full border border-green-800/40 bg-green-900/40 px-2 py-0.5 text-[11px] font-semibold text-green-300">
                수주확정
              </span>
            )}
            <span className="text-sm font-semibold text-white truncate">{site.name}</span>
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-400">
            {site.client?.name && <span>{site.client.name}</span>}
            {site.address && <span>{site.address}</span>}
            {site.estimatedAmount && (
              <span className="text-blue-300 font-medium">예상 {fmtMoney(site.estimatedAmount)}원</span>
            )}
          </div>
          {lastSale?.meetingNotes && (
            <p className="text-xs text-gray-500 mt-1.5 line-clamp-1">
              최근: {lastSale.meetingNotes}
            </p>
          )}
        </div>

        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <span className="text-[11px] text-gray-600">{fmtDate(site.updatedAt)}</span>
          {canConvert && isConfirmed && (
            <button
              onClick={handleConvert}
              className="btn btn-success btn-xs gap-1 whitespace-nowrap"
            >
              <ArrowRightIcon className="h-3 w-3" />현장 전환
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ── 영업현장 인라인 상세 패널 ─────────────────────────
const SalesDetailPanel = ({ siteId, canConvert, onClose, onMutate }: {
  siteId: string; canConvert: boolean; onClose: () => void; onMutate: () => void;
}) => {
  const { data, mutate } = useSWR(`/api/sites/${siteId}`, fetcher);
  const site = data?.data;
  const [showSalesForm, setShowSalesForm] = useState(false);
  const [salesForm, setSalesForm] = useState({ status: '영업접촉', estimateAmount: '', meetingNotes: '' });
  const [sub, setSub] = useState(false);

  const handleSalesSubmit = async () => {
    setSub(true);
    await fetch(`/api/sites/${siteId}/sales`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...salesForm,
        estimateAmount: salesForm.estimateAmount ? Number(salesForm.estimateAmount.replace(/,/g, '')) : null,
      }),
    });
    setSalesForm({ status: '영업접촉', estimateAmount: '', meetingNotes: '' });
    setShowSalesForm(false); setSub(false); mutate(); onMutate();
  };

  if (!site) return (
    <div className="rounded-xl border border-gray-800 p-8 text-center">
      <span className="loading loading-spinner loading-md text-gray-500" />
    </div>
  );

  return (
    <div className="rounded-xl border border-blue-800/30 bg-blue-950/5 p-5 space-y-4">
      {/* 상단 */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-bold text-base">{site.name}</h3>
          <div className="flex flex-wrap gap-2 mt-1 text-xs text-gray-400">
            {site.client?.name && <span>{site.client.name}</span>}
            {site.address && <span>{site.address}</span>}
            {site.estimatedAmount && (
              <span className="text-blue-300 font-medium">
                예상 {fmtMoney(site.estimatedAmount)}원
              </span>
            )}
          </div>
        </div>
        <button className="btn btn-ghost btn-xs" onClick={onClose}>✕ 닫기</button>
      </div>

      {/* 영업 기록 */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-gray-500 font-medium">영업 기록</p>
          <button className="btn btn-ghost btn-xs" onClick={() => setShowSalesForm(!showSalesForm)}>
            {showSalesForm ? '취소' : <><PlusIcon className="w-3.5 h-3.5 mr-1" />기록 추가</>}
          </button>
        </div>

        {showSalesForm && (
          <div className="mb-3 rounded-lg border border-gray-700 bg-black/20 p-3 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-gray-400 mb-1">영업단계</label>
                <select className="select select-bordered select-sm w-full" value={salesForm.status}
                  onChange={(e) => setSalesForm({ ...salesForm, status: e.target.value })}>
                  {['영업접촉', '견적제출', '협상중', '계약체결', '실패'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">예상금액</label>
                <input className="input input-bordered input-sm w-full" placeholder="예: 27,000,000"
                  value={salesForm.estimateAmount ? Number(salesForm.estimateAmount.replace(/,/g, '')).toLocaleString() : ''}
                  onChange={(e) => setSalesForm({ ...salesForm, estimateAmount: e.target.value.replace(/,/g, '') })} />
              </div>
            </div>
            <textarea className="textarea textarea-bordered w-full text-sm" rows={2}
              placeholder="미팅 메모, 특이사항..."
              value={salesForm.meetingNotes}
              onChange={(e) => setSalesForm({ ...salesForm, meetingNotes: e.target.value })} />
            <div className="flex justify-end">
              <button className={`btn btn-primary btn-sm ${sub ? 'loading' : ''}`} disabled={sub} onClick={handleSalesSubmit}>저장</button>
            </div>
          </div>
        )}

        {(site.sales || []).length === 0 ? (
          <p className="text-xs text-gray-600 py-2">영업 기록이 없습니다.</p>
        ) : (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {[...site.sales].reverse().map((s: any) => (
              <div key={s.id} className="rounded-lg border border-gray-800 p-3 text-xs">
                <div className="flex items-center justify-between mb-1">
                  <span className="badge badge-xs badge-outline">{s.status}</span>
                  <span className="text-gray-600">{new Date(s.createdAt).toLocaleDateString('ko-KR')}</span>
                </div>
                {s.estimateAmount && <p className="text-gray-400">예상: <span className="text-gray-200">{Number(s.estimateAmount).toLocaleString()}원</span></p>}
                {s.meetingNotes && <p className="text-gray-500 mt-1 whitespace-pre-wrap">{s.meetingNotes}</p>}
                <p className="text-gray-600 mt-0.5">{s.createdBy?.position ? `${s.createdBy.position} ` : ''}{s.createdBy?.name}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 현장 전환 안내 */}
      {canConvert && site.status === 'SALES_CONFIRMED' && (
        <div className="rounded-lg border border-green-800/40 bg-green-950/20 p-3 flex items-center justify-between gap-3">
          <p className="text-xs text-green-400">수주가 확정되었습니다. 정식 현장으로 전환할 수 있습니다.</p>
          <button
            className="btn btn-success btn-xs gap-1 whitespace-nowrap shrink-0"
            onClick={async () => {
              if (!confirm(`"${site.name}"을 현장관리로 전환하시겠습니까?`)) return;
              await fetch(`/api/sites/${siteId}`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'CONTRACT_ACTIVE' }),
              });
              onMutate(); onClose();
            }}
          >
            <ArrowRightIcon className="h-3 w-3" />현장 전환
          </button>
        </div>
      )}
    </div>
  );
};

// ── 영업현장 등록 모달 ─────────────────────────────────
const CreateSalesModal = ({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) => {
  const [form, setForm] = useState({
    name: '', address: '', clientName: '',
    salesStage: '영업접촉', estimatedAmount: '',
    siteType: '납품설치도', salesNote: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!form.name) { setError('현장명은 필수입니다.'); return; }
    setSaving(true); setError('');
    try {
      const res = await fetch('/api/sites', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, status: 'SALES_PIPELINE' }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || '등록 실패');
      // 영업관리 내에서 유지 - 생성된 사이트 ID 반환
      onCreated(json.data?.id || json.data?.site?.id);
    } catch (e: any) {
      setError(e.message);
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-gray-700 bg-gray-900 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold">영업현장 등록</h3>
          <button className="btn btn-ghost btn-sm btn-circle" onClick={onClose}>✕</button>
        </div>

        {error && <p className="text-sm text-red-400 bg-red-950/30 rounded-lg px-3 py-2">{error}</p>}

        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">현장명 (사업명) *</label>
            <input type="text" className="input input-bordered input-sm w-full"
              placeholder="예) 국공립○○어린이집 공공건축물 그린리모델링 공사"
              value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs text-gray-400 mb-1">수요기관 (발주처)</label>
              <input type="text" className="input input-bordered input-sm w-full"
                value={form.clientName} onChange={e => setForm({ ...form, clientName: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">계약 유형</label>
              <select className="select select-bordered select-sm w-full"
                value={form.siteType} onChange={e => setForm({ ...form, siteType: e.target.value })}>
                <option>납품설치도</option><option>납품하차도</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">영업 단계</label>
              <select className="select select-bordered select-sm w-full"
                value={form.salesStage} onChange={e => setForm({ ...form, salesStage: e.target.value })}>
                {['영업접촉', '제안', '협의중', '수주확정'].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">예상 계약금액 (원)</label>
              <input type="text" className="input input-bordered input-sm w-full"
                placeholder="예) 27000000"
                value={form.estimatedAmount} onChange={e => setForm({ ...form, estimatedAmount: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">현장 주소</label>
            <input type="text" className="input input-bordered input-sm w-full"
              value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">영업 메모</label>
            <textarea className="textarea textarea-bordered w-full text-sm" rows={2}
              placeholder="영업 경위, 특이사항..."
              value={form.salesNote} onChange={e => setForm({ ...form, salesNote: e.target.value })} />
          </div>
        </div>

        <div className="flex gap-2 justify-end border-t border-gray-800 pt-3">
          <button className="btn btn-ghost btn-sm" onClick={onClose}>취소</button>
          <button className="btn btn-primary btn-sm" onClick={handleSubmit} disabled={saving}>
            {saving ? <span className="loading loading-spinner loading-xs" /> : '등록'}
          </button>
        </div>
      </div>
    </div>
  );
};

export async function getServerSideProps({ locale }: GetServerSidePropsContext) {
  return { props: { ...(locale ? await serverSideTranslations(locale, ['common']) : {}) } };
}

export default SalesPage;
