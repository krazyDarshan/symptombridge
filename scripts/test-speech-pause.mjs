import test from 'node:test';
import assert from 'node:assert/strict';
import { createPauseDetector } from '../src/speech-pause.js';

test('silence without speech does not upload', () => {
  const detect = createPauseDetector();
  for (let t = 0; t < 12000; t += 100) assert.equal(detect(0.001, t), null);
  assert.equal(detect(0, 12000), 'no-speech');
  assert.equal(detect(0, 12100), null);
});
test('brief click does not count as speech', () => {
  const detect = createPauseDetector();
  detect(0, 0); detect(0.8, 100);
  for (let t = 200; t < 12000; t += 100) assert.equal(detect(0, t), null);
  assert.equal(detect(0, 12000), 'no-speech');
});
  test('language-independent energy: short pause, more speech, automatic stop once', () => {
    const detect = createPauseDetector();
    for (let t = 0; t <= 1000; t += 100) assert.equal(detect(0.04, t), null);
    for (let t = 1100; t <= 3000; t += 100) assert.equal(detect(0, t), null);
    for (let t = 3100; t <= 4000; t += 100) assert.equal(detect(0.03, t), null);
    for (let t = 4100; t < 6500; t += 100) assert.equal(detect(0, t), null);
    assert.equal(detect(0, 6500), 'pause');
    assert.equal(detect(0, 6600), null);
  });
