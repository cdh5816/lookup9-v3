/* eslint-disable i18next/no-literal-string */
import { GetServerSidePropsContext } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useState, useCallback, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import useSWR from 'swr';
import fetcher from '@/lib/fetcher';
import ProgressDashboard from '@/components/sites/ProgressDashboard';
import InspectionPanel from '@/components/sites/InspectionPanel';
import CalendarPanel from '@/components/sites/CalendarPanel';
import MonthlyReportPanel from '@/components/sites/MonthlyReportPanel';
import {
 PlusIcon, TrashIcon, MagnifyingGlassIcon,
 ExclamationTriangleIcon, PencilIcon, CheckIcon,
 XMarkIcon, DocumentArrowUpIcon, ArrowUpCircleIcon,
} from '@heroicons/react/24/outline';

// ── 상수 ──────────────────────────────────────────────
const STATUS_LABEL: Record<string, string> = {
 SALES_PIPELINE: '영업중',
 SALES_CONFIRMED: '수주확정',
 CONTRACT_ACTIVE: '진행중',
 COMPLETED: '준공완료',
 WARRANTY: '하자기간',
 FAILED: '영업실패',
};
const STATUS_COLOR: Record<string, string> = {
 SALES_PIPELINE: 'bg-orange-500',
 SALES_CONFIRMED: 'bg-yellow-400',
 CONTRACT_ACTIVE: 'bg-green-500',
 COMPLETED: 'bg-blue-500',
 WARRANTY: 'bg-purple-500',
 FAILED: 'bg-gray-500',
};
const STATUS_BADGE: Record<string, string> = {
 SALES_PIPELINE: 'status-warning',
 SALES_CONFIRMED: 'status-warning',
 CONTRACT_ACTIVE: 'status-success',
 COMPLETED: 'status-info',
 WARRANTY: 'status-info',
 FAILED: '',
};
const ISSUE_TYPES = ['누수', '손상', '색상 오류', '치수 불일치', '반입 문제', '재작업', '민원', '기타'];
const ISSUE_STATUSES = ['발생', '조사중', '조치중', '완료', '보류'];

// ── 유틸 ──────────────────────────────────────────────
const fmt = (v: any) => (v === null || v === undefined || v === '') ? '-' : String(v);
const fmtNum = (v: any) => {
 if (!v && v !== 0) return '-';
 const n = Number(v);
 return Number.isFinite(n) ? n.toLocaleString('ko-KR') : String(v);
};
const fmtDate = (v: any) => {
 if (!v) return '-';
 try { return new Date(v).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }); } catch { return String(v); }
};
const fmtMoney = (v: any) => {
 if (!v) return '-';
 const n = Number(v);
 if (n >= 100000000) return `${(n / 100000000).toFixed(1)}억원`;
 return `${Math.round(n / 10000).toLocaleString()}만원`;
};
const userName = (u: any) => !u ? '-' : u.position ? `${u.position} ${u.name}` : u.name;

const getDday = (dateVal: any) => {
 if (!dateVal) return null;
 const today = new Date(); today.setHours(0, 0, 0, 0);
 const d = new Date(dateVal); d.setHours(0, 0, 0, 0);
 const diff = Math.ceil((d.getTime() - today.getTime()) / 86400000);
 return { diff, overdue: diff < 0, urgent: diff >= 0 && diff <= 14 };
};

const calcProgress = (site: any) => {
 const contractQty = Number(site.contractQuantity ?? 0);
 if (contractQty <= 0) return { pct: 0, delivered: 0, contractQty: 0 };
 const orders = site.productionOrders ?? [];
 const delivered = orders.filter((o: any) => o.supplyDate).reduce((s: number, o: any) => s + Number(o.quantity ?? 0), 0);
 return { pct: Math.min(100, Math.round((delivered / contractQty) * 100)), delivered, contractQty };
};

// ── 탭 정의 ──────────────────────────────────────────
type TabKey = 'overview' | 'sales' | 'production' | 'settlement' | 'documents' | 'defect' | 'comments' | 'progress' | 'inspection' | 'calendar' | 'report';
interface TabDef { key: TabKey; label: string; badge?: (site: any) => number }

const ALL_TABS: TabDef[] = [
 { key: 'overview', label: '기본정보' },
 { key: 'progress', label: '공정현황' },
 { key: 'sales', label: '영업이력' },
 { key: 'production', label: '생산' },
 { key: 'inspection', label: '검수' },
 { key: 'settlement', label: '정산', badge: (s) => s.issues?.filter((i: any) => i.status !== '완료').length ?? 0 },
 { key: 'calendar', label: '일정' },
 { key: 'documents', label: '서류' },
 { key: 'defect', label: '하자' },
 { key: 'report', label: '리포트' },
 { key: 'comments', label: '코멘트' },
];

const getVisibleTabs = (role: string): TabKey[] => {
 if (['PARTNER', 'GUEST', 'VIEWER'].includes(role))
 return ['overview', 'progress', 'inspection', 'calendar', 'documents', 'report', 'comments'];
 return ['overview', 'progress', 'sales', 'production', 'inspection', 'settlement', 'calendar', 'documents', 'defect', 'report', 'comments'];
};

// ── 메인 ──────────────────────────────────────────────
const SiteDetail = () => {
 const router = useRouter();
 const { id } = router.query;
 const [activeTab, setActiveTab] = useState<TabKey>('overview');

 const { data, mutate } = useSWR(id ? `/api/sites/${id}` : null, fetcher, { refreshInterval: 30000 });
 const { data: profileData } = useSWR('/api/my/profile', fetcher);

 const site = data?.data;
 const profile = profileData?.data;
 const role = profile?.role || profile?.teamMembers?.[0]?.role || 'USER';
 const canManage = ['SUPER_ADMIN', 'OWNER', 'ADMIN_HR', 'ADMIN', 'MANAGER', 'USER', 'MEMBER', 'PARTNER'].includes(role);
 const canDelete = ['SUPER_ADMIN', 'OWNER', 'ADMIN_HR', 'ADMIN'].includes(role);
 const isExternal = ['PARTNER', 'GUEST', 'VIEWER'].includes(role);

 const visibleTabKeys = getVisibleTabs(role);
 const tabs = ALL_TABS.filter(t => visibleTabKeys.includes(t.key));
 const activeKey = tabs.find(t => t.key === activeTab) ? activeTab : tabs[0]?.key ?? 'overview';

 const handleDeleteSite = async () => {
 if (!confirm('이 현장을 삭제하시겠습니까? 모든 데이터가 삭제됩니다.')) return;
 await fetch(`/api/sites/${id}`, { method: 'DELETE' });
 router.push('/sites');
 };

 if (!site) return (
 <div className="flex h-64 items-center justify-center">
 <span className="loading loading-spinner loading-md" />
 </div>
 );

 const progress = calcProgress(site);
 const dday = getDday(site.deliveryDeadline);
 const openIssues = site.issues?.filter((i: any) => i.status !== '완료') ?? [];
 const isSaleStage = ['SALES_PIPELINE', 'SALES_CONFIRMED', 'FAILED'].includes(site.status);

 return (
 <>
 <Head><title>{site.name} | LOOKUP9</title></Head>
 <div className="space-y-0">

 {/* ── 헤더 카드 ── */}
 <div className="rounded-2xl mb-4 overflow-hidden" style={{border: openIssues.length > 0 ? '1px solid var(--danger-border)' : '1px solid var(--border-base)'}}>

 {/* 상단 컬러 스트라이프 */}
 <div className={`h-1 w-full ${STATUS_COLOR[site.status] || 'bg-gray-600'}`} />

 <div className="p-5" style={{backgroundColor:"var(--bg-card)"}}>
 {/* 현장명 + 상태 + 액션 */}
 <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
 <div className="min-w-0 flex-1">
 <div className="flex flex-wrap items-center gap-2 mb-1.5">
 <span className={`rounded-md px-2.5 py-0.5 text-xs font-bold ${STATUS_BADGE[site.status] || ''}`} style={{border: !STATUS_BADGE[site.status] ? '1px solid var(--border-base)' : undefined, color: !STATUS_BADGE[site.status] ? 'var(--text-muted)' : undefined}}>
 {STATUS_LABEL[site.status] ?? site.status}
 </span>
 <span className="rounded-md px-2 py-0.5 text-xs" style={{border:"1px solid var(--border-base)",backgroundColor:"var(--bg-hover)",color:"var(--text-muted)"}}>
 {site.siteType || '납품설치도'}
 </span>
 {openIssues.length > 0 && (
 <span className="flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-bold status-danger">
 <ExclamationTriangleIcon className="h-3 w-3" />미결 이슈 {openIssues.length}건
 </span>
 )}
 </div>
 <h2 className="text-xl font-extrabold tracking-tight leading-tight" style={{color:"var(--text-primary)"}}>{site.name}</h2>
 <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1.5">
 {site.client?.name && (
 <span className="text-sm font-semibold" style={{color:"var(--text-secondary)"}}>{site.client.name}</span>
 )}
 {site.address && (
 <span className="text-sm" style={{color:"var(--text-muted)"}}>{site.address}</span>
 )}
 {site.contractNo && (
 <span className="font-mono text-xs rounded px-1.5 py-0.5" style={{color:"var(--text-muted)",backgroundColor:"var(--bg-hover)"}}>{site.contractNo}</span>
 )}
 {site.installerName && (
 <span className="text-xs" style={{color:"var(--text-muted)"}}>🔧 {site.installerName}</span>
 )}
 </div>
 </div>
 {canDelete && (
 <button className="btn btn-ghost btn-xs" style={{color:"var(--danger-text)"}} onClick={handleDeleteSite}>삭제</button>
 )}
 </div>

 {/* 핵심 지표 (계약 이후) */}
 {!isSaleStage && site.contractQuantity && (
 <div className="grid grid-cols-2 gap-2 sm:grid-cols-5 mt-1">
 <MetricCard label="계약물량" value={`${fmtNum(site.contractQuantity)} m²`} />
 <MetricCard label="계약금액" value={fmtMoney(site.contractAmount)} highlight />
 <MetricCard
 label="공정률"
 value={`${progress.pct}%`}
 sub={`납품 ${fmtNum(progress.delivered)} / ${fmtNum(progress.contractQty)} m²`}
 progressPct={progress.pct}
 />
 <MetricCard
 label="납품기한"
 value={fmtDate(site.deliveryDeadline)}
 sub={dday ? (dday.overdue ? `D+${Math.abs(dday.diff)}일 초과` : `D-${dday.diff}일`) : undefined}
 subColor={dday?.overdue ? 'text-red-400 font-bold' : dday?.urgent ? 'text-orange-400 font-bold' : 'text-gray-400'}
 />
 <MetricCard
 label="하자만료"
 value={site.completionDate ? fmtDate(new Date(new Date(site.completionDate).setFullYear(new Date(site.completionDate).getFullYear() + (site.warrantyPeriod ?? 2)))) : '-'}
 sub={site.completionDate ? `준공 ${fmtDate(site.completionDate)}` : '준공일 미등록'}
 />
 </div>
 )}
 </div>
 </div>

 {/* ── 탭 바 ── */}
 <div className="mb-1" style={{borderBottom:"1px solid var(--border-base)"}}>
 <div className="flex overflow-x-auto -mb-px">
 {tabs.map((tab) => {
 const badge = tab.badge ? tab.badge(site) : 0;
 return (
 <button key={tab.key} onClick={() => setActiveTab(tab.key)}
 className="relative flex items-center gap-1.5 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors"
 style={{
 borderBottomColor: activeKey === tab.key ? 'var(--brand)' : 'transparent',
 color: activeKey === tab.key ? 'var(--brand)' : 'var(--text-muted)',
 }}>
 {tab.label}
 {badge > 0 && (
 <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold ">{badge}</span>
 )}
 </button>
 );
 })}
 </div>
 </div>

 {/* ── 탭 콘텐츠 ── */}
 <div className="pt-3">
 {activeKey === 'overview' && <OverviewPanel site={site} siteId={id as string} canManage={canManage} isExternal={isExternal} onMutate={mutate} role={role} />}
 {activeKey === 'progress' && <ProgressDashboard site={site} />}
 {activeKey === 'sales' && <SalesPanel site={site} siteId={id as string} canManage={canManage} onMutate={mutate} />}
 {activeKey === 'production' && <ProductionPanel site={site} siteId={id as string} canManage={canManage} onMutate={mutate} />}
 {activeKey === 'inspection' && <InspectionPanel siteId={id as string} canManage={canManage} role={role} />}
 {activeKey === 'settlement' && <SettlementPanel site={site} siteId={id as string} canManage={canManage} onMutate={mutate} />}
 {activeKey === 'calendar' && <CalendarPanel siteId={id as string} canManage={canManage} />}
 {activeKey === 'documents' && <DocumentPanel siteId={id as string} canManage={canManage} />}
 {activeKey === 'defect' && <DefectPanel site={site} siteId={id as string} canManage={canManage} onMutate={mutate} />}
 {activeKey === 'report' && <MonthlyReportPanel siteId={id as string} />}
 {activeKey === 'comments' && <CommentsPanel site={site} siteId={id as string} onMutate={mutate} />}
 </div>
 </div>
 </>
 );
};

// ── 메트릭 카드 ──────────────────────────────────────
const MetricCard = ({ label, value, sub, subColor, highlight, progressPct }: {
 label: string; value: string; sub?: string; subColor?: string; highlight?: boolean; progressPct?: number;
}) => (
 <div className="rounded-lg px-3 py-2.5" style={{
 border: highlight ? '1px solid var(--info-border)' : '1px solid var(--border-base)',
 backgroundColor: highlight ? 'var(--info-bg)' : 'var(--bg-card)',
 }}>
 <p className="text-[10px] font-medium mb-1 uppercase tracking-wide" style={{color:"var(--text-muted)"}}>{label}</p>
 <p className="text-sm font-bold leading-tight" style={{color: highlight ? 'var(--info-text)' : 'var(--text-primary)'}}>{value}</p>
 {progressPct !== undefined && (
 <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full" style={{backgroundColor:"var(--border-base)"}}>
 <div className={`h-full rounded-full transition-all ${progressPct >= 100 ? 'bg-blue-500' : progressPct >= 70 ? 'bg-green-500' : progressPct >= 30 ? 'bg-yellow-500' : 'bg-orange-500'}`}
 style={{ width: `${progressPct}%` }} />
 </div>
 )}
 {sub && <p className={`text-[10px] mt-0.5 font-medium ${subColor || ''}`} style={{color: subColor ? undefined : 'var(--text-muted)'}}>{sub}</p>}
 </div>
);

// ── 섹션 카드 ────────────────────────────────────────
const SectionCard = ({ title, children, accent, action }: {
 title: string; children: React.ReactNode; accent?: string; action?: React.ReactNode;
}) => (
 <div className="rounded-xl p-5 space-y-4" style={{
 border: accent === 'blue' ? '1px solid var(--info-border)' : '1px solid var(--border-base)',
 backgroundColor: accent === 'blue' ? 'var(--info-bg)' : 'var(--bg-card)',
 }}>
 <div className="flex items-center justify-between pb-2.5" style={{borderBottom:"1px solid var(--border-subtle)"}}>
 <p className="text-xs font-bold uppercase tracking-widest" style={{color:"var(--text-secondary)"}}>{title}</p>
 {action}
 </div>
 {children}
 </div>
);

// ── 인포 로우 ────────────────────────────────────────
const InfoRow = ({ label, value, mono, highlight }: {
 label: string; value?: string | null; mono?: boolean; highlight?: boolean;
}) => (
 <div>
 <p className="text-[10px] font-semibold mb-0.5 uppercase tracking-wide" style={{color:"var(--text-muted)"}}>{label}</p>
 <p className={`text-sm leading-snug ${mono ? 'font-mono text-xs tracking-tight' : ''}`} style={{color: highlight ? 'var(--info-text)' : 'var(--text-primary)', fontWeight: highlight ? 700 : 400}}>
 {value || <span style={{color:"var(--text-placeholder)"}}>-</span>}
 </p>
 </div>
);

// ══════════════════════════════════════════════════════
// 기본정보 탭
// ══════════════════════════════════════════════════════
const OverviewPanel = ({ site, siteId, canManage, isExternal, onMutate, role }: any) => {
 const [editSection, setEditSection] = useState<string | null>(null);
 const [form, setForm] = useState<any>({});
 const [saving, setSaving] = useState(false);
 const [showPdfModal, setShowPdfModal] = useState(false);

 const startEdit = (section: string) => {
 setEditSection(section);
 setForm({
 name: site.name || '',
 address: site.address || '',
 status: site.status || 'SALES_PIPELINE',
 siteType: site.siteType || '납품설치도',
 description: site.description || '',
 inspectionAgency: site.inspectionAgency || '',
 inspectionBody: site.inspectionBody || '',
 acceptanceAgency: site.acceptanceAgency || '',
 inspectionDone: site.inspectionDone || false,
 inspectionDoneAt: site.inspectionDoneAt ? new Date(site.inspectionDoneAt).toISOString().split('T')[0] : '',
 clientDept: site.clientDept || '',
 clientManager: site.clientManager || '',
 clientManagerPhone: site.clientManagerPhone || '',
 installerName: site.installerName || '',
 installerContact: site.installerContact || '',
 installerPhone: site.installerPhone || '',
 startDocsDone: site.startDocsDone || false,
 startDocsDate: site.startDocsDate ? new Date(site.startDocsDate).toISOString().split('T')[0] : '',
 completionDocsDone: site.completionDocsDone || false,
 completionDocsDate: site.completionDocsDate ? new Date(site.completionDocsDate).toISOString().split('T')[0] : '',
 completionDate: site.completionDate ? new Date(site.completionDate).toISOString().split('T')[0] : '',
 });
 };

 const handleSave = async () => {
 setSaving(true);
 await fetch(`/api/sites/${siteId}`, {
 method: 'PUT', headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify(form),
 });
 setSaving(false); setEditSection(null); onMutate();
 };

 const SaveCancelBar = () => (
 <div className="flex gap-2 justify-end border-t pt-3 mt-1">
 <button className="btn btn-ghost btn-sm" onClick={() => setEditSection(null)}>취소</button>
 <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
 {saving ? <span className="loading loading-spinner loading-xs" /> : '저장'}
 </button>
 </div>
 );

 const isSaleStage = ['SALES_PIPELINE', 'SALES_CONFIRMED', 'FAILED'].includes(site.status);

 return (
 <div className="space-y-3">

 {/* 계약 정보 (분할납품요구서 파싱값) */}
 {!isSaleStage && (
 <SectionCard
 title="계약 정보 (분할납품요구서)"
 accent={site.contractNo ? "blue" : undefined}
 action={canManage ? (
 <button
 className="btn btn-ghost btn-xs gap-1 text-blue-400"
 onClick={() => setShowPdfModal(true)}
 >
 <ArrowUpCircleIcon className="h-3.5 w-3.5" />
 {site.contractNo ? 'PDF로 갱신' : 'PDF 업로드'}
 </button>
 ) : null}
 >
 {site.contractNo || site.contractAmount || site.contractQuantity ? (
 <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
 <InfoRow label="납품요구번호" value={site.contractNo} mono />
 <InfoRow label="계약번호" value={site.procurementNo} mono />
 <InfoRow label="납품요구일" value={fmtDate(site.contractDate)} />
 <InfoRow label="납품기한" value={fmtDate(site.deliveryDeadline)} />
 <InfoRow label="계약물량" value={site.contractQuantity ? `${fmtNum(site.contractQuantity)} m²` : '-'} />
 <InfoRow label="단가" value={site.unitPrice ? `${fmtNum(site.unitPrice)} 원/m²` : '-'} />
 <InfoRow label="계약금액" value={fmtMoney(site.contractAmount)} highlight />
 <InfoRow label="하자담보기간" value={`${site.warrantyPeriod ?? 2}년`} />
 {site.specification && (
 <div className="col-span-2 sm:col-span-4">
 <InfoRow label="규격/사양" value={site.specification} />
 </div>
 )}
 </div>
 ) : (
 <div className="py-4 text-center">
 <p className="text-sm text-gray-500 mb-2">계약 정보가 없습니다.</p>
 <button
 className="btn btn-outline btn-sm gap-2 border-blue-700/60 text-blue-400 hover:bg-blue-950/40"
 onClick={() => setShowPdfModal(true)}
 >
 <ArrowUpCircleIcon className="h-4 w-4" />
 분할납품요구서 PDF 업로드
 </button>
 <p className="text-xs text-gray-600 mt-2">조달청 분할납품요구서를 업로드하면 자동으로 입력됩니다.</p>
 </div>
 )}
 </SectionCard>
 )}

 {/* PDF 파싱 모달 */}
 {showPdfModal && (
 <PdfParseModal
 siteId={siteId}
 siteName={site.name}
 isOverwrite={!!(site.contractNo || site.contractAmount)}
 onClose={() => setShowPdfModal(false)}
 onDone={() => { setShowPdfModal(false); onMutate(); }}
 />
 )}

 {/* 현장 기본 정보 */}
 <SectionCard
 title="현장 정보"
 action={canManage && editSection !== 'basic' ? (
 <button className="btn btn-ghost btn-xs gap-1" onClick={() => startEdit('basic')}>
 <PencilIcon className="h-3 w-3" />수정
 </button>
 ) : null}
 >
 {editSection !== 'basic' ? (
 <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
 <InfoRow label="현장 상태" value={STATUS_LABEL[site.status] ?? site.status} />
 <InfoRow label="계약 유형" value={site.siteType || '납품설치도'} />
 <InfoRow label="수요기관" value={site.client?.name} />
 <InfoRow label="현장 주소" value={site.address} />
 <InfoRow label="등록자" value={userName(site.createdBy)} />
 <InfoRow label="등록일" value={fmtDate(site.createdAt)} />
 {site.description && (
 <div className="col-span-full">
 <p className="text-[11px] text-gray-500 mb-0.5">메모</p>
 <p className="text-sm text-inherit whitespace-pre-wrap">{site.description}</p>
 </div>
 )}
 </div>
 ) : (
 <div className="space-y-3">
 <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
 <div>
 <label className="block text-[11px] text-gray-400 mb-1">현장명</label>
 <input type="text" className="input input-bordered input-sm w-full"
 value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
 </div>
 <div>
 <label className="block text-[11px] text-gray-400 mb-1">계약 유형</label>
 <select className="select select-bordered select-sm w-full"
 value={form.siteType} onChange={e => setForm({ ...form, siteType: e.target.value })}>
 <option>납품설치도</option><option>납품하차도</option>
 </select>
 </div>
 <div className="sm:col-span-2">
 <label className="block text-[11px] text-gray-400 mb-1">현장 주소</label>
 <input type="text" className="input input-bordered input-sm w-full"
 value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
 </div>
 <div>
 <label className="block text-[11px] text-gray-400 mb-1">상태</label>
 <select className="select select-bordered select-sm w-full"
 value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
 {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
 </select>
 </div>
 </div>
 <div>
 <label className="block text-[11px] text-gray-400 mb-1">메모</label>
 <textarea className="textarea textarea-bordered w-full text-sm" rows={2}
 value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
 </div>
 <SaveCancelBar />
 </div>
 )}
 </SectionCard>

 {/* 검사 · 검수 기관 */}
 <SectionCard
 title="검사 · 검수 기관"
 action={canManage && editSection !== 'inspection' ? (
 <button className="btn btn-ghost btn-xs gap-1" onClick={() => startEdit('inspection')}>
 <PencilIcon className="h-3 w-3" />수정
 </button>
 ) : null}
 >
 {editSection !== 'inspection' ? (
 <div className="space-y-3">
 <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
 <InfoRow label="검사기관 유형" value={site.inspectionAgencyType || site.inspectionAgency || '미정'} />
 {(site.inspectionAgencyType === '전문검사기관' || site.inspectionAgency === '전문검사기관') && (
 <InfoRow label="검사기관명" value={site.inspectionBody} />
 )}
 <InfoRow label="검수기관" value={site.acceptanceAgency} />
 <div>
 <p className="text-[10px] font-semibold text-gray-500 mb-0.5 uppercase tracking-wide">검사 완료</p>
 <div className="flex items-center gap-1.5">
 <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-bold ${site.inspectionDone ? 'bg-green-900/40 text-green-300 border border-green-700/50' : ' text-gray-500 border '}`}>
 {site.inspectionDone ? '✓ 완료' : '미완료'}
 </span>
 {site.inspectionDone && site.inspectionDoneAt && (
 <span className="text-xs" style={{color:"var(--text-muted)"}}>{fmtDate(site.inspectionDoneAt)}</span>
 )}
 </div>
 </div>
 </div>
 <div className="border-t pt-3">
 <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">수요기관 담당자</p>
 <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
 <InfoRow label="담당부서" value={site.clientDept} />
 <InfoRow label="담당자명" value={site.clientManager} />
 <InfoRow label="연락처" value={site.clientManagerPhone} />
 </div>
 </div>
 </div>
 ) : (
 <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
 <div>
 <label className="block text-[11px] text-gray-400 mb-1">검사기관 유형</label>
 <select className="select select-bordered select-sm w-full"
 value={form.inspectionAgency} onChange={e => setForm({ ...form, inspectionAgency: e.target.value })}>
 <option value="">미정</option>
 <option>수요기관 자체</option><option>전문검사기관</option><option>조달청</option>
 </select>
 </div>
 {form.inspectionAgency === '전문검사기관' && (
 <div>
 <label className="block text-[11px] text-gray-400 mb-1">검사기관명</label>
 <input type="text" className="input input-bordered input-sm w-full"
 value={form.inspectionBody} onChange={e => setForm({ ...form, inspectionBody: e.target.value })} />
 </div>
 )}
 <div>
 <label className="block text-[11px] text-gray-400 mb-1">검수기관</label>
 <input type="text" className="input input-bordered input-sm w-full"
 value={form.acceptanceAgency} onChange={e => setForm({ ...form, acceptanceAgency: e.target.value })} />
 </div>
 <div className="flex items-center gap-3">
 <label className="flex items-center gap-2 text-sm cursor-pointer">
 <input type="checkbox" className="checkbox checkbox-sm"
 checked={form.inspectionDone} onChange={e => setForm({ ...form, inspectionDone: e.target.checked })} />
 검사 완료
 </label>
 {form.inspectionDone && (
 <input type="date" className="input input-bordered input-xs"
 value={form.inspectionDoneAt} onChange={e => setForm({ ...form, inspectionDoneAt: e.target.value })} />
 )}
 </div>
 {/* 수요기관 담당자 */}
 <div className="col-span-full border-t pt-3">
 <p className="text-[11px] text-gray-500 mb-2">수요기관 담당자</p>
 <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
 <div>
 <label className="block text-[11px] text-gray-400 mb-1">담당부서</label>
 <input type="text" className="input input-bordered input-sm w-full"
 value={form.clientDept} onChange={e => setForm({ ...form, clientDept: e.target.value })} />
 </div>
 <div>
 <label className="block text-[11px] text-gray-400 mb-1">담당자명</label>
 <input type="text" className="input input-bordered input-sm w-full"
 value={form.clientManager} onChange={e => setForm({ ...form, clientManager: e.target.value })} />
 </div>
 <div>
 <label className="block text-[11px] text-gray-400 mb-1">담당자 전화</label>
 <input type="text" className="input input-bordered input-sm w-full"
 value={form.clientManagerPhone} onChange={e => setForm({ ...form, clientManagerPhone: e.target.value })} />
 </div>
 </div>
 </div>
 <div className="col-span-full"><SaveCancelBar /></div>
 </div>
 )}
 </SectionCard>

 {/* 시공 협력사 (설치업체) */}
 <SectionCard
 title="시공 협력사 (설치업체)"
 action={canManage && editSection !== 'installer' ? (
 <button className="btn btn-ghost btn-xs gap-1" onClick={() => startEdit('installer')}>
 <PencilIcon className="h-3 w-3" />수정
 </button>
 ) : null}
 >
 {editSection !== 'installer' ? (
 site.installerName ? (
 <div className="space-y-2">
 <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
 <InfoRow label="협력사명" value={site.installerName} />
 <InfoRow label="대표이사" value={site.installerContact} />
 <InfoRow label="연락처" value={site.installerPhone} />
 </div>
 <div className="rounded-lg border border-blue-800/30 bg-blue-950/20 px-3 py-2 mt-1">
 <p className="text-[11px] text-blue-300">
 💡 이 협력사로 등록된 PARTNER 계정은 이 현장에 자동 접근됩니다.
 </p>
 </div>
 </div>
 ) : (
 <div className="flex flex-col items-center justify-center py-4 gap-2">
 <p className="text-sm" style={{color:"var(--text-muted)"}}>등록된 협력사 정보가 없습니다.</p>
 <p className="text-xs text-gray-600">설치업체 정보를 등록하면 해당 협력사 계정이 현장에 접근할 수 있습니다.</p>
 </div>
 )
 ) : (
 <div className="space-y-3">
 <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
 <div>
 <label className="block text-[11px] text-gray-400 mb-1 font-semibold">협력사명 <span className="text-gray-600">(설치업체)</span></label>
 <input type="text" className="input input-bordered input-sm w-full"
 placeholder="예: (주)덕인설치"
 value={form.installerName} onChange={e => setForm({ ...form, installerName: e.target.value })} />
 </div>
 <div>
 <label className="block text-[11px] text-gray-400 mb-1 font-semibold">대표이사</label>
 <input type="text" className="input input-bordered input-sm w-full"
 placeholder="예: 홍길동 소장"
 value={form.installerContact} onChange={e => setForm({ ...form, installerContact: e.target.value })} />
 </div>
 <div>
 <label className="block text-[11px] text-gray-400 mb-1 font-semibold">연락처</label>
 <input type="text" className="input input-bordered input-sm w-full"
 placeholder="010-0000-0000"
 value={form.installerPhone} onChange={e => setForm({ ...form, installerPhone: e.target.value })} />
 </div>
 </div>
 <div className="rounded-lg border px-3 py-2">
 <p className="text-[11px] text-gray-400">
 ℹ️ 계정 관리 메뉴에서 생성한 <span className="text-blue-300 font-semibold">PARTNER 계정의 company명</span>이 여기 협력사명과 일치하면 해당 계정이 이 현장을 볼 수 있습니다.
 </p>
 </div>
 <div className="flex justify-end border-t pt-3">
 <div className="flex gap-2">
 <button className="btn btn-ghost btn-sm" onClick={() => setEditSection(null)}>취소</button>
 <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
 {saving ? <span className="loading loading-spinner loading-xs" /> : '저장'}
 </button>
 </div>
 </div>
 </div>
 )}
 </SectionCard>

 {/* 서류 현황 (착수계/준공계) */}
 {!isSaleStage && (
 <SectionCard
 title="서류 현황"
 action={canManage && editSection !== 'docs' ? (
 <button className="btn btn-ghost btn-xs gap-1" onClick={() => startEdit('docs')}>
 <PencilIcon className="h-3 w-3" />수정
 </button>
 ) : null}
 >
 {editSection !== 'docs' ? (
 <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
 <DocStatusRow label="착수계" done={site.startDocsDone} date={fmtDate(site.startDocsDate)} />
 <DocStatusRow label="준공계" done={site.completionDocsDone} date={fmtDate(site.completionDocsDate)} />
 </div>
 ) : (
 <div className="space-y-3">
 <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
 <div className="space-y-2">
 <label className="flex items-center gap-2 text-sm cursor-pointer">
 <input type="checkbox" className="checkbox checkbox-sm"
 checked={form.startDocsDone} onChange={e => setForm({ ...form, startDocsDone: e.target.checked })} />
 착수계 제출
 </label>
 {form.startDocsDone && (
 <input type="date" className="input input-bordered input-xs w-full"
 value={form.startDocsDate} onChange={e => setForm({ ...form, startDocsDate: e.target.value })} />
 )}
 </div>
 <div className="space-y-2">
 <label className="flex items-center gap-2 text-sm cursor-pointer">
 <input type="checkbox" className="checkbox checkbox-sm"
 checked={form.completionDocsDone} onChange={e => setForm({ ...form, completionDocsDone: e.target.checked })} />
 준공계 제출
 </label>
 {form.completionDocsDone && (
 <div className="space-y-1.5">
 <input type="date" className="input input-bordered input-xs w-full"
 value={form.completionDocsDate} onChange={e => setForm({ ...form, completionDocsDate: e.target.value })} />
 <div>
 <label className="block text-[11px] text-gray-400 mb-0.5">준공일 (하자기산점)</label>
 <input type="date" className="input input-bordered input-xs w-full"
 value={form.completionDate} onChange={e => setForm({ ...form, completionDate: e.target.value })} />
 </div>
 </div>
 )}
 </div>
 </div>
 <SaveCancelBar />
 </div>
 )}
 </SectionCard>
 )}

 {/* 담당자 배정 */}
 <AssignmentPanel siteId={siteId} assignments={site.assignments ?? []} canManage={canManage} isExternal={isExternal} onMutate={onMutate} />
 </div>
 );
};

const DocStatusRow = ({ label, done, date }: { label: string; done: boolean; date: string }) => (
 <div className="flex items-center justify-between rounded-lg border px-3 py-2.5">
 <div className="flex items-center gap-2">
 <span className={`flex h-5 w-5 items-center justify-center rounded-full flex-shrink-0 ${done ? 'bg-green-600' : 'bg-gray-700'}`}>
 {done ? <CheckIcon className="h-3 w-3 " /> : null}
 </span>
 <span className="text-sm">{label}</span>
 </div>
 <span className="text-xs" style={{color:"var(--text-muted)"}}>{done ? date : '미제출'}</span>
 </div>
);

// ══════════════════════════════════════════════════════
// 담당자 배정 패널
// ══════════════════════════════════════════════════════
const AssignmentPanel = ({ siteId, assignments, canManage, isExternal, onMutate }: any) => {
 const [showSearch, setShowSearch] = useState(false);
 const [sq, setSq] = useState('');
 const [sr, setSr] = useState<any[]>([]);
 const [mode, setMode] = useState<null | 'partner' | 'guest'>(null);
 const [form, setForm] = useState({ name: '', email: '', password: '', company: '', position: '', phone: '' });
 const [saving, setSaving] = useState(false);
 const [error, setError] = useState('');

 const handleSearch = async (q: string) => {
 setSq(q);
 if (!q) { setSr([]); return; }
 const r = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`);
 if (r.ok) { const d = await r.json(); setSr(d.data || []); }
 };

 const handleAssign = async (userId: string) => {
 await fetch(`/api/sites/${siteId}/assignments`, {
 method: 'POST', headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ userId }),
 });
 setSq(''); setSr([]); setShowSearch(false); onMutate();
 };

 const handleRemove = async (userId: string) => {
 if (!confirm('담당자를 제거하시겠습니까?')) return;
 await fetch(`/api/sites/${siteId}/assignments`, {
 method: 'DELETE', headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ userId }),
 });
 onMutate();
 };

 const handleCreate = async () => {
 if (!form.name || !form.email || !form.password) { setError('이름, 이메일, 비밀번호는 필수입니다.'); return; }
 setSaving(true); setError('');
 const roleVal = mode === 'partner' ? 'PARTNER' : 'GUEST';
 try {
 const res = await fetch('/api/admin/users', {
 method: 'POST', headers: { 'Content-Type': 'application/json' },
 // 현장 미지정으로 생성 — assignedSiteIds 제거
 body: JSON.stringify({ ...form, role: roleVal, department: roleVal === 'PARTNER' ? '협력사' : '게스트' }),
 });
 const json = await res.json();
 if (!res.ok) throw new Error(json?.error?.message || '생성 실패');
 setForm({ name: '', email: '', password: '', company: '', position: '', phone: '' });
 setMode(null); onMutate();
 } catch (e: any) {
 setError(e.message);
 } finally { setSaving(false); }
 };

 return (
 <SectionCard
 title={`담당자 · 협력사 (${assignments.length}명)`}
 action={canManage ? (
 <div className="flex gap-1 flex-wrap justify-end">
 <button className="btn btn-ghost btn-xs gap-1" onClick={() => { setShowSearch(p => !p); setMode(null); }}>
 <PlusIcon className="h-3 w-3" />직원 배정
 </button>
 <button className="btn btn-ghost btn-xs gap-1" onClick={() => { setMode('partner'); setShowSearch(false); }}>
 <PlusIcon className="h-3 w-3" />협력사 생성
 </button>
 <button className="btn btn-ghost btn-xs gap-1" onClick={() => { setMode('guest'); setShowSearch(false); }}>
 <PlusIcon className="h-3 w-3" />게스트 생성
 </button>
 </div>
 ) : null}
 >
 {showSearch && (
 <div className="space-y-2">
 <div className="relative">
 <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
 <input type="text" className="input input-bordered input-sm w-full pl-9"
 placeholder="이름으로 검색" value={sq} onChange={e => handleSearch(e.target.value)} />
 </div>
 {sr.length > 0 && (
 <div className="max-h-40 overflow-y-auto rounded-lg border divide-y divide-gray-800">
 {sr.map((u) => (
 <button key={u.id} onClick={() => handleAssign(u.id)}
 className="w-full px-3 py-2 text-left text-sm hover: flex items-center gap-2">
 <PlusIcon className="h-3.5 w-3.5 text-gray-500" />
 {u.position ? `${u.position} ` : ''}{u.name}
 <span className="text-gray-500 text-xs">({u.email})</span>
 </button>
 ))}
 </div>
 )}
 </div>
 )}

 {mode && (
 <div className="rounded-lg border bg-black/30 p-3 space-y-3">
 <div className="flex items-center justify-between">
 <p className="text-sm font-semibold">
 {mode === 'partner' ? '협력사 계정 생성' : '게스트 계정 생성'}
 <span className="ml-2 text-xs font-normal text-gray-400">(현장 미지정으로 생성됩니다)</span>
 </p>
 <button onClick={() => setMode(null)}><XMarkIcon className="h-4 w-4 text-gray-500" /></button>
 </div>
 {error && <p className="text-xs text-red-400">{error}</p>}
 <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
 {[
 { key: 'name', label: '이름 *' }, { key: 'email', label: '이메일 *' },
 { key: 'password', label: '비밀번호 *', type: 'password' }, { key: 'company', label: '회사명' },
 { key: 'position', label: '직책' }, { key: 'phone', label: '연락처' },
 ].map(({ key, label, type }) => (
 <div key={key}>
 <label className="block text-[11px] text-gray-400 mb-0.5">{label}</label>
 <input type={type || 'text'} className="input input-bordered input-xs w-full"
 value={(form as any)[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} />
 </div>
 ))}
 </div>
 <div className="flex gap-2 justify-end">
 <button className="btn btn-ghost btn-xs" onClick={() => setMode(null)}>취소</button>
 <button className="btn btn-primary btn-xs" onClick={handleCreate} disabled={saving}>
 {saving ? <span className="loading loading-spinner loading-xs" /> : '생성'}
 </button>
 </div>
 </div>
 )}

 {assignments.length === 0 ? (
 <p className="text-sm" style={{color:"var(--text-muted)"}}>배정된 담당자가 없습니다.</p>
 ) : (
 <div className="divide-y divide-gray-800/60">
 {assignments.map((a: any) => {
 const isPartner = a.user?.department === '협력사' || a.user?.teamMembers?.[0]?.role === 'PARTNER';
 return (
 <div key={a.id} className="flex items-center justify-between py-2">
 <div className="flex items-center gap-2">
 <span className={`badge badge-xs ${isPartner ? 'badge-warning' : 'badge-neutral'}`}>
 {isPartner ? '협력사' : '직원'}
 </span>
 <span className="text-sm">{a.user?.position ? `${a.user.position} ` : ''}{a.user?.name}</span>
 {a.user?.company && <span className="text-xs" style={{color:"var(--text-muted)"}}>({a.user.company})</span>}
 </div>
 {canManage && (
 <button className="btn btn-ghost btn-xs text-red-400" onClick={() => handleRemove(a.user.id)}>
 <TrashIcon className="h-3.5 w-3.5" />
 </button>
 )}
 </div>
 );
 })}
 </div>
 )}
 </SectionCard>
 );
};

// ══════════════════════════════════════════════════════
// 영업이력 탭
// ══════════════════════════════════════════════════════
const SalesPanel = ({ site, siteId, canManage, onMutate }: any) => {
 const [showForm, setShowForm] = useState(false);
 const [form, setForm] = useState({ status: '영업접촉', estimateAmount: '', meetingNotes: '' });
 const [saving, setSaving] = useState(false);
 const [showPdfModal, setShowPdfModal] = useState(false);

 const handleSubmit = async () => {
 setSaving(true);
 await fetch(`/api/sites/${siteId}/sales`, {
 method: 'POST', headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify(form),
 });
 setForm({ status: '영업접촉', estimateAmount: '', meetingNotes: '' });
 setShowForm(false); setSaving(false); onMutate();
 };

 const sales = site.sales ?? [];
 const STATUS_COLORS: Record<string, string> = {
 '영업접촉': 'bg-gray-700 text-inherit', '제안': 'bg-orange-900/50 text-orange-300',
 '협의중': 'bg-yellow-900/50 text-yellow-300', '수주확정': 'bg-green-900/50 text-green-300',
 '실패': 'bg-red-900/50 text-red-300',
 };

 const isConfirmed = site.status === 'SALES_CONFIRMED';

 return (
 <div className="space-y-3">

 {/* 수주확정 → 계약서 업로드 안내 */}
 {isConfirmed && canManage && (
 <div className="rounded-xl border border-green-800/40 bg-green-950/10 p-4">
 <div className="flex items-start justify-between gap-3">
 <div>
 <p className="text-sm font-semibold text-green-300 mb-1">수주 확정 — 계약서를 업로드하세요</p>
 <p className="text-xs" style={{color:"var(--text-muted)"}}>
 분할납품요구서를 업로드하면 계약 정보가 자동 입력되고<br />
 영업 이력을 유지한 채로 진행중 현장으로 전환됩니다.
 </p>
 </div>
 <button
 className="btn btn-success btn-sm gap-1.5 flex-shrink-0"
 onClick={() => setShowPdfModal(true)}
 >
 <ArrowUpCircleIcon className="h-4 w-4" />계약서 업로드
 </button>
 </div>
 </div>
 )}

 {/* PDF 파싱 모달 */}
 {showPdfModal && (
 <PdfParseModal
 siteId={siteId}
 siteName={site.name}
 isOverwrite={false}
 convertToActive={true}
 onClose={() => setShowPdfModal(false)}
 onDone={() => { setShowPdfModal(false); onMutate(); }}
 />
 )}

 <SectionCard
 title={`영업 활동 이력 (${sales.length}건)`}
 action={canManage ? (
 <button className="btn btn-ghost btn-xs gap-1" onClick={() => setShowForm(p => !p)}>
 <PlusIcon className="h-3 w-3" />{showForm ? '취소' : '활동 추가'}
 </button>
 ) : null}
 >
 {showForm && (
 <div className="rounded-lg border bg-black/30 p-3 space-y-3 mb-2">
 <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
 <div>
 <label className="block text-[11px] text-gray-400 mb-1">단계</label>
 <select className="select select-bordered select-sm w-full"
 value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
 {['영업접촉', '제안', '협의중', '수주확정', '실패'].map(s => <option key={s}>{s}</option>)}
 </select>
 </div>
 <div>
 <label className="block text-[11px] text-gray-400 mb-1">예상금액 (원)</label>
 <input type="text" className="input input-bordered input-sm w-full"
 value={form.estimateAmount} onChange={e => setForm({ ...form, estimateAmount: e.target.value })} />
 </div>
 </div>
 <div>
 <label className="block text-[11px] text-gray-400 mb-1">활동 내용</label>
 <textarea className="textarea textarea-bordered w-full text-sm" rows={3}
 placeholder="미팅 내용, 특이사항 등..."
 value={form.meetingNotes} onChange={e => setForm({ ...form, meetingNotes: e.target.value })} />
 </div>
 <div className="flex gap-2 justify-end">
 <button className="btn btn-ghost btn-sm" onClick={() => setShowForm(false)}>취소</button>
 <button className="btn btn-primary btn-sm" onClick={handleSubmit} disabled={saving}>
 {saving ? <span className="loading loading-spinner loading-xs" /> : '등록'}
 </button>
 </div>
 </div>
 )}

 {sales.length === 0 ? (
 <div className="py-8 text-center text-sm text-gray-500">영업 활동 이력이 없습니다.</div>
 ) : (
 <div className="relative pl-4 space-y-0">
 <div className="absolute left-1.5 top-2 bottom-2 w-px " />
 {sales.map((s: any) => (
 <div key={s.id} className="relative pb-3">
 <span className="absolute -left-3 top-1.5 h-2.5 w-2.5 rounded-full border-2 bg-orange-500" />
 <div className="rounded-lg border px-3 py-2.5">
 <div className="flex flex-wrap items-center gap-2 mb-1">
 <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_COLORS[s.status] || 'bg-gray-700 text-inherit'}`}>{s.status}</span>
 {s.estimateAmount && <span className="text-xs text-blue-300 font-semibold">{fmtMoney(s.estimateAmount)}</span>}
 <span className="text-[11px] text-gray-500 ml-auto">{fmtDate(s.createdAt)} · {userName(s.createdBy)}</span>
 </div>
 {s.meetingNotes && <p className="text-sm text-inherit whitespace-pre-wrap">{s.meetingNotes}</p>}
 </div>
 </div>
 ))}
 </div>
 )}
 </SectionCard>
 </div>
 );
};

// ══════════════════════════════════════════════════════
// 생산 탭
// ══════════════════════════════════════════════════════
const ProductionPanel = ({ site, siteId, canManage, onMutate }: any) => {
 const { data: ordersData, mutate: mutateOrders } = useSWR(siteId ? `/api/sites/${siteId}/production` : null, fetcher);
 const orders: any[] = ordersData?.data ?? [];
 const [editingId, setEditingId] = useState<string | null>(null);
 const [editForm, setEditForm] = useState<any>({});
 const [addingNew, setAddingNew] = useState(false);
 const [newForm, setNewForm] = useState({ quantity: '', orderDate: '', supplyDate: '', notes: '' });
 const [saving, setSaving] = useState(false);

 const contractQty = Number(site.contractQuantity ?? 0);
 const orderedQty = orders.reduce((s, o) => s + Number(o.quantity ?? 0), 0);
 const deliveredQty = orders.filter(o => o.supplyDate).reduce((s, o) => s + Number(o.quantity ?? 0), 0);
 const diff = contractQty - orderedQty;
 const progressPct = contractQty > 0 ? Math.min(100, Math.round((deliveredQty / contractQty) * 100)) : 0;
 const dday = getDday(site.deliveryDeadline);

 const startEdit = (order: any) => {
 setEditingId(order.id);
 setEditForm({
 quantity: order.quantity ? String(order.quantity) : '',
 orderDate: order.orderDate ? new Date(order.orderDate).toISOString().split('T')[0] : '',
 supplyDate: order.supplyDate ? new Date(order.supplyDate).toISOString().split('T')[0] : '',
 notes: order.notes || '',
 });
 };

 const saveEdit = async (orderId: string) => {
 setSaving(true);
 await fetch(`/api/sites/${siteId}/production`, {
 method: 'PUT', headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ orderId, ...editForm }),
 });
 setEditingId(null); setSaving(false); mutateOrders(); onMutate();
 };

 const addOrder = async () => {
 if (!newForm.quantity) return;
 setSaving(true);
 await fetch(`/api/sites/${siteId}/production`, {
 method: 'POST', headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify(newForm),
 });
 setNewForm({ quantity: '', orderDate: '', supplyDate: '', notes: '' });
 setAddingNew(false); setSaving(false); mutateOrders(); onMutate();
 };

 const deleteOrder = async (orderId: string) => {
 if (!confirm('이 차수를 삭제하시겠습니까?')) return;
 await fetch(`/api/sites/${siteId}/production`, {
 method: 'DELETE', headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ orderId }),
 });
 mutateOrders(); onMutate();
 };

 const calcElapsed = (order: any) => {
 if (!order.orderDate) return null;
 const from = new Date(order.orderDate);
 const to = order.supplyDate ? new Date(order.supplyDate) : new Date();
 return Math.ceil((to.getTime() - from.getTime()) / 86400000);
 };

 if (!site.contractQuantity && orders.length === 0) {
 return (
 <div className="py-12 text-center">
 <p className="text-sm text-gray-500 mb-1">계약 정보가 없습니다.</p>
 <p className="text-xs text-gray-600">분할납품요구서를 서류 탭에 업로드하거나 기본정보에서 계약 정보를 입력해주세요.</p>
 </div>
 );
 }

 return (
 <div className="space-y-3">

 {/* 종합 현황 */}
 <div className="rounded-xl p-4" style={{border:"1px solid var(--border-base)",backgroundColor:"var(--bg-card)"}}>
 <div className="flex items-center justify-between mb-3">
 <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">종합 현황</p>
 {dday && (
 <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
 dday.overdue ? 'bg-red-900/40 text-red-300 border-red-800/50' :
 dday.urgent ? 'bg-orange-900/40 text-orange-300 border-orange-800/50' :
 ' text-gray-400 '
 }`}>
 납품기한 {dday.overdue ? `D+${Math.abs(dday.diff)}` : `D-${dday.diff}`} ({fmtDate(site.deliveryDeadline)})
 </span>
 )}
 </div>

 <div className="grid grid-cols-2 gap-2 sm:grid-cols-5 mb-3">
 {[
 { label: '계약물량', value: contractQty > 0 ? `${fmtNum(contractQty)} m²` : '-', color: '' },
 { label: '발주물량', value: orderedQty > 0 ? `${fmtNum(orderedQty)} m²` : '-', color: 'text-blue-300' },
 { label: '납품물량', value: deliveredQty > 0 ? `${fmtNum(deliveredQty)} m²` : '-', color: 'text-green-300' },
 {
 label: '미발주(오차)',
 value: contractQty > 0 ? `${fmtNum(Math.abs(diff))} m²${diff < 0 ? ' ↑초과' : ''}` : '-',
 color: diff < 0 ? 'text-red-400' : diff === 0 ? 'text-gray-400' : 'text-orange-300',
 },
 { label: '공정률', value: `${progressPct}%`, color: 'text-blue-300 text-lg font-bold', big: true },
 ].map(({ label, value, color, big }) => (
 <div key={label} className={`rounded-lg border px-3 py-2.5 text-center ${big ? 'border-blue-900/40 bg-blue-950/20 sm:col-span-1 col-span-2' : ' bg-black/30'}`}>
 <p className="text-[10px] text-gray-500 mb-1">{label}</p>
 <p className={`text-sm font-semibold ${color}`}>{value}</p>
 </div>
 ))}
 </div>

 <div>
 <div className="h-2 w-full overflow-hidden rounded-full ">
 <div className={`h-full rounded-full transition-all duration-700 ${progressPct >= 100 ? 'bg-blue-500' : 'bg-green-500'}`}
 style={{ width: `${progressPct}%` }} />
 </div>
 <p className="text-[10px] text-gray-600 mt-1">※ 공정률 = 납품물량 ÷ 계약물량 (설치 포함 안 함)</p>
 </div>
 </div>

 {/* 차수별 테이블 */}
 <div className="rounded-xl overflow-hidden" style={{border:"1px solid var(--border-base)"}}>
 <div className="flex items-center justify-between px-4 py-3 border-b ">
 <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
 차수별 발주 · 납품 ({orders.length}차)
 </p>
 {canManage && (
 <button className="btn btn-ghost btn-xs gap-1" onClick={() => setAddingNew(p => !p)}>
 <PlusIcon className="h-3 w-3" />{addingNew ? '취소' : '차수 추가'}
 </button>
 )}
 </div>

 {/* 신규 차수 입력 */}
 {addingNew && (
 <div className="px-4 py-3 border-b bg-blue-950/10">
 <p className="text-xs text-blue-300 mb-2 font-semibold">{orders.length + 1}차 추가</p>
 <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
 <div>
 <label className="block text-[10px] text-gray-500 mb-1">물량 (m²) *</label>
 <input type="number" className="input input-bordered input-xs w-full"
 value={newForm.quantity} onChange={e => setNewForm({ ...newForm, quantity: e.target.value })} />
 </div>
 <div>
 <label className="block text-[10px] text-gray-500 mb-1">발주일</label>
 <input type="date" className="input input-bordered input-xs w-full"
 value={newForm.orderDate} onChange={e => setNewForm({ ...newForm, orderDate: e.target.value })} />
 </div>
 <div>
 <label className="block text-[10px] text-gray-500 mb-1">공급일 (입고일)</label>
 <input type="date" className="input input-bordered input-xs w-full"
 value={newForm.supplyDate} onChange={e => setNewForm({ ...newForm, supplyDate: e.target.value })} />
 </div>
 <div>
 <label className="block text-[10px] text-gray-500 mb-1">비고</label>
 <input type="text" className="input input-bordered input-xs w-full"
 placeholder="색상변경, 추가발주..."
 value={newForm.notes} onChange={e => setNewForm({ ...newForm, notes: e.target.value })} />
 </div>
 </div>
 <div className="flex justify-end mt-2 gap-2">
 <button className="btn btn-ghost btn-xs" onClick={() => setAddingNew(false)}>취소</button>
 <button className="btn btn-primary btn-xs" onClick={addOrder} disabled={saving || !newForm.quantity}>
 {saving ? <span className="loading loading-spinner loading-xs" /> : '저장'}
 </button>
 </div>
 </div>
 )}

 {orders.length > 0 ? (
 <div className="overflow-x-auto">
 <table className="w-full text-sm">
 <thead>
 <tr className="border-b text-[11px] text-gray-500">
 <th className="px-4 py-2.5 text-left font-medium w-12">차수</th>
 <th className="px-4 py-2.5 text-right font-medium">물량 (m²)</th>
 <th className="px-4 py-2.5 text-left font-medium">발주일</th>
 <th className="px-4 py-2.5 text-left font-medium">공급일</th>
 <th className="px-4 py-2.5 text-right font-medium">경과일</th>
 <th className="px-4 py-2.5 text-left font-medium">비고</th>
 {canManage && <th className="px-2 py-2.5 w-16" />}
 </tr>
 </thead>
 <tbody className="divide-y divide-gray-800/60">
 {orders.map((order: any) => {
 const elapsed = calcElapsed(order);
 const isEditing = editingId === order.id;
 return (
 <tr key={order.id} className={`transition-colors ${isEditing ? 'bg-blue-950/20' : 'hover:'}`}>
 <td className="px-4 py-2.5">
 <span className="font-bold text-gray-200">{order.sequence}차</span>
 </td>
 {isEditing ? (
 <>
 <td className="px-2 py-1.5">
 <input type="number" className="input input-bordered input-xs w-24 text-right"
 value={editForm.quantity} onChange={e => setEditForm({ ...editForm, quantity: e.target.value })} />
 </td>
 <td className="px-2 py-1.5">
 <input type="date" className="input input-bordered input-xs"
 value={editForm.orderDate} onChange={e => setEditForm({ ...editForm, orderDate: e.target.value })} />
 </td>
 <td className="px-2 py-1.5">
 <input type="date" className="input input-bordered input-xs"
 value={editForm.supplyDate} onChange={e => setEditForm({ ...editForm, supplyDate: e.target.value })} />
 </td>
 <td className="px-4 py-2.5 text-right text-xs text-gray-500">
 {elapsed !== null ? `${elapsed}일` : '-'}
 </td>
 <td className="px-2 py-1.5">
 <input type="text" className="input input-bordered input-xs w-28"
 value={editForm.notes} onChange={e => setEditForm({ ...editForm, notes: e.target.value })} />
 </td>
 <td className="px-2 py-1.5">
 <div className="flex gap-1">
 <button className="btn btn-primary btn-xs" onClick={() => saveEdit(order.id)} disabled={saving}>
 {saving ? <span className="loading loading-spinner loading-xs" /> : <CheckIcon className="h-3 w-3" />}
 </button>
 <button className="btn btn-ghost btn-xs" onClick={() => setEditingId(null)}>
 <XMarkIcon className="h-3 w-3" />
 </button>
 </div>
 </td>
 </>
 ) : (
 <>
 <td className="px-4 py-2.5 text-right font-semibold">{fmtNum(order.quantity)}</td>
 <td className="px-4 py-2.5 text-inherit">{fmtDate(order.orderDate)}</td>
 <td className="px-4 py-2.5">
 {order.supplyDate
 ? <span className="text-green-300">{fmtDate(order.supplyDate)}</span>
 : <span className="text-gray-600 text-xs">미입고</span>
 }
 </td>
 <td className="px-4 py-2.5 text-right">
 {elapsed !== null && (
 <span className={`text-xs font-medium ${order.supplyDate ? 'text-gray-400' : 'text-yellow-400'}`}>
 {elapsed}일{!order.supplyDate ? ' ↑' : ''}
 </span>
 )}
 </td>
 <td className="px-4 py-2.5 text-gray-500 text-xs">{order.notes || '-'}</td>
 {canManage && (
 <td className="px-2 py-2.5">
 <div className="flex gap-1">
 <button className="btn btn-ghost btn-xs" onClick={() => startEdit(order)}>
 <PencilIcon className="h-3 w-3" />
 </button>
 <button className="btn btn-ghost btn-xs text-red-400" onClick={() => deleteOrder(order.id)}>
 <TrashIcon className="h-3 w-3" />
 </button>
 </div>
 </td>
 )}
 </>
 )}
 </tr>
 );
 })}
 </tbody>
 {orders.length > 1 && (
 <tfoot>
 <tr className="border-t ">
 <td className="px-4 py-2 text-xs font-semibold text-gray-400">합계</td>
 <td className="px-4 py-2 text-right text-sm font-bold ">{fmtNum(orderedQty)} m²</td>
 <td colSpan={canManage ? 5 : 4} className="px-4 py-2 text-xs text-gray-500">
 납품완료 {fmtNum(deliveredQty)} m² · 미납 {fmtNum(orderedQty - deliveredQty)} m²
 </td>
 </tr>
 </tfoot>
 )}
 </table>
 </div>
 ) : !addingNew && (
 <div className="py-10 text-center text-sm text-gray-500">등록된 발주 차수가 없습니다.</div>
 )}
 </div>
 </div>
 );
};

// ══════════════════════════════════════════════════════
// 정산 탭
// ══════════════════════════════════════════════════════
const SettlementPanel = ({ site, siteId, canManage, onMutate }: any) => {
 const [showIssueForm, setShowIssueForm] = useState(false);
 const [issueForm, setIssueForm] = useState({ title: '', type: '기타', occurredAt: '', location: '', description: '', responsibility: '' });
 const [saving, setSaving] = useState(false);

 const handleIssueSubmit = async () => {
 if (!issueForm.title) return;
 setSaving(true);
 await fetch(`/api/sites/${siteId}/issues`, {
 method: 'POST', headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify(issueForm),
 });
 setIssueForm({ title: '', type: '기타', occurredAt: '', location: '', description: '', responsibility: '' });
 setShowIssueForm(false); setSaving(false); onMutate();
 };

 const handleIssueStatus = async (issueId: string, status: string) => {
 await fetch(`/api/sites/${siteId}/issues`, {
 method: 'PUT', headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ issueId, status }),
 });
 onMutate();
 };

 const issues = site.issues ?? [];
 const openIssues = issues.filter((i: any) => i.status !== '완료');
 const doneIssues = issues.filter((i: any) => i.status === '완료');
 const changeLogs = (site.changeLogs ?? []).filter((c: any) => ['물량변경', '기성정산', '실정보고'].includes(c.type));

 return (
 <div className="space-y-3">
 {/* 실정보고 */}
 <SectionCard title="실정보고 · 추가정산">
 {changeLogs.length === 0 ? (
 <p className="text-sm text-gray-600">등록된 실정보고가 없습니다.</p>
 ) : (
 <div className="space-y-2">
 {changeLogs.map((c: any) => (
 <div key={c.id} className="rounded-lg border px-3 py-2.5">
 <div className="flex items-center gap-2">
 <span className="badge badge-xs badge-warning">{c.type}</span>
 <span className="text-sm">{c.reason || `${c.beforeValue} → ${c.afterValue}`}</span>
 <span className={`ml-auto badge badge-xs ${c.status === '승인' ? 'badge-success' : c.status === '반려' ? 'badge-error' : 'badge-ghost'}`}>{c.status}</span>
 </div>
 <p className="text-xs text-gray-500 mt-1">{fmtDate(c.createdAt)} · {userName(c.requester)}</p>
 </div>
 ))}
 </div>
 )}
 </SectionCard>

 {/* 이슈 관리 */}
 <SectionCard
 title={`이슈 (미해결 ${openIssues.length}건)`}
 action={canManage ? (
 <button className="btn btn-ghost btn-xs gap-1" onClick={() => setShowIssueForm(p => !p)}>
 <PlusIcon className="h-3 w-3" />{showIssueForm ? '취소' : '이슈 등록'}
 </button>
 ) : null}
 >
 {openIssues.length > 0 && (
 <div className="rounded-lg border border-red-800/40 bg-red-950/10 p-3 space-y-2">
 {openIssues.map((i: any) => (
 <div key={i.id} className="flex items-center justify-between rounded px-3 py-2">
 <div className="flex items-center gap-2">
 <span className="badge badge-xs badge-error">{i.type}</span>
 <span className="text-sm">{i.title}</span>
 </div>
 {canManage && (
 <select className="select select-bordered select-xs" value={i.status}
 onChange={e => handleIssueStatus(i.id, e.target.value)}>
 {ISSUE_STATUSES.map(s => <option key={s}>{s}</option>)}
 </select>
 )}
 </div>
 ))}
 </div>
 )}

 {showIssueForm && (
 <div className="rounded-lg border p-3 space-y-3">
 <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
 <div className="sm:col-span-2">
 <label className="block text-[11px] text-gray-400 mb-1">이슈 제목 *</label>
 <input type="text" className="input input-bordered input-sm w-full"
 value={issueForm.title} onChange={e => setIssueForm({ ...issueForm, title: e.target.value })} />
 </div>
 <div>
 <label className="block text-[11px] text-gray-400 mb-1">분류</label>
 <select className="select select-bordered select-sm w-full"
 value={issueForm.type} onChange={e => setIssueForm({ ...issueForm, type: e.target.value })}>
 {ISSUE_TYPES.map(t => <option key={t}>{t}</option>)}
 </select>
 </div>
 <div>
 <label className="block text-[11px] text-gray-400 mb-1">발생일</label>
 <input type="date" className="input input-bordered input-sm w-full"
 value={issueForm.occurredAt} onChange={e => setIssueForm({ ...issueForm, occurredAt: e.target.value })} />
 </div>
 <div>
 <label className="block text-[11px] text-gray-400 mb-1">위치</label>
 <input type="text" className="input input-bordered input-sm w-full"
 value={issueForm.location} onChange={e => setIssueForm({ ...issueForm, location: e.target.value })} />
 </div>
 <div>
 <label className="block text-[11px] text-gray-400 mb-1">책임구분</label>
 <input type="text" className="input input-bordered input-sm w-full"
 value={issueForm.responsibility} onChange={e => setIssueForm({ ...issueForm, responsibility: e.target.value })} />
 </div>
 </div>
 <textarea className="textarea textarea-bordered w-full text-sm" rows={2} placeholder="상세 내용"
 value={issueForm.description} onChange={e => setIssueForm({ ...issueForm, description: e.target.value })} />
 <div className="flex justify-end gap-2">
 <button className="btn btn-ghost btn-sm" onClick={() => setShowIssueForm(false)}>취소</button>
 <button className="btn btn-primary btn-sm" onClick={handleIssueSubmit} disabled={saving}>
 {saving ? <span className="loading loading-spinner loading-xs" /> : '등록'}
 </button>
 </div>
 </div>
 )}

 {doneIssues.length > 0 && (
 <details className="rounded-lg border">
 <summary className="cursor-pointer px-3 py-2 text-xs text-gray-500 hover:text-inherit">완료 이슈 {doneIssues.length}건</summary>
 <div className="divide-y divide-gray-800 px-3 pb-2">
 {doneIssues.map((i: any) => (
 <div key={i.id} className="py-2 flex items-center gap-2 opacity-60">
 <span className="badge badge-xs badge-success">완료</span>
 <span className="text-sm">{i.title}</span>
 </div>
 ))}
 </div>
 </details>
 )}
 {issues.length === 0 && !showIssueForm && <p className="text-sm text-gray-600">등록된 이슈가 없습니다.</p>}
 </SectionCard>
 </div>
 );
};

// ══════════════════════════════════════════════════════
// 서류 탭
// ══════════════════════════════════════════════════════
const DocumentPanel = ({ siteId, canManage }: { siteId: string; canManage: boolean }) => {
 const [docs, setDocs] = useState<any[]>([]);
 const [loading, setLoading] = useState(true);
 const [uploading, setUploading] = useState(false);

 const fetchDocs = useCallback(async () => {
 setLoading(true);
 const r = await fetch(`/api/sites/${siteId}/documents`);
 if (r.ok) { const d = await r.json(); setDocs(d.data || []); }
 setLoading(false);
 }, [siteId]);

 useEffect(() => { fetchDocs(); }, [fetchDocs]);

 const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
 const f = e.target.files?.[0];
 if (!f) return;
 if (f.size > 5 * 1024 * 1024) { alert('5MB 이하 파일만 업로드 가능합니다.'); return; }
 setUploading(true);
 const reader = new FileReader();
 reader.onload = async () => {
 const b64 = (reader.result as string).split(',')[1];
 await fetch(`/api/sites/${siteId}/documents`, {
 method: 'POST', headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ fileName: f.name, fileData: b64, mimeType: f.type }),
 });
 setUploading(false); fetchDocs();
 };
 reader.readAsDataURL(f);
 e.target.value = '';
 };

 const handleDel = async (docId: string) => {
 if (!confirm('서류를 삭제하시겠습니까?')) return;
 await fetch(`/api/sites/${siteId}/documents`, {
 method: 'DELETE', headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ documentId: docId }),
 });
 fetchDocs();
 };

 const fmtSize = (b: number | null) => !b ? '' : b < 1024 * 1024 ? `${(b / 1024).toFixed(0)}KB` : `${(b / (1024 * 1024)).toFixed(1)}MB`;
 const DOC_TYPE_BADGE: Record<string, string> = { '분할납품요구서': 'badge-info', '착수계': 'badge-warning', '준공계': 'badge-success', '공문': 'badge-ghost' };
 const getDocType = (name: string) => Object.keys(DOC_TYPE_BADGE).find(k => name.includes(k));

 return (
 <SectionCard
 title={`서류 (${docs.length}개)`}
 action={canManage ? (
 <label className="btn btn-ghost btn-xs gap-1 cursor-pointer">
 {uploading ? <span className="loading loading-spinner loading-xs" /> : <DocumentArrowUpIcon className="h-3.5 w-3.5" />}
 업로드
 <input type="file" className="hidden" onChange={handleUpload} disabled={uploading} />
 </label>
 ) : null}
 >
 {loading ? (
 <div className="py-6 text-center"><span className="loading loading-spinner loading-sm" /></div>
 ) : docs.length === 0 ? (
 <div className="py-8 text-center">
 <p className="text-sm" style={{color:"var(--text-muted)"}}>등록된 서류가 없습니다.</p>
 <p className="text-xs text-gray-600 mt-1">분할납품요구서, 착수계, 준공계 등을 업로드하세요.</p>
 </div>
 ) : (
 <div className="divide-y divide-gray-800">
 {docs.map((d: any) => {
 const docType = getDocType(d.fileName);
 return (
 <div key={d.id} className="flex items-center justify-between py-2.5">
 <div className="flex items-center gap-2 min-w-0">
 {docType && <span className={`badge badge-xs ${DOC_TYPE_BADGE[docType]} flex-shrink-0`}>{docType}</span>}
 <a href={`/api/documents/${d.id}`} target="_blank" rel="noreferrer"
 className="text-sm text-blue-400 hover:underline truncate">{d.fileName}</a>
 </div>
 <div className="flex items-center gap-2 flex-shrink-0 ml-2">
 <span className="text-[11px]" style={{color:"var(--text-muted)"}}>{fmtSize(d.fileSize)}</span>
 {canManage && (
 <button className="btn btn-ghost btn-xs text-red-400" onClick={() => handleDel(d.id)}>
 <TrashIcon className="h-3.5 w-3.5" />
 </button>
 )}
 </div>
 </div>
 );
 })}
 </div>
 )}
 </SectionCard>
 );
};

// ══════════════════════════════════════════════════════
// 하자 탭
// ══════════════════════════════════════════════════════
const DefectPanel = ({ site, siteId, canManage, onMutate }: any) => {
 const warrantyEnd = site.completionDate
 ? new Date(new Date(site.completionDate).setFullYear(new Date(site.completionDate).getFullYear() + (site.warrantyPeriod ?? 2)))
 : null;
 const wd = getDday(warrantyEnd);
 const defectIssues = (site.issues ?? []).filter((i: any) => ['누수', '손상', '색상 오류', '재작업', '민원'].includes(i.type));

 return (
 <div className="space-y-3">
 <SectionCard title="하자보수 기간">
 <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
 <InfoRow label="준공일" value={fmtDate(site.completionDate)} />
 <InfoRow label="하자담보기간" value={`${site.warrantyPeriod ?? 2}년`} />
 <div>
 <p className="text-[11px] text-gray-500 mb-0.5">하자 만료일</p>
 <div className="flex items-center gap-2">
 <p className="text-sm text-gray-200">{warrantyEnd ? fmtDate(warrantyEnd) : '-'}</p>
 {wd && <span className={`badge badge-xs ${wd.overdue ? 'badge-error' : wd.urgent ? 'badge-warning' : 'badge-success'}`}>
 {wd.overdue ? `만료 D+${Math.abs(wd.diff)}` : `D-${wd.diff}`}
 </span>}
 </div>
 </div>
 </div>
 {!site.completionDate && <p className="text-xs text-gray-600">기본정보 탭 → 서류 현황에서 준공일을 등록해주세요.</p>}
 </SectionCard>

 <SectionCard title={`하자 접수 이력 (${defectIssues.length}건)`}>
 {defectIssues.length === 0 ? (
 <p className="text-sm text-gray-600">접수된 하자가 없습니다.</p>
 ) : (
 <div className="space-y-2">
 {defectIssues.map((i: any) => (
 <div key={i.id} className="rounded-lg border px-3 py-2.5">
 <div className="flex items-center gap-2">
 <span className={`badge badge-xs ${i.status === '완료' ? 'badge-success' : 'badge-error'}`}>{i.type}</span>
 <span className="text-sm">{i.title}</span>
 <span className="ml-auto text-xs text-gray-500">{fmtDate(i.occurredAt || i.createdAt)}</span>
 </div>
 {i.location && <p className="text-xs text-gray-500 mt-0.5">위치: {i.location}</p>}
 </div>
 ))}
 </div>
 )}
 </SectionCard>
 </div>
 );
};

// ══════════════════════════════════════════════════════
// 코멘트 탭
// ══════════════════════════════════════════════════════
const CommentsPanel = ({ site, siteId, onMutate }: any) => {
 const [comment, setComment] = useState('');
 const [submitting, setSubmitting] = useState(false);

 const handleSubmit = async () => {
 if (!comment.trim()) return;
 setSubmitting(true);
 await fetch('/api/comments', {
 method: 'POST', headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ siteId, content: comment }),
 });
 setComment(''); setSubmitting(false); onMutate();
 };

 const fmtdt = (v: any) => {
 if (!v) return '';
 try { return new Date(v).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }); } catch { return ''; }
 };

 const comments = site.comments ?? [];
 return (
 <div className="space-y-4">
 <div className="flex gap-3">
 <textarea className="textarea textarea-bordered flex-1 text-sm resize-none" rows={2}
 placeholder="코멘트를 입력하세요... (Ctrl+Enter 등록)"
 value={comment} onChange={e => setComment(e.target.value)}
 onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit(); }} />
 <button className="btn btn-primary btn-sm self-end" onClick={handleSubmit} disabled={submitting || !comment.trim()}>
 {submitting ? <span className="loading loading-spinner loading-xs" /> : '등록'}
 </button>
 </div>
 {comments.length === 0 ? (
 <p className="py-6 text-center text-sm text-gray-500">코멘트가 없습니다.</p>
 ) : (
 <div className="space-y-2">
 {comments.map((c: any) => (
 <div key={c.id} className="rounded-xl p-3" style={{border:"1px solid var(--border-base)",backgroundColor:"var(--bg-card)"}}>
 <div className="flex items-center justify-between mb-1.5">
 <span className="text-sm font-medium">{userName(c.author)}</span>
 <span className="text-[11px]" style={{color:"var(--text-muted)"}}>{fmtdt(c.createdAt)}</span>
 </div>
 <p className="text-sm whitespace-pre-wrap text-gray-200">{c.content}</p>
 </div>
 ))}
 </div>
 )}
 </div>
 );
};

export async function getServerSideProps({ locale }: GetServerSidePropsContext) {
 return { props: { ...(locale ? await serverSideTranslations(locale, ['common']) : {}) } };
}

export default SiteDetail;

// ══════════════════════════════════════════════════════
// PDF 파싱 모달 (현장 상세 내 계약정보 업로드/갱신)
// ══════════════════════════════════════════════════════
const PdfParseModal = ({ siteId, siteName, isOverwrite, convertToActive, onClose, onDone }: {
 siteId: string;
 siteName: string;
 isOverwrite: boolean;
 convertToActive?: boolean;
 onClose: () => void;
 onDone: () => void;
}) => {
 const [step, setStep] = useState<'upload' | 'preview' | 'done'>('upload');
 const [parsing, setParsing] = useState(false);
 const [parseError, setParseError] = useState('');
 const [parsed, setParsed] = useState<any>(null);
 const [fileName, setFileName] = useState('');
 const [fileData, setFileData] = useState('');
 const [form, setForm] = useState<any>({});
 const [saving, setSaving] = useState(false);
 const [saveError, setSaveError] = useState('');

 const fmtMoney = (v: any) => {
 if (!v) return '';
 const n = Number(v);
 if (n >= 100000000) return `${(n / 100000000).toFixed(1)}억원`;
 return `${Math.round(n / 10000).toLocaleString()}만원`;
 };

 const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
 const file = e.target.files?.[0];
 if (!file) return;
 if (!file.name.toLowerCase().endsWith('.pdf')) {
 setParseError('PDF 파일만 가능합니다.'); return;
 }
 setParseError(''); setParsing(true); setFileName(file.name);
 const reader = new FileReader();
 reader.onload = async () => {
 const b64 = (reader.result as string).split(',')[1];
 setFileData(b64);
 try {
 const res = await fetch('/api/sites/parse-pdf', {
 method: 'POST', headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ fileData: b64, fileName: file.name }),
 });
 const json = await res.json();
 if (!res.ok) throw new Error(json?.error?.message || '파싱 실패');
 setParsed(json.data);
 setForm({ ...json.data });
 setStep('preview');
 } catch (err: any) {
 setParseError(err.message || '파싱 중 오류가 발생했습니다.');
 } finally { setParsing(false); }
 };
 reader.readAsDataURL(file);
 e.target.value = '';
 }, []);

 const handleApply = async () => {
 setSaving(true); setSaveError('');
 try {
 // 1. 현장 데이터 덮어씌우기
 const updateData: any = {
 contractNo: form.contractNo,
 procurementNo: form.procurementNo,
 contractDate: form.contractDate,
 contractAmount: form.contractAmount,
 contractQuantity: form.contractQuantity,
 unitPrice: form.unitPrice,
 specification: form.specification,
 deliveryDeadline: form.deliveryDeadline,
 warrantyPeriod: form.warrantyPeriod,
 siteType: form.siteType,
 inspectionAgency: form.inspectionAgencyType || form.inspectionAgency,
 inspectionBody: form.inspectionBody,
 acceptanceAgency: form.acceptanceAgency,
 clientDept: form.clientDept,
 clientManager: form.clientManager,
 clientManagerPhone: form.clientManagerPhone,
 };
 // 영업현장 → 진행중 전환
 if (convertToActive) updateData.status = 'CONTRACT_ACTIVE';
 // clientName으로 수요기관 업데이트
 if (form.clientName) updateData.clientName = form.clientName;

 const res = await fetch(`/api/sites/${siteId}`, {
 method: 'PUT', headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify(updateData),
 });
 if (!res.ok) {
 const j = await res.json();
 throw new Error(j?.error?.message || '저장 실패');
 }

 // 2. PDF를 서류 탭에 자동 저장
 if (fileData) {
 await fetch(`/api/sites/${siteId}/documents`, {
 method: 'POST', headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 fileName: fileName || '분할납품요구서.pdf',
 fileData, mimeType: 'application/pdf',
 }),
 });
 }

 setStep('done');
 setTimeout(() => onDone(), 1200);
 } catch (err: any) {
 setSaveError(err.message || '저장 실패');
 setSaving(false);
 }
 };

 return (
 <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
 <div className="w-full max-w-xl rounded-2xl border shadow-2xl">

 {/* 헤더 */}
 <div className="flex items-center justify-between border-b px-5 py-4">
 <div>
 <h3 className="text-base font-bold">
 {convertToActive ? '계약서 업로드 → 현장 전환' : isOverwrite ? '분할납품요구서 갱신' : '분할납품요구서 업로드'}
 </h3>
 <p className="text-xs text-gray-500 mt-0.5 truncate max-w-xs">{siteName}</p>
 </div>
 <button className="btn btn-ghost btn-sm btn-circle" onClick={onClose}>
 <XMarkIcon className="h-5 w-5" />
 </button>
 </div>

 <div className="p-5">
 {/* STEP 1: 업로드 */}
 {step === 'upload' && (
 <div className="text-center space-y-4 py-4">
 {isOverwrite && (
 <div className="rounded-lg border border-yellow-800/40 bg-yellow-950/20 px-4 py-2.5 text-xs text-yellow-300 text-left">
 ⚠️ 기존 계약 정보를 덮어씌웁니다. PDF 파싱 후 확인 후 적용됩니다.
 </div>
 )}
 {parseError && (
 <div className="rounded-lg border border-red-800/40 bg-red-950/20 px-4 py-2.5 text-sm text-red-300">
 {parseError}
 </div>
 )}
 <div className="flex justify-center">
 <div className="rounded-full bg-blue-950/40 border border-blue-800/30 p-5">
 <DocumentArrowUpIcon className="h-10 w-10 text-blue-400" />
 </div>
 </div>
 <p className="text-xs" style={{color:"var(--text-muted)"}}>
 조달청 분할납품요구서 PDF를 업로드하면<br />
 계약 정보가 자동으로 파싱됩니다.
 </p>
 <label className="btn btn-primary gap-2 cursor-pointer">
 {parsing
 ? <><span className="loading loading-spinner loading-sm" />분석 중...</>
 : <><DocumentArrowUpIcon className="h-5 w-5" />PDF 파일 선택</>
 }
 <input type="file" accept=".pdf" className="hidden"
 onChange={handleFileChange} disabled={parsing} />
 </label>
 </div>
 )}

 {/* STEP 2: 파싱 결과 미리보기 */}
 {step === 'preview' && parsed && (
 <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
 <div className="rounded-lg border border-green-800/40 bg-green-950/15 px-3 py-2.5 text-xs text-green-300">
 ✅ 파싱 완료 — 내용을 확인하고 적용하세요.
 <span className="ml-2 text-blue-400">PDF는 서류 탭에 자동 저장됩니다.</span>
 </div>

 {/* 핵심 정보 미리보기 */}
 <div className="rounded-lg border border-blue-900/30 bg-blue-950/10 p-3 space-y-2">
 <p className="text-[10px] text-gray-500 uppercase tracking-wider">파싱 결과 요약</p>
 <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
 {[
 { l: '납품요구번호', v: form.contractNo },
 { l: '수요기관', v: form.clientName },
 { l: '계약금액', v: fmtMoney(form.contractAmount) },
 { l: '계약물량', v: form.contractQuantity ? `${form.contractQuantity} m²` : null },
 { l: '단가', v: form.unitPrice ? `${Number(form.unitPrice).toLocaleString()}원` : null },
 { l: '납품기한', v: form.deliveryDeadline },
 { l: '계약유형', v: form.siteType },
 { l: '검사기관', v: form.inspectionAgencyType || form.inspectionAgency },
 { l: '담당자', v: form.clientManager ? `${form.clientDept || ''} ${form.clientManager}` : null },
 { l: '담당자 전화', v: form.clientManagerPhone },
 ].map(({ l, v }) => (
 <div key={l} className="flex items-baseline gap-1.5">
 <span className="text-gray-500 flex-shrink-0">{l}</span>
 <span className={`font-medium truncate ${v ? 'text-gray-200' : 'text-gray-600'}`}>
 {v || '-'}
 </span>
 </div>
 ))}
 </div>
 </div>

 {/* 복수 품목 상세 */}
 {form.productItems && form.productItems.length > 1 && (
 <div>
 <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5">
 품목 상세 ({form.productItems.length}건)
 </p>
 <div className="overflow-x-auto rounded-lg border text-xs">
 <table className="table table-xs w-full">
 <thead className=" text-gray-500">
 <tr>
 <th className="w-6">순</th>
 <th>품명 / 규격</th>
 <th className="text-right">단가</th>
 <th className="text-right text-blue-400">물량(㎡)</th>
 <th className="text-right">금액</th>
 </tr>
 </thead>
 <tbody>
 {form.productItems.map((item: any) => (
 <tr key={item.seq} className="border-t /60">
 <td className="text-gray-600 text-center">{item.seq}</td>
 <td>
 <p className="text-inherit">{item.productName}</p>
 <p className="text-gray-600 text-[10px] break-all">{item.spec}</p>
 </td>
 <td className="text-right tabular-nums text-gray-400">
 {item.unitPrice ? Number(item.unitPrice).toLocaleString() : '-'}
 </td>
 <td className="text-right tabular-nums font-bold text-blue-300">
 {item.contractQuantity ? Number(item.contractQuantity).toLocaleString() : '-'}
 </td>
 <td className="text-right tabular-nums text-gray-400">
 {item.amount ? Number(item.amount).toLocaleString() : '-'}
 </td>
 </tr>
 ))}
 <tr className="border-t font-semibold">
 <td colSpan={3} className="text-right text-gray-600 text-[10px]">합계</td>
 <td className="text-right tabular-nums text-blue-300">
 {form.productItems.reduce((s: number, i: any) => s + Number(i.contractQuantity || 0), 0).toLocaleString()}
 </td>
 <td className="text-right tabular-nums text-gray-400">
 {form.productItems.reduce((s: number, i: any) => s + Number(i.amount || 0), 0).toLocaleString()}
 </td>
 </tr>
 </tbody>
 </table>
 </div>
 </div>
 )}

 {/* 납품기한 직접 수정 (자주 바뀌는 필드) */}
 <div className="grid grid-cols-2 gap-2">
 <div>
 <label className="block text-[11px] text-gray-400 mb-1">납품기한 확인/수정</label>
 <input type="date" className="input input-bordered input-sm w-full"
 value={form.deliveryDeadline || ''}
 onChange={e => setForm({ ...form, deliveryDeadline: e.target.value })} />
 </div>
 <div>
 <label className="block text-[11px] text-gray-400 mb-1">계약물량 확인/수정 (m²)</label>
 <input type="number" className="input input-bordered input-sm w-full"
 value={form.contractQuantity || ''}
 onChange={e => setForm({ ...form, contractQuantity: e.target.value })} />
 </div>
 </div>

 {saveError && (
 <div className="rounded-lg border border-red-800/40 bg-red-950/20 px-3 py-2 text-sm text-red-300">
 {saveError}
 </div>
 )}

 <div className="flex items-center justify-between gap-3 pt-1 border-t ">
 <button className="btn btn-ghost btn-sm" onClick={() => setStep('upload')}>
 다시 업로드
 </button>
 <button className="btn btn-primary btn-sm gap-2 min-w-[120px]"
 onClick={handleApply} disabled={saving}>
 {saving
 ? <><span className="loading loading-spinner loading-xs" />적용 중...</>
 : convertToActive ? '✅ 현장 전환' : isOverwrite ? '✅ 갱신 적용' : '✅ 정보 저장'
 }
 </button>
 </div>
 </div>
 )}

 {/* STEP 3: 완료 */}
 {step === 'done' && (
 <div className="text-center py-6 space-y-3">
 <CheckIcon className="h-12 w-12 text-green-400 mx-auto" />
 <p className="font-semibold text-green-300">
 {convertToActive ? '현장이 진행중으로 전환되었습니다!' : '계약 정보가 업데이트되었습니다!'}
 </p>
 <p className="text-xs" style={{color:"var(--text-muted)"}}>PDF가 서류 탭에 저장되었습니다.</p>
 </div>
 )}
 </div>
 </div>
 </div>
 );
};
