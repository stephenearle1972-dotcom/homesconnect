import { LegalPage, Section, OperatorBlock } from '../components/LegalLayout';

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Notice">
      <OperatorBlock />

      <Section title="1. Introduction">
        This Privacy Notice explains how HomesConnect, operated by TownConnect (Pty) Ltd, collects, uses, and protects personal information in line with the Protection of Personal Information Act 4 of 2013 (POPIA).
      </Section>
      <Section title="2. Information we collect">
        <ul className="list-disc pl-5 space-y-2">
          <li>From buyers: name, contact details (such as phone number and email), and the content of your enquiry or WhatsApp message, when you enquire about a listing or ask to be connected to a lister.</li>
          <li>From listers: name, contact details, and the listing information you supply for advertising.</li>
          <li>Automatically: basic usage and analytics data (such as pages viewed and searches made) to operate and improve the Platform.</li>
        </ul>
      </Section>
      <Section title="3. Why we process it">
        <ul className="list-disc pl-5 space-y-2">
          <li>To display listings and operate the advertising portal.</li>
          <li>To connect interested buyers with the relevant lister by sharing the enquiry and contact details with that lister.</li>
          <li>To respond to you and provide support.</li>
          <li>To improve the Platform and for legitimate business administration.</li>
          <li>To comply with the law.</li>
        </ul>
      </Section>
      <Section title="4. Who we share it with">
        <ul className="list-disc pl-5 space-y-2">
          <li>The relevant lister (estate agent or private seller), when you enquire about or ask to be connected to their listing, so they can respond to you.</li>
          <li>Our service providers who help us run the Platform (for example hosting, email, and database providers), under appropriate safeguards.</li>
          <li>Authorities, where required by law.</li>
        </ul>
        <p>We do not sell your personal information.</p>
      </Section>
      <Section title="5. WhatsApp assistant">
        When you message our WhatsApp assistant, your message is processed to help you find listings and connect with listers. WhatsApp's own terms and privacy practices also apply to your use of WhatsApp.
      </Section>
      <Section title="6. Storage and security">
        We take reasonable technical and organisational measures to protect personal information. Personal information may be stored using third-party service providers, which may process data outside South Africa; where that happens we take reasonable steps to ensure adequate protection.
      </Section>
      <Section title="7. Retention">
        We keep personal information only for as long as necessary for the purposes above or as required by law, and then delete or anonymise it.
      </Section>
      <Section title="8. Your rights">
        You have the right to access the personal information we hold about you, to ask us to correct or delete it, to object to processing, and to lodge a complaint. To exercise any of these, contact our Information Officer using the details above.
      </Section>
      <Section title="9. Complaints to the Regulator">
        You may also complain to the Information Regulator (South Africa): enquiries: <a className="text-teal-bright hover:text-white" href="mailto:inforeg@inforegulator.org.za">inforeg@inforegulator.org.za</a>; complaints: <a className="text-teal-bright hover:text-white" href="mailto:POPIAComplaints@inforegulator.org.za">POPIAComplaints@inforegulator.org.za</a>; website: <a className="text-teal-bright hover:text-white" href="https://inforegulator.org.za" target="_blank" rel="noreferrer">https://inforegulator.org.za</a>.
      </Section>
      <Section title="10. Changes">
        We may update this notice from time to time. The current version is always available on the Platform.
      </Section>
    </LegalPage>
  );
}
