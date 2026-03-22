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
import PullToRefresh from '@/components/shared/PullToRefresh';

// ── 상태 정의 (버그 수정: group 타입에 'pre' 추가) ─────────────────
type StatusGroup = 'active' | 'sales' | 'pre' | 'done';
const STATUS_META: Record<string, { label: string; dot: string; group: StatusGroup }> = {
  SALES_PIPELINE:  { label: '영업중',   dot: 'bg-orange-400', group: 'sales' },
  SALES_CONFIRMED: { label: '수주확정', dot: 'bg-yellow-400', group: 'pre' },
  CONTRACT_ACTIVE: { label: '진행중',   dot: 'bg-green-400',  group: 'active' },
  COMPLETED:       { label: '준공완료', dot: 'bg-blue-400',   group: 'done' },
  WARRANTY:        { label: '하자기간', dot: 'bg-purple-400', group: 'done' },
  FAILED:          { label: '영업실패', dot: 'bg-gray-500',   group: 'done' },
};

const getMeta = (status: string) =>
  STATUS_META[status] ?? { label: status, dot: 'bg-gray-500', group: 'active' as StatusGroup };

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
  const deliveredByProd = (site.productionOrders ?? []).filter((o: any) => o.supplyDate).reduce((s: number, o: any) => s + Number(o.quantity ?? 0), 0);
  const deliveredByShip = (site.shipments ?? []).reduce((s: number, r: any) => s + Number(r.quantity ?? 0), 0);
  return Math.min(100, Math.round((Math.max(deliveredByProd, deliveredByShip) / qty) * 100));
};

type AlertLevel = 'critical' | 'warning' | 'normal';
const getAlertLevel = (site: any): AlertLevel => {
  const dday = getDday(site.deliveryDeadline);
  if (site.hasIssue || dday?.overdue) return 'critical';
  if (dday?.urgent) return 'warning';
  return 'normal';
};

// ── 탭 필터 ────────────────────────────────────────────
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

  const handleRefresh = useCallback(async () => {
    await fetchSites();
  }, [fetchSites]);

  // 그룹 분류
  const salesSites   = useMemo(() => sites.filter(s => getMeta(s.status).group === 'sales'), [sites]);
  const preSites     = useMemo(() => sites.filter(s => getMeta(s.status).group === 'pre'), [sites]);
  const activeSites  = useMemo(() => sites.filter(s => getMeta(s.status).group === 'active'), [sites]);
  const doneSites    = useMemo(() => sites.filter(s => getMeta(s.status).group === 'done' && s.status !== 'FAILED'), [sites]);
  const failedSites  = useMemo(() => sites.filter(s => s.status === 'FAILED'), [sites]);

  const tabSites = useMemo(() => {
    if (tab === 'active') return activeSites;
    if (tab === 'done')   return doneSites;
    return activeSites; // 'all' 탭: 메인 리스트는 진행중, 나머지는 그룹 섹션으로
  }, [tab, activeSites, doneSites]);

  const LEVEL_ORDER: Record<AlertLevel, number> = { critical: 0, warning: 1, normal: 2 };
  const displaySites = useMemo(() => {
    let list = [...tabSites];
    if (alertOnly) list = list.filter(s => ['critical', 'warning'].includes(getAlertLevel(s)));
    list.sort((a, b) => LEVEL_ORDER[getAlertLevel(a)] - LEVEL_ORDER[getAlertLevel(b)]);
    return list;
  }, [tabSites, alertOnly]);

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
      <PullToRefresh onRefresh={handleRefresh}>
        <div className="space-y-3">

          {/* 헤더 */}
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold" style={{color:"var(--text-primary)"}}>현장관리</h2>
              <p className="text-xs mt-0.5" style={{color:"var(--text-muted)"}}>
                투입전 {counts.pre} · 진행중 {counts.active} · 완료 {counts.done}
              </p>
            </div>
            {canCreate && (
              <div className="flex gap-2">
                <Link href="/sites/create-from-pdf">
                  <button className="btn btn-sm gap-1" style={{border:"1px solid var(--info-border)",backgroundColor:"var(--info-bg)",color:"var(--info-text)"}}>
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

          {/* 요약 칩 — CSS 변수 기반 */}
          <div className="grid grid-cols-4 gap-1.5">
            {[
              { label: '투입전', value: counts.pre,      bgVar: '--warning-bg', borderVar: '--warning-border', colorVar: '--warning-text' },
              { label: '진행중', value: counts.active,   bgVar: '--success-bg', borderVar: '--success-border', colorVar: '--success-text' },
              { label: '긴급',   value: counts.critical, bgVar: '--danger-bg',  borderVar: '--danger-border',  colorVar: '--danger-text', click: () => setAlertOnly(p => !p), ring: alertOnly },
              { label: '완료',   value: counts.done,     bgVar: '--info-bg',    borderVar: '--info-border',    colorVar: '--info-text' },
            ].map(chip => (
              <button key={chip.label} type="button" onClick={chip.click}
                className="rounded-xl px-2 py-2.5 text-center transition-all active:scale-[0.97]"
                style={{
                  backgroundColor: `var(${chip.bgVar})`,
                  border: `1px solid var(${chip.borderVar})`,
                  ...(chip.ring ? { boxShadow: '0 0 0 2px var(--danger-text)' } : {}),
                }}>
                <p className="text-lg font-bold leading-none" style={{color:`var(${chip.colorVar})`}}>{chip.value}</p>
                <p className="text-[10px] mt-1" style={{color:"var(--text-muted)"}}>{chip.label}</p>
              </button>
            ))}
          </div>

          {/* 탭 */}
          <div className="flex gap-1" style={{borderBottom:"1px solid var(--border-base)"}}>
            {TAB_DEFS.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className="px-3 py-2 text-xs font-medium rounded-t transition-colors -mb-px"
                style={{
                  color: tab === t.key ? 'var(--brand)' : 'var(--text-muted)',
                  borderBottom: tab === t.key ? '2px solid var(--brand)' : '2px solid transparent',
                  backgroundColor: tab === t.key ? 'var(--brand-light)' : 'transparent',
                }}
              >
                {t.label}
                <span className="ml-1 text-[10px] opacity-60">
                  {t.key === 'active' ? counts.active :
                   t.key === 'done'   ? counts.done :
                   salesSites.length + counts.pre + counts.active + counts.done}
                </span>
              </button>
            ))}
          </div>

          {/* 검색 */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{color:"var(--text-muted)"}} />
              <input
                type="text"
                className="input input-bordered input-sm w-full pl-9"
                style={{backgroundColor:"var(--input-bg)"}}
                placeholder="현장명, 수요기관, 시공업체, 규격, 담당자..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            {alertOnly && (
              <button className="btn btn-sm gap-1" style={{border:"1px solid var(--danger-border)",color:"var(--danger-text)"}} onClick={() => setAlertOnly(false)}>
                <FunnelIcon className="h-3.5 w-3.5" />해제
              </button>
            )}
          </div>

          {/* 현장 목록 */}
          {loading ? (
            <div className="py-12 text-center">
              <span className="loading loading-spinner loading-md" style={{color:"var(--text-muted)"}} />
            </div>
          ) : (tab === 'all' && salesSites.length + preSites.length + activeSites.length + doneSites.length + failedSites.length === 0) || (tab !== 'all' && displaySites.length === 0) ? (
            <div className="rounded-xl border-2 border-dashed py-12 text-center" style={{borderColor:"var(--border-base)"}}>
              <p className="text-sm" style={{color:"var(--text-muted)"}}>
                {alertOnly ? '긴급/임박 현장이 없습니다.' : '현장이 없습니다.'}
              </p>
              {canCreate && !alertOnly && (
                <div className="mt-3 flex justify-center gap-2">
                  <Link href="/sites/create-from-pdf">
                    <button className="btn btn-ghost btn-sm gap-1" style={{color:"var(--info-text)"}}>
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
          ) : tab === 'all' ? (
            /* ── 전체 탭: 그룹별로 묶어서 표시 ── */
            <div className="space-y-3">
              {/* 진행중 — 기본 펼침 */}
              {activeSites.length > 0 && (
                <CollapsibleSection
                  label="진행중"
                  count={activeSites.length}
                  dotColor="bg-green-500"
                  bgVar="--success-bg"
                  borderVar="--success-border"
                  textVar="--success-text"
                  defaultOpen={true}
                >
                  {activeSites
                    .filter(s => !alertOnly || ['critical','warning'].includes(getAlertLevel(s)))
                    .sort((a,b) => LEVEL_ORDER[getAlertLevel(a)] - LEVEL_ORDER[getAlertLevel(b)])
                    .map(site => <SiteCard key={site.id} site={site} />)}
                </CollapsibleSection>
              )}

              {/* 영업중 — 접이식 */}
              {salesSites.length > 0 && (
                <CollapsibleSection
                  label="영업중"
                  count={salesSites.length}
                  dotColor="bg-orange-400"
                  bgVar="--warning-bg"
                  borderVar="--warning-border"
                  textVar="--warning-text"
                >
                  {salesSites.map(site => <SiteCard key={site.id} site={site} />)}
                </CollapsibleSection>
              )}

              {/* 수주확정 · 투입전 — 접이식 */}
              {preSites.length > 0 && (
                <CollapsibleSection
                  label="수주확정 · 투입전"
                  count={preSites.length}
                  dotColor="bg-yellow-400"
                  bgVar="--warning-bg"
                  borderVar="--warning-border"
                  textVar="--warning-text"
                >
                  {preSites.map(site => <SiteCard key={site.id} site={site} />)}
                </CollapsibleSection>
              )}

              {/* 완료 · 하자기간 — 접이식 */}
              {doneSites.length > 0 && (
                <CollapsibleSection
                  label="완료 · 하자기간"
                  count={doneSites.length}
                  icon={<CheckCircleIcon className="h-4 w-4" style={{color:"var(--info-text)"}} />}
                  bgVar="--bg-card"
                  borderVar="--border-base"
                  textVar="--text-secondary"
                >
                  {doneSites.map(site => <SiteCard key={site.id} site={site} dimmed />)}
                </CollapsibleSection>
              )}

              {/* 영업실패 — 접이식 */}
              {failedSites.length > 0 && (
                <CollapsibleSection
                  label="영업실패"
                  count={failedSites.length}
                  bgVar="--bg-card"
                  borderVar="--border-base"
                  textVar="--text-muted"
                  defaultOpen={false}
                >
                  <div className="opacity-50">
                    {failedSites.map(site => <SiteCard key={site.id} site={site} dimmed />)}
                  </div>
                </CollapsibleSection>
              )}
            </div>
          ) : (
            /* ── 진행중 / 완료 탭: 단일 리스트 ── */
            <div className="space-y-1.5">
              {displaySites.map(site => <SiteCard key={site.id} site={site} />)}
            </div>
          )}
        </div>
      </PullToRefresh>
    </>
  );
};

// ── 접이식 섹션 (통합) ──────────────────────────────────
const CollapsibleSection = ({ label, count, dotColor, icon, bgVar, borderVar, textVar, defaultOpen = false, children }: {
  label: string; count: number; dotColor?: string; icon?: React.ReactNode;
  bgVar: string; borderVar: string; textVar: string; defaultOpen?: boolean; children: React.ReactNode;
}) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        onClick={() => setOpen(p => !p)}
        className="w-full flex items-center justify-between rounded-xl px-4 py-3 transition-all active:scale-[0.99]"
        style={{ backgroundColor: `var(${bgVar})`, border: `1px solid var(${borderVar})` }}
      >
        <div className="flex items-center gap-2">
          {dotColor && <span className={`w-2 h-2 rounded-full ${dotColor}`} />}
          {icon}
          <span className="text-sm font-medium" style={{color:`var(${textVar})`}}>{label}</span>
          <span className="text-xs" style={{color:"var(--text-muted)"}}>({count}건)</span>
        </div>
        {open
          ? <ChevronDownIcon className="h-4 w-4" style={{color:"var(--text-muted)"}} />
          : <ChevronRightIcon className="h-4 w-4" style={{color:"var(--text-muted)"}} />}
      </button>
      {open && (
        <div className="mt-1.5 space-y-1.5 slide-up">
          {children}
        </div>
      )}
    </div>
  );
};

// ── 현장 카드 — 테마 안전 ──────────────────────────────────
const SiteCard = ({ site, dimmed = false }: { site: any; dimmed?: boolean }) => {
  const meta = getMeta(site.status);
  const alertLevel = getAlertLevel(site);
  const dday = getDday(site.deliveryDeadline);
  const progress = calcProgress(site);
  const reqCount = site._count?.requests ?? 0;
  const hasIssue = site.hasIssue || false;

  const ddayLabel = dday
    ? dday.overdue ? `D+${Math.abs(dday.diff)}` : dday.diff === 0 ? 'D-Day' : `D-${dday.diff}`
    : null;

  // 테마 안전 border 스타일
  const getBorderStyle = () => {
    if (dimmed) return { borderLeft: '4px solid var(--border-base)', border: '1px solid var(--border-base)', backgroundColor: 'var(--bg-card)', opacity: 0.7 };
    switch (alertLevel) {
      case 'critical': return { borderLeft: '4px solid var(--danger-text)', border: '1px solid var(--danger-border)', backgroundColor: 'var(--danger-bg)' };
      case 'warning': return { borderLeft: '4px solid var(--warning-text)', border: '1px solid var(--warning-border)', backgroundColor: 'var(--warning-bg)' };
      default: return { borderLeft: '4px solid var(--border-base)', border: '1px solid var(--border-base)', backgroundColor: 'var(--bg-card)' };
    }
  };

  const subParts = [
    site.client?.name,
    site.specification || site.productName,
    site.installerName || site.salesOwner || site.salesPm,
  ].filter(Boolean);

  return (
    <Link href={`/sites/${site.id}`}>
      <div
        className="group rounded-xl px-3.5 py-3 transition-all cursor-pointer active:scale-[0.99]"
        style={getBorderStyle()}
      >
        {/* 1행: 상태점 + 현장명 + D-Day/상태뱃지 */}
        <div className="flex items-center gap-2">
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${meta.dot}`} />
          <p className="text-sm font-semibold truncate flex-1 min-w-0" style={{color:"var(--text-primary)"}}>
            {site.name}
          </p>
          <div className="flex items-center gap-1.5 shrink-0">
            {site.contractAmount && (
              <span className="text-xs font-medium hidden sm:block" style={{color:"var(--info-text)"}}>
                {fmtMoney(site.contractAmount)}원
              </span>
            )}
            {ddayLabel && (
              <span
                className="text-[11px] px-1.5 py-0.5 rounded font-bold"
                style={{
                  color: dday?.overdue ? 'var(--danger-text)' : dday?.urgent ? 'var(--warning-text)' : 'var(--text-muted)',
                  backgroundColor: dday?.overdue ? 'var(--danger-bg)' : dday?.urgent ? 'var(--warning-bg)' : 'transparent',
                  border: `1px solid ${dday?.overdue ? 'var(--danger-border)' : dday?.urgent ? 'var(--warning-border)' : 'var(--border-base)'}`,
                }}
              >{ddayLabel}</span>
            )}
            <span
              className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
              style={{
                color: `var(${
                  meta.group === 'active' ? '--success-text' :
                  meta.group === 'pre' ? '--warning-text' :
                  meta.group === 'sales' ? '--warning-text' :
                  '--text-muted'
                })`,
                backgroundColor: `var(${
                  meta.group === 'active' ? '--success-bg' :
                  meta.group === 'pre' ? '--warning-bg' :
                  meta.group === 'sales' ? '--warning-bg' :
                  '--bg-hover'
                })`,
                border: `1px solid var(${
                  meta.group === 'active' ? '--success-border' :
                  meta.group === 'pre' ? '--warning-border' :
                  meta.group === 'sales' ? '--warning-border' :
                  '--border-base'
                })`,
              }}
            >
              {meta.label}
            </span>
          </div>
        </div>

        {/* 2행: 서브정보 + 이슈 + 공정률 */}
        <div className="flex items-center gap-3 mt-1.5 pl-3.5">
          <p className="text-xs truncate flex-1 min-w-0" style={{color:"var(--text-muted)"}}>
            {subParts.join(' · ') || site.address || ''}
          </p>
          <div className="flex items-center gap-2 shrink-0">
            {(hasIssue || reqCount > 0) && (
              <span className="flex items-center gap-0.5 text-[10px]" style={{color:"var(--danger-text)"}}>
                <ExclamationTriangleIcon className="w-3 h-3" />
                {hasIssue ? '이슈' : ''}{reqCount > 0 ? ` ${reqCount}` : ''}
              </span>
            )}
            {site.contractQuantity && meta.group !== 'sales' && (
              <div className="flex items-center gap-1.5">
                <div className="w-16 h-1 rounded-full overflow-hidden" style={{backgroundColor:"var(--border-base)"}}>
                  <div
                    className={`h-full rounded-full ${
                      progress >= 100 ? 'bg-blue-500' :
                      progress >= 80  ? 'bg-green-500' :
                      progress >= 40  ? 'bg-green-600' : 'bg-gray-400'
                    }`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span className="text-[10px] font-bold tabular-nums" style={{
                  color: progress >= 80 ? 'var(--success-text)' : progress >= 40 ? 'var(--info-text)' : 'var(--text-muted)'
                }}>
                  {progress}%
                </span>
              </div>
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
