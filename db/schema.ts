export const patientsTableSql = `CREATE TABLE IF NOT EXISTS patients (
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

export const casesTableSql = `CREATE TABLE IF NOT EXISTS cases (
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
