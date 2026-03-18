/* eslint-disable i18next/no-literal-string */
import { useState, useMemo } from 'react';
import useSWR from 'swr';
import fetcher from '@/lib/fetcher';
import { PlusIcon, TrashIcon, PencilIcon, CheckIcon, XMarkIcon, TruckIcon } from '@heroicons/react/24/outline';

const fmt = (v: any) => {
  const n = Number(String(v ?? '').replace(/[^0-9.-]/g, ''));
  return isFinite(n) && v !== '' && v !== null && v !== undefined ? n.toLocaleString('ko-KR') : '-';
};
const fmtDate = (v: any) => {
  if (!v) return '';
  const d = new Date(v);
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' });
};
const fmtDateFull = (v: any) => {
  if (!v) return '';
  const d = new Date(v);
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('ko-KR');
};
const parseNum = (v: string) => v.replace(/,/g, '');
const elapsedDays = (date: string | null) => {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
};

// 출하 상태 → 색상
const SHIP_STATUS_COLOR: Record<string, string> = {
  '인수완료': 'text-green-400 bg-green-900/30 border-green-700/50',
  '현장도착': 'text-blue-400 bg-blue-900/30 border-blue-700/50',
  '출발': 'text-yellow-400 bg-yellow-900/20 border-yellow-700/40',
  '상차완료': 'text-orange-400 bg-orange-900/20 border-orange-700/40',
  '출하예정': 'text-gray-400 bg-gray-800/30 border-gray-700/40',
  '반송': 'text-red-400 bg-red-900/30 border-red-700/50',
  '취소': 'text-gray-600 bg-gray-900/20 border-gray-800',
};

export default function ProductionProgressPanel({
  site,
  canManage,
  onMutate,
}: { site: any; canManage: boolean; onMutate: () => void }) {
  const siteId = site?.id;
  const { data: ordersData, mutate: mutateOrders } = useSWR(
    siteId ? `/api/sites/${siteId}/production` : null,
    fetcher,
    { refreshInterval: 30000 }
  );
  const orders: any[] = ordersData?.data || [];
  const shipments: any[] = site?.shipments || [];

  // 계약 기준 물량
  const contract = site?.contracts?.find((c: any) => !c.isAdditional);
  const contractQty = Number(contract?.quantity ?? site?.contractQuantity ?? 0);

  // 발주 합계
  const orderedQty = useMemo(() => orders.reduce((s, o) => s + Number(o.quantity ?? 0), 0), [orders]);
  // 출하 합계 (인수완료 기준)
  const shippedQty = useMemo(
    () => shipments.reduce((s, r) => s + Number(r.quantity ?? 0), 0),
    [shipments]
  );
  const remainQty = contractQty - orderedQty;

  // 공정률 (출하 기준)
  const progressRate = contractQty > 0 ? Math.min(100, Math.round((shippedQty / contractQty) * 100)) : 0;
  const progressColor =
    progressRate >= 100 ? 'bg-gradient-to-r from-blue-700 to-blue-400' :
    progressRate >= 60  ? 'bg-gradient-to-r from-green-700 to-green-400' :
    progressRate >= 30  ? 'bg-gradient-to-r from-yellow-700 to-yellow-400' :
                          'bg-gradient-to-r from-gray-700 to-gray-500';
  const progressText =
    progressRate >= 100 ? 'text-blue-400' :
    progressRate >= 60  ? 'text-green-400' :
    progressRate >= 30  ? 'text-yellow-400' : 'text-gray-400';

  // 차수별 출하 연계 (sequence 매칭)
  const shipBySeq = useMemo(() => {
    const m: Record<number, any[]> = {};
    shipments.forEach(s => {
      if (!m[s.sequence]) m[s.sequence] = [];
      m[s.sequence].push(s);
    });
    return m;
  }, [shipments]);

  return (
    <div className="space-y-4">

      {/* 요약 지표 */}
      <div className="grid grid-cols-4 gap-2">
        <div className="rounded-xl border border-gray-800 bg-black/20 p-3 text-center">
          <p className="text-[10px] text-gray-500 mb-1">계약물량</p>
          <p className="text-sm font-bold text-white">{contractQty > 0 ? `${contractQty.toLocaleString('ko-KR')}` : '-'}</p>
          {contractQty > 0 && <p className="text-[10px] text-gray-600">m²</p>}
        </div>
        <div className="rounded-xl border border-blue-900/50 bg-blue-950/15 p-3 text-center">
          <p className="text-[10px] text-gray-500 mb-1">발주물량</p>
          <p className="text-sm font-bold text-blue-300">{orderedQty > 0 ? orderedQty.toLocaleString('ko-KR') : '-'}</p>
          {orderedQty > 0 && <p className="text-[10px] text-gray-600">m²</p>}
        </div>
        <div className="rounded-xl border border-green-900/50 bg-green-950/15 p-3 text-center">
          <p className="text-[10px] text-gray-500 mb-1">출하물량</p>
          <p className="text-sm font-bold text-green-400">{shippedQty > 0 ? shippedQty.toLocaleString('ko-KR') : '-'}</p>
          {shippedQty > 0 && <p className="text-[10px] text-gray-600">m²</p>}
        </div>
        <div className={`rounded-xl border p-3 text-center ${
          remainQty === 0 ? 'border-gray-800 bg-black/20' :
          remainQty > 0 ? 'border-orange-900/40 bg-orange-950/10' :
          'border-red-900/40 bg-red-950/10'
        }`}>
          <p className="text-[10px] text-gray-500 mb-1">잔여</p>
          <p className={`text-sm font-bold ${remainQty > 0 ? 'text-orange-400' : remainQty < 0 ? 'text-red-400' : 'text-gray-500'}`}>
            {contractQty > 0 ? `${remainQty >= 0 ? '' : ''}${remainQty.toLocaleString('ko-KR')}` : '-'}
          </p>
          {contractQty > 0 && <p className="text-[10px] text-gray-600">m²</p>}
        </div>
      </div>

      {/* 출하 공정률 바 */}
      <div className="rounded-xl border border-gray-800 bg-black/20 p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-gray-500">출하 공정률</span>
          <span className={`text-2xl font-extrabold tabular-nums ${progressText}`}>{progressRate}%</span>
        </div>
        <div className="relative h-3 w-full overflow-hidden rounded-full bg-gray-800/80">
          <div className={`h-full rounded-full transition-all duration-700 ${progressColor}`}
            style={{ width: `${progressRate}%` }} />
          {[25, 50, 75].map(p => (
            <div key={p} className="absolute top-0 h-full w-px bg-gray-700/50" style={{ left: `${p}%` }} />
          ))}
        </div>
        <div className="flex justify-between text-[10px] text-gray-700 mt-1">
          <span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span>
        </div>
      </div>

      {/* 생산 발주 차수 + 출하 연계 테이블 */}
      <ProductionOrderTable
        siteId={siteId}
        orders={orders}
        shipBySeq={shipBySeq}
        canManage={canManage}
        onMutate={mutateOrders}
        onSiteMutate={onMutate}
      />
    </div>
  );
}

function ProductionOrderTable({
  siteId, orders, shipBySeq, canManage, onMutate, onSiteMutate,
}: {
  siteId: string; orders: any[]; shipBySeq: Record<number, any[]>;
  canManage: boolean; onMutate: () => void; onSiteMutate: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ quantity: '', orderDate: '', supplyDate: '', notes: '' });
  const [submitting, setSubmitting] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [expandedSeq, setExpandedSeq] = useState<number | null>(null);

  const handleAdd = async () => {
    setSubmitting(true);
    await fetch(`/api/sites/${siteId}/production`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quantity: form.quantity ? Number(parseNum(form.quantity)) : null,
        orderDate: form.orderDate || null,
        supplyDate: form.supplyDate || null,
        notes: form.notes || null,
      }),
    });
    setForm({ quantity: '', orderDate: '', supplyDate: '', notes: '' });
    setShowForm(false); setSubmitting(false); onMutate(); onSiteMutate();
  };

  const handleEdit = async (orderId: string) => {
    await fetch(`/api/sites/${siteId}/production`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId,
        quantity: editForm.quantity ? Number(parseNum(editForm.quantity)) : null,
        orderDate: editForm.orderDate || null,
        supplyDate: editForm.supplyDate || null,
        notes: editForm.notes || null,
      }),
    });
    setEditId(null); onMutate(); onSiteMutate();
  };

  const handleDelete = async (orderId: string) => {
    if (!confirm('이 차수를 삭제합니다.')) return;
    await fetch(`/api/sites/${siteId}/production`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId }),
    });
    onMutate(); onSiteMutate();
  };

  const startEdit = (o: any) => {
    setEditId(o.id);
    setEditForm({
      quantity: o.quantity ? String(Number(o.quantity)) : '',
      orderDate: o.orderDate ? new Date(o.orderDate).toISOString().split('T')[0] : '',
      supplyDate: o.supplyDate ? new Date(o.supplyDate).toISOString().split('T')[0] : '',
      notes: o.notes || '',
    });
  };

  const totalOrdered = orders.reduce((s, o) => s + Number(o.quantity ?? 0), 0);

  return (
    <div className="rounded-xl border border-gray-800 bg-black/20 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <div>
          <p className="text-xs font-semibold text-gray-300">생산 발주 차수</p>
          <p className="text-[10px] text-gray-600 mt-0.5">출하 등록 시 해당 차수 공급일 자동 연동</p>
        </div>
        {canManage && (
          <button className="btn btn-ghost btn-xs gap-1" onClick={() => setShowForm(!showForm)}>
            <PlusIcon className="h-3.5 w-3.5" />{showForm ? '취소' : '차수 추가'}
          </button>
        )}
      </div>

      {/* 추가 폼 */}
      {showForm && (
        <div className="border-b border-gray-800 p-4 bg-gray-900/30">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <label className="block text-[10px] text-gray-500 mb-1">물량 (m²)</label>
              <input className="input input-bordered input-xs w-full" placeholder="예: 1,200"
                value={form.quantity ? Number(parseNum(form.quantity)).toLocaleString('ko-KR') : ''}
                onChange={e => setForm({ ...form, quantity: e.target.value.replace(/,/g, '') })} />
            </div>
            <div>
              <label className="block text-[10px] text-gray-500 mb-1">발주일</label>
              <input type="date" className="input input-bordered input-xs w-full"
                value={form.orderDate} onChange={e => setForm({ ...form, orderDate: e.target.value })} />
            </div>
            <div>
              <label className="block text-[10px] text-gray-500 mb-1">공급예정일</label>
              <input type="date" className="input input-bordered input-xs w-full"
                value={form.supplyDate} onChange={e => setForm({ ...form, supplyDate: e.target.value })} />
            </div>
            <div>
              <label className="block text-[10px] text-gray-500 mb-1">메모</label>
              <input className="input input-bordered input-xs w-full"
                value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end mt-3">
            <button className={`btn btn-primary btn-xs ${submitting ? 'loading' : ''}`}
              disabled={submitting} onClick={handleAdd}>저장</button>
          </div>
        </div>
      )}

      {/* 차수 목록 */}
      {orders.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-gray-600">등록된 차수가 없습니다.</p>
      ) : (
        <div className="divide-y divide-gray-800/60">
          {orders.map(o => {
            const linked = shipBySeq[o.sequence] || [];
            const hasShip = linked.length > 0;
            const mainShip = linked[0];
            const isEditing = editId === o.id;
            const isExpanded = expandedSeq === o.sequence;
            const daysSinceOrder = elapsedDays(o.orderDate);

            return (
              <div key={o.id}>
                {/* 차수 행 */}
                <div className={`px-4 py-3 ${hasShip ? 'bg-green-950/5' : ''}`}>
                  {isEditing ? (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <div>
                          <label className="block text-[10px] text-gray-500 mb-1">물량 (m²)</label>
                          <input className="input input-bordered input-xs w-full"
                            value={editForm.quantity ? Number(parseNum(editForm.quantity)).toLocaleString('ko-KR') : ''}
                            onChange={e => setEditForm({ ...editForm, quantity: e.target.value.replace(/,/g, '') })} />
                        </div>
                        <div>
                          <label className="block text-[10px] text-gray-500 mb-1">발주일</label>
                          <input type="date" className="input input-bordered input-xs w-full"
                            value={editForm.orderDate} onChange={e => setEditForm({ ...editForm, orderDate: e.target.value })} />
                        </div>
                        <div>
                          <label className="block text-[10px] text-gray-500 mb-1">공급일</label>
                          <input type="date" className="input input-bordered input-xs w-full"
                            value={editForm.supplyDate} onChange={e => setEditForm({ ...editForm, supplyDate: e.target.value })} />
                        </div>
                        <div>
                          <label className="block text-[10px] text-gray-500 mb-1">메모</label>
                          <input className="input input-bordered input-xs w-full"
                            value={editForm.notes} onChange={e => setEditForm({ ...editForm, notes: e.target.value })} />
                        </div>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <button className="btn btn-primary btn-xs" onClick={() => handleEdit(o.id)}>저장</button>
                        <button className="btn btn-ghost btn-xs" onClick={() => setEditId(null)}>취소</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      {/* 차수 번호 */}
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                        hasShip ? 'bg-green-900/40 text-green-400 border border-green-700/50' :
                        'bg-gray-800 text-gray-400 border border-gray-700'
                      }`}>
                        {o.sequence}
                      </div>

                      {/* 발주 정보 */}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
                          <span className="font-bold text-gray-200">{fmt(o.quantity)} m²</span>
                          {o.orderDate && (
                            <span className="text-gray-500">발주: {fmtDate(o.orderDate)}</span>
                          )}
                          {o.supplyDate ? (
                            <span className="text-green-400">공급: {fmtDate(o.supplyDate)}</span>
                          ) : (
                            <span className="text-gray-600">공급예정 미입력</span>
                          )}
                          {daysSinceOrder !== null && (
                            <span className="text-gray-600">경과 {daysSinceOrder}일</span>
                          )}
                          {o.notes && <span className="text-gray-500 truncate">{o.notes}</span>}
                        </div>

                        {/* 연계 출하 요약 */}
                        {hasShip && (
                          <button
                            onClick={() => setExpandedSeq(isExpanded ? null : o.sequence)}
                            className="mt-1 flex items-center gap-1.5 text-[11px] text-green-400 hover:text-green-300"
                          >
                            <TruckIcon className="w-3 h-3" />
                            {linked.length}차 출하 연계됨
                            {mainShip?.status && (
                              <span className={`px-1.5 py-0.5 rounded border text-[10px] ${SHIP_STATUS_COLOR[mainShip.status] || 'text-gray-400 border-gray-700'}`}>
                                {mainShip.status}
                              </span>
                            )}
                            <span className="text-gray-600">{isExpanded ? '▲' : '▼'}</span>
                          </button>
                        )}
                      </div>

                      {/* 관리 버튼 */}
                      {canManage && (
                        <div className="flex gap-1 shrink-0">
                          <button className="btn btn-ghost btn-xs" onClick={() => startEdit(o)}>
                            <PencilIcon className="h-3 w-3" />
                          </button>
                          <button className="btn btn-ghost btn-xs text-error" onClick={() => handleDelete(o.id)}>
                            <TrashIcon className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 연계 출하 상세 (접이식) */}
                {isExpanded && linked.length > 0 && (
                  <div className="px-4 pb-3 bg-green-950/5 border-t border-green-900/20">
                    <div className="ml-11 space-y-1.5 mt-2">
                      {linked.map(ship => (
                        <div key={ship.id} className="flex items-center gap-3 text-xs rounded-lg bg-black/20 border border-gray-800 px-3 py-2">
                          <TruckIcon className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                          <span className={`px-1.5 py-0.5 rounded border text-[10px] font-medium ${SHIP_STATUS_COLOR[ship.status] || 'text-gray-400 border-gray-700'}`}>
                            {ship.status}
                          </span>
                          <span className="text-gray-400">{ship.quantity ? `${fmt(ship.quantity)} m²` : '-'}</span>
                          {ship.shippedAt && <span className="text-gray-500">출고: {fmtDate(ship.shippedAt)}</span>}
                          {ship.vehicleInfo && <span className="text-gray-600 truncate">{ship.vehicleInfo}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* 합계 행 */}
          <div className="px-4 py-2.5 bg-gray-900/30 flex justify-between text-xs">
            <span className="text-gray-500">총 발주물량</span>
            <span className="font-bold text-gray-200">{totalOrdered.toLocaleString('ko-KR')} m²</span>
          </div>
        </div>
      )}
    </div>
  );
}
