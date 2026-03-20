/* eslint-disable i18next/no-literal-string */
import { useState } from 'react';
import {
  CheckCircleIcon, ClockIcon, ExclamationTriangleIcon,
  TruckIcon, CubeIcon, WrenchScrewdriverIcon,
  ArrowTrendingUpIcon,
} from '@heroicons/react/24/outline';

interface ProgressDashboardProps {
  site: any;
}

// ── 유틸 ──────────────────────────────────────────────
const fmtNum = (v: any) => {
  if (v === null || v === undefined || v === '') return '-';
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString('ko-KR') : String(v);
};
const fmtDate = (v: any) => {
  if (!v) return '-';
  try { return new Date(v).toLocaleDateString('ko-KR'); } catch { return '-'; }
};
const fmtMoney = (v: any) => {
  if (!v) return '-';
  const n = Number(v);
  if (n >= 100000000) return `${(n / 100000000).toFixed(1)}억원`;
  return `${Math.round(n / 10000).toLocaleString()}만원`;
};

const getDday = (deadline: any) => {
  if (!deadline) return null;
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const d = new Date(deadline); d.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - now.getTime()) / 86400000);
  return diff;
};

const ProgressDashboard = ({ site }: ProgressDashboardProps) => {
  const [showDetail, setShowDetail] = useState(false);

  const contractQty = Number(site.contractQuantity ?? 0);
  const orders = site.productionOrders ?? [];
  const totalOrdered = orders.reduce((s: number, o: any) => s + Number(o.quantity ?? 0), 0);
  const totalDelivered = orders.filter((o: any) => o.supplyDate).reduce((s: number, o: any) => s + Number(o.quantity ?? 0), 0);

  const progressPct = contractQty > 0 ? Math.min(100, Math.round((totalDelivered / contractQty) * 100)) : 0;
  const orderPct = contractQty > 0 ? Math.min(100, Math.round((totalOrdered / contractQty) * 100)) : 0;

  const dday = getDday(site.deliveryDeadline);
  const ddayLabel = dday === null ? null : dday < 0 ? `D+${Math.abs(dday)}` : dday === 0 ? 'D-Day' : `D-${dday}`;
  const ddayUrgent = dday !== null && dday <= 14;
  const ddayOverdue = dday !== null && dday < 0;

  const openIssues = site.issues?.filter((i: any) => i.status !== '완료').length ?? 0;
  const openRequests = site.requests?.filter((r: any) => r.status !== 'CLOSED').length ?? 0;

  // 단계 계산
  const stages = [
    { key: 'contract', label: '계약', done: !!site.contractNo, icon: CubeIcon },
    { key: 'production', label: '생산', done: totalOrdered > 0, icon: WrenchScrewdriverIcon },
    { key: 'delivery', label: '납품', done: totalDelivered > 0, icon: TruckIcon },
    { key: 'complete', label: '준공', done: site.status === 'COMPLETED' || site.status === 'WARRANTY', icon: CheckCircleIcon },
  ];
  const currentStageIdx = stages.findLastIndex(s => s.done);

  return (
    <div className="space-y-4">

      {/* ── 핵심 공정률 원형 + 주요 지표 ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* 공정률 */}
        <div className="sm:col-span-1 flex flex-col items-center justify-center rounded-xl p-5" style={{border:"1px solid var(--border-base)",backgroundColor:"var(--bg-card)"}}>
          <div className="relative w-28 h-28">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" fill="none" strokeWidth="8" style={{stroke:"var(--border-base)"}} />
              <circle cx="50" cy="50" r="42" fill="none" strokeWidth="8" strokeLinecap="round"
                style={{stroke: progressPct >= 100 ? 'var(--success-text)' : progressPct >= 50 ? 'var(--info-text)' : 'var(--warning-text)'}}
                strokeDasharray={`${progressPct * 2.64} ${264 - progressPct * 2.64}`}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold" style={{color:"var(--text-primary)"}}>{progressPct}%</span>
              <span className="text-[10px]" style={{color:"var(--text-muted)"}}>공정률</span>
            </div>
          </div>
          <p className="mt-2 text-xs text-center" style={{color:"var(--text-secondary)"}}>
            납품 {fmtNum(totalDelivered)} / {fmtNum(contractQty)} m²
          </p>
        </div>

        {/* 주요 지표 카드들 */}
        <div className="sm:col-span-2 grid grid-cols-2 gap-2">
          {/* 계약금액 */}
          <StatCard label="계약금액" value={fmtMoney(site.contractAmount)} icon={CubeIcon} colorVar="--info-text" />
          {/* 계약물량 */}
          <StatCard label="계약물량" value={contractQty > 0 ? `${fmtNum(contractQty)} m²` : '-'} icon={ArrowTrendingUpIcon} colorVar="--text-primary" />
          {/* 납품기한 D-Day */}
          <StatCard
            label="납품기한"
            value={ddayLabel || fmtDate(site.deliveryDeadline)}
            sub={ddayLabel ? fmtDate(site.deliveryDeadline) : undefined}
            icon={ClockIcon}
            colorVar={ddayOverdue ? '--danger-text' : ddayUrgent ? '--warning-text' : '--text-primary'}
            bgVar={ddayOverdue ? '--danger-bg' : ddayUrgent ? '--warning-bg' : undefined}
            borderVar={ddayOverdue ? '--danger-border' : ddayUrgent ? '--warning-border' : undefined}
          />
          {/* 미결 이슈 */}
          <StatCard
            label="미결 이슈"
            value={`${openIssues + openRequests}건`}
            icon={ExclamationTriangleIcon}
            colorVar={openIssues > 0 ? '--danger-text' : '--success-text'}
            bgVar={openIssues > 0 ? '--danger-bg' : undefined}
            borderVar={openIssues > 0 ? '--danger-border' : undefined}
          />
        </div>
      </div>

      {/* ── 단계 진행 바 ── */}
      <div className="rounded-xl p-4" style={{border:"1px solid var(--border-base)",backgroundColor:"var(--bg-card)"}}>
        <p className="text-xs font-semibold mb-3" style={{color:"var(--text-secondary)"}}>진행 단계</p>
        <div className="flex items-center gap-0">
          {stages.map((stage, idx) => {
            const isCurrent = idx === currentStageIdx + 1;
            const isDone = idx <= currentStageIdx;
            return (
              <div key={stage.key} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center transition-all"
                    style={{
                      backgroundColor: isDone ? 'var(--success-bg)' : isCurrent ? 'var(--info-bg)' : 'var(--bg-hover)',
                      border: `2px solid ${isDone ? 'var(--success-text)' : isCurrent ? 'var(--info-text)' : 'var(--border-base)'}`,
                    }}
                  >
                    <stage.icon className="w-4 h-4" style={{
                      color: isDone ? 'var(--success-text)' : isCurrent ? 'var(--info-text)' : 'var(--text-muted)'
                    }} />
                  </div>
                  <span className="text-[10px] mt-1 font-medium" style={{
                    color: isDone ? 'var(--success-text)' : isCurrent ? 'var(--info-text)' : 'var(--text-muted)'
                  }}>{stage.label}</span>
                </div>
                {idx < stages.length - 1 && (
                  <div className="h-0.5 flex-1 mx-1 rounded" style={{
                    backgroundColor: idx <= currentStageIdx ? 'var(--success-text)' : 'var(--border-base)'
                  }} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 생산/납품 상세 바 ── */}
      <div className="rounded-xl p-4" style={{border:"1px solid var(--border-base)",backgroundColor:"var(--bg-card)"}}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold" style={{color:"var(--text-secondary)"}}>생산 · 납품 현황</p>
          <button className="text-xs font-medium" style={{color:"var(--brand)"}} onClick={() => setShowDetail(v => !v)}>
            {showDetail ? '접기' : '상세보기'}
          </button>
        </div>

        {/* 이중 프로그레스 바 */}
        <div className="space-y-2">
          <div>
            <div className="flex justify-between text-[11px] mb-1">
              <span style={{color:"var(--text-muted)"}}>발주량</span>
              <span style={{color:"var(--info-text)"}}>{fmtNum(totalOrdered)} m² ({orderPct}%)</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{backgroundColor:"var(--border-base)"}}>
              <div className="h-full rounded-full bg-blue-500 transition-all" style={{width:`${orderPct}%`}} />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-[11px] mb-1">
              <span style={{color:"var(--text-muted)"}}>납품량</span>
              <span style={{color:"var(--success-text)"}}>{fmtNum(totalDelivered)} m² ({progressPct}%)</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{backgroundColor:"var(--border-base)"}}>
              <div className="h-full rounded-full bg-green-500 transition-all" style={{width:`${progressPct}%`}} />
            </div>
          </div>
        </div>

        {/* 배치별 상세 */}
        {showDetail && orders.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <table className="table table-sm w-full text-[13px]">
              <thead>
                <tr>
                  <th className="text-left" style={{color:"var(--text-muted)"}}>차수</th>
                  <th className="text-right" style={{color:"var(--text-muted)"}}>수량</th>
                  <th className="text-center" style={{color:"var(--text-muted)"}}>발주일</th>
                  <th className="text-center" style={{color:"var(--text-muted)"}}>납품일</th>
                  <th className="text-center" style={{color:"var(--text-muted)"}}>상태</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o: any, idx: number) => (
                  <tr key={o.id || idx}>
                    <td style={{color:"var(--text-primary)"}}>{o.sequence || idx + 1}차</td>
                    <td className="text-right" style={{color:"var(--text-primary)"}}>{fmtNum(o.quantity)} m²</td>
                    <td className="text-center" style={{color:"var(--text-muted)"}}>{fmtDate(o.createdAt)}</td>
                    <td className="text-center" style={{color: o.supplyDate ? 'var(--success-text)' : 'var(--text-muted)'}}>
                      {o.supplyDate ? fmtDate(o.supplyDate) : '대기'}
                    </td>
                    <td className="text-center">
                      {o.supplyDate ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full status-success font-medium">완료</span>
                      ) : (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full status-warning font-medium">진행중</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

// ── 지표 카드 ──────────────────────────────────────────
const StatCard = ({ label, value, sub, icon: Icon, colorVar, bgVar, borderVar }: {
  label: string; value: string; sub?: string; icon: any; colorVar: string; bgVar?: string; borderVar?: string;
}) => (
  <div className="rounded-xl px-3 py-3" style={{
    border: `1px solid var(${borderVar || '--border-base'})`,
    backgroundColor: bgVar ? `var(${bgVar})` : 'var(--bg-card)',
  }}>
    <div className="flex items-center gap-1.5 mb-1">
      <Icon className="w-3.5 h-3.5" style={{color:`var(${colorVar})`}} />
      <span className="text-[10px] font-medium" style={{color:"var(--text-muted)"}}>{label}</span>
    </div>
    <p className="text-base font-bold" style={{color:`var(${colorVar})`}}>{value}</p>
    {sub && <p className="text-[10px] mt-0.5" style={{color:"var(--text-muted)"}}>{sub}</p>}
  </div>
);

export default ProgressDashboard;
