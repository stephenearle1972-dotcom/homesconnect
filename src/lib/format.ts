// HomesConnect — South African rand formatting.
// Convention: "R2 299" — no space after the R, spaces (not commas) as the
// thousands separator. Rounds to the nearest whole rand.

export function formatRand(amount: number): string {
  const n = Math.round(Number(amount) || 0);
  const sign = n < 0 ? '-' : '';
  const grouped = Math.abs(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${sign}R${grouped}`;
}

// "R16 000 to R24 000" — for estimate bands. Never collapse a genuine range to
// a midpoint. The one exception: a band applied to a zero base (e.g. bond
// registration fee when there is no bond) is an exact R0, not an estimate —
// show it as a plain "R0" rather than the meaningless "R0 to R0".
export function formatRandRange(low: number, high: number): string {
  if (Math.round(low) === Math.round(high)) return formatRand(low);
  return `${formatRand(low)} to ${formatRand(high)}`;
}
