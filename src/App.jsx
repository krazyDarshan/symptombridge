import React, { useEffect, useMemo, useState } from "react";
import { NavLink, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Bell, BookOpen, CalendarDays, Check, CheckCircle2, ChevronRight,
  CircleHelp, ClipboardList, Database, FileSearch, HeartPulse, Home, Info,
  LogOut, Menu, Plus, Search, Settings, ShieldCheck, Stethoscope, Users, X,
} from "lucide-react";
import { useRemedySearch } from "./useRemedySearch";

const patients = [
  { id: "P-1042", name: "Aarav Mehta", age: 28, lastVisit: "21 Aug 2026", status: "Active", symptom: "Left-sided throbbing headache" },
  { id: "P-1037", name: "Ishita Rao", age: 34, lastVisit: "20 Aug 2026", status: "Follow-up", symptom: "Digestive discomfort after meals" },
  { id: "P-1029", name: "Kabir Shah", age: 41, lastVisit: "18 Aug 2026", status: "Completed", symptom: "Intermittent shoulder stiffness" },
  { id: "P-1021", name: "Ananya Nair", age: 25, lastVisit: "17 Aug 2026", status: "Active", symptom: "Seasonal nasal irritation" },
];

const exampleSymptoms = [
  "throbbing headache on the left side",
  "burning stomach after eating",
  "dry cough worse at night",
];

const fallbackDatasetMeta = {
  datasetVersion: "1.0.0",
  sourcePageCount: 1183,
  preparationCount: 77,
  symptomCount: 32031,
  emphasisSpanCount: 2673,
};

function App() {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [evidence, setEvidence] = useState(null);
  const [toast, setToast] = useState("");

  const showToast = (message) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  };

  useEffect(() => setSidebarOpen(false), [location.pathname]);

  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="brand">
          <div className="brand-mark"><HeartPulse size={20} /></div>
          <div><div className="brand-name">SymptomBridge</div><div className="brand-subtitle">Materia Medica workspace</div></div>
          <button className="icon-btn mobile-close" onClick={() => setSidebarOpen(false)} aria-label="Close menu"><X size={18} /></button>
        </div>
        <div className="nav-label">Clinical workspace</div>
        <nav className="nav-list">
          <SideLink to="/dashboard" icon={<Home size={18} />} label="Overview" />
          <SideLink to="/patients" icon={<Users size={18} />} label="Patients" />
          <SideLink to="/consultation" icon={<Plus size={18} />} label="New consultation" />
          <SideLink to="/search" icon={<FileSearch size={18} />} label="Remedy finder" />
          <SideLink to="/cases" icon={<ClipboardList size={18} />} label="Case records" />
        </nav>
        <div className="nav-label secondary-label">Workspace</div>
        <nav className="nav-list">
          <SideLink to="/settings" icon={<Settings size={18} />} label="Preferences" />
          <button className="nav-item nav-button" onClick={() => showToast("Sign-out will be connected with practitioner authentication.")}><LogOut size={18} /><span>Sign out</span></button>
        </nav>
        <div className="sidebar-footer">
          <div className="secure-badge"><ShieldCheck size={15} /><span>Clinical reference only</span></div>
          <div className="version">Dataset v1.0.0</div>
        </div>
      </aside>

      {sidebarOpen && <button className="sidebar-scrim" aria-label="Close menu" onClick={() => setSidebarOpen(false)} />}

      <div className="main-area">
        <header className="topbar">
          <button className="icon-btn mobile-menu" onClick={() => setSidebarOpen(true)} aria-label="Open menu"><Menu size={20} /></button>
          <div className="breadcrumbs"><span>Workspace</span><ChevronRight size={13} /><strong>{pageTitle(location.pathname)}</strong></div>
          <div className="top-actions">
            <button className="icon-btn" aria-label="Notifications"><Bell size={18} /></button>
            <div className="profile"><div className="avatar">DR</div><div className="profile-text"><strong>Dr. Riya</strong><span>Practitioner</span></div></div>
          </div>
        </header>
        <main className="content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/patients" element={<Patients showToast={showToast} />} />
            <Route path="/patients/:id" element={<PatientProfile />} />
            <Route path="/consultation" element={<Consultation showToast={showToast} setEvidence={setEvidence} />} />
            <Route path="/search" element={<SearchPage setEvidence={setEvidence} showToast={showToast} />} />
            <Route path="/cases" element={<Cases />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Dashboard />} />
          </Routes>
        </main>
      </div>
      {evidence && <EvidenceModal remedy={evidence} onClose={() => setEvidence(null)} />}
      {toast && <div className="toast" role="status"><CheckCircle2 size={17} />{toast}</div>}
    </div>
  );
}

function pageTitle(pathname) {
  if (pathname.startsWith("/patients/")) return "Patient profile";
  if (pathname === "/patients") return "Patients";
  if (pathname === "/consultation") return "New consultation";
  if (pathname === "/search") return "Remedy finder";
  if (pathname === "/cases") return "Case records";
  if (pathname === "/settings") return "Preferences";
  return "Overview";
}

function SideLink({ to, icon, label }) {
  return <NavLink to={to} className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>{icon}<span>{label}</span></NavLink>;
}

function PageHeader({ eyebrow, title, description, action }) {
  return <div className="page-header"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{action}</div>;
}

function useDatasetMeta() {
  const [metadata, setMetadata] = useState(fallbackDatasetMeta);
  useEffect(() => {
    fetch("/data/dataset-meta.json").then((response) => response.json()).then(setMetadata).catch(() => setMetadata(fallbackDatasetMeta));
  }, []);
  return metadata;
}

function Dashboard() {
  const navigate = useNavigate();
  const metadata = useDatasetMeta();
  const [quickSearch, setQuickSearch] = useState("");
  const beginSearch = (event) => {
    event.preventDefault();
    navigate("/search", { state: { query: quickSearch.trim() } });
  };

  return <div>
    <PageHeader eyebrow="Good morning, Dr. Riya" title="Clinical workspace" description="Move from the patient’s words to source-linked remedy candidates in one clear workflow." action={<button className="primary-btn" onClick={() => navigate("/consultation")}><Plus size={17} /> New consultation</button>} />
    <section className="search-entry-card">
      <div className="search-entry-copy"><span className="section-kicker"><Stethoscope size={16} /> Begin with the symptom</span><h2>Search the complete Materia Medica source.</h2><p>Results change as you type. Add distinct symptoms one by one to keep remedies that match the whole case at the top.</p></div>
      <form className="quick-search" onSubmit={beginSearch}><Search size={20} /><input value={quickSearch} onChange={(event) => setQuickSearch(event.target.value)} placeholder="Describe a symptom, modality or location…" aria-label="Quick symptom search" /><button className="primary-btn" type="submit" disabled={quickSearch.trim().length < 2}>Find remedies</button></form>
    </section>
    <div className="dataset-stats">
      <DatasetStat value={metadata.symptomCount?.toLocaleString()} label="Indexed symptoms" />
      <DatasetStat value={metadata.preparationCount} label="Remedy preparations" />
      <DatasetStat value={metadata.emphasisSpanCount?.toLocaleString()} label="Bold source passages" />
      <DatasetStat value={metadata.sourcePageCount?.toLocaleString()} label="Source pages" />
    </div>
    <div className="two-col">
      <section className="panel">
        <div className="panel-head"><div><h3>Recent patients</h3><p>Continue a consultation or review the last recorded concern.</p></div><button className="text-btn" onClick={() => navigate("/patients")}>View patients <ChevronRight size={15} /></button></div>
        <div className="case-list">{patients.slice(0, 3).map((patient) => <button className="case-row" key={patient.id} onClick={() => navigate(`/patients/${patient.id}`)}><div className="case-avatar">{initials(patient.name)}</div><div className="case-main"><strong>{patient.name}</strong><span>{patient.symptom}</span></div><span className={`status ${patient.status === "Follow-up" ? "amber" : patient.status === "Completed" ? "neutral" : ""}`}>{patient.status}</span><ChevronRight size={17} /></button>)}</div>
      </section>
      <section className="panel workflow-panel"><div className="panel-head"><div><h3>One connected flow</h3><p>Keep the source evidence and practitioner decision together.</p></div></div><WorkflowRow number="1" title="Capture" text="Record the patient’s words without changing their meaning." /><WorkflowRow number="2" title="Compare" text="Add symptoms and review remedies that match across them." /><WorkflowRow number="3" title="Select" text="Choose the remedy and retain its source evidence." /></section>
    </div>
    <div className="clinical-note"><Info size={16} /><span>Search priority reflects typography in the source. It supports review and does not represent diagnostic certainty or effectiveness.</span></div>
  </div>;
}

function DatasetStat({ value, label }) { return <div className="dataset-stat"><strong>{value}</strong><span>{label}</span></div>; }
function WorkflowRow({ number, title, text }) { return <div className="workflow-row"><span>{number}</span><div><strong>{title}</strong><p>{text}</p></div></div>; }

function Patients({ showToast }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const filtered = patients.filter((patient) => `${patient.name} ${patient.id} ${patient.symptom}`.toLowerCase().includes(query.toLowerCase()));
  return <div>
    <PageHeader eyebrow="Patient records" title="Patients" description="Find a patient and continue their connected consultation history." action={<button className="primary-btn" onClick={() => showToast("Patient creation is ready for the secure patient database.")}><Plus size={17} /> Add patient</button>} />
    <section className="panel"><div className="toolbar"><div className="search-box"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, ID or last concern…" /></div><span className="record-count">{filtered.length} records</span></div><div className="table-wrap"><table><thead><tr><th>Patient</th><th>Patient ID</th><th>Age</th><th>Last visit</th><th>Status</th><th /></tr></thead><tbody>{filtered.map((patient) => <tr key={patient.id} onClick={() => navigate(`/patients/${patient.id}`)}><td><div className="person-cell"><div className="small-avatar">{initials(patient.name)}</div><div><strong>{patient.name}</strong><span>{patient.symptom}</span></div></div></td><td>{patient.id}</td><td>{patient.age}</td><td>{patient.lastVisit}</td><td><span className={`status ${patient.status === "Follow-up" ? "amber" : patient.status === "Completed" ? "neutral" : ""}`}>{patient.status}</span></td><td><ChevronRight size={17} /></td></tr>)}</tbody></table></div></section>
  </div>;
}

function PatientProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const patient = patients.find((item) => item.id === id) || patients[0];
  return <div>
    <button className="back-btn" onClick={() => navigate("/patients")}><ArrowLeft size={16} /> Back to patients</button>
    <PageHeader eyebrow="Patient profile" title={patient.name} description={`${patient.id} · Age ${patient.age} · Last visit ${patient.lastVisit}`} action={<button className="primary-btn" onClick={() => navigate("/consultation", { state: { patientId: patient.id } })}><Plus size={17} /> New consultation</button>} />
    <div className="profile-grid"><section className="panel profile-summary"><div className="large-avatar">{initials(patient.name)}</div><h3>{patient.name}</h3><span className="muted">{patient.id}</span><div className="profile-details"><div><span>Age</span><strong>{patient.age}</strong></div><div><span>Status</span><strong>{patient.status}</strong></div><div><span>Last visit</span><strong>{patient.lastVisit}</strong></div></div></section><section className="panel"><div className="panel-head"><div><h3>Consultation history</h3><p>Symptoms, source matches and practitioner decisions remain connected.</p></div></div><div className="history-card"><div className="history-date">21 AUG 2026</div><strong>{patient.symptom}</strong><p>Symptoms captured. Remedy source review awaiting a saved practitioner decision.</p><div className="history-meta"><span>Source reviewed</span><span>Follow-up pending</span></div></div></section></div>
  </div>;
}

function Consultation({ showToast, setEvidence }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [patientId, setPatientId] = useState(location.state?.patientId || patients[0].id);
  const [description, setDescription] = useState("");
  const [symptoms, setSymptoms] = useState([]);
  const [symptomDraft, setSymptomDraft] = useState("");
  const [selectedRemedy, setSelectedRemedy] = useState(null);
  const [rationale, setRationale] = useState("");
  const patient = patients.find((item) => item.id === patientId) || patients[0];

  const addCapturedSymptom = () => {
    const value = symptomDraft.trim();
    if (value.length < 2 || symptoms.some((item) => item.toLowerCase() === value.toLowerCase())) return;
    setSymptoms((current) => [...current, value]); setSymptomDraft("");
  };
  const continueFlow = () => {
    if (step === 2 && symptoms.length === 0 && description.trim().length < 3) { showToast("Add at least one symptom before continuing."); return; }
    if (step === 3 && !selectedRemedy) { showToast("Select a remedy after reviewing its source evidence."); return; }
    setStep((current) => Math.min(4, current + 1));
  };
  const searchSymptoms = symptoms.length > 0 ? symptoms : [description.trim()].filter(Boolean);

  return <div>
    <PageHeader eyebrow="New consultation" title={patient.name} description="Capture symptoms, compare source-linked remedies, and record the practitioner’s selection." />
    <div className="stepper">{["Patient", "Symptoms", "Remedy review", "Decision"].map((label, index) => <div className={`step ${step === index + 1 ? "current" : step > index + 1 ? "done" : ""}`} key={label}><div className="step-circle">{step > index + 1 ? <Check size={15} /> : index + 1}</div><span>{label}</span></div>)}</div>
    {step === 1 && <section className="panel consultation-panel"><SectionTitle number="01" title="Select the patient" text="The consultation and final remedy selection will remain connected to this record." /><label htmlFor="consultation-patient">Patient</label><select id="consultation-patient" value={patientId} onChange={(event) => setPatientId(event.target.value)}>{patients.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.id}</option>)}</select><div className="selected-patient"><div className="small-avatar">{initials(patient.name)}</div><div><strong>{patient.name}</strong><span>{patient.symptom}</span></div><span className="status">{patient.status}</span></div><FormActions step={step} onBack={() => setStep(step - 1)} onNext={continueFlow} /></section>}
    {step === 2 && <section className="panel consultation-panel"><SectionTitle number="02" title="Capture the patient’s words" text="Keep each distinct symptom separate so the remedy ranking can compare the whole case." /><label htmlFor="patient-description">Patient’s complete description</label><textarea id="patient-description" rows="5" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Record the description in the patient’s own words…" /><label htmlFor="symptom-entry">Confirmed symptoms</label><div className="capture-entry"><input id="symptom-entry" value={symptomDraft} onChange={(event) => setSymptomDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addCapturedSymptom(); } }} placeholder="Example: burning stomach after eating" /><button className="secondary-btn" onClick={addCapturedSymptom} disabled={symptomDraft.trim().length < 2}><Plus size={16} /> Add</button></div><SymptomChips symptoms={symptoms} onRemove={(value) => setSymptoms((items) => items.filter((item) => item !== value))} emptyText="Add symptoms individually; press Enter after each one." /><FormActions step={step} onBack={() => setStep(step - 1)} onNext={continueFlow} /></section>}
    {step === 3 && <div><RemedyFinder key={searchSymptoms.join("|")} initialSymptoms={searchSymptoms} selectedRemedy={selectedRemedy} onSelect={setSelectedRemedy} onEvidence={setEvidence} compact /><div className="consultation-footer panel"><button className="secondary-btn" onClick={() => setStep(2)}>Back</button><div className="consultation-selection">{selectedRemedy ? <><CheckCircle2 size={18} /><span><strong>{selectedRemedy.name}</strong> selected for review</span></> : <span>Select one remedy after checking the source wording.</span>}</div><button className="primary-btn" onClick={continueFlow}>Continue to decision <ChevronRight size={16} /></button></div></div>}
    {step === 4 && <section className="panel consultation-panel"><SectionTitle number="04" title="Record the practitioner’s decision" text="The saved record should include the symptoms, selected remedy, dataset version and rationale." /><div className="decision-summary"><div><span>Patient</span><strong>{patient.name}</strong></div><div><span>Symptoms reviewed</span><strong>{searchSymptoms.length}</strong></div><div><span>Selected remedy</span><strong>{selectedRemedy?.name}</strong></div><div><span>Dataset</span><strong>v1.0.0</strong></div></div><label htmlFor="rationale">Selection rationale</label><textarea id="rationale" rows="5" value={rationale} onChange={(event) => setRationale(event.target.value)} placeholder="Record why this remedy was selected after reviewing the matched source symptoms…" /><div className="form-actions"><button className="secondary-btn" onClick={() => setStep(3)}>Back</button><button className="primary-btn" onClick={() => { showToast("Consultation is ready for secure database saving."); navigate("/cases"); }}><CheckCircle2 size={16} /> Complete consultation</button></div></section>}
  </div>;
}

function FormActions({ step, onBack, onNext }) { return <div className="form-actions">{step > 1 ? <button className="secondary-btn" onClick={onBack}>Back</button> : <span />}<button className="primary-btn" onClick={onNext}>Continue <ChevronRight size={16} /></button></div>; }
function SectionTitle({ number, title, text }) { return <div className="section-title"><span className="section-number">{number}</span><div><h3>{title}</h3><p>{text}</p></div></div>; }

function SearchPage({ setEvidence, showToast }) {
  const location = useLocation();
  const [selectedRemedy, setSelectedRemedy] = useState(null);
  const initialSymptoms = location.state?.query ? [location.state.query] : [];
  return <div><PageHeader eyebrow="Materia Medica" title="Remedy finder" description="Type naturally, add distinct symptoms, and review remedies that match across the complete set." /><RemedyFinder initialSymptoms={initialSymptoms} selectedRemedy={selectedRemedy} onSelect={(remedy) => { setSelectedRemedy(remedy); showToast(`${remedy.name} selected for the current review.`); }} onEvidence={setEvidence} /></div>;
}

function RemedyFinder({ initialSymptoms = [], selectedRemedy, onSelect, onEvidence, compact = false }) {
  const [confirmedSymptoms, setConfirmedSymptoms] = useState(() => initialSymptoms.filter(Boolean));
  const [draft, setDraft] = useState("");
  const activeSegments = useMemo(() => [...confirmedSymptoms, ...(draft.trim().length >= 2 ? [draft.trim()] : [])], [confirmedSymptoms, draft]);
  const { status, results, metadata, durationMs, error } = useRemedySearch(activeSegments, 10);
  const addSymptom = () => {
    const value = draft.trim();
    if (value.length < 2 || confirmedSymptoms.some((item) => item.toLowerCase() === value.toLowerCase())) return;
    setConfirmedSymptoms((items) => [...items, value]); setDraft("");
  };
  const removeSymptom = (value) => setConfirmedSymptoms((items) => items.filter((item) => item !== value));

  return <section className={`finder-shell ${compact ? "compact" : ""}`}>
    <div className="finder-main">
      <div className="finder-input-panel">
        <div className="finder-label-row"><label htmlFor={`remedy-query-${compact ? "consultation" : "standalone"}`}>Describe one symptom</label><span>{status === "loading" ? "Loading source…" : metadata ? `${metadata.symptomCount.toLocaleString()} source symptoms ready` : "Source unavailable"}</span></div>
        <div className="finder-input"><Search size={20} /><input id={`remedy-query-${compact ? "consultation" : "standalone"}`} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addSymptom(); } }} placeholder="Example: throbbing headache, worse from movement…" autoComplete="off" />{draft && <button className="clear-input" onClick={() => setDraft("")} aria-label="Clear symptom"><X size={17} /></button>}<button className="primary-btn add-symptom-btn" onClick={addSymptom} disabled={draft.trim().length < 2}><Plus size={16} /> Add symptom</button></div>
        <p className="finder-help">Results update while you type. Press Enter to confirm this symptom, then enter the next one.</p>
        <SymptomChips symptoms={confirmedSymptoms} onRemove={removeSymptom} />
      </div>
      <div className="results-header"><div><h2>{activeSegments.length ? "Matching remedies" : "Start with the first symptom"}</h2><p>{activeSegments.length ? `${results.length} remedies shown · ${status === "searching" ? "updating" : `searched in ${durationMs} ms`}` : "Use the patient’s wording; you can add location, sensation, timing and modalities."}</p></div>{status === "searching" && <span className="searching-indicator"><span />Updating results</span>}</div>
      {error && <div className="error-state"><Info size={18} /><span>{error}</span></div>}
      {!activeSegments.length && <div className="starter-state"><div className="starter-icon"><BookOpen size={24} /></div><h3>Search by the patient’s actual description</h3><p>Try an example, or begin typing above.</p><div className="example-list">{exampleSymptoms.map((example) => <button key={example} onClick={() => setDraft(example)}>{example}</button>)}</div></div>}
      {activeSegments.length > 0 && status === "loading" && <ResultSkeleton />}
      {activeSegments.length > 0 && status !== "loading" && results.length === 0 && <div className="starter-state"><CircleHelp size={24} /><h3>No clear source match yet</h3><p>Use fewer words, check the wording, or add the symptom as a separate entry.</p></div>}
      <div className="remedy-results">{results.map((remedy, index) => <RemedyResult key={remedy.id} rank={index + 1} remedy={remedy} selected={selectedRemedy?.id === remedy.id} querySegments={activeSegments} onSelect={() => onSelect(remedy)} onEvidence={() => onEvidence({ ...remedy, querySegments: activeSegments })} />)}</div>
    </div>
    <aside className="finder-summary">
      <div className="summary-block"><span className="summary-label">Symptoms in this search</span><strong>{activeSegments.length || 0}</strong><p>Remedies matching more of the confirmed symptoms are kept higher in the list.</p></div>
      <div className="summary-symptoms">{activeSegments.length ? activeSegments.map((symptom, index) => <div key={`${symptom}-${index}`}><span>{index + 1}</span><p>{symptom}</p>{index < confirmedSymptoms.length && <Check size={14} />}</div>) : <p className="empty-summary">No symptoms entered yet.</p>}</div>
      <div className="summary-divider" /><span className="summary-label">Current leader</span>
      {results[0] ? <div className="leader-card"><div className="leader-rank">1</div><div><strong>{results[0].name}</strong><span>{results[0].scientific}</span></div><p>{results[0].matchedSegmentCount} of {results[0].totalSegmentCount} symptoms matched</p></div> : <p className="empty-summary">The leading remedy will appear here as you type.</p>}
      {selectedRemedy && <div className="selected-summary"><CheckCircle2 size={17} /><div><span>Selected for review</span><strong>{selectedRemedy.name}</strong></div></div>}
      <div className="source-key"><span className="summary-label">Source emphasis</span><div><i className="priority-dot p3" />High</div><div><i className="priority-dot p2" />Partial</div><div><i className="priority-dot p1" />Standard</div></div>
      <div className="summary-note"><ShieldCheck size={16} /><p>The doctor reviews the source wording and makes the final selection.</p></div>
    </aside>
  </section>;
}

function SymptomChips({ symptoms, onRemove, emptyText }) {
  if (!symptoms.length) return emptyText ? <p className="empty-chips">{emptyText}</p> : null;
  return <div className="symptom-chips">{symptoms.map((symptom, index) => <span key={`${symptom}-${index}`}><b>{index + 1}</b>{symptom}<button onClick={() => onRemove(symptom)} aria-label={`Remove ${symptom}`}><X size={14} /></button></span>)}</div>;
}

function RemedyResult({ rank, remedy, selected, querySegments, onSelect, onEvidence }) {
  const primaryEvidence = remedy.evidence[0];
  return <article className={`remedy-result ${selected ? "selected" : ""}`}>
    <div className="result-rank">{rank}</div>
    <div className="result-content">
      <div className="result-title-row"><div><h3>{remedy.name}</h3><p>{remedy.scientific} · {remedy.code}</p></div><div className="result-badges"><span className="match-label">{remedy.label}</span><PriorityBadge priority={remedy.highestPriority} /></div></div>
      <div className="coverage-row"><div className="coverage-track"><span style={{ width: `${Math.round((remedy.matchedSegmentCount / remedy.totalSegmentCount) * 100)}%` }} /></div><strong>{remedy.matchedSegmentCount} of {remedy.totalSegmentCount} symptoms supported</strong></div>
      {primaryEvidence && <div className="source-preview"><div className="source-preview-head"><span>Best matching source symptom</span><button onClick={onEvidence}>Page {primaryEvidence.page} · View evidence</button></div><p><HighlightedText text={primaryEvidence.text} segments={querySegments} /></p></div>}
    </div>
    <div className="result-action"><button className={selected ? "selected-btn" : "secondary-btn"} onClick={onSelect}>{selected ? <><CheckCircle2 size={16} /> Selected</> : "Select remedy"}</button><button className="text-btn" onClick={onEvidence}><BookOpen size={15} /> Source details</button></div>
  </article>;
}

function PriorityBadge({ priority }) {
  const label = priority === 3 ? "High emphasis" : priority === 2 ? "Partial emphasis" : "Standard text";
  return <span className={`priority-badge priority-${priority}`}>{label}</span>;
}

function HighlightedText({ text, segments }) {
  const tokens = [...new Set(segments.flatMap((segment) => segment.toLowerCase().split(/[^a-z0-9]+/)).filter((token) => token.length >= 3))].sort((a, b) => b.length - a.length).slice(0, 20);
  if (!tokens.length) return text;
  const escaped = tokens.map((token) => token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const matcher = new RegExp(`(${escaped.join("|")})`, "gi");
  return text.split(matcher).map((part, index) => tokens.some((token) => token.toLowerCase() === part.toLowerCase()) ? <mark key={index}>{part}</mark> : <React.Fragment key={index}>{part}</React.Fragment>);
}

function ResultSkeleton() { return <div className="result-skeleton">{[1, 2, 3].map((item) => <div key={item}><span /><span /><span /></div>)}</div>; }

function EvidenceModal({ remedy, onClose }) {
  return <div className="modal-backdrop" onClick={onClose}><div className="modal evidence-modal" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label={`Source evidence for ${remedy.name}`}>
    <div className="modal-head"><div><span className="eyebrow">Source evidence</span><h2>{remedy.name}</h2><p>{remedy.scientific} · {remedy.code}</p></div><button className="icon-btn" onClick={onClose} aria-label="Close evidence"><X size={19} /></button></div>
    <div className="modal-coverage"><strong>{remedy.matchedSegmentCount} of {remedy.totalSegmentCount}</strong><span>entered symptoms have supporting source matches</span></div>
    <div className="evidence-list">{remedy.evidence.map((evidence) => <article key={evidence.id}><div className="evidence-row-head"><span>For “{evidence.segment}”</span><div><PriorityBadge priority={evidence.priority} /><b>Page {evidence.page}</b></div></div><p><HighlightedText text={evidence.text} segments={remedy.querySegments || [evidence.segment]} /></p>{evidence.emphasizedText && <div className="bold-source"><strong>Bold in source</strong><span>{evidence.emphasizedText.replaceAll("|", " ")}</span></div>}</article>)}</div>
    <div className="evidence-disclaimer"><ShieldCheck size={17} /><span>Source emphasis is a retrieval signal only. It is not diagnostic certainty or a treatment recommendation.</span></div>
    <div className="modal-actions"><button className="secondary-btn" onClick={onClose}>Close</button></div>
  </div></div>;
}

function Cases() {
  return <div><PageHeader eyebrow="Continuity" title="Case records" description="Consultations, reviewed candidates and practitioner decisions in one history." /><section className="panel"><div className="table-wrap"><table><thead><tr><th>Case</th><th>Patient</th><th>Date</th><th>Last concern</th><th>Status</th></tr></thead><tbody>{patients.map((patient, index) => <tr key={patient.id}><td><strong>C-{String(104 + index).padStart(4, "0")}</strong></td><td>{patient.name}</td><td>{patient.lastVisit}</td><td>{patient.symptom}</td><td><span className={`status ${patient.status === "Follow-up" ? "amber" : patient.status === "Completed" ? "neutral" : ""}`}>{patient.status}</span></td></tr>)}</tbody></table></div></section></div>;
}

function SettingsPage() {
  return <div><PageHeader eyebrow="Workspace" title="Preferences" description="Control how source evidence is presented during remedy review." /><section className="panel settings-panel"><SettingRow icon={<BookOpen size={18} />} title="Original source wording" text="Always show the preserved symptom text and PDF page." /><SettingRow icon={<Database size={18} />} title="Source emphasis" text="Show normal, partial and high-emphasis indicators from the PDF." /><SettingRow icon={<CalendarDays size={18} />} title="Consultation continuity" text="Keep the selected remedy and reviewed evidence connected to the case." /></section></div>;
}

function SettingRow({ icon, title, text }) { return <div className="setting-row"><div className="setting-icon">{icon}</div><div><strong>{title}</strong><span>{text}</span></div><div className="toggle on" aria-label={`${title} enabled`}><div /></div></div>; }
function initials(name) { return name.split(" ").map((part) => part[0]).join("").slice(0, 2); }

export default App;
