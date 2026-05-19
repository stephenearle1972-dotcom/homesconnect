import { useState } from 'react';
import ChatPanel from './ChatPanel';

export default function ChatWidget() {
  const [open, setOpen] = useState(false);

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
        <div className="fixed bottom-5 right-5 z-40 w-[92vw] max-w-sm h-[560px] max-h-[80vh] shadow-elev flex flex-col"
             style={{ background: '#0d1b12', borderRadius: '1rem', overflow: 'hidden' }}>
          <header className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-bg-mid/60">
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] text-gold-bright">HomesConnect AI</p>
              <p className="font-display text-base text-white">Property assistant</p>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Close chat" className="text-soft hover:text-white p-1">✕</button>
          </header>
          <div className="flex-1 min-h-0">
            <ChatPanel variant="floating" className="!rounded-none !border-0 h-full" />
          </div>
        </div>
      )}
    </>
  );
}

function ChatBubbleIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
    </svg>
  );
}
