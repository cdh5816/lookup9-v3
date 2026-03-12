/* eslint-disable i18next/no-literal-string */
import { GetServerSidePropsContext } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useTranslation } from 'next-i18next';
import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import { Button } from 'react-daisyui';
import { PlusIcon, TrashIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface UserData {
  id: string;
  name: string;
  email: string;
  company: string | null;
  department: string | null;
  position: string | null;
  phone: string | null;
  createdAt: string;
  assignedSites?: { id: string; name: string; status: string }[];
  teamMembers: { role: string; team: { name: string } }[];
}

type SiteItem = { id: string; name: string; status: string };

const departments = ['', '경영진', '경영지원부', '영업부', '수주팀', '생산관리팀', '도장팀', '출하팀', '공사팀', '협력사'];
const roles = [
  { value: 'ADMIN_HR', label: 'COMPANY_ADMIN' },
  { value: 'MANAGER', label: 'INTERNAL_MANAGER' },
  { value: 'USER', label: 'INTERNAL_USER' },
  { value: 'PARTNER', label: 'PARTNER' },
  { value: 'GUEST', label: 'GUEST' },
  { value: 'VIEWER', label: 'VIEWER' },
];

const roleLabel = (role: string) => roles.find((r) => r.value === role)?.label || role;

const AdminUsers = () => {
  const { t } = useTranslation('common');
  const [users, setUsers] = useState<UserData[]>([]);
  const [sites, setSites] = useState<SiteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [hasCompanyAdmin, setHasCompanyAdmin] = useState(false);

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    company: '',
    department: '',
    position: '',
    phone: '',
    role: 'USER',
    siteIds: [] as string[],
  });

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/users');
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || '계정 목록을 불러오지 못했습니다.');
      setUsers(json.data || []);
      setSites(json.meta?.sites || []);
      setHasCompanyAdmin(!!json.meta?.hasCompanyAdmin);
    } catch (err: any) {
      setError(err?.message || '계정 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const externalRole = ['PARTNER', 'GUEST', 'VIEWER'].includes(form.role);
  const selectableRoles = roles.filter((role) => !(role.value === 'ADMIN_HR' && hasCompanyAdmin));

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
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || '계정 생성에 실패했습니다.');
      setSuccess('계정이 생성되었습니다.');
      setShowCreate(false);
      setForm({ name: '', email: '', password: '', company: '', department: '', position: '', phone: '', role: 'USER', siteIds: [] });
      fetchUsers();
    } catch (err: any) {
      setError(err?.message || '계정 생성에 실패했습니다.');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (userId: string, userName: string) => {
    if (!confirm(`${userName} 계정을 삭제하시겠습니까?`)) return;
    try {
      const res = await fetch('/api/admin/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || '삭제에 실패했습니다.');
      setSuccess('삭제되었습니다.');
      fetchUsers();
    } catch (err: any) {
      setError(err?.message || '삭제에 실패했습니다.');
    }
  };

  return (
    <>
      <Head><title>{t('admin-users-title')}</title></Head>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">계정관리</h2>
            <p className="mt-1 text-sm text-gray-500">COMPANY_ADMIN은 회사당 1명만 허용됩니다. 외부 계정은 현장 지정이 필수입니다.</p>
          </div>
          <Button color="primary" size="sm" onClick={() => setShowCreate((v) => !v)}>
            {showCreate ? <XMarkIcon className="mr-1 h-4 w-4" /> : <PlusIcon className="mr-1 h-4 w-4" />}계정 생성
          </Button>
        </div>

        {error && <div className="alert alert-error text-sm"><span>{error}</span></div>}
        {success && <div className="alert alert-success text-sm"><span>{success}</span></div>}

        {showCreate && (
          <div className="rounded-2xl border border-gray-800 p-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <input className="input input-bordered w-full" placeholder="이름" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <input className="input input-bordered w-full" placeholder="이메일" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              <input className="input input-bordered w-full" type="password" placeholder="비밀번호" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              <input className="input input-bordered w-full" placeholder="회사명" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
              <select className="select select-bordered w-full" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}>
                {departments.map((dept) => <option key={dept} value={dept}>{dept || '-'}</option>)}
              </select>
              <input className="input input-bordered w-full" placeholder="직책" value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} />
              <input className="input input-bordered w-full" placeholder="연락처" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              <select className="select select-bordered w-full" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value, siteIds: [] })}>
                {selectableRoles.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
              </select>
            </div>

            {externalRole && (
              <div className="mt-5 rounded-xl border border-gray-800 bg-black/20 p-4">
                <h3 className="mb-3 font-semibold">현장 지정</h3>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  {sites.map((site) => (
                    <label key={site.id} className="flex items-center gap-2 rounded-lg border border-gray-800 px-3 py-2 text-sm">
                      <input type="checkbox" className="checkbox checkbox-sm" checked={form.siteIds.includes(site.id)} onChange={() => toggleSite(site.id)} />
                      <span className="truncate">{site.name}</span>
                      <span className="ml-auto text-xs text-gray-500">{site.status}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4 flex justify-end">
              <Button color="primary" loading={creating} onClick={handleCreate}>생성</Button>
            </div>
          </div>
        )}

        <div className="overflow-hidden rounded-2xl border border-gray-800">
          <div className="overflow-x-auto">
            <table className="table w-full">
              <thead>
                <tr>
                  <th>이름</th><th>이메일</th><th>부서</th><th>직책</th><th>권한</th><th>지정 현장</th><th>생성일</th><th></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} className="text-center"><span className="loading loading-spinner loading-sm"></span></td></tr>
                ) : users.length === 0 ? (
                  <tr><td colSpan={8} className="text-center text-gray-500">계정이 없습니다.</td></tr>
                ) : users.map((user) => {
                  const role = user.teamMembers?.[0]?.role || 'USER';
                  return (
                    <tr key={user.id}>
                      <td>{user.name}</td>
                      <td>{user.email}</td>
                      <td>{user.department || '-'}</td>
                      <td>{user.position || '-'}</td>
                      <td>{roleLabel(role)}</td>
                      <td className="max-w-[260px] whitespace-normal break-words text-sm text-gray-400">{user.assignedSites?.length ? user.assignedSites.map((site) => site.name).join(', ') : '-'}</td>
                      <td>{new Date(user.createdAt).toLocaleDateString('ko-KR')}</td>
                      <td className="text-right">
                        <button className="btn btn-ghost btn-xs text-error" onClick={() => handleDelete(user.id, user.name)}>
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
};

export async function getServerSideProps(context: GetServerSidePropsContext) {
  return { props: { ...(await serverSideTranslations(context.locale ?? 'ko', ['common'])) } };
}

export default AdminUsers;
