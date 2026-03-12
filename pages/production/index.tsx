import { GetServerSidePropsContext } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import Head from 'next/head';
import Link from 'next/link';
import useSWR from 'swr';
import fetcher from '@/lib/fetcher';

const STATUS_DOT: Record<string, string> = {
  영업중: 'bg-red-500', 대기: 'bg-red-400', 계약완료: 'bg-yellow-400',
  진행중: 'bg-green-500', 부분완료: 'bg-green-300', 완료: 'bg-gray-400', 보류: 'bg-gray-600',
};

const parseLabel = (text: string | null | undefined, label: string) => {
  if (!text) return '';
  const esc = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = text.match(new RegExp(`${esc}\\s*[:：]\\s*([^\\n\\r]+)`, 'i'));
  return m?.[1]?.trim() || '';
};

const toNum = (value: string | null | undefined) => {
  const num = Number(String(value || '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(num) ? num : 0;
};

const pct = (v: number) => Math.max(0, Math.min(100, Math.round(v)));

const getProgress = (site: any) => {
  const description = site?.description || '';
  const pipe = pct(toNum(parseLabel(description, '하지파이프 진행률')));
  const caulk = pct(toNum(parseLabel(description, '코킹작업 진행률')));
  const quantity = toNum(parseLabel(description, '물량'));
  const incoming = (site?.shipments || []).reduce((sum: number, item: any) => sum + toNum(item?.quantity), 0);
  const panel = quantity > 0 ? pct((incoming / quantity) * 100) : 0;
  const startDoc = parseLabel(description, '착수서류 완료') === 'Y' ? 100 : 0;
  const finishDoc = parseLabel(description, '준공서류 완료') === 'Y' ? 100 : 0;
  return pct((pipe + panel + caulk + startDoc + finishDoc) / 5);
};

const ProductionDashboard = () => {
  const { data: allData } = useSWR('/api/sites', fetcher, { refreshInterval: 30000 });
  const { data: profile } = useSWR('/api/my/profile', fetcher);
  const allSites: any[] = allData?.data || [];
  const companyName = profile?.data?.companyDisplayName || 'LOOKUP9';
  const activeSites = allSites.filter((s) => ['진행중', '부분완료', '계약완료'].includes(s.status));

  const statusCounts = allSites.reduce((acc: Record<string, number>, site: any) => {
    acc[site.status] = (acc[site.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <>
      <Head><title>생산관리 | {companyName}</title></Head>
      <div className="space-y-6">
        <div className="rounded-2xl border border-gray-800 bg-black/20 p-5">
          <p className="text-sm text-gray-400">{companyName}</p>
          <h2 className="mt-1 text-2xl font-bold">생산관리</h2>
          <p className="mt-2 text-sm leading-6 text-gray-500 break-words">생산·도장·출하 흐름을 한 화면에서 확인하고, 현장상세로 바로 이동할 수 있게 정리했다.</p>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {[
            { label: '전체 현장', value: allSites.length },
            { label: '계약완료', value: statusCounts['계약완료'] || 0 },
            { label: '진행중', value: statusCounts['진행중'] || 0 },
            { label: '부분완료', value: statusCounts['부분완료'] || 0 },
            { label: '완료', value: statusCounts['완료'] || 0 },
          ].map((card) => (
            <div key={card.label} className="rounded-2xl border border-gray-800 bg-black/20 p-4 text-center">
              <p className="text-2xl font-bold">{card.value}</p>
              <p className="mt-1 text-xs text-gray-500">{card.label}</p>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          {activeSites.map((site) => {
            const progress = getProgress(site);
            return (
              <div key={site.id} className="rounded-2xl border border-gray-800 bg-black/10 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-block h-2.5 w-2.5 rounded-full ${STATUS_DOT[site.status] || 'bg-gray-400'}`} />
                      <h3 className="truncate text-lg font-bold">{site.name}</h3>
                      <span className="rounded-full border border-gray-700 px-2 py-0.5 text-xs text-gray-300">{site.status}</span>
                    </div>
                    <p className="mt-2 break-words text-sm leading-6 text-gray-400">{site.address || '주소 미입력'}</p>
                    <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-gray-800">
                      <div className="h-full rounded-full bg-blue-600" style={{ width: `${progress}%` }} />
                    </div>
                    <div className="mt-2 text-xs text-gray-500">최종 공정률 {progress}%</div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 md:grid-cols-1">
                    <Link href={`/sites/${site.id}`} className="rounded-lg border border-gray-700 px-3 py-2 text-center text-sm hover:border-gray-500">현장상세</Link>
                    <Link href={`/sites/${site.id}?tab=painting`} className="rounded-lg border border-gray-700 px-3 py-2 text-center text-sm hover:border-gray-500">도장</Link>
                    <Link href={`/sites/${site.id}?tab=shipping`} className="rounded-lg border border-gray-700 px-3 py-2 text-center text-sm hover:border-gray-500">출하</Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
};

export async function getServerSideProps({ locale }: GetServerSidePropsContext) {
  return { props: { ...(locale ? await serverSideTranslations(locale, ['common']) : {}) } };
}

export default ProductionDashboard;
