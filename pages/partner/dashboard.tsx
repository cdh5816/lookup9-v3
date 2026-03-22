/* eslint-disable i18next/no-literal-string */
import { GetServerSidePropsContext } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useState, useEffect, useCallback, useMemo } from 'react';
import Head from 'next/head';
import useSWR from 'swr';
import fetcher from '@/lib/fetcher';
import {
  BuildingOffice2Icon, CurrencyDollarIcon,
  CheckCircleIcon, CalculatorIcon, ChartBarIcon,
  ClockIcon, TruckIcon, ArrowTrendingUpIcon,
} from '@heroicons/react/24/outline';
import PullToRefresh from '@/components/shared/PullToRefresh';

const fmtNum = (v: any) => { if (v === null || v === undefined) return '-'; return Number(v).toLocaleString('ko-KR'); };
const fmtMoney = (v: any) => { if (!v) return '-'; const n = Number(v); if (n >= 100000000) return `${(n / 100000000).toFixed(1)}억`; if (n >= 10000) return `${Math.round(n / 10000).toLocaleString()}만`; return n.toLocaleString(); };
const getDday = (dateVal: any) => { if (!dateVal) return null; const today = new Date(); today.setHours(0,0,0,0); const d = new Date(dateVal); d.setHours(0,0,0,0); return Math.ceil((d.getTime() - today.getTime()) / 86400000); };

// ── 링 차트 (SVG) ──
const RingChart = ({ percent, size = 88, stroke = 8 }: { percent: number; size?: number; stroke?: number }) => {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (percent / 100) * circ;
  const color = percent >= 80 ? '#22c55e' : percent >= 50 ? '#3b82f6' : '#eab308';
  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--border-base)" strokeWidth={stroke} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        style={{transition:'stroke-dashoffset 0.8s ease'}} />
    </svg>
  );
};

// ── 메인 ──
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
    // 공급완료 물량 = 공급일(supplyDate)이 있는 발주의 물량 합계
    const deliveredByProd = (s.productionOrders ?? []).filter((o: any) => o.supplyDate).reduce((sum: number, o: any) => sum + Number(o.quantity ?? 0), 0);
    const deliveredByShip = (s.shipments ?? []).reduce((sum: number, r: any) => sum + Number(r.quantity ?? 0), 0);
    const delivered = Math.max(deliveredByProd, deliveredByShip);
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
    const totalQty = activeSites.reduce((s, site) => s + site.qty, 0);
    const totalDelivered = activeSites.reduce((s, site) => s + site.delivered, 0);
    const pendingQty = totalQty - totalDelivered;
    const avgProgress = activeSites.length > 0 ? Math.round(activeSites.reduce((s, site) => s + site.progress, 0) / activeSites.length) : 0;
    return { total: sitesWithProgress.length, active: activeSites.length, pending: pendingSites.length, completed: completedSites.length, totalAmount, activeAmount, totalQty, totalDelivered, pendingQty, avgProgress };
  }, [sitesWithProgress, activeSites, pendingSites, completedSites]);

  const costCalcResult = useMemo(() => {
    const unitCost = Number(costPerUnit.replace(/,/g, ''));
    if (!unitCost || unitCost <= 0) return null;
    return { totalCost: stats.totalQty * unitCost, deliveredCost: stats.totalDelivered * unitCost, pendingCost: stats.pendingQty * unitCost };
  }, [costPerUnit, stats]);

  const companyName = profile.company || '';

  if (loading) return <div className="flex items-center justify-center py-20"><span className="loading loading-spinner loading-lg" style={{color:'var(--brand)'}} /></div>;

  return (
    <>
      <Head><title>시공내역 | LOOKUP9</title></Head>
      <PullToRefresh onRefresh={handleRefresh}>
        <div className="space-y-5">

          {/* 헤더 */}
          <div className="flex items-center justify-between">
            <div>
              {companyName && <p className="text-[11px] font-medium" style={{color:'var(--brand)'}}>{companyName}</p>}
              <h2 className="text-xl font-extrabold tracking-tight" style={{color:'var(--text-primary)'}}>시공내역</h2>
            </div>
            <button className="btn btn-sm gap-1.5 rounded-lg" style={{border:'1px solid var(--brand)',color:'var(--brand)',backgroundColor:'transparent'}} onClick={() => setShowCalc(v => !v)}>
              <CalculatorIcon className="h-4 w-4" /><span className="text-xs">{showCalc ? '닫기' : '시공비'}</span>
            </button>
          </div>

          {/* 공정률 + 핵심 지표 */}
          <div className="rounded-2xl p-5" style={{background:'linear-gradient(135deg, var(--bg-card), var(--bg-surface))',border:'1px solid var(--border-base)',boxShadow:'0 1px 3px rgba(0,0,0,0.06)'}}>
            <div className="flex items-center gap-5">
              <div className="relative shrink-0">
                <RingChart percent={stats.avgProgress} />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xl font-black tabular-nums" style={{color:'var(--text-primary)'}}>{stats.avgProgress}</span>
                  <span className="text-[9px] -mt-0.5" style={{color:'var(--text-muted)'}}>%</span>
                </div>
              </div>
              <div className="flex-1 grid grid-cols-2 gap-x-4 gap-y-2.5">
                <MiniStat icon={BuildingOffice2Icon} label="진행중" value={`${stats.active}건`} color="var(--info-text)" />
                <MiniStat icon={CurrencyDollarIcon} label="수주금액" value={`${fmtMoney(stats.activeAmount)}원`} color="var(--success-text)" />
                <MiniStat icon={TruckIcon} label="납품완료" value={`${fmtNum(stats.totalDelivered)}m²`} color="var(--brand)" />
                <MiniStat icon={ClockIcon} label="잔여물량" value={`${fmtNum(stats.pendingQty)}m²`} color="var(--warning-text)" />
              </div>
            </div>
            <div className="mt-4 pt-3" style={{borderTop:'1px solid var(--border-base)'}}>
              <div className="flex justify-between text-[10px] mb-1.5">
                <span style={{color:'var(--text-muted)'}}>납품 {fmtNum(stats.totalDelivered)} / 계약 {fmtNum(stats.totalQty)} m²</span>
                <span className="font-bold" style={{color:'var(--brand)'}}>{stats.totalQty > 0 ? Math.round((stats.totalDelivered / stats.totalQty) * 100) : 0}%</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{backgroundColor:'var(--border-base)'}}>
                <div className="h-full rounded-full transition-all" style={{width:`${stats.totalQty > 0 ? Math.min(100, (stats.totalDelivered / stats.totalQty) * 100) : 0}%`, background:'linear-gradient(90deg, #3b82f6, #22c55e)'}} />
              </div>
            </div>
          </div>

          {/* 시공비 계산기 */}
          {showCalc && (
            <div className="rounded-2xl p-4" style={{border:'1px solid var(--info-border)',backgroundColor:'var(--info-bg)'}}>
              <p className="text-xs font-bold mb-3" style={{color:'var(--info-text)'}}>
                <CalculatorIcon className="h-3.5 w-3.5 inline mr-1 -mt-0.5" />시공비 계산기
              </p>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs shrink-0" style={{color:'var(--text-secondary)'}}>m²당</span>
                <input type="text" className="input input-bordered input-sm flex-1 rounded-lg" placeholder="15,000" value={costPerUnit} onChange={e => setCostPerUnit(e.target.value.replace(/[^0-9]/g, ''))} inputMode="numeric" />
                <span className="text-xs shrink-0" style={{color:'var(--text-muted)'}}>원</span>
              </div>
              {costCalcResult && (
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { l: '전체', v: costCalcResult.totalCost, c: 'var(--text-primary)' },
                    { l: '완료분', v: costCalcResult.deliveredCost, c: 'var(--success-text)' },
                    { l: '잔여분', v: costCalcResult.pendingCost, c: 'var(--warning-text)' },
                  ].map(item => (
                    <div key={item.l} className="rounded-lg py-2 px-2 text-center" style={{backgroundColor:'var(--bg-card)',border:'1px solid var(--border-base)'}}>
                      <p className="text-sm font-bold" style={{color:item.c}}>{fmtMoney(item.v)}원</p>
                      <p className="text-[9px] mt-0.5" style={{color:'var(--text-muted)'}}>{item.l}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 현장별 공정률 바 차트 */}
          {activeSites.length > 0 && (
            <div className="rounded-2xl p-5" style={{border:'1px solid var(--border-base)',backgroundColor:'var(--bg-card)'}}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <ChartBarIcon className="h-4 w-4" style={{color:'var(--brand)'}} />
                  <p className="text-xs font-bold" style={{color:'var(--text-primary)'}}>현장별 공정률</p>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{backgroundColor:'var(--info-bg)',color:'var(--info-text)',border:'1px solid var(--info-border)'}}>{activeSites.length}건 진행중</span>
              </div>
              <div className="space-y-3">
                {[...activeSites].sort((a,b) => b.progress - a.progress).map((site, idx) => {
                  const barColor = site.progress >= 80 ? '#22c55e' : site.progress >= 50 ? '#3b82f6' : site.progress >= 20 ? '#eab308' : '#94a3b8';
                  const ddayLabel = site.dday !== null ? (site.dday < 0 ? `D+${Math.abs(site.dday)}` : site.dday === 0 ? 'D-Day' : `D-${site.dday}`) : null;
                  return (
                    <div key={site.id}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                          <span className="text-[10px] font-bold w-4 text-center shrink-0" style={{color:'var(--text-muted)'}}>{idx + 1}</span>
                          <span className="text-xs font-semibold truncate" style={{color:'var(--text-primary)'}}>{site.name}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          {ddayLabel && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{
                              color: site.dday !== null && site.dday < 0 ? 'var(--danger-text)' : site.dday !== null && site.dday <= 14 ? 'var(--warning-text)' : 'var(--text-muted)',
                              backgroundColor: site.dday !== null && site.dday < 0 ? 'var(--danger-bg)' : site.dday !== null && site.dday <= 14 ? 'var(--warning-bg)' : 'transparent',
                            }}>{ddayLabel}</span>
                          )}
                          <span className="text-xs font-black tabular-nums w-10 text-right" style={{color:barColor}}>{site.progress}%</span>
                        </div>
                      </div>
                      <div className="h-2.5 rounded-full overflow-hidden" style={{backgroundColor:'var(--border-base)'}}>
                        <div className="h-full rounded-full transition-all" style={{width:`${site.progress}%`,backgroundColor:barColor}} />
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 pl-5">
                        <span className="text-[10px] tabular-nums" style={{color:'var(--text-muted)'}}>{fmtNum(site.delivered)}/{fmtNum(site.qty)}m²</span>
                        {site.contractAmount > 0 && <span className="text-[10px]" style={{color:'var(--info-text)'}}>{fmtMoney(site.contractAmount)}원</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 직원별 진행중 현장 금액 */}
          <ManagerSummary sites={sitesWithProgress} />

          {/* 연도별 계약금액 */}
          <YearlySummary sites={sitesWithProgress} />

          {/* 진행대기 */}
          {pendingSites.length > 0 && (
            <div className="rounded-2xl p-4" style={{border:'1px solid var(--warning-border)',backgroundColor:'var(--warning-bg)'}}>
              <div className="flex items-center gap-2 mb-3">
                <ClockIcon className="h-4 w-4" style={{color:'var(--warning-text)'}} />
                <p className="text-xs font-bold" style={{color:'var(--warning-text)'}}>진행대기</p>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold" style={{backgroundColor:'var(--warning-text)',color:'#fff'}}>{pendingSites.length}</span>
              </div>
              <div className="space-y-2">
                {pendingSites.map(site => (
                  <div key={site.id} className="flex items-center justify-between rounded-lg px-3 py-2" style={{backgroundColor:'rgba(255,255,255,0.5)',border:'1px solid var(--warning-border)'}}>
                    <span className="text-xs font-medium truncate flex-1" style={{color:'var(--text-primary)'}}>{site.name}</span>
                    <span className="text-xs font-bold shrink-0 ml-2" style={{color:'var(--warning-text)'}}>{fmtMoney(site.contractAmount)}원</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 완료 요약 */}
          {completedSites.length > 0 && (
            <div className="rounded-2xl p-4" style={{border:'1px solid var(--success-border)',backgroundColor:'var(--success-bg)'}}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircleIcon className="h-4 w-4" style={{color:'var(--success-text)'}} />
                  <p className="text-xs font-bold" style={{color:'var(--success-text)'}}>완료 현장</p>
                </div>
                <div className="text-right">
                  <span className="text-sm font-black" style={{color:'var(--success-text)'}}>{completedSites.length}건</span>
                  <span className="text-[10px] ml-2" style={{color:'var(--text-muted)'}}>{fmtMoney(completedSites.reduce((s, site) => s + Number(site.contractAmount || 0), 0))}원</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </PullToRefresh>
    </>
  );
};

const MiniStat = ({ icon: Icon, label, value, color }: any) => (
  <div className="flex items-center gap-2">
    <Icon className="h-3.5 w-3.5 shrink-0" style={{color}} />
    <div className="min-w-0">
      <p className="text-[10px] leading-tight" style={{color:'var(--text-muted)'}}>{label}</p>
      <p className="text-sm font-bold leading-tight truncate" style={{color}}>{value}</p>
    </div>
  </div>
);

// ── 연도별 실적 ──
const YearlySummary = ({ sites }: { sites: any[] }) => {
  const yearData = useMemo(() => {
    const map: Record<string, { count: number; amount: number; qty: number }> = {};
    sites.forEach(s => {
      const year = s.contractDate ? new Date(s.contractDate).getFullYear().toString() : (s.createdAt ? new Date(s.createdAt).getFullYear().toString() : '미분류');
      if (!map[year]) map[year] = { count: 0, amount: 0, qty: 0 };
      map[year].count++;
      map[year].amount += Number(s.contractAmount || 0);
      map[year].qty += Number(s.contractQuantity || 0);
    });
    return Object.entries(map).sort((a, b) => b[0].localeCompare(a[0]));
  }, [sites]);
  if (yearData.length === 0) return null;
  const maxAmt = Math.max(...yearData.map(([, d]) => d.amount));
  return (
    <div className="rounded-2xl p-5" style={{border:'1px solid var(--border-base)',backgroundColor:'var(--bg-card)'}}>
      <div className="flex items-center gap-2 mb-4">
        <ArrowTrendingUpIcon className="h-4 w-4" style={{color:'var(--success-text)'}} />
        <p className="text-xs font-bold" style={{color:'var(--text-primary)'}}>연도별 실적</p>
      </div>
      <div className="space-y-3">
        {yearData.map(([year, d]) => {
          const pct = maxAmt > 0 ? Math.round((d.amount / maxAmt) * 100) : 0;
          return (
            <div key={year}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-sm font-black" style={{color:'var(--text-primary)'}}>{year}</span>
                  <span className="text-[10px]" style={{color:'var(--text-muted)'}}>{d.count}건 · {fmtNum(d.qty)}m²</span>
                </div>
                <span className="text-sm font-bold tabular-nums" style={{color:'var(--success-text)'}}>{fmtMoney(d.amount)}원</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{backgroundColor:'var(--border-base)'}}>
                <div className="h-full rounded-full transition-all" style={{width:`${pct}%`,background:'linear-gradient(90deg, #22c55e, #16a34a)'}} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ── 직원별 진행중 현장 금액 ──
const MEMBER_COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f97316', '#14b8a6', '#6366f1'];
const ManagerSummary = ({ sites }: { sites: any[] }) => {
  const memberData = useMemo(() => {
    const activeSites = sites.filter(s => s.status === 'CONTRACT_ACTIVE');
    const map: Record<string, { name: string; position: string; count: number; amount: number; qty: number; sites: string[] }> = {};
    activeSites.forEach(s => {
      const partnerAssigns = (s.assignments || []).filter((a: any) => {
        // assignedRole이 PARTNER이거나, 실제 사용자 역할이 PARTNER인 경우
        return a.assignedRole === 'PARTNER' || a.user?.teamMembers?.[0]?.role === 'PARTNER';
      });
      if (partnerAssigns.length === 0) return;
      partnerAssigns.forEach((a: any) => {
        const uid = a.userId;
        const name = a.user?.name || '이름없음';
        const position = a.user?.position || '';
        if (!map[uid]) map[uid] = { name, position, count: 0, amount: 0, qty: 0, sites: [] };
        map[uid].count++;
        map[uid].amount += Number(s.contractAmount || 0);
        map[uid].qty += Number(s.contractQuantity || 0);
        map[uid].sites.push(s.name);
      });
    });
    return Object.entries(map).sort((a, b) => b[1].amount - a[1].amount);
  }, [sites]);
  if (memberData.length === 0) return null;
  const totalAmt = memberData.reduce((s, [, d]) => s + d.amount, 0);
  return (
    <div className="rounded-2xl p-5" style={{border:'1px solid var(--border-base)',backgroundColor:'var(--bg-card)'}}>
      <div className="flex items-center gap-2 mb-4">
        <CurrencyDollarIcon className="h-4 w-4" style={{color:'var(--brand)'}} />
        <p className="text-xs font-bold" style={{color:'var(--text-primary)'}}>직원별 진행중 현장</p>
      </div>
      <div className="space-y-2.5">
        {memberData.map(([uid, d], idx) => {
          const pct = totalAmt > 0 ? Math.round((d.amount / totalAmt) * 100) : 0;
          const color = MEMBER_COLORS[idx % MEMBER_COLORS.length];
          return (
            <div key={uid} className="rounded-xl px-3.5 py-3" style={{border:'1px solid var(--border-base)',backgroundColor:'var(--bg-surface)'}}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-black text-white shrink-0" style={{backgroundColor:color}}>{d.name.charAt(0)}</div>
                  <div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-sm font-bold" style={{color:'var(--text-primary)'}}>{d.name}</span>
                      {d.position && <span className="text-[10px]" style={{color:'var(--text-muted)'}}>{d.position}</span>}
                    </div>
                    <p className="text-[10px]" style={{color:'var(--text-muted)'}}>{d.count}건 · {fmtNum(d.qty)}m²</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-base font-black tabular-nums" style={{color}}>{fmtMoney(d.amount)}원</p>
                  <p className="text-[10px] font-bold" style={{color:'var(--text-muted)'}}>{pct}%</p>
                </div>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{backgroundColor:'var(--border-base)'}}>
                <div className="h-full rounded-full transition-all" style={{width:`${pct}%`,backgroundColor:color}} />
              </div>
              <p className="text-[9px] mt-1.5 truncate" style={{color:'var(--text-muted)'}}>{d.sites.join(' · ')}</p>
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
