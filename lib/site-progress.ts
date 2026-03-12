export function getLabeledValue(text: string | null | undefined, label: string): string {
  if (!text) return '';
  const safe = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`${safe}\\s*[:：]\\s*([^\\n\\r]+)`, 'i');
  return text.match(regex)?.[1]?.trim() || '';
}

export function upsertLabeledValue(text: string | null | undefined, label: string, value: string): string {
  const base = text || '';
  const safe = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(^|\\n)${safe}\\s*[:：]\\s*([^\\n\\r]*)`, 'i');
  if (regex.test(base)) {
    return base.replace(regex, `$1${label}: ${value}`);
  }
  return `${base.trim()}${base?.trim() ? '\n' : ''}${label}: ${value}`;
}

export function toNumber(value: string | number | null | undefined): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (!value) return 0;
  const num = Number(String(value).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(num) ? num : 0;
}

export function computeOverallProgress(args: {
  pipeRate: number;
  panelRate: number;
  caulkingRate: number;
  startDocsDone: boolean;
  finishDocsDone: boolean;
}) {
  const docsStart = args.startDocsDone ? 100 : 0;
  const docsFinish = args.finishDocsDone ? 100 : 0;
  const avg = (args.pipeRate + args.panelRate + args.caulkingRate + docsStart + docsFinish) / 5;
  return Math.max(0, Math.min(100, Math.round(avg)));
}
