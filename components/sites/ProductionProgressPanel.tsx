/* eslint-disable i18next/no-literal-string */
import { useEffect, useMemo, useState } from 'react';
import { Button } from 'react-daisyui';
import { buildProductionDescription, getFinalProgress, getPanelProgress } from '@/lib/site-progress';

const ProgressBar = ({ value }: { value: number }) => (
  <div className="h-2 w-full overflow-hidden rounded-full bg-gray-800">
    <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
  </div>
);

const RangeInput = ({ label, value, onChange, disabled }: { label: string; value: number; onChange: (v: number) => void; disabled?: boolean }) => (
  <div className="rounded-xl border border-gray-800 p-4">
    <div className="mb-2 flex items-center justify-between">
      <p className="text-sm text-gray-400">{label}</p>
      <span className="text-sm font-semibold">{value}%</span>
    </div>
    <input type="range" min={0} max={100} value={value} onChange={(e) => onChange(Number(e.target.value))} className="range range-sm" disabled={disabled} />
    <div className="mt-2"><ProgressBar value={value} /></div>
  </div>
);

const ScoreRow = ({ label, value }: { label: string; value: number }) => (
  <div>
    <div className="mb-1 flex items-center justify-between text-sm"><span>{label}</span><span>{value}%</span></div>
    <ProgressBar value={value} />
  </div>
);

export default function ProductionProgressPanel({ site, siteId, canManage, onMutate }: { site: any; siteId: string; canManage: boolean; onMutate: () => void; }) {
  const progress = useMemo(() => getFinalProgress(site), [site]);
  const panelData = useMemo(() => getPanelProgress(site), [site]);
  const [expanded, setExpanded] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    pipeRate: progress.pipeRate,
    caulkingRate: progress.caulkingRate,
    startDocsDone: progress.startDocsDone,
    finishDocsDone: progress.finishDocsDone,
  });

  useEffect(() => {
    setForm({
      pipeRate: progress.pipeRate,
      caulkingRate: progress.caulkingRate,
      startDocsDone: progress.startDocsDone,
      finishDocsDone: progress.finishDocsDone,
    });
  }, [progress.pipeRate, progress.caulkingRate, progress.startDocsDone, progress.finishDocsDone, siteId]);

  const previewFinal = Math.round((form.pipeRate + panelData.panelRate + form.caulkingRate + (form.startDocsDone ? 100 : 0) + (form.finishDocsDone ? 100 : 0)) / 5);

  const saveProgress = async () => {
    setSaving(true);
    const nextDescription = buildProductionDescription(site.description, form);
    await fetch(`/api/sites/${siteId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: nextDescription }),
    });
    setSaving(false);
    onMutate();
  };

  return (
    <div className="space-y-4">
      <button type="button" onClick={() => setExpanded((prev) => !prev)} className="w-full rounded-2xl border border-blue-900/40 bg-blue-950/20 p-4 text-left">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm text-blue-200">최종 공정률</p>
            <p className="mt-1 text-3xl font-bold text-white">{previewFinal}%</p>
          </div>
          <div className="w-full md:w-[260px]">
            <ProgressBar value={previewFinal} />
            <p className="mt-2 text-xs text-gray-300">카드를 누르면 세부 공정률을 펼칩니다.</p>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="rounded-2xl border border-gray-800 p-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <RangeInput label="하지파이프 진행률" value={form.pipeRate} onChange={(v) => setForm({ ...form, pipeRate: v })} disabled={!canManage} />
              <div className="rounded-xl border border-gray-800 p-4">
                <p className="text-sm text-gray-400">판넬 입고 진행률</p>
                <p className="mt-2 text-2xl font-bold">{panelData.panelRate}%</p>
                <p className="mt-2 text-xs text-gray-500">{panelData.shippedQty.toLocaleString()} / {panelData.contractQty.toLocaleString()}</p>
              </div>
              <RangeInput label="코킹작업 진행률" value={form.caulkingRate} onChange={(v) => setForm({ ...form, caulkingRate: v })} disabled={!canManage} />
              <div className="rounded-xl border border-gray-800 p-4">
                <p className="text-sm text-gray-400">서류 체크</p>
                <div className="mt-4 space-y-3">
                  <label className="flex items-center justify-between"><span>착수서류 완료</span><input type="checkbox" className="checkbox checkbox-sm" checked={form.startDocsDone} onChange={(e) => setForm({ ...form, startDocsDone: e.target.checked })} disabled={!canManage} /></label>
                  <label className="flex items-center justify-between"><span>준공서류 완료</span><input type="checkbox" className="checkbox checkbox-sm" checked={form.finishDocsDone} onChange={(e) => setForm({ ...form, finishDocsDone: e.target.checked })} disabled={!canManage} /></label>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-800 bg-black/20 p-4">
            <p className="text-sm text-gray-400">최종 공정률 구성</p>
            <div className="mt-3 space-y-3">
              <ScoreRow label="하지파이프" value={form.pipeRate} />
              <ScoreRow label="판넬 입고" value={panelData.panelRate} />
              <ScoreRow label="코킹" value={form.caulkingRate} />
              <ScoreRow label="착수서류" value={form.startDocsDone ? 100 : 0} />
              <ScoreRow label="준공서류" value={form.finishDocsDone ? 100 : 0} />
            </div>
            {canManage && <div className="mt-4 flex justify-end"><Button color="primary" size="sm" loading={saving} onClick={saveProgress}>세부 공정률 저장</Button></div>}
          </div>
        </div>
      )}
    </div>
  );
}
