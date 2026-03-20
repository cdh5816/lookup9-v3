/* eslint-disable i18next/no-literal-string */
import { GetServerSidePropsContext } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import { Button } from 'react-daisyui';
import { PlusIcon, XMarkIcon, TrashIcon, PhoneIcon } from '@heroicons/react/24/outline';

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

  const handleDelete = async (guestId: string, guestName: string) => {
    if (!confirm(`"${guestName}" 게스트를 삭제하시겠습니까? 모든 현장 배정이 해제됩니다.`)) return;
    try {
      const res = await fetch(`/api/guests/${guestId}`, { method: 'DELETE' });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json?.error?.message || '삭제 실패');
      }
      setSuccess(`"${guestName}" 게스트가 삭제되었습니다.`);
      await load();
    } catch (err: any) {
      setError(err?.message || '삭제에 실패했습니다.');
    }
  };

  return (
    <>
      <Head><title>게스트관리 | LOOKUP9</title></Head>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl p-5" style={{border:'1px solid var(--border-base)',backgroundColor:'var(--bg-card)'}}>
          <div>
            <h1 className="text-xl font-bold" style={{color:'var(--text-primary)'}}>게스트관리</h1>
            <p className="mt-1 text-sm" style={{color:'var(--text-muted)'}}>
              게스트 계정을 생성하고 현장을 배정합니다. 게스트는 배정된 현장만 열람할 수 있습니다.
            </p>
          </div>
          <Button color="primary" size="sm" onClick={() => setShowCreate((v) => !v)}>
            {showCreate ? <XMarkIcon className="mr-1 h-4 w-4" /> : <PlusIcon className="mr-1 h-4 w-4" />}
            {showCreate ? '닫기' : '게스트 생성'}
          </Button>
        </div>

        {error && <div className="rounded-xl px-4 py-3 text-sm" style={{border:'1px solid var(--danger-border)',backgroundColor:'var(--danger-bg)',color:'var(--danger-text)'}}>{error}</div>}
        {success && <div className="rounded-xl px-4 py-3 text-sm" style={{border:'1px solid var(--success-border)',backgroundColor:'var(--success-bg)',color:'var(--success-text)'}}>{success}</div>}

        {showCreate && (
          <div className="rounded-xl p-5" style={{border:'1px solid var(--border-base)',backgroundColor:'var(--bg-card)'}}>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <input className="input input-bordered w-full" placeholder="이름 *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <input className="input input-bordered w-full" placeholder="아이디 (영문/숫자) *" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value.trim() })} />
              <input type="password" className="input input-bordered w-full" placeholder="비밀번호 *" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              <input className="input input-bordered w-full" placeholder="회사명" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
              <input className="input input-bordered w-full" placeholder="직책" value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} />
              <input className="input input-bordered w-full" placeholder="연락처" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              <select className="select select-bordered w-full" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                {creatableRoles.map((role) => <option key={role} value={role}>{role === 'GUEST' ? '게스트 (요청가능)' : '뷰어 (열람전용)'}</option>)}
              </select>
              <div className="rounded-lg px-4 py-3 text-sm" style={{border:'1px solid var(--border-base)',color:'var(--text-muted)'}}>{groupedText}</div>
            </div>

            <div className="mt-4 rounded-xl p-4" style={{border:'1px solid var(--border-base)'}}>
              <p className="mb-3 text-sm font-semibold" style={{color:'var(--text-primary)'}}>현장 다중 지정</p>
              {siteOptions.length === 0 ? (
                <p className="text-sm" style={{color:'var(--text-muted)'}}>지정 가능한 현장이 없습니다.</p>
              ) : (
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {siteOptions.map((site) => (
                    <label key={site.id} className="flex items-start gap-2 rounded-lg px-3 py-3 text-sm cursor-pointer" style={{border:'1px solid var(--border-base)',color:'var(--text-primary)'}}>
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

        <div className="rounded-xl p-4" style={{border:'1px solid var(--border-base)',backgroundColor:'var(--bg-card)'}}>
          {loading ? (
            <div className="py-10 text-center text-sm" style={{color:'var(--text-muted)'}}>불러오는 중...</div>
          ) : items.length === 0 ? (
            <div className="py-10 text-center text-sm" style={{color:'var(--text-muted)'}}>등록된 게스트가 없습니다.</div>
          ) : (
            <div className="space-y-2">
              {items.map((item) => (
                <div key={item.id} className="rounded-xl p-4" style={{border:'1px solid var(--border-base)'}}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold" style={{color:'var(--text-primary)'}}>
                        {item.position ? `${item.position} ` : ''}{item.name}
                      </p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-xs" style={{color:'var(--text-muted)'}}>{item.email}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{backgroundColor:'var(--info-bg)',color:'var(--info-text)',border:'1px solid var(--info-border)'}}>
                          {item.roleLabel || item.role}
                        </span>
                        {item.company && <span className="text-xs" style={{color:'var(--text-muted)'}}>{item.company}</span>}
                        {item.phone && (
                          <a href={`tel:${item.phone}`} className="flex items-center gap-1 text-xs" style={{color:'var(--info-text)'}}>
                            <PhoneIcon className="h-3 w-3" />{item.phone}
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{border:'1px solid var(--border-base)',color:'var(--text-muted)'}}>
                        {item.assignedSites?.length || 0}개 현장
                      </span>
                      <button
                        className="btn btn-ghost btn-xs text-error"
                        onClick={() => handleDelete(item.id, item.name)}
                        title="게스트 삭제"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  {(item.assignedSites || []).length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {item.assignedSites.map((site: any) => (
                        <span key={site.id} className="rounded-full px-2 py-0.5 text-xs" style={{backgroundColor:'var(--info-bg)',color:'var(--info-text)',border:'1px solid var(--info-border)'}}>
                          {site.name}
                        </span>
                      ))}
                    </div>
                  )}
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
