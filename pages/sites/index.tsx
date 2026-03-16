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
  BellAlertIcon, DocumentArrowUpIcon, ClockIcon,
  CheckCircleIcon, FunnelIcon,
} from '@heroicons/react/24/outline';

// ── 상수 ──────────────────────────────────────────────
const STATUS_LABEL: Record<string, string> = {
  CONTRACT_ACTIVE: '진행중', COMPLETED: '준공완료',
  WARRANTY: '하자기간', FAILED: '영업실패',
};
const STATUS_DOT: Record<string, string> = {
  CONTRACT_ACTIVE: 'bg-green-400', COMPLETED: 'bg-blue-400',
  WARRANTY: 'bg-purple-400', FAILED: 'bg-gray-500',
};
const STATUS_BADGE: Record<string, string> = {
  CONTRACT_ACTIVE: 'text-green-300 bg-green-900/30 border-green-800/40',
  COMPLETED: 'text-blue-300 bg-blue-900/30 border-blue-800/40',
  WARRANTY: 'text-purple-300 bg-purple-900/30 border-purple-800/40',
  FAILED: 'text-gray-400 bg-gray-800/40 border-gray-700/40',
};

// ── 유틸 ──────────────────────────────────────────────
const fmtNum = (v: any) => v ? Number(v).toLocaleString('ko-KR') : '-';
const fmtMoney = (v: any) => {
  if (!v) return null;
  const n = Number(v);
  if (n >= 100000000) return `${(n / 100000000).toFixed(1)}억`;
  return `${Math.round(n / 10000).toLocaleString()}만`;
};
const fmtDateShort = (v: any) => {
  if (!v) return null;
  const d = new Date(v);
  return `${d.getMonth() + 1}/${d.getDate()}`;
};

const getDday = (dateVal: any) => {
  if (!dateVal) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(dateVal); d.setHours(0, 0, 0, 0);
  const diff = Math.ceil((d.getTime() - today.getTime()) / 86400000);
  return { diff, overdue: diff < 0, urgent: diff >= 0 && diff <= 14 };
};

// 공정률
const calcProgress = (site: any): number => {
  const qty = Number(site.contractQuantity ?? 0);
  if (qty <= 0) return site.status === 'COMPLETED' || site.status === 'WARRANTY' ? 100 : 0;
  const delivered = (site.productionOrders ?? [])
    .filter((o: any) => o.supplyDate)
    .reduce((s: number, o: any) => s + Number(o.quantity ?? 0), 0);
  return Math.min(100, Math.round((delivered / qty) * 100));
};

// 알람 레벨 판정 (정렬/강조용)
type AlertLevel = 'critical' | 'warning' | 'normal' | 'done';
const getAlertLevel = (site: any): AlertLevel => {
  const issueCount = site._count?.issues ?? 0;
  const dday = getDday(site.deliveryDeadline);
  if (issueCount > 0 && dday?.overdue) return 'critical';
  if (issueCount > 0 || dday?.overdue) return 'critical';
  if (dday?.urgent) return 'warning';
  if (site.status === 'COMPLETED' || site.status === 'WARRANTY') return 'done';
  return 'normal';
};

// ── 메인 ──────────────────────────────────────────────
const SitesList = () => {
  const [sites, setSites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [alertOnly, setAlertOnly] = useState(false);

  const { data: profileData } = useSWR('/api/my/profile', fetcher);
  const profile = profileData?.data;
  const role = profile?.role || profile?.teamMembers?.[0]?.role || 'USER';
  const canCreate = !['PARTNER', 'GUEST', 'VIEWER'].includes(role);

  const fetchSites = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (statusFilter !== 'all') params.set('status', statusFilter);
    const res = await fetch(`/api/sites?${params.toString()}`);
    if (res.ok) { const d = await res.json(); setSites(d.data || []); }
    setLoading(false);
  }, [search, statusFilter]);

  useEffect(() => {
    const t = setTimeout(fetchSites, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [fetchSites, search]);

  // 요약 카운트
  const counts = useMemo(() => ({
    total: sites.length,
    active: sites.filter(s => s.status === 'CONTRACT_ACTIVE').length,
    critical: sites.filter(s => getAlertLevel(s) === 'critical').length,
    warning: sites.filter(s => getAlertLevel(s) === 'warning').length,
  }), [sites]);

  // 필터 + 정렬: critical → warning → normal → done
  const displayed = useMemo(() => {
    const LEVEL_ORDER: Record<AlertLevel, number> = { critical: 0, warning: 1, normal: 2, done: 3 };
    let list = [...sites];
    if (typeFilter !== 'all') list = list.filter(s => (s.siteType || '납품설치도') === typeFilter);
    if (alertOnly) list = list.filter(s => ['critical', 'warning'].includes(getAlertLevel(s)));
    list.sort((a, b) => LEVEL_ORDER[getAlertLevel(a)] - LEVEL_ORDER[getAlertLevel(b)]);
    return list;
  }, [sites, typeFilter, alertOnly]);

  return (
    <>
      <Head><title>현장관리 | LOOKUP9</title></Head>
      <div className="space-y-3">

        {/* 헤더 */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">현장관리</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {canCreate ? '전체 현장' : '배정된 현장'} · {sites.length}건
            </p>
          </div>
          {canCreate && (
            <div className="flex gap-2">
              <Link href="/sites/create-from-pdf">
                <button className="btn btn-sm gap-1.5 border border-blue-700/60 bg-blue-950/30 text-blue-400 hover:bg-blue-950/60">
                  <DocumentArrowUpIcon className="h-4 w-4" />PDF로 생성
                </button>
              </Link>
              <Link href="/sites/create">
                <button className="btn btn-primary btn-sm gap-1.5">
                  <PlusIcon className="h-4 w-4" />현장 등록
                </button>
              </Link>
            </div>
          )}
        </div>

        {/* 요약 카운터 */}
        <div className="grid grid-cols-4 gap-2">
          <SummaryChip label="전체" value={counts.total} color="gray" />
          <SummaryChip label="진행중" value={counts.active} color="green" />
          <SummaryChip
            label="긴급" value={counts.critical} color="red"
            active={alertOnly} onClick={() => setAlertOnly(p => !p)}
          />
          <SummaryChip
            label="임박(14일)" value={counts.warning} color="yellow"
          />
        </div>

        {/* 검색 + 필터 */}
        <div className="flex gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[160px]">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              className="input input-bordered input-sm w-full pl-9 bg-black/20 text-sm"
              placeholder="현장명, 수요기관 검색..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select
            className="select select-bordered select-sm bg-black/20 text-sm w-auto"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="all">전체 상태</option>
            <option value="CONTRACT_ACTIVE">진행중</option>
            <option value="COMPLETED">준공완료</option>
            <option value="WARRANTY">하자기간</option>
          </select>
          <select
            className="select select-bordered select-sm bg-black/20 text-sm w-auto"
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
          >
            <option value="all">전체 유형</option>
            <option value="납품설치도">납품설치도</option>
            <option value="납품하차도">납품하차도</option>
          </select>
          {alertOnly && (
            <button
              className="btn btn-sm btn-error btn-outline gap-1"
              onClick={() => setAlertOnly(false)}
            >
              <FunnelIcon className="h-3.5 w-3.5" />긴급만 · 해제
            </button>
          )}
        </div>

        {/* 현장 목록 */}
        {loading ? (
          <div className="py-16 text-center">
            <span className="loading loading-spinner loading-md text-gray-500" />
          </div>
        ) : displayed.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-700 py-16 text-center">
            <p className="text-sm text-gray-500">
              {alertOnly ? '긴급/임박 현장이 없습니다.' : '조회된 현장이 없습니다.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {displayed.map(site => (
              <SiteCard key={site.id} site={site} />
            ))}
          </div>
        )}
      </div>
    </>
  );
};

// ── 요약 칩 ──────────────────────────────────────────
const CHIP_COLOR: Record<string, string> = {
  gray: 'border-gray-800 bg-black/20 text-gray-300',
  green: 'border-green-900/50 bg-green-950/20 text-green-300',
  red: 'border-red-900/50 bg-red-950/20 text-red-300',
  yellow: 'border-yellow-900/50 bg-yellow-950/20 text-yellow-300',
};
const SummaryChip = ({ label, value, color, onClick, active }: {
  label: string; value: number; color: string;
  onClick?: () => void; active?: boolean;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`rounded-xl border px-3 py-2.5 text-center transition
      ${CHIP_COLOR[color] || CHIP_COLOR.gray}
      ${active ? 'ring-2 ring-red-500 ring-offset-1 ring-offset-black' : ''}
      ${onClick ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
  >
    <p className="text-lg font-bold leading-none">{value}</p>
    <p className="text-[10px] text-gray-500 mt-1">{label}</p>
  </button>
);

// ── 현장 카드 ──────────────────────────────────────────
const SiteCard = ({ site }: { site: any }) => {
  const alertLevel = getAlertLevel(site);
  const dday = getDday(site.deliveryDeadline);
  const progress = calcProgress(site);
  const issueCount = site._count?.issues ?? 0;
  const siteType = site.siteType || '납품설치도';
  const statusLabel = STATUS_LABEL[site.status] ?? site.status;

  // 테두리/배경 색상
  const cardStyle = {
    critical: 'border-red-700/70 bg-red-950/15 shadow-[0_0_0_1px_rgba(239,68,68,0.15)]',
    warning:  'border-yellow-700/50 bg-yellow-950/10',
    normal:   'border-gray-800 bg-black/20 hover:border-gray-600',
    done:     'border-gray-800/50 bg-black/10 opacity-70',
  }[alertLevel];

  // D-day 뱃지 스타일
  const ddayStyle = dday?.overdue
    ? 'border-red-500/60 bg-red-900/40 text-red-300 font-bold'
    : dday?.urgent
    ? 'border-yellow-500/50 bg-yellow-900/30 text-yellow-300 font-bold'
    : 'border-gray-700 text-gray-400';

  const ddayLabel = dday
    ? dday.overdue
      ? `D+${Math.abs(dday.diff)}`
      : dday.diff === 0
      ? 'D-Day'
      : `D-${dday.diff}`
    : null;

  return (
    <Link href={`/sites/${site.id}`}>
      <div className={`group cursor-pointer rounded-xl border p-3.5 transition-all hover:shadow-md ${cardStyle}`}>

        {/* ── 상단 행: 현장명 + D-day + 상태 ── */}
        <div className="flex items-start justify-between gap-2">

          {/* 왼쪽: 현장명 */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 flex-shrink-0 rounded-full ${STATUS_DOT[site.status] || 'bg-gray-500'}`} />
              <h3 className="truncate text-sm font-bold text-white group-hover:text-blue-300 transition-colors">
                {site.name}
              </h3>
            </div>
            <p className="mt-0.5 truncate text-xs text-gray-500 pl-4">
              {[site.client?.name, site.address].filter(Boolean).join(' · ') || '주소 미입력'}
            </p>
          </div>

          {/* 오른쪽: D-day + 상태 뱃지 */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {ddayLabel && (
              <span className={`rounded-lg border px-2 py-0.5 text-[11px] ${ddayStyle}`}>
                {ddayLabel}
              </span>
            )}
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${STATUS_BADGE[site.status] || 'text-gray-400 bg-gray-800/40 border-gray-700/40'}`}>
              {statusLabel}
            </span>
          </div>
        </div>

        {/* ── 핵심 지표 행 ── */}
        <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 pl-4 text-xs">
          {/* 계약물량 */}
          {site.contractQuantity && (
            <span className="text-gray-400">
              <span className="text-gray-600 text-[10px]">물량</span>
              {' '}<span className="font-medium text-gray-200">{fmtNum(site.contractQuantity)} m²</span>
            </span>
          )}
          {/* 계약금액 */}
          {site.contractAmount && (
            <span className="text-gray-400">
              <span className="text-gray-600 text-[10px]">금액</span>
              {' '}<span className="font-medium text-blue-300">{fmtMoney(site.contractAmount)}원</span>
            </span>
          )}
          {/* 납품기한 */}
          {site.deliveryDeadline && (
            <span className={dday?.overdue ? 'text-red-400' : dday?.urgent ? 'text-yellow-400' : 'text-gray-400'}>
              <span className="text-gray-600 text-[10px]">납기</span>
              {' '}<span className="font-medium">{new Date(site.deliveryDeadline).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })}</span>
            </span>
          )}
          {/* 납품유형 */}
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold
            ${siteType === '납품설치도' ? 'bg-blue-900/30 text-blue-400' : 'bg-purple-900/30 text-purple-400'}`}>
            {siteType}
          </span>
        </div>

        {/* ── 공정률 바 ── */}
        {site.contractQuantity && site.status === 'CONTRACT_ACTIVE' && (
          <div className="mt-2.5 pl-4">
            <div className="flex items-center justify-between text-[10px] text-gray-500 mb-1">
              <span>공정률</span>
              <span className={`font-semibold ${progress >= 100 ? 'text-blue-400' : progress >= 60 ? 'text-green-400' : 'text-gray-300'}`}>
                {progress}%
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-800/80">
              <div
                className={`h-full rounded-full transition-all duration-500
                  ${progress >= 100 ? 'bg-blue-500' : progress >= 60 ? 'bg-green-500' : 'bg-blue-600'}`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* ── 알람 뱃지 행 ── */}
        {(issueCount > 0 || dday?.overdue || dday?.urgent) && (
          <div className="mt-2 pl-4 flex flex-wrap gap-1.5">
            {issueCount > 0 && (
              <span className="flex items-center gap-1 rounded-full bg-red-900/40 border border-red-800/30 px-2 py-0.5 text-[10px] font-semibold text-red-300">
                <ExclamationTriangleIcon className="h-3 w-3" />이슈 {issueCount}건
              </span>
            )}
            {dday?.overdue && (
              <span className="flex items-center gap-1 rounded-full bg-red-900/40 border border-red-800/30 px-2 py-0.5 text-[10px] font-semibold text-red-300">
                <BellAlertIcon className="h-3 w-3" />납기 {Math.abs(dday.diff)}일 초과
              </span>
            )}
            {!dday?.overdue && dday?.urgent && (
              <span className="flex items-center gap-1 rounded-full bg-yellow-900/30 border border-yellow-800/30 px-2 py-0.5 text-[10px] font-semibold text-yellow-300">
                <ClockIcon className="h-3 w-3" />납기 {dday.diff}일 남음
              </span>
            )}
          </div>
        )}

        {/* 준공/하자 완료 현장 */}
        {(site.status === 'COMPLETED' || site.status === 'WARRANTY') && (
          <div className="mt-2 pl-4 flex items-center gap-1.5 text-[10px] text-gray-600">
            <CheckCircleIcon className="h-3.5 w-3.5 text-blue-600" />
            {site.status === 'COMPLETED' ? '준공 완료' : '하자보수 기간'}
            {site.completionDate && (
              <span>· 준공 {new Date(site.completionDate).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })}</span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
};

export async function getServerSideProps({ locale }: GetServerSidePropsContext) {
  return { props: { ...(locale ? await serverSideTranslations(locale, ['common']) : {}) } };
}

export default SitesList;
