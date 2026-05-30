import { Link } from 'react-router-dom';
import { NONBINDING_NOTICE, FRAUD_NOTICE, SUPPORT_EMAIL } from '../lib/constants';

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 md:px-8 py-12 md:py-16 text-soft leading-relaxed">
      <h1 className="font-display text-3xl md:text-5xl text-white">Privacy notice</h1>
      <p className="mt-4 text-sm text-faint">How HomesConnect (TownConnect (Pty) Ltd) handles personal information for the “Make an Offer” feature, in line with POPIA.</p>

      <Block title="What we collect">
        When you send proposed terms we collect your name, a verified mobile number, email, the entity type buying, and the proposed terms you enter. We practise data minimisation — we do not ask for ID or financial documents.
      </Block>
      <Block title="Why and how it's shared">
        Your proposed terms are shared with the seller of the listing (with your consent). Your personal and contact details are shared with a conveyancer <strong>only</strong> if the seller proceeds toward a formal Offer to Purchase <strong>and you give a separate, explicit consent</strong> at that point. We keep a consent and action audit log.
      </Block>
      <Block title="What we never do">
        We never sell your data. We never send banking details. {FRAUD_NOTICE}
      </Block>
      <Block title="Storage & access">
        Offer data is stored privately and is accessed only through authenticated processes — it is never published or exposed publicly.
      </Block>
      <Block title="Your choices">
        Marketing messages are optional and separate. You can request access to or deletion of your data by emailing <a className="text-teal-bright" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
      </Block>

      <div className="mt-8 rounded-2xl border border-gold/30 bg-gold/5 p-4 text-sm">{NONBINDING_NOTICE}</div>
      <Link to="/" className="text-teal-bright hover:text-white mt-8 inline-block">← Home</Link>
    </div>
  );
}
function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="mt-6"><h2 className="font-display text-xl text-white">{title}</h2><p className="mt-2 text-sm">{children}</p></section>;
}
