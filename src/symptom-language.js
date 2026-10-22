// A deliberately bounded glossary, not a general-purpose translation model.
// Unknown Devanagari words remain visible and block automatic acceptance.
const GROUPS = [
  ['headache', 'सिर दर्द', 'सिरदर्द', 'डोकेदुखी', 'डोकं दुखतं', 'डोके दुखते'],
  ['throat', 'गले', 'गला', 'घसा', 'घशात', 'घशाला'],
  ['cough', 'खांसी', 'खाँसी', 'खोकला'],
  ['itching', 'खुजली', 'खाज'], ['swelling', 'सूजन', 'सूज'],
  ['fever', 'बुखार', 'ताप'], ['nausea', 'मतली', 'मळमळ'],
  ['vomiting', 'उल्टी', 'उलटी'], ['dizziness', 'चक्कर', 'चक्कर येते'],
  ['burning', 'जलन', 'जळजळ'], ['pain', 'दर्द', 'दुखणे', 'दुखतं', 'दुखते', 'वेदना'],
  ['stomach', 'पेट', 'पोट', 'पोटात'], ['chest', 'सीने', 'सीना', 'छाती', 'छातीत'],
  ['ear', 'कान', 'कानात'], ['eye', 'आंख', 'आँख', 'डोळा', 'डोळ्यात'],
  ['skin', 'त्वचा'], ['hand', 'हाथ', 'हात', 'हातात'], ['foot', 'पैर', 'पाय', 'पायात'],
  ['knee', 'घुटना', 'घुटने', 'गुडघा', 'गुडघ्यात'], ['back', 'पीठ', 'पाठ', 'पाठीत'],
  ['left', 'बायां', 'बाएं', 'बायीं', 'डावा', 'डाव्या'],
  ['right', 'दायां', 'दाएं', 'दायीं', 'उजवा', 'उजव्या'],
  ['morning', 'सुबह', 'सकाळी'], ['night', 'रात', 'रात्री'],
  ['evening', 'शाम', 'संध्याकाळी'], ['after eating', 'खाने के बाद', 'जेवल्यानंतर'],
  ['constipation', 'कब्ज', 'बद्धकोष्ठता'], ['diarrhoea', 'दस्त', 'जुलाब'],
  ['thirst', 'प्यास', 'तहान'], ['weakness', 'कमजोरी', 'अशक्तपणा'],
  ['urination', 'पेशाब', 'लघवी'], ['numbness', 'सुन्न', 'बधिरपणा'],
  ['not', 'नहीं', 'नही', 'नाही'], ['and', 'और', 'आणि'],
  ['', 'है', 'हैं', 'आहे', 'आहेत', 'में', 'मुझे', 'मला', 'होती', 'होता'],
];
const entries = GROUPS.flatMap(([english, ...words]) => words.map(word => [word, english]))
  .sort((a, b) => b[0].length - a[0].length);
export function mapSymptomLanguage(text) {
  let mapped = String(text).normalize('NFC');
  for (const [word, english] of entries) {
    mapped = mapped.replace(new RegExp(`(?<![\\p{L}\\p{M}])${word}(?![\\p{L}\\p{M}])`, 'gu'), ` ${english} `);
  }
  mapped = mapped.replace(/\s+/g, ' ').trim();
  return { text: mapped, unresolved: /[\u0900-\u097f]/u.test(mapped),
    hasNegation: /\b(?:not|no|never|without)\b/i.test(mapped) };
}

export function speechErrorMessage(code) {
  return ({ 'not-allowed': 'Microphone permission was denied. You can still type below.',
    'service-not-allowed': 'Speech service is unavailable in this browser. Use typed input.',
    'audio-capture': 'No microphone is available. Check the microphone connection.',
    network: 'Speech service could not connect. Your draft is retained; try again or type.',
    'no-speech': 'No speech was detected. Try again or type your symptoms.',
    'language-not-supported': 'This speech service does not support the selected language.',
    aborted: 'Recording stopped.' })[code] || 'Speech recognition failed. Your draft is retained.';
}
