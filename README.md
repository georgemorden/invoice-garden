# Invoice Garden

Simple invoice generation for freelancers, with a calm, garden-inspired UX.

Invoice Garden is a free, browser-based invoice tool for creating clean monthly invoice PDFs. Enter work manually, use saved presets, or import tracked hours from Clockify.

As the invoice takes shape, a small potted plant grows with your progress 🪴

## Live Demo

https://georgemorden.github.io/invoice-garden/

Try it without an account. Presets are stored locally in your browser only, not in the cloud.

## What It Does

* Supports manual invoice entry
* Imports Clockify Detailed CSV reports
* Groups tracked time into weekly invoice lines
* Rounds weekly totals to 15-minute billing increments
* Saves repeat business and client details as local presets
* Shows a live invoice preview
* Exports a clean PDF invoice
* Uses a potted plant visual to show invoice progress
* Runs entirely in the browser, with no backend or login

## Why I Built It

I built Invoice Garden to replace a repetitive monthly admin workflow: copying time entries, calculating weekly totals, updating a document template, checking formatting, and exporting manually.

It is not a full accounting app. It is a focused tool for one real freelance invoicing workflow, built to make the process faster, calmer, and easier to check.

## Privacy

Invoice Garden runs fully in the browser.

* No backend
* No login
* No analytics
* No cookies
* No third-party API calls
* CSV files are parsed locally and not uploaded
* Presets are stored only in browser localStorage

## Tech Stack

* React
* Vite
* html2canvas
* jsPDF
* lucide-react
* GitHub Pages
* GitHub Actions
