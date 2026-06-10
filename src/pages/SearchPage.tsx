import { Link } from 'react-router-dom';
import ChatPanel from '../components/ChatPanel';
import WhatsappQR from '../components/WhatsappQR';
import { WA_LINK } from '../lib/constants';
import Seo from '../lib/seo';

export default function SearchPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 md:px-8 py-12 md:py-16">
      <Seo
        title="AI Property Search — Find Homes in Real Time | HomesConnect"
        description="Search South African property listings with the HomesConnect AI assistant. Describe what you want — area, price, bedrooms, features — and get instant matches."
        path="/search"
      />
      <p className="chip bg-white/5 text-gold-bright mb-4">Search</p>
      <h1 className="font-display text-4xl md:text-6xl text-white">Search Properties with AI</h1>
      <p className="mt-3 text-soft max-w-2xl">
        Tell our assistant what you're looking for — area, price, bedrooms, features —
        and it'll search our live listings in real time.
      </p>

      <div className="mt-10 h-[560px] md:h-[640px]">
        <ChatPanel
          variant="floating"
          placeholder="Try: '3 bed house in Durban under R2.5M'"
          className="h-full"
        />
      </div>

      <div className="mt-10 grid gap-6 md:grid-cols-[1fr,auto] items-center card-soft rounded-2xl px-6 py-6">
        <div className="space-y-3">
          <Link to="/listings" className="block text-teal-bright hover:text-white transition-colors">
            Or browse all listings →
          </Link>
          <a href={WA_LINK} target="_blank" rel="noreferrer" className="btn-wa">
            Or message us on WhatsApp
          </a>
        </div>
        <div className="justify-self-center md:justify-self-end">
          <WhatsappQR size={140} label="Scan to chat" />
        </div>
      </div>
    </div>
  );
}
