import { GetServerSidePropsContext } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useTranslation } from 'next-i18next';
import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import { Button } from 'react-daisyui';
import { PlusIcon, TrashIcon, XMarkIcon } from '@heroicons/react/24/outline';

// ========= Types =========
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

// ========= Constants =========
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

const roles = [
  { value: 'ADMIN_HR', label: 'COMPANY_ADMIN (회사 최고 관리자)' },
  { value: 'MANAGER', label: 'INTERNAL_MANAGER (팀장급 내부)' },
  { value: 'USER', label: 'INTERNAL_USER (팀원급 내부)' },
  { value: 'PARTNER', label: 'PARTNER (협력사)' },
  { value: 'GUEST', label: 'CLIENT/GUEST (외부 열람)' },
  { value: 'VIEWER', label: 'VIEWER (열람전용)' },
];

type AdminTab = 'users' | 'guests' | 'clients';

// ========= Main Component =========
const AdminUsers = () => {
  const { t } = useTranslation('common');
  const [activeTab, setActiveTab] = useState<AdminTab>('users');

  const adminTabs: { key: AdminTab; label: string }[] = [
    { key: 'users', label: t('admin-tab-users') },
    { key: 'guests', label: t('admin-tab-guests') },
    { key: 'clients', label: t('admin-tab-clients') },
  ];

  return (
    <>
      <Head><title>{t('admin-users-title')}</title></Head>
      <div className="space-y-6">
        <h2 className="text-xl font-bold">{t('admin-users')}</h2>

        {/* 탭 */}
        <div className="border-b border-gray-800">
          <div className="flex gap-1">
            {adminTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {activeTab === 'users' && <UsersPanel filter="internal" />}
        {activeTab === 'guests' && <UsersPanel filter="guest" />}
        {activeTab === 'clients' && <ClientsPanel />}
      </div>
    </>
  );
};

// ========= Users Panel =========
const UsersPanel = ({ filter }: { filter: 'internal' | 'guest' }) => {
  const { t } = useTranslation('common');
  const [users, setUsers] = useState<UserData[]>([]);
  const [meta, setMeta] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const defaultRole = filter === 'guest' ? 'GUEST' : 'USER';
  const [form, setForm] = useState({
    name: '', email: '', password: '', company: '',
    department: '', position: '', phone: '', role: defaultRole,
  });

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/admin/users');
    if (res.ok) {
      const data = await res.json();
      setMeta(data.meta || null);
      const filtered = (data.data || []).filter((u: UserData) => {
        const role = u.teamMembers?.[0]?.role || 'USER';
        if (filter === 'guest') return role === 'GUEST' || role === 'PARTNER';
        return role !== 'GUEST' && role !== 'PARTNER';
      });
      setUsers(filtered);
    }
    setLoading(false);
  }, [filter]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleCreate = async () => {
    setCreating(true); setError(''); setSuccess('');
    const teamsRes = await fetch('/api/teams');
    const teamsData = await teamsRes.json();
    const teamId = teamsData.data?.[0]?.id || null;
    const res = await fetch('/api/admin/users', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, teamId }),
    });
    if (res.ok) {
      setSuccess(t('admin-user-created'));
      setForm({ name: '', email: '', password: '', company: '', department: '', position: '', phone: '', role: defaultRole });
      setShowCreate(false); fetchUsers();
    } else { const data = await res.json(); setError(data.error?.message || t('unknown-error')); }
    setCreating(false);
  };

  const handleDelete = async (userId: string, userName: string) => {
    if (!confirm(`${userName} ${t('admin-delete-confirm')}`)) return;
    const res = await fetch('/api/admin/users', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    if (res.ok) { setSuccess(t('admin-user-deleted')); fetchUsers(); }
    else { const data = await res.json(); setError(data.error?.message || t('unknown-error')); }
  };

  // 게스트 탭에서는 GUEST/PARTNER만 선택 가능
  const availableRoles = filter === 'guest'
    ? roles.filter((r) => ['GUEST', 'PARTNER', 'VIEWER'].includes(r.value))
    : roles.filter((r) => {
        if (['GUEST', 'PARTNER', 'VIEWER'].includes(r.value)) return false;
        if (r.value === 'ADMIN_HR' && meta?.hasCompanyAdmin) return false;
        return true;
      });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <Button color="primary" size="sm" onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? <XMarkIcon className="w-4 h-4 mr-1" /> : <PlusIcon className="w-4 h-4 mr-1" />}
          {showCreate ? t('cancel') : t('admin-create-user')}
        </Button>
      </div>
      {error && <div className="alert alert-error text-sm"><span>{error}</span></div>}
      {success && <div className="alert alert-success text-sm"><span>{success}</span></div>}
      {showCreate && (
        <div className="border border-gray-700 rounded-lg p-6 space-y-4">
          <h3 className="text-lg font-semibold">{t('admin-create-user')}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label"><span className="label-text">{t('name')} *</span></label>
              <input type="text" className="input input-bordered w-full" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="label"><span className="label-text">{t('email')} *</span></label>
              <input type="email" className="input input-bordered w-full" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <label className="label"><span className="label-text">{t('password')} *</span></label>
              <input type="password" className="input input-bordered w-full" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
            <div>
              <label className="label"><span className="label-text">{t('admin-company')}</span></label>
              <input type="text" className="input input-bordered w-full" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
            </div>
            <div>
              <label className="label"><span className="label-text">{t('admin-department')}</span></label>
              <select className="select select-bordered w-full" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}>
                {departments.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label"><span className="label-text">{t('admin-position')}</span></label>
              <input type="text" className="input input-bordered w-full" value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} />
            </div>
            <div>
              <label className="label"><span className="label-text">{t('admin-phone')}</span></label>
              <input type="text" className="input input-bordered w-full" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <label className="label"><span className="label-text">{t('role')}</span></label>
              <select className="select select-bordered w-full" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                {availableRoles.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
          </div>
          <div className="flex justify-end">
            <Button color="primary" loading={creating} onClick={handleCreate}>{t('create-account')}</Button>
          </div>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="table w-full">
          <thead>
            <tr>
              <th>{t('name')}</th><th>{t('email')}</th><th>{t('admin-company')}</th>
              <th>{t('admin-department')}</th><th>{t('admin-position')}</th><th>{t('admin-phone')}</th>
              <th>{t('role')}</th><th>{t('created-at')}</th><th>{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="text-center"><span className="loading loading-spinner loading-sm"></span></td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={9} className="text-center text-gray-500">{t('admin-no-users')}</td></tr>
            ) : (
              users.map((user) => (
                <tr key={user.id}>
                  <td className="font-medium">{user.position ? `${user.position} ${user.name}` : user.name}</td>
                  <td>{user.email}</td>
                  <td>{user.company || '-'}</td><td>{user.department || '-'}</td>
                  <td>{user.position || '-'}</td><td>{user.phone || '-'}</td>
                  <td><span className="badge badge-sm">{user.teamMembers?.[0]?.role || '-'}</span></td>
                  <td>{new Date(user.createdAt).toLocaleDateString('ko-KR')}</td>
                  <td><button className="btn btn-ghost btn-xs text-error" onClick={() => handleDelete(user.id, user.name)}><TrashIcon className="w-4 h-4" /></button></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ========= Clients Panel =========
const ClientsPanel = () => {
  const { t } = useTranslation('common');
  const [clients, setClients] = useState<ClientData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState({ name: '', contact: '', phone: '', email: '', address: '', type: '발주처', notes: '' });

  const fetchClients = useCallback(async () => {
    setLoading(true);
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
    <div className="space-y-4">
      <div className="flex items-center justify-end">
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
  );
};

export async function getServerSideProps({ locale }: GetServerSidePropsContext) {
  return { props: { ...(locale ? await serverSideTranslations(locale, ['common']) : {}) } };
}

export default AdminUsers;
