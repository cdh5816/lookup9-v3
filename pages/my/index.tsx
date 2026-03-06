import { GetServerSidePropsContext } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useTranslation } from 'next-i18next';
import { useSession } from 'next-auth/react';
import Head from 'next/head';
import Link from 'next/link';
import {
  UserCircleIcon,
  CalendarDaysIcon,
  EnvelopeIcon,
  BuildingOffice2Icon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';
import useSWR from 'swr';
import fetcher from '@/lib/fetcher';

const statusColors: Record<string, string> = {
  '대기': 'badge-ghost',
  '진행중': 'badge-info',
  '부분완료': 'badge-warning',
  '완료': 'badge-success',
  '보류': 'badge-error',
};

const MyPage = () => {
  const { t } = useTranslation('common');
  const { data: session } = useSession();
  const user = session?.user;

  const { data: userData } = useSWR(user ? '/api/my/profile' : null, fetcher);
  const profile = userData?.data || {};
  const mySites = profile.mySites || [];
  const unreadMessages = profile.unreadMessages || 0;
  const myComments = profile.myComments || [];

  return (
    <>
      <Head><title>{t('my-page-title')} | LOOKUP9</title></Head>
      <div className="space-y-6">
        {/* 기본 정보 */}
        <div className="rounded-lg border border-gray-800 p-6">
          <div className="flex items-center gap-4 mb-4">
            <UserCircleIcon className="w-12 h-12 text-gray-400" />
            <div>
              <h2 className="text-xl font-bold">
                {profile.position && `${profile.position} `}{user?.name}
              </h2>
              <p className="text-sm text-gray-400">{user?.email}</p>
              <p className="text-xs text-gray-500 mt-1">
                {profile.teamMembers?.[0]?.role && (
                  <span className="badge badge-sm mr-2">{profile.teamMembers[0].role}</span>
                )}
                {profile.teamMembers?.[0]?.team?.name}
              </p>
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
          {/* 안 읽은 쪽지 */}
          <Link href="/messages">
            <div className="rounded-lg border border-gray-800 p-6 hover:border-gray-600 transition-colors cursor-pointer">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <EnvelopeIcon className="w-5 h-5 text-purple-400" />
                  <h3 className="font-semibold">{t('my-messages')}</h3>
                </div>
                {unreadMessages > 0 && (
                  <span className="badge badge-sm badge-primary">{unreadMessages}</span>
                )}
              </div>
              {unreadMessages === 0
                ? <p className="text-sm text-gray-500">{t('my-no-messages')}</p>
                : <p className="text-sm text-blue-400">{unreadMessages}{t('msg-unread-count')}</p>
              }
            </div>
          </Link>

          {/* 내 현장 */}
          <div className="rounded-lg border border-gray-800 p-6">
            <div className="flex items-center gap-2 mb-4">
              <BuildingOffice2Icon className="w-5 h-5 text-green-400" />
              <h3 className="font-semibold">{t('my-sites')} ({mySites.length})</h3>
            </div>
            {mySites.length === 0 ? (
              <p className="text-sm text-gray-500">{t('my-no-sites')}</p>
            ) : (
              <div className="space-y-2">
                {mySites.map((site: any) => (
                  <Link key={site.id} href={`/sites/${site.id}`}>
                    <div className="flex items-center justify-between py-1 hover:text-blue-400 transition-colors cursor-pointer">
                      <span className="text-sm">{site.name}</span>
                      <span className={`badge badge-xs ${statusColors[site.status] || 'badge-ghost'}`}>{site.status}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* 내 댓글 */}
          <div className="rounded-lg border border-gray-800 p-6 lg:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <DocumentTextIcon className="w-5 h-5 text-orange-400" />
              <h3 className="font-semibold">{t('my-posts')}</h3>
            </div>
            {myComments.length === 0 ? (
              <p className="text-sm text-gray-500">{t('my-no-posts')}</p>
            ) : (
              <div className="space-y-2">
                {myComments.map((c: any) => (
                  <Link key={c.id} href={`/sites/${c.site?.id}`}>
                    <div className="flex items-center justify-between py-1 hover:text-blue-400 transition-colors cursor-pointer">
                      <p className="text-sm truncate flex-1">
                        <span className="text-gray-500">[{c.site?.name}]</span>{' '}
                        {c.content.length > 50 ? c.content.slice(0, 50) + '...' : c.content}
                      </p>
                      <span className="text-xs text-gray-500 shrink-0 ml-2">{new Date(c.createdAt).toLocaleDateString('ko-KR')}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
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
