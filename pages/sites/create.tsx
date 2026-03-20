/* eslint-disable i18next/no-literal-string */
import { GetServerSidePropsContext } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { XMarkIcon, MagnifyingGlassIcon, PlusIcon } from '@heroicons/react/24/outline';

const STATUS_DOT: Record<string, string> = {
 영업중: 'bg-red-500', 대기: 'bg-red-400', 계약완료: 'bg-yellow-400',
 진행중: 'bg-green-500', 부분완료: 'bg-green-300', 완료: 'bg-gray-400', 보류: 'bg-gray-600',
};
const siteStatuses = ['영업중', '대기', '계약완료', '진행중', '부분완료', '완료', '보류'];
const siteTypes = ['납품설치도', '납품하차도'];

// 숫자 콤마 포맷
function fmtNum(v: string) {
 const n = v.replace(/[^\d]/g, '');
 return n ? Number(n).toLocaleString() : '';
}
function parseNum(v: string) {
 return v.replace(/,/g, '');
}

// 계약금액 자동계산
function calcAmount(qty: string, unit: string) {
 const q = parseFloat(parseNum(qty));
 const u = parseFloat(parseNum(unit));
 if (!isNaN(q) && !isNaN(u) && q > 0 && u > 0) {
 return Math.round(q * u).toLocaleString();
 }
 return '';
}

const CreateSite = () => {
 const router = useRouter();
 const [creating, setCreating] = useState(false);
 const [error, setError] = useState('');
 const [success, setSuccess] = useState('');
 const [clients, setClients] = useState<any[]>([]);
 const [mode, setMode] = useState<'single' | 'bulk'>('single');

 const [form, setForm] = useState({
 name: '',
 address: '',
 clientId: '',
 status: '영업중',
 siteType: '납품설치도',
 // 계약 정보 (Contract 테이블)
 specification: '',
 quantity: '', // m2
 unitPrice: '', // 원/m2
 contractAmount: '', // 총 금액
 contractDate: '',
 deliveryDeadline: '',
 installer: '',
 // 순수 메모
 description: '',
 });

 const [assignees, setAssignees] = useState<any[]>([]);
 const [searchQuery, setSearchQuery] = useState('');
 const [searchResults, setSearchResults] = useState<any[]>([]);
 const [bulkText, setBulkText] = useState('');

 useEffect(() => {
 fetch('/api/clients').then((r) => r.json()).then((d) => setClients(d.data || []));
 }, []);

 // 물량 or 단가 바뀌면 금액 자동계산
 const handleQtyOrUnit = (field: 'quantity' | 'unitPrice', raw: string) => {
 const fmt = fmtNum(raw);
 const next = { ...form, [field]: fmt };
 next.contractAmount = calcAmount(
 field === 'quantity' ? fmt : form.quantity,
 field === 'unitPrice' ? fmt : form.unitPrice
 );
 setForm(next);
 };

 const handleSearch = async (q: string) => {
 setSearchQuery(q);
 if (!q) { setSearchResults([]); return; }
 const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`);
 if (res.ok) { const d = await res.json(); setSearchResults(d.data || []); }
 };

 const addAssignee = (user: any) => {
 if (!assignees.find((a) => a.id === user.id)) setAssignees([...assignees, user]);
 setSearchQuery(''); setSearchResults([]);
 };
 const removeAssignee = (id: string) => setAssignees(assignees.filter((a) => a.id !== id));

 const ensureClient = async (clientName: string) => {
 if (!clientName) return '';
 const found = clients.find((c) => c.name === clientName);
 if (found) return found.id;
 const res = await fetch('/api/clients', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ name: clientName, type: '발주처' }),
 });
 if (!res.ok) return '';
 const json = await res.json();
 setClients((p) => [json.data, ...p]);
 return json.data.id;
 };

 const createSiteWithAssignees = async (payload: any, assigneeList: any[] = []) => {
 const res = await fetch('/api/sites', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify(payload),
 });
 if (!res.ok) { const d = await res.json(); throw new Error(d.error?.message || '현장 생성 실패'); }
 const { data: site } = await res.json();
 for (const user of assigneeList) {
 await fetch(`/api/sites/${site.id}/assignments`, {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ userId: user.id }),
 });
 }
 return site;
 };

 const handleSingleSubmit = async () => {
 if (!form.name.trim()) { setError('현장명을 입력하세요.'); return; }
 setCreating(true); setError(''); setSuccess('');
 try {
 const site = await createSiteWithAssignees(
 {
 name: form.name,
 address: form.address,
 clientId: form.clientId,
 status: form.status,
 siteType: form.siteType,
 specification: form.specification,
 quantity: parseNum(form.quantity),
 unitPrice: parseNum(form.unitPrice),
 contractAmount: parseNum(form.contractAmount),
 contractDate: form.contractDate,
 deliveryDeadline: form.deliveryDeadline,
 installer: form.installer,
 description: form.description,
 },
 assignees
 );
 router.push(`/sites/${site.id}`);
 } catch (err: any) {
 setError(err?.message || '현장 생성에 실패했습니다.');
 } finally {
 setCreating(false);
 }
 };

 const parseBulkRows = () =>
 bulkText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((line) => {
 const cells = line.includes('\t') ? line.split('\t') : line.split(',');
 const [orderNo, name, clientName, salesStatus, specification, quantity, unitPrice, amount, contractDate, deliveryDeadline, installation, installer] =
 cells.map((c) => (c || '').trim());
 return { orderNo, name, clientName, salesStatus, specification, quantity, unitPrice, amount, contractDate, deliveryDeadline, installation, installer };
 }).filter((r) => r.name);

 const handleBulkSubmit = async () => {
 const rows = parseBulkRows();
 if (!rows.length) { setError('붙여넣은 엑셀 데이터가 없습니다.'); return; }
 setCreating(true); setError(''); setSuccess('');
 try {
 let count = 0;
 for (const row of rows) {
 const clientId = row.clientName ? await ensureClient(row.clientName) : '';
 await createSiteWithAssignees({
 name: row.name,
 address: '',
 clientId,
 status: row.salesStatus || '영업중',
 siteType: row.installation || '현장설치도',
 specification: row.specification,
 quantity: row.quantity,
 unitPrice: row.unitPrice,
 contractAmount: row.amount,
 contractDate: row.contractDate,
 deliveryDeadline: row.deliveryDeadline,
 installer: row.installer,
 description: row.orderNo ? `순번: ${row.orderNo}` : '',
 });
 count += 1;
 }
 setSuccess(`${count}개 현장을 일괄 등록했습니다.`);
 setBulkText('');
 } catch (err: any) {
 setError(err?.message || '일괄등록에 실패했습니다.');
 } finally {
 setCreating(false);
 }
 };

 return (
 <>
 <Head><title>현장 등록 | LOOKUP9</title></Head>
 <div className="space-y-5">
 <div>
 <h2 className="text-xl font-bold">현장 등록</h2>
 <p className="mt-0.5 text-xs text-gray-500">계약물량·단가를 입력하면 계약금액이 자동계산되고 Contract 테이블에 저장됩니다.</p>
 </div>

 {/* 탭 */}
 <div className="flex gap-0 border-b">
 {(['single', 'bulk'] as const).map((m) => (
 <button key={m} onClick={() => setMode(m)}
 className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${mode === m ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-400'}`}>
 {m === 'single' ? '단건 등록' : '엑셀 일괄등록'}
 </button>
 ))}
 </div>

 {error && <div className="rounded-xl border border-red-800/50 bg-red-900/20 px-4 py-3 text-sm text-red-300">{error}</div>}
 {success && <div className="rounded-xl border border-green-800/50 bg-green-900/20 px-4 py-3 text-sm text-green-300">{success}</div>}

 {mode === 'single' ? (
 <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">

 {/* 왼쪽: 현장 기본정보 + 계약정보 */}
 <div className="space-y-5">

 {/* 기본정보 */}
 <div className="rounded-xl border p-5 space-y-4">
 <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">기본정보</p>

 <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
 <div>
 <label className="block text-xs text-gray-400 mb-1">현장명 *</label>
 <input type="text" className="input input-bordered w-full"
 value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
 </div>
 <div>
 <label className="block text-xs text-gray-400 mb-1">현장구분</label>
 <select className="select select-bordered w-full" value={form.siteType}
 onChange={(e) => setForm({ ...form, siteType: e.target.value })}>
 {siteTypes.map((t) => <option key={t} value={t}>{t}</option>)}
 </select>
 </div>
 </div>

 <div>
 <label className="block text-xs text-gray-400 mb-1">현장 주소</label>
 <input type="text" className="input input-bordered w-full"
 value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
 </div>

 <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
 <div>
 <label className="block text-xs text-gray-400 mb-1">수요처 / 발주처</label>
 <select className="select select-bordered w-full" value={form.clientId}
 onChange={(e) => setForm({ ...form, clientId: e.target.value })}>
 <option value="">-</option>
 {clients.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
 </select>
 </div>
 <div>
 <label className="block text-xs text-gray-400 mb-1">전문시공사</label>
 <input type="text" className="input input-bordered w-full"
 value={form.installer} onChange={(e) => setForm({ ...form, installer: e.target.value })} />
 </div>
 </div>

 <div>
 <label className="block text-xs text-gray-400 mb-2">상태</label>
 <div className="flex flex-wrap gap-2">
 {siteStatuses.map((s) => (
 <button key={s} type="button" onClick={() => setForm({ ...form, status: s })}
 className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition ${form.status === s ? 'border-blue-500 bg-blue-900/30 text-blue-300' : ' text-gray-400 hover:border-gray-500'}`}>
 <span className={`h-2 w-2 rounded-full ${STATUS_DOT[s]}`} />{s}
 </button>
 ))}
 </div>
 </div>
 </div>

 {/* 계약정보 — Contract 테이블에 저장 */}
 <div className="rounded-xl border border-blue-900/40 bg-blue-950/20 p-5 space-y-4">
 <div className="flex items-center gap-2">
 <p className="text-xs font-semibold text-blue-300 uppercase tracking-wider">계약정보</p>
 <span className="text-xs text-gray-500">물량·단가 입력 시 금액 자동계산 / 계약(Contract) 테이블에 저장</span>
 </div>

 <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
 <div>
 <label className="block text-xs text-gray-400 mb-1">사양</label>
 <input type="text" className="input input-bordered w-full" placeholder="예) AL 3T"
 value={form.specification} onChange={(e) => setForm({ ...form, specification: e.target.value })} />
 </div>
 <div>
 <label className="block text-xs text-gray-400 mb-1">계약물량 (m²)</label>
 <input type="text" className="input input-bordered w-full" placeholder="예) 1,200"
 value={form.quantity}
 onChange={(e) => handleQtyOrUnit('quantity', e.target.value)} />
 </div>
 <div>
 <label className="block text-xs text-gray-400 mb-1">단가 (원/m²)</label>
 <input type="text" className="input input-bordered w-full" placeholder="예) 220,000"
 value={form.unitPrice}
 onChange={(e) => handleQtyOrUnit('unitPrice', e.target.value)} />
 </div>
 </div>

 <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
 <div>
 <label className="block text-xs text-gray-400 mb-1">계약금액 (원)</label>
 <input type="text" className="input input-bordered w-full font-semibold text-blue-300"
 placeholder="자동계산"
 value={form.contractAmount}
 onChange={(e) => setForm({ ...form, contractAmount: fmtNum(e.target.value) })} />
 </div>
 <div>
 <label className="block text-xs text-gray-400 mb-1">계약일</label>
 <input type="date" className="input input-bordered w-full"
 value={form.contractDate} onChange={(e) => setForm({ ...form, contractDate: e.target.value })} />
 </div>
 <div>
 <label className="block text-xs text-gray-400 mb-1">납품기한</label>
 <input type="date" className="input input-bordered w-full"
 value={form.deliveryDeadline} onChange={(e) => setForm({ ...form, deliveryDeadline: e.target.value })} />
 </div>
 </div>

 {form.quantity && form.unitPrice && form.contractAmount && (
 <div className="rounded-lg bg-blue-900/20 px-4 py-2.5 text-sm">
 <span className="text-gray-400">계약물량 </span>
 <span className="font-semibold text-white">{form.quantity} m²</span>
 <span className="text-gray-400"> × 단가 </span>
 <span className="font-semibold text-white">{form.unitPrice} 원</span>
 <span className="text-gray-400"> = </span>
 <span className="font-bold text-blue-300">{form.contractAmount} 원</span>
 </div>
 )}
 </div>

 {/* 현장 메모 (순수 메모) */}
 <div className="rounded-xl border p-5">
 <label className="block text-xs text-gray-400 mb-2">현장 메모 (선택)</label>
 <textarea className="textarea textarea-bordered w-full text-sm" rows={4}
 placeholder="현장 관련 추가 메모를 입력하세요 (물량/단가/금액은 위 계약정보에 입력)"
 value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
 </div>
 </div>

 {/* 오른쪽: 담당자 배정 */}
 <div className="rounded-xl border p-5 space-y-4 h-fit">
 <div>
 <h3 className="text-sm font-semibold">담당자 배정</h3>
 <p className="mt-1 text-xs text-gray-500">내부 직원 또는 협력사를 검색해서 바로 배정합니다.</p>
 </div>

 {assignees.length > 0 && (
 <div className="flex flex-wrap gap-2">
 {assignees.map((u) => (
 <span key={u.id} className="badge badge-lg gap-1">
 {u.position ? `${u.position} ` : ''}{u.name}
 <button type="button" onClick={() => removeAssignee(u.id)}>
 <XMarkIcon className="h-3 w-3" />
 </button>
 </span>
 ))}
 </div>
 )}

 <div className="relative">
 <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
 <input type="text" className="input input-bordered w-full pl-9" placeholder="이름으로 검색"
 value={searchQuery} onChange={(e) => handleSearch(e.target.value)} />
 </div>

 {searchResults.length > 0 && (
 <div className="max-h-40 overflow-y-auto rounded-lg border">
 {searchResults.map((u) => (
 <button key={u.id} type="button" onClick={() => addAssignee(u)}
 className="w-full px-3 py-2 text-left text-sm hover: flex items-center gap-2">
 <PlusIcon className="h-3.5 w-3.5 text-gray-500" />
 <span>{u.position ? `${u.position} ` : ''}{u.name}</span>
 <span className="text-xs text-gray-500">({u.email})</span>
 </button>
 ))}
 </div>
 )}

 <div className="rounded-lg border px-3 py-2.5 text-xs text-gray-500">
 등록 후 현장 상세 → 담당자 탭에서도 추가/제거 가능합니다.
 </div>
 </div>
 </div>
 ) : (
 /* 엑셀 일괄등록 */
 <div className="rounded-xl border p-5 space-y-4">
 <div className="rounded-lg px-4 py-3 text-sm text-gray-300 leading-6">
 엑셀에서 아래 순서로 복사해서 그대로 붙여넣으세요. <strong>탭 구분</strong>으로 자동 파싱됩니다.<br />
 <span className="text-xs text-gray-500">
 순번 / 현장명 / 수요처·발주처 / 상태 / 사양 / <strong>물량(m²)</strong> / <strong>단가</strong> / <strong>계약금액</strong> / 계약일 / 납품기한 / 현장구분 / 전문시공사
 </span>
 </div>
 <textarea
 className="textarea textarea-bordered h-[300px] w-full font-mono text-sm"
 value={bulkText}
 onChange={(e) => setBulkText(e.target.value)}
 placeholder={[
 '1\t대구 A현장\tOO건설\t영업중\tAL 3T\t1200\t220000\t264000000\t2026-03-11\t2026-04-15\t현장설치도\tAIRX',
 '2\t구미 B현장\tXX종합건설\t계약완료\tAL 2T\t800\t210000\t168000000\t2026-03-12\t2026-04-20\t납품하차도\t샘플패널',
 ].join('\n')}
 />
 </div>
 )}

 <div className="flex gap-3">
 <button
 className={`btn btn-primary ${creating ? 'loading' : ''}`}
 disabled={creating}
 onClick={mode === 'single' ? handleSingleSubmit : handleBulkSubmit}
 >
 {mode === 'single' ? '현장 등록' : '일괄 등록'}
 </button>
 <button className="btn btn-ghost" onClick={() => router.back()}>취소</button>
 </div>
 </div>
 </>
 );
};

export async function getServerSideProps({ locale }: GetServerSidePropsContext) {
 return { props: { ...(locale ? await serverSideTranslations(locale, ['common']) : {}) } };
}

export default CreateSite;
