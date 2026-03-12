/*
 * AIRX (individual business) proprietary source.
 * Owner: AIRX / choe DONGHYUN. All rights reserved.
 */

import { GetServerSidePropsContext } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import Head from 'next/head';
import Link from 'next/link';
import useSWR from 'swr';
import fetcher from '@/lib/fetcher';
import { getProductionMetrics } from '@/lib/site-progress';

const STATUS_DOT: Record<string, string> = {
  영업중: 'bg-red-500',
  대기: 'bg-red-400',
  계약완료: 'bg-yellow-400',
  진행중: 'bg-green-500',
  부분완료: 'bg-green-300',
  완료: 'bg-gray-400',
  보류: 'bg-gray-600',
};

const ProgressBar = ({ value }: { value: number }) => (
  <div className="h-2 w-full overflow-hidden rounded-full bg-gray-800">
    <div className="h-full rounded-full bg-blue-600" style={{ width: `${value}%` }} />
  </div>
);

export default function ProductionDashboard() {
  const { data: allData } = useSWR('/api/sites', fetcher, { refreshInterval: 30000 });
  const allSites: any[] = allData?.data || [];
  const activeSites = allSites.filter((s) => ['계약완료', '진행중', '부분완료'].includes(s.status));

  const summary = activeSites.reduce(
    (acc, site) => {
      const m = getProductionMetrics(site.description, site.shipments);
      acc.total += 1;
      acc.avg += m.finalProgress;
      if (m.finalProgress >= 100) acc.done += 1;
      if (site.status === '진행중' || site.status === '부분완료') acc.ing += 1;
      return acc;
    },
    { total: 0, avg: 0, done: 0, ing: 0 }
  );
  const avgProgress = summary.total ? Math.round(summary.avg / summary.total) : 0;

  return (
    <>
      <Head>
        <title>생산관리 | LOOKUP9</title>
      </Head>
      <div className="space-y-6">
        <div className="rounded-2xl border border-gray-800 bg-black/20 p-5">
          <p className="text-sm text-gray-400">생산관리</p>
          <h2 className="mt-1 text-2xl font-bold">생산 · 도장 · 출하 상황판</h2>
          <p className="mt-2 text-sm leading-6 text-gray-500 break-words">발주물량, 발주일, 출고일과 세부 공정률을 기준으로 최종 생산 공정률을 표시합니다.</p>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <SummaryCard label="관리 대상 현장" value={summary.total} />
          <SummaryCard label="평균 공정률" value={`${avgProgress}%`} />
          <SummaryCard label="진행중" value={summary.ing} />
          <SummaryCard label="완료" value={summary.done} />
        </div>

        <div className="space-y-4">
          {activeSites.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-700 py-12 text-center text-gray-500">생산 대상 현장이 없습니다.</div>
          ) : (
            activeSites.map((site) => {
              const m = getProductionMetrics(site.description, site.shipments);
              return (
                <div key={site.id} className="rounded-2xl border border-gray-800 bg-black/20 p-5">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-block h-2.5 w-2.5 rounded-full ${STATUS_DOT[site.status] || 'bg-gray-400'}`} />
                        <h3 className="break-words text-lg font-bold">{site.name}</h3>
                        <span className="rounded-full border border-gray-700 px-2 py-0.5 text-xs text-gray-300">{site.status}</span>
                      </div>
                      <p className="mt-2 break-words text-sm leading-6 text-gray-400">{site.client?.name || '-'} · {site.address || '주소 미입력'}</p>
                      <div className="mt-4 rounded-xl bg-gray-900/40 p-3">
                        <div className="mb-2 flex items-center justify-between text-xs text-gray-400">
                          <span>최종 생산 공정률</span>
                          <span>{m.finalProgress}%</span>
                        </div>
                        <ProgressBar value={m.finalProgress} />
                      </div>
                    </div>

                    <div className="grid w-full grid-cols-2 gap-3 xl:w-[360px]">
                      <MetaCard label="발주물량" value={m.orderedQty ? `${m.orderedQty.toLocaleString()}` : '-'} />
                      <MetaCard label="출고누계" value={`${m.shippedQty.toLocaleString()}`} />
                      <MetaCard label="발주일" value={m.orderDate || '-'} />
                      <MetaCard label="출고일" value={m.shipDate || '-'} />
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                    <MiniProgress label="하지파이프" value={m.pipeRate} />
                    <MiniProgress label="판넬 입고" value={m.panelRate} />
                    <MiniProgress label="코킹" value={m.caulkingRate} />
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link href={`/sites/${site.id}`} className="btn btn-sm">현장상세</Link>
                    <Link href={`/sites/${site.id}?tab=production`} className="btn btn-sm btn-primary">생산</Link>
                    <Link href={`/sites/${site.id}?tab=painting`} className="btn btn-sm">도장</Link>
                    <Link href={`/sites/${site.id}?tab=shipping`} className="btn btn-sm">출하</Link>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}

function SummaryCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-gray-800 bg-black/20 p-4">
      <p className="text-sm text-gray-400">{label}</p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  );
}

function MetaCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/40 px-3 py-2">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold">{value}</p>
    </div>
  );
}

function MiniProgress({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-gray-900/40 p-3">
      <div className="mb-2 flex items-center justify-between text-xs text-gray-400">
        <span>{label}</span>
        <span>{value}%</span>
      </div>
      <ProgressBar value={value} />
    </div>
  );
}

export async function getServerSideProps({ locale }: GetServerSidePropsContext) {
  return { props: { ...(locale ? await serverSideTranslations(locale, ['common']) : {}) } };
}
