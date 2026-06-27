import { Link } from 'react-router-dom';
import { LegalPage, Section } from '../components/LegalLayout';

function QA({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border-soft bg-white/5 p-5">
      <p className="font-display text-base md:text-lg text-white">{q}</p>
      <div className="mt-2 text-sm text-soft">{children}</div>
    </div>
  );
}

export default function FaqPage() {
  return (
    <LegalPage title="Frequently Asked Questions">
      <Section title="About HomesConnect">
        <QA q="What is HomesConnect?">
          HomesConnect is a property advertising portal. We display property listings from estate agents and private sellers across South Africa, and we help interested buyers connect directly with the person advertising the property. You can browse listings on our website or search using our WhatsApp assistant.
        </QA>
        <QA q="Is HomesConnect an estate agency?">
          No. HomesConnect is not an estate agency and is not your estate agent. We do not market property on your behalf, negotiate, advise on price or terms, or represent any buyer or seller. We provide an advertising and connection service only.
        </QA>
        <QA q="Does HomesConnect sell property or handle the sale?">
          No. We are an advertising platform. No sale, offer, or agreement happens on HomesConnect. When you find a property you are interested in, we connect you to the lister so the two of you can deal with each other directly. Any transaction takes place between the buyer and the seller (and their chosen professionals) entirely outside HomesConnect.
        </QA>
        <QA q="Does HomesConnect hold any money or deposits?">
          No. We never hold, receive, or handle any purchase money, deposit, or trust funds. The only payments we receive are advertising fees from listers.
        </QA>
      </Section>

      <Section title="For buyers">
        <QA q="How do I find a property?">
          Browse listings on the website, or message our WhatsApp assistant and describe what you are looking for. The assistant will help you find matching listings.
        </QA>
        <QA q="How do I contact the seller or agent?">
          Each listing lets you connect with the lister directly. Through the website you can send an enquiry, and through the WhatsApp assistant you can request to be connected. You will then deal with the estate agent or private seller directly.
        </QA>
        <QA q="Does it cost me anything as a buyer?">
          No. Browsing listings and connecting with listers is free for buyers.
        </QA>
        <QA q="Is the information on a listing guaranteed?">
          No. Listings are advertisements supplied by the agent or private seller who placed them. They are responsible for the accuracy of their listing. Always verify the details directly with the lister before making any decision.
        </QA>
        <QA q="What happens to my information when I enquire?">
          When you send an enquiry or ask to be connected, your contact details and your enquiry are shared with the relevant lister so they can respond to you, and are processed in line with our Privacy Notice. Please see our <Link to="/privacy" className="text-teal-bright hover:text-white underline">Privacy Notice</Link> for full detail.
        </QA>
      </Section>

      <Section title="For agents and private sellers (listers)">
        <QA q="Who can advertise on HomesConnect?">
          Registered estate agents and private sellers (owners advertising their own property) may advertise, subject to our <Link to="/terms" className="text-teal-bright hover:text-white underline">Terms of Use</Link>.
        </QA>
        <QA q="What does HomesConnect do for me?">
          We advertise your listing on our website and through our WhatsApp assistant, and we send interested buyers directly to you. We are a connection channel, not an agent. We do not take commission on any sale.
        </QA>
        <QA q="Do you take commission?">
          No. We charge a flat advertising fee. We never take commission on a property sale.
        </QA>
        <QA q="Am I responsible for my listing's accuracy?">
          Yes. You are responsible for ensuring your listing is accurate, lawful, and that you are entitled to advertise the property. Misleading or unlawful listings may be removed.
        </QA>
      </Section>

      <Section title="Conveyancers directory">
        <QA q="What is the conveyancers directory?">
          It is a free directory of conveyancing attorneys. It is provided for convenience only. We do not recommend, endorse, or receive any referral fee from any firm listed. Choosing a conveyancer is entirely your decision.
        </QA>
      </Section>

      <Section title="Privacy and removal">
        <QA q="How do I get my listing or my personal information removed?">
          Contact us at <a href="mailto:hello@townconnect.co.za" className="text-teal-bright hover:text-white underline">hello@townconnect.co.za</a> and we will action removal requests promptly, in line with POPIA. See our <Link to="/privacy" className="text-teal-bright hover:text-white underline">Privacy Notice</Link> for your full rights.
        </QA>
      </Section>
    </LegalPage>
  );
}
