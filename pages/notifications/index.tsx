import { GetServerSidePropsContext } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useTranslation } from 'next-i18next';
import { useState, useCallback, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { Button } from 'react-daisyui';
import { BellIcon, CheckIcon } from '@heroicons/react/24/outline';

const NotificationsPage = () => {
 const { t } = useTranslation('common');
 const [notifications, setNotifications] = useState<any[]>([]);
 const [loading, setLoading] = useState(true);

 const fetchData = useCallback(async () => {
 setLoading(true);
 const res = await fetch('/api/notifications');
 if (res.ok) { const d = await res.json(); setNotifications(d.data?.notifications || []); }
 setLoading(false);
 }, []);

 useEffect(() => { fetchData(); }, [fetchData]);

 const handleRead = async (id: string) => {
 await fetch('/api/notifications', {
 method: 'PUT', headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ notificationId: id }),
 });
 fetchData();
 };

 const handleReadAll = async () => {
 await fetch('/api/notifications', {
 method: 'PUT', headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ markAll: true }),
 });
 fetchData();
 };

 const unread = notifications.filter((n) => !n.isRead).length;

 return (
 <>
 <Head><title>{t('noti-title')} | LOOKUP9</title></Head>
 <div className="space-y-6">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2">
 <BellIcon className="w-5 h-5 text-yellow-400" />
 <h2 className="text-xl font-bold">{t('noti-title')}</h2>
 {unread > 0 && <span className="badge badge-sm badge-primary">{unread}</span>}
 </div>
 {unread > 0 && <Button size="xs" color="ghost" onClick={handleReadAll}><CheckIcon className="w-4 h-4 mr-1" />{t('noti-read-all')}</Button>}
 </div>

 {loading ? (
 <div className="text-center py-10"><span className="loading loading-spinner loading-sm"></span></div>
 ) : notifications.length === 0 ? (
 <div className="text-center py-10 text-gray-500">{t('noti-empty')}</div>
 ) : (
 <div className="space-y-2">
 {notifications.map((n: any) => {
 const inner = (
 <div>
 <div className="flex items-center justify-between mb-1">
 <span className="text-sm font-medium">{n.title}</span>
 <span className="text-xs text-gray-500">{new Date(n.createdAt).toLocaleString('ko-KR')}</span>
 </div>
 {n.message && <p className="text-sm text-gray-400">{n.message}</p>}
 <span className="text-xs text-gray-600">{n.type}</span>
 </div>
 );
 return (
 <div key={n.id} onClick={() => { if (!n.isRead) handleRead(n.id); }}
 className={`rounded-lg border p-4 cursor-pointer ${n.isRead ? ' opacity-60' : 'border-blue-800 bg-blue-900/10'}`}>
 {n.link ? <Link href={n.link}>{inner}</Link> : inner}
 </div>
 );
 })}
 </div>
 )}
 </div>
 </>
 );
};

export async function getServerSideProps({ locale }: GetServerSidePropsContext) {
 return { props: { ...(locale ? await serverSideTranslations(locale, ['common']) : {}) } };
}

export default NotificationsPage;
