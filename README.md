# Maadhavi — bridal & wedding makeup website

A demo build by **Aadhirai Innovations**. Static site — plain HTML, CSS and vanilla JS,
no framework, no build step. Conventional business-site structure: hero → trust bar →
why-choose → services → looks → process → portfolio → pricing → reviews → about →
FAQ → CTA → contact → footer.

```
site/
├── index.html          one page, all sections
├── css/styles.css      design tokens (+ 4 colour themes) and every section
├── js/main.js          theme, menu, tabs, filter, accordion, map, pricing→form, booking→WhatsApp
├── images/             photography + CREDITS.md
└── README.md
```

## Run it

Open `index.html` in a browser, or serve the folder:

```bash
cd site
python -m http.server 8080      # then http://localhost:8080
```

## Sample data

The artist name (**Anitha Sundaram**), prices, phone, Instagram, studio address,
review names and the 4.9 / 96-review figures are **illustrative sample values** so the
demo reads as a finished site. Replace them with the real details before launch.

## Colour theme

A visitor-facing **theme picker** sits in the header (and the mobile menu) — four
directions built from the brief palette: **Traditional** (oxblood + temple gold),
**Jewel** (peacock emerald leads), **Soft** (rose-nude, lighter), **Gold-forward**.
The choice is remembered per visitor in `localStorage`. Themes are defined as
`:root.t-*` blocks at the top of `css/styles.css`; to ship a single fixed palette,
delete the picker (`.theme` markup + the `themeSwitch()` call) and keep only the
`:root` block you want.

## Before it goes live — edit these

1. **`js/main.js` → `CONFIG`** (top of file): `whatsapp` (country code + number, digits
   only), `email`, `instagram`. The Send-on-WhatsApp button and every contact link
   read from this. Prices for the Services tabs are in the `SERVICES` array lower down.

2. **`index.html`** — swap the sample name, address, prices, review names and stats,
   and the `application/ld+json` block near the top of `<head>` (business schema for
   local search — keep it in sync with the visible details).

3. **Photography.** The images in `images/` are placeholders from Wikimedia Commons,
   licensed **CC BY-SA** — see `images/CREDITS.md` for the required attribution.
   Replace them with the studio’s own portfolio, keeping the same filenames and crops:

   | file | slot | crop |
   |------|------|------|
   | `hero.jpg` | hero portrait | 4:5, ~1000×1250 |
   | `look-1…4.jpg` | the four looks | 3:4 (feature `look-1` is ~760×1000) |
   | `work-1…6.jpg` | portfolio masonry | mixed — keep each aspect |
   | `craft.jpg` | About | landscape ~1200×800 |
   | `og.jpg` | social share card | 1200×630 |

## The booking form

No server. It validates, then opens `wa.me/<number>` (or the mail app) with the
enquiry pre-filled — the right flow for a one-person studio. To collect submissions
in an inbox later, wrap the `<form>` with Formspree or Netlify Forms; the fields are
already named.

## Deploy

Upload the contents of `site/` to any static host — Netlify, Vercel, Cloudflare
Pages, GitHub Pages, or plain shared hosting. No env vars, no Node runtime.

## Notes

- The hero animation and every scroll reveal fully freeze under “reduce motion”.
- Keyboard focus is visible throughout; the drawer and lightbox close on `Esc`.
- Fonts load from Google Fonts with system fallbacks; self-host later if you want
  zero third-party requests.
- The small “Demo build · Aadhirai Innovations” tag, bottom-left, is a marker for
  this spec build — delete the `.demo-tag` element in `index.html` (and its CSS)
  for the client’s live site.
