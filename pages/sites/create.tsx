import { GetServerSidePropsContext } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useTranslation } from 'next-i18next';
import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { Button } from 'react-daisyui';

const CreateSite = () => {
  const { t } = useTranslation('common');
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [clients, setClients] = useState<any[]>([]);
  const [form, setForm] = useState({
    name: '', address: '', clientId: '', status: '대기', description: '',
  });

  useEffect(() => {
    fetch('/api/clients').then(r => r.json()).then(d => setClients(d.data || []));
  }, []);

  const handleSubmit = async () => {
    if (!form.name) { setError(t('site-name-required')); return; }
    setCreating(true); setError('');
    const res = await fetch('/api/sites', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    if (res.ok) { const data = await res.json(); router.push(`/sites/${data.data.id}`); }
    else { const data = await res.json(); setError(data.error?.message || t('unknown-error')); }
    setCreating(false);
  };

  return (
    <>
      <Head><title>{t('site-create')} | LOOKUP9</title></Head>
      <div className="max-w-2xl space-y-6">
        <h2 className="text-xl font-bold">{t('site-create')}</h2>
        {error && <div className="alert alert-error text-sm"><span>{error}</span></div>}
        <div className="space-y-4">
          <div>
            <label className="label"><span className="label-text">{t('site-name')} *</span></label>
            <input type="text" className="input input-bordered w-full" value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="label"><span className="label-text">{t('site-address')}</span></label>
            <input type="text" className="input input-bordered w-full" value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
          <div>
            <label className="label"><span className="label-text">{t('site-client')}</span></label>
            <select className="select select-bordered w-full" value={form.clientId}
              onChange={(e) => setForm({ ...form, clientId: e.target.value })}>
              <option value="">-</option>
              {clients.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label"><span className="label-text">{t('site-status-label')}</span></label>
            <select className="select select-bordered w-full" value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="대기">{t('site-status-waiting')}</option>
              <option value="진행중">{t('site-status-active')}</option>
              <option value="보류">{t('site-status-hold')}</option>
            </select>
          </div>
          <div>
            <label className="label"><span className="label-text">{t('site-description')}</span></label>
            <textarea className="textarea textarea-bordered w-full h-24" value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
        </div>
        <div className="flex gap-3">
          <Button color="primary" loading={creating} onClick={handleSubmit}>{t('site-create')}</Button>
          <Button color="ghost" onClick={() => router.back()}>{t('cancel')}</Button>
        </div>
      </div>
    </>
  );
};

export async function getServerSideProps({ locale }: GetServerSidePropsContext) {
  return { props: { ...(locale ? await serverSideTranslations(locale, ['common']) : {}) } };
}

export default CreateSite;
