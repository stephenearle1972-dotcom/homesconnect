# HomesConnect — Handoff Checklist

The website, on-site chat, WhatsApp bot handler, and 25-listing seed are all built.
Below is everything **only you** can do — credentials, Netlify console, Cloudinary, Meta.

The CSV URL you screenshotted is already wired in below where needed:
`https://docs.google.com/spreadsheets/d/e/2PACX-1vSSirf3AzlKaOlve0OyRkDpZh1H3zcl5y94lJvhLl3pJ1gUO1bd-mkBG2tGDSYmR-wQwRFspd4jMaVp/pub?output=csv`

---

## ⚠️ Heads-up before you start

You're repurposing the **Jeffreys Bay** WhatsApp number (`+27 76 795 9872`,
phone_number_id `962273166980427`) for HomesConnect.

That number is currently the bot for the **Jeffreys Bay town directory site**
(`jeffreysbayconnect.netlify.app`). Once you flip `PHONE_MAP_962273166980427`
from `jeffreysbay` to `homesconnect`, the Jeffreys Bay town bot **goes dark**.
The town website keeps working — only the WhatsApp bot stops responding for that town.

If that's intentional (it sounds like it is), proceed. If you want Jeffreys Bay's bot
to keep working, you need a different (unused) phone_number_id for HomesConnect first.

The display name on Meta still says `JeffreysbayConnect` — you noted in the prompt
that you'll rename later. The bot itself doesn't care.

---

## Step 1 — Seed the Google Sheet  (≈ 5 min)

You already created **HomesConnect Listings** and shared it published-CSV.

1. Open the sheet.
2. Add the 26 header columns to row 1 (exact order, lowercase):
   ```
   id  type  status  tier  title  price  price_display  bedrooms  bathrooms  garage  garden  pool  pet_friendly  property_type  suburb  city  province  description  imageUrl  image2  image3  agent_name  agent_phone  agent_agency  featured  date_listed
   ```
3. Open `C:\Users\Admin\Desktop\homesconnect\seed\listings_seed.csv` in Excel
   (or any text editor), copy rows 2–26, paste into the sheet starting at row 2.
4. File → Share → Publish to web — confirm it's still the same URL above.
5. Confirm the URL opens a CSV in your browser.

---

## Step 2 — Upload property images to Cloudinary  (≈ 10 min)

Cloud: `dkn6tnxao`. Folder: `homesconnect` (create it).

In the Cloudinary Media Library, drag-and-drop the 6 images from
`C:\Users\Admin\Downloads\` (the May 19, 08:49 set) and **rename on upload** as:

| Source file (date order, newest first) | Cloudinary public_id |
|----------------------------------------|----------------------|
| (6) — Karoo / Cape farmhouse | `homesconnect/property-01-karoo-farmhouse` |
| (5) — Thatched bushveld lodge with pool | `homesconnect/property-02-bushveld-lodge` |
| (4) — KZN ocean-front modern home | `homesconnect/property-03-kzn-ocean-modern` |
| (3) — Sandton-style modern mansion | `homesconnect/property-04-sandton-mansion` |
| (2) — Cape Dutch heritage home | `homesconnect/property-05-cape-dutch` |
| (1) — Cape Town modern w/ Table Mountain | `homesconnect/property-06-cpt-mountain` |

If the (1)/(2)/(3)… in the filenames don't match the descriptions, just match
**by what the photo shows** — that's what the listings reference.

You can verify each by opening:
`https://res.cloudinary.com/dkn6tnxao/image/upload/homesconnect/property-01-karoo-farmhouse.jpg`

Until the images are uploaded, the site shows dark gradient placeholders (no broken-image icons).

---

## Step 3 — Create the Netlify site  (≈ 5 min)

```powershell
cd C:\Users\Admin\Desktop\homesconnect
git init
git add .
git commit -m "feat: HomesConnect demo site — property listing platform with bot"
# Create new GitHub repo "homesconnect" under github.com/stephenearle1972-dotcom and push:
git remote add origin https://github.com/stephenearle1972-dotcom/homesconnect.git
git branch -M main
git push -u origin main

# Create Netlify site
netlify sites:create --name homesconnect --account-slug stephenearle1972
```

Then in the Netlify console for the new `homesconnect` site:

1. **Site settings → Build & deploy → Continuous deployment** → link to the
   new `homesconnect` GitHub repo. (Not vaalwaterconnect — this is its own repo.)
2. **Site settings → Environment variables** — add:

   | Key | Value |
   |-----|-------|
   | `VITE_LISTINGS_CSV_URL` | `https://docs.google.com/spreadsheets/d/e/2PACX-1vSSirf3AzlKaOlve0OyRkDpZh1H3zcl5y94lJvhLl3pJ1gUO1bd-mkBG2tGDSYmR-wQwRFspd4jMaVp/pub?output=csv` |
   | `LISTINGS_CSV_URL` | *(same value — used by the on-site chat function)* |
   | `GEMINI_API_KEY` | *(same value you already use on vaalwaterconnect)* |
   | `GEMINI_MODEL` | `gemini-2.5-flash` *(optional)* |
   | `SITE_URL_HOMESCONNECT` | `https://homesconnect.co.za` |

3. Trigger a fresh deploy from **Deploys → Trigger deploy → Deploy site** (env
   vars only take effect on the next build).

Live URL once deployed: `https://homesconnect.co.za`

---

## Step 4 — Wire up the WhatsApp bot  (≈ 10 min)

The handler is already in vaalwaterconnect: `netlify/functions/homesconnect-handler.js`,
imported and routed in `whatsapp.js`. You just need to flip env vars and redeploy.

**On the `vaalwaterconnect` Netlify site** → Site settings → Environment variables:

| Key | Value | Notes |
|-----|-------|-------|
| `PHONE_MAP_962273166980427` | `homesconnect` | **Was `jeffreysbay`.** This is the switch. |
| `BUSINESS_CSV_URL_HOMESCONNECT` | `https://docs.google.com/spreadsheets/d/e/2PACX-1vSSirf3AzlKaOlve0OyRkDpZh1H3zcl5y94lJvhLl3pJ1gUO1bd-mkBG2tGDSYmR-wQwRFspd4jMaVp/pub?output=csv` | Same sheet as the website |
| `SITE_URL_HOMESCONNECT` | `https://homesconnect.co.za` | |
| `WHATSAPP_DISPLAY_HOMESCONNECT` | `+27 76 795 9872` | |

You **don't** need to add a separate `WHATSAPP_TOKEN_HOMESCONNECT` — the portfolio
fallback (`HOMESCONNECT → TOWNCONNECT`, already in code) routes to your existing
`WHATSAPP_TOKEN_TOWNCONNECT`. Same Meta app as Menlyn, Parklands, etc.

Then commit the vaalwaterconnect changes I made and push:

```powershell
cd C:\Users\Admin\Desktop\vaalwaterconnect
git add netlify/functions/whatsapp.js netlify/functions/homesconnect-handler.js
git commit -m "feat: HomesConnect WhatsApp bot routing (repurposes Jeffreys Bay number)"
git push
```

That triggers a vaalwaterconnect Netlify deploy. After the deploy is green,
the bot is live.

---

## Step 5 — Smoke tests  (≈ 5 min)

### 5a — Browser test the bot before testing on WhatsApp

Once vaalwaterconnect has redeployed:

```
https://vaalwaterconnect.netlify.app/.netlify/functions/whatsapp?homesconnect=1&q=3+bed+in+Durban
```

Should return a Gemini-formatted property list. If it returns "No listings loaded",
the `BUSINESS_CSV_URL_HOMESCONNECT` env var didn't take effect — retrigger deploy.

### 5b — Send real WhatsApp messages

Message the number **+27 76 795 9872** from your phone with each of:

- `Hi`
- `3 bed house in Durban under R2.5M`
- `Houses with a pool in Sandton`
- `Rentals in Cape Town`
- `Property in Vaalwater`

Expected: short, formatted property results — **not** Jeffreys Bay business listings
(plumbers, restaurants etc.). If you see business listings, the PHONE_MAP env var
hasn't redeployed yet — wait or retrigger.

### 5c — Test the website

Open `https://homesconnect.co.za` and verify:

- [ ] Hero loads with property background
- [ ] Pricing shows R99 / R249 / R999 (with 15% VAT note)
- [ ] `/listings` shows 25 properties with working filters
- [ ] Click into a listing — gallery, specs, "Enquire via WhatsApp" button
- [ ] Bottom-right teal chat bubble opens — type "3 bed in Durban", should reply
      with matching properties
- [ ] Footer says "Powered by TownConnect technology"
- [ ] Site looks good on phone (Chrome DevTools → Toggle device toolbar)

---

## Step 6 — Optional: custom domain

When you register `homesconnect.co.za`:

1. Netlify → `homesconnect` site → Domain settings → Add custom domain.
2. Point DNS A record + www CNAME per Netlify's instructions.
3. Update `SITE_URL_HOMESCONNECT` on **vaalwaterconnect** Netlify site
   to `https://homesconnect.co.za`.
4. Update `SITE_URL_HOMESCONNECT` on **homesconnect** Netlify site too.
5. Retrigger both deploys.

---

## Reference — what got built

### homesconnect repo (`C:\Users\Admin\Desktop\homesconnect`)
- Vite + React 18 + TypeScript + Tailwind, dark teal/gold theme
- Pages: `/` (landing), `/listings` (filterable grid), `/listing/:id` (detail)
- Floating Gemini chat widget on every page
- `netlify/functions/chat.js` — on-site bot, fetches CSV, calls Gemini
- `seed/listings_seed.csv` — 25 seed properties, ready to paste

### vaalwaterconnect changes
- `netlify/functions/homesconnect-handler.js` — WhatsApp bot handler (new)
- `netlify/functions/whatsapp.js` — added import, `HOMESCONNECT → TOWNCONNECT` in
  `PORTFOLIO_FALLBACK`, routing branch for `townId === 'homesconnect'`, browser
  test endpoint `?homesconnect=1&q=...`

### Pricing (per the licensing agreement — confirmed)
- Basic R99/mo · Enhanced R249/mo · Agency R999/mo
- "All prices exclude 15% VAT" disclaimer shown

### Acceptance tests from the spec
| Test | Status |
|------|--------|
| Website loads with all sections | ✅ built — verify after deploy |
| Listings page with working filters | ✅ built |
| Individual listing pages | ✅ built |
| On-site bot responds with sheet results | ✅ built — needs `GEMINI_API_KEY` + CSV env |
| WhatsApp bot responds with properties | ✅ built — needs Step 4 env vars |
| Pricing R99/R249/R999 | ✅ confirmed |
| All WhatsApp links → wa.me/27767959872 | ✅ confirmed |
| Mobile responsive | ✅ built — verify on real phone |
| No broken images | depends on Step 2 Cloudinary uploads |
| Footer "Powered by TownConnect technology" | ✅ confirmed |
