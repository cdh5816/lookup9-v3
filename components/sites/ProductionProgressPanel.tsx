/* eslint-disable i18next/no-literal-string */
/*
 * AIRX (individual business) proprietary source.
 * Owner: AIRX / choe DONGHYUN. All rights reserved.
 */

import { ReactNode, useMemo, useState } from 'react';
import { Button } from 'react-daisyui';
import { getProductionMetrics, patchProductionDescription } from '@/lib/site-progress';

const ProgressBar = ({ value }: { value: number }) => (
  <div className="h-2 w-full overflow-hidden rounded-full bg-gray-800">
    <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${value}%` }} />
  </div>
);

export default function ProductionProgressPanel({
  site,
  canManage,
  onMutate,
}: {
  site: any;
  canManage: boolean;
  onMutate: () => void;
}) {
  const metrics = useMemo(() => getProductionMetrics(site?.description, site?.shipments), [site]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    orderedQty: metrics.orderedQty ? String(metrics.orderedQty) : '',
    orderDate: metrics.orderDate || '',
    shipDate: metrics.shipDate || '',
    pipeRate: String(metrics.pipeRate || 0),
    caulkingRate: String(metrics.caulkingRate || 0),
    startDocsDone: metrics.startDocsDone,
    completionDocsDone: metrics.completionDocsDone,
  });

  const save = async () => {
    setSaving(true);
    const description = patchProductionDescription(site?.description, {
      orderedQty: form.orderedQty,
      orderDate: form.orderDate,
      shipDate: form.shipDate,
      pipeRate: form.pipeRate,
      caulkingRate: form.caulkingRate,
      startDocsDone: form.startDocsDone,
      completionDocsDone: form.completionDocsDone,
    });

    await fetch(`/api/sites/${site.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description }),
    });
    setSaving(false);
    onMutate();
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-800 bg-black/20 p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm text-gray-400">최종 생산 공정률</p>
            <p className="mt-1 text-3xl font-bold">{metrics.finalProgress}%</p>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <MetaCard label="발주물량" value={metrics.orderedQty ? `${metrics.orderedQty.toLocaleString()}` : '-'} />
            <MetaCard label="출고누계" value={metrics.shippedQty ? `${metrics.shippedQty.toLocaleString()}` : '0'} />
            <MetaCard label="발주일" value={metrics.orderDate || '-'} />
            <MetaCard label="출고일" value={metrics.shipDate || '-'} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="rounded-2xl border border-gray-800 bg-black/20 p-4">
          <h3 className="mb-4 text-base font-semibold">세부 공정률</h3>
          <div className="space-y-4">
            <RateRow label="하지파이프 진행률" value={metrics.pipeRate} />
            <RateRow label="판넬 입고 진행률" value={metrics.panelRate} helper={`출고누계 ${metrics.shippedQty.toLocaleString()} / 발주물량 ${metrics.orderedQty.toLocaleString()}`} />
            <RateRow label="코킹작업 진행률" value={metrics.caulkingRate} />
            <CheckRow label="착수서류 완료" checked={metrics.startDocsDone} />
            <CheckRow label="준공서류 완료" checked={metrics.completionDocsDone} />
          </div>
        </div>

        <div className="rounded-2xl border border-gray-800 bg-black/20 p-4">
          <h3 className="mb-4 text-base font-semibold">생산 기준 입력</h3>
          <div className="grid grid-cols-1 gap-3">
            <Field label="발주물량">
              <input className="input input-bordered w-full" value={form.orderedQty} onChange={(e) => setForm({ ...form, orderedQty: e.target.value })} />
            </Field>
            <Field label="발주일">
              <input type="date" className="input input-bordered w-full" value={form.orderDate} onChange={(e) => setForm({ ...form, orderDate: e.target.value })} />
            </Field>
            <Field label="출고일">
              <input type="date" className="input input-bordered w-full" value={form.shipDate} onChange={(e) => setForm({ ...form, shipDate: e.target.value })} />
            </Field>
            <Field label="하지파이프 진행률">
              <input type="number" min="0" max="100" className="input input-bordered w-full" value={form.pipeRate} onChange={(e) => setForm({ ...form, pipeRate: e.target.value })} />
            </Field>
            <Field label="코킹작업 진행률">
              <input type="number" min="0" max="100" className="input input-bordered w-full" value={form.caulkingRate} onChange={(e) => setForm({ ...form, caulkingRate: e.target.value })} />
            </Field>
            <label className="flex items-center gap-2 rounded-xl border border-gray-800 px-3 py-3 text-sm">
              <input type="checkbox" className="checkbox checkbox-sm" checked={form.startDocsDone} onChange={(e) => setForm({ ...form, startDocsDone: e.target.checked })} />
              착수서류 완료
            </label>
            <label className="flex items-center gap-2 rounded-xl border border-gray-800 px-3 py-3 text-sm">
              <input type="checkbox" className="checkbox checkbox-sm" checked={form.completionDocsDone} onChange={(e) => setForm({ ...form, completionDocsDone: e.target.checked })} />
              준공서류 완료
            </label>
          </div>

          {canManage ? (
            <div className="mt-4 flex justify-end">
              <Button color="primary" loading={saving} onClick={save}>저장</Button>
            </div>
          ) : (
            <p className="mt-4 text-sm text-gray-500">관리 권한이 있는 계정만 수정할 수 있습니다.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function MetaCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/40 px-3 py-2">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-1 text-sm font-semibold break-words">{value}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm text-gray-400">{label}</span>
      {children}
    </label>
  );
}

function RateRow({ label, value, helper }: { label: string; value: number; helper?: string }) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-sm text-gray-300">{label}</span>
        <span className="text-sm font-semibold">{value}%</span>
      </div>
      <ProgressBar value={value} />
      {helper ? <p className="mt-2 break-words text-xs text-gray-500">{helper}</p> : null}
    </div>
  );
}

function CheckRow({ label, checked }: { label: string; checked: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-gray-800 bg-gray-900/40 px-3 py-3">
      <span className="text-sm text-gray-300">{label}</span>
      <span className={`badge ${checked ? 'badge-success' : 'badge-ghost'}`}>{checked ? '완료' : '미완료'}</span>
    </div>
  );
}
