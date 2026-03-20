/* eslint-disable i18next/no-literal-string */
import { GetServerSidePropsContext } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useState, useEffect, useCallback, useMemo } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import useSWR from 'swr';
import fetcher from '@/lib/fetcher';
import {
  PlusIcon, MagnifyingGlassIcon, ExclamationTriangleIcon,
  DocumentArrowUpIcon, CheckCircleIcon,
  ChevronDownIcon, ChevronRightIcon, FunnelIcon,
} from '@heroicons/react/24/outline';

// ── 상태 정의 ──────────────────────────────────────────────
const STATUS_META: Record<string, { label: string; dot: string; badge: string; group: 'active' | 'sales' | 'done' }> = {
  SALES_PIPELINE:  { label: '영업중',   dot: 'bg-orange-400', badge: 'text-orange-300 bg-orange-900/25 border-orange-800/40', group: 'sales' },
  SALES_CONFIRMED: { label: '수주확정', dot: 'bg-yellow-400', badge: 'text-yellow-300 bg-yellow-900/25 border-yellow-800/40', group: 'pre' },
  CONTRACT_ACTIVE: { label: '진행중',   dot: 'bg-green-400',  badge: 'text-green-300  bg-green-900/25  border-green-800/40',  group: 'active' },
  COMPLETED:       { label: '준공완료', dot: 'bg-blue-400',   badge: 'text-blue-300   bg-blue-900/25   border-blue-800/40',   group: 'done' },
  WARRANTY:        { label: '하자기간', dot: 'bg-purple-400', badge: 'text-purple-300 bg-purple-900/25 border-purple-800/40', group: 'done' },
  FAILED:          { label: '영업실패', dot: 'bg-gray-600',   badge: 'text-gray-500   bg-gray-800/30   border-gray-700/40',   group: 'done' },
};

const getMeta = (status: string) =>
  STATUS_META[status] ?? { label: status, dot: 'bg-gray-600', badge: 'text-gray-400 bg-gray-800/20 border-gray-700/30', group: 'active' };

// ── 유틸 ──────────────────────────────────────────────────
const fmtMoney = (v: any) => {
  if (!v) return null;
  const n = Number(v);
  if (n >= 100000000) return `${(n / 100000000).toFixed(1)}억`;
  if (n >= 10000) return `${Math.round(n / 10000).toLocaleString()}만`;
  return n.toLocaleString();
};

const getDday = (dateVal: any) => {
  if (!dateVal) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(dateVal); d.setHours(0, 0, 0, 0);
  const diff = Math.ceil((d.getTime() - today.getTime()) / 86400000);
  return { diff, overdue: diff < 0, urgent: diff >= 0 && diff <= 14 };
};

const calcProgress = (site: any): number => {
  const qty = Number(site.contractQuantity ?? 0);
  if (qty <= 0) return 0;
  const shipped = (site.shipments ?? []).reduce((s: number, r: any) => s + Number(r.quantity ?? 0), 0);
  return Math.min(100, Math.round((shipped / qty) * 100));
};

type AlertLevel = 'critical' | 'warning' | 'normal';
const getAlertLevel = (site: any): AlertLevel => {
  const issues = site._count?.issues ?? 0;
  const dday = getDday(site.deliveryDeadline);
  if (issues > 0 || dday?.overdue) return 'critical';
  if (dday?.urgent) return 'warning';
  return 'normal';
};

// ── 탭 필터 정의 ────────────────────────────────────────────
type TabFilter = 'all' | 'active' | 'done';
const TAB_DEFS: { key: TabFilter; label: string }[] = [
  { key: 'all',    label: '전체' },
  { key: 'active', label: '진행중' },
  { key: 'done',   label: '완료/하자' },
];

// ── 메인 ────────────────────────────────────────────────────
const SitesList = () => {
  const [sites, setSites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<TabFilter>('all');
  const [alertOnly, setAlertOnly] = useState(false);
  const [showFailed, setShowFailed] = useState(false);

  const { data: profileData } = useSWR('/api/my/profile', fetcher);
  const role = profileData?.data?.role || 'USER';
  const canCreate = !['PARTNER', 'GUEST', 'VIEWER'].includes(role);

  const fetchSites = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    params.set('includeCompleted', 'true');
    const res = await fetch(`/api/sites?${params.toString()}`);
    if (res.ok) {
      const d = await res.json();
      setSites(d.data || []);
    }
    setLoading(false);
  }, [search]);

  useEffect(() => {
    const t = setTimeout(fetchSites, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [fetchSites, search]);

  // 그룹 분류
  const salesSites   = useMemo(() => sites.filter(s => getMeta(s.status).group === 'sales'), [sites]);
  const preSites     = useMemo(() => sites.filter(s => getMeta(s.status).group === 'pre'), [sites]);
  const activeSites  = useMemo(() => sites.filter(s => getMeta(s.status).group === 'active'), [sites]);
  const doneSites    = useMemo(() => sites.filter(s => getMeta(s.status).group === 'done' && s.status !== 'FAILED'), [sites]);
  const failedSites  = useMemo(() => sites.filter(s => s.status === 'FAILED'), [sites]);

  // 탭에 따른 표시 목록
  const tabSites = useMemo(() => {
    if (tab === 'active') return activeSites;
    if (tab === 'done')   return doneSites;
    return activeSites; // 'all' = 진행중만 (수주확정/완료는 접이식 섹션)
  }, [tab, activeSites, doneSites]);

  // 알림 필터 + 정렬
  const LEVEL_ORDER: Record<AlertLevel, number> = { critical: 0, warning: 1, normal: 2 };
  const displaySites = useMemo(() => {
    let list = [...tabSites];
    if (alertOnly) list = list.filter(s => ['critical', 'warning'].includes(getAlertLevel(s)));
    list.sort((a, b) => LEVEL_ORDER[getAlertLevel(a)] - LEVEL_ORDER[getAlertLevel(b)]);
    return list;
  }, [tabSites, alertOnly]);

  // 카운트
  const counts = useMemo(() => ({
    pre:      preSites.length,
    active:   activeSites.length,
    critical: activeSites.filter(s => getAlertLevel(s) === 'critical').length,
    warning:  activeSites.filter(s => getAlertLevel(s) === 'warning').length,
    done:     doneSites.length,
    failed:   failedSites.length,
  }), [preSites, activeSites, doneSites, failedSites]);

  return (
    <>
      <Head><title>현장관리 | LOOKUP9</title></Head>
      <div className="space-y-3">

        {/* 헤더 */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">현장관리</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              투입전 {counts.pre} · 진행중 {counts.active} · 완료 {counts.done}
            </p>
          </div>
          {canCreate && (
            <div className="flex gap-2">
              <Link href="/sites/create-from-pdf">
                <button className="btn btn-sm gap-1 border border-blue-700/60 bg-blue-950/30 text-blue-400 hover:bg-blue-950/60">
                  <DocumentArrowUpIcon className="h-4 w-4" />PDF
                </button>
              </Link>
              <Link href="/sites/create">
                <button className="btn btn-primary btn-sm gap-1.5">
                  <PlusIcon className="h-4 w-4" />등록
                </button>
              </Link>
            </div>
          )}
        </div>

        {/* 요약 칩 */}
        <div className="grid grid-cols-4 gap-1.5">
          {[
            { label: '투입전', value: counts.pre,      color: 'border-yellow-900/40 text-yellow-300' },
            { label: '진행중', value: counts.active,   color: 'border-green-900/40  text-green-300' },
            { label: '긴급',   value: counts.critical, color: `border-red-900/50 text-red-300 ${alertOnly ? 'ring-1 ring-red-500' : ''}`, click: () => setAlertOnly(p => !p) },
            { label: '완료',   value: counts.done,     color: 'border-blue-900/40 text-blue-400' },
          ].map(chip => (
            <button key={chip.label} type="button" onClick={chip.click}
              className={`rounded-lg border px-2 py-2 text-center bg-black/20 transition ${chip.color} hover:brightness-110`}>
              <p className="text-base font-bold leading-none">{chip.value}</p>
              <p className="text-[10px] text-gray-600 mt-0.5">{chip.label}</p>
            </button>
          ))}
        </div>

        {/* 탭 */}
        <div className="flex gap-1 border-b border-gray-800 pb-0">
          {TAB_DEFS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-t transition-colors ${
                tab === t.key
                  ? 'text-white border-b-2 border-blue-500 -mb-px bg-blue-950/20'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {t.label}
              <span className="ml-1 text-[10px] opacity-60">
                {t.key === 'active' ? counts.active :
                 t.key === 'done'   ? counts.done :
                 counts.active}
              </span>
            </button>
          ))}
        </div>

        {/* 검색 + 긴급필터 */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              className="input input-bordered input-sm w-full pl-9 bg-black/20"
              placeholder="현장명, 수요기관 검색..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          {alertOnly && (
            <button className="btn btn-sm btn-error btn-outline gap-1" onClick={() => setAlertOnly(false)}>
              <FunnelIcon className="h-3.5 w-3.5" />해제
            </button>
          )}
        </div>

        {/* 현장 목록 */}
        {loading ? (
          <div className="py-12 text-center">
            <span className="loading loading-spinner loading-md text-gray-500" />
          </div>
        ) : displaySites.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-700 py-12 text-center">
            <p className="text-sm text-gray-500">
              {alertOnly ? '긴급/임박 현장이 없습니다.' : '현장이 없습니다.'}
            </p>
            {canCreate && !alertOnly && (
              <div className="mt-3 flex justify-center gap-2">
                <Link href="/sites/create-from-pdf">
                  <button className="btn btn-ghost btn-sm gap-1 text-blue-400">
                    <DocumentArrowUpIcon className="h-4 w-4" />PDF로 등록
                  </button>
                </Link>
                <Link href="/sites/create">
                  <button className="btn btn-ghost btn-sm gap-1">
                    <PlusIcon className="h-4 w-4" />직접 등록
                  </button>
                </Link>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-1.5">
            {displaySites.map(site => <SiteCard key={site.id} site={site} />)}
          </div>
        )}

        {/* 수주확정 현장 — 접이식 */}
        {(tab === 'all') && preSites.length > 0 && (
          <PreSection sites={preSites} />
        )}

        {/* 완료/하자 현장 — 'all' 탭에서만 접기 표시 */}
        {tab === 'all' && doneSites.length > 0 && (
          <DoneSection sites={doneSites} />
        )}

        {/* 영업실패 현장 */}
        {counts.failed > 0 && (tab === 'all' || tab === 'done') && (
          <FailedSection
            sites={failedSites}
            open={showFailed}
            onToggle={() => setShowFailed(p => !p)}
          />
        )}
      </div>
    </>
  );
};

// ── 수주확정(투입전) 섹션 ─────────────────────────────────────
const PreSection = ({ sites }: { sites: any[] }) => {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        onClick={() => setOpen(p => !p)}
        className="w-full flex items-center justify-between rounded-xl border border-yellow-900/30 bg-yellow-950/10 px-4 py-3 hover:bg-yellow-950/20 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-yellow-400" />
          <span className="text-sm font-medium text-yellow-300">수주확정 · 투입전</span>
          <span className="text-xs text-gray-600">({sites.length}건)</span>
        </div>
        {open
          ? <ChevronDownIcon className="h-4 w-4 text-gray-500" />
          : <ChevronRightIcon className="h-4 w-4 text-gray-500" />}
      </button>
      {open && (
        <div className="mt-1.5 space-y-1.5">
          {sites.map(site => <SiteCard key={site.id} site={site} />)}
        </div>
      )}
    </div>
  );
};

// ── 완료/하자 섹션 ────────────────────────────────────────────
const DoneSection = ({ sites }: { sites: any[] }) => {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        onClick={() => setOpen(p => !p)}
        className="w-full flex items-center justify-between rounded-xl border border-gray-800 bg-black/20 px-4 py-3 hover:bg-gray-900/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <CheckCircleIcon className="h-4 w-4 text-blue-400" />
          <span className="text-sm font-medium text-gray-300">완료 · 하자기간</span>
          <span className="text-xs text-gray-600">({sites.length}건)</span>
        </div>
        {open
          ? <ChevronDownIcon className="h-4 w-4 text-gray-500" />
          : <ChevronRightIcon className="h-4 w-4 text-gray-500" />}
      </button>
      {open && (
        <div className="mt-1.5 space-y-1.5">
          {sites.map(site => <SiteCard key={site.id} site={site} dimmed />)}
        </div>
      )}
    </div>
  );
};

// ── 영업실패 섹션 ─────────────────────────────────────────────
const FailedSection = ({ sites, open, onToggle }: { sites: any[]; open: boolean; onToggle: () => void }) => (
  <div>
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between rounded-xl border border-gray-800/50 bg-black/10 px-4 py-3 hover:bg-gray-900/20 transition-colors"
    >
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-600">영업실패</span>
        <span className="text-xs text-gray-700">({sites.length}건)</span>
      </div>
      {open
        ? <ChevronDownIcon className="h-4 w-4 text-gray-700" />
        : <ChevronRightIcon className="h-4 w-4 text-gray-700" />}
    </button>
    {open && (
      <div className="mt-1.5 space-y-1.5 opacity-50">
        {sites.map(site => <SiteCard key={site.id} site={site} dimmed />)}
      </div>
    )}
  </div>
);

// ── 현장 카드 ──────────────────────────────────────────────────
const SiteCard = ({ site, dimmed = false }: { site: any; dimmed?: boolean }) => {
  const meta = getMeta(site.status);
  const alertLevel = getAlertLevel(site);
  const dday = getDday(site.deliveryDeadline);
  const progress = calcProgress(site);
  const issueCount = site._count?.issues ?? 0;
  const reqCount = site._count?.requests ?? 0;

  const ddayLabel = dday
    ? dday.overdue ? `D+${Math.abs(dday.diff)}` : dday.diff === 0 ? 'D-Day' : `D-${dday.diff}`
    : null;

  const cardBorder = dimmed
    ? 'border-l-gray-800 border-gray-800/50 bg-black/10 opacity-70 hover:opacity-90'
    : {
        critical: 'border-l-red-500/80 border-red-800/40 bg-red-950/10 hover:bg-red-950/20',
        warning:  'border-l-yellow-500/60 border-yellow-800/30 bg-yellow-950/5 hover:bg-yellow-950/10',
        normal:   'border-l-gray-700 border-gray-800 bg-black/20 hover:border-gray-600 hover:bg-gray-900/30',
      }[alertLevel];

  // 서브 텍스트: 수요기관 · 규격/사양
  const subParts = [
    site.client?.name,
    site.specification || site.productName,
    site.salesOwner || site.salesPm || site.createdBy?.name,
  ].filter(Boolean);

  return (
    <Link href={`/sites/${site.id}`}>
      <div className={`group rounded-lg border border-l-4 px-3.5 py-2.5 transition-all cursor-pointer ${cardBorder}`}>
        {/* 1행: 상태점 + 현장명 + 금액/D-Day/상태뱃지 */}
        <div className="flex items-center gap-2">
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${meta.dot}`} />
          <p className="text-sm font-semibold text-white truncate flex-1 min-w-0 group-hover:text-blue-300 transition-colors">
            {site.name}
          </p>
          <div className="flex items-center gap-1.5 shrink-0">
            {site.contractAmount && (
              <span className="text-xs text-blue-300 font-medium hidden sm:block">
                {fmtMoney(site.contractAmount)}원
              </span>
            )}
            {ddayLabel && (
              <span className={`text-[11px] px-1.5 py-0.5 rounded font-bold border ${
                dday?.overdue ? 'text-red-300 bg-red-900/30 border-red-700/50' :
                dday?.urgent  ? 'text-yellow-300 bg-yellow-900/20 border-yellow-700/40' :
                'text-gray-500 border-gray-700/40'
              }`}>{ddayLabel}</span>
            )}
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold border ${meta.badge}`}>
              {meta.label}
            </span>
          </div>
        </div>

        {/* 2행: 수요기관/규격 + 알림 + 공정률 */}
        <div className="flex items-center gap-3 mt-1 pl-3.5">
          <p className="text-xs text-gray-500 truncate flex-1 min-w-0">
            {subParts.join(' · ') || site.address || ''}
          </p>
          <div className="flex items-center gap-2 shrink-0">
            {(issueCount > 0 || reqCount > 0) && (
              <span className="flex items-center gap-0.5 text-[10px] text-red-400">
                <ExclamationTriangleIcon className="w-3 h-3" />
                {issueCount + reqCount}
              </span>
            )}
            {site.contractQuantity && meta.group !== 'sales' && (
              <div className="flex items-center gap-1.5">
                <div className="w-16 h-1 rounded-full bg-gray-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      progress >= 100 ? 'bg-blue-500' :
                      progress >= 80  ? 'bg-green-500' :
                      progress >= 40  ? 'bg-green-600' : 'bg-gray-600'
                    }`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span className={`text-[10px] font-bold tabular-nums ${
                  progress >= 80 ? 'text-green-400' : progress >= 40 ? 'text-blue-400' : 'text-gray-500'
                }`}>
                  {progress}%
                </span>
              </div>
            )}
            {meta.group === 'sales' && site.sales?.[0]?.estimateAmount && (
              <span className="text-[10px] text-orange-400/70">
                예상 {fmtMoney(site.sales[0].estimateAmount)}원
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
};

export async function getServerSideProps({ locale }: GetServerSidePropsContext) {
  return { props: { ...(locale ? await serverSideTranslations(locale, ['common']) : {}) } };
}

export default SitesList;
