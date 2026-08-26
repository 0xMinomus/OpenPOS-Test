# OpenPOS — Brand Spec (from xAi-Design.md)

Warm cream laboratory with a black pill — a restrained near-monochrome editorial system on a warm-white canvas. Type leads; a single jet-black filled pill is the only high-contrast element; cream surfaces carry elevation without shadows.

## Tokens (OKLch, converted from xAi-Design.md hex)

| Token | OKLch | Source |
|---|---|---|
| `--bg` | `oklch(1 0 0)` | Paper `#ffffff` — page canvas |
| `--surface` | `oklch(0.981 0.003 85)` | Cream `#f9f8f6` — cards, raised panels |
| `--fg` | `oklch(0.178 0 0)` | Jet Ink `#0a0a0a` — primary text, filled CTA |
| `--muted` | `oklch(0.479 0 0)` | Steel `#545454` — reading-gray body text |
| `--border` | `oklch(0.876 0.009 254)` | Dove `#d5d9e2` — hairlines, focus rings |
| `--accent` | `oklch(0.178 0 0)` | Jet Ink — the primary action fill |

## Typography

- Display: `'Geist'` (universalSansDisplay substitute) — weight 400, line-height 1.0–1.05, tracking -0.025em at 48–72px
- Body / UI: `'Geist'` (universalSans substitute) — weights 400 / 500
- Mono: `'Geist Mono'` (GeistMono substitute) — terminal mocks, metadata, eyebrows, tabs, spec lines

## Observed rules

1. Monochrome ink-first — the jet pill is the only filled CTA; never substitute a chromatic button or link color.
2. Cream layered surfaces — elevated surfaces are `#f9f8f6` on the `#ffffff` page; depth from a single 1px `#d5d9e2` hairline, never shadow stacks.
3. Anti-bold editorial headlines — display at weight 400 with ~1.0 line-height and -0.025em tracking; authority through size and restraint, not weight.
4. Binary radii — pills (9999px) for every button/tag/tab, 16px cards, 6px inputs; no intermediate rounding.
5. GeistMono marks technical territory (terminal mocks, tabs, metadata, spec lines); decorative warmth only from the coral orb (`#ffa888 → transparent`, 64px blur) and terminal traffic-light dots.
