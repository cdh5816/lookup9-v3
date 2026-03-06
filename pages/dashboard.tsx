import { GetServerSidePropsContext } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useTranslation } from 'next-i18next';
import Head from 'next/head';
import Link from 'next/link';
import {
  BuildingOffice2Icon,
  CogIcon,
  TruckIcon,
  EnvelopeIcon,
  BellIcon,
  CalendarDaysIcon,
  MegaphoneIcon,
} from '@heroicons/react/24/outline';
import useSWR from 'swr';
import fetcher from '@/lib/fetcher';

const Dashboard = () => {
  const { t } = useTranslation('common');

  const { data } = useSWR('/api/dashboard/stats', fetcher, { refreshInterval: 30000 });
  const stats = data?.data;

  const { data: noticeData } = useSWR('/api/notices?limit=5', fetcher);
  const notices = noticeData?.data || [];

  const cards = [
    {
      name: t('dash-active-sites'),
      value: stats?.activeSites ?? '-',
      icon: BuildingOffice2Icon,
      color: 'text-blue-400',
      bg: 'bg-blue-400/10',
      href: '/sites',
    },
    {
      name: t('production-total'),
      value: stats?.totalSites ?? '-',
      icon: CogIcon,
      color: 'text-yellow-400',
      bg: 'bg-yellow-400/10',
      href: '/production',
    },
    {
      name: t('dash-shipping'),
      value: stats?.statusCounts?.['부분완료'] ?? '-',
      icon: TruckIcon,
      color: 'text-green-400',
      bg: 'bg-green-400/10',
      href: '/sites',
    },
    {
      name: t('msg-unread'),
      value: stats?.unreadMessages ?? '-',
      icon: EnvelopeIcon,
      color: 'text-purple-400',
      bg: 'bg-purple-400/10',
      href: '/messages',
    },
  ];

  return (
    <>
      <Head>
        <title>{t('nav-dashboard')} | LOOKUP9</title>
      </Head>

      <div className="space-y-8">
        {/* 통계 카드 */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((card) => (
            <Link key={card.name} href={card.href}>
              <div className="rounded-lg border border-gray-800 p-5 hover:border-gray-600 transition-colors cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className={`rounded-lg p-2 ${card.bg}`}>
                    <card.icon className={`w-5 h-5 ${card.color}`} />
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">{card.name}</p>
                    <p className="text-2xl font-bold">{card.value}</p>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* 공지사항 */}
          <div className="rounded-lg border border-gray-800 p-5">
            <div className="flex items-center gap-2 mb-4">
              <MegaphoneIcon className="w-5 h-5 text-red-400" />
              <h3 className="font-semibold">{t('dash-notice')}</h3>
            </div>
            {notices.length === 0 ? (
              <p className="text-sm text-gray-500">{t('dash-no-notice')}</p>
            ) : (
              <div className="space-y-2">
                {notices.map((n: any) => (
                  <div key={n.id} className="py-2 border-b border-gray-800 last:border-0">
                    <div className="flex items-center gap-2">
                      {n.isPinned && <span className="badge badge-xs badge-error">PIN</span>}
                      <span className="text-sm font-medium">{n.title}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {n.author?.position ? `${n.author.position} ` : ''}{n.author?.name}
                      {' · '}{new Date(n.createdAt).toLocaleDateString('ko-KR')}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 오늘 일정 */}
          <div className="rounded-lg border border-gray-800 p-5">
            <div className="flex items-center gap-2 mb-4">
              <CalendarDaysIcon className="w-5 h-5 text-gray-400" />
              <h3 className="font-semibold">{t('dash-today-schedule')}</h3>
            </div>
            <p className="text-sm text-gray-500">{t('dash-no-schedule')}</p>
          </div>
        </div>

        {/* 최근 댓글 */}
        <div className="rounded-lg border border-gray-800 p-5">
          <div className="flex items-center gap-2 mb-4">
            <BellIcon className="w-5 h-5 text-yellow-400" />
            <h3 className="font-semibold">{t('dash-recent-comments')}</h3>
          </div>
          {!stats?.recentComments || stats.recentComments.length === 0 ? (
            <p className="text-sm text-gray-500">{t('dash-no-alerts')}</p>
          ) : (
            <div className="space-y-2">
              {stats.recentComments.map((c: any) => (
                <Link key={c.id} href={`/sites/${c.site?.id}`}>
                  <div className="flex items-center justify-between py-2 px-3 rounded hover:bg-gray-800/50 transition-colors cursor-pointer">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">
                        <span className="text-gray-400">[{c.site?.name}]</span>{' '}
                        {c.content.length > 40 ? c.content.slice(0, 40) + '...' : c.content}
                      </p>
                    </div>
                    <div className="text-xs text-gray-500 shrink-0 ml-3">
                      {c.author?.position ? `${c.author.position} ` : ''}{c.author?.name}
                      {' · '}{new Date(c.createdAt).toLocaleDateString('ko-KR')}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export async function getServerSideProps({ locale }: GetServerSidePropsContext) {
  return { props: { ...(locale ? await serverSideTranslations(locale, ['common']) : {}) } };
}

export default Dashboard;
