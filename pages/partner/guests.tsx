import { GetServerSidePropsContext } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useTranslation } from 'next-i18next';
import { useState, useCallback, useEffect } from 'react';
import Head from 'next/head';
import { Button } from 'react-daisyui';
import { PlusIcon, XMarkIcon } from '@heroicons/react/24/outline';

const PartnerGuestsPage = () => {
  const { t } = useTranslation('common');
  const [guests, setGuests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', company: '' });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchGuests = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/partner/guests');
    if (res.ok) { const data = await res.json(); setGuests(data.data || []); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchGuests(); }, [fetchGuests]);

  const handleCreate = async () => {
    if (!form.name || !form.email || !form.password) { setError(t('msg-fill-all')); return; }
    setCreating(true); setError(''); setSuccess('');
    const res = await fetch('/api/partner/guests', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setSuccess(t('admin-user-created'));
      setForm({ name: '', email: '', password: '', phone: '', company: '' });
      setShowForm(false); fetchGuests();
    } else {
      const data = await res.json(); setError(data.error?.message || t('unknown-error'));
    }
    setCreating(false);
  };

  return (
    <>
      <Head><title>{t('nav-guest-manage')} | LOOKUP9</title></Head>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">{t('nav-guest-manage')}</h2>
          <Button color="primary" size="sm" onClick={() => setShowForm(!showForm)}>
            {showForm ? <XMarkIcon className="w-4 h-4 mr-1" /> : <PlusIcon className="w-4 h-4 mr-1" />}
            {showForm ? t('cancel') : t('guest-create')}
          </Button>
        </div>

        {error && <div className="alert alert-error text-sm"><span>{error}</span></div>}
        {success && <div className="alert alert-success text-sm"><span>{success}</span></div>}

        {showForm && (
          <div className="border border-gray-700 rounded-lg p-5 space-y-4">
            <h3 className="font-semibold">{t('guest-create')}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className="label"><span className="label-text text-xs">{t('name')} *</span></label>
                <input type="text" className="input input-bordered w-full" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><label className="label"><span className="label-text text-xs">{t('email')} *</span></label>
                <input type="email" className="input input-bordered w-full" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div><label className="label"><span className="label-text text-xs">{t('password')} *</span></label>
                <input type="password" className="input input-bordered w-full" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
              <div><label className="label"><span className="label-text text-xs">{t('admin-phone')}</span></label>
                <input type="text" className="input input-bordered w-full" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div><label className="label"><span className="label-text text-xs">{t('admin-company')}</span></label>
                <input type="text" className="input input-bordered w-full" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} /></div>
            </div>
            <div className="flex justify-end">
              <Button color="primary" loading={creating} onClick={handleCreate}>{t('create-account')}</Button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-10"><span className="loading loading-spinner loading-sm"></span></div>
        ) : guests.length === 0 ? (
          <div className="text-center py-10 text-gray-500">{t('guest-none')}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table w-full">
              <thead><tr><th>{t('name')}</th><th>{t('email')}</th><th>{t('admin-company')}</th><th>{t('admin-phone')}</th><th>{t('created-at')}</th></tr></thead>
              <tbody>
                {guests.map((g: any) => (
                  <tr key={g.id}>
                    <td className="font-medium">{g.name}</td>
                    <td>{g.email}</td>
                    <td>{g.company || '-'}</td>
                    <td>{g.phone || '-'}</td>
                    <td className="text-sm text-gray-500">{new Date(g.createdAt).toLocaleDateString('ko-KR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
};

export async function getServerSideProps({ locale }: GetServerSidePropsContext) {
  return { props: { ...(locale ? await serverSideTranslations(locale, ['common']) : {}) } };
}

export default PartnerGuestsPage;
