import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { WA_LINK } from '../lib/constants';
import s from './PhoneDemo.module.css';

/* =======================================================================
   Conversation data — verbatim wording from the LIVE HomesConnect bot,
   with real listing photos from the live Cloudinary seed data. Ported
   from homesconnect-whatsapp-demo-v6.html (do not rewrite the wording).
======================================================================= */
const IMG = {
  capeDutch: 'https://res.cloudinary.com/dkn6tnxao/image/upload/c_fill/w_600/h_400/q_auto/f_auto/homesconnect/property-05-cape-dutch.jpg',
  seaPoint: 'https://res.cloudinary.com/dkn6tnxao/image/upload/c_fill/w_600/h_400/q_auto/f_auto/homesconnect/property-06-cpt-mountain.jpg',
};

type TextMsg = { from: 'user' | 'bot'; text: string; type?: 'text' };
type CardMsg = {
  from: 'bot'; type: 'card'; img: string; tag: string;
  ttl: string; price: string; loc: string; spec: string; agent: string; ref: string;
};
type Msg = TextMsg | CardMsg;

const SCENARIOS: Msg[][] = [
  /* 1 ── Renter searching Cape Town (mirrors the real conversation) */
  [
    { from: 'user', text: 'Hi' },
    { from: 'bot', text: 'Hi there! I\'m your HomesConnect property assistant. How can I help you find your next home in South Africa today?\n\nTell me what you\'re looking for, e.g., "3 bed house in Durban under R2.5M" or "rentals in Cape Town".' },
    { from: 'user', text: 'any rentals in cape town' },
    { from: 'bot', text: '**Camps Bay Luxury Apartment — R 35,000/mo**\nCamps Bay, Cape Town\n3 bed · 3 bath · pool\nAgent: Marius Joubert (Atlantic Letting) — ~0823344556~\nRef: HC014' },
    {
      from: 'bot', type: 'card', img: IMG.seaPoint, tag: 'TO RENT',
      ttl: 'Sea Point Apartment with Ocean Views', price: 'R 22,500/mo',
      loc: 'Sea Point, Cape Town', spec: '2 bed · 2 bath · pool',
      agent: 'Agent: Marius Joubert (Atlantic Letting)', ref: 'HC009',
    },
    { from: 'bot', text: 'Want photos and full details? Visit [homesconnect.co.za] or reply with a property ID.' },
  ],
  /* 2 ── Buyer searching Stellenbosch (mirrors the real conversation) */
  [
    { from: 'user', text: 'any houses in stellenbosch?' },
    {
      from: 'bot', type: 'card', img: IMG.capeDutch, tag: 'FOR SALE',
      ttl: 'Cape Dutch Estate in Stellenbosch', price: 'R 3,200,000',
      loc: 'Mostertsdrift, Stellenbosch', spec: '3 bed · 3 bath · pool, garden',
      agent: 'Agent: Elsabe Smit (Cape Heritage Realty)', ref: 'HC010',
    },
    { from: 'bot', text: 'Want photos and full details? Visit [homesconnect.co.za] or reply with a property ID.' },
    { from: 'user', text: 'how do i list my house?' },
    { from: 'bot', text: 'You can list your property with HomesConnect by visiting [homesconnect.co.za/list-property].' },
  ],
];

/* ── feed item model (what the React feed renders) ─────────────────── */
type FeedItem =
  | { kind: 'chip'; key: number; text: string; lock?: boolean }
  | { kind: 'bubble'; key: number; side: 'in' | 'out'; text: string; clock: string; ticks: boolean }
  | (CardMsg & { kind: 'card'; key: number; clock: string });

/* ── inline markup → React nodes: **bold**, [link], ~agentnum~, \n ─── */
function renderRich(text: string) {
  const lines = text.split('\n');
  return lines.map((line, li) => {
    const parts: React.ReactNode[] = [];
    const re = /\*\*(.+?)\*\*|\[(.+?)\]|~(.+?)~/g;
    let last = 0;
    let m: RegExpExecArray | null;
    let k = 0;
    while ((m = re.exec(line)) !== null) {
      if (m.index > last) parts.push(line.slice(last, m.index));
      if (m[1] !== undefined) parts.push(<span key={k++} className={s.bold}>{m[1]}</span>);
      else if (m[2] !== undefined) parts.push(<span key={k++} className={s.link}>{m[2]}</span>);
      else if (m[3] !== undefined) parts.push(<span key={k++} className={s.agentnum}>{m[3]}</span>);
      last = re.lastIndex;
    }
    if (last < line.length) parts.push(line.slice(last));
    return (
      <span key={li}>
        {parts}
        {li < lines.length - 1 && <br />}
      </span>
    );
  });
}

const TICKS = (
  <svg className={s.ticks} viewBox="0 0 16 11" fill="none">
    <path d="M11.07.65l-6.2 6.78L2.6 5.16l-1.34 1.4 3.61 3.42L12.4 2.05 11.07.65z" fill="#53bdeb" />
    <path d="M15.04.65l-6.2 6.78-.9-.85-1.35 1.4 2.25 2.13L16.37 2.05 15.04.65z" fill="#53bdeb" />
  </svg>
);

const fmtClock = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

const typeTime = (msg: Msg) => {
  const len = msg.type === 'card' ? 70 : (msg as TextMsg).text.length;
  return Math.min(3200, Math.max(1100, 800 + len * 16));
};

export default function PhoneDemo() {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [typing, setTyping] = useState(false);
  const [presence, setPresence] = useState('online');
  const [clock, setClock] = useState('09:14');
  const [fading, setFading] = useState(false);
  const [staticMode, setStaticMode] = useState(false);

  const sectionRef = useRef<HTMLElement>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const prevHeightRef = useRef(0);
  const visibleRef = useRef(false);
  const reduceRef = useRef(false);

  /* FLIP smooth-push: after each append, slide the whole feed up by the
     height it grew (newest message rises into view from the bottom). */
  useLayoutEffect(() => {
    const feed = feedRef.current;
    if (!feed || staticMode) return;
    const now = feed.scrollHeight;
    const delta = now - prevHeightRef.current;
    prevHeightRef.current = now;
    if (delta > 0 && !reduceRef.current) {
      feed.style.transition = 'none';
      feed.style.transform = `translateY(${delta}px)`;
      void feed.offsetHeight; // force reflow
      feed.style.transition = 'transform .38s cubic-bezier(.22,.75,.3,1), opacity .45s ease';
      feed.style.transform = 'translateY(0)';
    }
  }, [items, typing, staticMode]);

  /* start the loop only while the section is on screen (keep v6 behaviour) */
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (e) => { visibleRef.current = e[0].isIntersecting; },
      { threshold: 0.25 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  /* the timeline engine — cancellable so navigating away never leaks timers */
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    reduceRef.current = reduce;
    if (reduce) { setStaticMode(true); return; }

    let active = true;
    // pending timers: id -> resolver that clears the timer and unblocks the await
    const pending = new Map<ReturnType<typeof setTimeout>, () => void>();
    const CANCEL = Symbol('cancel');

    const sleep = (ms: number) =>
      new Promise<void>((resolve) => {
        const id = setTimeout(() => { pending.delete(id); resolve(); }, ms);
        pending.set(id, () => { clearTimeout(id); pending.delete(id); resolve(); });
      });
    const guard = () => { if (!active) throw CANCEL; };

    const keyRef = { current: 0 };
    let clockMin = 9 * 60 + 14;
    const tickClock = () => {
      clockMin += Math.random() < 0.4 ? 1 : 0;
      const str = fmtClock(clockMin);
      setClock(str);
      return str;
    };

    const addChip = (text: string, lock = false) =>
      setItems((p) => [...p, { kind: 'chip', key: keyRef.current++, text, lock }]);

    const addBubble = (msg: Msg) => {
      const t = tickClock();
      if (msg.type === 'card') {
        setItems((p) => [...p, { ...msg, kind: 'card', key: keyRef.current++, clock: t }]);
      } else {
        const tm = msg as TextMsg;
        setItems((p) => [...p, {
          kind: 'bubble', key: keyRef.current++,
          side: tm.from === 'user' ? 'out' : 'in', text: tm.text, clock: t, ticks: tm.from === 'user',
        }]);
      }
    };

    const seedHeader = (dateLabel: string) => {
      addChip(dateLabel);
      addChip('Messages are end-to-end encrypted. Tap to learn more.', true);
    };

    const waitVisible = async () => {
      while (!visibleRef.current) { await sleep(300); guard(); }
    };

    const playScenario = async (messages: Msg[]) => {
      for (const msg of messages) {
        await waitVisible(); guard();
        if (msg.from === 'bot') {
          await sleep(700); guard();
          setPresence('typing…'); setTyping(true);
          await sleep(typeTime(msg)); guard();
          setPresence('online'); setTyping(false);
          // let the typing-removal commit before the new bubble's FLIP measures
          await sleep(20); guard();
        } else {
          await sleep(1500); guard();
        }
        addBubble(msg);
        const readTime = msg.type === 'card'
          ? 3000
          : Math.min(3600, Math.max(1600, (msg as TextMsg).text.length * 22));
        await sleep(readTime); guard();
      }
    };

    const run = async () => {
      // preload card images so they never pop in half-loaded
      Object.values(IMG).forEach((src) => { const i = new Image(); i.src = src; });
      try {
        let i = 0;
        while (active) {
          setFading(false);
          setItems([]);
          prevHeightRef.current = 0;
          seedHeader('Today');
          await sleep(600); guard();
          await playScenario(SCENARIOS[i]);
          await sleep(5000); guard();   // let the finished chat breathe
          setFading(true);              // gentle fade instead of a hard cut
          await sleep(500); guard();
          i = (i + 1) % SCENARIOS.length;
        }
      } catch (e) {
        if (e !== CANCEL) throw e;       // swallow cancellation, surface real errors
      }
    };

    run();

    return () => {
      active = false;
      // resolve every pending sleep so its await unblocks, hits guard(), and unwinds
      pending.forEach((cancel) => cancel());
      pending.clear();
    };
  }, []);

  /* reduced-motion: render the whole conversation statically, scrollable */
  const staticItems = useMemo<FeedItem[]>(() => {
    if (!staticMode) return [];
    let k = 0;
    let m = 9 * 60 + 14;
    const out: FeedItem[] = [
      { kind: 'chip', key: k++, text: 'Today' },
      { kind: 'chip', key: k++, text: 'Messages are end-to-end encrypted. Tap to learn more.', lock: true },
    ];
    for (const msg of SCENARIOS.flat()) {
      m += 1;
      const t = fmtClock(m);
      if (msg.type === 'card') out.push({ ...msg, kind: 'card', key: k++, clock: t });
      else {
        const tm = msg as TextMsg;
        out.push({
          kind: 'bubble', key: k++, side: tm.from === 'user' ? 'out' : 'in',
          text: tm.text, clock: t, ticks: tm.from === 'user',
        });
      }
    }
    return out;
  }, [staticMode]);

  const feedItems = staticMode ? staticItems : items;

  return (
    <section ref={sectionRef} className={`${s.section} py-20 md:py-28`}>
      <div className="relative z-10 max-w-2xl mx-auto px-4 md:px-8 text-center mb-12 md:mb-16">
        <p className="chip bg-white/5 text-gold-bright mb-4">WhatsApp demo</p>
        <h2 className="font-display text-3xl md:text-5xl text-white">See it in action</h2>
        <p className="mt-4 text-soft text-lg">Find your next home without leaving WhatsApp.</p>
      </div>

      <div className={s.stage}>
        <div className={`${s.glow} ${s.glowLg}`} />
        <div className={`${s.glow} ${s.glowSm}`} />
        <div className={s.ground} />
        <div className={s.phone}>
          <span className={`${s.side} ${s.action}`} />
          <span className={`${s.side} ${s.volup}`} />
          <span className={`${s.side} ${s.voldn}`} />
          <span className={`${s.side} ${s.power}`} />
          <div className={s.screen}>
            <div className={s.island} />
            <div className={s.statusbar}><span>{clock}</span><span className={s.right}>▮▮▮ ⏤ 🔋</span></div>
            <div className={s.waHeader}>
              <svg className={s.waBack} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
              <div className={s.waAvatar}>HC</div>
              <div className={s.waMeta}>
                <span className={s.waName}>HomesConnect</span>
                <span className={s.waStatus}>{presence}</span>
              </div>
              <div className={s.waIcons}>
                <svg viewBox="0 0 24 24" fill="#fff"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" /></svg>
                <svg viewBox="0 0 24 24" fill="#fff"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" /></svg>
              </div>
            </div>
            <div className={`${s.waChat} ${staticMode ? s.waChatStatic : ''}`}>
              <div ref={feedRef} className={`${s.feed} ${staticMode ? s.feedStatic : ''} ${fading ? s.fading : ''}`}>
                {feedItems.map((it) => <FeedRow key={it.key} item={it} />)}
                {typing && (
                  <div className={`${s.bubble} ${s.in} ${s.typing}`}>
                    <span /><span /><span />
                  </div>
                )}
              </div>
            </div>
            <div className={s.waInput}>
              <div className={s.field}>
                <svg viewBox="0 0 24 24"><path d="M12 22C6.48 22 2 17.52 2 12S6.48 2 12 2s10 4.48 10 10-4.48 10-10 10zm-3.5-9c.83 0 1.5-.67 1.5-1.5S9.33 10 8.5 10 7 10.67 7 11.5 7.67 13 8.5 13zm7 0c.83 0 1.5-.67 1.5-1.5s-.67-1.5-1.5-1.5-1.5.67-1.5 1.5.67 1.5 1.5 1.5zm-3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z" /></svg>
                <span>Type a message</span>
              </div>
              <div className={s.mic}><svg viewBox="0 0 24 24"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.91-3c-.49 0-.9.36-.98.85C16.52 14.2 14.47 16 12 16s-4.52-1.8-4.93-4.15c-.08-.49-.49-.85-.98-.85-.61 0-1.09.54-1 1.14.49 3 2.89 5.35 5.91 5.78V20c0 .55.45 1 1 1s1-.45 1-1v-2.08c3.02-.43 5.42-2.78 5.91-5.78.1-.6-.39-1.14-1-1.14z" /></svg></div>
            </div>
            <div className={s.homeBar} />
          </div>
        </div>
      </div>

      <div className="relative z-10 mt-12 text-center">
        <a href={WA_LINK} target="_blank" rel="noreferrer" className="btn-wa">Try it now on WhatsApp</a>
      </div>
    </section>
  );
}

function FeedRow({ item }: { item: FeedItem }) {
  if (item.kind === 'chip') {
    return <div className={`${s.chip} ${item.lock ? s.chipLock : ''}`}>{item.text}</div>;
  }
  if (item.kind === 'card') {
    return (
      <div className={`${s.bubble} ${s.in} ${s.card}`}>
        <div className={s.imgwrap}>
          <img src={item.img} alt={item.ttl} />
          <span className={s.tag}>{item.tag}</span>
        </div>
        <div className={s.body}>
          <div className={s.ttl}>{item.ttl} — <span style={{ color: 'var(--hc-green)' }}>{item.price}</span></div>
          <div className={s.loc}>{item.loc}</div>
          <div className={s.spec}>{item.spec}</div>
          <div className={s.agent}>{item.agent}</div>
          <div className={s.ref}>Ref: {item.ref}</div>
          <div className={s.metaInline}>{item.clock}</div>
        </div>
      </div>
    );
  }
  return (
    <div className={`${s.bubble} ${item.side === 'out' ? s.out : s.in}`}>
      {renderRich(item.text)}
      <span className={s.metaInline}>{item.clock}{item.ticks && TICKS}</span>
    </div>
  );
}
