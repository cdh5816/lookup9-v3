/* eslint-disable i18next/no-literal-string */
import { GetServerSidePropsContext } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import { Button } from 'react-daisyui';
import { PlusIcon, TrashIcon, XMarkIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';
import { getRoleDisplayName } from '@/lib/team-helper';

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

const departments = ['-', '경영진', '경영지원부', '영업부', '수주팀', '생산관리팀', '도장팀', '출하팀', '공사팀', '협력사'];

const roleBadgeClass = (role: string) => {
  if (role === 'ADMIN_HR') return 'badge-primary';
  if (role === 'MANAGER') return 'badge-info';
  if (role === 'PARTNER') return 'badge-warning';
  if (role === 'GUEST' || role === 'VIEWER') return 'badge-ghost';
  return 'badge-success';
};

const UsersPage = () => {
  const [users, setUsers] = useState<UserData[]>([]);
  const [meta, setMeta] = useState<any>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    company: '',
    department: '생산관리팀',
    position: '',
    phone: '',
    role: 'USER',
  });

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/admin/users');
    const json = await res.json();
    if (res.ok) {
      setUsers(json.data || []);
      setMeta(json.meta || null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleCreate = async () => {
    setCreating(true);
    setError('');
    setSuccess('');
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json?.error?.message || '계정 생성에 실패했습니다.');
      setCreating(false);
      return;
    }
    setSuccess('계정을 생성했습니다.');
    setCreating(false);
    setShowCreate(false);
    setForm({ name: '', email: '', password: '', company: '', department: '생산관리팀', position: '', phone: '', role: 'USER' });
    fetchUsers();
  };

  const handleDelete = async (userId: string) => {
    if (!window.confirm('정말 삭제하시겠습니까?')) return;
    const res = await fetch('/api/admin/users', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json?.error?.message || '삭제에 실패했습니다.');
      return;
    }
    setSuccess('계정을 삭제했습니다.');
    fetchUsers();
  };

  const roleOptions = (meta?.roleOptions || []).filter((item: any) => !item.disabled || item.value === 'ADMIN_HR');

  return (
    <>
      <Head><title>계정관리 | LOOKUP9</title></Head>
      <div className="space-y-6">
        <div className="rounded-2xl border border-gray-800 bg-black/20 p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-2xl font-bold">계정관리</h1>
              <p className="mt-2 break-words text-sm leading-6 text-gray-400">
                COMPANY_ADMIN은 회사당 1명만 생성됩니다. 내부직원/협력사/외부열람 계정은 회사 관리자와 내부 매니저가 역할에 맞게 생성합니다.
              </p>
            </div>
            <Button color="primary" className="gap-2" onClick={() => setShowCreate((prev) => !prev)}>
              {showCreate ? <XMarkIcon className="h-4 w-4" /> : <PlusIcon className="h-4 w-4" />}
              {showCreate ? '닫기' : '계정 생성'}
            </Button>
          </div>
        </div>

        {meta?.hasCompanyAdmin && (
          <div className="rounded-2xl border border-blue-900/40 bg-blue-950/20 p-4 text-sm text-blue-100">
            <div className="flex items-start gap-3">
              <ShieldCheckIcon className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-semibold">COMPANY_ADMIN 고정 정책 적용 중</p>
                <p className="mt-1 break-words leading-6 text-blue-200">
                  이 회사에는 이미 COMPANY_ADMIN이 존재합니다. 추가 생성은 차단되며, 내부 매니저/직원/협력사/외부계정만 생성할 수 있습니다.
                </p>
              </div>
            </div>
          </div>
        )}

        {error ? <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div> : null}
        {success ? <div className="rounded-xl border border-green-500/40 bg-green-500/10 px-4 py-3 text-sm text-green-300">{success}</div> : null}

        {showCreate && (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="rounded-2xl border border-gray-800 bg-black/20 p-5">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field label="이름 *"><input className="input input-bordered w-full" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
                <Field label="이메일 *"><input className="input input-bordered w-full" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
                <Field label="비밀번호 *"><input type="password" className="input input-bordered w-full" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field>
                <Field label="회사명"><input className="input input-bordered w-full" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} /></Field>
                <Field label="부서">
                  <select className="select select-bordered w-full" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}>
                    {departments.map((dept) => <option key={dept} value={dept === '-' ? '' : dept}>{dept}</option>)}
                  </select>
                </Field>
                <Field label="직책"><input className="input input-bordered w-full" value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} /></Field>
                <Field label="연락처"><input className="input input-bordered w-full" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
                <Field label="권한">
                  <select className="select select-bordered w-full" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                    {roleOptions.map((item: any) => (
                      <option key={item.value} value={item.value} disabled={item.disabled}>
                        {item.label}{item.value === 'ADMIN_HR' && meta?.hasCompanyAdmin ? ' (이미 존재)' : ''}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <div className="mt-5 flex justify-end">
                <Button color="primary" loading={creating} onClick={handleCreate}>계정 생성</Button>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-800 bg-black/20 p-5">
              <h2 className="text-base font-semibold">권한 가이드</h2>
              <div className="mt-4 space-y-3">
                {(meta?.roleOptions || []).map((item: any) => (
                  <div key={item.value} className="rounded-xl border border-gray-800 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{item.label}</span>
                      {item.value === 'ADMIN_HR' && meta?.hasCompanyAdmin ? <span className="badge badge-warning badge-sm">1명 제한</span> : null}
                    </div>
                    <p className="mt-2 break-words text-sm leading-6 text-gray-400">{item.guide}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-gray-800 bg-black/20 p-4">
          <div className="overflow-x-auto">
            <table className="table w-full">
              <thead>
                <tr>
                  <th>이름</th>
                  <th>이메일</th>
                  <th>부서</th>
                  <th>직책</th>
                  <th>권한</th>
                  <th>생성일</th>
                  <th>관리</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="py-8 text-center text-sm text-gray-500">불러오는 중...</td></tr>
                ) : users.length === 0 ? (
                  <tr><td colSpan={7} className="py-8 text-center text-sm text-gray-500">계정이 없습니다.</td></tr>
                ) : users.map((user) => {
                  const role = user.teamMembers?.[0]?.role || 'USER';
                  return (
                    <tr key={user.id}>
                      <td className="whitespace-normal break-words font-medium">{user.name}</td>
                      <td className="whitespace-normal break-words text-sm">{user.email}</td>
                      <td>{user.department || '-'}</td>
                      <td>{user.position || '-'}</td>
                      <td>
                        <span className={`badge badge-sm ${roleBadgeClass(role)}`}>
                          {getRoleDisplayName(role)}
                        </span>
                      </td>
                      <td>{new Date(user.createdAt).toLocaleDateString('ko-KR')}</td>
                      <td>
                        <button className="btn btn-ghost btn-xs text-error" onClick={() => handleDelete(user.id)}>
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

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="form-control">
    <span className="mb-1 text-sm text-gray-300">{label}</span>
    {children}
  </label>
);

export async function getServerSideProps(context: GetServerSidePropsContext) {
  return { props: { ...(await serverSideTranslations(context.locale ?? 'ko', ['common'])) } };
}

export default UsersPage;
