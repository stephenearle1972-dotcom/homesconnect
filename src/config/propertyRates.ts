// HomesConnect — property calculator rates, tariffs and thresholds.
// Every rate/tariff/threshold the calculators use lives HERE and nowhere else.
// No magic numbers in components.
//
// Two different kinds of figure below, and the UI must never blur the line:
//   1. TRANSFER_DUTY_BANDS — SARS-published, exact, one correct answer.
//   2. Everything else (conveyancing, bond registration, deeds office, bank fees) —
//      ESTIMATE RANGES. There is no reliable public bracket table for attorney
//      tariffs (published sources disagree by ~2x, and it is an open question
//      whether a "recommended" tariff still operates as such under the Legal
//      Practice Act 28 of 2014). Attorney fees are negotiable and firms quote
//      differently. Do NOT collapse these into single figures, and do NOT
//      research/hardcode a specific tariff table — Stephen supplies the real
//      brackets separately; when he does, only this file changes.

export const RATES_LAST_VERIFIED = '2026-07-27';

export type DutyBand = { threshold: number; base: number; rate: number };
export type FeeBand = { low: number; high: number };

// SARS transfer duty, 2026/27 tax year. VERIFIED — do not change without checking sars.gov.za
export const TRANSFER_DUTY_BANDS: DutyBand[] = [
  { threshold: 0, base: 0, rate: 0 },
  { threshold: 1210000, base: 0, rate: 0.03 },
  { threshold: 1663800, base: 13614, rate: 0.06 },
  { threshold: 2329300, base: 53544, rate: 0.08 },
  { threshold: 2994800, base: 106784, rate: 0.11 },
  { threshold: 13310000, base: 1241456, rate: 0.13 },
];

export const PRIME_RATE = 10.5; // SARB repo 7.00% + 3.50%, effective 28 May 2026
export const DEFAULT_TERM_YEARS = 20;
export const TERM_OPTIONS_YEARS = [20, 25, 30] as const;
export const VAT_RATE = 0.15;

// ESTIMATE RANGES, not exact figures — see file header. Expressed as a
// percentage-of-price (or price/bond) band, applied to give a LOW and HIGH estimate.
export const CONVEYANCING_FEE_BAND: FeeBand = { low: 0.007, high: 0.011 }; // of purchase price, excl VAT
export const BOND_REGISTRATION_BAND: FeeBand = { low: 0.007, high: 0.01 }; // of bond amount, excl VAT
export const DEEDS_OFFICE_ESTIMATE: FeeBand = { low: 800, high: 2200 }; // gazetted, scales with price band
export const SUNDRIES_ESTIMATE: FeeBand = { low: 1200, high: 2500 }; // FICA, postage, petties, searches
export const BANK_INITIATION_FEE: FeeBand = { low: 5500, high: 6500 }; // incl VAT, varies by bank
export const BANK_MONTHLY_ADMIN_FEE = 69; // typical, varies by bank
