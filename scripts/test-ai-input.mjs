import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createAiMiddleware, validateInterpretation } from '../server/ai-api.mjs';
import { presentConcepts } from '../src/ai-input.js';

async function serve(options, run) {
  const middleware = createAiMiddleware(options);
  const server = http.createServer((req, res) => middleware(req, res, () => { res.writeHead(404); res.end(); }));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try { await run(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise(resolve => server.close(resolve)); }
}
const headers = { 'Content-Type': 'application/json', 'X-Symptom-Consent': 'yes' };
const interpretation = { symptoms: [
  { original: 'खोकला', english: 'cough', status: 'present' },
  { original: 'ताप नाही', english: 'fever', status: 'absent' },
  { original: 'कदाचित सूज', english: 'swelling', status: 'uncertain' },
], clarification: 'सूज आहे का?' };
const original = 'खोकला, ताप नाही, कदाचित सूज';

test('unsupported dry cough qualifier is removed and clarification shown', () => {
  const evidence = 'घस्यात खाँसी';
  const result = validateInterpretation({ symptoms: [{ original: evidence, english: 'dry cough', status: 'present' }], clarification: '' }, evidence);
  assert.equal(result.symptoms[0].english, 'cough');
  assert.match(result.clarification, /confirm/);
  for (const wording of ['dry cough', 'कोरडा खोकला', 'सूखी खांसी']) {
    assert.equal(validateInterpretation({ symptoms: [{ original: wording, english: 'dry cough', status: 'present' }], clarification: '' }, wording).symptoms[0].english, 'dry cough');
  }
});

test('xAI credentials are never forwarded to Groq', async () => {
  await serve({ env: { GROQ_API_KEY: 'xai_fake_test_only' }, fetchImpl: async () => { assert.fail('Wrong-provider key must not be transmitted'); } }, async base => {
    const status = await (await fetch(`${base}/api/ai/status`)).json();
    assert.equal(status.configured, false);
    assert.match(status.configurationError, /Groq/);
    const response = await fetch(`${base}/api/ai/interpret`, { method: 'POST', headers, body: JSON.stringify({ text: 'cough', language: 'en' }) });
    assert.equal(response.status, 503);
    assert.match((await response.json()).error, /Groq/);
  });
});

test('present concepts only; no denied, uncertain or duplicate symptoms', () => {
  assert.deepEqual(presentConcepts([...interpretation.symptoms, interpretation.symptoms[0]]), ['cough']);
  assert.deepEqual(presentConcepts([{ english: 'fever', status: 'absent' }]), []);
  assert.deepEqual(validateInterpretation(interpretation, original), interpretation);
  assert.throws(() => validateInterpretation(interpretation, 'unrelated text'));
  assert.throws(() => validateInterpretation({ symptoms: [{ original: 'खोकला', english: 'खोकला', status: 'present' }], clarification: '' }, original));
  assert.throws(() => validateInterpretation({ symptoms: [{ original: 'खोकला', english: 'cough', status: 'maybe' }], clarification: '' }, original));
});

test('missing key, consent and cross-site protections; no secret in status', async () => {
  await serve({}, async base => {
    const status = await (await fetch(`${base}/api/ai/status`)).json();
    assert.equal(status.configured, false);
    assert.equal(status.provider, 'groq');
    assert.deepEqual(status.speechLanguages, ['en', 'hi', 'mr']);
    const response = await fetch(`${base}/api/ai/interpret`, { method: 'POST', headers, body: '{}' });
    assert.equal(response.status, 503);
    assert.equal((await fetch(`${base}/api/ai/interpret`, { method: 'POST' })).status, 403);
    assert.equal((await fetch(`${base}/api/ai/status`, { headers: { Origin: 'https://evil.example' } })).status, 403);
  });
});

test('structured multilingual input goes to provider; rejected input does not', async () => {
  let calls = 0;
  await serve({ env: { GROQ_API_KEY: 'gsk_test-only-secret' }, fetchImpl: async (url, options) => {
    calls++;
    assert.equal(url, 'https://api.groq.com/openai/v1/chat/completions');
    const body = JSON.parse(options.body);
    assert.equal(body.model, 'openai/gpt-oss-120b');
    assert.equal(body.response_format.json_schema.strict, true);
    assert.ok(body.messages[0].content.includes('negation'));
    return Response.json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(interpretation) } }] });
  } }, async base => {
    const result = await fetch(`${base}/api/ai/interpret`, { method: 'POST', headers, body: JSON.stringify({ text: original, language: 'mr' }) });
    assert.equal(result.status, 200);
    assert.deepEqual(await result.json(), interpretation);
    for (const text of ['cough and throat itching', 'खांसी है लेकिन बुखार नहीं', 'khokla aahe pan taap nahi']) {
      // Validate transport in all input forms, not linguistic quality of a mock.
      const response = await fetch(`${base}/api/ai/interpret`, { method: 'POST', headers, body: JSON.stringify({ text, language: 'auto' }) });
      assert.equal(response.status, 502); // Mock's original evidence doesn't occur in this input.
    }
    const before = calls;
    for (const data of [{ text: 'x'.repeat(6001), language: 'en' }, { text: 'cough', language: 'invalid' }]) {
      assert.equal((await fetch(`${base}/api/ai/interpret`, { method: 'POST', headers, body: JSON.stringify(data) })).status, 400);
    }
    assert.equal(calls, before);
    assert.ok(!JSON.stringify(await (await fetch(`${base}/api/ai/status`)).json()).includes('gsk_test-only-secret'));
  });
});

test('audio is forwarded as multipart with multilingual hints, not stored', async () => {
  await serve({ env: { GROQ_API_KEY: 'gsk_test' }, fetchImpl: async (url, options) => {
    assert.equal(url, 'https://api.groq.com/openai/v1/audio/transcriptions');
    assert.ok(options.body instanceof FormData);
    assert.equal(options.body.get('language'), 'hi');
    assert.equal(options.body.get('model'), 'whisper-large-v3');
    assert.equal([...options.body.keys()].at(-1), 'file');
    assert.equal(options.body.get('file').type, 'audio/webm');
    return Response.json({ text: 'खांसी है' });
  } }, async base => {
    const response = await fetch(`${base}/api/ai/transcribe`, { method: 'POST', headers: { ...headers, 'Content-Type': 'audio/webm;codecs=opus', 'X-Symptom-Language': 'hi' }, body: Buffer.alloc(200) });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).text, 'खांसी है');
    assert.equal((await fetch(`${base}/api/ai/transcribe`, { method: 'POST', headers, body: '{}' })).status, 415);
  });
});

test('provider failures do not leak details or key', async () => {
  for (const providerStatus of [401, 429, 500]) {
    await serve({ env: { GROQ_API_KEY: 'gsk_test' }, fetchImpl: async () => Response.json({ error: 'PRIVATE PROVIDER DETAIL' }, { status: providerStatus }) }, async base => {
      const response = await fetch(`${base}/api/ai/interpret`, { method: 'POST', headers, body: JSON.stringify({ text: 'cough', language: 'en' }) });
      assert.equal(response.status, providerStatus === 429 ? 429 : 502);
      assert.ok(!(await response.text()).includes('PRIVATE PROVIDER DETAIL'));
    });
  }
});

test('Marathi speech reaches Groq with the mr language hint', async () => {
  await serve({ env: { GROQ_API_KEY: 'gsk_test' }, fetchImpl: async (url, options) => {
    assert.equal(options.body.get('language'), 'mr');
    return Response.json({ text: 'खोकला आहे' });
  } }, async base => {
    const response = await fetch(`${base}/api/ai/transcribe`, { method: 'POST', headers: { ...headers, 'Content-Type': 'audio/webm', 'X-Symptom-Language': 'mr' }, body: Buffer.alloc(200) });
    assert.equal(response.status, 200);
  });
});

test('hosted AI fails closed without a team code and rejects wrong codes', async () => {
  for (const code of ['', 'a'.repeat(32)]) {
    let calls = 0;
    await serve({ env: { VERCEL: '1', GROQ_API_KEY: 'gsk_test', AI_ACCESS_CODE: code }, fetchImpl: async () => { calls++; } }, async base => {
      const response = await fetch(`${base}/api/ai/interpret`, { method: 'POST', headers, body: JSON.stringify({text:'cough',language:'en'}) });
      assert.equal(response.status, code ? 401 : 503);
      assert.equal(calls, 0);
    });
  }
});

test('old OpenAI credentials cannot enable or receive requests in xAI mode', async () => {
  await serve({ env: { OPENAI_API_KEY: 'old-test-secret' }, fetchImpl: async () => { throw new Error('must not call'); } }, async base => {
    const response = await fetch(`${base}/api/ai/status`);
    assert.equal((await response.json()).configured, false);
  });
});
