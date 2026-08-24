const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "be", "been", "being", "but", "by",
  "for", "from", "has", "have", "he", "her", "his", "i", "is", "it",
  "its", "my", "of", "or", "patient", "she", "symptom", "that", "the",
  "their", "them", "they", "this", "to", "was", "were", "with",
]);
const NEGATION_TERMS = new Set(["no", "not", "never", "without"]);

const SYNONYM_GROUPS = [
  ["ache", "aching", "pain", "painful", "soreness", "sore"],
  ["abdomen", "abdominal", "belly"],
  ["aggravated", "aggravation", "increased", "worse", "worsened"],
  ["aversion", "disinclination", "dislike", "repugnance"],
  ["anxiety", "anxious", "apprehension", "uneasiness"],
  ["beating", "pulsating", "pulsation", "throbbing"],
  ["better", "ameliorated", "lessened", "relieved"],
  ["breathless", "breathlessness", "dyspnoea", "respiration", "breathing"],
  ["burn", "burning", "burns", "smarting"],
  ["chest", "thorax", "thoracic"],
  ["cold", "chill", "chilly", "chilliness"],
  ["company", "people", "society"],
  ["constipated", "constipation", "costiveness"],
  ["cough", "coughing"],
  ["cramp", "cramping", "cramplike", "spasm", "spasmodic"],
  ["dizzy", "dizziness", "giddy", "giddiness", "vertigo"],
  ["evening", "evenings"],
  ["fever", "feverish", "heat"],
  ["headache", "cephalalgia"],
  ["itch", "itching", "itchy", "pruritus"],
  ["menstruation", "menses", "menstrual", "period"],
  ["morning", "mornings", "forenoon"],
  ["motion", "movement", "moving"],
  ["nausea", "nauseous", "sick", "sickness"],
  ["night", "nightly", "nocturnal"],
  ["numb", "numbness", "insensible", "insensibility"],
  ["pressure", "pressive", "pressing"],
  ["restless", "restlessness", "uneasy"],
  ["shooting", "stabbing", "stitch", "stitches", "stitching"],
  ["sleepiness", "sleepy", "drowsiness", "drowsy"],
  ["sleepless", "sleeplessness", "insomnia", "wakefulness"],
  ["stomach", "gastric", "epigastric"],
  ["stool", "bowel", "bowels", "evacuation"],
  ["swelling", "swollen", "tumefaction"],
  ["thirst", "thirsty"],
  ["tired", "tiredness", "fatigue", "weak", "weakness", "weariness"],
  ["urinate", "urination", "urine", "urinary"],
  ["vomit", "vomiting", "retching", "emesis"],
];

const BODY_LOCATION_TERMS = [
  "abdomen", "ankle", "arm", "back", "bladder", "bowel", "brain", "breast",
  "chest", "ear", "eye", "eyelid", "face", "finger", "foot", "forehead",
  "gum", "hand", "head", "heart", "heel", "hip", "jaw", "knee", "leg",
  "lip", "liver", "lung", "mouth", "neck", "nose", "ovary", "rectum",
  "rib", "shoulder", "skin", "stomach", "throat", "thumb", "tongue",
  "tooth", "uterus", "wrist",
];

const CONCEPT_HEAD_TERMS = [
  "anxiety", "bleeding", "burning", "chill", "constipation", "cough", "cramp",
  "diarrhoea", "dizziness", "fever", "headache", "itching", "nausea", "numbness",
  "pain", "rash", "restlessness", "sadness", "sleeplessness", "stiffness",
  "swelling", "thirst", "trembling", "urination", "vertigo", "vomiting", "weakness",
];

const COMMON_CLINICAL_TERMS = [
  "aggravated", "ameliorated", "better", "bloody", "dry", "frequent", "hard",
  "left", "morning", "movement", "night", "painful", "right", "severe", "sharp",
  "shooting", "stitching", "throbbing", "worse",
];

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

function stem(token) {
  if (token.length > 6 && token.endsWith("ies")) return `${token.slice(0, -3)}y`;
  if (token.length > 6 && token.endsWith("ing")) return token.slice(0, -3);
  if (token.length > 5 && token.endsWith("ed")) return token.slice(0, -2);
  if (token.length > 5 && token.endsWith("ness")) return token.slice(0, -4);
  if (token.length > 5 && token.endsWith("es")) return token.slice(0, -2);
  if (token.length > 4 && token.endsWith("s")) return token.slice(0, -1);
  return token;
}

function tokenize(value, keepStopWords = false) {
  return normalize(value)
    .split(" ")
    .filter((token) => token.length >= 2 && (keepStopWords || !STOP_WORDS.has(token)));
}

const BODY_LOCATION_STEMS = new Set(BODY_LOCATION_TERMS.map(stem));
const CONCEPT_HEAD_STEMS = new Set(CONCEPT_HEAD_TERMS.map(stem));
const CORRECTION_VOCABULARY = [...new Set([
  ...SYNONYM_GROUPS.flat(),
  ...BODY_LOCATION_TERMS,
  ...CONCEPT_HEAD_TERMS,
  ...COMMON_CLINICAL_TERMS,
])];

const SYNONYMS = new Map();
for (const group of SYNONYM_GROUPS) {
  for (const word of group) {
    const key = stem(word);
    const alternatives = group.filter((candidate) => candidate !== word);
    SYNONYMS.set(key, [...new Set([...(SYNONYMS.get(key) || []), ...alternatives])]);
  }
}

function editDistanceWithin(left, right, maximum) {
  if (Math.abs(left.length - right.length) > maximum) return maximum + 1;
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    let rowMinimum = current[0];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const substitution = previous[rightIndex - 1] + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1);
      const value = Math.min(previous[rightIndex] + 1, current[rightIndex - 1] + 1, substitution);
      current.push(value);
      rowMinimum = Math.min(rowMinimum, value);
    }
    if (rowMinimum > maximum) return maximum + 1;
    previous = current;
  }
  return previous[right.length];
}

function correctToken(token, wordFrequency) {
  if (token.length < 5 || wordFrequency.has(token) || SYNONYMS.has(stem(token))) return token;
  const maximum = token.length >= 6 ? 2 : 1;
  let best = null;
  for (const candidate of CORRECTION_VOCABULARY) {
    if (candidate[0] !== token[0] || Math.abs(candidate.length - token.length) > maximum) continue;
    const distance = editDistanceWithin(token, candidate, maximum);
    if (distance > maximum) continue;
    const frequency = wordFrequency.get(candidate) || 0;
    const score = distance - Math.min(0.35, Math.log10(frequency + 1) * 0.08);
    if (!best || score < best.score || (score === best.score && frequency > best.frequency)) best = { candidate, distance, frequency, score };
  }
  return best ? best.candidate : token;
}

function interpretSegment(segment, wordFrequency) {
  const originalTokens = tokenize(segment);
  const correctedTokens = originalTokens.map((token) => correctToken(token, wordFrequency));
  const corrections = originalTokens
    .map((token, index) => token === correctedTokens[index] ? null : ({ from: token, to: correctedTokens[index] }))
    .filter(Boolean);
  const headIndexes = correctedTokens
    .map((token, index) => CONCEPT_HEAD_STEMS.has(stem(token)) ? index : -1)
    .filter((index) => index >= 0);

  let concepts = [correctedTokens.join(" ")];
  if (headIndexes.length > 1) {
    const bodyIndexes = correctedTokens
      .map((token, index) => BODY_LOCATION_STEMS.has(stem(token)) ? index : -1)
      .filter((index) => index >= 0);
    const sideIndexes = correctedTokens
      .map((token, index) => ["left", "right"].includes(token) ? index : -1)
      .filter((index) => index >= 0);

    concepts = headIndexes.map((headIndex) => {
      const included = new Set([headIndex]);
      const nearestBodyIndex = bodyIndexes
        .map((index) => ({ index, distance: Math.abs(index - headIndex) }))
        .filter((item) => item.distance <= 3)
        .sort((a, b) => a.distance - b.distance || a.index - b.index)[0]?.index;
      if (nearestBodyIndex !== undefined) {
        included.add(nearestBodyIndex);
        sideIndexes.filter((index) => Math.abs(index - nearestBodyIndex) <= 2).forEach((index) => included.add(index));
      }
      const previousIndex = headIndex - 1;
      if (previousIndex >= 0 && !CONCEPT_HEAD_STEMS.has(stem(correctedTokens[previousIndex])) && !BODY_LOCATION_STEMS.has(stem(correctedTokens[previousIndex]))) included.add(previousIndex);
      return [...included].sort((a, b) => a - b).map((index) => correctedTokens[index]).join(" ");
    });
  }

  concepts = [...new Set(concepts.filter(Boolean))];
  return {
    original: String(segment || "").trim(),
    corrected: correctedTokens.join(" "),
    corrections,
    concepts,
  };
}

function bigrams(tokens) {
  const values = new Set();
  for (let index = 0; index < tokens.length - 1; index += 1) values.add(`${tokens[index]} ${tokens[index + 1]}`);
  return values;
}

function negatedStems(tokens) {
  const values = new Set();
  tokens.forEach((token, index) => {
    const directlyNegated = NEGATION_TERMS.has(tokens[index - 1]);
    const absenceOf = tokens[index - 2] === "absence" && tokens[index - 1] === "of";
    const nearby = tokens.slice(Math.max(0, index - 4), index);
    const scopedWithout = nearby.includes("without") && !nearby.includes("but");
    const scopedNo = nearby.slice(-3).some((item) => ["no", "not", "never"].includes(item)) && !nearby.includes("but");
    if (directlyNegated || absenceOf || scopedWithout || scopedNo) values.add(stem(token));
  });
  return values;
}

function tokenStrength(symptom, queryToken, queryNegated = false) {
  const queryStem = stem(queryToken);
  const adjusted = (matchedStem, strength, exact) => {
    const sourceNegated = symptom.negatedStemSet?.has(matchedStem) || false;
    if (sourceNegated !== queryNegated) return { strength: 0, exact: false };
    return { strength, exact };
  };
  if (symptom.tokenSet.has(queryToken)) return adjusted(queryStem, 1, true);
  if (symptom.stemSet.has(queryStem)) return adjusted(queryStem, 0.93, false);

  if (queryToken.length >= 3) {
    const prefixToken = symptom.tokens.find((token) => token.startsWith(queryToken));
    if (prefixToken) return adjusted(stem(prefixToken), 0.82, false);
  }

  for (const alternative of SYNONYMS.get(queryStem) || []) {
    const alternativeStem = stem(alternative);
    if (symptom.tokenSet.has(alternative)) return adjusted(alternativeStem, 0.8, false);
    if (symptom.stemSet.has(alternativeStem)) return adjusted(alternativeStem, 0.74, false);
  }
  return { strength: 0, exact: false };
}

function buildQuery(segment, documentFrequency, symptomCount) {
  const normalized = normalize(segment);
  const tokens = [...new Set(tokenize(segment))];
  const orderedTokens = tokenize(segment, true);
  const queryNegatedStems = negatedStems(orderedTokens);
  const weightedTokens = tokens.map((token) => {
    const frequency = documentFrequency.get(stem(token)) || 0;
    const idf = Math.min(4.2, Math.log((symptomCount + 1) / (frequency + 1)) + 1);
    return { token, weight: idf, negated: queryNegatedStems.has(stem(token)) };
  });
  return {
    original: String(segment).trim(),
    normalized,
    tokens,
    weightedTokens,
    bigrams: bigrams(tokenize(segment, true)),
  };
}

function scoreSourceSymptom(symptom, query, segmentIndex) {
  if (!query.normalized || query.tokens.length === 0) return null;

  let matchedWeight = 0;
  let exactWeight = 0;
  let emphasisWeight = 0;
  let matchedTokenCount = 0;
  const totalWeight = query.weightedTokens.reduce((total, item) => total + item.weight, 0);

  for (const item of query.weightedTokens) {
    const match = tokenStrength(symptom, item.token, item.negated);
    if (match.strength >= 0.72) matchedTokenCount += 1;
    matchedWeight += item.weight * match.strength;
    if (match.exact) exactWeight += item.weight;
    const emphasisMatch = tokenStrength(symptom.emphasisFeatures, item.token, item.negated);
    emphasisWeight += item.weight * emphasisMatch.strength;
  }

  const exactPhrase = query.normalized.length >= 5 && symptom.normalized.includes(query.normalized) ? 1 : 0;
  const requiredTokens = query.tokens.length === 1 ? 1 : Math.min(2, query.tokens.length);
  if (!exactPhrase && matchedTokenCount < requiredTokens) return null;

  const weightedCoverage = totalWeight ? matchedWeight / totalWeight : 0;
  const minimumCoverage = query.tokens.length >= 4 ? 0.38 : query.tokens.length >= 2 ? 0.44 : 0.76;
  if (!exactPhrase && weightedCoverage < minimumCoverage) return null;

  let matchingBigrams = 0;
  for (const pair of query.bigrams) if (symptom.bigrams.has(pair)) matchingBigrams += 1;
  const bigramCoverage = query.bigrams.size ? matchingBigrams / query.bigrams.size : 0;
  const exactCoverage = totalWeight ? exactWeight / totalWeight : 0;
  const emphasisCoverage = totalWeight ? Math.min(1, emphasisWeight / totalWeight) : 0;
  const priorityScore = Math.max(0, Math.min(1, (symptom.priority - 1) / 2));

  const score = Math.min(1,
    weightedCoverage * 0.55 +
    exactCoverage * 0.09 +
    exactPhrase * 0.14 +
    bigramCoverage * 0.08 +
    emphasisCoverage * 0.08 +
    priorityScore * 0.06,
  );

  return {
    score,
    coverage: weightedCoverage,
    exactPhrase: Boolean(exactPhrase),
    matchedTokenCount,
    evidence: {
      id: symptom.id,
      number: symptom.number,
      text: symptom.text,
      emphasizedText: symptom.emphasizedText,
      priority: symptom.priority,
      page: symptom.page,
      segment: query.original,
      segmentIndex,
      matchScore: score,
      tokenCoverage: weightedCoverage,
      exactPhrase: Boolean(exactPhrase),
    },
  };
}

function labelForScore(score, coverage, weakestScore) {
  if (coverage === 1 && score >= 0.72 && weakestScore >= 0.48) return "High source alignment";
  if (coverage >= 0.67 && score >= 0.48) return "Moderate source alignment";
  return "Limited source alignment";
}

function combinationCandidates(results, totalSegments) {
  if (totalSegments < 2 || results.length < 2) return [];
  const poolById = new Map(results.slice(0, 12).map((item) => [item.id, item]));
  for (let segmentIndex = 0; segmentIndex < totalSegments; segmentIndex += 1) {
    results.filter((item) => item.matchedSegmentIndexes.includes(segmentIndex)).slice(0, 5).forEach((item) => poolById.set(item.id, item));
  }
  const pool = [...poolById.values()].slice(0, 28);
  const bestSingleCoverage = Math.max(...results.map((item) => item.matchedSegmentCount));
  if (bestSingleCoverage >= totalSegments) return [];

  const candidates = [];
  const consider = (members) => {
    const memberSets = members.map((member) => new Set(member.matchedSegmentIndexes));
    const union = new Set(memberSets.flatMap((set) => [...set]));
    if (union.size <= bestSingleCoverage) return;

    const uniqueContributions = memberSets.map((set, memberIndex) => [...set].filter((segmentIndex) => (
      !memberSets.some((otherSet, otherIndex) => otherIndex !== memberIndex && otherSet.has(segmentIndex))
    )));
    if (uniqueContributions.some((items) => items.length === 0)) return;

    const coverage = union.size / totalSegments;
    const averageScore = members.reduce((total, member) => total + member.score, 0) / members.length;
    const complementarity = uniqueContributions.reduce((total, items) => total + items.length, 0) / union.size;
    const score = coverage * 0.64 + averageScore * 0.24 + complementarity * 0.12 - (members.length - 2) * 0.015;
    candidates.push({
      id: members.map((member) => member.id).sort().join("+"),
      score,
      coveredSegmentIndexes: [...union].sort((a, b) => a - b),
      coveredSegmentCount: union.size,
      totalSegmentCount: totalSegments,
      members: members.map((member, memberIndex) => ({
        id: member.id,
        code: member.code,
        name: member.name,
        scientific: member.scientific,
        alignmentPercent: member.alignmentPercent,
        matchedSegmentCount: member.matchedSegmentCount,
        totalSegmentCount: member.totalSegmentCount,
        evidence: member.evidence,
        matchedSegmentIndexes: member.matchedSegmentIndexes,
        uniqueSegmentIndexes: uniqueContributions[memberIndex],
      })),
    });
  };

  for (let first = 0; first < pool.length; first += 1) {
    for (let second = first + 1; second < pool.length; second += 1) {
      consider([pool[first], pool[second]]);
      for (let third = second + 1; third < pool.length; third += 1) consider([pool[first], pool[second], pool[third]]);
    }
  }

  const seen = new Set();
  return candidates
    .sort((a, b) => b.coveredSegmentCount - a.coveredSegmentCount || b.score - a.score || a.members.length - b.members.length)
    .filter((candidate) => {
      if (seen.has(candidate.id)) return false;
      seen.add(candidate.id);
      return true;
    })
    .slice(0, 3);
}

export function createRemedySearchEngine(payload) {
  const preparations = payload.preparations.map((preparation) => ({
    id: preparation.id,
    code: preparation.code,
    name: preparation.name,
    scientific: preparation.scientific,
    aliases: preparation.aliases || [],
  }));
  const symptoms = [];
  const documentFrequency = new Map();
  const wordFrequency = new Map();

  payload.preparations.forEach((preparation, remedyIndex) => {
    preparation.symptoms.forEach((row) => {
      const [id, number, text, emphasizedText, priority, page] = row;
      const tokens = tokenize(text, true);
      const tokenSet = new Set(tokens);
      const stemSet = new Set(tokens.map(stem));
      const emphasisTokens = tokenize(emphasizedText, true);
      const symptom = {
        remedyIndex,
        id,
        number,
        text,
        emphasizedText,
        priority,
        page,
        normalized: normalize(text),
        tokens,
        tokenSet,
        stemSet,
        negatedStemSet: negatedStems(tokens),
        bigrams: bigrams(tokens),
        emphasisFeatures: {
          tokens: emphasisTokens,
          tokenSet: new Set(emphasisTokens),
          stemSet: new Set(emphasisTokens.map(stem)),
          negatedStemSet: negatedStems(emphasisTokens),
        },
      };
      symptoms.push(symptom);
      for (const tokenStem of stemSet) documentFrequency.set(tokenStem, (documentFrequency.get(tokenStem) || 0) + 1);
      for (const token of tokenSet) wordFrequency.set(token, (wordFrequency.get(token) || 0) + 1);
    });
  });

  function search(segments, limit = 14) {
    const inputInterpretations = segments.map((segment) => interpretSegment(segment, wordFrequency));
    const queries = inputInterpretations
      .flatMap((interpretation) => interpretation.concepts)
      .map((segment) => buildQuery(segment, documentFrequency, symptoms.length))
      .filter((query) => query.tokens.length > 0);
    if (!queries.length) return { results: [], combinations: [], interpretedSegments: [], inputInterpretations };

    const bestBySegment = queries.map(() => new Map());
    for (const symptom of symptoms) {
      queries.forEach((query, segmentIndex) => {
        const match = scoreSourceSymptom(symptom, query, segmentIndex);
        if (!match) return;
        const current = bestBySegment[segmentIndex].get(symptom.remedyIndex);
        if (!current || match.score > current.score) bestBySegment[segmentIndex].set(symptom.remedyIndex, match);
      });
    }

    const allResults = preparations.map((preparation, remedyIndex) => {
      const segmentMatches = bestBySegment.map((matches) => matches.get(remedyIndex) || null);
      const matchedSegmentIndexes = segmentMatches.map((match, index) => match ? index : -1).filter((index) => index >= 0);
      if (!matchedSegmentIndexes.length) return null;

      const matchedSegmentCount = matchedSegmentIndexes.length;
      const wholeCaseCoverage = matchedSegmentCount / queries.length;
      const scoreAcrossWholeCase = segmentMatches.reduce((total, match) => total + (match?.score || 0), 0) / queries.length;
      const weakestScore = Math.min(...segmentMatches.map((match) => match?.score || 0));
      const strongestScore = Math.max(...segmentMatches.map((match) => match?.score || 0));
      const completeCaseBonus = queries.length > 1 && wholeCaseCoverage === 1 ? 0.08 : 0;
      const finalScore = Math.max(0, Math.min(1,
        scoreAcrossWholeCase * 0.54 +
        wholeCaseCoverage * 0.31 +
        weakestScore * 0.1 +
        strongestScore * 0.05 +
        completeCaseBonus,
      ));
      const evidence = segmentMatches.filter(Boolean).map((match) => match.evidence);

      return {
        ...preparation,
        score: finalScore,
        alignmentPercent: Math.round(finalScore * 100),
        label: labelForScore(finalScore, wholeCaseCoverage, weakestScore),
        matchedSegmentCount,
        matchedSegmentIndexes,
        totalSegmentCount: queries.length,
        segmentMatches: segmentMatches.map((match, index) => ({
          segment: queries[index].original,
          matched: Boolean(match),
          score: match?.score || 0,
        })),
        evidence,
        highestPriority: Math.max(...evidence.map((item) => item.priority)),
      };
    }).filter((result) => result && result.score >= (queries.length > 1 ? 0.3 : 0.36));

    allResults.sort((a, b) =>
      b.matchedSegmentCount - a.matchedSegmentCount ||
      b.score - a.score ||
      b.highestPriority - a.highestPriority ||
      a.name.localeCompare(b.name)
    );

    return {
      results: allResults.slice(0, limit),
      combinations: combinationCandidates(allResults, queries.length),
      interpretedSegments: queries.map((query) => query.original),
      inputInterpretations,
    };
  }

  return {
    search,
    metadata: {
      datasetVersion: payload.datasetVersion || "1.0.0",
      preparationCount: preparations.length,
      symptomCount: symptoms.length,
    },
  };
}
