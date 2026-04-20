# Te Quiero — E-commerce UI Kit

A hi-fi recreation of how a Te Quiero online store would look, built on the brand tokens in `../../colors_and_type.css`.

## Scope

Interactive single-page `index.html` with five views you can click through:

1. **Home** — hero, editorial category grid, featured products, pattern band, trust row.
2. **PLP (Product Listing)** — category, filters, product grid.
3. **PDP (Product Detail)** — image, material / size picker, price, description.
4. **Cart** — line items, totals, checkout CTA.
5. **Account / Login** — simple form with brand dressing.

## Components

| File | What it is |
|---|---|
| `Header.jsx`        | Desktop header: wordmark, category nav, search / account / cart |
| `Hero.jsx`          | Split hero (cream left column + Snorkel / Sky right plate) |
| `CategoryStrip.jsx` | Editorial 4-up category tiles |
| `ProductCard.jsx`   | Cream card, eyebrow + name + price, subtle hover lift |
| `ProductGrid.jsx`   | Responsive grid of ProductCard |
| `PDP.jsx`           | Product detail layout |
| `Cart.jsx`          | Slide-out cart drawer |
| `PatternBand.jsx`   | Full-bleed pattern stripe as a section divider |
| `Footer.jsx`        | Cream footer, four columns, 17-tiendas pitch |

> **Caveat.** No Te Quiero website or Figma was provided — this kit is *the brand identity in the manual applied to a standard jewelry-retailer IA*. It is a high-fidelity starting point, not a mirror of an existing site. Product imagery uses the brand isotipo as a placeholder; swap to real photography before shipping.
