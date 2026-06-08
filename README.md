# Invoice Garden

Invoice Garden is a local-first invoice tool for turning Clockify tracked hours into clean monthly invoice PDFs.

## Origin Story

Invoice Garden began as a practical admin problem: tracked hours were already available in Clockify, but turning them into a clean monthly invoice still meant repeated copying, manual weekly calculations, and formatting work in a document template.

The product focuses that workflow into a small, local-first invoice studio. It imports detailed Clockify time data, guides the user through the key invoice details, handles weekly totals and billing-rounding rules, and produces a clean PDF invoice from a live document preview.

The garden direction was chosen to make end-of-month admin feel calmer and more intentional. Instead of adding more instructional copy, the interface uses clear steps, a live invoice preview, and a subtle growing plant indicator to show progress visually.

## Product Story

This is not a broad accounting app. It is a focused tool built around one real workflow: getting to the end of the month and producing a clean invoice with less friction.

The aim was to save time, reduce repeated manual entry, and make the admin moment feel calmer rather than more corporate. Presets handle repeat client details, Clockify import handles tracked time, and the live preview keeps the document itself as the centre of the experience.

## What It Does

- Imports Clockify Detailed CSV reports
- Groups tracked time into weekly invoice lines
- Rounds combined weekly time to 15-minute billing increments
- Lets repeat business/client details be saved as local presets
- Includes a safe built-in demo preset for quick portfolio review
- Shows a live invoice preview while the form is completed
- Grows a subtle potted plant as invoice details are completed
- Exports a clean PDF invoice
- Keeps the app local/browser-based with no backend or login

## Product Decisions

- **Local-first:** personal billing data stays in the browser.
- **Document-led:** the invoice preview is the hero, not the form.
- **Month-first workflow:** the app starts from the invoice period, then moves through business, client, invoice, and work details.
- **Visual guidance:** progress and workflow state are shown through tabs, plant growth, and preview changes rather than lots of helper text.
- **Guardrails over recovery:** input limits, CSV size checks, and PDF capture safety keep the generated invoice layout stable.
- **Small scope:** this is designed for a personal freelance/admin workflow, not full accounting software.

## Polish And Guardrails

Invoice Garden is intentionally small, but it includes a few production-minded details:

- Keyboard-friendly navigation between the main workflow steps
- Local preset names and values capped to sensible lengths
- Invoice text fields capped to protect the preview and PDF layout
- Weekly hour rows capped to realistic invoice ranges
- Oversized Clockify CSV files rejected before parsing
- Favicon, app icon, Open Graph, and GitHub Pages build metadata in place

## Data And Privacy

Invoice Garden runs entirely in the browser.

- No backend
- No login
- No analytics
- No cookies
- No third-party API calls from the app
- Imported CSV files are parsed in-browser and not uploaded
- Presets are stored only in the visitor's browser `localStorage`
- The built-in demo preset uses dummy `.example` contact details and is not written to storage
- Presets can be exported/imported as a small JSON backup when moving between devices, browsers, or local dev ports
- Working invoice values are not restored on reload

The repository is configured to ignore local/private files such as generated invoices, Clockify exports, screenshots, recordings, and local data folders.

## Clockify Import

Use the Clockify **Detailed report** CSV export.

Summary exports are useful for checking totals, but they do not include the entry-level dates needed to split the invoice into weekly lines.

Imported entries are grouped inside each invoice week first, then rounded to the nearest 15-minute increment. This allows small entries to combine before rounding is applied, which better matches the intended billing workflow.

## Tech Stack

- React + Vite
- `html2canvas` and `jspdf` for PDF export
- `lucide-react` for interface icons
- Browser `localStorage` for presets, plus JSON preset backup/import for portability

## Live Demo

Invoice Garden is hosted with GitHub Pages:

```text
https://georgemorden.github.io/invoice-garden/
```

The repository includes a GitHub Actions workflow at `.github/workflows/deploy.yml` that builds and publishes the app whenever `main` is updated.

## Milestone Note

This version is a stable portfolio baseline: Clockify import, local presets, keyboard-friendly workflow, live invoice preview, PDF export, privacy guardrails, and the calmer visual direction are all in place.
