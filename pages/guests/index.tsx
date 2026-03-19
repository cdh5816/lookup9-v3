/* eslint-disable i18next/no-literal-string */
import { GetServerSidePropsContext } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import { Button } from 'react-daisyui';
import { PlusIcon, XMarkIcon } from '@heroicons/react/24/outline';

const GuestsPage = () => {
  const [items, setItems] = useState<any[]>([]);
  const [siteOptions, setSiteOptions] = useState<any[]>([]);
  const [creatableRoles, setCreatableRoles] = useState<string[]>(['GUEST', 'VIEWER']);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState({
    name: '',
    username: '',
    password: '',
    position: '',
    phone: '',
    company: '',
    role: 'GUEST',
    siteIds: [] as string[],
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/guests');
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || '게스트 목록을 불러오지 못했습니다.');
      setItems(json.data || []);
      setSiteOptions(json.meta?.siteOptions || []);
      setCreatableRoles(json.meta?.creatableRoles || ['GUEST', 'VIEWER']);
      setForm((prev) => ({ ...prev, role: (json.meta?.creatableRoles || ['GUEST'])[0] || 'GUEST' }));
    } catch (err: any) {
      setError(err?.message || '게스트 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const groupedText = useMemo(() => {
    if (form.siteIds.length === 0) return '선택된 현장 없음';
    return `${form.siteIds.length}개 현장 선택됨`;
  }, [form.siteIds]);

  const toggleSite = (siteId: string) => {
    setForm((prev) => ({
      ...prev,
      siteIds: prev.siteIds.includes(siteId)
        ? prev.siteIds.filter((id) => id !== siteId)
        : [...prev.siteIds, siteId],
    }));
  };

  const handleCreate = async () => {
    setCreating(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch('/api/guests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || '게스트 생성에 실패했습니다.');
      setSuccess('게스트 계정이 생성되었습니다.');
      setShowCreate(false);
      setForm({ name: '', username: '', password: '', position: '', phone: '', company: '', role: creatableRoles[0] || 'GUEST', siteIds: [] });
      await load();
    } catch (err: any) {
      setError(err?.message || '게스트 생성에 실패했습니다.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <Head><title>게스트관리 | LOOKUP9</title></Head>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-800 bg-black/20 p-5">
          <div>
            <h1 className="text-2xl font-bold">게스트관리</h1>
            <p className="mt-2 text-sm text-gray-400">팀장, 팀원, 협력사도 게스트를 만들고 여러 현장에 동시에 배정할 수 있습니다.</p>
          </div>
          <Button color="primary" size="sm" onClick={() => setShowCreate((v) => !v)}>
            {showCreate ? <XMarkIcon className="mr-1 h-4 w-4" /> : <PlusIcon className="mr-1 h-4 w-4" />}
            {showCreate ? '닫기' : '게스트 생성'}
          </Button>
        </div>

        {error ? <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div> : null}
        {success ? <div className="rounded-xl border border-green-500/40 bg-green-500/10 px-4 py-3 text-sm text-green-300">{success}</div> : null}

        {showCreate && (
          <div className="rounded-2xl border border-gray-800 bg-black/20 p-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <input className="input input-bordered w-full" placeholder="이름" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <input className="input input-bordered w-full" placeholder="아이디 (영문/숫자)" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value.trim() })} />
              <input type="password" className="input input-bordered w-full" placeholder="비밀번호" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              <input className="input input-bordered w-full" placeholder="회사명" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
              <input className="input input-bordered w-full" placeholder="직책" value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} />
              <input className="input input-bordered w-full" placeholder="연락처" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              <select className="select select-bordered w-full" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                {creatableRoles.map((role) => <option key={role} value={role}>{role}</option>)}
              </select>
              <div className="rounded-xl border border-gray-800 px-4 py-3 text-sm text-gray-400">{groupedText}</div>
            </div>

            <div className="mt-4 rounded-2xl border border-gray-800 p-4">
              <p className="mb-3 text-sm font-semibold">현장 다중 지정</p>
              {siteOptions.length === 0 ? (
                <p className="text-sm text-gray-500">지정 가능한 현장이 없습니다.</p>
              ) : (
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {siteOptions.map((site) => (
                    <label key={site.id} className="flex items-start gap-2 rounded-xl border border-gray-800 px-3 py-3 text-sm">
                      <input type="checkbox" className="checkbox checkbox-sm mt-0.5" checked={form.siteIds.includes(site.id)} onChange={() => toggleSite(site.id)} />
                      <span className="break-words leading-6">{site.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-4 flex justify-end">
              <Button color="primary" loading={creating} onClick={handleCreate}>생성</Button>
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-gray-800 bg-black/20 p-4">
          {loading ? (
            <div className="py-10 text-center text-sm text-gray-500">불러오는 중...</div>
          ) : items.length === 0 ? (
            <div className="py-10 text-center text-sm text-gray-500">등록된 게스트/협력사가 없습니다.</div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <div key={item.id} className="rounded-2xl border border-gray-800 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold">{item.position ? `${item.position} ` : ''}{item.name}</p>
                      <p className="mt-1 text-xs text-gray-500">{item.email} · {item.roleLabel}</p>
                    </div>
                    <span className="rounded-full border border-gray-700 px-2 py-0.5 text-xs text-gray-300">{item.assignedSites?.length || 0}개 현장</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(item.assignedSites || []).map((site: any) => (
                      <span key={site.id} className="rounded-full border border-blue-800/50 bg-blue-900/20 px-2 py-1 text-xs text-blue-300">{site.name}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export async function getServerSideProps({ locale }: GetServerSidePropsContext) {
  return { props: { ...(locale ? await serverSideTranslations(locale, ['common']) : {}) } };
}

export default GuestsPage;
