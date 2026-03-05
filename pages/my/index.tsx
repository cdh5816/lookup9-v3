import { GetServerSidePropsContext } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useTranslation } from 'next-i18next';
import { useSession } from 'next-auth/react';
import Head from 'next/head';
import {
  UserCircleIcon,
  CalendarDaysIcon,
  BellIcon,
  EnvelopeIcon,
  BuildingOffice2Icon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';
import useSWR from 'swr';
import fetcher from '@/lib/fetcher';

const MyPage = () => {
  const { t } = useTranslation('common');
  const { data: session } = useSession();
  const user = session?.user;

  // 유저 상세 정보
  const { data: userData } = useSWR(
    user ? `/api/my/profile` : null,
    fetcher
  );
  const profile = userData?.data || {};

  return (
    <>
      <Head>
        <title>{t('my-page-title')} | LOOKUP9</title>
      </Head>

      <div className="space-y-6">
        {/* 내 기본 정보 */}
        <div className="rounded-lg border border-gray-800 p-6">
          <div className="flex items-center gap-4 mb-4">
            <UserCircleIcon className="w-12 h-12 text-gray-400" />
            <div>
              <h2 className="text-xl font-bold">
                {profile.position && `${profile.position} `}{user?.name}
              </h2>
              <p className="text-sm text-gray-400">{user?.email}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
            <div>
              <p className="text-xs text-gray-500">{t('admin-company')}</p>
              <p className="text-sm font-medium">{profile.company || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">{t('admin-department')}</p>
              <p className="text-sm font-medium">{profile.department || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">{t('admin-position')}</p>
              <p className="text-sm font-medium">{profile.position || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">{t('admin-phone')}</p>
              <p className="text-sm font-medium">{profile.phone || '-'}</p>
            </div>
          </div>
        </div>

        {/* 연차 현황 */}
        <div className="rounded-lg border border-gray-800 p-6">
          <div className="flex items-center gap-2 mb-4">
            <CalendarDaysIcon className="w-5 h-5 text-blue-400" />
            <h3 className="font-semibold">{t('my-leave-status')}</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="rounded-lg bg-blue-400/10 p-4 text-center">
              <p className="text-2xl font-bold text-blue-400">-</p>
              <p className="text-xs text-gray-400 mt-1">{t('my-leave-total')}</p>
            </div>
            <div className="rounded-lg bg-yellow-400/10 p-4 text-center">
              <p className="text-2xl font-bold text-yellow-400">-</p>
              <p className="text-xs text-gray-400 mt-1">{t('my-leave-used')}</p>
            </div>
            <div className="rounded-lg bg-green-400/10 p-4 text-center">
              <p className="text-2xl font-bold text-green-400">-</p>
              <p className="text-xs text-gray-400 mt-1">{t('my-leave-remaining')}</p>
            </div>
            <div className="rounded-lg bg-gray-400/10 p-4 text-center">
              <p className="text-sm font-bold text-gray-400">-</p>
              <p className="text-xs text-gray-400 mt-1">{t('my-leave-reset')}</p>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-3">{t('my-leave-coming-soon')}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 최근 알림 */}
          <div className="rounded-lg border border-gray-800 p-6">
            <div className="flex items-center gap-2 mb-4">
              <BellIcon className="w-5 h-5 text-yellow-400" />
              <h3 className="font-semibold">{t('dash-recent-alerts')}</h3>
            </div>
            <p className="text-sm text-gray-500">{t('dash-no-alerts')}</p>
          </div>

          {/* 쪽지 */}
          <div className="rounded-lg border border-gray-800 p-6">
            <div className="flex items-center gap-2 mb-4">
              <EnvelopeIcon className="w-5 h-5 text-purple-400" />
              <h3 className="font-semibold">{t('my-messages')}</h3>
            </div>
            <p className="text-sm text-gray-500">{t('my-no-messages')}</p>
          </div>

          {/* 내 현장 */}
          <div className="rounded-lg border border-gray-800 p-6">
            <div className="flex items-center gap-2 mb-4">
              <BuildingOffice2Icon className="w-5 h-5 text-green-400" />
              <h3 className="font-semibold">{t('my-sites')}</h3>
            </div>
            <p className="text-sm text-gray-500">{t('my-no-sites')}</p>
          </div>

          {/* 내 글 */}
          <div className="rounded-lg border border-gray-800 p-6">
            <div className="flex items-center gap-2 mb-4">
              <DocumentTextIcon className="w-5 h-5 text-orange-400" />
              <h3 className="font-semibold">{t('my-posts')}</h3>
            </div>
            <p className="text-sm text-gray-500">{t('my-no-posts')}</p>
          </div>
        </div>
      </div>
    </>
  );
};

export async function getServerSideProps({ locale }: GetServerSidePropsContext) {
  return { props: { ...(locale ? await serverSideTranslations(locale, ['common']) : {}) } };
}

export default MyPage;
