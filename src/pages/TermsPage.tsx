import { LegalPage, Section, OperatorBlock } from '../components/LegalLayout';

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Use">
      <OperatorBlock />

      <Section title="1. About these terms">
        These Terms of Use govern your use of the HomesConnect website and WhatsApp assistant (together, the "Platform"). By using the Platform you agree to these terms. If you do not agree, please do not use the Platform.
      </Section>
      <Section title="2. What HomesConnect is">
        HomesConnect is a property advertising portal. We publish property listings supplied by estate agents and private sellers, and we connect interested buyers with those listers. The Platform is an advertising and connection service only.
      </Section>
      <Section title="3. What HomesConnect is not">
        HomesConnect is not an estate agency and does not act as an estate agent or property practitioner for any user. We do not market property on behalf of any seller, do not represent any buyer or seller, do not negotiate, and do not advise on the merits, value, price, or terms of any property or transaction. No offer, sale, or agreement of sale is concluded on or through the Platform. We are not a party to any dealing between a buyer and a lister.
      </Section>
      <Section title="4. No money held">
        We do not hold, receive, or handle any purchase consideration, deposit, or trust money. Any such funds, if applicable to a transaction, are dealt with directly between the parties and their chosen professionals, outside the Platform.
      </Section>
      <Section title="5. Listings are advertisements">
        Listings are advertisements placed by estate agents or private sellers. The lister is solely responsible for the content, accuracy, lawfulness, and currency of their listing, and warrants that they are entitled to advertise the property. HomesConnect does not verify listings and gives no warranty as to their accuracy or completeness.
      </Section>
      <Section title="6. Connecting with listers">
        When you enquire about or ask to be connected to a listing, you authorise us to share your enquiry and contact details with the relevant lister so they can respond. Your dealings with that lister are between you and them. HomesConnect is not responsible for the conduct of any lister or buyer, or for any agreement, representation, or transaction between them.
      </Section>
      <Section title="7. Lister obligations">
        If you advertise on the Platform you agree that: your listing is accurate and not misleading; you are lawfully entitled to advertise the property; you will comply with all applicable laws, including the Property Practitioners Act 22 of 2019 where it applies to you; and you will deal with enquiries lawfully and in line with POPIA. We may remove any listing that breaches these terms or that we reasonably consider unlawful or misleading.
      </Section>
      <Section title="8. Advertising fees">
        Advertising fees, where they apply, are as set out on the Platform. Fees are for advertising the listing and are not contingent on any sale. Payment terms are shown at the point of purchase.
      </Section>
      <Section title="9. Conveyancers directory">
        Any directory of conveyancers or other professionals is provided for convenience only. We do not recommend or endorse any firm and receive no referral fee. Your choice of professional is your own.
      </Section>
      <Section title="10. Intellectual property">
        The Platform, its design, and its content (excluding listing content supplied by listers) belong to TownConnect (Pty) Ltd. Listers retain ownership of their listing content and grant us a licence to display it while it is live.
      </Section>
      <Section title="11. Limitation of liability">
        The Platform is provided "as is". To the extent permitted by law, HomesConnect and TownConnect (Pty) Ltd are not liable for any loss or damage arising from use of the Platform, reliance on any listing, or any dealing or transaction between a buyer and a lister. Nothing in these terms limits any liability that cannot lawfully be limited.
      </Section>
      <Section title="12. Indemnity">
        You indemnify HomesConnect and TownConnect (Pty) Ltd against any claim arising from your listings, your enquiries, or your use of the Platform in breach of these terms or the law.
      </Section>
      <Section title="13. Changes">
        We may update these terms from time to time. The current version is always available on the Platform.
      </Section>
      <Section title="14. Governing law">
        These terms are governed by the laws of the Republic of South Africa.
      </Section>
      <Section title="15. Contact">
        <OperatorBlock />
      </Section>
    </LegalPage>
  );
}
