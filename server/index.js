const patientTableSql = `CREATE TABLE IF NOT EXISTS patients (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  age INTEGER,
  sex TEXT,
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'Active',
  last_visit TEXT,
  last_symptom TEXT,
  created_at TEXT NOT NULL
)`;

const caseTableSql = `CREATE TABLE IF NOT EXISTS cases (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL,
  description TEXT,
  symptoms_json TEXT NOT NULL,
  remedy_id TEXT NOT NULL,
  remedy_code TEXT NOT NULL,
  remedy_name TEXT NOT NULL,
  remedy_scientific TEXT,
  rationale TEXT,
  dataset_version TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (patient_id) REFERENCES patients(id)
)`;

const casePatientIndexSql = "CREATE INDEX IF NOT EXISTS idx_cases_patient_id ON cases(patient_id)";
const caseCreatedIndexSql = "CREATE INDEX IF NOT EXISTS idx_cases_created_at ON cases(created_at DESC)";

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

async function ensureSchema(db) {
  await db.batch([
    db.prepare(patientTableSql),
    db.prepare(caseTableSql),
    db.prepare(casePatientIndexSql),
    db.prepare(caseCreatedIndexSql),
  ]);
}

function displayDate(value) {
  if (!value) return null;
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(value));
}

function patientFromRow(row) {
  return {
    id: row.id,
    name: row.full_name,
    age: row.age,
    sex: row.sex || "",
    phone: row.phone || "",
    status: row.status,
    lastVisit: displayDate(row.last_visit),
    symptom: row.last_symptom || "",
  };
}

function caseFromRow(row) {
  let symptoms = [];
  try { symptoms = JSON.parse(row.symptoms_json); } catch { symptoms = []; }
  return {
    id: row.id,
    patientId: row.patient_id,
    patientName: row.patient_name,
    date: displayDate(row.created_at),
    description: row.description || "",
    symptoms,
    remedyId: row.remedy_id,
    remedyCode: row.remedy_code,
    remedyName: row.remedy_name,
    remedyScientific: row.remedy_scientific || "",
    rationale: row.rationale || "",
    datasetVersion: row.dataset_version,
  };
}

async function handleApi(request, environment) {
  const db = environment.DB;
  if (!db) return json({ error: "The clinical database is not connected." }, 503);
  await ensureSchema(db);

  const url = new URL(request.url);
  if (url.pathname === "/api/patients" && request.method === "GET") {
    const result = await db.prepare("SELECT * FROM patients ORDER BY created_at DESC").all();
    return json({ patients: (result.results || []).map(patientFromRow) });
  }

  if (url.pathname === "/api/patients" && request.method === "POST") {
    const body = await request.json().catch(() => ({}));
    const name = String(body.name || "").trim();
    const age = body.age === null || body.age === "" || body.age === undefined ? null : Number(body.age);
    if (name.length < 2) return json({ error: "A patient name is required." }, 400);
    if (age !== null && (!Number.isInteger(age) || age < 0 || age > 120)) return json({ error: "Enter a valid age between 0 and 120." }, 400);
    const id = `P-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const createdAt = new Date().toISOString();
    await db.prepare("INSERT INTO patients (id, full_name, age, sex, phone, status, created_at) VALUES (?, ?, ?, ?, ?, 'Active', ?)")
      .bind(id, name, age, String(body.sex || "").trim(), String(body.phone || "").trim(), createdAt).run();
    const patient = await db.prepare("SELECT * FROM patients WHERE id = ?").bind(id).first();
    return json({ patient: patientFromRow(patient) }, 201);
  }

  if (url.pathname === "/api/cases" && request.method === "GET") {
    const result = await db.prepare(`SELECT cases.*, patients.full_name AS patient_name
      FROM cases JOIN patients ON patients.id = cases.patient_id
      ORDER BY cases.created_at DESC`).all();
    return json({ cases: (result.results || []).map(caseFromRow) });
  }

  if (url.pathname === "/api/cases" && request.method === "POST") {
    const body = await request.json().catch(() => ({}));
    const patientId = String(body.patientId || "");
    const symptoms = Array.isArray(body.symptoms) ? body.symptoms.map((item) => String(item).trim()).filter(Boolean) : [];
    const remedy = body.remedy || {};
    if (!patientId || symptoms.length === 0 || !remedy.id || !remedy.name || !remedy.code) return json({ error: "Patient, symptoms and a source remedy are required." }, 400);
    const existingPatient = await db.prepare("SELECT id FROM patients WHERE id = ?").bind(patientId).first();
    if (!existingPatient) return json({ error: "The selected patient no longer exists." }, 404);

    const id = `C-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const createdAt = new Date().toISOString();
    await db.batch([
      db.prepare(`INSERT INTO cases (id, patient_id, description, symptoms_json, remedy_id, remedy_code, remedy_name, remedy_scientific, rationale, dataset_version, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(id, patientId, String(body.description || ""), JSON.stringify(symptoms), String(remedy.id), String(remedy.code), String(remedy.name), String(remedy.scientific || ""), String(body.rationale || ""), String(body.datasetVersion || "1.0.0"), createdAt),
      db.prepare("UPDATE patients SET last_visit = ?, last_symptom = ?, status = 'Follow-up' WHERE id = ?")
        .bind(createdAt, symptoms.join(" · "), patientId),
    ]);
    const savedCase = await db.prepare(`SELECT cases.*, patients.full_name AS patient_name
      FROM cases JOIN patients ON patients.id = cases.patient_id WHERE cases.id = ?`).bind(id).first();
    const savedPatient = await db.prepare("SELECT * FROM patients WHERE id = ?").bind(patientId).first();
    return json({ case: caseFromRow(savedCase), patient: patientFromRow(savedPatient) }, 201);
  }

  return json({ error: "Not found" }, 404);
}

export default {
  async fetch(request, environment) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      try { return await handleApi(request, environment); }
      catch (error) { return json({ error: error instanceof Error ? error.message : "Unexpected database error." }, 500); }
    }

    const response = await environment.ASSETS.fetch(request);
    if (response.status !== 404) return response;

    const acceptsHtml = request.headers.get("accept")?.includes("text/html");
    if (!acceptsHtml || request.method !== "GET") return response;

    const fallbackUrl = new URL("/index.html", request.url);
    return environment.ASSETS.fetch(new Request(fallbackUrl, request));
  },
};
