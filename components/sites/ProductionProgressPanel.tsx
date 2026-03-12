/* eslint-disable i18next/no-literal-string */
import { useMemo, useState, type ReactNode } from 'react';
import { Button } from 'react-daisyui';
import { computeOverallProgress, getLabeledValue, toNumber, upsertLabeledValue } from '@/lib/site-progress';

export default function ProductionProgressPanel({ siteId, site, canManage, onMutate }: any) {
  const quantity = getLabeledValue(site.description, '물량');
  const contractQty = toNumber(quantity);
  const shippedQty = Array.isArray(site.shipments)
    ? site.shipments.reduce((sum: number, item: any) => sum + toNumber(item.quantity), 0)
    : 0;
  const panelRate = contractQty > 0 ? Math.min(100, Math.round((shippedQty / contractQty) * 100)) : 0;
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pipeRate, setPipeRate] = useState(getLabeledValue(site.description, '하지파이프 진행률') || '0');
  const [caulkingRate, setCaulkingRate] = useState(getLabeledValue(site.description, '코킹작업 진행률') || '0');
  const [startDocsDone, setStartDocsDone] = useState(getLabeledValue(site.description, '착수서류 완료') === 'Y');
  const [finishDocsDone, setFinishDocsDone] = useState(getLabeledValue(site.description, '준공서류 완료') === 'Y');

  const overall = useMemo(() => computeOverallProgress({
    pipeRate: toNumber(pipeRate),
    panelRate,
    caulkingRate: toNumber(caulkingRate),
    startDocsDone,
    finishDocsDone,
  }), [pipeRate, panelRate, caulkingRate, startDocsDone, finishDocsDone]);

  const handleSave = async () => {
    setSaving(true);
    let nextDescription = site.description || '';
    nextDescription = upsertLabeledValue(nextDescription, '하지파이프 진행률', String(toNumber(pipeRate)));
    nextDescription = upsertLabeledValue(nextDescription, '판넬 입고 진행률', String(panelRate));
    nextDescription = upsertLabeledValue(nextDescription, '코킹작업 진행률', String(toNumber(caulkingRate)));
    nextDescription = upsertLabeledValue(nextDescription, '착수서류 완료', startDocsDone ? 'Y' : 'N');
    nextDescription = upsertLabeledValue(nextDescription, '준공서류 완료', finishDocsDone ? 'Y' : 'N');
    nextDescription = upsertLabeledValue(nextDescription, '최종 공정률', String(overall));

    await fetch(`/api/sites/${siteId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: nextDescription }),
    });
    setSaving(false);
    onMutate?.();
  };

  return (
    <div className="space-y-4">
      <button type="button" onClick={() => setOpen((prev) => !prev)} className="w-full rounded-2xl border border-gray-800 bg-black/10 p-5 text-left">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-gray-400">최종 공정률</p>
            <p className="mt-2 text-3xl font-bold">{overall}%</p>
          </div>
          <div className="w-full sm:w-56">
            <div className="h-2 overflow-hidden rounded-full bg-gray-800">
              <div className="h-full rounded-full bg-blue-600" style={{ width: `${overall}%` }} />
            </div>
            <p className="mt-2 text-xs text-gray-500">터치하면 세부 공정률을 펼칩니다.</p>
          </div>
        </div>
      </button>

      {open ? (
        <div className="rounded-2xl border border-gray-800 bg-black/10 p-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="하지파이프 진행률 (%)">
              <input type="number" className="input input-bordered w-full" value={pipeRate} onChange={(e) => setPipeRate(e.target.value)} disabled={!canManage} />
            </Field>
            <Field label="판넬 입고 진행률 (%) 자동계산">
              <input type="text" className="input input-bordered w-full" value={`${panelRate}  (출고 ${shippedQty} / 계약 ${contractQty || 0})`} disabled />
            </Field>
            <Field label="코킹작업 진행률 (%)">
              <input type="number" className="input input-bordered w-full" value={caulkingRate} onChange={(e) => setCaulkingRate(e.target.value)} disabled={!canManage} />
            </Field>
            <div className="rounded-xl border border-gray-800 p-4">
              <p className="text-sm text-gray-400">서류 체크</p>
              <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={startDocsDone} onChange={(e) => setStartDocsDone(e.target.checked)} disabled={!canManage} /> 착수서류 완료</label>
              <label className="mt-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={finishDocsDone} onChange={(e) => setFinishDocsDone(e.target.checked)} disabled={!canManage} /> 준공서류 완료</label>
            </div>
          </div>
          {canManage ? <div className="mt-4 flex justify-end"><Button color="primary" loading={saving} onClick={handleSave}>세부 공정률 저장</Button></div> : null}
        </div>
      ) : null}
    </div>
  );
}

const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <label className="form-control">
    <span className="mb-1 text-sm text-gray-300">{label}</span>
    {children}
  </label>
);
