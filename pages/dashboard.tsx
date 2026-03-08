import { GetServerSidePropsContext } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useTranslation } from 'next-i18next';
import Head from 'next/head';
import Link from 'next/link';
import {
  BuildingOffice2Icon, CogIcon, TruckIcon, EnvelopeIcon,
  BellIcon, CalendarDaysIcon, MegaphoneIcon,
} from '@heroicons/react/24/outline';
import useSWR from 'swr';
import fetcher from '@/lib/fetcher';

const STATUS_DOT: Record<string, string> = {
  '영업중': 'bg-red-500', '대기': 'bg-red-400', '계약완료': 'bg-yellow-400',
  '진행중': 'bg-green-500', '부분완료': 'bg-green-300', '완료': 'bg-gray-400', '보류': 'bg-gray-600',
};

const Dashboard = () => {
  const { t } = useTranslation('common');

  const { data: profileData } = useSWR('/api/my/profile', fetcher, { refreshInterval: 30000 });
  const profile = profileData?.data || {};
  const userRole = profile.teamMembers?.[0]?.role || 'USER';
  const isGuest = userRole === 'GUEST';
  const isPartner = userRole === 'PARTNER';

  // Hook은 조건 분기 전에 모두 호출
  const { data } = useSWR('/api/dashboard/stats', fetcher, { refreshInterval: 30000 });
  const stats = data?.data;

  const { data: noticeData } = useSWR(!isGuest ? '/api/notices?limit=5' : null, fetcher);
  const notices = noticeData?.data || [];

  // GUEST 대시보드
  if (isGuest) return <GuestDashboard profile={profile} />;

  // PARTNER 대시보드
  if (isPartner) return <PartnerDashboard profile={profile} notices={notices} />;

  // USER 이상 풀 대시보드
  const cards = [
    { name: t('dash-active-sites'), value: stats?.activeSites ?? '-', icon: BuildingOffice2Icon, color: 'text-blue-400', bg: 'bg-blue-400/10', href: '/sites' },
    { name: t('production-total'), value: stats?.totalSites ?? '-', icon: CogIcon, color: 'text-yellow-400', bg: 'bg-yellow-400/10', href: '/production' },
    { name: t('dash-shipping'), value: stats?.statusCounts?.['부분완료'] ?? '-', icon: TruckIcon, color: 'text-green-400', bg: 'bg-green-400/10', href: '/sites' },
    { name: t('msg-unread'), value: stats?.unreadMessages ?? '-', icon: EnvelopeIcon, color: 'text-purple-400', bg: 'bg-purple-400/10', href: '/messages' },
  ];

  return (
    <>
      <Head><title>{t('nav-dashboard')} | LOOKUP9</title></Head>
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((c) => (
            <Link key={c.name} href={c.href}>
              <div className="rounded-lg border border-gray-800 p-5 hover:border-gray-600 transition-colors cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className={`rounded-lg p-2 ${c.bg}`}><c.icon className={`w-5 h-5 ${c.color}`} /></div>
                  <div><p className="text-sm text-gray-400">{c.name}</p><p className="text-2xl font-bold">{c.value}</p></div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <NoticeCard notices={notices} />
          <div className="rounded-lg border border-gray-800 p-5">
            <div className="flex items-center gap-2 mb-4"><CalendarDaysIcon className="w-5 h-5 text-gray-400" /><h3 className="font-semibold">{t('dash-today-schedule')}</h3></div>
            <p className="text-sm text-gray-500">{t('dash-no-schedule')}</p>
          </div>
        </div>

        {stats?.recentComments?.length > 0 && (
          <div className="rounded-lg border border-gray-800 p-5">
            <div className="flex items-center gap-2 mb-4"><BellIcon className="w-5 h-5 text-yellow-400" /><h3 className="font-semibold">{t('dash-recent-comments')}</h3></div>
            <div className="space-y-2">
              {stats.recentComments.map((c: any) => (
                <Link key={c.id} href={`/sites/${c.site?.id}`}>
                  <div className="flex items-center justify-between py-2 px-3 rounded hover:bg-gray-800/50 transition-colors cursor-pointer">
                    <p className="text-sm truncate flex-1"><span className="text-gray-400">[{c.site?.name}]</span> {c.content.length > 40 ? c.content.slice(0, 40) + '...' : c.content}</p>
                    <span className="text-xs text-gray-500 shrink-0 ml-3">{c.author?.position ? `${c.author.position} ` : ''}{c.author?.name}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
};

// ========= GUEST 대시보드 =========
const GuestDashboard = ({ profile }: { profile: any }) => {
  const { t } = useTranslation('common');
  const mySites = profile.mySites || [];

  return (
    <>
      <Head><title>{t('nav-dashboard')} | LOOKUP9</title></Head>
      <div className="space-y-6">
        <h2 className="text-lg font-bold">{t('guest-welcome')}</h2>
        {mySites.length === 0 ? (
          <p className="text-sm text-gray-500">{t('my-no-sites')}</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {mySites.map((site: any) => (
              <Link key={site.id} href={`/guest/site/${site.id}`}>
                <div className="rounded-lg border border-gray-800 p-5 hover:border-gray-600 transition-colors cursor-pointer">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`inline-block w-2.5 h-2.5 rounded-full ${STATUS_DOT[site.status] || 'bg-gray-400'}`} />
                    <h3 className="font-bold">{site.name}</h3>
                    <span className="text-xs text-gray-400 ml-auto">{site.status}</span>
                  </div>
                  {site.address && <p className="text-sm text-gray-400">{site.address}</p>}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
};

// ========= PARTNER 대시보드 =========
const PartnerDashboard = ({ profile, notices }: { profile: any; notices: any[] }) => {
  const { t } = useTranslation('common');
  const mySites = profile.mySites || [];

  return (
    <>
      <Head><title>{t('nav-dashboard')} | LOOKUP9</title></Head>
      <div className="space-y-6">
        {/* 공지사항 */}
        {notices.length > 0 && <NoticeCard notices={notices} />}

        {/* 내 현장 */}
        <div>
          <h3 className="text-lg font-bold mb-4">{t('nav-my-sites')}</h3>
          {mySites.length === 0 ? (
            <p className="text-sm text-gray-500">{t('my-no-sites')}</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {mySites.map((site: any) => (
                <Link key={site.id} href={`/sites/${site.id}`}>
                  <div className="rounded-lg border border-gray-800 p-5 hover:border-gray-600 transition-colors cursor-pointer">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`inline-block w-2.5 h-2.5 rounded-full ${STATUS_DOT[site.status] || 'bg-gray-400'}`} />
                      <h3 className="font-bold">{site.name}</h3>
                      <span className="text-xs text-gray-400 ml-auto">{site.status}</span>
                    </div>
                    {site.address && <p className="text-sm text-gray-400">{site.address}</p>}
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

// ========= 공지 카드 =========
const NoticeCard = ({ notices }: { notices: any[] }) => {
  const { t } = useTranslation('common');
  return (
    <div className="rounded-lg border border-gray-800 p-5">
      <div className="flex items-center gap-2 mb-4"><MegaphoneIcon className="w-5 h-5 text-red-400" /><h3 className="font-semibold">{t('dash-notice')}</h3></div>
      {notices.length === 0 ? <p className="text-sm text-gray-500">{t('dash-no-notice')}</p> : (
        <div className="space-y-2">
          {notices.map((n: any) => (
            <div key={n.id} className="py-2 border-b border-gray-800 last:border-0">
              <div className="flex items-center gap-2">{n.isPinned && <span className="badge badge-xs badge-error">PIN</span>}<span className="text-sm font-medium">{n.title}</span></div>
              <p className="text-xs text-gray-500 mt-1">{n.author?.position ? `${n.author.position} ` : ''}{n.author?.name} · {new Date(n.createdAt).toLocaleDateString('ko-KR')}</p>
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

export default Dashboard;
