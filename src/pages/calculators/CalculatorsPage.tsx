import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Tabs from '../../components/Tabs';
import Seo from '../../lib/seo';
import { PRIME_RATE, RATES_LAST_VERIFIED } from '../../config/propertyRates';
import Disclaimer from './Disclaimer';
import BondRepaymentTab from './BondRepaymentTab';
import AffordabilityTab from './AffordabilityTab';
import CostOfBuyingTab from './CostOfBuyingTab';

export type TabId = 'bond-repayment' | 'affordability' | 'cost-of-buying';

const TABS: { id: TabId; label: string }[] = [
  { id: 'bond-repayment', label: 'Bond Repayment' },
  { id: 'affordability', label: 'Affordability' },
  { id: 'cost-of-buying', label: 'Cost of Buying' },
];

const SEO_BY_TAB: Record<TabId, { title: string; description: string; faq: { q: string; a: string }[] }> = {
  'bond-repayment': {
    title: 'Bond Repayment Calculator — Estimate Your Monthly Instalment | HomesConnect',
    description:
      'Work out your estimated monthly bond instalment. Enter the purchase price, deposit, interest rate and term for an instant South African bond repayment estimate.',
    faq: [
      {
        q: 'What is the current prime lending rate?',
        a: `The prime lending rate used in this calculator is ${PRIME_RATE}%, as at ${RATES_LAST_VERIFIED}. Banks typically price home loans at prime, or at a discount or premium to prime depending on your credit profile.`,
      },
      {
        q: 'Does this calculator include bank fees?',
        a: 'It shows the typical bank monthly admin fee as its own line, separately from your instalment — it is never folded silently into the number you see.',
      },
    ],
  },
  affordability: {
    title: 'Bond Affordability Calculator — What Can I Afford? | HomesConnect',
    description:
      'Estimate the maximum home loan and purchase price you could afford in South Africa, based on your income, monthly expenses and existing debt.',
    faq: [
      {
        q: 'How do banks decide what I can afford?',
        a: 'Banks generally apply two tests: your instalment as a share of gross income (roughly 30%), and your actual monthly surplus after expenses and debt. Whichever gives the lower amount usually sets your limit.',
      },
      {
        q: 'Can I add transfer costs to my bond?',
        a: 'No — transfer duty, attorney fees and Deeds Office fees are paid in cash and cannot normally be added to your bond. They come out of your deposit or other available cash.',
      },
    ],
  },
  'cost-of-buying': {
    title: 'Cost of Buying a House Calculator — Transfer Duty & Fees | HomesConnect',
    description:
      'Estimate the full upfront cash needed to buy a property in South Africa: SARS transfer duty, attorney fees, bond registration and Deeds Office fees.',
    faq: [
      {
        q: 'How much transfer duty do I pay on a R2 million house?',
        a: 'On a R2 000 000 purchase, SARS transfer duty is R33 786. No transfer duty is payable on the portion of the price at or below R1 210 000.',
      },
      {
        q: 'What is the current prime lending rate?',
        a: `The prime lending rate used across these calculators is ${PRIME_RATE}%, as at ${RATES_LAST_VERIFIED}.`,
      },
      {
        q: 'Can I add transfer costs to my bond?',
        a: 'No — transfer costs are paid in cash, separately from your bond, and are due before or at registration.',
      },
    ],
  },
};

function tabIdFromPath(pathname: string): TabId {
  const seg = pathname.split('/')[2];
  return TABS.some((t) => t.id === seg) ? (seg as TabId) : 'bond-repayment';
}

export default function CalculatorsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const activeId = useMemo(() => tabIdFromPath(location.pathname), [location.pathname]);
  const meta = SEO_BY_TAB[activeId];
  const path = location.pathname === '/calculators' ? '/calculators' : `/calculators/${activeId}`;

  const jsonLd = useMemo(
    () => [
      {
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        name: 'HomesConnect Property Calculators',
        applicationCategory: 'FinanceApplication',
        operatingSystem: 'Any (web browser)',
        url: 'https://homesconnect.co.za/calculators',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'ZAR' },
      },
      {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: meta.faq.map((f) => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      },
    ],
    [meta]
  );

  function goToTab(id: string) {
    navigate(`/calculators/${id}`);
  }

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-8 py-12 md:py-16">
      <Seo title={meta.title} description={meta.description} path={path} jsonLd={jsonLd} />

      <p className="chip bg-white/5 text-gold-bright mb-4">Free tools</p>
      <h1 className="font-display text-3xl md:text-5xl text-white">Property Calculators</h1>
      <p className="text-soft mt-3">
        Estimate your bond repayment, what you can afford, and the full upfront cash needed to buy — in seconds, no
        sign-up required.
      </p>

      <Disclaimer />

      <div className="mt-8">
        <Tabs tabs={TABS} activeId={activeId} onChange={goToTab} />
      </div>

      <div className="mt-6">
        {activeId === 'bond-repayment' && <BondRepaymentTab />}
        {activeId === 'affordability' && <AffordabilityTab />}
        {activeId === 'cost-of-buying' && <CostOfBuyingTab />}
      </div>
    </div>
  );
}
