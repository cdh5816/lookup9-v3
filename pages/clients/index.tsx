import { GetServerSidePropsContext } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useTranslation } from 'next-i18next';
import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import { Button } from 'react-daisyui';
import { PlusIcon, TrashIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface ClientData {
  id: string;
  name: string;
  contact: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  type: string;
  notes: string | null;
  _count: { sites: number };
}

const ClientsList = () => {
  const { t } = useTranslation('common');
  const [clients, setClients] = useState<ClientData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState({ name: '', contact: '', phone: '', email: '', address: '', type: '발주처', notes: '' });

  const fetchClients = useCallback(async () => {
    const res = await fetch('/api/clients');
    if (res.ok) { const data = await res.json(); setClients(data.data); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchClients(); }, [fetchClients]);

  const handleCreate = async () => {
    if (!form.name) { setError(t('client-name-required')); return; }
    setCreating(true); setError(''); setSuccess('');
    const res = await fetch('/api/clients', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    });
    if (res.ok) {
      setSuccess(t('client-created')); setForm({ name: '', contact: '', phone: '', email: '', address: '', type: '발주처', notes: '' });
      setShowCreate(false); fetchClients();
    } else { const data = await res.json(); setError(data.error?.message || t('unknown-error')); }
    setCreating(false);
  };

  const handleDelete = async (clientId: string, clientName: string) => {
    if (!confirm(`${clientName} ${t('client-delete-confirm')}`)) return;
    const res = await fetch('/api/clients', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clientId }),
    });
    if (res.ok) { setSuccess(t('client-deleted')); fetchClients(); }
  };

  return (
    <>
      <Head><title>{t('nav-clients')} | LOOKUP9</title></Head>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">{t('nav-clients')}</h2>
          <Button color="primary" size="sm" onClick={() => setShowCreate(!showCreate)}>
            {showCreate ? <XMarkIcon className="w-4 h-4 mr-1" /> : <PlusIcon className="w-4 h-4 mr-1" />}
            {showCreate ? t('cancel') : t('client-create')}
          </Button>
        </div>
        {error && <div className="alert alert-error text-sm"><span>{error}</span></div>}
        {success && <div className="alert alert-success text-sm"><span>{success}</span></div>}
        {showCreate && (
          <div className="border border-gray-700 rounded-lg p-6 space-y-4">
            <h3 className="text-lg font-semibold">{t('client-create')}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className="label"><span className="label-text">{t('client-name')} *</span></label>
                <input type="text" className="input input-bordered w-full" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><label className="label"><span className="label-text">{t('client-contact')}</span></label>
                <input type="text" className="input input-bordered w-full" value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} /></div>
              <div><label className="label"><span className="label-text">{t('admin-phone')}</span></label>
                <input type="text" className="input input-bordered w-full" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div><label className="label"><span className="label-text">{t('email')}</span></label>
                <input type="email" className="input input-bordered w-full" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div><label className="label"><span className="label-text">{t('client-address')}</span></label>
                <input type="text" className="input input-bordered w-full" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
              <div><label className="label"><span className="label-text">{t('client-type')}</span></label>
                <select className="select select-bordered w-full" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  <option value="발주처">발주처</option><option value="협력사">협력사</option><option value="기타">기타</option>
                </select></div>
            </div>
            <div><label className="label"><span className="label-text">{t('client-notes')}</span></label>
              <textarea className="textarea textarea-bordered w-full" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            <div className="flex justify-end"><Button color="primary" loading={creating} onClick={handleCreate}>{t('client-create')}</Button></div>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="table w-full">
            <thead><tr><th>{t('client-name')}</th><th>{t('client-type')}</th><th>{t('client-contact')}</th><th>{t('admin-phone')}</th><th>{t('site-count')}</th><th>{t('actions')}</th></tr></thead>
            <tbody>
              {loading ? (<tr><td colSpan={6} className="text-center"><span className="loading loading-spinner loading-sm"></span></td></tr>
              ) : clients.length === 0 ? (<tr><td colSpan={6} className="text-center text-gray-500">{t('client-none')}</td></tr>
              ) : (clients.map((c) => (
                <tr key={c.id}>
                  <td className="font-medium">{c.name}</td>
                  <td><span className="badge badge-sm">{c.type}</span></td>
                  <td>{c.contact || '-'}</td><td>{c.phone || '-'}</td>
                  <td>{c._count.sites}</td>
                  <td><button className="btn btn-ghost btn-xs text-error" onClick={() => handleDelete(c.id, c.name)}><TrashIcon className="w-4 h-4" /></button></td>
                </tr>
              )))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
};

export async function getServerSideProps({ locale }: GetServerSidePropsContext) {
  return { props: { ...(locale ? await serverSideTranslations(locale, ['common']) : {}) } };
}

export default ClientsList;
