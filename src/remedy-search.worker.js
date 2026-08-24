const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "be", "been", "being", "but", "by",
  "for", "from", "has", "have", "he", "her", "his", "i", "is", "it",
  "its", "my", "of", "or", "patient", "she", "symptom", "that", "the",
  "their", "them", "they", "this", "to", "was", "were", "with",
]);

const SYNONYM_GROUPS = [
  ["ache", "aching", "pain", "painful"],
  ["burn", "burning", "burns", "smarting"],
  ["cold", "chill", "chilly"],
  ["constipated", "constipation", "costiveness"],
  ["dizzy", "dizziness", "giddy", "giddiness", "vertigo"],
  ["fever", "feverish", "heat"],
  ["itch", "itching", "itchy"],
  ["nausea", "nauseous", "sick", "sickness"],
  ["pulsating", "pulsation", "throbbing", "beating"],
  ["restless", "restlessness", "uneasy"],
  ["swelling", "swollen", "tumefaction"],
  ["tired", "tiredness", "fatigue", "weak", "weakness"],
  ["vomit", "vomiting", "retching"],
  ["breathless", "breathlessness", "dyspnoea", "breathing"],
];

const SYNONYMS = new Map();
for (const group of SYNONYM_GROUPS) {
  for (const word of group) {
    SYNONYMS.set(word, group.filter((candidate) => candidate !== word));
  }
}

let loadPromise;
let preparations = [];
let symptoms = [];
let datasetVersion = "1.0.0";

function normalize(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value) {
  return normalize(value)
    .split(" ")
    .filter((token) => token.length >= 2 && !STOP_WORDS.has(token));
}

function prepareDataset(payload) {
  datasetVersion = payload.datasetVersion || datasetVersion;
  preparations = payload.preparations.map((preparation) => ({
    id: preparation.id,
    code: preparation.code,
    name: preparation.name,
    scientific: preparation.scientific,
    aliases: preparation.aliases || [],
  }));

  symptoms = [];
  payload.preparations.forEach((preparation, remedyIndex) => {
    preparation.symptoms.forEach((row) => {
      const [id, number, text, emphasizedText, priority, page] = row;
      symptoms.push({
        remedyIndex,
        id,
        number,
        text,
        emphasizedText,
        priority,
        page,
        normalized: normalize(text),
        normalizedEmphasis: normalize(emphasizedText),
      });
    });
  });
}

async function loadDataset(indexUrl) {
  if (!loadPromise) {
    loadPromise = fetch(indexUrl)
      .then((response) => {
        if (!response.ok) throw new Error(`Dataset request failed (${response.status})`);
        return response.json();
      })
      .then((payload) => {
        prepareDataset(payload);
        return payload;
      });
  }
  return loadPromise;
}

function tokenMatch(text, queryToken) {
  if (text.includes(queryToken)) return 1;
  const alternatives = SYNONYMS.get(queryToken) || [];
  if (alternatives.some((alternative) => text.includes(alternative))) return 0.65;
  return 0;
}

function scoreSymptom(symptom, segment) {
  const queryText = normalize(segment);
  const queryTokens = [...new Set(tokenize(segment))];
  if (!queryText || queryTokens.length === 0) return null;

  let matchedWeight = 0;
  let emphasisWeight = 0;
  let exactTokenMatches = 0;

  for (const queryToken of queryTokens) {
    const matchWeight = tokenMatch(symptom.normalized, queryToken);
    matchedWeight += matchWeight;
    if (matchWeight === 1) exactTokenMatches += 1;
    emphasisWeight += tokenMatch(symptom.normalizedEmphasis, queryToken);
  }

  if (matchedWeight === 0) return null;

  const coverage = matchedWeight / queryTokens.length;
  const exactPhrase = queryText.length >= 5 && symptom.normalized.includes(queryText) ? 1 : 0;
  const emphasisCoverage = Math.min(1, emphasisWeight / queryTokens.length);
  const priorityScore = Math.max(0, Math.min(1, (symptom.priority - 1) / 2));
  const exactCoverage = exactTokenMatches / queryTokens.length;

  const score =
    coverage * 0.5 +
    exactCoverage * 0.16 +
    exactPhrase * 0.12 +
    emphasisCoverage * 0.12 +
    priorityScore * 0.1;

  return {
    score,
    coverage,
    evidence: {
      id: symptom.id,
      number: symptom.number,
      text: symptom.text,
      emphasizedText: symptom.emphasizedText,
      priority: symptom.priority,
      page: symptom.page,
      segment,
    },
  };
}

function labelForScore(score, coverage) {
  if (coverage === 1 && score >= 0.72) return "Strong source match";
  if (coverage >= 0.67 && score >= 0.5) return "Good source match";
  return "Possible source match";
}

function searchRemedies(segments, limit = 10) {
  const cleanSegments = segments
    .map((segment) => String(segment || "").trim())
    .filter((segment) => tokenize(segment).length > 0);

  if (cleanSegments.length === 0) return [];

  const bestBySegment = cleanSegments.map(() => new Map());

  for (const symptom of symptoms) {
    cleanSegments.forEach((segment, segmentIndex) => {
      const match = scoreSymptom(symptom, segment);
      if (!match || match.coverage < 0.34) return;

      const current = bestBySegment[segmentIndex].get(symptom.remedyIndex);
      if (!current || match.score > current.score) {
        bestBySegment[segmentIndex].set(symptom.remedyIndex, match);
      }
    });
  }

  const results = preparations.map((preparation, remedyIndex) => {
    const segmentMatches = bestBySegment
      .map((matches) => matches.get(remedyIndex))
      .filter(Boolean);

    if (segmentMatches.length === 0) return null;

    const matchedSegmentCount = segmentMatches.length;
    const symptomCoverage = matchedSegmentCount / cleanSegments.length;
    const averageScore =
      segmentMatches.reduce((total, match) => total + match.score, 0) /
      cleanSegments.length;
    const bestScore = Math.max(...segmentMatches.map((match) => match.score));
    const finalScore = averageScore * 0.62 + symptomCoverage * 0.28 + bestScore * 0.1;

    const evidence = [];
    const evidenceIds = new Set();
    for (const match of segmentMatches.sort((a, b) => b.score - a.score)) {
      if (!evidenceIds.has(match.evidence.id)) {
        evidence.push(match.evidence);
        evidenceIds.add(match.evidence.id);
      }
    }

    return {
      ...preparation,
      score: finalScore,
      label: labelForScore(finalScore, symptomCoverage),
      matchedSegmentCount,
      totalSegmentCount: cleanSegments.length,
      evidence: evidence.slice(0, 3),
      highestPriority: Math.max(...evidence.map((item) => item.priority)),
    };
  });

  return results
    .filter(Boolean)
    .sort((a, b) =>
      b.matchedSegmentCount - a.matchedSegmentCount ||
      b.score - a.score ||
      b.highestPriority - a.highestPriority ||
      a.name.localeCompare(b.name)
    )
    .slice(0, limit);
}

self.onmessage = async (event) => {
  const message = event.data || {};

  try {
    if (message.type === "init") {
      await loadDataset(message.indexUrl);
      self.postMessage({
        type: "ready",
        datasetVersion,
        preparationCount: preparations.length,
        symptomCount: symptoms.length,
      });
      return;
    }

    if (message.type === "search") {
      await loadPromise;
      const startedAt = performance.now();
      const results = searchRemedies(message.segments || [], message.limit || 10);
      self.postMessage({
        type: "results",
        requestId: message.requestId,
        results,
        durationMs: Math.round(performance.now() - startedAt),
      });
    }
  } catch (error) {
    self.postMessage({
      type: "error",
      requestId: message.requestId,
      message: error instanceof Error ? error.message : "Unable to load the remedy dataset.",
    });
  }
};
