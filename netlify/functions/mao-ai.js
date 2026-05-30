// Make an Offer — AI assistance, GREEN ZONE ONLY (STEP 8).
// Allowed: explain a field in plain language; produce a neutral summary of terms;
// structure a free-text note into fields to confirm. Arithmetic checks are done
// without AI (client + mao-submit). NOT allowed: drafting clauses, advising what to
// offer/accept, valuation, ranking, negotiation strategy, legal/financial advice.
import { json, CORS } from './_lib/mao.js';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

const GUARDRAIL =
  'You are a neutral form helper for a South African property "proposed terms" tool. ' +
  'STRICT RULES: never advise what price to offer or accept; never value the property or give a fair range; ' +
  'never draft or suggest any Offer-to-Purchase clause or legal wording; never give legal, financial, tax or negotiation advice; ' +
  'never rank or compare buyers. If asked for any of those, reply exactly: ' +
  '"I can\'t advise on that — please speak to your conveyancer or financial adviser." ' +
  'Keep answers short and plain.';

const FIELD_HELP = {
  proposed_price: 'The total price you are proposing to pay for the property.',
  funding_method: 'How you plan to pay: cash, a home loan (bond), or a mix of both.',
  bond_amount: 'The portion of the price you intend to finance with a home loan (bond).',
  cash_contribution: 'The portion of the price you will pay from your own cash (not the bond).',
  deposit_amount: 'An optional upfront amount paid into the conveyancer’s trust account once an Offer to Purchase is signed — never to HomesConnect.',
  subject_to_sale: 'Whether your proposal depends on you first selling another property.',
  occupation_date: 'The date you would like to move in or take occupation, for discussion.',
  proposal_expiry: 'How long these proposed terms stay open for the seller to consider.',
  buyer_entity_type: 'Who will buy: you as an individual, a company, a trust, or other.',
  note_to_seller: 'A short, friendly message to the seller about your proposal.',
  note_for_conveyancer: 'Anything the conveyancer should know if the seller proceeds (e.g. timing).',
};

async function gemini(prompt) {
  if (!GEMINI_API_KEY) throw new Error('AI not configured');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  const res = await fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: GUARDRAIL }] },
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 400 },
    }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}`);
  const data = await res.json();
  return (data.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
}

function money(n) { return 'R ' + (Number(n) || 0).toLocaleString('en-ZA'); }

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  let b; try { b = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'Bad JSON' }); }

  try {
    if (b.action === 'explain') {
      const base = FIELD_HELP[b.field];
      if (!base) return json(400, { error: 'Unknown field' });
      // Canned base + optional Gemini elaboration (still inside the guardrail).
      let text = base;
      try { text = await gemini(`Explain this property-offer form field to a buyer in one or two plain sentences. Field: "${b.field}". Baseline meaning: "${base}". Do not advise what value to enter.`); } catch {}
      return json(200, { text: text || base });
    }

    if (b.action === 'summarize') {
      // POPIA s72 — de-identify. Use ONLY non-identifying numeric/enum fields; never
      // the buyer's name/phone/email or any free-text notes, even if the client sent
      // them in the body. (This object is the only thing that reaches the prompt.)
      const src = b.offer || {};
      const o = {
        proposed_price: src.proposed_price,
        funding_method: src.funding_method,
        bond_amount: src.bond_amount,
        cash_contribution: src.cash_contribution,
        deposit_amount: src.deposit_amount,
        subject_to_sale: src.subject_to_sale,
        occupation_date: src.occupation_date,
        proposal_expiry: src.proposal_expiry,
      };
      const facts = [
        `Proposed price ${money(o.proposed_price)}`,
        `funding ${o.funding_method}` + (o.funding_method === 'mixed' ? ` (bond ${money(o.bond_amount)} + cash ${money(o.cash_contribution)})` : ''),
        o.deposit_amount ? `deposit ${money(o.deposit_amount)}` : null,
        o.subject_to_sale === 'yes' || o.subject_to_sale === true ? `subject to selling another property` : `not subject to another sale`,
        o.occupation_date ? `preferred occupation ${o.occupation_date}` : null,
        `expires ${o.proposal_expiry}`,
      ].filter(Boolean).join('; ');
      let text;
      try { text = await gemini(`Write a neutral 2-3 sentence plain-language summary of these proposed terms for the buyer to confirm before sending. Do NOT advise, value, or judge. Terms: ${facts}.`); }
      catch { text = `You are proposing ${facts}. This is non-binding and for the seller's consideration.`; }
      return json(200, { text });
    }

    if (b.action === 'structure') {
      const text = String(b.text || '').slice(0, 1000);
      if (!text) return json(400, { error: 'No text' });
      let out = '';
      try {
        out = await gemini(`From the buyer's free-text note below, extract any of these fields if clearly present: proposed_price (number), funding_method (cash|bond|mixed), deposit_amount (number), occupation_date (YYYY-MM-DD), subject_to_sale (yes|no). Reply ONLY with a compact JSON object of the fields you found (omit unknowns). Do not infer or advise.\n\nNote: """${text}"""`);
      } catch { return json(200, { fields: {} }); }
      let fields = {};
      try { fields = JSON.parse(out.replace(/```json|```/g, '').trim()); } catch {}
      return json(200, { fields, note: 'Please confirm — AI may misread; nothing is submitted until you review.' });
    }

    return json(400, { error: 'Unknown action' });
  } catch (err) {
    console.error('[mao-ai]', err.message);
    return json(200, { text: "I can't help with that right now." });
  }
};
