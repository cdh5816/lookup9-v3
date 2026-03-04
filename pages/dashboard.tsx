import { GetServerSidePropsContext } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useTranslation } from 'next-i18next';
import Head from 'next/head';
import {
  BuildingOffice2Icon,
  CogIcon,
  TruckIcon,
  WrenchScrewdriverIcon,
  BellIcon,
  CalendarDaysIcon,
} from '@heroicons/react/24/outline';

const Dashboard = () => {
  const { t } = useTranslation('common');

  const stats = [
    {
      name: t('dash-active-sites'),
      value: '-',
      icon: BuildingOffice2Icon,
      color: 'text-blue-400',
      bg: 'bg-blue-400/10',
    },
    {
      name: t('dash-production'),
      value: '-',
      icon: CogIcon,
      color: 'text-yellow-400',
      bg: 'bg-yellow-400/10',
    },
    {
      name: t('dash-shipping'),
      value: '-',
      icon: TruckIcon,
      color: 'text-green-400',
      bg: 'bg-green-400/10',
    },
    {
      name: t('dash-construction'),
      value: '-',
      icon: WrenchScrewdriverIcon,
      color: 'text-purple-400',
      bg: 'bg-purple-400/10',
    },
  ];

  return (
    <>
      <Head>
        <title>{t('nav-dashboard')} | LOOKUP9</title>
      </Head>

      <div className="space-y-8">
        {/* 상단 통계 카드 */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <div
              key={stat.name}
              className="rounded-lg border border-gray-800 p-5"
            >
              <div className="flex items-center gap-3">
                <div className={`rounded-lg p-2 ${stat.bg}`}>
                  <stat.icon className={`w-5 h-5 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-sm text-gray-400">{stat.name}</p>
                  <p className="text-2xl font-bold">{stat.value}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* 오늘 일정 */}
          <div className="rounded-lg border border-gray-800 p-5">
            <div className="flex items-center gap-2 mb-4">
              <CalendarDaysIcon className="w-5 h-5 text-gray-400" />
              <h3 className="font-semibold">{t('dash-today-schedule')}</h3>
            </div>
            <p className="text-sm text-gray-500">{t('dash-no-schedule')}</p>
          </div>

          {/* 최근 알림 */}
          <div className="rounded-lg border border-gray-800 p-5">
            <div className="flex items-center gap-2 mb-4">
              <BellIcon className="w-5 h-5 text-gray-400" />
              <h3 className="font-semibold">{t('dash-recent-alerts')}</h3>
            </div>
            <p className="text-sm text-gray-500">{t('dash-no-alerts')}</p>
          </div>
        </div>
      </div>
    </>
  );
};

export async function getServerSideProps({
  locale,
}: GetServerSidePropsContext) {
  return {
    props: {
      ...(locale ? await serverSideTranslations(locale, ['common']) : {}),
    },
  };
}

export default Dashboard;
