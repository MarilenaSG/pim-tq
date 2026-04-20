---
name: te-quiero-design
description: Use this skill to generate well-branded interfaces and assets for Te Quiero Joyerías (a Tenerife-based jewelry retailer founded in 1988), either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping.
user-invocable: true
---

Read the `README.md` file within this skill first — it covers brand context, content fundamentals, visual foundations, and iconography.

Then explore the other available files:
- `colors_and_type.css` — CSS variables for color tokens, type scale, spacing, radii, shadows, motion; plus `@font-face` and semantic defaults for `h1`–`h4`, `p`, `.tq-eyebrow`, etc.
- `fonts/` — bundled Poppins (body) and Zodiak (display) families.
- `assets/` — logo SVG, isotipo PNGs in the four official colorways (transparent + tiled), and the pattern at high resolution.
- `ui_kits/ecommerce/` — a clickable React/JSX hi-fi recreation of a Te Quiero storefront (Header, Hero, CategoryStrip, ProductCard, PDP, Cart, Footer).
- `preview/` — small cards that illustrate each token system in isolation.

**When creating visual artifacts** (slides, mocks, throwaway prototypes, decks, social posts, etc.), copy the assets you need out of `assets/` and `fonts/`, import `colors_and_type.css`, and output static HTML files. The brand language is Spanish; prefer Spanish copy unless the user specifies otherwise, and always use inclusive forms like `tod@s`.

**When working on production code**, you can read these files as guidance and port the tokens / CSS variables into the target codebase.

**If the user invokes this skill without any other guidance**, ask them what they want to build or design, ask a few clarifying questions (audience, medium, Spanish vs English, product focus), and then act as an expert designer who outputs HTML artifacts *or* production code, depending on the need.

Key non-negotiables to respect:
- Default background is warm cream `#e8e3df` (Alyssum), not pure white.
- The logo is Sky Blue `#0099f2`; the text and UI "ink" color is Snorkel Blue `#00557f`.
- Two type families only: **Zodiak** for H1/H2 and editorial moments, **Poppins** for everything else.
- No emoji, no gradients, no glassmorphism, no colored-left-border card tropes.
- The heart+infinity isotipo is the one brand glyph — don't dilute it with decorative icons.
