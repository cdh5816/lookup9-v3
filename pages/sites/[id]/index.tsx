/* eslint-disable i18next/no-literal-string */
import { GetServerSidePropsContext } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useState, useCallback, useEffect, useMemo } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import useSWR from 'swr';
import fetcher from '@/lib/fetcher';
import {
  PlusIcon, TrashIcon, MagnifyingGlassIcon, ArrowDownTrayIcon,
  CheckCircleIcon, ClockIcon, ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import ProductionProgressPanel from '@/components/sites/ProductionProgressPanel';

// ── 유틸 ──────────────────────────────────────────────
const fmtNum = (v: any) => {
  if (v === null || v === undefined || v === '') return '-';
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString('ko-KR') : String(v);
};
const fmtDate = (v: any) => {
  if (!v) return '-';
  const d = new Date(v);
  return isNaN(d.getTime()) ? String(v) : d.toLocaleDateString('ko-KR');
};
const fmtMoney = (v: any) => {
  if (!v) return '-';
  const n = Number(v);
  if (!Number.isFinite(n)) return '-';
  if (n >= 100000000) return `${(n / 100000000).toFixed(1)}억원`;
  return `${Math.round(n / 10000).toLocaleString()}만원`;
};
const getDday = (deadline: any) => {
  if (!deadline) return null;
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const d = new Date(deadline); d.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - now.getTime()) / 86400000);
  if (diff < 0) return { label: `D+${Math.abs(diff)}`, cls: 'text-red-400 bg-red-900/30 border-red-700/60' };
  if (diff === 0) return { label: 'D-Day', cls: 'text-orange-400 bg-orange-900/30 border-orange-700/60' };
  if (diff <= 14) return { label: `D-${diff}`, cls: 'text-yellow-400 bg-yellow-900/20 border-yellow-700/40' };
  return { label: `D-${diff}`, cls: 'text-gray-500 bg-gray-800/30 border-gray-700/40' };
};

// ── 탭 정의 (이슈/변경/이력 제거, 댓글→타임라인) ──
const ALL_TABS = ['overview', 'production', 'painting', 'shipping', 'settlement', 'documents', 'requests', 'timeline'];
const TAB_LABELS: Record<string, string> = {
  overview: '개요', production: '생산', painting: '도장',
  shipping: '출하', settlement: '실정/정산', documents: '서류',
  requests: '요청', timeline: '업무일지',
};
const HIDDEN_BY_SITE_TYPE: Record<string, string[]> = {
  '납품하차도': ['painting'],
};
const HIDDEN_BY_ROLE: Record<string, string[]> = {
  PARTNER: ['settlement'],
  GUEST: ['production', 'painting', 'shipping', 'settlement', 'requests'],
};

// ── 메인 ──────────────────────────────────────────────
export default function SiteDetail() {
  const router = useRouter();
  const { id, print: printMode } = router.query;
  const [activeTab, setActiveTab] = useState('overview');

  const { data, mutate } = useSWR(id ? `/api/sites/${id}` : null, fetcher, { refreshInterval: 30000 });
  const site = data?.data;
  const { data: profileData } = useSWR('/api/my/profile', fetcher);
  const userRole = profileData?.data?.role || 'USER';
  const permissions = profileData?.data?.permissions || {};

  const hiddenByRole = HIDDEN_BY_ROLE[userRole] || [];
  const hiddenBySiteType = site ? (HIDDEN_BY_SITE_TYPE[site.siteType || '납품설치도'] || []) : [];
  const hiddenByDept = ['SUPER_ADMIN', 'OWNER', 'ADMIN_HR', 'ADMIN', 'MANAGER'].includes(userRole)
    ? []
    : [
        ...(!permissions.canViewContract ? ['settlement'] : []),
      ];
  const hiddenAll = new Set([...hiddenByRole, ...hiddenBySiteType, ...hiddenByDept]);
  const tabs = ALL_TABS.filter(t => !hiddenAll.has(t));

  const canManage = ['SUPER_ADMIN', 'OWNER', 'ADMIN_HR', 'ADMIN', 'MANAGER', 'USER', 'PARTNER'].includes(userRole);
  const canDelete = ['SUPER_ADMIN', 'OWNER', 'ADMIN_HR', 'ADMIN'].includes(userRole);

  useEffect(() => {
    if (router.query.tab && ALL_TABS.includes(router.query.tab as string)) {
      setActiveTab(router.query.tab as string);
    }
  }, [router.query.tab]);

  const handleDeleteSite = async () => {
    if (!confirm('현장을 삭제합니다. 되돌릴 수 없습니다.')) return;
    await fetch(`/api/sites/${id}`, { method: 'DELETE' });
    router.push('/sites');
  };

  if (!site) return (
    <div className="flex items-center justify-center py-20">
      <span className="loading loading-spinner loading-lg text-gray-400" />
    </div>
  );

  // ── 보고서 인쇄 모드 ──
  if (printMode === '1') {
    return <SiteReportPrint site={site} />;
  }

  return (
    <>
      <Head><title>{site.name} | LOOKUP9</title></Head>
      <div className="space-y-0">

        {/* ── 헤더 카드 ── */}
        <SiteHeader site={site} canDelete={canDelete} onDelete={handleDeleteSite} onTabChange={setActiveTab} />

        {/* ── 탭 바 ── */}
        <div className="sticky top-0 z-10 bg-gray-950/95 backdrop-blur border-b border-gray-800">
          <div className="flex overflow-x-auto scrollbar-hide">
            {tabs.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`shrink-0 px-4 py-3 text-xs font-semibold border-b-2 transition-all whitespace-nowrap ${
                  activeTab === tab
                    ? 'border-blue-500 text-blue-400 bg-blue-950/20'
                    : 'border-transparent text-gray-500 hover:text-gray-300 hover:bg-gray-800/30'
                }`}
              >
                {TAB_LABELS[tab]}
              </button>
            ))}
          </div>
        </div>

        {/* ── 탭 콘텐츠 ── */}
        <div className="pt-4 space-y-4">
          {activeTab === 'overview'    && <OverviewTab    site={site} siteId={id as string} canManage={canManage} onMutate={mutate} />}
          {activeTab === 'production'  && <ProductionProgressPanel site={site} canManage={canManage} onMutate={mutate} />}
          {activeTab === 'painting'    && <PaintTab    siteId={id as string} specs={site.paintSpecs || []} canManage={canManage} onMutate={mutate} />}
          {activeTab === 'shipping'    && <ShippingTab siteId={id as string} shipments={site.shipments || []} canManage={canManage} onMutate={mutate} />}
          {activeTab === 'settlement'  && <SettlementTab siteId={id as string} canManage={canManage} onMutate={mutate} />}
          {activeTab === 'documents'   && <DocumentTab siteId={id as string} canManage={canManage} />}
          {activeTab === 'requests'    && <RequestTab  siteId={id as string} requests={site.requests || []} canManage={canManage} onMutate={mutate} />}
          {activeTab === 'timeline'    && <TimelineTab siteId={id as string} canManage={canManage} />}
        </div>
      </div>
    </>
  );
}

// ══════════════════════════════════════════════════════
// 헤더 카드
// ══════════════════════════════════════════════════════
const STATUS_COLOR: Record<string, string> = {
  진행중: 'text-green-400', 계약완료: 'text-yellow-400',
  완료: 'text-blue-400', 영업중: 'text-orange-400', 보류: 'text-gray-500',
};

function SiteHeader({ site, canDelete, onDelete, onTabChange }: any) {
  const dday = getDday(site.deliveryDeadline);
  const contract = site.contracts?.find((c: any) => !c.isAdditional);
  const contractAmt = contract?.contractAmount ?? site.contractAmount;
  const contractQty = contract?.quantity ?? site.contractQuantity;

  // 공정률: 출하 합계 / 계약물량
  const shippedQty = (site.shipments || []).reduce((s: number, r: any) => s + Number(r.quantity ?? 0), 0);
  const progressRate = contractQty > 0 ? Math.min(100, Math.round((shippedQty / Number(contractQty)) * 100)) : 0;

  // 진행중 실정보고 건수 & 금액
  const activeSettlements = (site.changeLogs || []).filter((c: any) =>
    ['고소작업차', '물량증가', '설계변경', '추가공사', '기타'].includes(c.type) &&
    !['정산완료', '반려'].includes(c.status || '')
  );
  const settlementTotal = activeSettlements.reduce((s: number, c: any) => {
    const n = Number((c.impact || '').replace(/[^0-9]/g, ''));
    return s + (isNaN(n) ? 0 : n);
  }, 0);

  return (
    <div className="rounded-xl border border-gray-800 bg-gradient-to-b from-gray-900/80 to-black/60 p-5 space-y-4 mb-0">
      {/* 현장명 + 상태 */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className={`text-xs font-bold ${STATUS_COLOR[site.status] || 'text-gray-400'}`}>● {site.status}</span>
            <span className={`text-[11px] px-2 py-0.5 rounded font-semibold ${site.siteType === '납품하차도' ? 'bg-purple-900/40 text-purple-300' : 'bg-blue-900/40 text-blue-300'}`}>
              {site.siteType || '납품설치도'}
            </span>
            {dday && (
              <span className={`text-[11px] px-2 py-0.5 rounded-full border font-bold ${dday.cls}`}>
                납기 {dday.label}
              </span>
            )}
          </div>
          <h2 className="text-xl font-bold leading-tight text-white">{site.name}</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {[site.client?.name, site.address].filter(Boolean).join(' · ') || ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="btn btn-ghost btn-xs gap-1 border border-gray-700 text-gray-400 hover:text-white"
            onClick={() => {
              const printUrl = `/sites/${site.id}?print=1`;
              window.open(printUrl, '_blank');
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            보고서
          </button>
          {canDelete && (
            <button className="btn btn-error btn-xs opacity-60 hover:opacity-100" onClick={onDelete}>삭제</button>
          )}
        </div>
      </div>

      {/* 핵심 지표 4칸 */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: '계약금액', value: fmtMoney(contractAmt), accent: 'text-green-400' },
          { label: '계약물량', value: contractQty ? `${fmtNum(contractQty)} ㎡` : '-', accent: 'text-white' },
          { label: '납품기한', value: fmtDate(site.deliveryDeadline), accent: dday?.cls.includes('red') ? 'text-red-400' : dday?.cls.includes('yellow') ? 'text-yellow-400' : 'text-white' },
          { label: '규격/사양', value: site.specification || (contract?.specification) || '-', accent: 'text-gray-300' },
        ].map(item => (
          <div key={item.label} className="rounded-lg bg-gray-800/40 border border-gray-800 px-3 py-2.5">
            <p className="text-[10px] text-gray-500 mb-1">{item.label}</p>
            <p className={`text-sm font-bold truncate ${item.accent}`}>{item.value}</p>
          </div>
        ))}
      </div>

      {/* 공정률 바 - 스타일리시 */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">출하 공정률</span>
            {site.startDocsDone && (
              <span className="flex items-center gap-1 text-[10px] text-green-500">
                <CheckCircleIcon className="w-3 h-3" />착수계
              </span>
            )}
            {site.completionDocsDone && (
              <span className="flex items-center gap-1 text-[10px] text-blue-400">
                <CheckCircleIcon className="w-3 h-3" />준공계
              </span>
            )}
          </div>
          <span className={`text-lg font-extrabold tabular-nums ${
            progressRate >= 100 ? 'text-blue-400' : progressRate >= 60 ? 'text-green-400' : progressRate >= 30 ? 'text-yellow-400' : 'text-gray-400'
          }`}>{progressRate}%</span>
        </div>
        <div className="relative h-3 w-full overflow-hidden rounded-full bg-gray-800/80">
          {/* 세그먼트 효과 */}
          <div
            className={`h-full rounded-full transition-all duration-700 ease-out ${
              progressRate >= 100 ? 'bg-gradient-to-r from-blue-600 to-blue-400' :
              progressRate >= 60 ? 'bg-gradient-to-r from-green-700 to-green-400' :
              progressRate >= 30 ? 'bg-gradient-to-r from-yellow-700 to-yellow-400' :
              'bg-gradient-to-r from-gray-700 to-gray-500'
            }`}
            style={{ width: `${progressRate}%` }}
          />
          {/* 마커: 25%, 50%, 75% */}
          {[25, 50, 75].map(pct => (
            <div key={pct} className="absolute top-0 h-full w-px bg-gray-700/60" style={{ left: `${pct}%` }} />
          ))}
        </div>
        <div className="flex justify-between text-[10px] text-gray-700">
          <span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span>
        </div>
      </div>

      {/* 실정보고 진행중 요약 (있을 때만) */}
      {activeSettlements.length > 0 && (
        <button
          onClick={() => onTabChange('settlement')}
          className="w-full rounded-lg border border-orange-800/50 bg-orange-950/20 px-3 py-2 flex items-center justify-between hover:bg-orange-950/30 transition-colors"
        >
          <div className="flex items-center gap-2">
            <ExclamationTriangleIcon className="w-4 h-4 text-orange-400" />
            <span className="text-xs text-orange-300 font-medium">
              실정보고 {activeSettlements.length}건 진행중
            </span>
          </div>
          <span className="text-xs text-orange-400 font-bold">
            {settlementTotal > 0 ? `${fmtMoney(settlementTotal)} 예정` : '확인 필요 →'}
          </span>
        </button>
      )}

      {/* 배정 인원 미니 */}
      {(site.assignments || []).length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {site.assignments.slice(0, 5).map((a: any) => (
            <span key={a.id} className="rounded-full bg-gray-800 border border-gray-700 px-2.5 py-0.5 text-[11px] text-gray-300">
              {a.user.position ? `${a.user.position} ` : ''}{a.user.name}
            </span>
          ))}
          {site.assignments.length > 5 && (
            <span className="rounded-full bg-gray-800 border border-gray-700 px-2.5 py-0.5 text-[11px] text-gray-500">
              +{site.assignments.length - 5}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════
// 개요 탭
// ══════════════════════════════════════════════════════
const siteStatuses = [
  { value: 'SALES_PIPELINE', label: '영업중' },
  { value: 'SALES_CONFIRMED', label: '수주확정' },
  { value: 'CONTRACT_ACTIVE', label: '진행중' },
  { value: 'COMPLETED', label: '준공완료' },
  { value: 'WARRANTY', label: '하자기간' },
  { value: 'FAILED', label: '영업실패' },
];
const siteTypes = ['납품설치도', '납품하차도'];

function OverviewTab({ site, siteId, canManage, onMutate }: any) {
  const [editing, setEditing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [form, setForm] = useState({
    status: site.status || '',
    siteType: site.siteType || '납품설치도',
    salesStage: site.salesStage || '',
    description: site.description || '',
    deliveryDeadline: site.deliveryDeadline ? site.deliveryDeadline.split('T')[0] : '',
    contractAmount: site.contractAmount ? String(Number(site.contractAmount)) : '',
    startDocsDone: site.startDocsDone || false,
    completionDocsDone: site.completionDocsDone || false,
    changeReason: '',
  });
  const [saving, setSaving] = useState(false);

  // 납기일/금액 변경 이력
  const changeHistory = (site.changeLogs || []).filter((c: any) =>
    ['납기일변경', '계약금액변경', '물량변경'].includes(c.type)
  );

  // 진행중 실정보고
  const activeSettlements = (site.changeLogs || []).filter((c: any) =>
    ['고소작업차', '물량증가', '설계변경', '추가공사', '기타'].includes(c.type) &&
    !['정산완료', '반려'].includes(c.status || '')
  );

  const handleSave = async () => {
    setSaving(true);
    await fetch(`/api/sites/${siteId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        contractAmount: form.contractAmount ? Number(form.contractAmount.replace(/,/g, '')) : null,
        deliveryDeadline: form.deliveryDeadline || null,
      }),
    });
    setSaving(false); setEditing(false); onMutate();
  };

  const contract = site.contracts?.find((c: any) => !c.isAdditional);

  return (
    <div className="space-y-3">
      {/* 계약 정보 카드 */}
      <div className="rounded-xl border border-gray-800 bg-black/20 p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">계약 정보</p>
          <div className="flex gap-2">
            {changeHistory.length > 0 && (
              <button className="text-xs text-blue-400 hover:text-blue-300" onClick={() => setShowHistory(!showHistory)}>
                변경이력 {changeHistory.length}건
              </button>
            )}
            {canManage && !editing && (
              <button className="btn btn-ghost btn-xs" onClick={() => setEditing(true)}>수정</button>
            )}
          </div>
        </div>

        {/* 변경 이력 드롭다운 */}
        {showHistory && changeHistory.length > 0 && (
          <div className="mb-3 rounded-lg bg-gray-900/50 border border-gray-700 p-3 space-y-2">
            {changeHistory.map((c: any) => (
              <div key={c.id} className="flex items-start justify-between text-xs gap-2">
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] bg-gray-800 px-1.5 py-0.5 rounded text-gray-400 mr-1">{c.type}</span>
                  <span className="text-gray-500">{c.beforeValue}</span>
                  <span className="text-gray-600 mx-1">→</span>
                  <span className="text-gray-200 font-medium">{c.afterValue}</span>
                  {c.reason && <p className="text-gray-600 mt-0.5 truncate">{c.reason}</p>}
                </div>
                <div className="text-right shrink-0 text-gray-600">
                  <p>{c.requester?.name}</p>
                  <p>{fmtDate(c.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {editing ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] text-gray-500 mb-1">계약금액 (원)</label>
                <input className="input input-bordered input-sm w-full"
                  placeholder="50,000,000"
                  value={form.contractAmount ? Number(form.contractAmount.replace(/,/g, '')).toLocaleString() : ''}
                  onChange={e => setForm({ ...form, contractAmount: e.target.value.replace(/,/g, '') })} />
              </div>
              <div>
                <label className="block text-[10px] text-gray-500 mb-1">납품기한</label>
                <input type="date" className="input input-bordered input-sm w-full"
                  value={form.deliveryDeadline}
                  onChange={e => setForm({ ...form, deliveryDeadline: e.target.value })} />
              </div>
              <div>
                <label className="block text-[10px] text-gray-500 mb-1">현장 상태</label>
                <select className="select select-bordered select-sm w-full" value={form.status}
                  onChange={e => setForm({ ...form, status: e.target.value })}>
                  {siteStatuses.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-gray-500 mb-1">납품유형</label>
                <select className="select select-bordered select-sm w-full" value={form.siteType}
                  onChange={e => setForm({ ...form, siteType: e.target.value })}>
                  {siteTypes.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-[10px] text-gray-500 mb-1">변경 사유 (납기일 연장 등)</label>
              <input className="input input-bordered input-sm w-full" placeholder="사유 입력"
                value={form.changeReason} onChange={e => setForm({ ...form, changeReason: e.target.value })} />
            </div>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input type="checkbox" className="checkbox checkbox-xs" checked={form.startDocsDone}
                  onChange={e => setForm({ ...form, startDocsDone: e.target.checked })} />
                착수계 제출
              </label>
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input type="checkbox" className="checkbox checkbox-xs" checked={form.completionDocsDone}
                  onChange={e => setForm({ ...form, completionDocsDone: e.target.checked })} />
                준공계 제출
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <button className="btn btn-ghost btn-xs" onClick={() => setEditing(false)}>취소</button>
              <button className={`btn btn-primary btn-xs ${saving ? 'loading' : ''}`} disabled={saving} onClick={handleSave}>저장</button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {/* 핵심 계약 정보 2열 그리드 */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              {[
                { label: '계약금액', value: <span className="text-green-400 font-bold">{fmtMoney(site.contractAmount)}</span> },
                { label: '납품기한', value: site.deliveryDeadline ? fmtDate(site.deliveryDeadline) : '-' },
                { label: '계약물량 (합계)', value: site.contractQuantity ? `${fmtNum(site.contractQuantity)} ㎡` : '-' },
                { label: '납품요구번호', value: site.contractNo || '-' },
                { label: '하자기간', value: site.warrantyPeriod ? `${site.warrantyPeriod}년` : '-' },
                { label: '검사기관', value: site.inspectionAgency || '-' },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-[10px] text-gray-600 mb-0.5">{label}</p>
                  <p className="text-gray-200 font-medium truncate">{value as any}</p>
                </div>
              ))}
            </div>

            {/* 품목 상세 테이블 — 복수 품목이 있을 때 */}
            {(() => {
              const items: any[] = Array.isArray(site.productItems) && site.productItems.length > 0
                ? site.productItems
                : (site.productName || site.specification)
                  ? [{ seq: '1', productName: site.productName, spec: site.specification, unit: '㎡', unitPrice: site.unitPrice, contractQuantity: site.contractQuantity, amount: site.contractAmount }]
                  : [];
              if (items.length === 0) return null;
              return (
                <div className="rounded-lg overflow-hidden border border-gray-700/60">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-800/60 text-[10px] text-gray-400 uppercase tracking-wider">
                      <tr>
                        <th className="px-2.5 py-2 text-left w-8">순</th>
                        <th className="px-2.5 py-2 text-left">품명</th>
                        <th className="px-2.5 py-2 text-left hidden sm:table-cell">규격/사양</th>
                        <th className="px-2.5 py-2 text-right">단가</th>
                        <th className="px-2.5 py-2 text-right">물량(㎡)</th>
                        <th className="px-2.5 py-2 text-right hidden sm:table-cell">금액</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item: any, idx: number) => (
                        <tr key={idx} className="border-t border-gray-700/30 hover:bg-gray-800/20">
                          <td className="px-2.5 py-2 text-gray-500">{item.seq || idx + 1}</td>
                          <td className="px-2.5 py-2 font-medium text-gray-200">{item.productName || '-'}</td>
                          <td className="px-2.5 py-2 text-gray-400 hidden sm:table-cell max-w-xs truncate">{item.spec || '-'}</td>
                          <td className="px-2.5 py-2 text-right text-gray-300">{item.unitPrice ? `${Number(item.unitPrice).toLocaleString()}` : '-'}</td>
                          <td className="px-2.5 py-2 text-right text-blue-300 font-semibold">{item.contractQuantity ? Number(item.contractQuantity).toLocaleString() : '-'}</td>
                          <td className="px-2.5 py-2 text-right text-green-400 hidden sm:table-cell">{item.amount ? `${Number(item.amount).toLocaleString()}` : '-'}</td>
                        </tr>
                      ))}
                      {items.length > 1 && (
                        <tr className="border-t border-gray-600/50 bg-gray-800/40 font-semibold">
                          <td className="px-2.5 py-2 text-gray-500 text-[10px]" colSpan={4}>합계</td>
                          <td className="px-2.5 py-2 text-right text-blue-200">
                            {items.reduce((s: number, i: any) => s + Number(i.contractQuantity || 0), 0).toLocaleString()} ㎡
                          </td>
                          <td className="px-2.5 py-2 text-right text-green-300 hidden sm:table-cell">
                            {items.reduce((s: number, i: any) => s + Number(i.amount || 0), 0).toLocaleString()}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              );
            })()}

            {/* 착수/준공계 */}
            <div className="flex gap-4 pt-1 border-t border-gray-800/60">
              <div className={`flex items-center gap-1.5 text-xs ${site.startDocsDone ? 'text-green-400' : 'text-gray-600'}`}>
                <div className={`w-2.5 h-2.5 rounded-full ${site.startDocsDone ? 'bg-green-500' : 'bg-gray-700'}`} />
                착수계 제출
              </div>
              <div className={`flex items-center gap-1.5 text-xs ${site.completionDocsDone ? 'text-blue-400' : 'text-gray-600'}`}>
                <div className={`w-2.5 h-2.5 rounded-full ${site.completionDocsDone ? 'bg-blue-500' : 'bg-gray-700'}`} />
                준공계 제출
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 실정보고 진행중 요약 */}
      {activeSettlements.length > 0 && (
        <div className="rounded-xl border border-orange-800/40 bg-orange-950/10 p-4">
          <p className="text-xs font-semibold text-orange-400 mb-2">
            ⚠ 진행중 실정보고 / 정산 ({activeSettlements.length}건)
          </p>
          <div className="space-y-2">
            {activeSettlements.slice(0, 3).map((c: any) => (
              <div key={c.id} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                    c.status === '수요처승인' ? 'bg-green-900/50 text-green-300' :
                    c.status === '공문발송' ? 'bg-blue-900/50 text-blue-300' :
                    'bg-gray-800 text-gray-400'
                  }`}>{c.status || '검토중'}</span>
                  <span className="text-gray-300">{c.type}</span>
                  {c.afterValue && <span className="text-gray-500 truncate max-w-[100px]">{c.afterValue}</span>}
                </div>
                {c.impact && <span className="text-orange-400 font-medium">{c.impact}</span>}
              </div>
            ))}
            {activeSettlements.length > 3 && (
              <p className="text-xs text-gray-600">+{activeSettlements.length - 3}건 더...</p>
            )}
          </div>
        </div>
      )}

      {/* 발주처 + 담당자 */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-gray-800 bg-black/20 p-4">
          <p className="text-[10px] text-gray-500 mb-2">발주처 / 담당자</p>
          <p className="text-sm font-medium text-gray-200">{site.client?.name || '-'}</p>
          {site.clientDept && <p className="text-xs text-gray-400 mt-1">{site.clientDept}</p>}
          {site.clientManager && (
            <p className="text-xs text-gray-400">{site.clientManager} {site.clientManagerPhone && `· ${site.clientManagerPhone}`}</p>
          )}
        </div>
        <div className="rounded-xl border border-gray-800 bg-black/20 p-4">
          <p className="text-[10px] text-gray-500 mb-2">현장 주소</p>
          <p className="text-sm font-medium text-gray-200">{site.address || '-'}</p>
          {site.salesStage && <p className="text-xs text-orange-400 mt-1">영업단계: {site.salesStage}</p>}
        </div>
      </div>

      {/* 메모 */}
      {site.description && (
        <div className="rounded-xl border border-gray-800 bg-black/20 p-4">
          <p className="text-[10px] text-gray-500 mb-1">현장 메모</p>
          <p className="text-sm whitespace-pre-wrap text-gray-300">{site.description}</p>
        </div>
      )}

      {/* 배정 인원 (관리 가능) */}
      <AssignmentPanel siteId={siteId} assignments={site.assignments} canManage={canManage} onMutate={onMutate} />

      {/* 시공업체 */}
      <ContractorPanel site={site} siteId={siteId} canManage={canManage} onMutate={onMutate} />
    </div>
  );
}

// ══════════════════════════════════════════════════════
// 도장 탭
// ══════════════════════════════════════════════════════
function PaintTab({ siteId, specs, canManage, onMutate }: any) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ colorCode: '', colorName: '', manufacturer: '', finishType: '', area: '', quantity: '', isPrimary: false });
  const [sub, setSub] = useState(false);
  const statuses = ['도료발주대기', '발주완료', '입고완료', '도장중', '검수완료'];

  const handleSubmit = async () => {
    if (!form.colorCode || !form.colorName) { alert('색상 코드와 색상명은 필수입니다.'); return; }
    setSub(true);
    await fetch(`/api/sites/${siteId}/paints`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    setForm({ colorCode: '', colorName: '', manufacturer: '', finishType: '', area: '', quantity: '', isPrimary: false });
    setShowForm(false); setSub(false); onMutate();
  };
  const handleStatus = async (specId: string, status: string) => {
    await fetch(`/api/sites/${siteId}/paints`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ specId, status }) });
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
            <div><label className="block text-xs text-gray-400 mb-1">컬러코드 *</label><input className="input input-bordered input-sm w-full" value={form.colorCode} onChange={e => setForm({ ...form, colorCode: e.target.value })} /></div>
            <div><label className="block text-xs text-gray-400 mb-1">컬러명 *</label><input className="input input-bordered input-sm w-full" value={form.colorName} onChange={e => setForm({ ...form, colorName: e.target.value })} /></div>
            <div><label className="block text-xs text-gray-400 mb-1">제조사</label><input className="input input-bordered input-sm w-full" value={form.manufacturer} onChange={e => setForm({ ...form, manufacturer: e.target.value })} /></div>
            <div><label className="block text-xs text-gray-400 mb-1">마감유형</label><input className="input input-bordered input-sm w-full" value={form.finishType} onChange={e => setForm({ ...form, finishType: e.target.value })} /></div>
            <div><label className="block text-xs text-gray-400 mb-1">적용면적</label><input className="input input-bordered input-sm w-full" value={form.area} onChange={e => setForm({ ...form, area: e.target.value })} /></div>
            <div><label className="block text-xs text-gray-400 mb-1">수량</label><input type="number" className="input input-bordered input-sm w-full" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} /></div>
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" className="checkbox checkbox-sm" checked={form.isPrimary} onChange={e => setForm({ ...form, isPrimary: e.target.checked })} />주요 색상
          </label>
          <div className="flex justify-end"><button className={`btn btn-primary btn-sm ${sub ? 'loading' : ''}`} disabled={sub} onClick={handleSubmit}>저장</button></div>
        </div>
      )}
      {specs.length === 0 ? <p className="text-sm text-gray-500">등록된 도장 사양이 없습니다.</p> : (
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
                  <select className="select select-bordered select-xs" value={s.status} onChange={e => handleStatus(s.id, e.target.value)}>
                    {statuses.map(st => <option key={st} value={st}>{st}</option>)}
                  </select>
                ) : <span className="badge badge-sm badge-outline">{s.status}</span>}
              </div>
              <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                {s.manufacturer && <span>제조사: {s.manufacturer}</span>}
                {s.quantity && <span>수량: {fmtNum(s.quantity)}</span>}
                {s.area && <span>면적: {s.area}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════
// 출하 탭
// ══════════════════════════════════════════════════════
const SHIP_STATUSES = ['출하예정', '상차완료', '출발', '현장도착', '인수완료', '반송', '취소'];

function ShippingTab({ siteId, shipments, canManage, onMutate }: any) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ shippedAt: '', quantity: '', vehicleInfo: '', driverInfo: '', destination: '', receivedBy: '', notes: '' });
  const [sub, setSub] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setSub(true); setError('');
    const res = await fetch(`/api/sites/${siteId}/shipments`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, quantity: form.quantity ? Number(form.quantity.replace(/,/g, '')) : null }),
    });
    if (!res.ok) { const j = await res.json(); setError(j?.error?.message || '저장 실패'); }
    else { setForm({ shippedAt: '', quantity: '', vehicleInfo: '', driverInfo: '', destination: '', receivedBy: '', notes: '' }); setShowForm(false); onMutate(); }
    setSub(false);
  };
  const handleStatus = async (recordId: string, status: string) => {
    await fetch(`/api/sites/${siteId}/shipments`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ recordId, status }) });
    onMutate();
  };
  const handleDel = async (recordId: string) => {
    if (!confirm('출하 기록을 삭제합니다.')) return;
    await fetch(`/api/sites/${siteId}/shipments`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ recordId }) });
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
          {error && <div className="text-xs text-red-400 bg-red-900/20 rounded p-2">{error}</div>}
          <p className="text-xs text-blue-400 bg-blue-900/20 rounded p-2">✓ 출하 등록 시 생산 공급일이 자동으로 기록되고 담당자에게 알림이 전송됩니다.</p>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs text-gray-400 mb-1">출고일 *</label><input type="date" className="input input-bordered input-sm w-full" value={form.shippedAt} onChange={e => setForm({ ...form, shippedAt: e.target.value })} /></div>
            <div><label className="block text-xs text-gray-400 mb-1">수량 (㎡)</label><input className="input input-bordered input-sm w-full" placeholder="1,200" value={form.quantity ? Number(form.quantity.replace(/,/g, '')).toLocaleString() : ''} onChange={e => setForm({ ...form, quantity: e.target.value.replace(/,/g, '') })} /></div>
            <div><label className="block text-xs text-gray-400 mb-1">차량번호</label><input className="input input-bordered input-sm w-full" value={form.vehicleInfo} onChange={e => setForm({ ...form, vehicleInfo: e.target.value })} /></div>
            <div><label className="block text-xs text-gray-400 mb-1">기사 정보</label><input className="input input-bordered input-sm w-full" placeholder="이름 / 연락처" value={form.driverInfo} onChange={e => setForm({ ...form, driverInfo: e.target.value })} /></div>
            <div><label className="block text-xs text-gray-400 mb-1">도착지</label><input className="input input-bordered input-sm w-full" value={form.destination} onChange={e => setForm({ ...form, destination: e.target.value })} /></div>
            <div><label className="block text-xs text-gray-400 mb-1">인수자</label><input className="input input-bordered input-sm w-full" value={form.receivedBy} onChange={e => setForm({ ...form, receivedBy: e.target.value })} /></div>
          </div>
          <div><label className="block text-xs text-gray-400 mb-1">메모</label><textarea className="textarea textarea-bordered w-full text-sm" rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
          <div className="flex justify-end"><button className={`btn btn-primary btn-sm ${sub ? 'loading' : ''}`} disabled={sub} onClick={handleSubmit}>저장</button></div>
        </div>
      )}
      {shipments.length === 0 ? <p className="text-sm text-gray-500">등록된 출하 기록이 없습니다.</p> : (
        <div className="space-y-2">
          {shipments.map((s: any) => (
            <div key={s.id} className="rounded-lg border border-gray-800 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">{s.sequence}차 출고</span>
                  {s.shipmentNo && <span className="text-xs text-gray-500">{s.shipmentNo}</span>}
                </div>
                <div className="flex items-center gap-2">
                  {canManage ? (
                    <select className="select select-bordered select-xs" value={s.status} onChange={e => handleStatus(s.id, e.target.value)}>
                      {SHIP_STATUSES.map(st => <option key={st} value={st}>{st}</option>)}
                    </select>
                  ) : <span className="badge badge-sm badge-outline">{s.status}</span>}
                  {canManage && <button className="btn btn-ghost btn-xs text-error" onClick={() => handleDel(s.id)}><TrashIcon className="w-3.5 h-3.5" /></button>}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <span className="text-gray-500">출고일: <span className="text-gray-300">{s.shippedAt ? fmtDate(s.shippedAt) : '-'}</span></span>
                <span className="text-gray-500">수량: <span className="text-gray-300">{s.quantity ? fmtNum(s.quantity) : '-'} ㎡</span></span>
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
}

// ══════════════════════════════════════════════════════
// 실정/정산 탭
// ══════════════════════════════════════════════════════
const SETTLEMENT_TYPES = ['고소작업차', '물량증가', '설계변경', '추가공사', '기타'];
const SETTLEMENT_STATUSES = ['검토중', '공문발송', '수요처승인', '정산완료', '반려'];

function SettlementTab({ siteId, canManage, onMutate }: any) {
  const { data, mutate } = useSWR(`/api/sites/${siteId}/changes`, fetcher);
  const settlements = (data?.data || []).filter((c: any) =>
    ['실정보고', ...SETTLEMENT_TYPES].includes(c.type)
  );
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ type: '물량증가', beforeValue: '', afterValue: '', reason: '', impact: '' });
  const [sub, setSub] = useState(false);

  const handleSubmit = async () => {
    setSub(true);
    await fetch(`/api/sites/${siteId}/changes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form }) });
    setForm({ type: '물량증가', beforeValue: '', afterValue: '', reason: '', impact: '' });
    setShowForm(false); setSub(false); mutate(); onMutate();
  };
  const handleStatus = async (changeId: string, status: string) => {
    await fetch(`/api/sites/${siteId}/changes`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ changeId, status }) });
    mutate(); onMutate();
  };

  return (
    <div className="rounded-xl border border-gray-800 p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="font-semibold">실정보고 / 정산</h3>
          <p className="text-xs text-gray-500 mt-0.5">등록하면 개요 페이지에 자동으로 표시됩니다</p>
        </div>
        {canManage && (
          <button className="btn btn-primary btn-xs" onClick={() => setShowForm(!showForm)}>
            {showForm ? '취소' : <><PlusIcon className="w-3.5 h-3.5 mr-1" />등록</>}
          </button>
        )}
      </div>
      {showForm && (
        <div className="mb-4 rounded-lg border border-gray-700 bg-black/20 p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs text-gray-400 mb-1">유형</label><select className="select select-bordered select-sm w-full" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>{SETTLEMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
            <div><label className="block text-xs text-gray-400 mb-1">정산 금액 (원)</label><input className="input input-bordered input-sm w-full" placeholder="1,500,000" value={form.impact} onChange={e => setForm({ ...form, impact: e.target.value })} /></div>
            <div><label className="block text-xs text-gray-400 mb-1">기존 내용</label><input className="input input-bordered input-sm w-full" value={form.beforeValue} onChange={e => setForm({ ...form, beforeValue: e.target.value })} /></div>
            <div><label className="block text-xs text-gray-400 mb-1">변경/추가 내용</label><input className="input input-bordered input-sm w-full" value={form.afterValue} onChange={e => setForm({ ...form, afterValue: e.target.value })} /></div>
          </div>
          <div><label className="block text-xs text-gray-400 mb-1">사유</label><textarea className="textarea textarea-bordered w-full text-sm" rows={2} value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} /></div>
          <div className="flex justify-end"><button className={`btn btn-primary btn-sm ${sub ? 'loading' : ''}`} disabled={sub} onClick={handleSubmit}>저장</button></div>
        </div>
      )}
      {settlements.length === 0 ? <p className="text-sm text-gray-500">등록된 실정보고/정산 이력이 없습니다.</p> : (
        <div className="space-y-2">
          {settlements.map((c: any) => (
            <div key={c.id} className="rounded-lg border border-gray-800 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className="badge badge-sm badge-warning">{c.type}</span>
                  <span className={`badge badge-sm ${c.status === '정산완료' ? 'badge-success' : c.status === '반려' ? 'badge-error' : c.status === '수요처승인' ? 'badge-info' : 'badge-ghost'}`}>{c.status || '검토중'}</span>
                </div>
                {canManage && (
                  <select className="select select-bordered select-xs" value={c.status || '검토중'} onChange={e => handleStatus(c.id, e.target.value)}>
                    {SETTLEMENT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                )}
              </div>
              <div className="space-y-1 text-xs">
                {c.beforeValue && <p className="text-gray-400">기존: <span className="text-gray-300">{c.beforeValue}</span></p>}
                {c.afterValue && <p className="text-gray-300 font-medium">변경: {c.afterValue}</p>}
                {c.impact && <p className="text-green-400 font-medium">정산금액: {c.impact}</p>}
                {c.reason && <p className="text-gray-500 mt-1 whitespace-pre-wrap">{c.reason}</p>}
              </div>
              <p className="text-xs text-gray-600 mt-2">{c.requester?.position ? `${c.requester.position} ` : ''}{c.requester?.name} · {fmtDate(c.createdAt)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════
// 서류 탭
// ══════════════════════════════════════════════════════
function DocumentTab({ siteId, canManage }: any) {
  const { data, mutate } = useSWR(`/api/sites/${siteId}/documents`, fetcher);
  const docs = data?.data || [];
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const b64 = (reader.result as string).split(',')[1];
      await fetch(`/api/sites/${siteId}/documents`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: file.name, fileData: b64, mimeType: file.type, type: '첨부' }),
      });
      setUploading(false); mutate();
    };
    reader.readAsDataURL(file);
  };

  const fmtSize = (b: number) => {
    if (!b) return '';
    if (b < 1024) return `${b}B`;
    if (b < 1048576) return `${Math.round(b / 1024)}KB`;
    return `${(b / 1048576).toFixed(1)}MB`;
  };

  return (
    <div className="rounded-xl border border-gray-800 p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold">서류 목록</h3>
        {canManage && (
          <label className={`btn btn-primary btn-xs cursor-pointer ${uploading ? 'loading' : ''}`}>
            {!uploading && <><PlusIcon className="w-3.5 h-3.5 mr-1" />파일 업로드</>}
            <input type="file" className="hidden" onChange={handleUpload} disabled={uploading} />
          </label>
        )}
      </div>
      {docs.length === 0 ? <p className="text-sm text-gray-500">등록된 서류가 없습니다.</p> : (
        <div className="space-y-1.5">
          {docs.map((d: any) => (
            <div key={d.id} className="flex items-center justify-between rounded-lg border border-gray-800 px-3 py-2.5 hover:border-gray-700 transition-colors">
              <div className="min-w-0 flex-1 mr-3">
                <p className="text-sm text-gray-300 truncate">{d.fileName}</p>
                <p className="text-xs text-gray-600">
                  {d.uploadedBy?.name} · {fmtDate(d.createdAt)}{d.fileSize ? ` · ${fmtSize(d.fileSize)}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => window.open(`/api/sites/${siteId}/documents?download=1&docId=${d.id}`, '_blank')}
                  className="btn btn-ghost btn-xs text-blue-400"><ArrowDownTrayIcon className="w-4 h-4" /></button>
                {canManage && (
                  <button className="btn btn-ghost btn-xs text-error" onClick={async () => {
                    if (!confirm('서류를 삭제합니다.')) return;
                    await fetch(`/api/sites/${siteId}/documents`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ documentId: d.id }) });
                    mutate();
                  }}><TrashIcon className="w-3.5 h-3.5" /></button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════
// 요청사항 탭
// ══════════════════════════════════════════════════════
const REQ_TYPES = ['고객 요청', '현장 요청', '내부 요청', '협력사 요청', '긴급 요청'];
const REQ_PRIORITIES = ['낮음', '보통', '높음', '긴급'];
const REQ_STATUSES = ['등록', '확인중', '처리중', '완료', '반려', '보류'];

function RequestTab({ siteId, requests, canManage, onMutate }: any) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', type: '내부 요청', priority: '보통', targetDept: '', deadline: '', description: '' });
  const [sub, setSub] = useState(false);
  const BADGE: Record<string, string> = { 낮음: 'badge-ghost', 보통: 'badge-info', 높음: 'badge-warning', 긴급: 'badge-error' };

  const handleSubmit = async () => {
    if (!form.title) return;
    setSub(true);
    await fetch(`/api/sites/${siteId}/requests`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    setForm({ title: '', type: '내부 요청', priority: '보통', targetDept: '', deadline: '', description: '' });
    setShowForm(false); setSub(false); onMutate();
  };
  const handleStatus = async (requestId: string, status: string) => {
    await fetch(`/api/sites/${siteId}/requests`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requestId, status }) });
    onMutate();
  };

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
            <div className="col-span-2"><label className="block text-xs text-gray-400 mb-1">제목 *</label><input className="input input-bordered input-sm w-full" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
            <div><label className="block text-xs text-gray-400 mb-1">유형</label><select className="select select-bordered select-sm w-full" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>{REQ_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
            <div><label className="block text-xs text-gray-400 mb-1">우선순위</label><select className="select select-bordered select-sm w-full" value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>{REQ_PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}</select></div>
            <div><label className="block text-xs text-gray-400 mb-1">대상부서</label><input className="input input-bordered input-sm w-full" value={form.targetDept} onChange={e => setForm({ ...form, targetDept: e.target.value })} /></div>
            <div><label className="block text-xs text-gray-400 mb-1">마감기한</label><input type="date" className="input input-bordered input-sm w-full" value={form.deadline} onChange={e => setForm({ ...form, deadline: e.target.value })} /></div>
          </div>
          <div><label className="block text-xs text-gray-400 mb-1">내용</label><textarea className="textarea textarea-bordered w-full text-sm" rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
          <div className="flex justify-end"><button className={`btn btn-primary btn-sm ${sub ? 'loading' : ''}`} disabled={sub} onClick={handleSubmit}>저장</button></div>
        </div>
      )}
      {requests.length === 0 ? <p className="text-sm text-gray-500">등록된 요청사항이 없습니다.</p> : (
        <div className="space-y-2">
          {requests.map((r: any) => (
            <div key={r.id} className="rounded-lg border border-gray-800 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-2">
                  <span className={`badge badge-xs ${BADGE[r.priority] || 'badge-ghost'}`}>{r.priority}</span>
                  <span className="text-sm font-medium">{r.title}</span>
                </div>
                {canManage ? (
                  <select className="select select-bordered select-xs" value={r.status} onChange={e => handleStatus(r.id, e.target.value)}>{REQ_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}</select>
                ) : <span className="badge badge-sm badge-outline">{r.status}</span>}
              </div>
              <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                <span>{r.type}</span>
                {r.targetDept && <span>→ {r.targetDept}</span>}
                {r.deadline && <span>마감: {fmtDate(r.deadline)}</span>}
              </div>
              {r.description && <p className="text-xs text-gray-400 mt-1">{r.description}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════
// 업무일지 (구 댓글 → 타임라인)
// ══════════════════════════════════════════════════════
const TIMELINE_TYPES = [
  '일반메모', '착공', '영업접촉', '견적제출', '실정보고', '공문송부',
  '협의', '수요처방문', '검수', '검수완료', '출하확인', '준공', '하자처리', '기타',
];
const TYPE_COLOR: Record<string, string> = {
  '착공': 'bg-green-500', '준공': 'bg-blue-500', '검수완료': 'bg-blue-400',
  '실정보고': 'bg-orange-500', '공문송부': 'bg-yellow-500',
  '영업접촉': 'bg-purple-500', '견적제출': 'bg-purple-400',
  '하자처리': 'bg-red-500', '출하확인': 'bg-teal-500',
  '일반메모': 'bg-gray-600', '기타': 'bg-gray-500',
};

function TimelineTab({ siteId, canManage }: any) {
  const { data, mutate } = useSWR(`/api/sites/${siteId}/comments`, fetcher);
  const items = (data?.data || []).slice().sort((a: any, b: any) => {
    // 업무일지 날짜 기준 정렬 (최신이 위)
    try {
      const aDate = JSON.parse(a.content)._date || a.createdAt;
      const bDate = JSON.parse(b.content)._date || b.createdAt;
      return new Date(bDate).getTime() - new Date(aDate).getTime();
    } catch { return 0; }
  });
  const [form, setForm] = useState({ type: '일반메모', date: new Date().toISOString().split('T')[0], content: '' });
  const [sub, setSub] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!form.content.trim()) return;
    setSub(true);
    const payload = JSON.stringify({ _type: form.type, _date: form.date, _text: form.content });
    await fetch(`/api/sites/${siteId}/comments`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: payload }),
    });
    setForm({ type: '일반메모', date: new Date().toISOString().split('T')[0], content: '' });
    setSub(false); mutate();
  };

  const handleDelete = async (commentId: string) => {
    if (!confirm('이 기록을 삭제하시겠습니까?')) return;
    setDeletingId(commentId);
    await fetch(`/api/sites/${siteId}/comments`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commentId }),
    });
    setDeletingId(null); mutate();
  };

  // 타임라인 항목 파싱
  const parseItem = (c: any) => {
    try {
      const p = JSON.parse(c.content);
      if (p._type) return { type: p._type, date: p._date, text: p._text, raw: false };
    } catch {}
    return { type: '일반메모', date: c.createdAt?.split('T')[0], text: c.content, raw: true };
  };

  return (
    <div className="space-y-4">
      {/* 입력 폼 */}
      <div className="rounded-xl border border-gray-800 bg-black/20 p-4 space-y-3">
        <p className="text-xs font-semibold text-gray-400">업무 기록 추가</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">유형</label>
            <select className="select select-bordered select-sm w-full" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
              {TIMELINE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">날짜</label>
            <input type="date" className="input input-bordered input-sm w-full" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
          </div>
        </div>
        <textarea
          className="textarea textarea-bordered w-full text-sm"
          placeholder={`${form.type} 내용을 입력하세요... (예: 수요처 방문 - 담당자 검토 중, 다음 주 회신 예정)`}
          rows={3}
          value={form.content}
          onChange={e => setForm({ ...form, content: e.target.value })}
        />
        <div className="flex justify-end">
          <button className={`btn btn-primary btn-sm ${sub ? 'loading' : ''}`} disabled={sub} onClick={handleSubmit}>
            기록 추가
          </button>
        </div>
      </div>

      {/* 타임라인 */}
      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-700 py-12 text-center">
          <ClockIcon className="w-8 h-8 text-gray-700 mx-auto mb-2" />
          <p className="text-sm text-gray-600">업무 기록이 없습니다.<br />착공, 협의, 실정보고 등 주요 일정을 기록하세요.</p>
        </div>
      ) : (
        <div className="relative">
          {/* 세로 선 */}
          <div className="absolute left-3.5 top-0 bottom-0 w-px bg-gray-800" />
          <div className="space-y-3 pl-10">
            {items.map((c: any) => {
              const { type, date, text } = parseItem(c);
              const dotColor = TYPE_COLOR[type] || 'bg-gray-600';
              return (
                <div key={c.id} className="relative">
                  <div className={`absolute -left-[26px] top-2.5 w-3 h-3 rounded-full border-2 border-gray-950 ${dotColor}`} />
                  <div className="rounded-xl border border-gray-800 bg-black/20 p-3 hover:border-gray-700 transition-colors">
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[11px] px-2 py-0.5 rounded font-semibold text-white ${dotColor}`}>
                          {type}
                        </span>
                        <span className="text-xs text-gray-500">
                          {date ? new Date(date + 'T00:00:00').toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }) : ''}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[11px] text-gray-600">
                          {c.author?.position ? `${c.author.position} ` : ''}{c.author?.name}
                        </span>
                        {canManage && (
                          <button
                            onClick={() => handleDelete(c.id)}
                            disabled={deletingId === c.id}
                            className="text-gray-700 hover:text-red-400 transition-colors"
                          >
                            <TrashIcon className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">{text}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════
// 배정 패널 (협력사 생성 버튼 없음)
// ══════════════════════════════════════════════════════
function AssignmentPanel({ siteId, assignments, canManage, onMutate }: any) {
  const [showSearch, setShowSearch] = useState(false);
  const [sq, setSq] = useState('');
  const [sr, setSr] = useState<any[]>([]);

  const handleSearch = async (q: string) => {
    setSq(q);
    if (q.length < 1) { setSr([]); return; }
    const r = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`);
    if (r.ok) { const d = await r.json(); setSr(d.data || []); }
  };
  const handleAssign = async (userId: string) => {
    await fetch(`/api/sites/${siteId}/assignments`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId }) });
    setSq(''); setSr([]); setShowSearch(false); onMutate();
  };
  const handleRemove = async (userId: string) => {
    if (!confirm('배정을 해제합니다.')) return;
    await fetch(`/api/sites/${siteId}/assignments`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId }) });
    onMutate();
  };

  return (
    <div className="rounded-xl border border-gray-800 bg-black/20 p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs text-gray-500">배정 인원 ({assignments?.length || 0})</p>
        {canManage && (
          <button className="btn btn-ghost btn-xs" onClick={() => setShowSearch(!showSearch)}>
            <PlusIcon className="h-3.5 w-3.5" /> 직원 배정
          </button>
        )}
      </div>
      {showSearch && (
        <div className="mb-3 space-y-2">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input type="text" className="input input-bordered input-sm w-full pl-9" placeholder="이름 또는 이메일"
              value={sq} onChange={e => handleSearch(e.target.value)} />
          </div>
          {sr.length > 0 && (
            <div className="max-h-40 overflow-y-auto rounded border border-gray-700">
              {sr.map(u => (
                <button key={u.id} onClick={() => handleAssign(u.id)} className="w-full px-3 py-2 text-left text-sm hover:bg-gray-800">
                  {u.position ? `${u.position} ` : ''}{u.name}
                  <span className="text-gray-500 ml-1 text-xs">({u.email})</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {!assignments?.length ? (
        <p className="text-sm text-gray-500">배정된 인원이 없습니다.</p>
      ) : (
        <div className="space-y-1">
          {assignments.map((a: any) => (
            <div key={a.id} className="flex items-center justify-between py-1">
              <p className="text-sm">{a.user.position ? `${a.user.position} ` : ''}{a.user.name}
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
}

// ══════════════════════════════════════════════════════
// 시공업체 패널
// ══════════════════════════════════════════════════════
function ContractorPanel({ site, siteId, canManage, onMutate }: any) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    installerName: site.installerName || '',
    installerContact: site.installerContact || '',
    installerPhone: site.installerPhone || '',
  });
  const [saving, setSaving] = useState(false);
  const [assigned, setAssigned] = useState(0);

  // 협력업체 검색
  const [companies, setCompanies] = useState<any[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    if (!editing) return;
    fetch('/api/partner-companies')
      .then(r => r.ok ? r.json() : { data: [] })
      .then(j => setCompanies(j.data || []));
  }, [editing]);

  const filtered = form.installerName.trim()
    ? companies.filter(c => c.name.includes(form.installerName))
    : companies;

  const selectCompany = (co: any) => {
    setForm({
      installerName: co.name,
      installerContact: co.contact || '',
      installerPhone: co.phone || '',
    });
    setShowDropdown(false);
  };

  const handleSave = async () => {
    setSaving(true);
    const res = await fetch(`/api/sites/${siteId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const json = await res.json();
    setSaving(false);
    setEditing(false);
    if (json.data?.autoAssigned) setAssigned(json.data.autoAssigned);
    onMutate();
  };

  return (
    <div className="rounded-xl border border-gray-800 bg-black/20 p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium text-gray-400">시공업체</p>
        {canManage && !editing && (
          <button className="btn btn-ghost btn-xs" onClick={() => { setEditing(true); setShowDropdown(false); }}>수정</button>
        )}
      </div>

      {assigned > 0 && (
        <div className="mb-2 rounded-lg bg-blue-950/30 border border-blue-800/40 px-3 py-1.5 text-xs text-blue-300">
          ✓ {form.installerName} 소속 계정 {assigned}명이 현장에 자동 배정되었습니다.
        </div>
      )}

      {editing ? (
        <div className="space-y-2">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {/* 업체명 — 검색 드롭다운 */}
            <div className="relative">
              <label className="block text-[10px] text-gray-500 mb-1">업체명</label>
              <input
                className="input input-bordered input-sm w-full"
                placeholder="업체명 검색 또는 직접 입력"
                value={form.installerName}
                onChange={e => { setForm({ ...form, installerName: e.target.value }); setShowDropdown(true); }}
                onFocus={() => setShowDropdown(true)}
                autoComplete="off"
              />
              {showDropdown && filtered.length > 0 && (
                <div className="absolute z-50 left-0 right-0 top-full mt-1 max-h-48 overflow-y-auto rounded-lg border border-gray-700 bg-gray-900 shadow-2xl">
                  {filtered.map((co: any) => (
                    <button
                      key={co.id}
                      type="button"
                      className="w-full text-left px-3 py-2.5 hover:bg-gray-800 transition-colors border-b border-gray-700/40 last:border-0"
                      onMouseDown={() => selectCompany(co)}
                    >
                      <p className="text-sm font-semibold text-white">{co.name}</p>
                      <p className="text-[11px] text-gray-400">
                        {co.contact && `담당: ${co.contact}`}{co.contact && co.phone && ' · '}{co.phone && co.phone}
                      </p>
                    </button>
                  ))}
                </div>
              )}
              {showDropdown && form.installerName.trim() && filtered.length === 0 && (
                <div className="absolute z-50 left-0 right-0 top-full mt-1 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2.5 text-xs text-gray-500 shadow-2xl">
                  등록된 업체 없음 — 직접 입력으로 저장됩니다
                </div>
              )}
            </div>
            <div>
              <label className="block text-[10px] text-gray-500 mb-1">담당자</label>
              <input className="input input-bordered input-sm w-full"
                value={form.installerContact}
                onChange={e => setForm({ ...form, installerContact: e.target.value })} />
            </div>
            <div>
              <label className="block text-[10px] text-gray-500 mb-1">연락처</label>
              <input className="input input-bordered input-sm w-full"
                value={form.installerPhone}
                onChange={e => setForm({ ...form, installerPhone: e.target.value })} />
            </div>
          </div>
          <p className="text-[10px] text-gray-600">
            ※ 등록된 협력업체를 선택하면 담당자·연락처가 자동으로 채워지고, 소속 계정이 이 현장에 자동 배정됩니다.
          </p>
          <div className="flex justify-end gap-2">
            <button className="btn btn-ghost btn-xs" onClick={() => { setEditing(false); setShowDropdown(false); }}>취소</button>
            <button className={`btn btn-primary btn-xs ${saving ? 'loading' : ''}`}
              disabled={saving} onClick={handleSave}>저장</button>
          </div>
        </div>
      ) : (
        site.installerName ? (
          <div className="grid grid-cols-3 gap-x-4 text-sm">
            <div>
              <p className="text-[10px] text-gray-600 mb-0.5">업체명</p>
              <p className="text-gray-200 font-medium">{site.installerName}</p>
            </div>
            {site.installerContact && (
              <div>
                <p className="text-[10px] text-gray-600 mb-0.5">담당자</p>
                <p className="text-gray-300">{site.installerContact}</p>
              </div>
            )}
            {site.installerPhone && (
              <div>
                <p className="text-[10px] text-gray-600 mb-0.5">연락처</p>
                <p className="text-gray-300">{site.installerPhone}</p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-600">등록된 시공업체가 없습니다.</p>
        )
      )}
    </div>
  );
}


// ══════════════════════════════════════════════════════
// 보고서 인쇄 컴포넌트
// ══════════════════════════════════════════════════════
function SiteReportPrint({ site }: { site: any }) {
  const { data: commentsData } = useSWR(`/api/sites/${site.id}/comments`, fetcher);
  const comments = (commentsData?.data || []).slice().sort((a: any, b: any) => {
    try {
      const aDate = JSON.parse(a.content)._date || a.createdAt;
      const bDate = JSON.parse(b.content)._date || b.createdAt;
      return new Date(aDate).getTime() - new Date(bDate).getTime();
    } catch { return 0; }
  });

  const parseItem = (c: any) => {
    try {
      const p = JSON.parse(c.content);
      if (p._type) return { type: p._type, date: p._date, text: p._text };
    } catch {}
    return { type: '일반메모', date: c.createdAt?.split('T')[0], text: c.content };
  };

  const shippedQty = (site.shipments || []).reduce((s: number, r: any) => s + Number(r.quantity ?? 0), 0);
  const progressRate = Number(site.contractQuantity) > 0
    ? Math.min(100, Math.round((shippedQty / Number(site.contractQuantity)) * 100)) : 0;

  const items: any[] = Array.isArray(site.productItems) && site.productItems.length > 0
    ? site.productItems
    : (site.productName || site.specification)
      ? [{ seq: '1', productName: site.productName, spec: site.specification, unit: '㎡', unitPrice: site.unitPrice, contractQuantity: site.contractQuantity, amount: site.contractAmount }]
      : [];

  const fmtW = (v: any) => {
    if (!v) return '-';
    const n = Number(v);
    if (n >= 100000000) return `${(n / 100000000).toFixed(2)}억원`;
    if (n >= 10000) return `${Math.round(n / 10000).toLocaleString()}만원`;
    return `${n.toLocaleString()}원`;
  };

  const today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
  const progressColor = progressRate >= 100 ? '#2563eb' : progressRate >= 60 ? '#16a34a' : progressRate >= 30 ? '#d97706' : '#6b7280';

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        @page { size: A4 portrait; margin: 15mm 16mm; }
        @media print {
          .no-print { display: none !important; }
          body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .page { padding: 0 !important; }
        }
        html, body {
          font-family: 'Apple SD Gothic Neo', 'Pretendard', 'Noto Sans KR', 'Malgun Gothic', sans-serif;
          background: #eef0f6;
          color: #1a1a2e;
          font-size: 13px;
          line-height: 1.65;
        }
        /* 인쇄 버튼 */
        .print-fab {
          position: fixed;
          bottom: 28px; right: 28px;
          display: flex; align-items: center; gap: 8px;
          background: #1B3FAE; color: white;
          border: none; border-radius: 50px;
          padding: 13px 26px;
          font-size: 14px; font-weight: 700;
          cursor: pointer;
          box-shadow: 0 6px 28px rgba(27,63,174,0.5);
          z-index: 9999;
          letter-spacing: -0.01em;
        }
        .print-fab:hover { background: #1432a0; }

        /* 페이지 */
        .page { max-width: 800px; margin: 0 auto; padding: 28px 16px 60px; }

        /* ── 커버 ── */
        .cover {
          background: linear-gradient(135deg, #0d1d6b 0%, #1B3FAE 55%, #3461e8 100%);
          color: white;
          border-radius: 16px;
          padding: 36px 40px 32px;
          margin-bottom: 20px;
          position: relative; overflow: hidden;
        }
        .cover::before {
          content: ''; position: absolute;
          top: -50px; right: -50px;
          width: 220px; height: 220px; border-radius: 50%;
          background: rgba(255,255,255,0.07);
        }
        .cover-eyebrow {
          font-size: 10px; font-weight: 700;
          letter-spacing: 0.18em; text-transform: uppercase;
          color: rgba(255,255,255,0.55);
          margin-bottom: 10px;
        }
        .cover-title {
          font-size: 22px; font-weight: 800; line-height: 1.35;
          letter-spacing: -0.025em; margin-bottom: 14px;
        }
        .cover-chips { display: flex; flex-wrap: wrap; gap: 6px 16px; }
        .cover-chip {
          font-size: 11px; color: rgba(255,255,255,0.72);
          display: flex; align-items: center; gap: 5px;
        }
        .cover-badge {
          display: inline-flex; align-items: center;
          background: rgba(255,255,255,0.15);
          border: 1px solid rgba(255,255,255,0.25);
          border-radius: 20px; padding: 3px 12px;
          font-size: 11px; font-weight: 600; color: white;
          margin-top: 14px;
        }

        /* ── 섹션 ── */
        .section { margin-bottom: 18px; }
        .section-head {
          display: flex; align-items: center; gap: 9px;
          margin-bottom: 11px;
        }
        .section-bar { width: 3px; height: 17px; background: #1B3FAE; border-radius: 2px; }
        .section-title { font-size: 12px; font-weight: 800; color: #1B3FAE; letter-spacing: 0.04em; text-transform: uppercase; }
        .section-count { font-size: 11px; color: #aaa; font-weight: 500; }

        /* ── 카드 ── */
        .card {
          background: white; border-radius: 12px;
          padding: 20px 22px;
          box-shadow: 0 1px 8px rgba(0,0,0,0.07), 0 0 0 1px rgba(0,0,0,0.04);
        }

        /* ── 통계 그리드 ── */
        .stat-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 10px; margin-bottom: 12px; }
        .stat-card {
          background: white; border-radius: 12px; padding: 16px 14px; text-align: center;
          box-shadow: 0 1px 8px rgba(0,0,0,0.07), 0 0 0 1px rgba(0,0,0,0.04);
        }
        .stat-val { font-size: 20px; font-weight: 800; line-height: 1.1; margin-bottom: 3px; letter-spacing: -0.03em; }
        .stat-lbl { font-size: 10px; color: #999; font-weight: 600; letter-spacing: 0.02em; }

        /* ── 공정률 바 ── */
        .progress-row { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 8px; }
        .progress-label { font-size: 12px; font-weight: 600; color: #555; }
        .progress-pct { font-size: 22px; font-weight: 800; letter-spacing: -0.03em; }
        .progress-track { background: #e8ecf8; border-radius: 99px; height: 10px; overflow: hidden; margin-bottom: 6px; }
        .progress-fill { height: 100%; border-radius: 99px; }
        .progress-detail { font-size: 10px; color: #bbb; text-align: right; }

        /* ── 정보 그리드 ── */
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px 36px; }
        .info-item label { display: block; font-size: 9px; font-weight: 700; color: #bbb; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 3px; }
        .info-item p { font-size: 13px; font-weight: 600; color: #222; }
        .divider { border: none; border-top: 1px solid #f0f2f8; margin: 14px 0; }

        /* ── 테이블 ── */
        .table-wrap { border-radius: 12px; overflow: hidden; box-shadow: 0 1px 8px rgba(0,0,0,0.07), 0 0 0 1px rgba(0,0,0,0.04); }
        table { width: 100%; border-collapse: collapse; background: white; }
        thead tr { background: #f5f7fc; }
        th {
          padding: 10px 13px; text-align: left;
          font-size: 9px; font-weight: 700; color: #888;
          letter-spacing: 0.09em; text-transform: uppercase;
          border-bottom: 1px solid #eaecf5;
          white-space: nowrap;
        }
        td {
          padding: 10px 13px; font-size: 12px; color: #333;
          border-bottom: 1px solid #f3f5fb;
          vertical-align: top;
        }
        tr:last-child td { border-bottom: none; }
        .td-r { text-align: right; }
        .td-c { text-align: center; }
        .sum-row td { background: #f0f3fc; font-weight: 700; color: #1B3FAE; border-top: 1.5px solid #d8deef; }
        .type-pill {
          display: inline-block; padding: 2px 9px; border-radius: 20px;
          font-size: 10px; font-weight: 700; white-space: nowrap;
          background: #1B3FAE; color: white;
        }
        .tl-text { font-size: 12px; color: #333; white-space: pre-wrap; line-height: 1.6; }

        /* ── 푸터 ── */
        .footer {
          margin-top: 28px; padding-top: 14px;
          border-top: 1px solid #e2e5f0;
          display: flex; justify-content: space-between; align-items: center;
          font-size: 10px; color: #ccc;
        }
        .footer strong { color: #1B3FAE; font-weight: 700; }

        /* 색상 유틸 */
        .c-green { color: #16a34a; } .c-blue { color: #1B3FAE; } .c-amber { color: #d97706; } .c-gray { color: #9ca3af; }
      `}</style>

      {/* 인쇄 버튼 */}
      <button className="print-fab no-print" onClick={() => window.print()}>
        🖨&nbsp; 인쇄 / PDF 저장
      </button>

      <div className="page">

        {/* ── 커버 ── */}
        <div className="cover">
          <div className="cover-eyebrow">현장 관리 보고서 · LOOKUP9</div>
          <div className="cover-title">{site.name}</div>
          <div className="cover-chips">
            {site.client?.name && <span className="cover-chip">📍&nbsp;{site.client.name}</span>}
            {site.address   && <span className="cover-chip">🏗&nbsp;{site.address}</span>}
            <span className="cover-chip">📅&nbsp;{today}</span>
          </div>
          <div>
            <span className="cover-badge">
              {site.status === 'CONTRACT_ACTIVE' ? '🟢 진행중'
               : site.status === 'COMPLETED' ? '🔵 준공완료'
               : site.status === 'WARRANTY' ? '🟣 하자기간'
               : site.status}
              &nbsp;&nbsp;·&nbsp;&nbsp;{site.siteType || '납품설치도'}
            </span>
          </div>
        </div>

        {/* ── 공사 진행 현황 ── */}
        <div className="section">
          <div className="section-head">
            <div className="section-bar" />
            <div className="section-title">공사 진행 현황</div>
          </div>
          <div className="stat-grid">
            {[
              { val: fmtW(site.contractAmount),  lbl: '계약금액',    cls: 'c-green' },
              { val: site.contractQuantity ? `${Number(site.contractQuantity).toLocaleString()} ㎡` : '-', lbl: '계약물량', cls: 'c-blue' },
              { val: shippedQty > 0 ? `${shippedQty.toLocaleString()} ㎡` : '-', lbl: '출하물량', cls: shippedQty > 0 ? 'c-blue' : 'c-gray' },
              { val: `${progressRate}%`, lbl: '출하 공정률', cls: progressRate >= 80 ? 'c-green' : progressRate >= 40 ? 'c-blue' : 'c-amber' },
            ].map(({ val, lbl, cls }) => (
              <div key={lbl} className="stat-card">
                <div className={`stat-val ${cls}`}>{val}</div>
                <div className="stat-lbl">{lbl}</div>
              </div>
            ))}
          </div>
          <div className="card">
            <div className="progress-row">
              <span className="progress-label">출하 공정률</span>
              <span className="progress-pct" style={{ color: progressColor }}>{progressRate}%</span>
            </div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${progressRate}%`, background: `linear-gradient(90deg, ${progressColor}, ${progressColor}cc)` }} />
            </div>
            <div className="progress-detail">
              출하 {shippedQty.toLocaleString()} ㎡ &nbsp;/&nbsp; 계약 {Number(site.contractQuantity || 0).toLocaleString()} ㎡
            </div>
          </div>
        </div>

        {/* ── 계약 정보 ── */}
        <div className="section">
          <div className="section-head">
            <div className="section-bar" />
            <div className="section-title">계약 정보</div>
          </div>
          <div className="card">
            <div className="info-grid">
              {[
                { label: '납품요구번호', value: site.contractNo || '-' },
                { label: '납품기한',     value: site.deliveryDeadline ? fmtDate(site.deliveryDeadline) : '-' },
                { label: '단가',         value: site.unitPrice ? `${Number(site.unitPrice).toLocaleString()}원/㎡` : '-' },
                { label: '하자담보기간', value: site.warrantyPeriod ? `${site.warrantyPeriod}년` : '-' },
                { label: '검사기관',     value: site.inspectionAgency || '-' },
                { label: '납품 유형',    value: site.siteType || '-' },
              ].map(({ label, value }) => (
                <div key={label} className="info-item">
                  <label>{label}</label>
                  <p>{value}</p>
                </div>
              ))}
            </div>
            <hr className="divider" />
            <div style={{ display: 'flex', gap: 24 }}>
              <span style={{ fontSize: 12, color: site.startDocsDone ? '#16a34a' : '#d1d5db', fontWeight: 600 }}>
                {site.startDocsDone ? '✅' : '⬜'}&nbsp;착수계 제출
              </span>
              <span style={{ fontSize: 12, color: site.completionDocsDone ? '#2563eb' : '#d1d5db', fontWeight: 600 }}>
                {site.completionDocsDone ? '✅' : '⬜'}&nbsp;준공계 제출
              </span>
            </div>
          </div>
        </div>

        {/* ── 납품 품목 ── */}
        {items.length > 0 && (
          <div className="section">
            <div className="section-head">
              <div className="section-bar" />
              <div className="section-title">납품 품목</div>
              {items.length > 1 && <span className="section-count">{items.length}개 품목</span>}
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th className="td-c" style={{width:36}}>순</th>
                    <th>품명</th>
                    <th>규격 / 사양</th>
                    <th className="td-r">단가 (원/㎡)</th>
                    <th className="td-r">계약물량 (㎡)</th>
                    <th className="td-r">금액 (원)</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item: any, idx: number) => (
                    <tr key={idx}>
                      <td className="td-c" style={{ color: '#bbb', fontWeight: 700 }}>{item.seq || idx + 1}</td>
                      <td style={{ fontWeight: 600 }}>{item.productName || '-'}</td>
                      <td style={{ fontSize: 11, color: '#777', wordBreak: 'break-all' }}>{item.spec || '-'}</td>
                      <td className="td-r">{item.unitPrice ? Number(item.unitPrice).toLocaleString() : '-'}</td>
                      <td className="td-r" style={{ fontWeight: 700, color: '#1B3FAE' }}>
                        {item.contractQuantity ? Number(item.contractQuantity).toLocaleString() : '-'}
                      </td>
                      <td className="td-r" style={{ color: '#16a34a', fontWeight: 600 }}>
                        {item.amount ? Number(item.amount).toLocaleString() : '-'}
                      </td>
                    </tr>
                  ))}
                  {items.length > 1 && (
                    <tr className="sum-row">
                      <td colSpan={4} className="td-r">합 계</td>
                      <td className="td-r">{items.reduce((s: number, i: any) => s + Number(i.contractQuantity || 0), 0).toLocaleString()} ㎡</td>
                      <td className="td-r">{items.reduce((s: number, i: any) => s + Number(i.amount || 0), 0).toLocaleString()}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── 발주처 / 담당자 ── */}
        {(site.client?.name || site.clientManager) && (
          <div className="section">
            <div className="section-head">
              <div className="section-bar" />
              <div className="section-title">발주처 / 담당자</div>
            </div>
            <div className="card">
              <div className="info-grid">
                <div className="info-item"><label>수요기관</label><p>{site.client?.name || '-'}</p></div>
                <div className="info-item"><label>담당부서</label><p>{site.clientDept || '-'}</p></div>
                <div className="info-item"><label>담당자명</label><p>{site.clientManager || '-'}</p></div>
                <div className="info-item"><label>연락처</label><p>{site.clientManagerPhone || '-'}</p></div>
              </div>
            </div>
          </div>
        )}

        {/* ── 업무일지 ── */}
        <div className="section">
          <div className="section-head">
            <div className="section-bar" />
            <div className="section-title">업무일지</div>
            {comments.length > 0 && <span className="section-count">{comments.length}건</span>}
          </div>
          {comments.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', color: '#ccc', padding: '28px', fontSize: 12 }}>
              등록된 업무일지가 없습니다.
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 82 }}>날짜</th>
                    <th style={{ width: 76 }}>유형</th>
                    <th>내용</th>
                    <th style={{ width: 68 }}>작성자</th>
                  </tr>
                </thead>
                <tbody>
                  {comments.map((c: any) => {
                    const { type, date, text } = parseItem(c);
                    return (
                      <tr key={c.id}>
                        <td style={{ fontSize: 11, color: '#888', whiteSpace: 'nowrap' }}>
                          {date ? new Date(date + 'T00:00:00').toLocaleDateString('ko-KR') : '-'}
                        </td>
                        <td><span className="type-pill">{type}</span></td>
                        <td className="tl-text">{text}</td>
                        <td style={{ fontSize: 11, color: '#aaa', whiteSpace: 'nowrap' }}>
                          {c.author?.position ? `${c.author.position} ` : ''}{c.author?.name || '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── 푸터 ── */}
        <div className="footer">
          <strong>LOOKUP9</strong>
          <span>{site.name} · 보고서 생성: {new Date().toLocaleString('ko-KR')}</span>
        </div>
      </div>
    </>
  );
}


export async function getServerSideProps({ locale }: GetServerSidePropsContext) {
  return { props: { ...(locale ? await serverSideTranslations(locale, ['common']) : {}) } };
}
