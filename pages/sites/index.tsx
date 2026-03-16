/* eslint-disable i18next/no-literal-string */
import { GetServerSidePropsContext } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useState, useEffect, useCallback, useMemo } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import useSWR from 'swr';
import { PlusIcon, MagnifyingGlassIcon, ExclamationTriangleIcon, BellAlertIcon } from '@heroicons/react/24/outline';
import fetcher from '@/lib/fetcher';

const STATUS_DOT: Record<string, string> = {
  SALES_PIPELINE: 'bg-orange-500', SALES_CONFIRMED: 'bg-yellow-400',
  CONTRACT_ACTIVE: 'bg-green-500', COMPLETED: 'bg-blue-500',
  WARRANTY: 'bg-purple-500', FAILED: 'bg-gray-500',
  // 하위 호환
  영업중: 'bg-orange-500', 대기: 'bg-red-400', 계약완료: 'bg-yellow-400',
  진행중: 'bg-green-500', 부분완료: 'bg-green-300', 완료: 'bg-gray-400', 보류: 'bg-gray-600',
};
const STATUS_LABEL: Record<string, string> = {
  SALES_PIPELINE: '영업중', SALES_CONFIRMED: '수주확정',
  CONTRACT_ACTIVE: '진행중', COMPLETED: '준공완료',
  WARRANTY: '하자기간', FAILED: '영업실패',
};
const STATUS_FILTERS = [
  { key: 'all', label: '전체' },
  { key: 'CONTRACT_ACTIVE', label: '진행중' },
  { key: 'COMPLETED', label: '준공완료' },
  { key: 'WARRANTY', label: '하자기간' },
];

// 공정률: productionOrders의 supplyDate 있는 것 합산 / contractQuantity
const calcProgress = (site: any): number => {
  const contractQty = Number(site.contractQuantity ?? 0);
  if (contractQty > 0) {
    const delivered = (site.productionOrders ?? [])
      .filter((o: any) => o.supplyDate)
      .reduce((s: number, o: any) => s + Number(o.quantity ?? 0), 0);
    return Math.min(100, Math.round((delivered / contractQty) * 100));
  }
  // 폴백: status 기반
  const map: Record<string, number> = { CONTRACT_ACTIVE: 30, COMPLETED: 100, WARRANTY: 100 };
  return map[site.status] ?? 0;
};

const getDday = (dateVal: any) => {
  if (!dateVal) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(dateVal); d.setHours(0, 0, 0, 0);
  const diff = Math.ceil((d.getTime() - today.getTime()) / 86400000);
  return { diff, overdue: diff < 0, urgent: diff >= 0 && diff <= 14 };
};

const SitesList = () => {
  const [sites, setSites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [issueFilter, setIssueFilter] = useState(false);
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

  useEffect(() => { fetchSites(); }, [fetchSites]);

  const counts = useMemo(() => ({
    total: sites.length,
    active: sites.filter((s) => s.status === 'CONTRACT_ACTIVE').length,
    issue: sites.filter((s) => (s._count?.issues ?? 0) > 0).length,
    urgent: sites.filter((s) => {
      const dd = getDday(s.deliveryDeadline);
      return dd?.urgent || dd?.overdue;
    }).length,
  }), [sites]);

  const displayed = useMemo(() => {
    let filtered = sites;
    if (issueFilter) filtered = filtered.filter((s) => (s._count?.issues ?? s.issues?.length ?? 0) > 0);
    if (typeFilter !== 'all') filtered = filtered.filter((s) => (s.siteType || '납품설치도') === typeFilter);
    return filtered;
  }, [sites, issueFilter, typeFilter]);

  return (
    <>
      <Head><title>현장관리 | LOOKUP9</title></Head>
      <div className="space-y-4">

        {/* 헤더 */}
        <div className="flex items-end justify-between gap-3 rounded-2xl border border-gray-800 bg-black/30 p-4">
          <div>
            <h2 className="text-xl font-bold">현장관리</h2>
            <p className="mt-0.5 text-xs text-gray-500">
              {canCreate ? '전체 현장' : '배정된 현장'} · {sites.length}건
            </p>
          </div>
          {canCreate && (
            <Link href="/sites/create">
              <button className="btn btn-primary btn-sm gap-1.5">
                <PlusIcon className="h-4 w-4" />현장 등록
              </button>
            </Link>
          )}
        </div>

        {/* 요약 카드 */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <SummaryCard label="전체 현장" value={counts.total} />
          <SummaryCard label="진행중" value={counts.active} accent="blue" />
          <SummaryCard label="이슈 현장" value={counts.issue} accent="red"
            onClick={() => setIssueFilter((p) => !p)} active={issueFilter} />
          <SummaryCard label="납기 임박 (7일)" value={counts.urgent} accent="yellow" />
        </div>

        {/* 검색/필터 */}
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <div className="relative flex-1 min-w-0">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input type="text" className="input input-bordered w-full pl-10 text-sm"
              placeholder="현장명 또는 주소 검색"
              value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select className="select select-bordered text-sm w-full sm:w-36"
            value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">전체 상태</option>
            {[
              { v: 'CONTRACT_ACTIVE', l: '진행중' },
              { v: 'COMPLETED', l: '준공완료' },
              { v: 'WARRANTY', l: '하자기간' },
            ].map(({ v, l }) => <option key={v} value={v}>{l}</option>)}
          </select>
          <select className="select select-bordered text-sm w-full sm:w-36"
            value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="all">전체 유형</option>
            <option value="납품설치도">납품설치도</option>
            <option value="납품하차도">납품하차도</option>
          </select>
          {issueFilter && (
            <button className="btn btn-sm btn-error btn-outline gap-1.5" onClick={() => setIssueFilter(false)}>
              <ExclamationTriangleIcon className="h-4 w-4" />이슈 현장만 · 해제
            </button>
          )}
        </div>

        {/* 리스트 */}
        {loading ? (
          <div className="py-12 text-center"><span className="loading loading-spinner loading-md" /></div>
        ) : displayed.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-700 py-12 text-center text-gray-500">
            {issueFilter ? '이슈가 있는 현장이 없습니다.' : '조회된 현장이 없습니다.'}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            {displayed.map((site) => <SiteCard key={site.id} site={site} />)}
          </div>
        )}
      </div>
    </>
  );
};

const SiteCard = ({ site }: { site: any }) => {
  const progress = calcProgress(site);
  const dday = getDday(site.deliveryDeadline);
  const issueCount = site._count?.issues ?? 0;
  const hasAlert = issueCount > 0 || dday?.overdue;
  const siteType = site.siteType || '납품설치도';
  const isInstall = siteType === '납품설치도';
  const statusLabel = STATUS_LABEL[site.status] ?? site.status;

  return (
    <Link href={`/sites/${site.id}`}>
      <div className={`cursor-pointer rounded-xl border p-4 transition hover:bg-black/30
        ${hasAlert ? 'border-red-800/60 bg-red-950/10' : 'border-gray-800 bg-black/20 hover:border-gray-600'}`}>

        {/* 상단: 현장명 + 상태 */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className={`inline-block h-2 w-2 flex-shrink-0 rounded-full ${STATUS_DOT[site.status] || 'bg-gray-400'}`} />
              <h3 className="truncate text-sm font-bold">{site.name}</h3>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${isInstall ? 'bg-blue-900/40 text-blue-300' : 'bg-purple-900/40 text-purple-300'}`}>
                {siteType}
              </span>
              <span className="rounded-full border border-gray-700 px-2 py-0.5 text-[11px] text-gray-300">{statusLabel}</span>
            </div>
            <p className="mt-0.5 truncate text-xs text-gray-500">
              {site.client?.name ? `${site.client.name} · ` : ''}{site.address || '주소 미입력'}
            </p>
          </div>

          {/* 납기 D-day */}
          {site.deliveryDeadline && (
            <div className={`flex-shrink-0 rounded-lg border px-2 py-1 text-center text-[11px] leading-tight
              ${dday?.overdue ? 'border-red-500/50 bg-red-900/30 text-red-300'
              : dday?.urgent ? 'border-yellow-500/50 bg-yellow-900/20 text-yellow-300'
              : 'border-gray-700 text-gray-400'}`}>
              <div className="font-semibold">납기</div>
              <div>{dday?.overdue ? `+${Math.abs(dday.diff)}d` : `D-${dday?.diff}`}</div>
            </div>
          )}
        </div>

        {/* 진행률 바 */}
        {site.contractQuantity && (
          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between text-[11px] text-gray-400">
              <span>공정률</span>
              <span className="font-medium">{progress}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-800">
              <div className={`h-full rounded-full transition-all
                ${progress >= 100 ? 'bg-blue-500' : progress >= 60 ? 'bg-green-600' : 'bg-blue-600'}`}
                style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        {/* 계약 정보 */}
        {(site.contractQuantity || site.contractAmount) && (
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-gray-500">
            {site.contractQuantity && <span>계약 {Number(site.contractQuantity).toLocaleString()} m²</span>}
            {site.contractAmount && <span>{Math.round(Number(site.contractAmount) / 10000).toLocaleString()}만원</span>}
            {site.specification && <span>{site.specification}</span>}
          </div>
        )}

        {/* 알람 뱃지 */}
        {(issueCount > 0 || dday?.overdue) && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {issueCount > 0 && (
              <span className="flex items-center gap-1 rounded-full bg-red-900/40 px-2 py-0.5 text-[11px] font-semibold text-red-300">
                <ExclamationTriangleIcon className="h-3 w-3" />이슈 {issueCount}건
              </span>
            )}
            {dday?.overdue && (
              <span className="flex items-center gap-1 rounded-full bg-red-900/40 px-2 py-0.5 text-[11px] font-semibold text-red-300">
                <BellAlertIcon className="h-3 w-3" />납기 초과
              </span>
            )}
            {openRequestCount > 0 && (
              <span className="flex items-center gap-1 rounded-full bg-yellow-900/30 px-2 py-0.5 text-[11px] text-yellow-300">
                요청 {openRequestCount}건
              </span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
};

const SummaryCard = ({ label, value, accent, onClick, active }: {
  label: string; value: number; accent?: 'blue' | 'red' | 'yellow';
  onClick?: () => void; active?: boolean;
}) => {
  const colors = {
    blue: 'border-blue-900/50 bg-blue-950/20 text-blue-300',
    red: 'border-red-900/50 bg-red-950/20 text-red-300',
    yellow: 'border-yellow-900/50 bg-yellow-950/20 text-yellow-300',
  };
  const base = accent ? colors[accent] : 'border-gray-800 bg-black/20 text-gray-300';
  return (
    <button type="button" onClick={onClick}
      className={`rounded-xl border p-3 text-left transition ${base} ${active ? 'ring-2 ring-red-500' : ''} ${onClick ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}>
      <p className="text-[11px] text-gray-400">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </button>
  );
};

export async function getServerSideProps({ locale }: GetServerSidePropsContext) {
  return { props: { ...(locale ? await serverSideTranslations(locale, ['common']) : {}) } };
}

export default SitesList;
