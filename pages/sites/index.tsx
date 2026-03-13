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
  영업중: 'bg-red-500', 대기: 'bg-red-400', 계약완료: 'bg-yellow-400',
  진행중: 'bg-green-500', 부분완료: 'bg-green-300', 완료: 'bg-gray-400', 보류: 'bg-gray-600',
};
const STATUS_PROGRESS: Record<string, number> = {
  영업중: 12, 대기: 8, 계약완료: 35, 진행중: 65, 부분완료: 85, 완료: 100, 보류: 0,
};

// 계약 기반 실진행률 계산: 출하합계/계약물량
const calcProgress = (site: any): number => {
  const contract = site.contracts?.find((c: any) => !c.isAdditional);
  const totalQty = Number(contract?.quantity ?? 0);
  if (totalQty > 0) {
    const shipped = (site.shipments ?? []).reduce((s: number, r: any) => s + Number(r.quantity ?? 0), 0);
    return Math.min(100, Math.round((shipped / totalQty) * 100));
  }
  return STATUS_PROGRESS[site.status] ?? 0;
};

const getDeadline = (site: any): string | null => {
  // description에서 납품기한 파싱 (기존 데이터 하위 호환)
  const match = site.description?.match(/납품기한\s*[:：]\s*(\d{4}-\d{2}-\d{2})/);
  return match?.[1] || null;
};

const getDday = (dateStr: string | null) => {
  if (!dateStr) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr); d.setHours(0, 0, 0, 0);
  const diff = Math.ceil((d.getTime() - today.getTime()) / 86400000);
  return { diff, overdue: diff < 0, urgent: diff >= 0 && diff <= 7 };
};

const SitesList = () => {
  const [sites, setSites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
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
    active: sites.filter((s) => ['진행중', '부분완료'].includes(s.status)).length,
    issue: sites.filter((s) => (s._count?.issues ?? s.issues?.length ?? 0) > 0).length,
    urgent: sites.filter((s) => { const dd = getDday(getDeadline(s)); return dd?.urgent || dd?.overdue; }).length,
  }), [sites]);

  const displayed = useMemo(() =>
    issueFilter
      ? sites.filter((s) => (s._count?.issues ?? s.issues?.length ?? 0) > 0)
      : sites,
    [sites, issueFilter]);

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
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input type="text" className="input input-bordered w-full pl-10 text-sm"
              placeholder="현장명 또는 주소 검색"
              value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select className="select select-bordered w-full text-sm sm:w-40"
            value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">전체 상태</option>
            {['영업중','계약완료','진행중','부분완료','완료','보류'].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          {issueFilter && (
            <button className="btn btn-sm btn-error btn-outline gap-1.5" onClick={() => setIssueFilter(false)}>
              <ExclamationTriangleIcon className="h-4 w-4" />이슈 현장만 보는 중 · 해제
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
  const deadline = getDeadline(site);
  const dday = getDday(deadline);
  const issueCount = site._count?.issues ?? site.issues?.length ?? 0;
  const openRequestCount = (site.requests ?? []).filter((r: any) => !['완료', '반려'].includes(r.status)).length;
  const contract = site.contracts?.find((c: any) => !c.isAdditional);
  const hasAlert = issueCount > 0 || dday?.overdue;

  return (
    <Link href={`/sites/${site.id}`}>
      <div className={`cursor-pointer rounded-xl border p-4 transition hover:bg-black/30
        ${hasAlert ? 'border-red-800/60 bg-red-950/10' : 'border-gray-800 bg-black/20 hover:border-gray-600'}`}>

        {/* 상단: 현장명 + 상태 */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-block h-2 w-2 flex-shrink-0 rounded-full ${STATUS_DOT[site.status] || 'bg-gray-400'}`} />
              <h3 className="truncate text-sm font-bold">{site.name}</h3>
              <span className="rounded-full border border-gray-700 px-2 py-0.5 text-[11px] text-gray-300">{site.status}</span>
            </div>
            <p className="mt-0.5 truncate text-xs text-gray-500">
              {site.client?.name ? `${site.client.name} · ` : ''}{site.address || '주소 미입력'}
            </p>
          </div>

          {/* 납기 D-day */}
          {deadline && (
            <div className={`flex-shrink-0 rounded-lg border px-2 py-1 text-center text-[11px] leading-tight
              ${dday?.overdue ? 'border-red-500/50 bg-red-900/30 text-red-300'
              : dday?.urgent ? 'border-yellow-500/50 bg-yellow-900/20 text-yellow-300'
              : 'border-gray-700 text-gray-400'}`}>
              <div className="font-semibold">납기</div>
              <div>{dday?.overdue ? '초과' : `D-${dday?.diff}`}</div>
            </div>
          )}
        </div>

        {/* 진행률 바 */}
        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between text-[11px] text-gray-400">
            <span>진행률</span>
            <span className="font-medium">{progress}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-800">
            <div className={`h-full rounded-full transition-all
              ${progress >= 100 ? 'bg-gray-500' : progress >= 60 ? 'bg-green-600' : 'bg-blue-600'}`}
              style={{ width: `${progress}%` }} />
          </div>
        </div>

        {/* 계약 정보 요약 */}
        {contract && (
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-gray-500">
            {contract.quantity && <span>계약 {Number(contract.quantity).toLocaleString()} m²</span>}
            {contract.contractAmount && <span>금액 {Math.round(Number(contract.contractAmount) / 10000).toLocaleString()}만원</span>}
            {contract.specification && <span>{contract.specification}</span>}
          </div>
        )}

        {/* 알람 뱃지 영역 */}
        {(issueCount > 0 || openRequestCount > 0 || dday?.overdue) && (
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
