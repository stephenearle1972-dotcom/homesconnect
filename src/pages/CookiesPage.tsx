import { Link } from 'react-router-dom';
import { LegalPage, Section } from '../components/LegalLayout';

export default function CookiesPage() {
  return (
    <LegalPage title="Cookie Policy">
      <Section title="1. What cookies are">
        Cookies are small files placed on your device that help a website work and help us understand how it is used.
      </Section>
      <Section title="2. How we use them">
        We use cookies and similar technologies for essential site functioning and for basic analytics (to understand which listings and searches are popular, so we can improve the Platform). We do not use cookies to sell your data.
      </Section>
      <Section title="3. Third parties">
        Some cookies may be set by third-party providers we use to run and host the Platform.
      </Section>
      <Section title="4. Managing cookies">
        You can control or delete cookies through your browser settings. Disabling some cookies may affect how the Platform works.
      </Section>
      <Section title="5. More information">
        For how we handle personal information generally, see our <Link to="/privacy" className="text-teal-bright hover:text-white underline">Privacy Notice</Link>.
      </Section>
    </LegalPage>
  );
}
