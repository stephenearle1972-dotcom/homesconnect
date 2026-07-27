// HomesConnect — property calculator maths engine (pure functions, no React).
// Every rate/tariff/threshold is imported from src/config/propertyRates.ts —
// nothing here is a magic number.

import {
  TRANSFER_DUTY_BANDS,
  CONVEYANCING_FEE_BAND,
  BOND_REGISTRATION_BAND,
  DEEDS_OFFICE_ESTIMATE,
  SUNDRIES_ESTIMATE,
  BANK_INITIATION_FEE,
  VAT_RATE,
  type FeeBand,
} from '../config/propertyRates';

export type Range = { low: number; high: number };

// ---------------------------------------------------------------------------
// Bond repayment (annuity formula)
// ---------------------------------------------------------------------------

export function bondInstalment(loanAmount: number, ratePct: number, years: number): number {
  const L = Math.max(0, Number(loanAmount) || 0);
  const i = (Number(ratePct) || 0) / 100 / 12;
  const n = years * 12;
  if (n <= 0) return 0;
  if (i === 0) return L / n;
  return (L * i) / (1 - Math.pow(1 + i, -n));
}

export type BondRepaymentResult = {
  loanAmount: number;
  monthlyInstalment: number;
  totalRepaid: number;
  totalInterest: number;
};

export function calcBondRepayment(price: number, deposit: number, ratePct: number, years: number): BondRepaymentResult {
  const loanAmount = Math.max(0, (Number(price) || 0) - (Number(deposit) || 0));
  const monthlyInstalment = bondInstalment(loanAmount, ratePct, years);
  const totalRepaid = monthlyInstalment * years * 12;
  const totalInterest = Math.max(0, totalRepaid - loanAmount);
  return { loanAmount, monthlyInstalment, totalRepaid, totalInterest };
}

// "What if rates move" strip: -1%, current, +1%, +2%.
export function rateShiftStrip(loanAmount: number, ratePct: number, years: number): { deltaPct: number; instalment: number }[] {
  return [-1, 0, 1, 2].map((deltaPct) => ({
    deltaPct,
    instalment: bondInstalment(loanAmount, Math.max(0, ratePct + deltaPct), years),
  }));
}

// ---------------------------------------------------------------------------
// Affordability (two-test model — the LOWER of income-ratio and surplus)
// ---------------------------------------------------------------------------

export type AffordabilityInputs = {
  applicantIncome: number;
  coApplicantIncome: number;
  expenses: number;
  existingDebt: number;
  deposit: number;
  ratePct: number;
  years: number;
};

export type AffordabilityResult =
  | { approved: false; maxInstalmentA: number; maxInstalmentB: number }
  | {
      approved: true;
      binding: 'income' | 'expenses';
      maxInstalment: number;
      maxLoan: number;
      maxPurchasePrice: number;
    };

export function calcAffordability(inputs: AffordabilityInputs): AffordabilityResult {
  const grossTotal = (Number(inputs.applicantIncome) || 0) + (Number(inputs.coApplicantIncome) || 0);
  const maxInstalmentA = grossTotal * 0.3;
  const maxInstalmentB = grossTotal - (Number(inputs.expenses) || 0) - (Number(inputs.existingDebt) || 0);
  const maxInstalment = Math.min(maxInstalmentA, maxInstalmentB);

  if (maxInstalment <= 0) {
    return { approved: false, maxInstalmentA, maxInstalmentB };
  }

  const binding: 'income' | 'expenses' = maxInstalmentA <= maxInstalmentB ? 'income' : 'expenses';
  const i = (Number(inputs.ratePct) || 0) / 100 / 12;
  const n = inputs.years * 12;
  const loan = i === 0 ? maxInstalment * n : (maxInstalment * (1 - Math.pow(1 + i, -n))) / i;
  const maxPurchasePrice = loan + (Number(inputs.deposit) || 0);

  return { approved: true, binding, maxInstalment, maxLoan: loan, maxPurchasePrice };
}

// ---------------------------------------------------------------------------
// Cost of buying (transfer duty is exact; every other line is an estimate range)
// ---------------------------------------------------------------------------

export function transferDuty(price: number): number {
  const p = Math.max(0, Number(price) || 0);
  let band = TRANSFER_DUTY_BANDS[0];
  for (const b of TRANSFER_DUTY_BANDS) {
    if (p >= b.threshold) band = b;
    else break;
  }
  return band.base + band.rate * (p - band.threshold);
}

function rangeOf(base: number, band: FeeBand): Range {
  const b = Math.max(0, base);
  return { low: b * band.low, high: b * band.high };
}

function addVat(r: Range): Range {
  return { low: r.low * (1 + VAT_RATE), high: r.high * (1 + VAT_RATE) };
}

function sumRanges(...ranges: Range[]): Range {
  return ranges.reduce((acc, r) => ({ low: acc.low + r.low, high: acc.high + r.high }), { low: 0, high: 0 });
}

export type CostOfBuyingInputs = {
  price: number;
  bondAmount: number;
  isDeveloperSale: boolean;
};

export type CostOfBuyingResult = {
  transferDuty: number; // exact — the only exact figure on this page
  transferDutyIsZeroVat: boolean; // true when the developer-VAT toggle zeroed duty
  conveyancingFee: Range; // incl VAT
  deedsOfficeTransferFee: Range; // no VAT
  bondRegistrationFee: Range; // incl VAT, R0 if no bond
  bankInitiationFee: Range; // R0 if no bond
  sundries: Range;
  totalTransferCosts: Range;
  totalBondCosts: Range;
  cashPortionOfPrice: number; // price - bondAmount, i.e. the deposit/cash paid toward the price itself
  totalUpfrontCash: Range; // totalTransferCosts + totalBondCosts + sundries + cashPortionOfPrice
};

export function calcCostOfBuying({ price, bondAmount, isDeveloperSale }: CostOfBuyingInputs): CostOfBuyingResult {
  const p = Math.max(0, Number(price) || 0);
  const bond = Math.max(0, Number(bondAmount) || 0);
  const hasBond = bond > 0;

  const duty = isDeveloperSale ? 0 : transferDuty(p);
  const conveyancingFee = addVat(rangeOf(p, CONVEYANCING_FEE_BAND));
  const deedsOfficeTransferFee = DEEDS_OFFICE_ESTIMATE;
  const bondRegistrationFee = hasBond ? addVat(rangeOf(bond, BOND_REGISTRATION_BAND)) : { low: 0, high: 0 };
  const bankInitiationFee = hasBond ? BANK_INITIATION_FEE : { low: 0, high: 0 };
  const sundries = SUNDRIES_ESTIMATE;

  const totalTransferCosts = sumRanges({ low: duty, high: duty }, conveyancingFee, deedsOfficeTransferFee);
  const totalBondCosts = sumRanges(bondRegistrationFee, bankInitiationFee);
  const cashPortionOfPrice = Math.max(0, p - bond);
  const totalUpfrontCash = sumRanges(totalTransferCosts, totalBondCosts, sundries, {
    low: cashPortionOfPrice,
    high: cashPortionOfPrice,
  });

  return {
    transferDuty: duty,
    transferDutyIsZeroVat: isDeveloperSale,
    conveyancingFee,
    deedsOfficeTransferFee,
    bondRegistrationFee,
    bankInitiationFee,
    sundries,
    totalTransferCosts,
    totalBondCosts,
    cashPortionOfPrice,
    totalUpfrontCash,
  };
}
