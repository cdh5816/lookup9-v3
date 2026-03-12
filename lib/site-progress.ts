export const parseLabeledValue = (description: string | null | undefined, label: string) => {
  if (!description) return '';
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = description.match(new RegExp(`${escaped}\\s*[:：]\\s*([^\\n\\r]+)`, 'i'));
  return match?.[1]?.trim() || '';
};

export const toNumber = (value: string | number | null | undefined) => {
  const num = Number(String(value || '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(num) ? num : 0;
};

export const upsertLabeledValue = (description: string | null | undefined, label: string, value: string) => {
  const base = description || '';
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(^|\\n)${escaped}\\s*[:：]\\s*[^\\n\\r]*`, 'i');
  if (regex.test(base)) {
    return base.replace(regex, (_full, prefix) => `${prefix}${label}: ${value}`);
  }
  return [base.trim(), `${label}: ${value}`].filter(Boolean).join('\n');
};

export const buildProductionDescription = (
  description: string | null | undefined,
  values: { pipeRate: number; caulkingRate: number; startDocsDone: boolean; finishDocsDone: boolean }
) => {
  let next = description || '';
  next = upsertLabeledValue(next, '하지파이프 진행률', String(values.pipeRate));
  next = upsertLabeledValue(next, '코킹작업 진행률', String(values.caulkingRate));
  next = upsertLabeledValue(next, '착수서류 완료', values.startDocsDone ? 'Y' : 'N');
  next = upsertLabeledValue(next, '준공서류 완료', values.finishDocsDone ? 'Y' : 'N');
  return next;
};

export const getPanelProgress = (site: any) => {
  const contractQty = toNumber(parseLabeledValue(site?.description, '물량'));
  const shippedQty = (site?.shipments || []).reduce((sum: number, item: any) => sum + toNumber(item.quantity), 0);
  const panelRate = contractQty > 0 ? Math.max(0, Math.min(100, Math.round((shippedQty / contractQty) * 100))) : 0;
  return { contractQty, shippedQty, panelRate };
};

export const getFinalProgress = (site: any) => {
  const pipeRate = Math.max(0, Math.min(100, toNumber(parseLabeledValue(site?.description, '하지파이프 진행률'))));
  const caulkingRate = Math.max(0, Math.min(100, toNumber(parseLabeledValue(site?.description, '코킹작업 진행률'))));
  const startDocsDone = parseLabeledValue(site?.description, '착수서류 완료') === 'Y';
  const finishDocsDone = parseLabeledValue(site?.description, '준공서류 완료') === 'Y';
  const { panelRate } = getPanelProgress(site);
  const finalRate = Math.round((pipeRate + panelRate + caulkingRate + (startDocsDone ? 100 : 0) + (finishDocsDone ? 100 : 0)) / 5);
  return { pipeRate, panelRate, caulkingRate, startDocsDone, finishDocsDone, finalRate };
};
