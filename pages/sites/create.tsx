import { GetServerSidePropsContext } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useTranslation } from 'next-i18next';
import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { Button } from 'react-daisyui';
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';

const STATUS_DOT: Record<string, string> = {
  '영업중': 'bg-red-500', '대기': 'bg-red-400', '계약완료': 'bg-yellow-400',
  '진행중': 'bg-green-500', '부분완료': 'bg-green-300', '완료': 'bg-gray-400', '보류': 'bg-gray-600',
};

const siteStatuses = ['영업중', '대기', '계약완료', '진행중', '부분완료', '완료', '보류'];

const CreateSite = () => {
  const { t } = useTranslation('common');
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [clients, setClients] = useState<any[]>([]);
  const [form, setForm] = useState({ name: '', address: '', clientId: '', status: '영업중', description: '' });

  // 담당자 배정
  const [assignees, setAssignees] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/clients').then((r) => r.json()).then((d) => setClients(d.data || []));
  }, []);

  const handleSearch = async (q: string) => {
    setSearchQuery(q);
    if (q.length < 1) { setSearchResults([]); return; }
    const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`);
    if (res.ok) { const d = await res.json(); setSearchResults(d.data || []); }
  };

  const addAssignee = (user: any) => {
    if (!assignees.find((a) => a.id === user.id)) setAssignees([...assignees, user]);
    setSearchQuery(''); setSearchResults([]);
  };

  const removeAssignee = (userId: string) => setAssignees(assignees.filter((a) => a.id !== userId));

  const handleSubmit = async () => {
    if (!form.name) { setError(t('site-name-required')); return; }
    setCreating(true); setError('');

    // 현장 생성
    const res = await fetch('/api/sites', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    if (!res.ok) { const d = await res.json(); setError(d.error?.message || t('unknown-error')); setCreating(false); return; }
    const { data: site } = await res.json();

    // 담당자 배정
    for (const user of assignees) {
      await fetch(`/api/sites/${site.id}/assignments`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });
    }

    router.push(`/sites/${site.id}`);
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
            <input type="text" className="input input-bordered w-full" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="label"><span className="label-text">{t('site-address')}</span></label>
            <input type="text" className="input input-bordered w-full" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
          <div>
            <label className="label"><span className="label-text">{t('site-client')}</span></label>
            <select className="select select-bordered w-full" value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })}>
              <option value="">-</option>
              {clients.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label"><span className="label-text">{t('site-status-label')}</span></label>
            <div className="flex flex-wrap gap-2">
              {siteStatuses.map((s) => (
                <button key={s} type="button" onClick={() => setForm({ ...form, status: s })}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition-colors ${form.status === s ? 'border-blue-500 bg-blue-900/30 text-blue-400' : 'border-gray-700 text-gray-400 hover:border-gray-500'}`}>
                  <span className={`inline-block w-2 h-2 rounded-full ${STATUS_DOT[s] || 'bg-gray-400'}`} />
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label"><span className="label-text">{t('site-description')}</span></label>
            <textarea className="textarea textarea-bordered w-full h-24" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>

          {/* 담당자 배정 */}
          <div>
            <label className="label"><span className="label-text">{t('site-assigned-members')}</span></label>
            {assignees.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {assignees.map((u) => (
                  <span key={u.id} className="badge badge-lg gap-1">
                    {u.position ? `${u.position} ` : ''}{u.name}
                    <button onClick={() => removeAssignee(u.id)}><XMarkIcon className="w-3 h-3" /></button>
                  </span>
                ))}
              </div>
            )}
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="text" className="input input-bordered w-full pl-9" placeholder={t('assign-search-placeholder')}
                value={searchQuery} onChange={(e) => handleSearch(e.target.value)} />
            </div>
            {searchResults.length > 0 && (
              <div className="border border-gray-700 rounded mt-1 max-h-32 overflow-y-auto">
                {searchResults.map((u) => (
                  <button key={u.id} onClick={() => addAssignee(u)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-800">
                    {u.position ? `${u.position} ` : ''}{u.name} <span className="text-gray-500">({u.email})</span>
                  </button>
                ))}
              </div>
            )}
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
