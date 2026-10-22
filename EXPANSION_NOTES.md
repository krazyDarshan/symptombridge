# Source expansion and reviewed dictation

Original index remains unchanged and is the default. Remedy Finder offers a
both-books preview: 108 preparations, 72,473 source rows. Chronic Diseases adds
47 remedy sections and 40,442 extracted entries from 1,302 PDF pages.
New entry numbers are generated identifiers, not printed symptom numbers.
Source spelling is preserved. Neutral priority is used because typography-based
emphasis has not been established in the new edition. Practitioner audit of
wording, section boundaries and remedy equivalences remains pending.

The extractor excludes prefaces and uses explicit symptom-start overrides.
Extraction and integration summaries are in outputs/chronic_diseases_dataset.
The original dataset and original validation workbook are not overwritten.

## Commands (from frontend)

    python scripts/extract_chronic_diseases.py "C:/Users/darsh/Downloads/HAHNEMANN S., Chronic Diseases-4.pdf"
    npm run data:combine
    npm run test:search
    npm run test:expansion
    npm run build

Rebuild the combined index after changing either source. Do not overwrite a
practitioner-edited validation workbook by rerunning its generator.

## Input limitations

The former browser-speech/glossary panel has been replaced by an inline mic
and server-side xAI (Grok) transcription/structured interpretation. See
AI_INPUT_SETUP.md for API key setup, privacy boundaries and live evaluation.
The old glossary module remains only for legacy regression tests, not the UI.
Original wording is retained in symptom inputs; source evidence and dataset
version are saved with selected-remedy records. Source passages and navigation
remain English. Language interpretation still requires practitioner review.

## Verification

Original search regressions, expanded index checks, basic Hindi/Marathi cases,
unknown-word detection, duplicate-score invariance and production build pass.
AI API mock tests also pass. Live English browser search and missing-key error
handling have been checked. Actual microphone recognition, language quality,
permission handling and patient-save flow still need end-to-end evaluation
with a configured key and consented test input. No existing patient records
were changed.

This is source retrieval, not reinforcement learning or clinical validation.
Do not apply the previous 96% technical benchmark to the expanded index or
speech/language features. Multilingual interpretation now has an API-backed
implementation, but live language evaluation and a privacy/deployment decision
are still needed before clinical use.
