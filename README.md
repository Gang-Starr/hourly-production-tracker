# Hourly Production Tracker

Hourly Production Tracker is a standalone browser-based prototype for recording hourly production targets, achieved quantities, production gaps, loss reasons and corrective actions.

## Main functions

- Fast hourly data entry for date, shift, project, product, machine or production line, time slot, target, produced quantity, scrap and downtime.
- Automatic calculation of good quantity, deviation, lost quantity and target achievement.
- Traffic-light status logic: green for 100% or more, yellow from 90% to below 100%, red below 90%.
- Structured loss analysis by main category and detailed reason.
- Editable overview table with filtering, sorting by date and time slot, edit and delete functions.
- Shift summary with totals, downtime, periods below target and main loss information.
- Collapsible chart area for hourly, cumulative, Pareto and downtime views.
- Editable master data for projects, products, machines and detailed loss reasons. Shifts and teams are fixed system values used in entry forms, filters and exports.
- CSV export, JSON backup, JSON restore, deletion of all production data and restoring default master data.

## Local data storage

The application has no backend, no database and no login. Production entries, master data and the selected language are stored only in the browser using `localStorage`.

## Supported languages

- English (default)
- German
- Italian

The language selector changes visible labels, buttons, messages, table headings, information texts and CSV headings.

## How to run locally

Open `index.html` directly in a modern browser, or start a small static server from this folder:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## GitHub Pages deployment

1. Commit `index.html`, `styles.css`, `app.js` and `README.md` to the repository.
2. Push the branch to GitHub.
3. In the repository settings, enable GitHub Pages.
4. Select the branch and root folder as the publishing source.
5. Open the generated GitHub Pages URL.

No build step is required.

## Privacy note

Do not enter confidential company information, real machine data or personal data. All data remains in the local browser storage unless the user explicitly exports it.

## Prototype status

This is a first working prototype intended for validation and improvement. It is not a validated production or quality management system.
