# Te Quiero — Design System

**Te Quiero** is a Spanish jewelry retailer founded in **1988** on the Canary island of **Tenerife**, where it operates **17 stores** across the island. The brand specializes in **gold, silver, and diamonds** — buying, selling, and consigning — and is built around a single counter-elitist idea: fine jewelry belongs to everyone, not just to a wealthy few.

> **Tagline:** *Reivindicando el valor de lo accesible desde 1988.*
> (Reclaiming the value of what is accessible, since 1988.)

Te Quiero's brand voice is **proud, honest, emotional**. The brand book puts it as: *"Lo accesible no es barato, es valioso. Lo auténtico no tiene por qué ser exclusivo."* ("Accessible isn't cheap — it's valuable. Authentic doesn't have to be exclusive.") The name itself — Spanish for *"I love you"* — sets the emotional temperature. The wordmark fuses a heart (*lo emocional — el amor*) with an infinity loop (*lo racional — lo infinito, durabilidad del oro y la plata*). Heart + forever.

---

## Sources

| Source | Location | Notes |
|---|---|---|
| Brand manual (PDF, 26pp, Spanish) | `uploads/brand_manual.pdf` | Original: *TeQuiero_ManualIdentidadVisual_v4.pdf*. Rendered to `uploads/pdf_pages/page_XX.png`. Text is outlined — extracted colors via path ops, identity from page renders. |
| Primary logo | `uploads/Logo_Azul (1) (4).svg` → `assets/logo.svg` | Horizontal wordmark with integrated heart+infinity glyph, in Sky Blue. |
| Pattern (AI) | *Not found — file `TeQuiero_Pattern.ai` was listed in the brief but was not present in `uploads/`.* | We reconstructed the pattern by high-res rendering page 2 of the PDF → `assets/pattern_full.png` / `assets/pattern_hires.png`. **Please re-attach the `.ai` file for a cleaner vector pattern.** |
| Brand fonts | `fonts/` | Poppins (full family) and Zodiak (Regular / Italic / Black / BlackItalic / Variable / Variable Italic). All licensed and bundled with the brand kit. |
| Figma, codebase | *None provided.* UI kit recreations are based on the identity in the manual + typical jewelry-retailer e-commerce patterns. Flagged per-component. |

---

## Index

```
├── README.md                 ← this file
├── SKILL.md                  ← Agent SKills front-matter for Claude Code
├── colors_and_type.css       ← tokens + font-face + semantic defaults
├── fonts/                    ← Poppins + Zodiak
├── assets/
│   ├── logo.svg              ← primary horizontal wordmark (Sky Blue)
│   ├── icon_navy.png         ← transparent isotipo, Snorkel Blue
│   ├── icon_cream.png        ← transparent isotipo, Alyssum cream
│   ├── icon_<bg>_on_<fg>.png ← four official colorways on colored tiles
│   ├── pattern_full.png      ← tileable heart+infinity pattern (Sky on Alyssum)
│   └── pattern_hires.png     ← higher-resolution pattern
├── preview/                  ← design-system review cards (rendered in the Design System tab)
├── ui_kits/
│   └── ecommerce/            ← Te Quiero online store recreation
│       ├── README.md
│       ├── index.html        ← clickable prototype
│       └── *.jsx             ← Header, Hero, ProductCard, PDP, Cart, Footer, …
└── uploads/                  ← original source files (read-only)
```

---

## Content Fundamentals

### Language & address

- **Primary language: Spanish (Castilian).** All official copy in the manual is in Spanish; translations should keep the warmth and rhythm of Spanish — avoid flat, literal English.
- **Inclusive address.** The brand deliberately writes **`tod@s`** (not *todos*) to signal inclusivity across gender. Lean into this — the brand's gender-inclusive voice is a stated value, not a trend.
- **Informal "tú", not "usted".** Te Quiero addresses you as a friend, not a customer with a capital C. Mirror this in English with first-name, second-person warmth.

### Tone

Four words, in priority order: **proud, honest, emotional, close.** Slightly more editorial than e-commerce-generic. The manual describes the brand as *"una aliada cotidiana. Cercana. Transparente."* — an everyday ally, close, transparent. Write like that.

- **Proud, not defensive.** When talking about accessibility or price, never apologise. Lead with the idea that accessible *is* valuable.
- **Honest about craft and origin.** Oro, plata, diamantes. Say what things are made of. Say where they're from. Don't hide behind marketing nouns ("creations," "pieces"); say *anillo*, *cadena*, *sello*.
- **Emotional but not saccharine.** The brand is called *I love you* — you can be tender, but never cute. No hearts-and-flowers. Let the heart+infinity mark carry the sentiment; the words stay grounded.
- **Close / conversational.** Short sentences. Direct verbs. A little asymmetry in phrasing is good.

### Casing

- **Sentence case everywhere** for headlines and UI. *No* Title Case.
- **UPPERCASE** only for very short eyebrows / labels (`NOVEDADES`, `17 TIENDAS EN TENERIFE`) — with wide letter-spacing (~0.14em).
- Numerals inline with words: *"Desde 1988"*, *"17 tiendas"*. Prices use European format: `1.250,00 €` with the `€` after a non-breaking space.

### Example copy, right vs wrong

| 👍 On-brand | 👎 Off-brand |
|---|---|
| *"Oro de 18k, para ti y para tod@s."* | "Premium 18k gold — luxury redefined." |
| *"Nació en 1988 con una idea revolucionaria: acercar el oro a todo el mundo."* | "A legacy brand bringing timeless elegance since 1988." |
| *"Lo accesible no es barato, es valioso."* | "Affordable luxury." |
| *"Pásate por una de nuestras 17 tiendas."* | "Visit our premium boutique locations." |
| *"Un sello que te acompaña siempre."* | "A piece that tells your unique story." |

### Emoji, icons, punctuation

- **No emoji.** The brand has its own emotional glyph — the heart+infinity isotipo. That does the work an emoji would otherwise do.
- **No unicode decoration** (❤, ✨, •). Use the `isotipo` asset when you need a brand-flavored bullet.
- **Em dashes are fine**, used sparingly, in the Spanish/European style (` — `).
- **Exclamation marks are rare.** At most one per screen. Te Quiero is warm, not shouty.

---

## Visual Foundations

### Palette

Four colors, used in specific roles. No gradients. No extra accent colors invented by downstream designers.

| Token | Hex | Pantone | Role |
|---|---|---|---|
| **Snorkel Blue** | `#00557f` | 19-4049 TCX | Primary dark. Text on cream, dark surfaces, dark mode of wordmark. |
| **Sky Blue** | `#0099f2` | 2193 C | Primary bright. **The color of the logo**, accents, the pattern, buttons, links. The brand's "voice color." |
| **White Alyssum** | `#e8e3df` | 11-1001 TCX | Warm off-white. **Default background**, not pure white — this is critical. |
| **Gold** | `#c8a164` | 7562 C | Jewelry accent. Used sparingly — product highlights, metallic treatments, "oro" moments. |

Supporting neutrals: `#1d1d1b` ink, `#c6c6c6` / `#b2b2b2` grays, `#ffffff` pure white, `#000000` black. White is allowed for e-commerce product photography surfaces; Alyssum is for brand surfaces.

### Typography

Two families. Don't add a third.

- **Zodiak** — display / headlines / editorial moments. A contemporary high-contrast serif with warm, slightly weird terminals. Pairs with jewelry's "timeless-but-modern" promise. Use at **H1 and H2** sizes and for big editorial quotes. Italic Zodiak is the house italic.
- **Poppins** — body copy, UI, labels, prices, fine print. Geometric, friendly, confident. H3 and below are Poppins.

Don't mix serifs inside a single block of body copy. Zodiak is a magazine — it's for arriving, not for scanning.

**Hierarchy cheat-sheet**
- Hero: Zodiak 64–88px, weight 700, line-height 1.05, tracking –0.01em, color Snorkel.
- Section title: Zodiak 36–48px, weight 700.
- Eyebrow: Poppins 12px, weight 700, UPPERCASE, tracking 0.14em, color Snorkel.
- Body: Poppins 16px, weight 400, line-height 1.6.
- Price: Poppins 18–22px, weight 600, tabular-nums.

### Backgrounds

- **Default is warm cream `#e8e3df`, not white.** Pure white reads as "generic e-commerce"; cream reads as Te Quiero.
- **Full-bleed hero blocks** in Snorkel or Sky are used in the manual. When you go full-bleed-color, the wordmark flips to Alyssum cream. Keep 96px+ of interior padding on hero blocks at desktop.
- **Pattern block:** the repeating heart+infinity pattern (`assets/pattern_full.png`) is used as a section divider or accent band. Sky isotipos on cream ground. Do not tint it to other color combinations — those aren't sanctioned in the manual.
- **No gradients.** The brand is flat-color by design; a gradient will instantly make it look fake.
- **No photography overlays / stock imagery backgrounds.** When you have product photos, show them on cream or on a neutral studio white; don't composite them into atmospheric scenes.

### Imagery vibe

- **Warm, natural light.** Slight warmth in the whites. The cream palette extends into the photography.
- **Product-forward.** Jewelry is the hero — tight, uncluttered crops on plain cream or white ground. Occasional styled hand / wrist / ear shots, but the metal stays centered.
- **Not cool / not clinical.** Avoid ice-blue, avoid pure-white "Apple" studio looks. Avoid heavy grain / film emulation. Avoid high-contrast b&w.
- **No AI-slop gradients or abstract backdrops** — ever.

### Borders, corners, cards

- **Radii are modest.** 10–16px on cards, 6–10px on buttons / inputs, `999px` pill for small chips. Nothing heavier than 24px.
- **Borders are quiet.** 1px, 15% Snorkel. Never colored-accent borders. Absolutely no "colored left-border + soft gray card" trope.
- **Cards are flat** on cream. Elevation via shadow only when the card needs to *lift* (modal, hover-to-detail). Default product cards sit flat on the cream ground, separated by whitespace.

### Shadows

Cool-shifted (blue-ish, not neutral gray). Low and soft.

- `xs` — `0 1px 2px rgba(0,32,60,.06)`  (inputs, quiet separation)
- `sm` — `0 2px 6px rgba(0,32,60,.08)`  (card at rest)
- `md` — `0 8px 20px rgba(0,32,60,.10)` (card on hover)
- `lg` — `0 20px 40px rgba(0,32,60,.14)` (popovers, dialog)

### Motion

Understated and purposeful. The brand isn't trendy; it's been here since 1988.

- **Durations:** 120ms (tiny state flips), 200ms (most UI), 360ms (hero / image reveals). Never over 500ms.
- **Easing:** `cubic-bezier(.4,0,.2,1)` default. Ease-out for entrances.
- **Enter:** opacity 0 → 1 + 8px translate-up. That's the house animation.
- **Hover on product imagery:** gentle 1.02 scale over 360ms. No ken-burns.
- **No bounces, no springs, no parallax, no confetti.** Jewelry doesn't jiggle.

### States

- **Button hover:** background darkens 8–12% (Sky → `#0086d9`). No size change.
- **Button press:** same color, shadow drops one step. No shrink.
- **Link hover:** color shifts from Sky to Sky-dark; underline stays.
- **Product card hover:** shadow `sm → md`, image scales 1.02, label color stays. No colored border on hover.
- **Focus:** 2px Sky outline at 2px offset. Always visible; never removed.
- **Disabled:** 40% opacity. Never grayed-out with a different hue.

### Transparency & blur

- **Sparing.** Transparent navbars are fine over a cream hero but become solid-cream the moment the user scrolls 24px.
- **No backdrop-blur glassmorphism.** Out of character.

### Layout

- **12-column grid at desktop**, 1280–1440 content max. Left margin typically = 96px at desktop, 24px at mobile.
- **8pt spacing.** Every gap divisible by 8 (or 4 at tightest).
- **Asymmetry is the house move** — the manual uses a skinny left column for copy and a larger right "plate" for image / logo / color-field. Embrace that rhythm; don't center everything.
- **Wordmark placement in hero compositions: lower-third or right-plate, never dead-center** (except for standalone splash screens).

### Icon system

- **The isotipo is the one icon.** The brand's own heart+infinity glyph is the star. Don't flood the UI with small icons — it dilutes the mark.
- **For functional UI icons** (cart, search, menu, user), we use **Lucide** at 20–24px, 1.5px stroke. Lucide is CDN-available and matches the clean, geometric spirit of Poppins. *This is a substitution — no icon set is sanctioned in the manual. Flag to the user if production will require a custom set.*
- **Rendering:** UI icons inherit `currentColor` and default to Snorkel. Never fill them with Sky except when they are pressed / active.
- **No emoji.** No unicode decorative chars.

### Logo / isotipo usage

- **Clear zone:** equal to the height of the "O" in Te Quiero on all four sides.
- **Minimum size:** print 6cm wide · digital 170px wide (from manual page 15).
- **Never** warp, rotate, recolor to a non-brand color, or place over busy imagery without a solid swatch behind.
- **Official colorways:** Snorkel on Alyssum · Alyssum on Snorkel · Alyssum on Sky · Alyssum on Gold. Black-only and white-only are permitted for reproduction constraints (page 13).

---

## Known caveats & substitutions

- **`TeQuiero_Pattern.ai` was not found in uploads.** Pattern asset reconstructed by rendering the PDF pattern page. Re-attach the vector for production fidelity.
- **No codebase, no Figma.** The e-commerce UI kit is an interpretation of the identity applied to a standard jewelry-retailer information architecture. Treat as a hi-fi starting point, not a 1:1 mirror of an existing site.
- **No custom product icon set** is specified in the manual — we're using **Lucide** for functional UI iconography.
- **Isotipo SVG vector** was not cleanly extractable from the outlined PDF; we exported high-resolution transparent PNGs (`icon_navy.png`, `icon_cream.png`) from the brand manual. If a native `.svg` or `.ai` of the isotipo exists, please attach.
