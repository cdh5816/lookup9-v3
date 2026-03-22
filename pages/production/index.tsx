/* eslint-disable i18next/no-literal-string */
import { GetServerSidePropsContext } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import Head from 'next/head';
import Link from 'next/link';
import useSWR from 'swr';
import fetcher from '@/lib/fetcher';

const STATUS_DOT: Record<string, string> = {
 영업중: 'bg-red-500', 대기: 'bg-red-400',
 계약완료: 'bg-yellow-400', 진행중: 'bg-green-500',
 부분완료: 'bg-green-300', 완료: 'bg-gray-400', 보류: 'bg-gray-600',
};

function formatNum(val: number | string | null | undefined) {
 const n = Number(val ?? 0);
 return Number.isFinite(n) && n > 0 ? n.toLocaleString('ko-KR') : '-';
}

// 공정율 계산 (새 스키마 기반: site.pipeRate, site.caulkingRate, shipments vs contracts)
function calcSiteProgress(site: any) {
 const contract = site.contracts?.find((c: any) => !c.isAdditional);
 const contractQty = Number(contract?.quantity ?? site?.contractQuantity ?? 0);
 const deliveredByProd = (site.productionOrders ?? []).filter((o: any) => o.supplyDate).reduce((s: number, o: any) => s + Number(o.quantity ?? 0), 0);
 const deliveredByShip = (site.shipments ?? []).reduce((s: number, r: any) => s + Number(r.quantity ?? 0), 0);
 const shippedQty = Math.max(deliveredByProd, deliveredByShip);
 const panelRate = contractQty > 0 ? Math.min(100, Math.round((shippedQty / contractQty) * 100)) : 0;
 const pipeRate = site.pipeRate ?? 0;
 const caulkingRate = site.caulkingRate ?? 0;
 const finalRate = Math.round(panelRate * 0.4 + pipeRate * 0.3 + caulkingRate * 0.3);
 return { panelRate, pipeRate, caulkingRate, finalRate, contractQty, shippedQty };
}

function ProgressRing({ value }: { value: number }) {
 const r = 22;
 const circ = 2 * Math.PI * r;
 const dash = circ * (Math.min(value, 100) / 100);
 const color = value >= 80 ? '#22c55e' : value >= 40 ? '#3b82f6' : '#eab308';
 return (
 <svg width="56" height="56" className="shrink-0">
 <circle cx="28" cy="28" r={r} fill="none" stroke="#1f2937" strokeWidth="4" />
 <circle cx="28" cy="28" r={r} fill="none" stroke={color} strokeWidth="4"
 strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" transform="rotate(-90 28 28)" />
 <text x="28" y="32" textAnchor="middle" fontSize="11" fill={color} fontWeight="700">{value}%</text>
 </svg>
 );
}

export default function ProductionDashboard() {
 const { data: allData } = useSWR('/api/sites', fetcher, { refreshInterval: 30000 });
 const allSites: any[] = allData?.data || [];
 const activeSites = allSites.filter((s) => ['계약완료', '진행중', '부분완료'].includes(s.status));

 const summary = activeSites.reduce(
 (acc, site) => {
 const { finalRate } = calcSiteProgress(site);
 acc.total += 1;
 acc.avgSum += finalRate;
 if (finalRate >= 100) acc.done += 1;
 if (['진행중', '부분완료'].includes(site.status)) acc.ing += 1;
 return acc;
 },
 { total: 0, avgSum: 0, done: 0, ing: 0 }
 );
 const avgProgress = summary.total ? Math.round(summary.avgSum / summary.total) : 0;

 return (
 <>
 <Head><title>생산관리 | LOOKUP9</title></Head>
 <div className="space-y-5">
 <div>
 <p className="text-xs text-gray-500 mb-1">생산관리</p>
 <h2 className="text-xl font-bold">생산 · 도장 · 출하 현황판</h2>
 </div>

 <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
 {[
 { label: '관리 현장', value: summary.total },
 { label: '평균 공정율', value: `${avgProgress}%` },
 { label: '진행중', value: summary.ing },
 { label: '완료', value: summary.done },
 ].map((item) => (
 <div key={item.label} className="rounded-xl border px-4 py-3 text-center">
 <p className="text-xs text-gray-500">{item.label}</p>
 <p className="mt-1 text-2xl font-bold">{item.value}</p>
 </div>
 ))}
 </div>

 {activeSites.length === 0 ? (
 <div className="rounded-2xl border border-dashed py-16 text-center text-gray-500 text-sm">
 생산 대상 현장이 없습니다.
 </div>
 ) : (
 <div className="space-y-3">
 {activeSites.map((site) => {
 const { panelRate, pipeRate, caulkingRate, finalRate, contractQty, shippedQty } = calcSiteProgress(site);
 const contract = site.contracts?.find((c: any) => !c.isAdditional);
 return (
 <div key={site.id} className="rounded-2xl border p-4 sm:p-5">
 <div className="flex flex-wrap items-start justify-between gap-4">
 <div className="min-w-0 flex-1">
 <div className="flex flex-wrap items-center gap-2 mb-1">
 <span className={`inline-block h-2 w-2 rounded-full shrink-0 ${STATUS_DOT[site.status] || 'bg-gray-400'}`} />
 <h3 className="font-semibold break-words">{site.name}</h3>
 <span className="rounded-full border px-2 py-0.5 text-xs text-gray-400">{site.status}</span>
 {/* 납품유형 */}
 <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
 site.siteType === '납품하차도' ? 'bg-purple-900/40 text-purple-300' : 'bg-blue-900/40 text-blue-300'
 }`}>{site.siteType || '납품설치도'}</span>
 </div>
 {site.address && <p className="text-xs text-gray-500 mb-2">{site.address}</p>}

 <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
 <Metric label="계약물량" value={contractQty > 0 ? `${formatNum(contractQty)} m²` : '-'} />
 <Metric label="출고누계" value={shippedQty > 0 ? `${formatNum(shippedQty)} m²` : '0'} />
 <Metric label="사양" value={contract?.specification || '-'} />
 <Metric label="출하차수" value={`${site.shipments?.length || 0}차`} />
 </div>

 <div className="mt-3 space-y-1.5">
 <MiniBar label="판넬 입고" value={panelRate} />
 <MiniBar label="하지파이프" value={pipeRate} />
 <MiniBar label="코킹작업" value={caulkingRate} />
 </div>

 {/* 서류 현황 */}
 <div className="mt-2 flex gap-2">
 <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
 site.startDocsDone ? 'border-green-800/60 text-green-400' : ' text-gray-600'
 }`}>착수서류 {site.startDocsDone ? '✓' : '미완'}</span>
 <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
 site.completionDocsDone ? 'border-green-800/60 text-green-400' : ' text-gray-600'
 }`}>준공서류 {site.completionDocsDone ? '✓' : '미완'}</span>
 </div>
 </div>

 <div className="flex flex-col items-center gap-3">
 <ProgressRing value={finalRate} />
 <div className="flex flex-col gap-1.5 w-full min-w-[72px]">
 <Link href={`/sites/${site.id}?tab=production`} className="btn btn-xs btn-outline w-full">생산</Link>
 {site.siteType !== '납품하차도' && (
 <Link href={`/sites/${site.id}?tab=painting`} className="btn btn-xs btn-outline w-full">도장</Link>
 )}
 <Link href={`/sites/${site.id}?tab=shipping`} className="btn btn-xs btn-outline w-full">출하</Link>
 </div>
 </div>
 </div>
 </div>
 );
 })}
 </div>
 )}
 </div>
 </>
 );
}

function Metric({ label, value }: { label: string; value: string }) {
 return (
 <div className="rounded-lg border px-3 py-2">
 <p className="text-[10px] text-gray-500">{label}</p>
 <p className="text-sm font-semibold text-gray-200 break-words">{value}</p>
 </div>
 );
}

function MiniBar({ label, value }: { label: string; value: number }) {
 const color = value >= 80 ? 'bg-green-500' : value >= 40 ? 'bg-blue-600' : 'bg-yellow-500';
 return (
 <div className="flex items-center gap-2">
 <span className="w-16 shrink-0 text-[10px] text-gray-500">{label}</span>
 <div className="flex-1 h-1.5 rounded-full">
 <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(value, 100)}%` }} />
 </div>
 <span className="w-8 text-right text-[10px] text-gray-400">{value}%</span>
 </div>
 );
}

export async function getServerSideProps({ locale }: GetServerSidePropsContext) {
 return { props: { ...(locale ? await serverSideTranslations(locale, ['common']) : {}) } };
}
