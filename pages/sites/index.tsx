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
  DocumentArrowUpIcon, ClockIcon, FunnelIcon, CheckCircleIcon,
  ChevronDownIcon, ChevronRightIcon,
} from '@heroicons/react/24/outline';

// 상태 매핑
const STATUS_LABEL: Record<string, string> = {
  CONTRACT_ACTIVE: '진행중', COMPLETED: '준공완료',
  WARRANTY: '하자기간', FAILED: '영업실패',
  SALES_PIPELINE: '영업중', SALES_CONFIRMED: '수주확정',
  // 한글 legacy 상태도 처리
  '진행중': '진행중', '계약완료': '진행중', '부분완료': '진행중',
  '완료': '준공완료', '준공완료': '준공완료',
  '영업중': '영업중', '대기': '영업중',
};
const STATUS_DOT: Record<string, string> = {
  CONTRACT_ACTIVE: 'bg-green-400', COMPLETED: 'bg-blue-400',
  WARRANTY: 'bg-purple-400', FAILED: 'bg-gray-600',
  '진행중': 'bg-green-400', '계약완료': 'bg-yellow-400', '부분완료': 'bg-green-300',
  '완료': 'bg-blue-400', '준공완료': 'bg-blue-400',
};
const STATUS_BADGE: Record<string, string> = {
  CONTRACT_ACTIVE: 'text-green-300 bg-green-900/20',
  COMPLETED: 'text-blue-300 bg-blue-900/20',
  WARRANTY: 'text-purple-300 bg-purple-900/20',
  FAILED: 'text-gray-500 bg-gray-800/30',
  '진행중': 'text-green-300 bg-green-900/20',
  '계약완료': 'text-yellow-300 bg-yellow-900/20',
  '완료': 'text-blue-300 bg-blue-900/20',
};

const isActiveStatus = (s: string) =>
  ['CONTRACT_ACTIVE', '진행중', '계약완료', '부분완료'].includes(s);
const isCompletedStatus = (s: string) =>
  ['COMPLETED', 'WARRANTY', '완료', '준공완료', '하자기간'].includes(s);

const fmtMoney = (v: any) => {
  if (!v) return null;
  const n = Number(v);
  if (n >= 100000000) return `${(n / 100000000).toFixed(1)}억`;
  return `${Math.round(n / 10000).toLocaleString()}만`;
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
  if (qty <= 0) return isCompletedStatus(site.status) ? 100 : 0;
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

const SitesList = () => {
  const [sites, setSites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [alertOnly, setAlertOnly] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);

  const { data: profileData } = useSWR('/api/my/profile', fetcher);
  const role = profileData?.data?.role || 'USER';
  const canCreate = !['PARTNER', 'GUEST', 'VIEWER'].includes(role);

  const fetchSites = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    params.set('includeCompleted', 'true');
    const res = await fetch(`/api/sites?${params.toString()}`);
    if (res.ok) { const d = await res.json(); setSites(d.data || []); }
    setLoading(false);
  }, [search]);

  useEffect(() => {
    const t = setTimeout(fetchSites, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [fetchSites, search]);

  // 진행중 / 완료 분리
  const activeSites = useMemo(() =>
    sites.filter(s => isActiveStatus(s.status)), [sites]);
  const completedSites = useMemo(() =>
    sites.filter(s => isCompletedStatus(s.status)), [sites]);

  const counts = useMemo(() => ({
    total: activeSites.length,
    critical: activeSites.filter(s => getAlertLevel(s) === 'critical').length,
    warning: activeSites.filter(s => getAlertLevel(s) === 'warning').length,
    completed: completedSites.length,
  }), [activeSites, completedSites]);

  const LEVEL_ORDER: Record<AlertLevel, number> = { critical: 0, warning: 1, normal: 2 };
  const displayedActive = useMemo(() => {
    let list = [...activeSites];
    if (alertOnly) list = list.filter(s => ['critical', 'warning'].includes(getAlertLevel(s)));
    list.sort((a, b) => LEVEL_ORDER[getAlertLevel(a)] - LEVEL_ORDER[getAlertLevel(b)]);
    return list;
  }, [activeSites, alertOnly]);

  return (
    <>
      <Head><title>현장관리 | LOOKUP9</title></Head>
      <div className="space-y-3">

        {/* 헤더 */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">현장관리</h2>
            <p className="text-xs text-gray-500 mt-0.5">진행중 {counts.total}건 · 완료 {counts.completed}건</p>
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
            { label: '진행중', value: counts.total, color: 'border-gray-800 text-gray-300' },
            { label: '긴급', value: counts.critical, color: `border-red-900/50 text-red-300 ${alertOnly ? 'ring-1 ring-red-500' : ''}`, click: () => setAlertOnly(p => !p) },
            { label: '납기임박', value: counts.warning, color: 'border-yellow-900/50 text-yellow-300' },
            { label: '완료', value: counts.completed, color: 'border-blue-900/40 text-blue-400', click: () => setShowCompleted(p => !p) },
          ].map(chip => (
            <button key={chip.label} type="button" onClick={chip.click}
              className={`rounded-lg border px-2 py-2 text-center bg-black/20 transition ${chip.color}`}>
              <p className="text-base font-bold leading-none">{chip.value}</p>
              <p className="text-[10px] text-gray-600 mt-0.5">{chip.label}</p>
            </button>
          ))}
        </div>

        {/* 검색 + 필터 */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
            <input type="text" className="input input-bordered input-sm w-full pl-9 bg-black/20"
              placeholder="현장명, 수요기관 검색..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          {alertOnly && (
            <button className="btn btn-sm btn-error btn-outline gap-1" onClick={() => setAlertOnly(false)}>
              <FunnelIcon className="h-3.5 w-3.5" />해제
            </button>
          )}
        </div>

        {/* 진행중 현장 목록 */}
        {loading ? (
          <div className="py-12 text-center"><span className="loading loading-spinner loading-md text-gray-500" /></div>
        ) : displayedActive.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-700 py-12 text-center">
            <p className="text-sm text-gray-500">{alertOnly ? '긴급/임박 현장이 없습니다.' : '진행중인 현장이 없습니다.'}</p>
            {canCreate && !alertOnly && (
              <Link href="/sites/create">
                <button className="btn btn-ghost btn-sm mt-3 gap-1"><PlusIcon className="h-4 w-4" />현장 등록</button>
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-1.5">
            {displayedActive.map(site => <SiteCard key={site.id} site={site} />)}
          </div>
        )}

        {/* 완료/하자 현장 섹션 */}
        {completedSites.length > 0 && (
          <div>
            <button
              onClick={() => setShowCompleted(p => !p)}
              className="w-full flex items-center justify-between rounded-xl border border-gray-800 bg-black/20 px-4 py-3 hover:bg-gray-900/30 transition-colors"
            >
              <div className="flex items-center gap-2">
                <CheckCircleIcon className="h-4 w-4 text-blue-400" />
                <span className="text-sm font-medium text-gray-300">완료 현장</span>
                <span className="text-xs text-gray-600">({completedSites.length}건)</span>
              </div>
              {showCompleted
                ? <ChevronDownIcon className="h-4 w-4 text-gray-500" />
                : <ChevronRightIcon className="h-4 w-4 text-gray-500" />
              }
            </button>

            {showCompleted && (
              <div className="mt-1.5 space-y-1.5">
                {completedSites.map(site => <SiteCard key={site.id} site={site} dimmed />)}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
};

// ── 슬림 현장 카드 ──────────────────────────────────────
const SiteCard = ({ site, dimmed = false }: { site: any; dimmed?: boolean }) => {
  const alertLevel = isActiveStatus(site.status) ? getAlertLevel(site) : 'normal';
  const dday = getDday(site.deliveryDeadline);
  const progress = calcProgress(site);
  const issueCount = site._count?.issues ?? 0;
  const reqCount = site._count?.requests ?? 0;

  const cardBorder = dimmed
    ? 'border-l-gray-800 border-gray-800/50 bg-black/10 opacity-70 hover:opacity-90'
    : {
        critical: 'border-l-red-500/80 border-red-800/40 bg-red-950/10',
        warning:  'border-l-yellow-500/60 border-yellow-800/30 bg-yellow-950/5',
        normal:   'border-l-gray-700 border-gray-800 bg-black/20 hover:border-gray-700',
      }[alertLevel];

  const ddayLabel = dday
    ? dday.overdue ? `D+${Math.abs(dday.diff)}` : dday.diff === 0 ? 'D-Day' : `D-${dday.diff}`
    : null;

  const statusKey = site.status;
  const dotColor = STATUS_DOT[statusKey] || 'bg-gray-600';
  const badgeColor = STATUS_BADGE[statusKey] || 'text-gray-500 bg-gray-800/30';
  const statusLabel = STATUS_LABEL[statusKey] ?? statusKey;

  return (
    <Link href={`/sites/${site.id}`}>
      <div className={`group rounded-lg border border-l-4 px-3.5 py-2.5 transition-all cursor-pointer ${cardBorder}`}>
        {/* 1행: 상태점 + 현장명 + 뱃지들 */}
        <div className="flex items-center gap-2">
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} />
          <p className="text-sm font-semibold text-white truncate flex-1 min-w-0 group-hover:text-blue-300 transition-colors">
            {site.name}
          </p>
          <div className="flex items-center gap-1.5 shrink-0">
            {site.contractAmount && (
              <span className="text-xs text-blue-300 font-medium hidden sm:block">{fmtMoney(site.contractAmount)}원</span>
            )}
            {ddayLabel && (
              <span className={`text-[11px] px-1.5 py-0.5 rounded font-bold border ${
                dday?.overdue ? 'text-red-300 bg-red-900/30 border-red-700/50' :
                dday?.urgent  ? 'text-yellow-300 bg-yellow-900/20 border-yellow-700/40' :
                'text-gray-500 border-gray-700/40'
              }`}>{ddayLabel}</span>
            )}
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${badgeColor}`}>
              {statusLabel}
            </span>
          </div>
        </div>

        {/* 2행: 수요기관/규격 + 알림 + 공정률 */}
        <div className="flex items-center gap-3 mt-1 pl-3.5">
          <p className="text-xs text-gray-500 truncate flex-1 min-w-0">
            {[site.client?.name, site.specification || site.productName || site.address].filter(Boolean).join(' · ') || ''}
          </p>
          <div className="flex items-center gap-2 shrink-0">
            {(issueCount > 0 || reqCount > 0) && (
              <span className="flex items-center gap-0.5 text-[10px] text-red-400">
                <ExclamationTriangleIcon className="w-3 h-3" />
                {issueCount + reqCount}
              </span>
            )}
            {site.contractQuantity && isActiveStatus(site.status) && (
              <div className="flex items-center gap-1.5">
                <div className="w-16 h-1 rounded-full bg-gray-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${progress >= 80 ? 'bg-green-500' : progress >= 40 ? 'bg-blue-500' : 'bg-gray-600'}`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span className={`text-[10px] font-bold tabular-nums ${progress >= 80 ? 'text-green-400' : progress >= 40 ? 'text-blue-400' : 'text-gray-500'}`}>
                  {progress}%
                </span>
              </div>
            )}
            {isCompletedStatus(site.status) && (
              <span className="flex items-center gap-0.5 text-[10px] text-blue-400">
                <CheckCircleIcon className="w-3 h-3" />
                {statusLabel}
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
