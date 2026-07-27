import { useMemo, useState } from 'react';
import { calcAffordability, calcCostOfBuying } from '../../lib/calculators';
import { formatRand, formatRandRange } from '../../lib/format';
import { PRIME_RATE, DEFAULT_TERM_YEARS, TERM_OPTIONS_YEARS } from '../../config/propertyRates';
import { Section, NumberField, Field, StatCard, ToggleRow } from './CalcUI';
import LeadCaptureForm from './LeadCaptureForm';

// NOTE — data minimisation (per Stephen's decision, on top of the brief):
// applicantIncome / coApplicantIncome / expenses / existingDebt never leave
// this component. They are not passed into LeadCaptureForm's emailLines, and
// are not part of the payload posted to /.netlify/functions/calculator-lead.
// Only derived RESULTS (max instalment/loan/price, the binding-constraint
// sentence) and non-sensitive assumptions (deposit, rate, term) go out.

export default function AffordabilityTab() {
  // Raw string state — see BondRepaymentTab for why: '' must be a valid,
  // displayable value so the field can actually go empty on mobile.
  const [applicantIncomeRaw, setApplicantIncomeRaw] = useState('50000');
  const [coApplicantIncomeRaw, setCoApplicantIncomeRaw] = useState('');
  const [expensesRaw, setExpensesRaw] = useState('20000');
  const [existingDebtRaw, setExistingDebtRaw] = useState('5000');
  const [depositRaw, setDepositRaw] = useState('150000');
  const [rateRaw, setRateRaw] = useState(String(PRIME_RATE));
  const [years, setYears] = useState<number>(DEFAULT_TERM_YEARS);
  const [deductCosts, setDeductCosts] = useState(false);

  const applicantIncome = Number(applicantIncomeRaw) || 0;
  const coApplicantIncome = Number(coApplicantIncomeRaw) || 0;
  const expenses = Number(expensesRaw) || 0;
  const existingDebt = Number(existingDebtRaw) || 0;
  const deposit = Number(depositRaw) || 0;
  const rate = Number(rateRaw) || 0;
  const incomeEntered = applicantIncomeRaw !== '';

  const base = useMemo(
    () => calcAffordability({ applicantIncome, coApplicantIncome, expenses, existingDebt, deposit, ratePct: rate, years }),
    [applicantIncome, coApplicantIncome, expenses, existingDebt, deposit, rate, years]
  );

  const costs = useMemo(() => {
    if (!base.approved) return null;
    return calcCostOfBuying({ price: base.maxPurchasePrice, bondAmount: base.maxLoan, isDeveloperSale: false });
  }, [base]);

  const extraCash = costs
    ? {
        low: costs.totalTransferCosts.low + costs.totalBondCosts.low + costs.sundries.low,
        high: costs.totalTransferCosts.high + costs.totalBondCosts.high + costs.sundries.high,
      }
    : null;
  const midExtra = extraCash ? (extraCash.low + extraCash.high) / 2 : 0;

  const adjusted = useMemo(() => {
    if (!deductCosts || !base.approved) return null;
    const adjustedDeposit = Math.max(0, deposit - midExtra);
    return calcAffordability({
      applicantIncome,
      coApplicantIncome,
      expenses,
      existingDebt,
      deposit: adjustedDeposit,
      ratePct: rate,
      years,
    });
  }, [deductCosts, base, deposit, midExtra, applicantIncome, coApplicantIncome, expenses, existingDebt, rate, years]);

  const bindingSentence = base.approved
    ? base.binding === 'income'
      ? 'Your expenses support more, but your income is the limit.'
      : 'Your income supports more, but your expenses are the limit.'
    : '';

  const emailLines = base.approved
    ? [
        `Deposit available: ${formatRand(deposit)}`,
        `Interest rate: ${rate}%`,
        `Term: ${years} years`,
        ``,
        `Maximum purchase price: ${formatRand(base.maxPurchasePrice)}`,
        `Maximum loan amount: ${formatRand(base.maxLoan)}`,
        `Maximum monthly instalment: ${formatRand(base.maxInstalment)}`,
        bindingSentence,
        extraCash
          ? `Estimated transfer + bond costs on that price: ${formatRandRange(extraCash.low, extraCash.high)} (paid in cash, not added to the bond).`
          : '',
      ].filter(Boolean)
    : [`On the figures entered, a bond is unlikely to be approved on today's typical bank criteria.`];

  return (
    <div className="space-y-6">
      <Section title="Affordability">
        <div className="grid gap-4 md:grid-cols-2">
          <NumberField label="Gross monthly income" hint="applicant" value={applicantIncomeRaw} onChange={setApplicantIncomeRaw} />
          <NumberField
            label="Gross monthly income"
            hint="co-applicant, optional"
            value={coApplicantIncomeRaw}
            onChange={setCoApplicantIncomeRaw}
          />
          <NumberField label="Total monthly living expenses" value={expensesRaw} onChange={setExpensesRaw} />
          <NumberField label="Existing monthly debt repayments" value={existingDebtRaw} onChange={setExistingDebtRaw} />
          <NumberField label="Deposit available" value={depositRaw} onChange={setDepositRaw} />
          <NumberField label="Interest rate (%)" value={rateRaw} onChange={setRateRaw} allowDecimal />
          <Field label="Term">
            <select className="input" value={years} onChange={(e) => setYears(Number(e.target.value))}>
              {TERM_OPTIONS_YEARS.map((y) => (
                <option key={y} value={y}>
                  {y} years
                </option>
              ))}
            </select>
          </Field>
        </div>

        {!incomeEntered ? (
          <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-soft text-sm">Enter your gross monthly income to see what you can afford.</p>
          </div>
        ) : !base.approved ? (
          <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="font-display text-lg text-white">On these figures a bond is unlikely to be approved.</p>
            <p className="text-soft text-sm mt-2">
              Your income, expenses and debt leave no room for a monthly instalment on today's typical bank criteria.
            </p>
          </div>
        ) : (
          <>
            <div className="mt-6 grid gap-3 md:grid-cols-2">
              <StatCard label="Maximum purchase price" value={formatRand(base.maxPurchasePrice)} primary />
              <StatCard label="Maximum loan amount" value={formatRand(base.maxLoan)} />
              <StatCard label="Maximum monthly instalment" value={formatRand(base.maxInstalment)} />
            </div>
            <p className="text-soft text-sm mt-4">{bindingSentence}</p>

            {costs && extraCash && (
              <div className="mt-6 rounded-xl border border-gold/30 bg-gold/5 p-4">
                <p className="text-sm text-white">
                  On a {formatRand(base.maxPurchasePrice)} purchase, transfer duty, attorney and bond costs add roughly{' '}
                  <strong>{formatRandRange(extraCash.low, extraCash.high)}</strong> in cash on top of your deposit.
                </p>
                <p className="text-soft text-xs mt-2">
                  These costs are paid in cash and cannot normally be added to the bond — most buyers get this wrong. They
                  come out of your deposit.
                </p>
                <div className="mt-3">
                  <ToggleRow checked={deductCosts} onChange={setDeductCosts}>
                    Recalculate with these costs deducted from my deposit
                  </ToggleRow>
                </div>
                {deductCosts && (
                  <div className="mt-3 text-sm">
                    {adjusted?.approved ? (
                      <p className="text-white">
                        With an estimated {formatRand(midExtra)} of costs set aside first, your maximum purchase price is
                        closer to <strong className="text-gold-bright">{formatRand(adjusted.maxPurchasePrice)}</strong>.
                      </p>
                    ) : (
                      <p className="text-white">
                        Once these costs are set aside, there isn't enough deposit left to support a purchase on these
                        figures.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </Section>

      {incomeEntered && (
        <LeadCaptureForm
          calcType="affordability"
          headlineLabel="Maximum purchase price"
          headlineValue={base.approved ? formatRand(base.maxPurchasePrice) : 'Not currently affordable'}
          emailLines={emailLines}
          budget={base.approved ? base.maxPurchasePrice : 0}
        />
      )}
    </div>
  );
}
