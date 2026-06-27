import { Link } from 'react-router-dom';
import { LegalPage, Section } from '../components/LegalLayout';

export default function DisclaimerPage() {
  return (
    <LegalPage title="Disclaimer">
      <Section title="1. Advertising portal only">
        HomesConnect is a property advertising portal. We are not an estate agency, do not act as an estate agent or property practitioner, and are not a party to any dealing or transaction between a buyer and a lister.
      </Section>
      <Section title="2. No warranty on listings">
        Listings are advertisements supplied by estate agents and private sellers. They are responsible for their accuracy. We do not verify listings and give no warranty, express or implied, as to the accuracy, completeness, lawfulness, or availability of any listing or property. Always verify details directly with the lister.
      </Section>
      <Section title="3. No money held">
        We do not hold or handle any purchase money, deposit, or trust funds.
      </Section>
      <Section title="4. No advice">
        Nothing on the Platform constitutes legal, financial, property, or professional advice. Obtain your own independent advice before making any decision.
      </Section>
      <Section title="5. Third parties">
        Any directory of conveyancers or other professionals, and any third-party links, are provided for convenience only and do not amount to a recommendation or endorsement.
      </Section>
      <Section title="6. Limitation">
        To the extent permitted by law, we are not liable for any loss or damage arising from use of the Platform or reliance on any listing. This disclaimer should be read with our <Link to="/terms" className="text-teal-bright hover:text-white underline">Terms of Use</Link>.
      </Section>
    </LegalPage>
  );
}
