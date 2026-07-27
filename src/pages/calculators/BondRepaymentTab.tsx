import { useMemo, useState } from 'react';
import { calcBondRepayment, rateShiftStrip } from '../../lib/calculators';
import { formatRand } from '../../lib/format';
import { PRIME_RATE, DEFAULT_TERM_YEARS, TERM_OPTIONS_YEARS, BANK_MONTHLY_ADMIN_FEE } from '../../config/propertyRates';
import { Section, Field, StatCard } from './CalcUI';
import LeadCaptureForm from './LeadCaptureForm';

export default function BondRepaymentTab() {
  const [price, setPrice] = useState(1500000);
  const [deposit, setDeposit] = useState(150000);
  const [rate, setRate] = useState(PRIME_RATE);
  const [years, setYears] = useState<number>(DEFAULT_TERM_YEARS);

  const depositPct = price > 0 ? (deposit / price) * 100 : 0;
  const result = useMemo(() => calcBondRepayment(price, deposit, rate, years), [price, deposit, rate, years]);
  const strip = useMemo(() => rateShiftStrip(result.loanAmount, rate, years), [result.loanAmount, rate, years]);

  const emailLines = [
    `Purchase price: ${formatRand(price)}`,
    `Deposit: ${formatRand(deposit)} (${depositPct.toFixed(1)}% of price)`,
    `Interest rate: ${rate}%`,
    `Term: ${years} years`,
    ``,
    `Loan amount: ${formatRand(result.loanAmount)}`,
    `Estimated monthly instalment: ${formatRand(result.monthlyInstalment)}`,
    `Bank monthly admin fee (estimate): ${formatRand(BANK_MONTHLY_ADMIN_FEE)}`,
    `Total repaid over the term: ${formatRand(result.totalRepaid)}`,
    `Total interest paid: ${formatRand(result.totalInterest)}`,
  ];

  return (
    <div className="space-y-6">
      <Section title="Bond repayment">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Purchase price">
            <input
              className="input"
              type="number"
              inputMode="numeric"
              min={0}
              value={price}
              onChange={(e) => setPrice(Number(e.target.value) || 0)}
            />
          </Field>
          <Field label="Deposit" hint={`${depositPct.toFixed(1)}% of price`}>
            <input
              className="input"
              type="number"
              inputMode="numeric"
              min={0}
              value={deposit}
              onChange={(e) => setDeposit(Number(e.target.value) || 0)}
            />
          </Field>
          <Field label="Interest rate (%)">
            <input
              className="input"
              type="number"
              inputMode="decimal"
              step={0.05}
              min={0}
              value={rate}
              onChange={(e) => setRate(Number(e.target.value) || 0)}
            />
          </Field>
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

        <div className="mt-6 grid gap-3 md:grid-cols-2">
          <StatCard label="Estimated monthly instalment" value={`${formatRand(result.monthlyInstalment)}/month`} primary />
          <StatCard label="Bank monthly admin fee (estimate)" value={`${formatRand(BANK_MONTHLY_ADMIN_FEE)}/month`} />
          <StatCard label="Loan amount" value={formatRand(result.loanAmount)} />
          <StatCard label="Total interest paid" value={formatRand(result.totalInterest)} />
          <StatCard label="Total repaid over term" value={formatRand(result.totalRepaid)} />
        </div>

        <div className="mt-6">
          <p className="text-xs uppercase tracking-[0.2em] text-faint mb-2">What if rates move?</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {strip.map((s) => (
              <div
                key={s.deltaPct}
                className={`rounded-lg border p-3 text-center ${
                  s.deltaPct === 0 ? 'border-teal-bright/50 bg-teal/10' : 'border-white/10 bg-white/5'
                }`}
              >
                <p className="text-faint text-xs">{s.deltaPct === 0 ? 'Current' : `${s.deltaPct > 0 ? '+' : ''}${s.deltaPct}%`}</p>
                <p className="text-white text-sm font-semibold mt-1">{formatRand(s.instalment)}</p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      <LeadCaptureForm
        calcType="bond-repayment"
        headlineLabel="Estimated monthly instalment"
        headlineValue={`${formatRand(result.monthlyInstalment)}/month`}
        emailLines={emailLines}
        budget={price}
      />
    </div>
  );
}
