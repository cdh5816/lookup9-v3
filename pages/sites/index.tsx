import { GetServerSidePropsContext } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useTranslation } from 'next-i18next';
import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { Button } from 'react-daisyui';
import { PlusIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';

interface SiteData {
  id: string;
  name: string;
  address: string | null;
  status: string;
  createdAt: string;
  client: { name: string } | null;
  createdBy: { name: string; position: string | null };
  _count: { assignments: number; comments: number };
}

const statusColors: Record<string, string> = {
  '대기': 'badge-ghost',
  '진행중': 'badge-info',
  '부분완료': 'badge-warning',
  '완료': 'badge-success',
  '보류': 'badge-error',
};

const SitesList = () => {
  const { t } = useTranslation('common');
  const [sites, setSites] = useState<SiteData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchSites = useCallback(async () => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (statusFilter !== 'all') params.set('status', statusFilter);
    const res = await fetch(`/api/sites?${params}`);
    if (res.ok) { const data = await res.json(); setSites(data.data); }
    setLoading(false);
  }, [search, statusFilter]);

  useEffect(() => { fetchSites(); }, [fetchSites]);

  // 30초 자동 갱신
  useEffect(() => {
    const interval = setInterval(() => { fetchSites(); }, 30000);
    return () => clearInterval(interval);
  }, [fetchSites]);

  return (
    <>
      <Head><title>{t('nav-sites')} | LOOKUP9</title></Head>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">{t('nav-sites')}</h2>
          <Link href="/sites/create">
            <Button color="primary" size="sm">
              <PlusIcon className="w-4 h-4 mr-1" />
              {t('site-create')}
            </Button>
          </Link>
        </div>

        {/* 검색 + 필터 */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              className="input input-bordered w-full pl-10"
              placeholder={t('site-search-placeholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="select select-bordered"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">{t('site-status-all')}</option>
            <option value="대기">{t('site-status-waiting')}</option>
            <option value="진행중">{t('site-status-active')}</option>
            <option value="부분완료">{t('site-status-partial')}</option>
            <option value="완료">{t('site-status-done')}</option>
            <option value="보류">{t('site-status-hold')}</option>
          </select>
        </div>

        {/* 현장 목록 */}
        {loading ? (
          <div className="text-center py-10"><span className="loading loading-spinner loading-md"></span></div>
        ) : sites.length === 0 ? (
          <div className="text-center py-10 text-gray-500">{t('site-no-sites')}</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sites.map((site) => (
              <Link key={site.id} href={`/sites/${site.id}`}>
                <div className="rounded-lg border border-gray-800 p-5 hover:border-gray-600 transition-colors cursor-pointer">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold text-lg">{site.name}</h3>
                    <span className={`badge badge-sm ${statusColors[site.status] || 'badge-ghost'}`}>
                      {site.status}
                    </span>
                  </div>
                  {site.address && <p className="text-sm text-gray-400 mb-1">{site.address}</p>}
                  {site.client && <p className="text-sm text-gray-500">{t('site-client')}: {site.client.name}</p>}
                  <div className="flex items-center justify-between mt-3 text-xs text-gray-500">
                    <span>{site.createdBy.position ? `${site.createdBy.position} ${site.createdBy.name}` : site.createdBy.name}</span>
                    <span>{new Date(site.createdAt).toLocaleDateString('ko-KR')}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
};

export async function getServerSideProps({ locale }: GetServerSidePropsContext) {
  return { props: { ...(locale ? await serverSideTranslations(locale, ['common']) : {}) } };
}

export default SitesList;
