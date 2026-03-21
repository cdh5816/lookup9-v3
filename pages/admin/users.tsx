/* eslint-disable i18next/no-literal-string */
import { GetServerSidePropsContext } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import Head from 'next/head';
import {
 PlusIcon, TrashIcon, XMarkIcon, BuildingOffice2Icon,
 UserPlusIcon, ChevronDownIcon, ChevronRightIcon,
 PencilIcon, CheckIcon, LinkIcon,
} from '@heroicons/react/24/outline';
import useSWR from 'swr';
import fetcher from '@/lib/fetcher';

// ── 타입 ──────────────────────────────────────────────
interface SiteLite { id: string; name: string; status?: string; }
interface UserData {
 id: string; name: string; username?: string; email: string;
 company: string | null; department: string | null;
 position: string | null; phone: string | null; createdAt: string;
 teamMembers: { role: string; team: { name: string } }[];
 siteAssignments?: { siteId: string; site: SiteLite }[];
 partnerCompany?: { id: string; name: string } | null;
}

const DEPTS = ['경영진', '경영지원부', '영업부', '수주팀', '생산관리팀', '도장팀', '출하팀', '공사팀'];
const STATUS_LABEL: Record<string, string> = {
 CONTRACT_ACTIVE: '진행중', COMPLETED: '준공완료', WARRANTY: '하자기간',
 SALES_PIPELINE: '영업중', SALES_CONFIRMED: '수주확정',
};

const ROLE_BADGE: Record<string, string> = {
 ADMIN_HR: 'bg-orange-900/40 text-orange-300 border-orange-800/40',
 MANAGER: 'bg-blue-900/30 text-blue-300 border-blue-800/30',
 USER: 'bg-gray-800/60 text-gray-300 /40',
 PARTNER: 'bg-purple-900/30 text-purple-300 border-purple-800/30',
 GUEST: 'bg-gray-800/40 text-gray-400 /30',
 VIEWER: 'bg-gray-800/40 text-gray-500 /30',
};
const ROLE_LABEL: Record<string, string> = {
 ADMIN_HR: 'COMPANY_ADMIN', MANAGER: 'MANAGER', USER: 'USER',
 PARTNER: 'PARTNER', GUEST: 'GUEST', VIEWER: 'VIEWER',
};

// ══════════════════════════════════════════════════════
// 메인 컴포넌트
// ══════════════════════════════════════════════════════
const AdminUsers = () => {
 const { data: profileData, isLoading: profileLoading } = useSWR("/api/my/profile", fetcher);
 const myRole = profileData?.data?.role || profileData?.data?.teamMembers?.[0]?.role || "";
 const isAdminHR = ["SUPER_ADMIN", "OWNER", "ADMIN_HR", "ADMIN"].includes(myRole);
 const canAccessPartner = ["SUPER_ADMIN", "OWNER", "ADMIN_HR", "ADMIN", "MANAGER"].includes(myRole);
 const [tab, setTab] = useState<"staff" | "partner">("staff");
 useEffect(() => {
 if (!profileLoading && myRole) setTab(isAdminHR ? "staff" : "partner");
 }, [myRole, isAdminHR, profileLoading]);

 return (
 <>
 <Head><title>계정 관리 | LOOKUP9</title></Head>
 <div className="space-y-4">
 <div>
 <h2 className="text-xl font-bold">계정 관리</h2>
 <p className="text-sm text-gray-400 mt-0.5">
 직원 계정과 협력업체를 통합 관리합니다.
 </p>
 </div>

 {profileLoading ? (
 <div className="py-10 text-center"><span className="loading loading-spinner loading-sm text-gray-500" /></div>
 ) : !isAdminHR && !canAccessPartner ? (
 <div className="py-10 text-center text-sm text-gray-500">접근 권한이 없습니다.</div>
 ) : (
 <>
 <div className="flex gap-1 border-b /50">
 {isAdminHR && (
 <TabBtn active={tab === 'staff'} onClick={() => setTab('staff')}>직원</TabBtn>
 )}
 {canAccessPartner && (
 <TabBtn active={tab === 'partner'} onClick={() => setTab('partner')}>협력업체</TabBtn>
 )}
 </div>
 {tab === 'staff' && isAdminHR && <StaffPanel myRole={myRole} isAdminHR={isAdminHR} />}
 {tab === 'partner' && canAccessPartner && <PartnerPanel />}
 </>
 )}
 </div>
 </>
 );
};

const TabBtn = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) => (
 <button
 onClick={onClick}
 className={`px-5 py-2.5 text-sm font-semibold border-b-2 transition-colors -mb-px ${
 active ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-200'
 }`}
 >
 {children}
 </button>
);

// ══════════════════════════════════════════════════════
// 직원 패널
// ══════════════════════════════════════════════════════
const StaffPanel = ({ myRole, isAdminHR }: { myRole: string; isAdminHR: boolean }) => {
 const [users, setUsers] = useState<UserData[]>([]);
 const [sites, setSites] = useState<SiteLite[]>([]);
 const [loading, setLoading] = useState(true);
 const [filter, setFilter] = useState<'internal' | 'partner'>('internal');
 const [showCreate, setShowCreate] = useState(false);
 const [creating, setCreating] = useState(false);
 const [error, setError] = useState('');
 const [success, setSuccess] = useState('');
 const [canCreateAdmin, setCanCreateAdmin] = useState(false);

 // 협력사별 필터 (partner 뷰 전용)
 const [partnerCompanyFilter, setPartnerCompanyFilter] = useState<string>('all');

 const { data: profileData } = useSWR('/api/my/profile', fetcher);
 const currentUserId = profileData?.data?.id;

 const canCreateInternal = isAdminHR;
 const canCreateExternal = ['SUPER_ADMIN','OWNER','ADMIN_HR','ADMIN','MANAGER'].includes(myRole);

 const emptyForm = () => ({
 name: '', username: '', email: '', password: '',
 company: '', department: '', position: '', phone: '',
 role: filter === 'internal' ? 'USER' : 'PARTNER',
 assignedSiteIds: [] as string[],
 });
 const [form, setForm] = useState(emptyForm());

 const fetchData = useCallback(async () => {
 setLoading(true);
 const [uRes, sRes] = await Promise.all([fetch('/api/admin/users'), fetch('/api/sites')]);
 const uJson = await uRes.json();
 const sJson = await sRes.json();
 setUsers(uJson.data || []);
 setSites(sJson.ok !== false ? sJson.data || [] : []);
 if (uJson.meta?.canCreateAdmin) setCanCreateAdmin(true);
 setLoading(false);
 }, []);

 useEffect(() => { fetchData(); }, [fetchData]);

 // 파트너 유저들 + 회사 목록 추출
 const partnerUsers = useMemo(() => users.filter(u => {
 const role = u.teamMembers?.[0]?.role || 'USER';
 return role === 'PARTNER';
 }), [users]);

 const partnerCompanies = useMemo(() => {
 const seen = new Set<string>();
 const list: { id: string; name: string }[] = [];
 partnerUsers.forEach(u => {
 if (u.partnerCompany && !seen.has(u.partnerCompany.id)) {
 seen.add(u.partnerCompany.id);
 list.push(u.partnerCompany);
 }
 });
 return list;
 }, [partnerUsers]);

 const visibleUsers = useMemo(() => users.filter(u => {
 const role = u.teamMembers?.[0]?.role || 'USER';
 if (filter === 'internal') return !['PARTNER', 'GUEST', 'VIEWER'].includes(role);
 if (filter === 'partner') {
 if (role !== 'PARTNER') return false;
 if (partnerCompanyFilter !== 'all') {
 if (partnerCompanyFilter === 'unlinked') return !u.partnerCompany;
 return u.partnerCompany?.id === partnerCompanyFilter;
 }
 return true;
 }
 return true;
 }), [users, filter, partnerCompanyFilter]);

 const availableRoles = useMemo(() => {
 if (filter === 'internal') {
 const r = [
 { value: 'USER', label: 'USER - 내부 직원' },
 { value: 'MANAGER', label: 'MANAGER - 관리자' },
 ];
 if (canCreateAdmin) r.unshift({ value: 'ADMIN_HR', label: 'COMPANY_ADMIN - 회사 관리자' });
 return r;
 }
 return [{ value: 'PARTNER', label: 'PARTNER - 협력사 직원' }];
 }, [filter, canCreateAdmin]);

 const handleCreate = async () => {
 if (!form.name || !form.username || !form.password) {
 setError('이름, 아이디, 비밀번호는 필수입니다.'); return;
 }
 setCreating(true); setError(''); setSuccess('');
 const res = await fetch('/api/admin/users', {
 method: 'POST', headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify(form),
 });
 const json = await res.json();
 if (!res.ok) { setError(json?.error?.message || '생성 실패'); }
 else { setSuccess('계정이 생성되었습니다.'); setShowCreate(false); setForm(emptyForm()); fetchData(); }
 setCreating(false);
 };

 const [deletePasswordModal, setDeletePasswordModal] = useState<{user: any} | null>(null);
 const [deletePassword, setDeletePassword] = useState('');
 const [deletingAdmin, setDeletingAdmin] = useState(false);

 const handleDelete = async (user: UserData) => {
 if (user.id === currentUserId) { alert('자기 자신은 삭제할 수 없습니다.'); return; }

 // COMPANY_ADMIN 삭제: 비밀번호 확인 모달
 if (user.role === 'ADMIN_HR' || user.role === 'ADMIN') {
 setDeletePasswordModal({ user });
 setDeletePassword('');
 return;
 }

 if (!confirm(`"${user.name}" 계정을 삭제하시겠습니까?`)) return;
 const res = await fetch('/api/admin/users', {
 method: 'DELETE', headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ userId: user.id }),
 });
 const json = await res.json();
 if (!res.ok) setError(json?.error?.message || '삭제 실패');
 else { setSuccess('삭제되었습니다.'); fetchData(); }
 };

 const handleDeleteAdmin = async () => {
 if (!deletePasswordModal) return;
 if (!deletePassword.trim()) { setError('비밀번호를 입력하세요.'); return; }
 setDeletingAdmin(true);
 setError('');
 const res = await fetch('/api/admin/users', {
 method: 'DELETE', headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ userId: deletePasswordModal.user.id, confirmPassword: deletePassword }),
 });
 const json = await res.json();
 if (!res.ok) { setError(json?.error?.message || '삭제 실패'); }
 else { setSuccess(`"${deletePasswordModal.user.name}" 회사 및 하위 데이터가 삭제되었습니다.`); setDeletePasswordModal(null); fetchData(); }
 setDeletingAdmin(false);
 };

 const canShowCreate = filter === 'internal' ? canCreateInternal : canCreateExternal;

 return (
 <div className="space-y-4">
 {error && <Alert type="error" msg={error} onClose={() => setError('')} />}
 {success && <Alert type="success" msg={success} onClose={() => setSuccess('')} />}

 {/* 필터 + 생성 버튼 */}
 <div className="flex flex-wrap items-center justify-between gap-3">
 <div className="flex gap-1.5 flex-wrap">
 {(['internal', 'partner'] as const).map(f => (
 <button key={f} onClick={() => { setFilter(f); setShowCreate(false); setPartnerCompanyFilter('all'); }}
 className={`rounded-lg border px-3.5 py-1.5 text-xs font-semibold transition ${
 filter === f
 ? 'border-blue-600 bg-blue-950/40 text-blue-300'
 : ' text-gray-400 hover:border-gray-600'
 }`}>
 {f === 'internal' ? '내부 직원' : '협력사 직원'}
 <span className="ml-1.5 text-[10px] opacity-60">
 {users.filter(u => {
 const r = u.teamMembers?.[0]?.role || 'USER';
 if (f === 'internal') return !['PARTNER','GUEST','VIEWER'].includes(r);
 return r === 'PARTNER';
 }).length}
 </span>
 </button>
 ))}

 {/* 협력사별 필터 (partner 뷰에서만) */}
 {filter === 'partner' && (
 <select
 className="select select-bordered select-xs text-xs text-gray-300"
 value={partnerCompanyFilter}
 onChange={e => setPartnerCompanyFilter(e.target.value)}
 >
 <option value="all">전체 협력사</option>
 <option value="unlinked">미소속 계정</option>
 {partnerCompanies.map(co => (
 <option key={co.id} value={co.id}>{co.name}</option>
 ))}
 </select>
 )}
 </div>
 {canShowCreate && (
 <button
 className="btn btn-primary btn-sm gap-1.5"
 onClick={() => { setForm(emptyForm()); setShowCreate(true); setError(''); }}
 >
 <PlusIcon className="h-4 w-4" />
 {filter === 'internal' ? '직원 추가' : '협력사 계정 추가'}
 </button>
 )}
 </div>

 {/* 유저 목록 */}
 <div className="rounded-xl border /50 overflow-hidden">
 {loading ? (
 <div className="py-10 text-center text-sm text-gray-500"><span className="loading loading-spinner loading-sm" /></div>
 ) : visibleUsers.length === 0 ? (
 <div className="py-10 text-center text-sm text-gray-500">등록된 계정이 없습니다.</div>
 ) : (
 <table className="w-full text-sm">
 <thead className=" text-[11px] text-gray-400 uppercase tracking-wider">
 <tr>
 <th className="px-4 py-3 text-left">이름</th>
 <th className="px-4 py-3 text-left">아이디</th>
 {filter === 'internal' ? (
 <th className="px-4 py-3 text-left hidden sm:table-cell">부서 · 직책</th>
 ) : (
 <th className="px-4 py-3 text-left hidden sm:table-cell">소속 협력사</th>
 )}
 <th className="px-4 py-3 text-left">권한</th>
 <th className="px-4 py-3 text-left hidden md:table-cell">배정 현장</th>
 <th className="px-4 py-3 text-right">관리</th>
 </tr>
 </thead>
 <tbody>
 {visibleUsers.map(user => {
 const role = user.role || user.teamMembers?.[0]?.role || 'USER';
 const isSelf = user.id === currentUserId;
 const isProtected = ['ADMIN_HR','ADMIN','SUPER_ADMIN','OWNER'].includes(role);
 const isOtherTeamAdmin = (user as any).isOtherTeam;
 const canDeleteThis = isAdminHR && !isSelf && (!isProtected || myRole === 'SUPER_ADMIN');

 return (
 <tr key={user.id} className="border-t /30 /20 transition-colors">
 <td className="px-4 py-3 font-semibold">
 {user.name}
 {isSelf && <span className="ml-1.5 text-[10px] bg-blue-900/40 text-blue-300 px-1.5 py-0.5 rounded">나</span>}
 {isOtherTeamAdmin && user.teamName && (
 <div className="text-[10px] font-normal mt-0.5" style={{color:'var(--warning-text)'}}>
 {user.teamName}
 </div>
 )}
 {user.phone && <div className="text-xs font-normal" style={{color:'var(--text-muted)'}}>{user.phone}</div>}
 </td>
 <td className="px-4 py-3 text-gray-400 font-mono text-xs">{user.username || user.email}</td>
 {filter === 'internal' ? (
 <td className="px-4 py-3 hidden sm:table-cell text-gray-300">
 {user.department || '-'}
 {user.position && <span className="text-gray-500 ml-1">· {user.position}</span>}
 </td>
 ) : (
 <td className="px-4 py-3 hidden sm:table-cell">
 {user.partnerCompany ? (
 <span className="text-xs text-purple-300 bg-purple-900/20 border border-purple-800/40 rounded px-2 py-0.5">
 {user.partnerCompany.name}
 </span>
 ) : (
 <span className="text-xs text-gray-600 italic">미소속</span>
 )}
 </td>
 )}
 <td className="px-4 py-3">
 <span className={`inline-block rounded border px-2 py-0.5 text-[11px] font-bold ${ROLE_BADGE[role] || ROLE_BADGE.USER}`}>
 {ROLE_LABEL[role] || role}
 </span>
 </td>
 <td className="px-4 py-3 hidden md:table-cell">
 {user.siteAssignments?.length ? (
 <div className="flex flex-wrap gap-1 max-w-xs">
 {user.siteAssignments.slice(0, 3).map(a => (
 <span key={a.siteId} className="rounded-full border px-2 py-0.5 text-[10px] text-gray-300">
 {a.site?.name || a.siteId}
 </span>
 ))}
 {user.siteAssignments.length > 3 && (
 <span className="text-[10px] text-gray-500">+{user.siteAssignments.length - 3}</span>
 )}
 </div>
 ) : <span className="text-gray-600 text-xs">-</span>}
 </td>
 <td className="px-4 py-3 text-right">
 {canDeleteThis ? (
 <button onClick={() => handleDelete(user)}
 className="inline-flex items-center gap-1 rounded border border-red-500/30 px-2.5 py-1 text-xs text-red-400 hover:bg-red-500/10 transition">
 <TrashIcon className="h-3.5 w-3.5" />삭제
 </button>
 ) : (
 <span className="text-[10px] text-gray-700">{isSelf ? '(본인)' : isProtected ? '(보호됨)' : ''}</span>
 )}
 </td>
 </tr>
 );
 })}
 </tbody>
 </table>
 )}
 </div>

 {/* 계정 생성 모달 */}
 {showCreate && (
 <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{background:"rgba(0,0,0,0.6)"}}>
 <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl p-5" style={{backgroundColor:"var(--bg-elevated)",border:"1px solid var(--border-base)",boxShadow:"var(--shadow-elevated)"}}>
 <div className="flex items-center justify-between mb-4">
 <h3 className="text-lg font-bold">
 {filter === 'internal' ? '직원 계정 생성' : '협력사 계정 생성'}
 </h3>
 <button onClick={() => setShowCreate(false)} className="p-1.5 rounded-lg text-gray-400 ">
 <XMarkIcon className="h-5 w-5" />
 </button>
 </div>
 {error && <Alert type="error" msg={error} onClose={() => setError('')} />}

 {filter === 'partner' && (
 <div className="mb-4 rounded-lg border border-blue-800/40 bg-blue-950/20 px-3 py-2.5">
 <p className="text-xs text-blue-300">
 계정 생성 후 <strong>협력업체 탭</strong>에서 해당 업체에 등록하거나,
 아래 <strong>소속 협력사</strong>를 선택하면 바로 연결됩니다.
 </p>
 </div>
 )}

 <div className="grid grid-cols-2 gap-3">
 <Field label="이름 *" className="col-span-2">
 <input className="input input-bordered w-full" value={form.name}
 onChange={e => setForm({ ...form, name: e.target.value })} />
 </Field>
 <Field label="아이디 *">
 <input className="input input-bordered w-full" placeholder="영문/숫자"
 value={form.username} onChange={e => setForm({ ...form, username: e.target.value.trim() })} />
 </Field>
 <Field label="비밀번호 *">
 <input type="password" className="input input-bordered w-full"
 value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
 </Field>

 <Field label="권한">
 <select className="select select-bordered w-full" value={form.role}
 onChange={e => setForm({ ...form, role: e.target.value })}>
 {availableRoles.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
 </select>
 </Field>
 <Field label="직책">
 <input className="input input-bordered w-full" placeholder="예: 과장, 소장"
 value={form.position} onChange={e => setForm({ ...form, position: e.target.value })} />
 </Field>

 {/* COMPANY_ADMIN 선택 시 회사명 필수 */}
 {(form.role === 'ADMIN_HR' || form.role === 'ADMIN') && (
 <Field label="회사명 *" className="col-span-2">
 <input className="input input-bordered w-full" placeholder="회사명 (새 팀이 자동 생성됩니다)"
 value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} />
 <p className="text-[10px] mt-1" style={{color:'var(--warning-text)'}}>
 COMPANY_ADMIN 생성 시 별도의 회사(팀)가 자동으로 만들어집니다.
 </p>
 </Field>
 )}

 {filter === 'internal' && (
 <Field label="부서" className="col-span-2">
 <select className="select select-bordered w-full" value={form.department}
 onChange={e => setForm({ ...form, department: e.target.value })}>
 <option value="">-</option>
 {DEPTS.map(d => <option key={d} value={d}>{d}</option>)}
 </select>
 </Field>
 )}

 {filter === 'partner' && (
 <Field label="소속 협력사 (선택)" className="col-span-2">
 <CompanySearchInput
 value={form.company}
 onChange={v => setForm({ ...form, company: v })}
 />
 </Field>
 )}

 <Field label="연락처" className="col-span-2">
 <input className="input input-bordered w-full" value={form.phone}
 onChange={e => setForm({ ...form, phone: e.target.value })} />
 </Field>

 <Field label="이메일 (선택)" className="col-span-2">
 <input className="input input-bordered w-full" placeholder="미입력 시 자동 생성"
 value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
 </Field>
 </div>

 <div className="mt-5 flex justify-end gap-2">
 <button className="btn btn-ghost btn-sm" onClick={() => setShowCreate(false)}>취소</button>
 <button className="btn btn-primary btn-sm" onClick={handleCreate} disabled={creating}>
 {creating ? <span className="loading loading-spinner loading-xs" /> : '생성'}
 </button>
 </div>
 </div>
 </div>
 )}
 </div>

 {/* COMPANY_ADMIN 삭제 비밀번호 확인 모달 */}
 {deletePasswordModal && (
 <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{background:'rgba(0,0,0,0.6)'}}>
 <div className="w-full max-w-sm rounded-xl p-5" style={{backgroundColor:'var(--bg-elevated)',border:'1px solid var(--border-base)',boxShadow:'var(--shadow-elevated)'}}>
 <h3 className="text-base font-bold mb-1" style={{color:'var(--danger-text)'}}>회사 삭제 확인</h3>
 <p className="text-xs mb-4" style={{color:'var(--text-muted)'}}>
 &quot;{deletePasswordModal.user.company || deletePasswordModal.user.name}&quot; 회사와 소속 직원, 협력사, 현장 데이터가 모두 삭제됩니다. 이 작업은 되돌릴 수 없습니다.
 </p>
 <div className="mb-4">
 <label className="block text-xs mb-1.5 font-medium" style={{color:'var(--text-secondary)'}}>시스템 관리자 비밀번호</label>
 <input
 type="password"
 className="input input-bordered w-full"
 placeholder="비밀번호를 입력하세요"
 value={deletePassword}
 onChange={e => setDeletePassword(e.target.value)}
 onKeyDown={e => e.key === 'Enter' && handleDeleteAdmin()}
 autoFocus
 />
 </div>
 {error && <p className="text-xs mb-3" style={{color:'var(--danger-text)'}}>{error}</p>}
 <div className="flex justify-end gap-2">
 <button className="btn btn-ghost btn-sm" onClick={() => { setDeletePasswordModal(null); setError(''); }}>취소</button>
 <button className={`btn btn-error btn-sm ${deletingAdmin ? 'loading' : ''}`} disabled={deletingAdmin} onClick={handleDeleteAdmin}>
 삭제 실행
 </button>
 </div>
 </div>
 </div>
 )}
 </div>
 );
};
// ══════════════════════════════════════════════════════
const PartnerPanel = () => {
 const [companies, setCompanies] = useState<any[]>([]);
 const [sites, setSites] = useState<any[]>([]);
 const [loading, setLoading] = useState(true);
 const [expandedId, setExpandedId] = useState<string | null>(null);
 const [showSiteAssign, setShowSiteAssign] = useState<string | null>(null);
 const [error, setError] = useState('');
 const [success, setSuccess] = useState('');

 // 업체 생성
 const [showCreate, setShowCreate] = useState(false);
 const [form, setForm] = useState({ name: '', bizNo: '', contact: '', phone: '', email: '', address: '', notes: '' });
 const [creating, setCreating] = useState(false);

 // 업체 수정
 const [editId, setEditId] = useState<string | null>(null);
 const [editForm, setEditForm] = useState<any>({});
 const [saving, setSaving] = useState(false);

 // 직접 계정 추가 (신규 생성)
 const [showMember, setShowMember] = useState<string | null>(null);
 const [mForm, setMForm] = useState({ name: '', username: '', password: '', position: '', phone: '' });
 const [addingMember, setAddingMember] = useState(false);

 // 기존 계정 연결
 const [showLink, setShowLink] = useState<string | null>(null);
 const [unlinkedUsers, setUnlinkedUsers] = useState<any[]>([]);
 const [linkingId, setLinkingId] = useState<string | null>(null);

 const load = useCallback(async () => {
 setLoading(true);
 try {
 const res = await fetch('/api/partner-companies');
 const j = await res.json();
 if (res.ok) {
 setCompanies(j.data || []);
 setSites(j.meta?.sites || []);
 } else {
 setError(j?.error?.message || '목록을 불러오지 못했습니다.');
 }
 } catch {
 setError('서버 연결 오류');
 }
 setLoading(false);
 }, []);

 useEffect(() => { load(); }, [load]);

 const loadUnlinked = async () => {
 const res = await fetch('/api/partner-companies?unlinked=true');
 const j = await res.json();
 setUnlinkedUsers(j.data || []);
 };

 const handleCreate = async () => {
 if (!form.name.trim()) { setError('업체명을 입력하세요.'); return; }
 setCreating(true); setError('');
 const res = await fetch('/api/partner-companies', {
 method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
 });
 const j = await res.json();
 if (!res.ok) setError(j?.error?.message || '생성 실패');
 else { setSuccess('업체가 등록되었습니다.'); setShowCreate(false); setForm({ name: '', bizNo: '', contact: '', phone: '', email: '', address: '', notes: '' }); load(); }
 setCreating(false);
 };

 const handleSave = async (id: string) => {
 setSaving(true);
 const res = await fetch('/api/partner-companies', {
 method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ companyId: id, ...editForm }),
 });
 if (res.ok) { setEditId(null); load(); } else { const j = await res.json(); setError(j?.error?.message || '수정 실패'); }
 setSaving(false);
 };

 const handleDelete = async (id: string, name: string) => {
 if (!confirm(`"${name}" 업체를 삭제하시겠습니까?`)) return;
 const res = await fetch('/api/partner-companies', {
 method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ companyId: id }),
 });
 if (res.ok) { setSuccess('삭제되었습니다.'); load(); }
 else { const j = await res.json(); setError(j?.error?.message || '삭제 실패'); }
 };

 const handleAddMember = async () => {
 if (!mForm.name || !mForm.username || !mForm.password) { setError('이름, 아이디, 비밀번호 필수'); return; }
 setAddingMember(true); setError('');
 const res = await fetch('/api/partner-companies?action=add-member', {
 method: 'POST', headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ ...mForm, companyId: showMember }),
 });
 const j = await res.json();
 if (!res.ok) setError(j?.error?.message || '실패');
 else { setSuccess('계정이 추가되었습니다.'); setShowMember(null); setMForm({ name: '', username: '', password: '', position: '', phone: '' }); load(); }
 setAddingMember(false);
 };

 const handleLinkExisting = async (userId: string) => {
 if (!showLink) return;
 setLinkingId(userId);
 const res = await fetch('/api/partner-companies?action=link-existing', {
 method: 'POST', headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ companyId: showLink, userId }),
 });
 const j = await res.json();
 if (!res.ok) setError(j?.error?.message || '연결 실패');
 else { setSuccess('계정이 연결되었습니다.'); setShowLink(null); setUnlinkedUsers([]); load(); }
 setLinkingId(null);
 };

 const handleRemoveMember = async (memberId: string, name: string) => {
 if (!confirm(`"${name}"을 업체에서 제거할까요?`)) return;
 await fetch('/api/partner-companies', {
 method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ memberId }),
 });
 load();
 };

 const handleToggleSite = async (companyId: string, siteId: string, assigned: boolean) => {
 await fetch('/api/partner-companies?action=assign', {
 method: 'POST', headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ companyId, siteId, remove: assigned }),
 });
 load();
 };

 return (
 <div className="space-y-4">
 {error && <Alert type="error" msg={error} onClose={() => setError('')} />}
 {success && <Alert type="success" msg={success} onClose={() => setSuccess('')} />}

 <div className="flex items-center justify-between">
 <p className="text-sm text-gray-400">
 업체 등록 후 현장을 배정하면 소속 계정이 해당 현장에 자동 접근합니다.
 </p>
 <button className="btn btn-primary btn-sm gap-1.5" onClick={() => { setShowCreate(true); setError(''); }}>
 <PlusIcon className="h-4 w-4" />업체 등록
 </button>
 </div>

 {loading ? (
 <div className="py-10 text-center"><span className="loading loading-spinner loading-sm" /></div>
 ) : companies.length === 0 ? (
 <div className="rounded-xl border border-dashed py-14 text-center">
 <BuildingOffice2Icon className="mx-auto h-8 w-8 text-gray-600 mb-2" />
 <p className="text-sm text-gray-500">등록된 협력업체가 없습니다.</p>
 </div>
 ) : (
 <div className="space-y-2">
 {companies.map(co => {
 const expanded = expandedId === co.id;
 const siteAssigned = co.sites?.map((s: any) => s.siteId) ?? [];
 const isEditing = editId === co.id;

 return (
 <div key={co.id} className="rounded-xl border /50/50 overflow-hidden">
 {/* 업체 헤더 */}
 <div className="flex items-center gap-2.5 px-4 py-3">
 <button onClick={() => setExpandedId(expanded ? null : co.id)} className="text-gray-500 hover:text-white transition flex-shrink-0">
 {expanded ? <ChevronDownIcon className="h-4 w-4" /> : <ChevronRightIcon className="h-4 w-4" />}
 </button>
 <BuildingOffice2Icon className="h-4 w-4 text-blue-400 flex-shrink-0" />

 <div className="flex-1 min-w-0">
 {isEditing ? (
 <input className="input input-bordered input-sm w-full max-w-xs" value={editForm.name}
 onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
 ) : (
 <div className="flex flex-wrap items-center gap-2">
 <span className="font-bold text-white">{co.name}</span>
 {co.bizNo && <span className="text-xs text-gray-500">{co.bizNo}</span>}
 <span className="text-xs text-gray-500">계정 {co.members?.length ?? 0}명</span>
 <span className="text-xs text-gray-500">현장 {siteAssigned.length}건</span>
 {co.sites?.slice(0,2).map((sa: any) => (
 <span key={sa.siteId} className="rounded-full border bg-gray-800/60 px-2 py-0.5 text-[10px] text-gray-300">
 {sa.site?.name}
 </span>
 ))}
 {(co.sites?.length ?? 0) > 2 && <span className="text-[10px] text-gray-500">+{co.sites.length-2}</span>}
 </div>
 )}
 </div>

 <div className="flex items-center gap-1 flex-shrink-0">
 {isEditing ? (
 <>
 <button className="btn btn-ghost btn-xs text-green-400 gap-1" onClick={() => handleSave(co.id)} disabled={saving}>
 <CheckIcon className="h-3.5 w-3.5" />저장
 </button>
 <button className="btn btn-ghost btn-xs" onClick={() => setEditId(null)}>취소</button>
 </>
 ) : (
 <>
 <button className="btn btn-ghost btn-xs text-blue-400" onClick={() => { setShowSiteAssign(showSiteAssign === co.id ? null : co.id); setExpandedId(co.id); }}>현장배정</button>
 <button className="btn btn-ghost btn-xs gap-1 text-purple-300" onClick={() => { setShowLink(co.id); loadUnlinked(); setError(''); }}>
 <LinkIcon className="h-3.5 w-3.5" />계정연결
 </button>
 <button className="btn btn-ghost btn-xs gap-1" onClick={() => { setShowMember(co.id); setMForm({ name:'',username:'',password:'',position:'',phone:'' }); setError(''); }}>
 <UserPlusIcon className="h-3.5 w-3.5" />신규생성
 </button>
 <button className="btn btn-ghost btn-xs" onClick={() => { setEditId(co.id); setEditForm({ name: co.name, bizNo: co.bizNo||'', contact: co.contact||'', phone: co.phone||'', email: co.email||'', address: co.address||'', notes: co.notes||'' }); }}>
 <PencilIcon className="h-3.5 w-3.5" />
 </button>
 <button className="btn btn-ghost btn-xs text-red-400" onClick={() => handleDelete(co.id, co.name)}>
 <TrashIcon className="h-3.5 w-3.5" />
 </button>
 </>
 )}
 </div>
 </div>

 {/* 현장 배정 패널 */}
 {showSiteAssign === co.id && (
 <div className="border-t /50 bg-blue-950/10 px-4 py-3">
 <p className="text-xs font-bold text-blue-300 mb-2">현장 배정 — 체크하면 소속 계정 전체가 해당 현장에 접근</p>
 <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
 {sites.map((s: any) => {
 const assigned = siteAssigned.includes(s.id);
 return (
 <label key={s.id} className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 cursor-pointer transition ${assigned ? 'border-blue-700/50 bg-blue-950/20' : '/40 hover:border-gray-600'}`}>
 <input type="checkbox" className="checkbox checkbox-sm checkbox-primary" checked={assigned}
 onChange={() => handleToggleSite(co.id, s.id, assigned)} />
 <div className="min-w-0">
 <p className="text-xs font-medium truncate">{s.name}</p>
 <p className="text-[10px] text-gray-500">{STATUS_LABEL[s.status] || s.status}</p>
 </div>
 </label>
 );
 })}
 </div>
 <button className="btn btn-ghost btn-xs mt-2" onClick={() => setShowSiteAssign(null)}>닫기</button>
 </div>
 )}

 {/* 소속 계정 (펼침) */}
 {expanded && (
 <div className="border-t /50 px-4 py-3">
 {isEditing && (
 <div className="mb-3 grid grid-cols-2 gap-2 rounded-lg border /40 bg-gray-800/30 p-3">
 {[['사업자번호','bizNo'],['담당자','contact'],['연락처','phone'],['이메일','email']].map(([lbl,key]) => (
 <Field key={key} label={lbl}>
 <input className="input input-bordered input-sm w-full" value={editForm[key]}
 onChange={e => setEditForm({ ...editForm, [key]: e.target.value })} />
 </Field>
 ))}
 <Field label="주소" className="col-span-2">
 <input className="input input-bordered input-sm w-full" value={editForm.address}
 onChange={e => setEditForm({ ...editForm, address: e.target.value })} />
 </Field>
 </div>
 )}

 {!isEditing && (co.contact || co.phone || co.email) && (
 <div className="mb-3 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-gray-400">
 {co.contact && <span>담당자: <span className="text-gray-200">{co.contact}</span></span>}
 {co.phone && <span>연락처: <span className="text-gray-200">{co.phone}</span></span>}
 {co.email && <span>이메일: <span className="text-gray-200">{co.email}</span></span>}
 </div>
 )}

 <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-2">소속 계정 ({co.members?.length ?? 0}명)</p>
 {!co.members?.length ? (
 <p className="text-xs text-gray-500 py-2">등록된 계정이 없습니다. [계정연결] 또는 [신규생성]을 사용하세요.</p>
 ) : (
 <div className="divide-y divide-gray-700/30">
 {co.members.map((m: any) => (
 <div key={m.id} className="flex items-center justify-between py-2">
 <div className="flex items-center gap-2.5">
 <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-900/40 text-blue-300 text-xs font-bold flex-shrink-0">
 {m.user?.name?.[0] || '?'}
 </div>
 <div>
 <p className="text-sm font-semibold">{m.user?.name}</p>
 <p className="text-xs text-gray-500">@{m.user?.username}{m.user?.position && ` · ${m.user.position}`}{m.user?.phone && ` · ${m.user.phone}`}</p>
 </div>
 </div>
 <button className="btn btn-ghost btn-xs text-red-400" onClick={() => handleRemoveMember(m.id, m.user?.name||'')}>
 <TrashIcon className="h-3.5 w-3.5" />
 </button>
 </div>
 ))}
 </div>
 )}
 </div>
 )}
 </div>
 );
 })}
 </div>
 )}

 {/* 업체 생성 모달 */}
 {showCreate && (
 <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{background:"rgba(0,0,0,0.6)"}}>
 <div className="w-full max-w-md rounded-2xl p-5" style={{backgroundColor:"var(--bg-elevated)",border:"1px solid var(--border-base)",boxShadow:"var(--shadow-elevated)"}}>
 <div className="flex items-center justify-between mb-4">
 <h3 className="text-lg font-bold">협력업체 등록</h3>
 <button onClick={() => setShowCreate(false)} className="p-1.5 rounded-lg text-gray-400 "><XMarkIcon className="h-5 w-5" /></button>
 </div>
 {error && <Alert type="error" msg={error} onClose={() => setError('')} />}
 <div className="grid grid-cols-2 gap-3">
 <Field label="업체명 *" className="col-span-2">
 <input className="input input-bordered w-full" placeholder="예: (주)덕인설치" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
 </Field>
 <Field label="사업자번호"><input className="input input-bordered w-full" value={form.bizNo} onChange={e => setForm({ ...form, bizNo: e.target.value })} /></Field>
 <Field label="담당자명"><input className="input input-bordered w-full" value={form.contact} onChange={e => setForm({ ...form, contact: e.target.value })} /></Field>
 <Field label="연락처"><input className="input input-bordered w-full" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></Field>
 <Field label="이메일"><input className="input input-bordered w-full" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></Field>
 <Field label="주소" className="col-span-2"><input className="input input-bordered w-full" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></Field>
 <Field label="메모" className="col-span-2"><textarea className="textarea textarea-bordered w-full text-sm" rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></Field>
 </div>
 <div className="mt-4 flex justify-end gap-2">
 <button className="btn btn-ghost btn-sm" onClick={() => setShowCreate(false)}>취소</button>
 <button className="btn btn-primary btn-sm" onClick={handleCreate} disabled={creating}>
 {creating ? <span className="loading loading-spinner loading-xs" /> : '등록'}
 </button>
 </div>
 </div>
 </div>
 )}

 {/* 신규 계정 생성 모달 */}
 {showMember && (
 <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{background:"rgba(0,0,0,0.6)"}}>
 <div className="w-full max-w-sm rounded-2xl p-5" style={{backgroundColor:"var(--bg-elevated)",border:"1px solid var(--border-base)",boxShadow:"var(--shadow-elevated)"}}>
 <div className="flex items-center justify-between mb-3">
 <div>
 <h3 className="text-base font-bold">협력사 계정 생성</h3>
 <p className="text-xs text-gray-400 mt-0.5">{companies.find(c => c.id === showMember)?.name} 소속</p>
 </div>
 <button onClick={() => setShowMember(null)} className="p-1.5 rounded-lg text-gray-400 "><XMarkIcon className="h-5 w-5" /></button>
 </div>
 {error && <Alert type="error" msg={error} onClose={() => setError('')} />}
 <div className="space-y-2.5">
 <Field label="이름 *"><input className="input input-bordered w-full" value={mForm.name} onChange={e => setMForm({ ...mForm, name: e.target.value })} /></Field>
 <Field label="아이디 *"><input className="input input-bordered w-full" placeholder="영문/숫자" value={mForm.username} onChange={e => setMForm({ ...mForm, username: e.target.value.trim() })} /></Field>
 <Field label="비밀번호 *"><input type="password" className="input input-bordered w-full" value={mForm.password} onChange={e => setMForm({ ...mForm, password: e.target.value })} /></Field>
 <Field label="직책"><input className="input input-bordered w-full" placeholder="예: 소장" value={mForm.position} onChange={e => setMForm({ ...mForm, position: e.target.value })} /></Field>
 <Field label="연락처"><input className="input input-bordered w-full" value={mForm.phone} onChange={e => setMForm({ ...mForm, phone: e.target.value })} /></Field>
 </div>
 <div className="mt-4 flex justify-end gap-2">
 <button className="btn btn-ghost btn-sm" onClick={() => setShowMember(null)}>취소</button>
 <button className="btn btn-primary btn-sm" onClick={handleAddMember} disabled={addingMember}>
 {addingMember ? <span className="loading loading-spinner loading-xs" /> : '생성'}
 </button>
 </div>
 </div>
 </div>
 )}

 {/* 기존 계정 연결 모달 */}
 {showLink && (
 <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{background:"rgba(0,0,0,0.6)"}}>
 <div className="w-full max-w-md rounded-2xl p-5" style={{backgroundColor:"var(--bg-elevated)",border:"1px solid var(--border-base)",boxShadow:"var(--shadow-elevated)"}}>
 <div className="flex items-center justify-between mb-3">
 <div>
 <h3 className="text-base font-bold">기존 계정 연결</h3>
 <p className="text-xs text-gray-400 mt-0.5">
 {companies.find(c => c.id === showLink)?.name} — 미소속 PARTNER 계정 선택
 </p>
 </div>
 <button onClick={() => { setShowLink(null); setUnlinkedUsers([]); }} className="p-1.5 rounded-lg text-gray-400 ">
 <XMarkIcon className="h-5 w-5" />
 </button>
 </div>
 {error && <Alert type="error" msg={error} onClose={() => setError('')} />}
 {unlinkedUsers.length === 0 ? (
 <div className="py-8 text-center text-sm text-gray-500">
 미소속 PARTNER 계정이 없습니다.
 </div>
 ) : (
 <div className="space-y-1.5 max-h-64 overflow-y-auto">
 {unlinkedUsers.map(u => (
 <div key={u.id} className="flex items-center justify-between rounded-lg border /50 bg-gray-800/30 px-3 py-2.5">
 <div>
 <p className="text-sm font-semibold text-white">{u.name}</p>
 <p className="text-xs text-gray-400">@{u.username}{u.position && ` · ${u.position}`}{u.phone && ` · ${u.phone}`}</p>
 </div>
 <button
 className="btn btn-primary btn-xs"
 onClick={() => handleLinkExisting(u.id)}
 disabled={linkingId === u.id}
 >
 {linkingId === u.id ? <span className="loading loading-spinner loading-xs" /> : '연결'}
 </button>
 </div>
 ))}
 </div>
 )}
 <div className="mt-4 flex justify-end">
 <button className="btn btn-ghost btn-sm" onClick={() => { setShowLink(null); setUnlinkedUsers([]); }}>닫기</button>
 </div>
 </div>
 </div>
 )}
 </div>
 );
};

// ── 공통 컴포넌트 ──────────────────────────────────────
const Field = ({ label, children, className }: { label: string; children: ReactNode; className?: string }) => (
 <div className={className}>
 <label className="block text-xs font-semibold text-gray-400 mb-1">{label}</label>
 {children}
 </div>
);

const Alert = ({ type, msg, onClose }: { type: 'error'|'success'; msg: string; onClose: () => void }) => (
 <div className={`mb-3 flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm ${
 type === 'error' ? 'border-red-800/50 bg-red-950/20 text-red-300' : 'border-green-800/50 bg-green-950/20 text-green-300'
 }`}>
 {msg}
 <button onClick={onClose}><XMarkIcon className="h-4 w-4" /></button>
 </div>
);

// ── 협력업체명 검색 입력 컴포넌트 ──────────────────────
const CompanySearchInput = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => {
 const [companies, setCompanies] = useState<any[]>([]);
 const [show, setShow] = useState(false);

 useEffect(() => {
 fetch('/api/partner-companies')
 .then(r => r.ok ? r.json() : { data: [] })
 .then(j => setCompanies(j.data || []));
 }, []);

 const filtered = value.trim()
 ? companies.filter(c => c.name.includes(value))
 : companies;

 return (
 <div className="relative">
 <input
 className="input input-bordered w-full"
 placeholder={companies.length > 0 ? `${companies.length}개 업체 — 검색 또는 직접 입력` : '직접 입력 (협력업체 탭에서 선택 가능)'}
 value={value}
 onChange={e => { onChange(e.target.value); setShow(true); }}
 onFocus={() => setShow(true)}
 onBlur={() => setTimeout(() => setShow(false), 150)}
 autoComplete="off"
 />
 {show && filtered.length > 0 && (
 <div className="absolute z-50 left-0 right-0 top-full mt-1 max-h-48 overflow-y-auto rounded-lg" style={{backgroundColor:'var(--bg-elevated)',border:'1px solid var(--border-base)',boxShadow:'var(--shadow-elevated)'}}>
 {filtered.map((co: any) => (
 <button
 key={co.id}
 type="button"
 className="w-full text-left px-3 py-2.5 transition-colors"
 style={{borderBottom:'1px solid var(--border-subtle)'}}
 onMouseDown={() => { onChange(co.name); setShow(false); }}
 onMouseOver={e => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
 onMouseOut={e => (e.currentTarget.style.backgroundColor = 'transparent')}
 >
 <p className="text-sm font-semibold" style={{color:'var(--text-primary)'}}>{co.name}</p>
 {co.contact && <p className="text-[11px]" style={{color:'var(--text-muted)'}}>대표이사: {co.contact}{co.phone ? ` · ${co.phone}` : ''}</p>}
 </button>
 ))}
 </div>
 )}
 {show && value.trim() && filtered.length === 0 && (
 <div className="absolute z-50 left-0 right-0 top-full mt-1 rounded-lg px-3 py-2 text-xs" style={{backgroundColor:'var(--bg-elevated)',border:'1px solid var(--border-base)',color:'var(--text-muted)',boxShadow:'var(--shadow-elevated)'}}>
 등록된 업체 없음 — 직접 입력됩니다
 </div>
 )}
 </div>
 );
};

export async function getServerSideProps(context: GetServerSidePropsContext) {
 return { props: { ...(await serverSideTranslations(context.locale ?? 'ko', ['common'])) } };
}

export default AdminUsers;
