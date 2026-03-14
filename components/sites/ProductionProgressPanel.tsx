/* eslint-disable i18next/no-literal-string */
import { useState, useMemo } from 'react';
import useSWR from 'swr';
import fetcher from '@/lib/fetcher';
import { PlusIcon, TrashIcon, PencilIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';

const fmt = (v: any) => {
  const n = Number(String(v ?? '').replace(/[^0-9.-]/g, ''));
  return isFinite(n) && v !== '' && v !== null && v !== undefined ? n.toLocaleString('ko-KR') : '-';
};
const fmtDate = (v: any) => {
  if (!v) return '';
  const d = new Date(v);
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('ko-KR');
};
const parseNum = (v: string) => v.replace(/,/g, '');
const elapsedDays = (supplyDate: string | null) => {
  if (!supplyDate) return null;
  const d = new Date(supplyDate);
  if (isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
};

const Bar = ({ value, color = 'bg-blue-600' }: { value: number; color?: string }) => (
  <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-800">
    <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${Math.min(value, 100)}%` }} />
  </div>
);
const rateColor = (v: number) => v >= 80 ? 'bg-green-500' : v >= 40 ? 'bg-blue-600' : 'bg-yellow-500';
const rateText  = (v: number) => v >= 80 ? 'text-green-400' : v >= 40 ? 'text-blue-400' : 'text-yellow-400';

export default function ProductionProgressPanel({ site, canManage, onMutate }: { site: any; canManage: boolean; onMutate: () => void }) {
  const siteId = site?.id;
  const { data: ordersData, mutate: mutateOrders } = useSWR(siteId ? `/api/sites/${siteId}/production` : null, fetcher, { refreshInterval: 30000 });
  const orders: any[] = ordersData?.data || [];

  const contract = site?.contracts?.find((c: any) => !c.isAdditional);
  const contractQty = Number(contract?.quantity ?? 0);
  const orderedQty = useMemo(() => orders.reduce((s, o) => s + Number(o.quantity ?? 0), 0), [orders]);
  const diff = contractQty - orderedQty;
  const panelRate = contractQty > 0 ? Math.min(100, Math.round((orderedQty / contractQty) * 100)) : 0;
  const pipeRate = site?.pipeRate ?? 0;
  const caulkingRate = site?.caulkingRate ?? 0;
  const finalRate = Math.round(panelRate * 0.4 + pipeRate * 0.3 + caulkingRate * 0.3);

  const [editingRates, setEditingRates] = useState(false);
  const [rateForm, setRateForm] = useState({ pipeRate: '0', caulkingRate: '0', startDocsDone: false, completionDocsDone: false, completionDate: '' });
  const [savingRates, setSavingRates] = useState(false);

  const openRateEdit = () => {
    setRateForm({
      pipeRate: String(site?.pipeRate ?? 0),
      caulkingRate: String(site?.caulkingRate ?? 0),
      startDocsDone: site?.startDocsDone ?? false,
      completionDocsDone: site?.completionDocsDone ?? false,
      completionDate: site?.completionDate ? new Date(site.completionDate).toISOString().split('T')[0] : '',
    });
    setEditingRates(true);
  };

  const saveRates = async () => {
    setSavingRates(true);
    await fetch(`/api/sites/${siteId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pipeRate: Number(rateForm.pipeRate), caulkingRate: Number(rateForm.caulkingRate), startDocsDone: rateForm.startDocsDone, completionDocsDone: rateForm.completionDocsDone, completionDate: rateForm.completionDate || null }),
    });
    setSavingRates(false);
    setEditingRates(false);
    onMutate();
  };

  const warrantyExpiry = useMemo(() => {
    const d = site?.completionDate ? new Date(site.completionDate) : null;
    if (!d) return null;
    const exp = new Date(d);
    exp.setFullYear(exp.getFullYear() + 2);
    return exp;
  }, [site?.completionDate]);
  const warrantyDaysLeft = warrantyExpiry ? Math.ceil((warrantyExpiry.getTime() - Date.now()) / 86400000) : null;

  return (
    <div className="space-y-4">

      {/* 최종 공정율 */}
      <div className="rounded-xl border border-gray-800 bg-black/30 p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-500 mb-1">최종 공정율</p>
            <p className={`text-5xl font-extrabold leading-none ${rateText(finalRate)}`}>{finalRate}%</p>
            <div className="mt-2 max-w-xs"><Bar value={finalRate} color={rateColor(finalRate)} /></div>
          </div>
          {warrantyExpiry && (
            <div className={`rounded-lg border px-3 py-2 text-xs text-center shrink-0 ${warrantyDaysLeft !== null && warrantyDaysLeft <= 90 ? 'border-red-700/60 bg-red-950/20 text-red-300' : 'border-gray-700 text-gray-400'}`}>
              <p className="text-[10px] text-gray-500 mb-0.5">하자보수 만료</p>
              <p className="font-semibold">{warrantyExpiry.toLocaleDateString('ko-KR')}</p>
              {warrantyDaysLeft !== null && <p className="text-[10px] mt-0.5">{warrantyDaysLeft > 0 ? `D-${warrantyDaysLeft}` : '만료됨'}</p>}
            </div>
          )}
        </div>
      </div>

      {/* 상단 요약 */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-gray-800 bg-black/20 p-3 text-center">
          <p className="text-[10px] text-gray-500 mb-1">계약물량</p>
          <p className="text-sm font-bold text-gray-200">{contractQty > 0 ? `${contractQty.toLocaleString('ko-KR')} m²` : '-'}</p>
        </div>
        <div className="rounded-xl border border-blue-900/50 bg-blue-950/20 p-3 text-center">
          <p className="text-[10px] text-gray-500 mb-1">발주물량</p>
          <p className="text-sm font-bold text-gray-200">{orderedQty > 0 ? `${orderedQty.toLocaleString('ko-KR')} m²` : '-'}</p>
        </div>
        <div className={`rounded-xl border p-3 text-center ${diff === 0 ? 'border-gray-800 bg-black/20' : diff > 0 ? 'border-green-900/50 bg-green-950/20' : 'border-red-900/50 bg-red-950/20'}`}>
          <p className="text-[10px] text-gray-500 mb-1">오차</p>
          <p className="text-sm font-bold text-gray-200">{contractQty > 0 ? `${diff >= 0 ? '+' : ''}${diff.toLocaleString('ko-KR')} m²` : '-'}</p>
        </div>
      </div>

      {/* 세부 공정율 */}
      <div className="rounded-xl border border-gray-800 bg-black/20 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-gray-400">세부 공정율</p>
          {canManage && !editingRates && (
            <button className="btn btn-ghost btn-xs gap-1" onClick={openRateEdit}><PencilIcon className="h-3 w-3" />수정</button>
          )}
        </div>
        {editingRates ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">하지파이프 진행율 (%)</label>
                <input type="number" min="0" max="100" className="input input-bordered input-sm w-full" value={rateForm.pipeRate} onChange={(e) => setRateForm({ ...rateForm, pipeRate: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">코킹작업 진행율 (%)</label>
                <input type="number" min="0" max="100" className="input input-bordered input-sm w-full" value={rateForm.caulkingRate} onChange={(e) => setRateForm({ ...rateForm, caulkingRate: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">준공일 (하자보수 기산점)</label>
              <input type="date" className="input input-bordered input-sm w-full" value={rateForm.completionDate} onChange={(e) => setRateForm({ ...rateForm, completionDate: e.target.value })} />
            </div>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" className="checkbox checkbox-sm" checked={rateForm.startDocsDone} onChange={(e) => setRateForm({ ...rateForm, startDocsDone: e.target.checked })} />착수서류 완료</label>
              <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" className="checkbox checkbox-sm" checked={rateForm.completionDocsDone} onChange={(e) => setRateForm({ ...rateForm, completionDocsDone: e.target.checked })} />준공서류 완료</label>
            </div>
            <div className="flex justify-end gap-2">
              <button className="btn btn-ghost btn-xs" onClick={() => setEditingRates(false)}>취소</button>
              <button className={`btn btn-primary btn-xs ${savingRates ? 'loading' : ''}`} disabled={savingRates} onClick={saveRates}>저장</button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <RateRow label="판넬 생산율" value={panelRate} helper={contractQty > 0 ? `${orderedQty.toLocaleString('ko-KR')} / ${contractQty.toLocaleString('ko-KR')} m²` : '계약물량 미입력'} />
            <RateRow label="하지파이프 진행율" value={pipeRate} />
            <RateRow label="코킹작업 진행율" value={caulkingRate} />
            <div className="grid grid-cols-2 gap-2 pt-1">
              <DocCheck label="착수서류" done={site?.startDocsDone} />
              <DocCheck label="준공서류" done={site?.completionDocsDone} />
            </div>
          </div>
        )}
      </div>

      {/* 생산 차수 테이블 */}
      <ProductionOrderTable siteId={siteId} orders={orders} canManage={canManage} onMutate={mutateOrders} />
    </div>
  );
}

function RateRow({ label, value, helper }: { label: string; value: number; helper?: string }) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-400">{label}</span>
        <span className={`font-semibold ${rateText(value)}`}>{value}%</span>
      </div>
      <Bar value={value} color={rateColor(value)} />
      {helper && <p className="text-[10px] text-gray-600 mt-0.5">{helper}</p>}
    </div>
  );
}

function DocCheck({ label, done }: { label: string; done: boolean }) {
  return (
    <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${done ? 'border-green-800/60 bg-green-950/20 text-green-400' : 'border-gray-800 text-gray-500'}`}>
      {done ? <CheckIcon className="h-3.5 w-3.5 shrink-0" /> : <XMarkIcon className="h-3.5 w-3.5 shrink-0 text-gray-600" />}
      {label} {done ? '완료' : '미완료'}
    </div>
  );
}

function ProductionOrderTable({ siteId, orders, canManage, onMutate }: { siteId: string; orders: any[]; canManage: boolean; onMutate: () => void }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ quantity: '', orderDate: '', supplyDate: '', notes: '' });
  const [submitting, setSubmitting] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});

  const handleAdd = async () => {
    setSubmitting(true);
    await fetch(`/api/sites/${siteId}/production`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity: form.quantity ? Number(parseNum(form.quantity)) : null, orderDate: form.orderDate || null, supplyDate: form.supplyDate || null, notes: form.notes || null }),
    });
    setForm({ quantity: '', orderDate: '', supplyDate: '', notes: '' });
    setShowForm(false); setSubmitting(false); onMutate();
  };

  const handleEdit = async (orderId: string) => {
    await fetch(`/api/sites/${siteId}/production`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, quantity: editForm.quantity ? Number(parseNum(editForm.quantity)) : null, orderDate: editForm.orderDate || null, supplyDate: editForm.supplyDate || null, notes: editForm.notes || null }),
    });
    setEditId(null); onMutate();
  };

  const handleDelete = async (orderId: string) => {
    if (!confirm('이 차수를 삭제합니다.')) return;
    await fetch(`/api/sites/${siteId}/production`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId }) });
    onMutate();
  };

  const startEdit = (o: any) => {
    setEditId(o.id);
    setEditForm({ quantity: o.quantity ? String(Number(o.quantity)) : '', orderDate: o.orderDate ? new Date(o.orderDate).toISOString().split('T')[0] : '', supplyDate: o.supplyDate ? new Date(o.supplyDate).toISOString().split('T')[0] : '', notes: o.notes || '' });
  };

  const totalQty = orders.reduce((s, o) => s + Number(o.quantity ?? 0), 0);

  return (
    <div className="rounded-xl border border-gray-800 bg-black/20 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <p className="text-xs font-semibold text-gray-400">생산 발주 차수</p>
        {canManage && (
          <button className="btn btn-ghost btn-xs gap-1" onClick={() => setShowForm(!showForm)}>
            <PlusIcon className="h-3.5 w-3.5" />{showForm ? '취소' : '차수 추가'}
          </button>
        )}
      </div>

      {showForm && (
        <div className="border-b border-gray-800 p-4 bg-gray-900/30">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <label className="block text-[10px] text-gray-500 mb-1">물량 (m²)</label>
              <input className="input input-bordered input-xs w-full" placeholder="예: 1,200"
                value={form.quantity ? Number(parseNum(form.quantity)).toLocaleString('ko-KR') : ''}
                onChange={(e) => setForm({ ...form, quantity: e.target.value.replace(/,/g, '') })} />
            </div>
            <div>
              <label className="block text-[10px] text-gray-500 mb-1">발주일</label>
              <input type="date" className="input input-bordered input-xs w-full" value={form.orderDate} onChange={(e) => setForm({ ...form, orderDate: e.target.value })} />
            </div>
            <div>
              <label className="block text-[10px] text-gray-500 mb-1">공급일</label>
              <input type="date" className="input input-bordered input-xs w-full" value={form.supplyDate} onChange={(e) => setForm({ ...form, supplyDate: e.target.value })} />
            </div>
            <div>
              <label className="block text-[10px] text-gray-500 mb-1">메모</label>
              <input className="input input-bordered input-xs w-full" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end mt-3">
            <button className={`btn btn-primary btn-xs ${submitting ? 'loading' : ''}`} disabled={submitting} onClick={handleAdd}>저장</button>
          </div>
        </div>
      )}

      {/* PC 테이블 */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-800 text-gray-500">
              {['차수','물량 (m²)','발주일','공급일','경과일','메모'].map((h, i) => (
                <th key={h} className={`px-4 py-2 font-medium ${i === 1 ? 'text-right' : i === 2 || i === 3 || i === 4 ? 'text-center' : 'text-left'}`}>{h}</th>
              ))}
              {canManage && <th className="px-4 py-2 w-20" />}
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr><td colSpan={canManage ? 7 : 6} className="px-4 py-8 text-center text-gray-600">등록된 차수가 없습니다.</td></tr>
            ) : orders.map((o) => {
              const days = elapsedDays(o.supplyDate);
              const isEditing = editId === o.id;
              return (
                <tr key={o.id} className="border-b border-gray-800/50 hover:bg-gray-800/20">
                  {isEditing ? (
                    <>
                      <td className="px-4 py-2 font-bold text-gray-300">{o.sequence}차</td>
                      <td className="px-4 py-2"><input className="input input-bordered input-xs w-28 text-right" value={editForm.quantity ? Number(parseNum(editForm.quantity)).toLocaleString('ko-KR') : ''} onChange={(e) => setEditForm({ ...editForm, quantity: e.target.value.replace(/,/g, '') })} /></td>
                      <td className="px-4 py-2"><input type="date" className="input input-bordered input-xs w-full" value={editForm.orderDate} onChange={(e) => setEditForm({ ...editForm, orderDate: e.target.value })} /></td>
                      <td className="px-4 py-2"><input type="date" className="input input-bordered input-xs w-full" value={editForm.supplyDate} onChange={(e) => setEditForm({ ...editForm, supplyDate: e.target.value })} /></td>
                      <td className="px-4 py-2 text-center text-gray-600">-</td>
                      <td className="px-4 py-2"><input className="input input-bordered input-xs w-full" value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} /></td>
                      <td className="px-4 py-2"><div className="flex gap-1"><button className="btn btn-xs btn-primary" onClick={() => handleEdit(o.id)}>저장</button><button className="btn btn-xs btn-ghost" onClick={() => setEditId(null)}>취소</button></div></td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-2 font-bold text-gray-300">{o.sequence}차</td>
                      <td className="px-4 py-2 text-right text-gray-200">{fmt(o.quantity)}</td>
                      <td className="px-4 py-2 text-center text-gray-400">{fmtDate(o.orderDate) || '-'}</td>
                      <td className={`px-4 py-2 text-center font-medium ${o.supplyDate ? 'text-green-400' : 'text-gray-600'}`}>{fmtDate(o.supplyDate) || '미입고'}</td>
                      <td className="px-4 py-2 text-center text-gray-500">{days !== null ? `${days}일` : '-'}</td>
                      <td className="px-4 py-2 text-gray-500">{o.notes || '-'}</td>
                      {canManage && (
                        <td className="px-4 py-2">
                          <div className="flex gap-1">
                            <button className="btn btn-ghost btn-xs" onClick={() => startEdit(o)}><PencilIcon className="h-3 w-3" /></button>
                            <button className="btn btn-ghost btn-xs text-error" onClick={() => handleDelete(o.id)}><TrashIcon className="h-3 w-3" /></button>
                          </div>
                        </td>
                      )}
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
          {orders.length > 0 && (
            <tfoot>
              <tr className="border-t border-gray-700 bg-gray-900/30">
                <td className="px-4 py-2 text-xs text-gray-500 font-medium">합계</td>
                <td className="px-4 py-2 text-right text-xs font-bold text-gray-200">{totalQty.toLocaleString('ko-KR')}</td>
                <td colSpan={canManage ? 5 : 4} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* 모바일 */}
      <div className="sm:hidden divide-y divide-gray-800">
        {orders.length === 0 ? (
          <p className="px-4 py-6 text-center text-xs text-gray-600">등록된 차수가 없습니다.</p>
        ) : orders.map((o) => {
          const days = elapsedDays(o.supplyDate);
          return (
            <div key={o.id} className="px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-gray-300">{o.sequence}차</span>
                {canManage && (
                  <div className="flex gap-1">
                    <button className="btn btn-ghost btn-xs" onClick={() => startEdit(o)}><PencilIcon className="h-3 w-3" /></button>
                    <button className="btn btn-ghost btn-xs text-error" onClick={() => handleDelete(o.id)}><TrashIcon className="h-3 w-3" /></button>
                  </div>
                )}
              </div>
              {editId === o.id ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div><label className="block text-[10px] text-gray-500 mb-0.5">물량</label><input className="input input-bordered input-xs w-full" value={editForm.quantity ? Number(parseNum(editForm.quantity)).toLocaleString('ko-KR') : ''} onChange={(e) => setEditForm({ ...editForm, quantity: e.target.value.replace(/,/g, '') })} /></div>
                    <div><label className="block text-[10px] text-gray-500 mb-0.5">발주일</label><input type="date" className="input input-bordered input-xs w-full" value={editForm.orderDate} onChange={(e) => setEditForm({ ...editForm, orderDate: e.target.value })} /></div>
                    <div><label className="block text-[10px] text-gray-500 mb-0.5">공급일</label><input type="date" className="input input-bordered input-xs w-full" value={editForm.supplyDate} onChange={(e) => setEditForm({ ...editForm, supplyDate: e.target.value })} /></div>
                    <div><label className="block text-[10px] text-gray-500 mb-0.5">메모</label><input className="input input-bordered input-xs w-full" value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} /></div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button className="btn btn-primary btn-xs" onClick={() => handleEdit(o.id)}>저장</button>
                    <button className="btn btn-ghost btn-xs" onClick={() => setEditId(null)}>취소</button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  <span className="text-gray-500">물량: <span className="text-gray-200">{fmt(o.quantity)} m²</span></span>
                  <span className="text-gray-500">경과: <span className="text-gray-300">{days !== null ? `${days}일` : '-'}</span></span>
                  <span className="text-gray-500">발주일: <span className="text-gray-400">{fmtDate(o.orderDate) || '-'}</span></span>
                  <span className="text-gray-500">공급일: <span className={o.supplyDate ? 'text-green-400' : 'text-gray-600'}>{fmtDate(o.supplyDate) || '미입고'}</span></span>
                  {o.notes && <span className="col-span-2 text-gray-600">{o.notes}</span>}
                </div>
              )}
            </div>
          );
        })}
        {orders.length > 0 && (
          <div className="px-4 py-2 bg-gray-900/30 flex justify-between text-xs">
            <span className="text-gray-500">총 발주물량</span>
            <span className="font-bold text-gray-200">{totalQty.toLocaleString('ko-KR')} m²</span>
          </div>
        )}
      </div>
    </div>
  );
}
