import { useEffect, useRef, useState } from 'react';
import { WA_LINK } from '../lib/constants';

type Msg = { role: 'user' | 'bot'; text: string };

const DEFAULT_SUGGESTIONS = [
  '3 bed house in Durban under R2.5M',
  'Rentals in Cape Town',
  'Houses with a pool in Sandton',
  'Property in Pretoria East',
];

const DEFAULT_GREETING =
  "Hi! I'm the HomesConnect property assistant. Tell me what you're looking for — area, price range, bedrooms — and I'll search our listings for you.";

type ChatPanelProps = {
  variant?: 'floating' | 'embedded';
  placeholder?: string;
  suggestions?: string[];
  greeting?: string;
  className?: string;
  /** Pixel height; only used by floating variant. Embedded uses height: 100%. */
  height?: number;
};

export default function ChatPanel({
  variant = 'embedded',
  placeholder = "Ask about properties…",
  suggestions = DEFAULT_SUGGESTIONS,
  greeting = DEFAULT_GREETING,
  className = '',
  height,
}: ChatPanelProps) {
  const [messages, setMessages] = useState<Msg[]>(greeting ? [{ role: 'bot', text: greeting }] : []);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading]);

  async function send(text: string) {
    const t = text.trim();
    if (!t || loading) return;
    setMessages((prev) => [...prev, { role: 'user', text: t }]);
    setInput('');
    setLoading(true);
    try {
      const res = await fetch('/.netlify/functions/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: t, history: messages.slice(-6) }),
      });
      const data = await res.json();
      const reply = data.response || data.error || "I couldn't process that.";
      setMessages((prev) => [...prev, { role: 'bot', text: reply }]);
    } catch {
      setMessages((prev) => [...prev, { role: 'bot', text: "I'm having trouble right now. Try the WhatsApp bot for instant results." }]);
    } finally {
      setLoading(false);
    }
  }

  const onlyGreeting = messages.length === 1 && messages[0].role === 'bot';

  return (
    <div
      className={`flex flex-col rounded-2xl overflow-hidden border border-white/10 ${className}`}
      style={{
        background: '#0d1b12',
        height: variant === 'floating' && height ? height : variant === 'floating' ? '100%' : undefined,
      }}
    >
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-0">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap leading-relaxed ${
              m.role === 'user'
                ? 'bg-teal text-white rounded-br-sm'
                : 'bg-white/95 text-bg-dark rounded-bl-sm'
            }`}>
              {linkify(m.text)}
            </div>
          </div>
        ))}

        {onlyGreeting && (
          <div className="mt-3">
            <p className="text-xs uppercase tracking-[0.2em] text-faint mb-2">Try asking</p>
            <div className="grid gap-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="text-left text-sm card-soft rounded-xl px-3 py-2 hover:border-teal/60 transition-colors"
                >
                  <span className="text-teal-bright mr-2">›</span>{s}
                </button>
              ))}
            </div>
          </div>
        )}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-white/90 rounded-2xl rounded-bl-sm px-3 py-2.5 flex items-center gap-1">
              <Dot delay={0} /><Dot delay={150} /><Dot delay={300} />
            </div>
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); send(input); }}
        className="border-t border-white/10 px-3 py-3 bg-bg-mid/40 flex items-center gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={placeholder}
          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-faint focus:outline-none focus:border-teal"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="px-4 py-2 rounded-lg text-xs uppercase tracking-[0.2em] font-semibold disabled:opacity-40"
          style={{ background: '#1A6B5C', color: '#fff' }}
        >
          Send
        </button>
      </form>

      <p className="px-4 py-2 text-[10px] text-faint text-center border-t border-white/10">
        For instant chat, message <a href={WA_LINK} className="text-teal-bright" target="_blank" rel="noreferrer">our WhatsApp bot</a>.
      </p>
    </div>
  );
}

/** Convert bare https:// URLs in bot replies into clickable links. */
function linkify(text: string) {
  const parts = text.split(/(https?:\/\/[^\s)]+)/g);
  return parts.map((p, i) => {
    if (/^https?:\/\//.test(p)) {
      return <a key={i} href={p} className="underline" target="_blank" rel="noreferrer">{p}</a>;
    }
    // Render WhatsApp-style *bold* as <strong>
    const boldParts = p.split(/(\*[^*]+\*)/g);
    return boldParts.map((b, j) => {
      if (/^\*[^*]+\*$/.test(b)) return <strong key={`${i}-${j}`}>{b.slice(1, -1)}</strong>;
      return <span key={`${i}-${j}`}>{b}</span>;
    });
  });
}

function Dot({ delay }: { delay: number }) {
  return <span className="w-2 h-2 rounded-full bg-teal animate-bounce" style={{ animationDelay: `${delay}ms` }} />;
}
