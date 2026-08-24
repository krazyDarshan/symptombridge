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
- Additional symptoms are matched and scored separately before whole-case ranking.
- Word-boundary matching prevents short terms from matching inside unrelated words.
- Rare and specific terms carry more weight than common words.
- Exact phrases, word order, historical synonyms and modalities refine the score.
- Missing symptoms lower a remedy's whole-case alignment.
- Source emphasis adds a controlled ranking boost after textual relevance.
- When no individual remedy covers the whole set, comparison groups show how two or three source remedies cover different symptoms.
- Every result shows the supporting source wording and PDF page.

The ranking and multi-remedy groups are transparent retrieval aids. They are not diagnoses, clinical probabilities, prescriptions or instructions to combine remedies.

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

## Local records

Patient and consultation records are stored locally in the browser's IndexedDB database. This keeps the standalone prototype independent from a hosting provider, but it is not a replacement for a secured, access-controlled clinical database. Do not treat the local prototype as production-ready storage for sensitive records.
