/* eslint-disable i18next/no-literal-string */
import { useMemo, useState } from 'react';
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';
import { getProductionMetrics, patchProductionDescription } from '@/lib/site-progress';

const ProgressBar = ({ value, color = 'bg-blue-600' }: { value: number; color?: string }) => (
  <div className="h-2 w-full overflow-hidden rounded-full bg-gray-800">
    <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${Math.min(value, 100)}%` }} />
  </div>
);

// 숫자 콤마 포맷
function formatNum(val: string | number | null | undefined) {
  const n = Number(String(val || '').replace(/[^0-9.-]/g, ''));
  if (!n && n !== 0) return '';
  return n.toLocaleString('ko-KR');
}

function parseComma(val: string): string {
  return val.replace(/,/g, '');
}

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
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({
    orderedQty: metrics.orderedQty ? String(metrics.orderedQty) : '',
    orderDate: metrics.orderDate || '',
    pipeRate: String(metrics.pipeRate || 0),
    caulkingRate: String(metrics.caulkingRate || 0),
    startDocsDone: metrics.startDocsDone,
    completionDocsDone: metrics.completionDocsDone,
  });

  const save = async () => {
    setSaving(true);
    const description = patchProductionDescription(site?.description, {
      orderedQty: parseComma(form.orderedQty),
      orderDate: form.orderDate,
      pipeRate: form.pipeRate,
      caulkingRate: form.caulkingRate,
      startDocsDone: form.startDocsDone,
      completionDocsDone: form.completionDocsDone,
    });

    const res = await fetch(`/api/sites/${site.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description }),
    });

    setSaving(false);
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      onMutate();
    }
  };

  // 공정률별 색상
  const progressColor =
    metrics.finalProgress >= 80
      ? 'bg-green-500'
      : metrics.finalProgress >= 40
        ? 'bg-blue-600'
        : 'bg-yellow-500';

  const progressTextColor =
    metrics.finalProgress >= 80
      ? 'text-green-400'
      : metrics.finalProgress >= 40
        ? 'text-blue-400'
        : 'text-yellow-400';

  return (
    <div className="space-y-4">
      {/* ── 최종 공정률 카드 (클릭 시 세부 펼침) ── */}
      <button
        type="button"
        className="w-full text-left rounded-2xl border border-gray-800 bg-black/30 p-5 transition hover:border-gray-600 focus:outline-none"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 mb-1">최종 공정률</p>
            <p className={`text-5xl font-extrabold leading-none ${progressTextColor}`}>
              {metrics.finalProgress}%
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              {open ? <ChevronUpIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />}
              <span>{open ? '세부 접기' : '세부 보기'}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-right text-xs">
              <div>
                <p className="text-gray-500">발주물량</p>
                <p className="font-semibold text-gray-200">
                  {metrics.orderedQty ? metrics.orderedQty.toLocaleString() : '-'}
                </p>
              </div>
              <div>
                <p className="text-gray-500">출고누계</p>
                <p className="font-semibold text-gray-200">{metrics.shippedQty.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-4">
          <ProgressBar value={metrics.finalProgress} color={progressColor} />
        </div>
      </button>

      {/* ── 세부 공정률 (펼침) ── */}
      {open && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          {/* 왼쪽: 세부 항목 표시 */}
          <div className="rounded-2xl border border-gray-800 bg-black/20 p-5">
            <h3 className="mb-4 text-sm font-semibold text-gray-300">세부 공정률 현황</h3>
            <div className="space-y-3">
              <RateRow label="하지파이프 진행률" value={metrics.pipeRate} />
              <RateRow
                label="판넬 입고 진행률"
                value={metrics.panelRate}
                helper={
                  metrics.orderedQty > 0
                    ? `출고누계 ${metrics.shippedQty.toLocaleString()} / 발주물량 ${metrics.orderedQty.toLocaleString()}`
                    : '발주물량을 입력해야 계산됩니다.'
                }
              />
              <RateRow label="코킹작업 진행률" value={metrics.caulkingRate} />
              <div className="grid grid-cols-2 gap-3 pt-1">
                <CheckRow label="착수서류 완료" checked={metrics.startDocsDone} />
                <CheckRow label="준공서류 완료" checked={metrics.completionDocsDone} />
              </div>
            </div>
          </div>

          {/* 오른쪽: 입력 폼 */}
          {canManage && (
            <div className="rounded-2xl border border-gray-800 bg-black/20 p-5">
              <h3 className="mb-4 text-sm font-semibold text-gray-300">생산 기준 입력</h3>
              <div className="space-y-3">
                <Field label="발주물량">
                  <input
                    className="input input-bordered input-sm w-full"
                    placeholder="예: 1,200"
                    value={formatNum(form.orderedQty) || ''}
                    onChange={(e) => {
                      const raw = parseComma(e.target.value);
                      setForm({ ...form, orderedQty: raw });
                    }}
                  />
                </Field>
                <Field label="발주일">
                  <input
                    type="date"
                    className="input input-bordered input-sm w-full"
                    value={form.orderDate}
                    onChange={(e) => setForm({ ...form, orderDate: e.target.value })}
                  />
                </Field>
                <Field label="하지파이프 진행률 (%)">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    className="input input-bordered input-sm w-full"
                    value={form.pipeRate}
                    onChange={(e) => setForm({ ...form, pipeRate: e.target.value })}
                  />
                </Field>
                <Field label="코킹작업 진행률 (%)">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    className="input input-bordered input-sm w-full"
                    value={form.caulkingRate}
                    onChange={(e) => setForm({ ...form, caulkingRate: e.target.value })}
                  />
                </Field>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <label className="flex items-center gap-2 rounded-lg border border-gray-700 px-3 py-2 text-sm cursor-pointer hover:border-gray-500">
                    <input
                      type="checkbox"
                      className="checkbox checkbox-xs"
                      checked={form.startDocsDone}
                      onChange={(e) => setForm({ ...form, startDocsDone: e.target.checked })}
                    />
                    착수서류 완료
                  </label>
                  <label className="flex items-center gap-2 rounded-lg border border-gray-700 px-3 py-2 text-sm cursor-pointer hover:border-gray-500">
                    <input
                      type="checkbox"
                      className="checkbox checkbox-xs"
                      checked={form.completionDocsDone}
                      onChange={(e) => setForm({ ...form, completionDocsDone: e.target.checked })}
                    />
                    준공서류 완료
                  </label>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-end gap-2">
                {saved && <span className="text-xs text-green-400">저장되었습니다 ✓</span>}
                <button
                  className={`btn btn-primary btn-sm ${saving ? 'loading' : ''}`}
                  disabled={saving}
                  onClick={save}
                >
                  {saving ? '저장 중...' : '저장'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-gray-400">{label}</span>
      {children}
    </label>
  );
}

function RateRow({ label, value, helper }: { label: string; value: number; helper?: string }) {
  const color =
    value >= 80 ? 'bg-green-500' : value >= 40 ? 'bg-blue-600' : 'bg-yellow-500';
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/30 p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-sm text-gray-300">{label}</span>
        <span className="text-sm font-semibold text-gray-100">{value}%</span>
      </div>
      <ProgressBar value={value} color={color} />
      {helper && <p className="mt-1.5 break-words text-xs text-gray-500">{helper}</p>}
    </div>
  );
}

function CheckRow({ label, checked }: { label: string; checked: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-gray-800 bg-gray-900/30 px-3 py-3 gap-1">
      <span className="text-xs text-gray-400">{label}</span>
      <span
        className={`badge badge-sm ${checked ? 'badge-success' : 'badge-ghost text-gray-500'}`}
      >
        {checked ? '완료' : '미완료'}
      </span>
    </div>
  );
}
