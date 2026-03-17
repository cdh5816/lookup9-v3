/* eslint-disable i18next/no-literal-string */
import { GetServerSidePropsContext } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useState, useCallback, useEffect } from 'react';
import Head from 'next/head';
import { PlusIcon, XMarkIcon, TrashIcon } from '@heroicons/react/24/outline';

const PartnerGuestsPage = () => {
  const [guests, setGuests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', username: '', password: '', phone: '', company: '' });
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
    if (!form.name || !form.username || !form.password) {
      setError('이름, 아이디, 비밀번호는 필수입니다.'); return;
    }
    setCreating(true); setError(''); setSuccess('');
    const res = await fetch('/api/partner/guests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (res.ok) {
      setSuccess('게스트 계정이 생성되었습니다.');
      setForm({ name: '', username: '', password: '', phone: '', company: '' });
      setShowForm(false);
      fetchGuests();
    } else {
      setError(data.error?.message || '생성 실패');
    }
    setCreating(false);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`"${name}" 계정을 삭제하시겠습니까?`)) return;
    const res = await fetch('/api/partner/guests', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guestId: id }),
    });
    if (res.ok) { setSuccess('삭제되었습니다.'); fetchGuests(); }
    else { const d = await res.json(); setError(d.error?.message || '삭제 실패'); }
  };

  return (
    <>
      <Head><title>게스트 관리 | LOOKUP9</title></Head>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">게스트 관리</h2>
            <p className="text-sm text-gray-400 mt-0.5">현장 열람용 게스트 계정을 생성·관리합니다.</p>
          </div>
          <button className="btn btn-primary btn-sm gap-1.5" onClick={() => { setShowForm(!showForm); setError(''); }}>
            {showForm ? <XMarkIcon className="h-4 w-4" /> : <PlusIcon className="h-4 w-4" />}
            {showForm ? '닫기' : '게스트 추가'}
          </button>
        </div>

        {error   && <div className="rounded-lg border border-red-800/50 bg-red-950/20 px-3 py-2.5 text-sm text-red-300 flex items-center justify-between"><span>{error}</span><button onClick={() => setError('')}><XMarkIcon className="h-4 w-4" /></button></div>}
        {success && <div className="rounded-lg border border-green-800/50 bg-green-950/20 px-3 py-2.5 text-sm text-green-300 flex items-center justify-between"><span>{success}</span><button onClick={() => setSuccess('')}><XMarkIcon className="h-4 w-4" /></button></div>}

        {showForm && (
          <div className="rounded-xl border border-gray-700 bg-gray-900/60 p-5 space-y-3">
            <h3 className="text-sm font-bold">게스트 계정 생성</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">이름 *</label>
                <input className="input input-bordered input-sm w-full" value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">아이디 *</label>
                <input className="input input-bordered input-sm w-full" placeholder="영문/숫자"
                  value={form.username} onChange={e => setForm({ ...form, username: e.target.value.trim() })} />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">비밀번호 *</label>
                <input type="password" className="input input-bordered input-sm w-full"
                  value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">연락처</label>
                <input className="input input-bordered input-sm w-full"
                  value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs text-gray-400 mb-1">소속 회사</label>
                <input className="input input-bordered input-sm w-full" placeholder="예: 현장 감리단"
                  value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button className="btn btn-ghost btn-sm" onClick={() => setShowForm(false)}>취소</button>
              <button className="btn btn-primary btn-sm" onClick={handleCreate} disabled={creating}>
                {creating ? <span className="loading loading-spinner loading-xs" /> : '생성'}
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="py-10 text-center"><span className="loading loading-spinner loading-sm" /></div>
        ) : guests.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-700 py-14 text-center text-sm text-gray-500">
            등록된 게스트가 없습니다.
          </div>
        ) : (
          <div className="rounded-xl border border-gray-700/50 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-900/60 text-[11px] text-gray-400 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3 text-left">이름</th>
                  <th className="px-4 py-3 text-left">아이디</th>
                  <th className="px-4 py-3 text-left hidden sm:table-cell">소속</th>
                  <th className="px-4 py-3 text-left hidden sm:table-cell">연락처</th>
                  <th className="px-4 py-3 text-left hidden md:table-cell">생성일</th>
                  <th className="px-4 py-3 text-right">관리</th>
                </tr>
              </thead>
              <tbody>
                {guests.map((g: any) => (
                  <tr key={g.id} className="border-t border-gray-700/30 hover:bg-gray-800/20 transition-colors">
                    <td className="px-4 py-3 font-semibold">{g.name}</td>
                    <td className="px-4 py-3 text-gray-400 font-mono text-xs">{g.username || g.email}</td>
                    <td className="px-4 py-3 hidden sm:table-cell text-gray-300">{g.company || '-'}</td>
                    <td className="px-4 py-3 hidden sm:table-cell text-gray-300">{g.phone || '-'}</td>
                    <td className="px-4 py-3 hidden md:table-cell text-gray-500 text-xs">
                      {new Date(g.createdAt).toLocaleDateString('ko-KR')}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => handleDelete(g.id, g.name)}
                        className="inline-flex items-center gap-1 rounded border border-red-500/30 px-2.5 py-1 text-xs text-red-400 hover:bg-red-500/10 transition">
                        <TrashIcon className="h-3.5 w-3.5" />삭제
                      </button>
                    </td>
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
