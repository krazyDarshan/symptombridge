# SymptomBridge frontend

React and Vite interface for source-linked Materia Medica remedy review.

## What is connected

The remedy finder uses the complete structured dataset:

- 77 remedy preparations
- 32,031 numbered symptoms
- Source-priority levels derived from the PDF's bold typography
- Original symptom wording, emphasized wording and source page references

`scripts/build_search_index.py` reads the application-ready SQLite database from `../outputs/materia_medica_dataset/materia_medica.sqlite` and creates the compact browser files in `public/data/`.

## Search behaviour

- Remedy candidates update while a symptom is being typed.
- Pressing Enter confirms the current symptom.
- Additional symptoms are scored separately.
- Remedies matching more of the confirmed symptoms stay above partial matches.
- Source emphasis adds a controlled ranking boost after textual relevance.
- Every result shows the supporting source wording and PDF page.

The ranking is a transparent retrieval aid. It is not a diagnosis, clinical probability or treatment recommendation.

## Local development

```bash
npm install
npm run dev
```

Rebuild the browser search index after the SQLite dataset changes:

```bash
npm run data:build
```

Create a production build:

```bash
npm run build
```

## Current persistence boundary

The Materia Medica dataset is connected and searchable. Patient and consultation screens remain presentation-ready until the team connects the separate secure operational database and authentication layer. Patient records should not be written into the read-only Materia Medica reference database.
