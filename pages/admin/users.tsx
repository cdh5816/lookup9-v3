/* eslint-disable i18next/no-literal-string */
import { GetServerSidePropsContext } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useTranslation } from 'next-i18next';
import { useState, useEffect, useCallback, type ReactNode } from 'react';
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
  teamMembers: { role: string; team: { name: string } }[];
}

const departments = [
  { value: '', label: '-' },
  { value: '경영진', label: '경영진' },
  { value: '경영지원부', label: '경영지원부' },
  { value: '영업부', label: '영업부' },
  { value: '수주팀', label: '수주팀' },
  { value: '생산관리팀', label: '생산관리팀' },
  { value: '도장팀', label: '도장팀' },
  { value: '출하팀', label: '출하팀' },
  { value: '공사팀', label: '공사팀' },
  { value: '협력사', label: '협력사' },
];

type AdminMeta = {
  companyAdminExists?: boolean;
  canCreateCompanyAdmin?: boolean;
};

type AdminTab = 'users' | 'guests';

const roleOptions = [
  { value: 'ADMIN_HR', label: 'COMPANY_ADMIN' },
  { value: 'MANAGER', label: 'INTERNAL_MANAGER' },
  { value: 'USER', label: 'INTERNAL_USER' },
  { value: 'PARTNER', label: 'PARTNER' },
  { value: 'GUEST', label: 'GUEST' },
  { value: 'VIEWER', label: 'VIEWER' },
];

function roleLabel(role: string) {
  return roleOptions.find((item) => item.value === role)?.label || role;
}

const AdminUsers = () => {
  const { t } = useTranslation('common');
  const [activeTab, setActiveTab] = useState<AdminTab>('users');

  return (
    <>
      <Head>
        <title>{t('admin-users-title')}</title>
      </Head>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold">계정관리</h2>
          <p className="mt-2 text-sm text-gray-500">COMPANY_ADMIN은 회사당 1명만 허용됩니다. 내부/외부 권한은 역할과 부서 기준으로 세분화됩니다.</p>
        </div>
        <div className="border-b border-gray-800">
          <div className="flex gap-1 overflow-x-auto">
            <button onClick={() => setActiveTab('users')} className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 ${activeTab === 'users' ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-400'}`}>내부/협력사</button>
            <button onClick={() => setActiveTab('guests')} className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 ${activeTab === 'guests' ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-400'}`}>외부 열람</button>
          </div>
        </div>
        <UsersPanel filter={activeTab} />
      </div>
    </>
  );
};

const UsersPanel = ({ filter }: { filter: AdminTab }) => {
  const [users, setUsers] = useState<UserData[]>([]);
  const [meta, setMeta] = useState<AdminMeta>({});
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const defaultRole = filter === 'guests' ? 'GUEST' : 'USER';
  const [form, setForm] = useState({ name: '', email: '', password: '', company: '', department: '', position: '', phone: '', role: defaultRole });

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/users');
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || '불러오기 실패');
      const rows = (json.data || []).filter((u: UserData) => {
        const role = u.teamMembers?.[0]?.role || 'USER';
        if (filter === 'guests') return ['GUEST', 'VIEWER'].includes(role);
        return !['GUEST', 'VIEWER'].includes(role);
      });
      setUsers(rows);
      setMeta(json.meta || {});
    } catch (err: any) {
      setError(err?.message || '불러오기 실패');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    setForm((prev) => ({ ...prev, role: defaultRole }));
  }, [defaultRole]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const availableRoles = roleOptions.filter((option) => {
    if (filter === 'guests') return ['GUEST', 'VIEWER'].includes(option.value);
    if (option.value === 'ADMIN_HR') return !!meta.canCreateCompanyAdmin && !meta.companyAdminExists;
    return !['GUEST', 'VIEWER'].includes(option.value);
  });

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
      if (!res.ok) throw new Error(json?.error?.message || '생성 실패');
      setSuccess('계정이 생성되었습니다.');
      setShowCreate(false);
      setForm({ name: '', email: '', password: '', company: '', department: '', position: '', phone: '', role: defaultRole });
      fetchUsers();
    } catch (err: any) {
      setError(err?.message || '생성 실패');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (userId: string, userName: string) => {
    if (!window.confirm(`${userName} 계정을 삭제하시겠습니까?`)) return;
    try {
      const res = await fetch('/api/admin/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || '삭제 실패');
      setSuccess('삭제되었습니다.');
      fetchUsers();
    } catch (err: any) {
      setError(err?.message || '삭제 실패');
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-800 bg-black/20 p-4 text-sm text-gray-400">
        {meta.companyAdminExists ? '현재 회사에는 COMPANY_ADMIN이 이미 존재합니다. 추가 생성은 차단됩니다.' : '현재 COMPANY_ADMIN 자리가 비어 있습니다.'}
      </div>
      <div className="flex justify-end">
        <Button color="primary" size="sm" onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? <XMarkIcon className="mr-1 h-4 w-4" /> : <PlusIcon className="mr-1 h-4 w-4" />}계정 생성
        </Button>
      </div>
      {error ? <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div> : null}
      {success ? <div className="rounded-xl border border-green-500/40 bg-green-500/10 px-4 py-3 text-sm text-green-300">{success}</div> : null}
      {showCreate ? (
        <div className="rounded-2xl border border-gray-800 p-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="이름"><input className="input input-bordered w-full" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="이메일"><input className="input input-bordered w-full" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
            <Field label="비밀번호"><input type="password" className="input input-bordered w-full" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field>
            <Field label="회사명"><input className="input input-bordered w-full" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} /></Field>
            <Field label="부서">
              <select className="select select-bordered w-full" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}>
                {departments.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </Field>
            <Field label="직책"><input className="input input-bordered w-full" value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} /></Field>
            <Field label="연락처"><input className="input input-bordered w-full" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
            <Field label="역할">
              <select className="select select-bordered w-full" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                {availableRoles.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </Field>
          </div>
          <div className="mt-4 flex justify-end">
            <Button color="primary" loading={creating} onClick={handleCreate}>생성</Button>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 xl:hidden">
        {loading ? <div className="py-8 text-center text-gray-500">불러오는 중...</div> : users.map((user) => {
          const role = user.teamMembers?.[0]?.role || 'USER';
          return (
            <div key={user.id} className="rounded-2xl border border-gray-800 bg-black/10 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{user.position ? `${user.position} ` : ''}{user.name}</p>
                  <p className="mt-1 break-all text-xs text-gray-500">{user.email}</p>
                </div>
                <span className="rounded-full border border-gray-700 px-2 py-0.5 text-xs text-gray-300">{roleLabel(role)}</span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-gray-400">
                <span>부서</span><span className="text-right text-gray-200">{user.department || '-'}</span>
                <span>연락처</span><span className="text-right text-gray-200">{user.phone || '-'}</span>
                <span>생성일</span><span className="text-right text-gray-200">{new Date(user.createdAt).toLocaleDateString('ko-KR')}</span>
              </div>
              <div className="mt-4 flex justify-end">
                <button className="inline-flex items-center rounded-lg border border-red-500/30 px-3 py-1.5 text-sm text-red-300" onClick={() => handleDelete(user.id, user.name)}><TrashIcon className="mr-1 h-4 w-4" />삭제</button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="hidden overflow-x-auto xl:block">
        <table className="table w-full">
          <thead>
            <tr><th>이름</th><th>이메일</th><th>부서</th><th>직책</th><th>연락처</th><th>역할</th><th>생성일</th><th>관리</th></tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={8} className="text-center">불러오는 중...</td></tr> : users.map((user) => {
              const role = user.teamMembers?.[0]?.role || 'USER';
              return (
                <tr key={user.id}>
                  <td>{user.name}</td><td>{user.email}</td><td>{user.department || '-'}</td><td>{user.position || '-'}</td><td>{user.phone || '-'}</td><td>{roleLabel(role)}</td><td>{new Date(user.createdAt).toLocaleDateString('ko-KR')}</td>
                  <td><button className="btn btn-ghost btn-xs text-error" onClick={() => handleDelete(user.id, user.name)}><TrashIcon className="h-4 w-4" /></button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <label className="form-control">
    <span className="mb-1 text-sm text-gray-300">{label}</span>
    {children}
  </label>
);

export default AdminUsers;

export async function getServerSideProps(context: GetServerSidePropsContext) {
  return { props: { ...(await serverSideTranslations(context.locale ?? 'ko', ['common'])) } };
}
