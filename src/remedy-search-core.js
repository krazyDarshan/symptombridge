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
  ["diarrhea", "diarrhoea", "loose", "looseness"],
  ["difficult", "difficulty", "hard"],
  ["dizzy", "dizziness", "giddy", "giddiness", "vertigo"],
  ["edema", "oedema", "swelling", "swollen", "tumefaction"],
  ["evening", "evenings"],
  ["fever", "feverish", "heat"],
  ["headache", "cephalalgia"],
  ["hoarse", "hoarseness", "roughness"],
  ["inflamed", "inflammation", "irritated", "irritation"],
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
  ["sneeze", "sneezing", "sternutation"],
  ["sleepiness", "sleepy", "drowsiness", "drowsy"],
  ["sleepless", "sleeplessness", "insomnia", "wakefulness"],
  ["stomach", "gastric", "epigastric"],
  ["stool", "bowel", "bowels", "evacuation"],
  ["swallow", "swallowing", "deglutition", "dysphagia"],
  ["thirst", "thirsty"],
  ["tired", "tiredness", "fatigue", "weak", "weakness", "weariness"],
  ["urinate", "urination", "urine", "urinary"],
  ["vomit", "vomiting", "retching", "emesis"],
];

const BODY_LOCATION_TERMS = [
  "abdomen", "ankle", "arm", "back", "bladder", "bowel", "brain", "breast",
  "chest", "ear", "eye", "eyelid", "face", "finger", "foot", "forehead",
  "gum", "hand", "head", "heart", "heel", "hip", "jaw", "kidney", "knee", "leg",
  "lip", "liver", "lung", "mouth", "neck", "nose", "ovary", "rectum",
  "rib", "shoulder", "skin", "stomach", "throat", "thumb", "tongue",
  "tooth", "urethra", "uterus", "vagina", "wrist",
];

const CONCEPT_HEAD_TERMS = [
  "anxiety", "bleeding", "burning", "chill", "constipation", "cough", "cramp",
  "ache", "diarrhoea", "discharge", "dizziness", "eruption", "fever", "headache",
  "hoarseness", "inflammation", "itching", "nausea", "numbness", "pain", "palpitation",
  "perspiration", "rash", "restlessness", "sadness", "sleeplessness", "sneezing",
  "soreness", "stiffness", "swelling", "thirst", "trembling", "urination", "vertigo",
  "vomiting", "weakness",
];

const COMMON_CLINICAL_TERMS = [
  "aggravated", "ameliorated", "better", "bloody", "dry", "frequent", "hard",
  "left", "morning", "movement", "night", "painful", "right", "severe", "sharp",
  "shooting", "stitching", "throbbing", "worse", "after", "before", "during",
  "standing", "sitting", "lying", "touch", "pressure", "eating", "drinking",
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
const CONCEPT_MODIFIER_STEMS = new Set(COMMON_CLINICAL_TERMS.map(stem));
const LATERALITY_STEMS = new Set(["left", "right"]);
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

function correctionCandidates(token, correctionIndex) {
  const maximum = token.length >= 7 ? 2 : 1;
  const candidates = [];
  for (let length = token.length - maximum; length <= token.length + maximum; length += 1) {
    for (const candidate of correctionIndex.get(`${token[0]}:${length}`) || []) candidates.push(candidate);
  }
  return { candidates, maximum };
}

function correctToken(token, wordFrequency, correctionIndex) {
  if (token.length < 5 || wordFrequency.has(token) || SYNONYMS.has(stem(token))) return token;
  const { candidates, maximum } = correctionCandidates(token, correctionIndex);
  let best = null;
  for (const candidate of candidates) {
    const distance = editDistanceWithin(token, candidate, maximum);
    if (distance > maximum) continue;
    const frequency = wordFrequency.get(candidate) || 0;
    const score = distance - Math.min(0.35, Math.log10(frequency + 1) * 0.08);
    if (!best || score < best.score || (score === best.score && frequency > best.frequency)) best = { candidate, distance, frequency, score };
  }
  return best ? best.candidate : token;
}

function interpretSegment(segment, wordFrequency, correctionIndex) {
  const originalTokens = tokenize(segment);
  const correctedTokens = originalTokens.map((token) => correctToken(token, wordFrequency, correctionIndex));
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
      for (let index = Math.max(0, headIndex - 2); index <= Math.min(correctedTokens.length - 1, headIndex + 3); index += 1) {
        const tokenStem = stem(correctedTokens[index]);
        if (CONCEPT_MODIFIER_STEMS.has(tokenStem) && !CONCEPT_HEAD_STEMS.has(tokenStem)) included.add(index);
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

  if (queryToken.length >= 2) {
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
    bodyTokens: tokens.filter((token) => BODY_LOCATION_STEMS.has(stem(token))),
    lateralityTokens: tokens.filter((token) => LATERALITY_STEMS.has(stem(token))),
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

  if (query.bodyTokens.length && !query.bodyTokens.some((token) => tokenStrength(symptom, token).strength >= 0.72)) return null;
  const querySide = query.lateralityTokens[0];
  const sourceSides = symptom.tokens.filter((token) => LATERALITY_STEMS.has(stem(token)));
  if (querySide && sourceSides.length && !sourceSides.includes(querySide)) return null;

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
  const lateralityScore = querySide ? (sourceSides.includes(querySide) ? 1 : 0.35) : 0;

  const score = Math.min(1,
    weightedCoverage * 0.51 +
    exactCoverage * 0.09 +
    exactPhrase * 0.14 +
    bigramCoverage * 0.08 +
    emphasisCoverage * 0.09 +
    priorityScore * 0.07 +
    lateralityScore * 0.02,
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

const STRONG_SEGMENT_SCORE = 0.62;
const SUPPORTED_SEGMENT_SCORE = 0.48;

function recommendReviewSet(results, totalSegments) {
  if (!results.length || totalSegments < 1) return null;

  const segmentScore = (remedy, segmentIndex) => remedy.segmentMatches[segmentIndex]?.score || 0;
  const assignmentsFor = (members) => Array.from({ length: totalSegments }, (_, segmentIndex) => {
    const ranked = members
      .map((member) => ({
        remedyId: member.id,
        remedyName: member.name,
        score: segmentScore(member, segmentIndex),
      }))
      .sort((left, right) => right.score - left.score || left.remedyName.localeCompare(right.remedyName));
    return {
      segmentIndex,
      segment: members[0]?.segmentMatches[segmentIndex]?.segment || "",
      ...ranked[0],
      supported: ranked[0].score >= SUPPORTED_SEGMENT_SCORE,
      strong: ranked[0].score >= STRONG_SEGMENT_SCORE,
    };
  });

  const describe = (members) => {
    const assignments = assignmentsFor(members);
    const bestScores = assignments.map((assignment) => assignment.score);
    const coveredSegmentCount = bestScores.filter((score) => score >= SUPPORTED_SEGMENT_SCORE).length;
    const strongCoveredSegmentCount = bestScores.filter((score) => score >= STRONG_SEGMENT_SCORE).length;
    const averageBestScore = bestScores.reduce((total, score) => total + score, 0) / totalSegments;
    const weakestBestScore = Math.min(...bestScores);
    const averageAlignment = members.reduce((total, member) => total + member.score, 0) / members.length;
    const contributingIds = new Set(assignments.filter((assignment) => assignment.supported).map((assignment) => assignment.remedyId));
    const allMembersContribute = members.every((member) => contributingIds.has(member.id));
    const fullCoverage = coveredSegmentCount === totalSegments;
    const quality =
      (strongCoveredSegmentCount / totalSegments) * 0.38 +
      averageBestScore * 0.31 +
      weakestBestScore * 0.19 +
      averageAlignment * 0.12 -
      (members.length - 1) * 0.025;
    return {
      members,
      assignments,
      coveredSegmentCount,
      strongCoveredSegmentCount,
      averageBestScore,
      weakestBestScore,
      allMembersContribute,
      fullCoverage,
      quality,
    };
  };

  const topSingle = describe([results[0]]);
  const singleIsSufficient = topSingle.fullCoverage &&
    topSingle.weakestBestScore >= SUPPORTED_SEGMENT_SCORE &&
    topSingle.averageBestScore >= 0.58 &&
    results[0].alignmentPercent >= 65;

  if (totalSegments === 1 || singleIsSufficient) {
    const strong = topSingle.strongCoveredSegmentCount === totalSegments;
    return {
      mode: totalSegments === 1 && !topSingle.fullCoverage ? "insufficient" : "single",
      remedyIds: [results[0].id],
      count: 1,
      coveredSegmentCount: topSingle.coveredSegmentCount,
      strongCoveredSegmentCount: topSingle.strongCoveredSegmentCount,
      totalSegmentCount: totalSegments,
      confidenceLabel: strong ? "Strong source coverage" : topSingle.fullCoverage ? "Complete source coverage" : "Partial source coverage",
      reason: strong
        ? "One remedy has strong source support across every interpreted symptom concept."
        : topSingle.fullCoverage
          ? "One remedy provides the smallest supported source-review set across every interpreted symptom concept."
          : "This is the closest source match, but the entered symptom does not yet have strong source coverage.",
      assignments: topSingle.assignments,
    };
  }

  const poolById = new Map(results.slice(0, 16).map((item) => [item.id, item]));
  for (let segmentIndex = 0; segmentIndex < totalSegments; segmentIndex += 1) {
    [...results]
      .sort((left, right) => segmentScore(right, segmentIndex) - segmentScore(left, segmentIndex))
      .slice(0, 4)
      .forEach((item) => poolById.set(item.id, item));
  }
  const pool = [...poolById.values()].slice(0, 24);
  const candidates = [];
  const consider = (members) => {
    const candidate = describe(members);
    if (candidate.allMembersContribute) candidates.push(candidate);
  };

  for (let first = 0; first < pool.length; first += 1) {
    for (let second = first + 1; second < pool.length; second += 1) {
      consider([pool[first], pool[second]]);
      for (let third = second + 1; third < pool.length; third += 1) {
        consider([pool[first], pool[second], pool[third]]);
      }
    }
  }

  candidates.sort((left, right) =>
    Number(right.fullCoverage) - Number(left.fullCoverage) ||
    right.strongCoveredSegmentCount - left.strongCoveredSegmentCount ||
    right.quality - left.quality ||
    left.members.length - right.members.length
  );

  let best = candidates[0] || topSingle;
  if (best.members.length === 3) {
    const comparablePair = candidates.find((candidate) =>
      candidate.members.length === 2 &&
      candidate.coveredSegmentCount === best.coveredSegmentCount &&
      candidate.strongCoveredSegmentCount === best.strongCoveredSegmentCount &&
      candidate.quality >= best.quality - 0.04
    );
    if (comparablePair) best = comparablePair;
  }

  const fullStrongCoverage = best.fullCoverage && best.strongCoveredSegmentCount === totalSegments;
  const mode = best.fullCoverage ? "group" : "insufficient";
  return {
    mode,
    remedyIds: best.members.map((member) => member.id),
    count: best.members.length,
    coveredSegmentCount: best.coveredSegmentCount,
    strongCoveredSegmentCount: best.strongCoveredSegmentCount,
    totalSegmentCount: totalSegments,
    confidenceLabel: fullStrongCoverage
      ? "Strong combined source coverage"
      : best.fullCoverage ? "Complete combined source coverage" : "Partial source coverage",
    reason: best.fullCoverage
      ? "No single remedy has equally strong support across the complete case; this is the smallest complementary source-review set with the best combined coverage."
      : "The source dataset does not cover every interpreted symptom strongly enough. Refine the symptoms and review this partial shortlist with clinical judgement.",
    assignments: best.assignments,
  };
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

  const correctionIndex = new Map();
  const correctionVocabulary = [...new Set([
    ...CORRECTION_VOCABULARY,
    ...[...wordFrequency.entries()].filter(([, frequency]) => frequency >= 3).map(([token]) => token),
  ])];
  for (const token of correctionVocabulary) {
    if (token.length < 4) continue;
    const key = `${token[0]}:${token.length}`;
    correctionIndex.set(key, [...(correctionIndex.get(key) || []), token]);
  }

  function search(segments, limit = 14) {
    const inputInterpretations = segments.map((segment) => interpretSegment(segment, wordFrequency, correctionIndex));
    const seenQueries = new Set();
    const queries = inputInterpretations
      .flatMap((interpretation) => interpretation.concepts)
      .map((segment) => buildQuery(segment, documentFrequency, symptoms.length))
      .filter((query) => {
        if (!query.tokens.length || seenQueries.has(query.normalized)) return false;
        seenQueries.add(query.normalized);
        return true;
      });
    if (!queries.length) return { results: [], combinations: [], recommendation: null, interpretedSegments: [], inputInterpretations };

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
      const retrievedSegmentIndexes = segmentMatches.map((match, index) => match ? index : -1).filter((index) => index >= 0);
      if (!retrievedSegmentIndexes.length) return null;
      const matchedSegmentIndexes = segmentMatches
        .map((match, index) => match?.score >= SUPPORTED_SEGMENT_SCORE ? index : -1)
        .filter((index) => index >= 0);

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
          matched: Boolean(match && match.score >= SUPPORTED_SEGMENT_SCORE),
          retrieved: Boolean(match),
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

    const recommendation = recommendReviewSet(allResults, queries.length);
    const displayedResults = allResults.slice(0, limit);
    for (const remedyId of recommendation?.remedyIds || []) {
      const recommendedResult = allResults.find((result) => result.id === remedyId);
      if (recommendedResult && !displayedResults.some((result) => result.id === remedyId)) displayedResults.push(recommendedResult);
    }

    return {
      results: displayedResults,
      combinations: combinationCandidates(allResults, queries.length),
      recommendation,
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
