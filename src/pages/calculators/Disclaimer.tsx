import { RATES_LAST_VERIFIED, PRIME_RATE } from '../../config/propertyRates';

// PLACEHOLDER — Stephen will rewrite this. Treat as not-final copy, but it
// must stay on the page (not only in the site Disclaimer), collapsed but
// present above the fold on mobile — hence the native <details>, which lands
// right under the H1 in document order and needs no JS to expand.
const DISCLAIMER_TEXT =
  'These calculators provide estimates for general information only. They are not a quotation, an offer of ' +
  'credit, a pre-approval, or an affordability assessment as contemplated in the National Credit Act 34 of 2005. ' +
  'No financial or credit advice is given or intended. Interest rates, SARS transfer duty thresholds, attorney ' +
  'tariffs and Deeds Office fees change from time to time and the figures shown may not reflect current rates. ' +
  'Attorney fees follow recommended guideline tariffs and individual firms may quote differently. Your actual ' +
  'bond, instalment and costs will be determined by your bank and your conveyancer. Confirm all figures with ' +
  'them before making any offer or financial commitment.';

export default function Disclaimer() {
  return (
    <details className="mt-6 rounded-xl border border-gold/30 bg-gold/5 p-4 text-soft text-sm leading-relaxed">
      <summary className="cursor-pointer font-semibold text-gold-bright select-none">
        Important — read before you rely on these figures
      </summary>
      <div className="mt-3 space-y-2">
        <p>{DISCLAIMER_TEXT}</p>
        <p className="text-faint text-xs">
          Rates applied as at {RATES_LAST_VERIFIED}. Prime lending rate {PRIME_RATE}%.
        </p>
      </div>
    </details>
  );
}
