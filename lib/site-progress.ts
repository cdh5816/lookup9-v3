/*
 * AIRX (individual business) proprietary source.
 * Owner: AIRX / choe DONGHYUN. All rights reserved.
 */

export const parseLabeledValue = (
  text: string | null | undefined,
  label: string
): string => {
  if (!text) return '';
  const escaped = label.replace(/[.*+?^${}()|[\]\]/g, '\\$&');
  const pattern = new RegExp(`${escaped}\\s*[:：]\\s*([^\\n\\r]+)`, 'i');
  const match = text.match(pattern);
  return match?.[1]?.trim() || '';
};

export const upsertLabeledValue = (
  text: string | null | undefined,
  label: string,
  value: string | number | boolean | null | undefined
): string => {
  const lines = String(text || '')
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);

  const normalized =
    typeof value === 'boolean' ? (value ? '완료' : '미완료') : String(value ?? '').trim();

  const escaped = label.replace(/[.*+?^${}()|[\]\]/g, '\\$&');
  const regex = new RegExp(`^${escaped}\\s*[:：]`, 'i');
  const filtered = lines.filter((line) => !regex.test(line.trim()));

  if (normalized) {
    filtered.push(`${label}: ${normalized}`);
  }

  return filtered.join('\n');
};

export const toNumber = (value: string | number | null | undefined): number => {
  if (value === null || value === undefined || value === '') return 0;
  const num = Number(String(value).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(num) ? num : 0;
};

export const clampPercent = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 100) return 100;
  return Math.round(value);
};

export const sumShipmentQuantity = (shipments: any[] | null | undefined): number => {
  if (!Array.isArray(shipments)) return 0;
  return shipments.reduce((sum, item) => {
    const qty = item?.quantity ?? item?.qty ?? item?.amount ?? item?.shippedQuantity ?? 0;
    return sum + toNumber(qty);
  }, 0);
};

export const getProductionMetrics = (
  description: string | null | undefined,
  shipments: any[] | null | undefined
) => {
  const orderedQty = toNumber(parseLabeledValue(description, '발주물량'));
  const orderDate = parseLabeledValue(description, '발주일');
  const shipDate = parseLabeledValue(description, '출고일');
  const pipeRate = clampPercent(toNumber(parseLabeledValue(description, '하지파이프 진행률')));
  const caulkingRate = clampPercent(toNumber(parseLabeledValue(description, '코킹작업 진행률')));
  const startDocsDone = parseLabeledValue(description, '착수서류 완료') === '완료';
  const completionDocsDone = parseLabeledValue(description, '준공서류 완료') === '완료';
  const shippedQty = sumShipmentQuantity(shipments);
  const panelRate = orderedQty > 0 ? clampPercent((shippedQty / orderedQty) * 100) : 0;
  const finalProgress = clampPercent(
    (pipeRate + panelRate + caulkingRate + (startDocsDone ? 100 : 0) + (completionDocsDone ? 100 : 0)) / 5
  );

  return {
    orderedQty,
    orderDate,
    shipDate,
    pipeRate,
    panelRate,
    caulkingRate,
    startDocsDone,
    completionDocsDone,
    shippedQty,
    finalProgress,
  };
};

export const patchProductionDescription = (
  description: string | null | undefined,
  payload: {
    orderedQty?: string | number;
    orderDate?: string;
    shipDate?: string;
    pipeRate?: string | number;
    caulkingRate?: string | number;
    startDocsDone?: boolean;
    completionDocsDone?: boolean;
  }
): string => {
  let next = String(description || '');
  if (payload.orderedQty !== undefined) next = upsertLabeledValue(next, '발주물량', payload.orderedQty);
  if (payload.orderDate !== undefined) next = upsertLabeledValue(next, '발주일', payload.orderDate);
  if (payload.shipDate !== undefined) next = upsertLabeledValue(next, '출고일', payload.shipDate);
  if (payload.pipeRate !== undefined) next = upsertLabeledValue(next, '하지파이프 진행률', payload.pipeRate);
  if (payload.caulkingRate !== undefined) next = upsertLabeledValue(next, '코킹작업 진행률', payload.caulkingRate);
  if (payload.startDocsDone !== undefined) next = upsertLabeledValue(next, '착수서류 완료', payload.startDocsDone);
  if (payload.completionDocsDone !== undefined) next = upsertLabeledValue(next, '준공서류 완료', payload.completionDocsDone);
  return next;
};
