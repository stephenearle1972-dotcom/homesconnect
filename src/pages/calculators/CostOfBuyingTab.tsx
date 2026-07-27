import { useMemo, useState } from 'react';
import { calcCostOfBuying } from '../../lib/calculators';
import { formatRand, formatRandRange } from '../../lib/format';
import { Section, Field, ToggleRow } from './CalcUI';
import LeadCaptureForm from './LeadCaptureForm';

export default function CostOfBuyingTab() {
  const [price, setPrice] = useState(1500000);
  // Defaults to an assumed 90% bond (10% deposit) — there is no separate
  // deposit field on this tab per the brief; edit the bond amount directly,
  // down to 0 for a cash purchase.
  const [bondAmount, setBondAmount] = useState(1350000);
  const [isDeveloperSale, setIsDeveloperSale] = useState(false);

  const r = useMemo(() => calcCostOfBuying({ price, bondAmount, isDeveloperSale }), [price, bondAmount, isDeveloperSale]);

  const emailLines = [
    `Purchase price: ${formatRand(price)}`,
    `Bond amount: ${formatRand(bondAmount)}`,
    isDeveloperSale ? `Buying from a VAT-registered developer: yes (no transfer duty payable — VAT is in the price)` : '',
    ``,
    `Transfer duty (exact, payable to SARS): ${formatRand(r.transferDuty)}`,
    `Transfer attorney fees (estimate): ${formatRandRange(r.conveyancingFee.low, r.conveyancingFee.high)}`,
    `Deeds Office fee — transfer (estimate): ${formatRandRange(r.deedsOfficeTransferFee.low, r.deedsOfficeTransferFee.high)}`,
    `Bond registration attorney fees (estimate): ${formatRandRange(r.bondRegistrationFee.low, r.bondRegistrationFee.high)}`,
    `Bank initiation fee (estimate): ${formatRandRange(r.bankInitiationFee.low, r.bankInitiationFee.high)}`,
    `Sundries, FICA, postage (estimate): ${formatRandRange(r.sundries.low, r.sundries.high)}`,
    ``,
    `Total transfer costs (estimate): ${formatRandRange(r.totalTransferCosts.low, r.totalTransferCosts.high)}`,
    `Total bond costs (estimate): ${formatRandRange(r.totalBondCosts.low, r.totalBondCosts.high)}`,
    `Total upfront cash required (estimate): ${formatRandRange(r.totalUpfrontCash.low, r.totalUpfrontCash.high)}`,
    ``,
    `Attorney fees are negotiable and vary between firms. Your conveyancer will quote you exactly.`,
  ].filter(Boolean);

  return (
    <div className="space-y-6">
      <Section title="Cost of buying">
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
          <Field label="Bond amount" hint="0 for a cash purchase">
            <input
              className="input"
              type="number"
              inputMode="numeric"
              min={0}
              value={bondAmount}
              onChange={(e) => setBondAmount(Number(e.target.value) || 0)}
            />
          </Field>
        </div>

        <div className="mt-4">
          <ToggleRow checked={isDeveloperSale} onChange={setIsDeveloperSale}>
            Buying from a VAT-registered developer?
          </ToggleRow>
          {isDeveloperSale && (
            <p className="text-soft text-xs mt-2 ml-8">
              VAT is included in the price, so no transfer duty is payable. Transfer duty and VAT are mutually exclusive.
            </p>
          )}
        </div>

        <div className="mt-6 rounded-xl border border-white/10 bg-white/5 divide-y divide-white/10">
          <LineRow label="Transfer duty" value={formatRand(r.transferDuty)} tag="payable to SARS — exact" />
          <LineRow label="Transfer attorney fees" value={formatRandRange(r.conveyancingFee.low, r.conveyancingFee.high)} tag="estimate" />
          <LineRow
            label="Deeds Office fee (transfer)"
            value={formatRandRange(r.deedsOfficeTransferFee.low, r.deedsOfficeTransferFee.high)}
            tag="estimate"
          />
          <LineRow
            label="Bond registration attorney fees"
            value={formatRandRange(r.bondRegistrationFee.low, r.bondRegistrationFee.high)}
            tag="estimate"
          />
          <LineRow label="Bank initiation fee" value={formatRandRange(r.bankInitiationFee.low, r.bankInitiationFee.high)} tag="estimate" />
          <LineRow label="Sundries, FICA, postage" value={formatRandRange(r.sundries.low, r.sundries.high)} tag="estimate" />
        </div>

        <p className="text-faint text-xs mt-3">
          Attorney fees are negotiable and vary between firms. Your conveyancer will quote you exactly.
        </p>

        <div className="mt-6 grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-faint mb-1">Total transfer costs</p>
            <p className="font-display text-lg text-white">approximately {formatRandRange(r.totalTransferCosts.low, r.totalTransferCosts.high)}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-faint mb-1">Total bond costs</p>
            <p className="font-display text-lg text-white">approximately {formatRandRange(r.totalBondCosts.low, r.totalBondCosts.high)}</p>
          </div>
          <div className="rounded-xl border border-gold/30 bg-gold/5 p-4 md:col-span-2">
            <p className="text-xs uppercase tracking-[0.2em] text-faint mb-1">Total upfront cash required</p>
            <p className="font-display text-2xl md:text-3xl text-white">
              approximately {formatRandRange(r.totalUpfrontCash.low, r.totalUpfrontCash.high)}
            </p>
            <p className="text-faint text-xs mt-1">
              Includes the cash portion of the price ({formatRand(r.cashPortionOfPrice)}) plus all costs above.
            </p>
          </div>
        </div>

        <ul className="mt-6 text-soft text-xs space-y-1 list-disc list-inside">
          <li>No transfer duty is payable at or below R1 210 000.</li>
          <li>
            Transfer duty and VAT are mutually exclusive — buying from a VAT-registered developer means VAT is in the price
            and no transfer duty is payable.
          </li>
        </ul>
      </Section>

      <LeadCaptureForm
        calcType="cost-of-buying"
        headlineLabel="Total upfront cash required (estimate)"
        headlineValue={formatRandRange(r.totalUpfrontCash.low, r.totalUpfrontCash.high)}
        emailLines={emailLines}
        budget={price}
      />
    </div>
  );
}

function LineRow({ label, value, tag }: { label: string; value: string; tag: string }) {
  return (
    <div className="flex items-center justify-between gap-3 p-3 text-sm">
      <div>
        <p className="text-white">{label}</p>
        <p className="text-faint text-[11px] uppercase tracking-wide">{tag}</p>
      </div>
      <p className="text-white font-semibold text-right">{value}</p>
    </div>
  );
}
