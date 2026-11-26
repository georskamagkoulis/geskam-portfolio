# Portfolio

My portfolio: websites, bookings and automations for local businesses. Built the same way as the
Afra's Chop Shop site: one data file, page templates, a small build script, tests and automatic
publishing.

## Fill in your details first

Edit `data/site.json`:

- `person.name`: replace `[Το όνομά σου]` with your name.
- `contact.email`, `contact.instagram`, `contact.linkedin`: fill in the ones you want to show
  (full links starting with `https://` for Instagram and LinkedIn). Empty ones are not shown.
- `person.photo` (optional): e.g. `assets/img/me.jpg`, after you add the photo to that folder.
- `testimonial` (optional): only a real quote that the client has agreed to share.

Then commit and push. Every `npm run build` reminds you of anything still missing.

## Changing the content

Everything is in `data/site.json`: services, projects (`work`), the steps, the FAQ and the "about"
text. Add a project by adding an item to `work`, with its screenshot in `assets/img/`.

## How the files fit together

- `data/site.json`: the single source of truth.
- `src/*.html`: page templates with `{{placeholders}}`; `src/partials/` are the shared pieces
  (`head`, `header`, `footer`) pasted in with `{{> name}}`.
- `build.mjs`: fills the placeholders, builds the lists (services, projects, FAQ) and writes the
  finished pages, `sitemap.xml` and `robots.txt`. It stops without writing anything if the data is
  wrong (bad email, a missing image, …). Needs Node.js 18+, nothing to install.
- `css/main.css`: the design (light, with a dark version for phones in dark mode).
- `tests/`: `npm test`. The GitHub Action runs them before every deploy.
- The finished pages are not in git; `npm run build` makes them for a local preview.

## Preview on your computer

`npm run build`, then in this folder `python3 -m http.server 8000` (or `npx http-server -p 8000`)
and open http://localhost:8000/.

## Publishing

`.github/workflows/deploy.yml` tests, builds and publishes on every push to `main`.
One-time setup: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

Optional visitor statistics without cookies: put a GoatCounter code in `analytics.goatcounterCode`.
