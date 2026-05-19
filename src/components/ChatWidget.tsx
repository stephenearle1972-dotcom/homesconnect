import { useEffect, useRef, useState } from 'react';
import { WA_LINK } from '../lib/constants';

type Msg = { role: 'user' | 'bot'; text: string };

const SUGGESTIONS = [
  '3 bed house in Durban under R2.5M',
  'Rentals in Cape Town',
  'Houses with a pool in Sandton',
  'Property in Pretoria East',
];

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading, open]);

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

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open chat"
          className="fixed bottom-5 right-5 z-40 w-14 h-14 rounded-full shadow-elev flex items-center justify-center"
          style={{ background: '#1A6B5C' }}
        >
          <ChatBubbleIcon />
        </button>
      )}

      {open && (
        <div className="fixed bottom-5 right-5 z-40 w-[92vw] max-w-sm h-[560px] max-h-[80vh] rounded-2xl overflow-hidden border border-white/10 shadow-elev flex flex-col"
             style={{ background: '#0d1b12' }}>
          <header className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-bg-mid/60">
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] text-gold-bright">HomesConnect AI</p>
              <p className="font-display text-base text-white">Property assistant</p>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Close chat" className="text-soft hover:text-white p-1">✕</button>
          </header>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {!messages.length && (
              <>
                <p className="text-soft text-sm">Hi! I'm the HomesConnect assistant. Ask about properties in any South African town and I'll search the listings.</p>
                <p className="text-xs uppercase tracking-[0.2em] text-faint mt-4 mb-2">Try asking</p>
                <div className="grid gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="text-left text-sm card-soft rounded-xl px-3 py-2 hover:border-teal/60 transition-colors"
                    >
                      <span className="text-teal-bright mr-2">›</span>{s}
                    </button>
                  ))}
                </div>
              </>
            )}

            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-teal text-white rounded-br-sm'
                    : 'bg-white/95 text-bg-dark rounded-bl-sm'
                }`}>
                  {m.text}
                </div>
              </div>
            ))}

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
              placeholder="Ask about properties…"
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
      )}
    </>
  );
}

function Dot({ delay }: { delay: number }) {
  return <span className="w-2 h-2 rounded-full bg-teal animate-bounce" style={{ animationDelay: `${delay}ms` }} />;
}
function ChatBubbleIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
    </svg>
  );
}
