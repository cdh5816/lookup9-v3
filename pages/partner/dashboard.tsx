/* eslint-disable i18next/no-literal-string */
import { GetServerSidePropsContext } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useState, useEffect, useCallback, useMemo } from 'react';
import Head from 'next/head';
import useSWR from 'swr';
import fetcher from '@/lib/fetcher';
import {
  BuildingOffice2Icon, CurrencyDollarIcon,
  ExclamationTriangleIcon, CheckCircleIcon,
  CalculatorIcon,
} from '@heroicons/react/24/outline';
import PullToRefresh from '@/components/shared/PullToRefresh';

const fmtNum = (v: any) => {
  if (v === null || v === undefined) return '-';
  return Number(v).toLocaleString('ko-KR');
};
const fmtMoney = (v: any) => {
  if (!v) return '-';
  const n = Number(v);
  if (n >= 100000000) return `${(n / 100000000).toFixed(1)}억`;
  if (n >= 10000) return `${Math.round(n / 10000).toLocaleString()}만`;
  return n.toLocaleString();
};
const getDday = (dateVal: any) => {
  if (!dateVal) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(dateVal); d.setHours(0, 0, 0, 0);
  return Math.ceil((d.getTime() - today.getTime()) / 86400000);
};

const PartnerDashboard = () => {
  const { data: profileData, mutate: mutateProfile } = useSWR('/api/my/profile', fetcher, { refreshInterval: 30000 });
  const profile = profileData?.data || {};
  const [sites, setSites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCalc, setShowCalc] = useState(false);
  const [costPerUnit, setCostPerUnit] = useState('');

  const fetchSites = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/sites?includeCompleted=true');
    if (res.ok) { const d = await res.json(); setSites(d.data || []); }
    setLoading(false);
  }, []);
  useEffect(() => { fetchSites(); }, [fetchSites]);
  const handleRefresh = useCallback(async () => { await Promise.all([mutateProfile(), fetchSites()]); }, [mutateProfile, fetchSites]);

  const sitesWithProgress = useMemo(() => sites.map(s => {
    const qty = Number(s.contractQuantity ?? 0);
    const delivered = (s.shipments ?? []).reduce((sum: number, r: any) => sum + Number(r.quantity ?? 0), 0);
    const ordered = (s.productionOrders ?? []).reduce((sum: number, o: any) => sum + Number(o.quantity ?? 0), 0);
    const progress = qty > 0 ? Math.min(100, Math.round((delivered / qty) * 100)) : 0;
    const dday = getDday(s.deliveryDeadline);
    const issues = s._count?.issues ?? 0;
    return { ...s, qty, delivered, ordered, progress, dday, issues };
  }), [sites]);

  const pendingSites = useMemo(() => sitesWithProgress.filter(s => s.status === 'SALES_CONFIRMED'), [sitesWithProgress]);
  const activeSites = useMemo(() => sitesWithProgress.filter(s => s.status === 'CONTRACT_ACTIVE'), [sitesWithProgress]);
  const completedSites = useMemo(() => sitesWithProgress.filter(s => ['COMPLETED', 'WARRANTY'].includes(s.status)), [sitesWithProgress]);

  const stats = useMemo(() => {
    const totalAmount = sitesWithProgress.reduce((s, site) => s + Number(site.contractAmount || 0), 0);
    const activeAmount = activeSites.reduce((s, site) => s + Number(site.contractAmount || 0), 0);
    const pendingAmount = pendingSites.reduce((s, site) => s + Number(site.contractAmount || 0), 0);
    const totalQty = activeSites.reduce((s, site) => s + site.qty, 0);
    const totalDelivered = activeSites.reduce((s, site) => s + site.delivered, 0);
    const pendingQty = totalQty - totalDelivered;
    const issueCount = sitesWithProgress.filter(s => s.issues > 0).length;
    const avgProgress = activeSites.length > 0
      ? Math.round(activeSites.reduce((s, site) => s + site.progress, 0) / activeSites.length) : 0;
    return { total: sitesWithProgress.length, active: activeSites.length, pending: pendingSites.length, completed: completedSites.length, totalAmount, activeAmount, pendingAmount, totalQty, totalDelivered, pendingQty, issueCount, avgProgress };
  }, [sitesWithProgress, activeSites, pendingSites, completedSites]);

  const costCalcResult = useMemo(() => {
    const unitCost = Number(costPerUnit.replace(/,/g, ''));
    if (!unitCost || unitCost <= 0) return null;
    return { totalCost: stats.totalQty * unitCost, deliveredCost: stats.totalDelivered * unitCost, pendingCost: stats.pendingQty * unitCost };
  }, [costPerUnit, stats]);

  const companyName = profile.company || '';

  return (
    <>
      <Head><title>시공내역 | LOOKUP9</title></Head>
      <PullToRefresh onRefresh={handleRefresh}>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs" style={{color:"var(--text-muted)"}}>{companyName}</p>
              <h2 className="text-xl font-bold" style={{color:"var(--text-primary)"}}>시공내역</h2>
            </div>
            <button className="btn btn-sm gap-1" style={{border:"1px solid var(--brand)",color:"var(--brand)"}} onClick={() => setShowCalc(v => !v)}>
              <CalculatorIcon className="h-4 w-4" />{showCalc ? '닫기' : '시공비 계산'}
            </button>
          </div>

          {/* 핵심 지표 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <StatCard icon={BuildingOffice2Icon} label="총 현장" value={`${stats.total}건`} sub={`진행 ${stats.active} · 완료 ${stats.completed}`} colorVar="--info-text" />
            <StatCard icon={CurrencyDollarIcon} label="총 수주금액" value={`${fmtMoney(stats.totalAmount)}원`} sub={`진행중 ${fmtMoney(stats.activeAmount)}원`} colorVar="--success-text" />
            <StatCard icon={ExclamationTriangleIcon} label="이슈 현장" value={`${stats.issueCount}건`} colorVar={stats.issueCount > 0 ? '--danger-text' : '--success-text'} danger={stats.issueCount > 0} />
            <StatCard icon={CheckCircleIcon} label="평균 공정률" value={`${stats.avgProgress}%`} colorVar="--brand" progress={stats.avgProgress} />
          </div>

          {/* 물량 현황 */}
          <div className="rounded-xl p-4" style={{border:"1px solid var(--border-base)",backgroundColor:"var(--bg-card)"}}>
            <p className="text-xs font-semibold mb-3" style={{color:"var(--text-secondary)"}}>진행중 물량 현황</p>
            <div className="grid grid-cols-3 gap-3 mb-3">
              <QtyBox label="전체 계약" value={fmtNum(stats.totalQty)} unit="m²" />
              <QtyBox label="납품 완료" value={fmtNum(stats.totalDelivered)} unit="m²" colorVar="--success-text" />
              <QtyBox label="잔여 물량" value={fmtNum(stats.pendingQty)} unit="m²" colorVar="--warning-text" />
            </div>
            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span style={{color:"var(--text-muted)"}}>전체 진행률</span>
                <span className="font-bold" style={{color:"var(--brand)"}}>{stats.avgProgress}%</span>
              </div>
              <div className="h-2.5 rounded-full overflow-hidden" style={{backgroundColor:"var(--border-base)"}}>
                <div className="h-full rounded-full bg-blue-500 transition-all" style={{width:`${stats.avgProgress}%`}} />
              </div>
            </div>
          </div>

          {/* 시공비 계산기 */}
          {showCalc && (
            <div className="rounded-xl p-4 slide-up" style={{border:"1px solid var(--info-border)",backgroundColor:"var(--info-bg)"}}>
              <p className="text-xs font-semibold mb-3" style={{color:"var(--info-text)"}}>
                <CalculatorIcon className="h-3.5 w-3.5 inline mr-1" />시공비 계산기
              </p>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm shrink-0" style={{color:"var(--text-secondary)"}}>m² 당 시공비</span>
                <input type="text" className="input input-bordered input-sm flex-1" placeholder="예) 15000" value={costPerUnit} onChange={e => setCostPerUnit(e.target.value.replace(/[^0-9]/g, ''))} inputMode="numeric" />
                <span className="text-sm shrink-0" style={{color:"var(--text-muted)"}}>원</span>
              </div>
              {costCalcResult && (
                <div className="grid grid-cols-3 gap-2">
                  <CalcBox label="전체 시공비" value={`${fmtMoney(costCalcResult.totalCost)}원`} sub={`${fmtNum(stats.totalQty)}m² × ${fmtNum(Number(costPerUnit))}원`} />
                  <CalcBox label="시공 완료분" value={`${fmtMoney(costCalcResult.deliveredCost)}원`} colorVar="--success-text" />
                  <CalcBox label="잔여분" value={`${fmtMoney(costCalcResult.pendingCost)}원`} colorVar="--warning-text" />
                </div>
              )}
            </div>
          )}

          {/* ── 연도별 계약금액 ── */}
          <YearlySummary sites={sitesWithProgress} />

          {/* ── 담당자별 현장금액 ── */}
          <ManagerSummary sites={sitesWithProgress} />

          {/* ── 현장별 공정률 그래프 ── */}
          <div className="rounded-xl p-4" style={{border:"1px solid var(--border-base)",backgroundColor:"var(--bg-card)"}}>
            <p className="text-xs font-semibold mb-3 uppercase tracking-wider" style={{color:"var(--text-muted)"}}>현장별 공정률</p>
            {activeSites.length === 0 ? (
              <p className="text-sm py-4 text-center" style={{color:"var(--text-muted)"}}>진행중인 현장이 없습니다.</p>
            ) : (
              <div className="space-y-2.5">
                {[...activeSites].sort((a,b) => b.progress - a.progress).map(site => (
                  <div key={site.id}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium truncate flex-1 mr-2" style={{color:"var(--text-primary)"}}>{site.name}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        {site.siteManager && <span className="text-[9px] px-1.5 py-0.5 rounded" style={{backgroundColor:'var(--bg-hover)',color:'var(--text-muted)'}}>{site.siteManager}</span>}
                        <span className="text-xs font-bold tabular-nums" style={{color:"var(--brand)"}}>{site.progress}%</span>
                      </div>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{backgroundColor:"var(--border-base)"}}>
                      <div className={`h-full rounded-full transition-all ${site.progress>=100?'bg-blue-500':site.progress>=60?'bg-green-500':site.progress>=30?'bg-yellow-500':'bg-gray-500'}`} style={{width:`${site.progress}%`}} />
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px]" style={{color:"var(--text-muted)"}}>{fmtNum(site.delivered)}/{fmtNum(site.qty)} m²</span>
                      {site.contractAmount && <span className="text-[10px]" style={{color:"var(--info-text)"}}>{fmtMoney(site.contractAmount)}원</span>}
                      {site.settlementAmount && Number(site.settlementAmount) > 0 && <span className="text-[10px]" style={{color:"var(--warning-text)"}}>실정 {fmtMoney(site.settlementAmount)}원</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── 진행대기 현장 ── */}
          {pendingSites.length > 0 && (
            <div className="rounded-xl p-4" style={{border:"1px solid var(--warning-border)",backgroundColor:"var(--warning-bg)"}}>
              <p className="text-xs font-semibold mb-2" style={{color:"var(--warning-text)"}}>진행대기 ({pendingSites.length}건)</p>
              <div className="space-y-1.5">
                {pendingSites.map(site => (
                  <div key={site.id} className="flex items-center justify-between">
                    <span className="text-xs" style={{color:"var(--text-primary)"}}>{site.name}</span>
                    <span className="text-xs font-medium" style={{color:"var(--warning-text)"}}>{fmtMoney(site.contractAmount)}원</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </PullToRefresh>
    </>
  );
};

const StatCard = ({ icon: Icon, label, value, sub, colorVar, danger, progress }: any) => (
  <div className="rounded-xl p-3.5" style={{border: danger?'1px solid var(--danger-border)':'1px solid var(--border-base)', backgroundColor: danger?'var(--danger-bg)':'var(--bg-card)'}}>
    <div className="flex items-center gap-1.5 mb-1.5"><Icon className="h-3.5 w-3.5" style={{color:`var(${colorVar})`}} /><span className="text-[10px] font-medium" style={{color:"var(--text-muted)"}}>{label}</span></div>
    <p className="text-lg font-bold leading-tight" style={{color:`var(${colorVar})`}}>{value}</p>
    {sub && <p className="text-[10px] mt-0.5" style={{color:"var(--text-muted)"}}>{sub}</p>}
    {progress !== undefined && <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{backgroundColor:"var(--border-base)"}}><div className="h-full rounded-full bg-blue-500" style={{width:`${progress}%`}} /></div>}
  </div>
);
const QtyBox = ({ label, value, unit, colorVar }: { label: string; value: string; unit: string; colorVar?: string }) => (
  <div className="text-center">
    <p className="text-lg font-bold" style={{color: colorVar ? `var(${colorVar})` : 'var(--text-primary)'}}>{value}</p>
    <p className="text-[10px]" style={{color:"var(--text-muted)"}}>{label} ({unit})</p>
  </div>
);
const CalcBox = ({ label, value, sub, colorVar }: { label: string; value: string; sub?: string; colorVar?: string }) => (
  <div className="rounded-lg px-2 py-2 text-center" style={{backgroundColor:"var(--bg-card)",border:"1px solid var(--border-base)"}}>
    <p className="text-sm font-bold" style={{color: colorVar ? `var(${colorVar})` : 'var(--text-primary)'}}>{value}</p>
    <p className="text-[9px]" style={{color:"var(--text-muted)"}}>{label}</p>
    {sub && <p className="text-[8px] mt-0.5" style={{color:"var(--text-muted)"}}>{sub}</p>}
  </div>
);

// ── 연도별 계약금액 요약 ──
const YearlySummary = ({ sites }: { sites: any[] }) => {
  const yearData = useMemo(() => {
    const map: Record<string, { count: number; amount: number; qty: number; settlement: number }> = {};
    sites.forEach(s => {
      const year = s.contractDate ? new Date(s.contractDate).getFullYear().toString() : (s.createdAt ? new Date(s.createdAt).getFullYear().toString() : '미분류');
      if (!map[year]) map[year] = { count: 0, amount: 0, qty: 0, settlement: 0 };
      map[year].count++;
      map[year].amount += Number(s.contractAmount || 0);
      map[year].qty += Number(s.contractQuantity || 0);
      map[year].settlement += Number(s.settlementAmount || 0);
    });
    return Object.entries(map).sort((a, b) => b[0].localeCompare(a[0]));
  }, [sites]);

  if (yearData.length === 0) return null;
  return (
    <div className="rounded-xl p-4" style={{border:'1px solid var(--border-base)',backgroundColor:'var(--bg-card)'}}>
      <p className="text-xs font-semibold mb-3 uppercase tracking-wider" style={{color:'var(--text-muted)'}}>연도별 계약 현황</p>
      <div className="space-y-2">
        {yearData.map(([year, d]) => (
          <div key={year} className="flex items-center justify-between rounded-lg px-3 py-2.5" style={{border:'1px solid var(--border-base)'}}>
            <div>
              <span className="text-sm font-bold" style={{color:'var(--text-primary)'}}>{year}년</span>
              <span className="text-[10px] ml-2" style={{color:'var(--text-muted)'}}>{d.count}건</span>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold" style={{color:'var(--success-text)'}}>{fmtMoney(d.amount)}원</p>
              <div className="flex gap-3 text-[10px]" style={{color:'var(--text-muted)'}}>
                <span>{fmtNum(d.qty)}m²</span>
                {d.settlement > 0 && <span style={{color:'var(--warning-text)'}}>실정 {fmtMoney(d.settlement)}원</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── 담당자별 현장금액 요약 ──
const ManagerSummary = ({ sites }: { sites: any[] }) => {
  const managerData = useMemo(() => {
    const map: Record<string, { count: number; amount: number; qty: number; settlement: number; sites: string[] }> = {};
    sites.forEach(s => {
      const mgr = s.siteManager || '미지정';
      if (!map[mgr]) map[mgr] = { count: 0, amount: 0, qty: 0, settlement: 0, sites: [] };
      map[mgr].count++;
      map[mgr].amount += Number(s.contractAmount || 0);
      map[mgr].qty += Number(s.contractQuantity || 0);
      map[mgr].settlement += Number(s.settlementAmount || 0);
      map[mgr].sites.push(s.name);
    });
    return Object.entries(map).sort((a, b) => b[1].amount - a[1].amount);
  }, [sites]);

  if (managerData.length === 0) return null;
  const totalAmt = managerData.reduce((s, [, d]) => s + d.amount, 0);

  return (
    <div className="rounded-xl p-4" style={{border:'1px solid var(--border-base)',backgroundColor:'var(--bg-card)'}}>
      <p className="text-xs font-semibold mb-3 uppercase tracking-wider" style={{color:'var(--text-muted)'}}>담당자별 현장 금액</p>
      <div className="space-y-2">
        {managerData.map(([name, d]) => {
          const pct = totalAmt > 0 ? Math.round((d.amount / totalAmt) * 100) : 0;
          return (
            <div key={name} className="rounded-lg px-3 py-2.5" style={{border:'1px solid var(--border-base)'}}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold" style={{backgroundColor:'var(--info-bg)',color:'var(--info-text)'}}>{name.charAt(0)}</div>
                  <div>
                    <span className="text-sm font-semibold" style={{color: name === '미지정' ? 'var(--text-muted)' : 'var(--text-primary)'}}>{name}</span>
                    <span className="text-[10px] ml-1.5" style={{color:'var(--text-muted)'}}>{d.count}건</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold" style={{color:'var(--success-text)'}}>{fmtMoney(d.amount)}원</p>
                  {d.settlement > 0 && <p className="text-[10px]" style={{color:'var(--warning-text)'}}>실정 {fmtMoney(d.settlement)}원</p>}
                </div>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{backgroundColor:'var(--border-base)'}}>
                <div className="h-full rounded-full transition-all" style={{width:`${pct}%`,backgroundColor:'var(--brand)'}} />
              </div>
              <p className="text-[9px] mt-1 truncate" style={{color:'var(--text-muted)'}}>{d.sites.join(' · ')}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export async function getServerSideProps({ locale }: GetServerSidePropsContext) {
  return { props: { ...(locale ? await serverSideTranslations(locale, ['common']) : {}) } };
}
export default PartnerDashboard;
