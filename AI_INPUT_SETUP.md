# Groq input setup

Set GROQ_API_KEY privately in .env.local using .env.example as a template. Never prefix secrets with VITE_. Existing Groq keys under the old XAI_API_KEY name work for compatibility; xAI credentials are not accepted.

Run npm install and npm run dev. Enable AI languages after reading the consent prompt. Type English, Hindi, Marathi or mixed-language descriptions, or press the microphone, speak, and press Stop. Review the transcript and interpretation. Microphone permission and HTTPS (or localhost) are required. Recordings stop after 60 seconds and are limited to 4 MB.

## How it works

- Groq whisper-large-v3 transcribes audio with a language hint or automatic detection.
- Groq openai/gpt-oss-120b interprets text into validated English concepts, separating present, absent and uncertain symptoms. The model runs through Groq, not the OpenAI API.
- Only present concepts reach the dataset search. The LLM does not prescribe or decide how many treatments to use.
- Source passages remain in English. The interface is not fully translated.
- Audio is processed in memory. Patient profiles are not sent automatically. Obtain consent and omit identifying information; provider retention policies still apply.

## Vercel

Import the GitHub repository as a Vite project with the repository root as its root directory. vercel.json handles navigation; api/ai/[action].js serves the API.

Configure server-side environment variables in Vercel:

1. GROQ_API_KEY: your existing key.
2. AI_ACCESS_CODE: a random secret of at least 24 characters, shared privately with trusted teammates. Enter it in the Team AI code field. It remains in browser memory only.
3. Optional GROQ_TEXT_MODEL and GROQ_TRANSCRIBE_MODEL overrides.

Redeploy after changing variables. Missing access configuration disables hosted AI. English dataset search remains available. Set provider spending limits before sharing. The in-process request limit is a best-effort safeguard, NOT a global spending cap across serverless instances. A shared code is for a small trusted demo, not production clinical authentication.

Patient records remain in each browser's IndexedDB and are not shared across devices. Do not use identifiable patient records in this demo. GitHub and Vercel collaborator permissions are separate from access to the app.

## Verification

Run npm run test:ai, npm run test:search, npm run test:expansion, and npm run build.

Live synthetic English, Hindi and Marathi text tests returned valid interpretations with denied fever excluded. Automated tests cover audio transport, Marathi hints, invalid input, cross-site checks, team-code protection and provider failures. Actual microphone recordings, accents and clinical accuracy still require human testing. Source-match scores are not clinical accuracy.

References: https://console.groq.com/docs/structured-outputs and https://console.groq.com/docs/speech-to-text
