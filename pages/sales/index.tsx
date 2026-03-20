/* eslint-disable i18next/no-literal-string */
import { GetServerSidePropsContext } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useState, useMemo } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import useSWR from 'swr';
import fetcher from '@/lib/fetcher';
import {
  PlusIcon, MagnifyingGlassIcon, TrashIcon,
  ArrowRightIcon, LockClosedIcon, XMarkIcon,
  ChartBarIcon, UserIcon,
} from '@heroicons/react/24/outline';

// ── 상수 ─────────────────────────────────────────────────────────────────────
const STAGE_OPTIONS = ['영업접촉', '제안', '협의중', '수주확정', '실패'];
const STAGE_COLOR: Record<string, string> = {
  '영업접촉': 'text-gray-300 bg-gray-800/60 border-gray-700',
  '제안':     'text-orange-300 bg-orange-900/40 border-orange-800/50',
  '협의중':   'text-yellow-300 bg-yellow-900/40 border-yellow-800/50',
  '수주확정': 'text-green-300 bg-green-900/40 border-green-800/50',
  '실패':     'text-red-400 bg-red-900/20 border-red-900/40',
};
const SECTOR_OPTIONS = ['관(공공)', '민(민간)'];

// ── 유틸 ─────────────────────────────────────────────────────────────────────
const fmtMoney = (v: any) => {
  if (!v) return null;
  const n = Number(v);
  if (n >= 100000000) return `${(n / 100000000).toFixed(1)}억`;
  return `${Math.round(n / 10000).toLocaleString()}만`;
};

// ── 인라인 편집 셀 ────────────────────────────────────────────────────────────
const EditableCell = ({
  value, onSave, type = 'text', options,
}: {
  value: string; onSave: (v: string) => void;
  type?: 'text' | 'select'; options?: string[];
}) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const commit = () => { setEditing(false); if (draft !== value) onSave(draft); };
  const cancel = () => { setEditing(false); setDraft(value); };

  if (!editing) {
    return (
      <span
        className="block min-h-[20px] cursor-pointer rounded px-1 transition text-sm"
        onClick={() => { setDraft(value); setEditing(true); }}
        title="클릭하여 편집"
        style={{minHeight:'28px'}}
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
      >
        {value || <span style={{color:"var(--text-placeholder)"}}>-</span>}
      </span>
    );
  }
  if (type === 'select' && options) {
    return (
      <select
        autoFocus
        className="select select-bordered select-xs w-full text-sm"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
      >
        <option value="">-</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  }
  return (
    <input
      autoFocus
      type="text"
      className="input input-bordered input-xs w-full text-sm"
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') cancel(); }}
      onBlur={commit}
    />
  );
};

// ── 메인 ─────────────────────────────────────────────────────────────────────
const SalesPage = () => {
  const router = useRouter();
  const { data: profileData } = useSWR('/api/my/profile', fetcher);
  const { data: sitesData, mutate } = useSWR('/api/sites?salesOnly=true', fetcher, { refreshInterval: 30000 });

  const profile = profileData?.data;
  const role = profile?.role || 'USER';
  const permissions = profile?.permissions || {};
  const canAccessSales = permissions.canAccessSalesMenu ?? false;
  const canCreate  = canAccessSales && !['PARTNER', 'GUEST', 'VIEWER'].includes(role);
  const canDelete  = ['SUPER_ADMIN', 'OWNER', 'ADMIN_HR'].includes(role);
  const canConvert = ['SUPER_ADMIN', 'OWNER', 'ADMIN_HR', 'ADMIN', 'MANAGER'].includes(role);

  const sites: any[] = sitesData?.data ?? [];
  const [search, setSearch]           = useState('');
  const [stageFilter, setStageFilter] = useState('all');
  const [activeTab, setActiveTab]     = useState<'list' | 'performance'>('list');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deletingId, setDeletingId]   = useState<string | null>(null);
  const [saving, setSaving]           = useState<string | null>(null);

  // ── 필터링 ──────────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = [...sites];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(s =>
        s.name?.toLowerCase().includes(q) ||
        s.client?.name?.toLowerCase().includes(q) ||
        s.address?.toLowerCase().includes(q) ||
        s.salesOwner?.toLowerCase().includes(q) ||
        s.designOffice?.toLowerCase().includes(q)
      );
    }
    if (stageFilter !== 'all') list = list.filter(s => s.salesStage === stageFilter);
    return list;
  }, [sites, search, stageFilter]);

  // ── 영업합산 ─────────────────────────────────────────────────────────────────
  const summary = useMemo(() => {
    const active   = sites.filter(s => ['SALES_PIPELINE', 'SALES_CONFIRMED'].includes(s.status));
    const failed   = sites.filter(s => s.status === 'FAILED');
    const confirmed = sites.filter(s => s.status === 'SALES_CONFIRMED');
    const stageCounts: Record<string, number> = {};
    STAGE_OPTIONS.forEach(s => { stageCounts[s] = 0; });
    active.forEach(s => { if (s.salesStage) stageCounts[s.salesStage] = (stageCounts[s.salesStage] || 0) + 1; });
    const totalAmount = active.reduce((sum, s) => sum + Number(s.estimatedAmount || 0), 0);
    return { activeCount: active.length, failedCount: failed.length, confirmedCount: confirmed.length, stageCounts, totalAmount };
  }, [sites]);

  // ── 개인별 영업실적 ──────────────────────────────────────────────────────────
  const performance = useMemo(() => {
    const map: Record<string, {
      name: string;
      total: number; active: number; confirmed: number; failed: number;
      totalAmount: number; confirmedAmount: number;
      stages: Record<string, number>;
    }> = {};

    sites.forEach(s => {
      const owner = s.salesOwner?.trim() || '미지정';
      if (!map[owner]) {
        map[owner] = { name: owner, total: 0, active: 0, confirmed: 0, failed: 0, totalAmount: 0, confirmedAmount: 0, stages: {} };
      }
      const p = map[owner];
      p.total++;
      if (s.status === 'FAILED') { p.failed++; }
      else if (s.status === 'SALES_CONFIRMED') { p.confirmed++; p.active++; p.confirmedAmount += Number(s.estimatedAmount || 0); }
      else { p.active++; }
      p.totalAmount += Number(s.estimatedAmount || 0);
      if (s.salesStage) p.stages[s.salesStage] = (p.stages[s.salesStage] || 0) + 1;
    });

    return Object.values(map).sort((a, b) => b.confirmed - a.confirmed || b.active - a.active);
  }, [sites]);

  // ── 인라인 저장 ─────────────────────────────────────────────────────────────
  const saveField = async (siteId: string, field: string, value: string) => {
    setSaving(siteId);
    await fetch(`/api/sites/${siteId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value || null }),
    });
    setSaving(null);
    mutate();
  };

  // ── 삭제 ────────────────────────────────────────────────────────────────────
  const handleDelete = async (site: any) => {
    if (!confirm(`"${site.name}" 영업현장을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) return;
    setDeletingId(site.id);
    await fetch(`/api/sites/${site.id}`, { method: 'DELETE' });
    setDeletingId(null);
    mutate();
  };

  // ── 현장 전환 ───────────────────────────────────────────────────────────────
  const handleConvert = async (site: any) => {
    if (!confirm(`"${site.name}"을 정식 현장으로 전환하시겠습니까?`)) return;
    await fetch(`/api/sites/${site.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'CONTRACT_ACTIVE' }),
    });
    mutate();
  };

  // ── 로딩 / 권한 ─────────────────────────────────────────────────────────────
  if (!profileData) {
    return <div className="flex items-center justify-center py-20"><span className="loading loading-spinner loading-lg text-gray-500" /></div>;
  }
  if (!canAccessSales) {
    return (
      <>
        <Head><title>영업관리 | LOOKUP9</title></Head>
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <LockClosedIcon className="h-12 w-12 text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-400">접근 권한이 없습니다</h2>
          <p className="text-sm text-gray-600 text-center max-w-xs">영업관리 메뉴는 영업부서 소속 임직원만 이용할 수 있습니다.</p>
          <button className="btn btn-ghost btn-sm" onClick={() => router.push('/dashboard')}>대시보드로 돌아가기</button>
        </div>
      </>
    );
  }

  return (
    <>
      <Head><title>영업관리 | LOOKUP9</title></Head>
      <div className="space-y-4">

        {/* ── 헤더 + 영업합산 카드 ── */}
        <div className="rounded-2xl p-4 space-y-3" style={{border:"1px solid var(--border-base)",backgroundColor:"var(--bg-card)"}}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">영업관리</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                진행 {summary.activeCount}건 · 수주확정 {summary.confirmedCount}건 · 실패/보류 {summary.failedCount}건
                {summary.totalAmount > 0 && <span className="ml-2 text-blue-400">예상 합계 {fmtMoney(summary.totalAmount)}원</span>}
              </p>
            </div>
            {canCreate && (
              <button className="btn btn-primary btn-sm gap-1.5" onClick={() => setShowCreateModal(true)}>
                <PlusIcon className="h-4 w-4" />영업현장 등록
              </button>
            )}
          </div>

          {/* 단계별 합산 카드 */}
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            <div
              onClick={() => setStageFilter('all')}
              className={`cursor-pointer rounded-xl border px-3 py-2.5 text-center transition ${stageFilter === 'all' ? 'border-blue-500 bg-blue-950/30' : 'border-gray-800 bg-black/20 hover:border-gray-700'}`}
            >
              <p className="text-lg font-bold text-white">{summary.activeCount}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">전체 진행</p>
            </div>
            {STAGE_OPTIONS.filter(s => s !== '실패').map(stage => (
              <div
                key={stage}
                onClick={() => setStageFilter(stageFilter === stage ? 'all' : stage)}
                className={`cursor-pointer rounded-xl border px-3 py-2.5 text-center transition ${stageFilter === stage ? 'border-blue-500 bg-blue-950/30' : 'border-gray-800 bg-black/20 hover:border-gray-700'}`}
              >
                <p className="text-lg font-bold text-white">{summary.stageCounts[stage] || 0}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">{stage}</p>
              </div>
            ))}
            <div
              onClick={() => setStageFilter(stageFilter === '실패' ? 'all' : '실패')}
              className={`cursor-pointer rounded-xl border px-3 py-2.5 text-center transition ${stageFilter === '실패' ? 'border-red-800 bg-red-950/30' : 'border-gray-800 bg-black/20 hover:border-gray-700'}`}
            >
              <p className="text-lg font-bold text-red-400">{summary.failedCount}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">실패/보류</p>
            </div>
          </div>
        </div>

        {/* ── 탭: 현장목록 / 영업실적 ── */}
        <div className="flex gap-1" style={{borderBottom:"1px solid var(--border-base)"}}>
          <button
            onClick={() => setActiveTab('list')}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition -mb-px ${activeTab === 'list' ? 'border-blue-500 text-blue-300' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
          >
            <MagnifyingGlassIcon className="h-4 w-4" />현장 목록
            <span className="text-[11px] opacity-60">({filtered.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('performance')}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition -mb-px ${activeTab === 'performance' ? 'border-blue-500 text-blue-300' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
          >
            <ChartBarIcon className="h-4 w-4" />영업실적
            <span className="text-[11px] opacity-60">({performance.length}명)</span>
          </button>
        </div>

        {/* ── 탭 콘텐츠 ── */}
        {activeTab === 'list' ? (
          <>
            {/* 검색 */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  className="input input-bordered input-sm w-full pl-9"
                  style={{backgroundColor:"var(--input-bg)"}}
                  placeholder="PJ명, 발주처, 설계사무소, 영업담당 검색..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              {(search || stageFilter !== 'all') && (
                <button className="btn btn-ghost btn-sm" onClick={() => { setSearch(''); setStageFilter('all'); }}>초기화</button>
              )}
            </div>

            {/* 테이블 */}
            {filtered.length === 0 ? (
              <div className="rounded-xl border-2 border-dashed py-16 text-center" style={{borderColor:"var(--border-base)"}}>
                <p style={{color:"var(--text-muted)"}} className="text-sm">
                  {search || stageFilter !== 'all' ? '검색 결과가 없습니다.' : '등록된 영업현장이 없습니다.'}
                </p>
                {canCreate && !search && stageFilter === 'all' && (
                  <button className="btn btn-ghost btn-sm mt-3 gap-1" onClick={() => setShowCreateModal(true)}>
                    <PlusIcon className="h-4 w-4" />영업현장 등록
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl" style={{border:"1px solid var(--border-base)"}}>
                <table className="table table-sm w-full text-sm">
                  <thead>
                    <tr style={{borderBottom:"1px solid var(--border-base)",backgroundColor:"var(--bg-hover)"}} className="text-xs">
                      <th className="w-8 px-3 py-3 text-center" style={{color:"var(--text-muted)"}}>NO</th>
                      <th className="min-w-[180px] px-3 py-3" style={{color:"var(--text-muted)"}}>PJ명</th>
                      <th className="min-w-[100px] px-3 py-3" style={{color:"var(--text-muted)"}}>설계사무소</th>
                      <th className="min-w-[80px] px-3 py-3" style={{color:"var(--text-muted)"}}>담당PM</th>
                      <th className="min-w-[120px] px-3 py-3" style={{color:"var(--text-muted)"}}>자재규모 및 사양</th>
                      <th className="w-[70px] px-3 py-3 text-center" style={{color:"var(--text-muted)"}}>구분</th>
                      <th className="min-w-[70px] px-3 py-3" style={{color:"var(--text-muted)"}}>영업담당</th>
                      <th className="min-w-[120px] px-3 py-3" style={{color:"var(--text-muted)"}}>발주처 및 담당자</th>
                      <th className="min-w-[120px] px-3 py-3" style={{color:"var(--text-muted)"}}>주소</th>
                      <th className="min-w-[100px] px-3 py-3" style={{color:"var(--text-muted)"}}>비고</th>
                      <th className="w-[90px] px-3 py-3 text-center" style={{color:"var(--text-muted)"}}>단계</th>
                      <th className="w-[80px] px-3 py-3 text-center" style={{color:"var(--text-muted)"}}>작업</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((site, idx) => {
                      const isFailed    = site.status === 'FAILED';
                      const isConfirmed = site.status === 'SALES_CONFIRMED';
                      const isSaving    = saving === site.id;
                      return (
                        <tr
                          key={site.id}
                          className={`transition ${isFailed ? 'opacity-50' : isConfirmed ? '' : ''} ${isSaving ? 'opacity-60 pointer-events-none' : ''}`}
                          style={{borderBottom:"1px solid var(--border-subtle)", backgroundColor: isConfirmed ? 'var(--success-bg)' : 'transparent'}}
                        >
                          <td className="px-3 py-2 text-center text-gray-500 text-xs">{idx + 1}</td>

                          <td className="px-3 py-2 font-medium">
                            <EditableCell value={site.name || ''} onSave={v => saveField(site.id, 'name', v)} />
                            {site.client?.name && <span className="block text-[11px] text-gray-500 mt-0.5 px-1">{site.client.name}</span>}
                            {site.estimatedAmount && <span className="block text-[11px] text-blue-400 px-1">{fmtMoney(site.estimatedAmount)}원</span>}
                          </td>

                          <td className="px-3 py-2">
                            <EditableCell value={site.designOffice || ''} onSave={v => saveField(site.id, 'designOffice', v)} />
                          </td>

                          <td className="px-3 py-2">
                            <EditableCell value={site.salesPm || ''} onSave={v => saveField(site.id, 'salesPm', v)} />
                          </td>

                          <td className="px-3 py-2">
                            <EditableCell value={site.materialSpec || ''} onSave={v => saveField(site.id, 'materialSpec', v)} />
                          </td>

                          <td className="px-3 py-2 text-center">
                            <EditableCell value={site.sectorType || ''} onSave={v => saveField(site.id, 'sectorType', v)} type="select" options={SECTOR_OPTIONS} />
                          </td>

                          <td className="px-3 py-2">
                            <EditableCell value={site.salesOwner || ''} onSave={v => saveField(site.id, 'salesOwner', v)} />
                          </td>

                          <td className="px-3 py-2">
                            <EditableCell value={site.clientContact || ''} onSave={v => saveField(site.id, 'clientContact', v)} />
                          </td>

                          <td className="px-3 py-2">
                            <EditableCell value={site.address || ''} onSave={v => saveField(site.id, 'address', v)} />
                          </td>

                          <td className="px-3 py-2">
                            <EditableCell value={site.salesNote || ''} onSave={v => saveField(site.id, 'salesNote', v)} />
                          </td>

                          <td className="px-3 py-2 text-center">
                            <select
                              className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold bg-transparent cursor-pointer ${STAGE_COLOR[site.salesStage] || 'text-gray-400 border-gray-700'}`}
                              value={site.salesStage || ''}
                              onChange={e => saveField(site.id, 'salesStage', e.target.value)}
                            >
                              <option value="">-</option>
                              {STAGE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                          </td>

                          <td className="px-3 py-2">
                            <div className="flex items-center justify-center gap-1">
                              {canConvert && isConfirmed && (
                                <button title="현장 전환" className="btn btn-success btn-xs gap-0.5" onClick={() => handleConvert(site)}>
                                  <ArrowRightIcon className="h-3 w-3" />전환
                                </button>
                              )}
                              {canDelete && (
                                <button
                                  title="삭제"
                                  className="btn btn-ghost btn-xs text-red-500 hover:bg-red-900/20"
                                  onClick={() => handleDelete(site)}
                                  disabled={deletingId === site.id}
                                >
                                  {deletingId === site.id
                                    ? <span className="loading loading-spinner loading-xs" />
                                    : <TrashIcon className="h-3.5 w-3.5" />}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {filtered.length > 0 && (
              <p className="text-[11px] text-gray-600 text-center">
                셀 클릭 → 즉시 수정 · 단계 드롭다운 → 즉시 반영
              </p>
            )}
          </>
        ) : (
          /* ── 영업실적 탭 ─────────────────────────────────────────────────── */
          <PerformanceTab performance={performance} sites={sites} />
        )}

        {/* 등록 모달 */}
        {showCreateModal && (
          <CreateSalesModal
            onClose={() => setShowCreateModal(false)}
            onCreated={() => { setShowCreateModal(false); mutate(); }}
          />
        )}
      </div>
    </>
  );
};

// ── 영업실적 탭 ───────────────────────────────────────────────────────────────
const PerformanceTab = ({ performance, sites }: { performance: any[]; sites: any[] }) => {
  const [selected, setSelected] = useState<string | null>(null);

  // 선택된 담당자의 현장 목록
  const selectedSites = useMemo(() => {
    if (!selected) return [];
    return sites.filter(s => (s.salesOwner?.trim() || '미지정') === selected);
  }, [selected, sites]);

  const totalAll = performance.reduce((s, p) => s + p.total, 0);
  const totalConfirmed = performance.reduce((s, p) => s + p.confirmed, 0);
  const totalAmount = performance.reduce((s, p) => s + p.totalAmount, 0);
  const totalConfirmedAmount = performance.reduce((s, p) => s + p.confirmedAmount, 0);

  const fmtMoney = (v: number) => {
    if (!v) return '-';
    if (v >= 100000000) return `${(v / 100000000).toFixed(1)}억`;
    return `${Math.round(v / 10000).toLocaleString()}만`;
  };

  return (
    <div className="space-y-4">
      {/* 전체 합산 요약 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: '총 영업현장', value: `${totalAll}건`, color: 'text-white' },
          { label: '수주확정', value: `${totalConfirmed}건`, color: 'text-green-400' },
          { label: '예상 총금액', value: fmtMoney(totalAmount), color: 'text-blue-400' },
          { label: '확정 금액', value: fmtMoney(totalConfirmedAmount), color: 'text-green-400' },
        ].map(c => (
          <div key={c.label} className="rounded-xl p-3 text-center" style={{border:"1px solid var(--border-base)",backgroundColor:"var(--bg-card)"}}>
            <p className={`text-xl font-bold ${c.color}`}>{c.value}</p>
            <p className="text-[11px] mt-0.5" style={{color:"var(--text-muted)"}}>{c.label}</p>
          </div>
        ))}
      </div>

      {/* 개인별 실적 테이블 */}
      <div className="rounded-xl overflow-hidden" style={{border:"1px solid var(--border-base)"}}>
        <div className="px-4 py-3 flex items-center gap-2" style={{backgroundColor:"var(--bg-hover)",borderBottom:"1px solid var(--border-base)"}}>
          <UserIcon className="h-4 w-4 text-gray-400" />
          <h3 className="text-sm font-semibold">담당자별 영업실적</h3>
          <span className="text-xs" style={{color:"var(--text-muted)"}}>— 이름 클릭 시 해당 현장 목록 확인</span>
        </div>
        {performance.length === 0 ? (
          <div className="py-10 text-center text-sm" style={{color:"var(--text-muted)"}}>영업담당자가 지정된 현장이 없습니다.</div>
        ) : (
          <table className="table table-sm w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-xs text-gray-400 bg-gray-900/40">
                <th className="px-4 py-3 text-left">영업담당</th>
                <th className="px-4 py-3 text-center">총 현장</th>
                <th className="px-4 py-3 text-center">영업접촉</th>
                <th className="px-4 py-3 text-center">제안</th>
                <th className="px-4 py-3 text-center">협의중</th>
                <th className="px-4 py-3 text-center">수주확정</th>
                <th className="px-4 py-3 text-center">실패</th>
                <th className="px-4 py-3 text-right">예상금액 합계</th>
                <th className="px-4 py-3 text-right">확정금액 합계</th>
                <th className="px-4 py-3 text-center">수주율</th>
              </tr>
            </thead>
            <tbody>
              {performance.map(p => {
                const winRate = p.total > 0 ? Math.round((p.confirmed / p.total) * 100) : 0;
                const isSelected = selected === p.name;
                return (
                  <tr
                    key={p.name}
                    onClick={() => setSelected(isSelected ? null : p.name)}
                    className={`border-b border-gray-800/50 cursor-pointer transition ${isSelected ? 'bg-blue-950/20 border-blue-800/30' : 'hover:bg-gray-800/20'}`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full flex-shrink-0 ${p.name === '미지정' ? 'bg-gray-600' : 'bg-blue-400'}`} />
                        <span className={`font-medium ${p.name === '미지정' ? 'text-gray-500' : 'text-white'}`}>
                          {p.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center font-semibold">{p.total}</td>
                    <td className="px-4 py-3 text-center text-gray-400">{p.stages['영업접촉'] || 0}</td>
                    <td className="px-4 py-3 text-center text-orange-400">{p.stages['제안'] || 0}</td>
                    <td className="px-4 py-3 text-center text-yellow-400">{p.stages['협의중'] || 0}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`font-bold ${p.confirmed > 0 ? 'text-green-400' : 'text-gray-500'}`}>
                        {p.confirmed}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-red-400">{p.failed}</td>
                    <td className="px-4 py-3 text-right text-blue-300">{fmtMoney(p.totalAmount)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={p.confirmedAmount > 0 ? 'text-green-400 font-medium' : 'text-gray-600'}>
                        {fmtMoney(p.confirmedAmount)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <div className="w-12 h-1.5 rounded-full bg-gray-800 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-green-500 transition-all"
                            style={{ width: `${winRate}%` }}
                          />
                        </div>
                        <span className={`text-xs font-medium ${winRate >= 30 ? 'text-green-400' : winRate > 0 ? 'text-yellow-400' : 'text-gray-600'}`}>
                          {winRate}%
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {/* 합계 행 */}
              <tr className="border-t-2 border-gray-700 bg-gray-900/40 font-semibold">
                <td className="px-4 py-3 text-gray-300">합계</td>
                <td className="px-4 py-3 text-center">{totalAll}</td>
                <td className="px-4 py-3 text-center text-gray-400">
                  {performance.reduce((s, p) => s + (p.stages['영업접촉'] || 0), 0)}
                </td>
                <td className="px-4 py-3 text-center text-orange-400">
                  {performance.reduce((s, p) => s + (p.stages['제안'] || 0), 0)}
                </td>
                <td className="px-4 py-3 text-center text-yellow-400">
                  {performance.reduce((s, p) => s + (p.stages['협의중'] || 0), 0)}
                </td>
                <td className="px-4 py-3 text-center text-green-400">{totalConfirmed}</td>
                <td className="px-4 py-3 text-center text-red-400">
                  {performance.reduce((s, p) => s + p.failed, 0)}
                </td>
                <td className="px-4 py-3 text-right text-blue-300">{fmtMoney(totalAmount)}</td>
                <td className="px-4 py-3 text-right text-green-400">{fmtMoney(totalConfirmedAmount)}</td>
                <td className="px-4 py-3 text-center text-xs" style={{color:"var(--text-muted)"}}>
                  {totalAll > 0 ? `${Math.round((totalConfirmed / totalAll) * 100)}%` : '-'}
                </td>
              </tr>
            </tbody>
          </table>
        )}
      </div>

      {/* 선택된 담당자의 현장 목록 */}
      {selected && selectedSites.length > 0 && (
        <div className="rounded-xl border border-blue-800/30 bg-blue-950/5 overflow-hidden">
          <div className="px-4 py-3 border-b border-blue-800/30 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-blue-400" />
              <h4 className="text-sm font-semibold">{selected} — 담당 현장 {selectedSites.length}건</h4>
            </div>
            <button className="btn btn-ghost btn-xs" onClick={() => setSelected(null)}>닫기</button>
          </div>
          <table className="table table-sm w-full text-sm">
            <thead>
              <tr className="border-b border-blue-800/20 text-xs text-gray-400">
                <th className="px-4 py-2">PJ명</th>
                <th className="px-4 py-2">설계사무소</th>
                <th className="px-4 py-2">자재규모 및 사양</th>
                <th className="px-4 py-2 text-center">구분</th>
                <th className="px-4 py-2 text-center">단계</th>
                <th className="px-4 py-2 text-right">예상금액</th>
              </tr>
            </thead>
            <tbody>
              {selectedSites.map(s => (
                <tr key={s.id} className="border-b border-blue-900/20 hover:bg-blue-900/10 transition">
                  <td className="px-4 py-2 font-medium">
                    {s.name}
                    {s.client?.name && <div className="text-[11px]" style={{color:"var(--text-muted)"}}>{s.client.name}</div>}
                  </td>
                  <td className="px-4 py-2 text-gray-400">{s.designOffice || '-'}</td>
                  <td className="px-4 py-2 text-gray-400">{s.materialSpec || '-'}</td>
                  <td className="px-4 py-2 text-center">
                    <span className="text-xs text-gray-400">{s.sectorType || '-'}</span>
                  </td>
                  <td className="px-4 py-2 text-center">
                    {s.salesStage ? (
                      <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${STAGE_COLOR[s.salesStage] || 'text-gray-400 border-gray-700'}`}>
                        {s.salesStage}
                      </span>
                    ) : <span className="text-gray-600 text-xs">-</span>}
                  </td>
                  <td className="px-4 py-2 text-right text-blue-300 text-xs">
                    {s.estimatedAmount ? `${fmtMoney(s.estimatedAmount)}원` : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// ── 영업현장 등록 모달 ────────────────────────────────────────────────────────
const CreateSalesModal = ({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) => {
  const [form, setForm] = useState({
    name: '', clientName: '', designOffice: '', salesPm: '',
    materialSpec: '', sectorType: '', salesOwner: '',
    clientContact: '', address: '', salesNote: '',
    salesStage: '영업접촉', estimatedAmount: '', siteType: '납품설치도',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.name.trim()) { setError('PJ명(현장명)은 필수입니다.'); return; }
    setSaving(true); setError('');
    try {
      const res = await fetch('/api/sites', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, status: 'SALES_PIPELINE', estimatedAmount: form.estimatedAmount ? Number(form.estimatedAmount.replace(/,/g, '')) : null }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || '등록 실패');
      onCreated();
    } catch (e: any) { setError(e.message); setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{background:"rgba(0,0,0,0.4)"}} onClick={onClose}>
      <div className="w-full max-w-2xl rounded-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto" style={{border:"1px solid var(--border-base)",backgroundColor:"var(--bg-elevated)",boxShadow:"var(--shadow-elevated)"}} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold">영업현장 등록</h3>
          <button className="btn btn-ghost btn-sm btn-circle" onClick={onClose}><XMarkIcon className="h-5 w-5" /></button>
        </div>
        {error && <p className="text-sm text-red-400 bg-red-950/30 rounded-lg px-3 py-2">{error}</p>}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="block text-xs mb-1" style={{color:"var(--text-muted)"}}>PJ명 (사업명) *</label>
            <input className="input input-bordered input-sm w-full" placeholder="예) ○○초등학교 그린리모델링 공사" value={form.name} onChange={e => set('name', e.target.value)} />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{color:"var(--text-muted)"}}>발주처</label>
            <input className="input input-bordered input-sm w-full" value={form.clientName} onChange={e => set('clientName', e.target.value)} />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{color:"var(--text-muted)"}}>발주처 담당자</label>
            <input className="input input-bordered input-sm w-full" placeholder="담당자명 / 연락처" value={form.clientContact} onChange={e => set('clientContact', e.target.value)} />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{color:"var(--text-muted)"}}>설계사무소</label>
            <input className="input input-bordered input-sm w-full" value={form.designOffice} onChange={e => set('designOffice', e.target.value)} />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{color:"var(--text-muted)"}}>담당PM</label>
            <input className="input input-bordered input-sm w-full" value={form.salesPm} onChange={e => set('salesPm', e.target.value)} />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{color:"var(--text-muted)"}}>자재규모 및 사양</label>
            <input className="input input-bordered input-sm w-full" placeholder="예) MS-G01-01 / 2,820㎡" value={form.materialSpec} onChange={e => set('materialSpec', e.target.value)} />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{color:"var(--text-muted)"}}>구분</label>
            <select className="select select-bordered select-sm w-full" value={form.sectorType} onChange={e => set('sectorType', e.target.value)}>
              <option value="">선택</option>
              {SECTOR_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs mb-1" style={{color:"var(--text-muted)"}}>영업담당</label>
            <input className="input input-bordered input-sm w-full" value={form.salesOwner} onChange={e => set('salesOwner', e.target.value)} />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{color:"var(--text-muted)"}}>영업 단계</label>
            <select className="select select-bordered select-sm w-full" value={form.salesStage} onChange={e => set('salesStage', e.target.value)}>
              {STAGE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs mb-1" style={{color:"var(--text-muted)"}}>예상 계약금액 (원)</label>
            <input className="input input-bordered input-sm w-full" placeholder="예) 27000000" value={form.estimatedAmount} onChange={e => set('estimatedAmount', e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs mb-1" style={{color:"var(--text-muted)"}}>주소</label>
            <input className="input input-bordered input-sm w-full" value={form.address} onChange={e => set('address', e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs mb-1" style={{color:"var(--text-muted)"}}>비고</label>
            <textarea className="textarea textarea-bordered w-full text-sm" rows={2} placeholder="영업 메모, 특이사항..." value={form.salesNote} onChange={e => set('salesNote', e.target.value)} />
          </div>
        </div>
        <div className="flex gap-2 justify-end pt-3" style={{borderTop:"1px solid var(--border-base)"}}>
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
