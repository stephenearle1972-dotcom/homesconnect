export function toSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function normalizeWaNumber(raw: string): string {
  const d = String(raw || '').replace(/\D/g, '');
  if (d.startsWith('27') && d.length === 11) return d;
  if (d.startsWith('0') && d.length === 10) return '27' + d.slice(1);
  return d;
}

export function formatPhone(raw: string): string {
  const d = String(raw || '').replace(/\D/g, '');
  if (d.length === 10) return `${d.slice(0,3)} ${d.slice(3,6)} ${d.slice(6)}`;
  if (d.length === 11 && d.startsWith('27')) return `+27 ${d.slice(2,4)} ${d.slice(4,7)} ${d.slice(7)}`;
  return raw;
}
