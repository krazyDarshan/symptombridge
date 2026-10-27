import React, { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, BookOpen, CalendarDays, Check, CheckCircle2, ChevronRight,
  CircleHelp, ClipboardList, Database, FileSearch, HeartPulse, Home, Info,
  Menu, Plus, Search, Settings, ShieldCheck, Stethoscope, UserPlus, Users, X,
} from "lucide-react";
import { useRemedySearch } from "./useRemedySearch";
import { useClinicalRecords } from "./useClinicalRecords";
import { SymptomCapture, LanguageControls, InterpretationStatus } from "./SymptomCapture";

const fallbackDatasetMeta = {
  datasetVersion: "1.0.0",
  sourcePageCount: 1183,
  preparationCount: 77,
  symptomCount: 32031,
  emphasisSpanCount: 2673,
};

function App() {
  const location = useLocation();
  const records = useClinicalRecords();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [evidence, setEvidence] = useState(null);
  const [patientModalOpen, setPatientModalOpen] = useState(false);
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
          <div className="brand-mark" aria-hidden="true"><span>S</span><i>B</i></div>
          <div><div className="brand-name">SymptomBridge</div><div className="brand-subtitle">Clinical casebook · Vol. I</div></div>
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
        </nav>
        <div className="sidebar-footer">
          <div className="secure-badge"><ShieldCheck size={15} /><span>Clinical reference only</span></div>
          <div className="version">77 remedies · Dataset v1.0.0</div>
        </div>
      </aside>

      {sidebarOpen && <button className="sidebar-scrim" aria-label="Close menu" onClick={() => setSidebarOpen(false)} />}

      <div className="main-area">
        <header className="topbar">
          <button className="icon-btn mobile-menu" onClick={() => setSidebarOpen(true)} aria-label="Open menu"><Menu size={20} /></button>
          <div className="breadcrumbs"><span>Casebook index</span><ChevronRight size={13} /><strong>{pageTitle(location.pathname)}</strong></div>
          <div className="top-actions">
            <div className="profile"><div className="avatar">DR</div><div className="profile-text"><strong>Practitioner</strong><span>Casebook desk</span></div></div>
          </div>
        </header>
        <main className="content">
          <Routes>
            <Route path="/" element={<Dashboard patients={records.patients} recordsStatus={records.status} onAddPatient={() => setPatientModalOpen(true)} />} />
            <Route path="/dashboard" element={<Dashboard patients={records.patients} recordsStatus={records.status} onAddPatient={() => setPatientModalOpen(true)} />} />
            <Route path="/patients" element={<Patients patients={records.patients} recordsStatus={records.status} onAddPatient={() => setPatientModalOpen(true)} />} />
            <Route path="/patients/:id" element={<PatientProfile patients={records.patients} cases={records.cases} recordsStatus={records.status} />} />
            <Route path="/consultation" element={<Consultation patients={records.patients} recordsStatus={records.status} onAddPatient={() => setPatientModalOpen(true)} onSaveCase={records.saveCase} showToast={showToast} setEvidence={setEvidence} />} />
            <Route path="/search" element={<SearchPage setEvidence={setEvidence} showToast={showToast} />} />
            <Route path="/cases" element={<Cases cases={records.cases} recordsStatus={records.status} />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Dashboard />} />
          </Routes>
        </main>
      </div>
      {evidence && <EvidenceModal remedy={evidence} onClose={() => setEvidence(null)} />}
      {patientModalOpen && <AddPatientModal onClose={() => setPatientModalOpen(false)} onSave={async (details) => { const patient = await records.addPatient(details); setPatientModalOpen(false); showToast(`${patient.name} added to patient records.`); }} />}
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
  return <div className="page-header"><div className="page-heading-copy"><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{action}<span className="page-header-rule" aria-hidden="true" /></div>;
}

function useDatasetMeta() {
  const [metadata, setMetadata] = useState(fallbackDatasetMeta);
  useEffect(() => {
    fetch("/data/dataset-meta.json").then((response) => response.json()).then(setMetadata).catch(() => setMetadata(fallbackDatasetMeta));
  }, []);
  return metadata;
}

function Dashboard({ patients, recordsStatus, onAddPatient }) {
  const navigate = useNavigate();
  const metadata = useDatasetMeta();
  const [quickSearch, setQuickSearch] = useState("");
  const quickSearchSegments = useMemo(() => quickSearch.trim().length >= 2 ? [quickSearch.trim()] : [], [quickSearch]);
  const { status: quickSearchStatus, results: quickSearchResults, ai: quickAi } = useRemedySearch(quickSearchSegments, 6);
  const openFinder = () => {
    const query = quickSearch.trim();
    if (query.length < 2) return;
    navigate("/search", { state: { query } });
  };
  const beginSearch = (event) => {
    event.preventDefault();
    openFinder();
  };

  return <div>
    <PageHeader eyebrow="Clinical reference workspace" title="From symptoms to source evidence" description="Move from the patient’s words to source-linked remedy candidates in one clear workflow." action={<button className="primary-btn" onClick={() => patients.length ? navigate("/consultation") : onAddPatient()}><Plus size={17} /> New consultation</button>} />
    <section className="search-entry-card">
      <div className="search-entry-copy"><span className="section-kicker"><Stethoscope size={16} /> Begin with the symptom</span><h2>Search the complete Materia Medica source.</h2><p>Results change as you type. Add distinct symptoms one by one to keep remedies that match the whole case at the top.</p></div>
      <LanguageControls />
      <form className="quick-search" onSubmit={beginSearch}><Search size={20} /><input value={quickSearch} onChange={(event) => setQuickSearch(event.target.value)} placeholder="Describe a symptom, modality or location…" aria-label="Quick symptom search" autoComplete="off" aria-controls="overview-remedy-suggestions" aria-expanded={quickSearch.trim().length >= 2} /><SymptomCapture onAccept={text => setQuickSearch(current => [current.trim(), text].filter(Boolean).join("; "))} /><button className="primary-btn" type="submit" disabled={quickSearch.trim().length < 2}>Open full finder</button></form>
      <InterpretationStatus ai={quickAi} />
      <LiveRemedySuggestions id="overview-remedy-suggestions" query={quickSearch} status={quickSearchStatus} results={quickSearchResults} onChoose={openFinder} />
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
        {recordsStatus === "loading" ? <InlineLoading text="Loading patient records…" /> : patients.length ? <div className="case-list">{patients.slice(0, 3).map((patient) => <button className="case-row" key={patient.id} onClick={() => navigate(`/patients/${patient.id}`)}><div className="case-avatar">{initials(patient.name)}</div><div className="case-main"><strong>{patient.name}</strong><span>{patient.symptom || "No consultation recorded"}</span></div><span className={`status ${patient.status === "Follow-up" ? "amber" : patient.status === "Completed" ? "neutral" : ""}`}>{patient.status}</span><ChevronRight size={17} /></button>)}</div> : <CompactEmptyState icon={<UserPlus size={20} />} title="No patient records yet" text="Add the first patient when an actual consultation begins." action="Add patient" onAction={onAddPatient} />}
      </section>
      <section className="panel workflow-panel"><div className="panel-head"><div><h3>One connected flow</h3><p>Keep the source evidence and practitioner decision together.</p></div></div><WorkflowRow number="1" title="Capture" text="Record the patient’s words without changing their meaning." /><WorkflowRow number="2" title="Compare" text="Add symptoms and review remedies that match across them." /><WorkflowRow number="3" title="Select" text="Choose the remedy and retain its source evidence." /></section>
    </div>
    <div className="clinical-note"><Info size={16} /><span>Search priority reflects typography in the source. It supports review and does not represent diagnostic certainty or effectiveness.</span></div>
  </div>;
}

function DatasetStat({ value, label }) { return <div className="dataset-stat"><strong>{value}</strong><span>{label}</span></div>; }
function WorkflowRow({ number, title, text }) { return <div className="workflow-row"><span>{number}</span><div><strong>{title}</strong><p>{text}</p></div></div>; }

function Patients({ patients, recordsStatus, onAddPatient }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const filtered = patients.filter((patient) => `${patient.name} ${patient.id} ${patient.symptom}`.toLowerCase().includes(query.toLowerCase()));
  return <div>
    <PageHeader eyebrow="Patient records" title="Patients" description="Only patients entered by the practitioner appear here—there are no seeded profiles." action={<button className="primary-btn" onClick={onAddPatient}><Plus size={17} /> Add patient</button>} />
    <section className="panel"><div className="toolbar"><div className="search-box"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, ID or last concern…" /></div><span className="record-count">{filtered.length} records</span></div>{recordsStatus === "loading" ? <InlineLoading text="Loading patient records…" /> : filtered.length ? <div className="table-wrap"><table><thead><tr><th>Patient</th><th>Patient ID</th><th>Age</th><th>Last visit</th><th>Status</th><th /></tr></thead><tbody>{filtered.map((patient) => <tr key={patient.id} onClick={() => navigate(`/patients/${patient.id}`)}><td><div className="person-cell"><div className="small-avatar">{initials(patient.name)}</div><div><strong>{patient.name}</strong><span>{patient.symptom || "No consultation recorded"}</span></div></div></td><td>{patient.id}</td><td>{patient.age || "—"}</td><td>{patient.lastVisit || "No visits"}</td><td><span className={`status ${patient.status === "Follow-up" ? "amber" : patient.status === "Completed" ? "neutral" : ""}`}>{patient.status}</span></td><td><ChevronRight size={17} /></td></tr>)}</tbody></table></div> : <CompactEmptyState icon={<UserPlus size={20} />} title={query ? "No matching patient" : "No patient records yet"} text={query ? "Try a different name, patient ID or concern." : "Create a record when a real patient begins a consultation."} action={query ? null : "Add first patient"} onAction={onAddPatient} />}</section>
  </div>;
}

function PatientProfile({ patients, cases, recordsStatus }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const patient = patients.find((item) => item.id === id);
  const patientCases = cases.filter((item) => item.patientId === id);
  if (recordsStatus === "loading") return <InlineLoading text="Loading patient record…" />;
  if (!patient) return <div><button className="back-btn" onClick={() => navigate("/patients")}><ArrowLeft size={16} /> Back to patients</button><CompactEmptyState icon={<Users size={21} />} title="Patient not found" text="This patient record does not exist or is no longer available." /></div>;
  return <div>
    <button className="back-btn" onClick={() => navigate("/patients")}><ArrowLeft size={16} /> Back to patients</button>
    <PageHeader eyebrow="Patient profile" title={patient.name} description={`${patient.id} · Age ${patient.age} · Last visit ${patient.lastVisit}`} action={<button className="primary-btn" onClick={() => navigate("/consultation", { state: { patientId: patient.id } })}><Plus size={17} /> New consultation</button>} />
    <div className="profile-grid"><section className="panel profile-summary"><div className="large-avatar">{initials(patient.name)}</div><h3>{patient.name}</h3><span className="muted">{patient.id}</span><div className="profile-details"><div><span>Age</span><strong>{patient.age || "Not recorded"}</strong></div><div><span>Status</span><strong>{patient.status}</strong></div><div><span>Last visit</span><strong>{patient.lastVisit || "No visits"}</strong></div></div></section><section className="panel"><div className="panel-head"><div><h3>Consultation history</h3><p>Symptoms, source matches and practitioner decisions remain connected.</p></div></div>{patientCases.length ? <div className="history-list">{patientCases.map((record) => { const remedies = remediesForRecord(record); return <div className="history-card" key={record.id}><div className="history-date">{record.date}</div><strong>{record.symptoms.join(" · ")}</strong><p><b>{remedies.map((remedy) => remedy.name).join(" + ")}</b> {remedies.length === 1 ? "was" : "were"} retained as the source-review set.{record.rationale ? ` ${record.rationale}` : ""}</p><div className="history-meta"><span>{remedies.map((remedy) => remedy.code).join(" · ")}</span><span>{record.symptoms.length} symptom{record.symptoms.length === 1 ? "" : "s"}</span></div></div>; })}</div> : <CompactEmptyState icon={<ClipboardList size={20} />} title="No consultations recorded" text="Completed consultations for this patient will appear here." />}</section></div>
  </div>;
}

function Consultation({ patients, recordsStatus, onAddPatient, onSaveCase, showToast, setEvidence }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [patientId, setPatientId] = useState(location.state?.patientId || "");
  const [description, setDescription] = useState("");
  const [symptoms, setSymptoms] = useState([]);
  const [symptomDraft, setSymptomDraft] = useState("");
  const [selectedRemedies, setSelectedRemedies] = useState([]);
  const [rationale, setRationale] = useState("");
  const [saving, setSaving] = useState(false);
  const patient = patients.find((item) => item.id === patientId) || patients[0];

  useEffect(() => {
    if (!patientId && patients[0]) setPatientId(patients[0].id);
  }, [patientId, patients]);

  const addCapturedSymptom = () => {
    const value = symptomDraft.trim();
    if (value.length < 2 || symptoms.some((item) => item.toLowerCase() === value.toLowerCase())) return;
    setSymptoms((current) => [...current, value]); setSymptomDraft("");
  };
  const continueFlow = () => {
    if (step === 2 && symptoms.length === 0) { showToast("Confirm at least one distinct symptom before continuing."); return; }
    if (step === 3 && selectedRemedies.length === 0) { showToast("Keep at least one remedy in the review set after checking its source evidence."); return; }
    setStep((current) => Math.min(4, current + 1));
  };
  const searchSymptoms = symptoms;

  const completeConsultation = async () => {
    if (!patient || selectedRemedies.length === 0 || saving) return;
    setSaving(true);
    try {
      await onSaveCase({
        patientId: patient.id,
        description: description.trim(),
        symptoms: searchSymptoms,
        remedies: selectedRemedies.map((remedy) => ({
          id: remedy.id,
          code: remedy.code,
          name: remedy.name,
          scientific: remedy.scientific,
          evidence: remedy.evidence,
          datasetVersion: remedy.datasetVersion,
        })),
        rationale: rationale.trim(),
        datasetVersion: selectedRemedies[0]?.datasetVersion || '1.0.0',
      });
      showToast("Consultation saved to the patient record.");
      navigate("/cases");
    } catch (saveError) {
      showToast(saveError.message);
    } finally {
      setSaving(false);
    }
  };

  if (recordsStatus === "loading") return <InlineLoading text="Loading patient records…" />;
  if (!patient) return <div><PageHeader eyebrow="New consultation" title="Add a patient first" description="A consultation must be connected to an actual patient record." /><section className="panel consultation-panel"><CompactEmptyState icon={<UserPlus size={22} />} title="No patient records available" text="Add the patient’s real details, then return here to begin symptom capture." action="Add patient" onAction={onAddPatient} /></section></div>;

  return <div>
    <PageHeader eyebrow="New consultation" title={patient.name} description="Capture symptoms, compare source-linked remedies, and record the practitioner’s selection." />
    <div className="stepper">{["Patient", "Symptoms", "Remedy review", "Decision"].map((label, index) => <div className={`step ${step === index + 1 ? "current" : step > index + 1 ? "done" : ""}`} key={label}><div className="step-circle">{step > index + 1 ? <Check size={15} /> : index + 1}</div><span>{label}</span></div>)}</div>
    {step === 1 && <section className="panel consultation-panel"><SectionTitle number="01" title="Select the patient" text="The consultation and final remedy selection will remain connected to this record." /><label htmlFor="consultation-patient">Patient</label><select id="consultation-patient" value={patientId} onChange={(event) => setPatientId(event.target.value)}>{patients.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.id}</option>)}</select><div className="selected-patient"><div className="small-avatar">{initials(patient.name)}</div><div><strong>{patient.name}</strong><span>{patient.symptom || "No previous concern recorded"}</span></div><span className="status">{patient.status}</span></div><FormActions step={step} onBack={() => setStep(step - 1)} onNext={continueFlow} /></section>}
    {step === 2 && <section className="panel consultation-panel"><SectionTitle number="02" title="Capture the patient’s words" text="Keep each distinct symptom separate so the remedy ranking can compare the whole case." /><label htmlFor="patient-description">Patient’s complete description</label><textarea id="patient-description" rows="5" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Record the description in the patient’s own words…" /><LanguageControls /><label htmlFor="symptom-entry">Confirmed symptoms</label><div className="capture-entry"><input id="symptom-entry" value={symptomDraft} onChange={(event) => setSymptomDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addCapturedSymptom(); } }} placeholder="Enter one confirmed symptom" /><SymptomCapture onAccept={text => setSymptomDraft(current => [current.trim(), text].filter(Boolean).join("; "))} /><button className="secondary-btn" onClick={addCapturedSymptom} disabled={symptomDraft.trim().length < 2}><Plus size={16} /> Add</button></div><SymptomChips symptoms={symptoms} onRemove={(value) => setSymptoms((items) => items.filter((item) => item !== value))} emptyText="Add symptoms individually; press Enter after each one." /><FormActions step={step} onBack={() => setStep(step - 1)} onNext={continueFlow} /></section>}
    {step === 3 && <div><RemedyFinder initialSymptoms={searchSymptoms} onSymptomsChange={setSymptoms} selectedRemedies={selectedRemedies} onSelectionChange={setSelectedRemedies} onEvidence={setEvidence} compact /><div className="consultation-footer panel"><button className="secondary-btn" onClick={() => setStep(2)}>Back</button><div className="consultation-selection">{selectedRemedies.length ? <><CheckCircle2 size={18} /><span><strong>{selectedRemedies.map((remedy) => remedy.name).join(" + ")}</strong> in the review set</span></> : <span>Review the automatically suggested set and its source wording.</span>}</div><button className="primary-btn" onClick={continueFlow}>Continue to decision <ChevronRight size={16} /></button></div></div>}
    {step === 4 && <section className="panel consultation-panel"><SectionTitle number="04" title="Record the practitioner’s decision" text="The saved record includes the symptoms, retained source-review set, dataset version and rationale." /><div className="decision-summary"><div><span>Patient</span><strong>{patient.name}</strong></div><div><span>Symptoms reviewed</span><strong>{searchSymptoms.length}</strong></div><div><span>Review set</span><strong>{selectedRemedies.map((remedy) => remedy.name).join(" + ")}</strong></div><div><span>Dataset</span><strong>{selectedRemedies[0]?.datasetVersion || '1.0.0'}</strong></div></div><label htmlFor="rationale">Review rationale</label><textarea id="rationale" rows="5" value={rationale} onChange={(event) => setRationale(event.target.value)} placeholder="Record why this source-review set was retained after checking the matched symptoms…" /><div className="form-actions"><button className="secondary-btn" onClick={() => setStep(3)} disabled={saving}>Back</button><button className="primary-btn" onClick={completeConsultation} disabled={saving}><CheckCircle2 size={16} /> {saving ? "Saving…" : "Complete consultation"}</button></div></section>}
  </div>;
}

function FormActions({ step, onBack, onNext }) { return <div className="form-actions">{step > 1 ? <button className="secondary-btn" onClick={onBack}>Back</button> : <span />}<button className="primary-btn" onClick={onNext}>Continue <ChevronRight size={16} /></button></div>; }
function SectionTitle({ number, title, text }) { return <div className="section-title"><span className="section-number">{number}</span><div><h3>{title}</h3><p>{text}</p></div></div>; }

function SearchPage({ setEvidence, showToast }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [selectedRemedies, setSelectedRemedies] = useState([]);
  const initialSymptoms = useMemo(() => location.state?.query ? [location.state.query] : [], []);
  useEffect(() => {
    if (location.state?.query) navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state, navigate]);
  const updateSelection = (remedies, context = {}) => {
    setSelectedRemedies(remedies);
    if (!context.automatic) showToast(remedies.length ? `${remedies.length} ${remedies.length === 1 ? "remedy" : "remedies"} retained for source review.` : "Source-review set cleared.");
  };
  return <div><PageHeader eyebrow="Materia Medica" title="Remedy finder" description="Type naturally, add distinct symptoms, and let the source engine build the smallest review set that covers the case." /><RemedyFinder initialSymptoms={initialSymptoms} selectedRemedies={selectedRemedies} onSelectionChange={updateSelection} onEvidence={setEvidence} /></div>;
}

function RemedyFinder({ initialSymptoms = [], selectedRemedies = [], onSelectionChange, onEvidence, compact = false, onSymptomsChange }) {
  const [source, setSource] = useState('original');
  const [confirmedSymptoms, setConfirmedSymptoms] = useState(() => initialSymptoms.filter(Boolean));
  const [draft, setDraft] = useState("");
  const lastAutomaticSignature = useRef("");
  const activeSegments = useMemo(() => [...confirmedSymptoms, ...(draft.trim().length >= 2 ? [draft.trim()] : [])], [confirmedSymptoms, draft]);
  const { status, results, combinations, recommendation, interpretedSegments, inputInterpretations, metadata, durationMs, error, ai } = useRemedySearch(activeSegments, 14, source);
  const effectiveSegments = interpretedSegments.length ? interpretedSegments : ai.segments;
  const recommendationSignature = recommendation ? `${effectiveSegments.join("|")}::${recommendation.mode}::${recommendation.remedyIds.join("|")}` : "";
  const corrections = inputInterpretations.flatMap((interpretation) => interpretation.corrections || []);
  const hasExpandedInterpretation = corrections.length > 0 || inputInterpretations.some((interpretation) => interpretation.concepts?.length > 1);
  useEffect(() => {
    if (!activeSegments.length || status !== "ready" || !recommendation) {
      lastAutomaticSignature.current = "";
      if (selectedRemedies.length) onSelectionChange([], { automatic: true });
      return;
    }
    if (status !== "ready" || !recommendation || recommendationSignature === lastAutomaticSignature.current) return;
    const recommendedRemedies = recommendation.remedyIds.map((id) => results.find((remedy) => remedy.id === id)).filter(Boolean);
    if (!recommendedRemedies.length) return;
    lastAutomaticSignature.current = recommendationSignature;
    onSelectionChange(recommendedRemedies, { automatic: true, recommendation });
  }, [activeSegments.length, onSelectionChange, recommendation, recommendationSignature, results, selectedRemedies.length, status]);
  const addSymptom = () => {
    const value = draft.trim();
    if (value.length < 2 || confirmedSymptoms.some((item) => item.toLowerCase() === value.toLowerCase())) return;
    setConfirmedSymptoms((items) => [...items, value]); setDraft("");
  };
  const removeSymptom = (value) => setConfirmedSymptoms((items) => items.filter((item) => item !== value));
  useEffect(() => { onSymptomsChange?.(activeSegments); }, [activeSegments, onSymptomsChange]);
  const toggleRemedy = (remedy) => {
    const alreadySelected = selectedRemedies.some((item) => item.id === remedy.id);
    const next = alreadySelected
      ? selectedRemedies.filter((item) => item.id !== remedy.id)
      : [...selectedRemedies, remedy].slice(-3);
    onSelectionChange(next, { automatic: false });
  };

  return <section className={`finder-shell ${compact ? "compact" : ""}`}>
    <div className="finder-main">
      <div className="finder-input-panel">
        <label>Reference sources <select aria-label="Reference sources" value={source} onChange={e => { setSource(e.target.value); lastAutomaticSignature.current = ''; onSelectionChange([], { automatic: true }); }}><option value="original">Materia Medica Pura — original baseline</option><option value="combined">Both books — expanded dataset preview</option></select></label>
        {source === 'combined' && <p className="finder-help">Chronic Diseases extraction is available for source review. Practitioner audit is pending; original spelling is preserved and no emphasis priority is inferred.</p>}
        <LanguageControls />
        <div className="finder-label-row"><label htmlFor={`remedy-query-${compact ? "consultation" : "standalone"}`}>Describe one symptom</label><span>{status === "loading" ? "Loading source…" : metadata ? `${metadata.symptomCount.toLocaleString()} source symptoms ready` : "Source unavailable"}</span></div>
        <div className="finder-input"><Search size={20} /><input id={`remedy-query-${compact ? "consultation" : "standalone"}`} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addSymptom(); } }} placeholder="Type the patient’s symptom, location or modality…" autoComplete="off" aria-controls={`finder-remedy-suggestions-${compact ? "consultation" : "standalone"}`} aria-expanded={draft.trim().length >= 2} />{draft && <button className="clear-input" onClick={() => setDraft("")} aria-label="Clear symptom"><X size={17} /></button>}<SymptomCapture onAccept={text => setDraft(current => [current.trim(), text].filter(Boolean).join("; "))} /><button className="primary-btn add-symptom-btn" onClick={addSymptom} disabled={draft.trim().length < 2}><Plus size={16} /> Add symptom</button></div>
        <p className="finder-help">Type in English, हिंदी or मराठी, or tap the mic, speak and pause for 2.5 seconds. Results update automatically; check the transcript before choosing a remedy.</p>
        <InterpretationStatus ai={ai} />
        <LiveRemedySuggestions id={`finder-remedy-suggestions-${compact ? "consultation" : "standalone"}`} query={draft} status={status} results={results} selectedRemedies={selectedRemedies} onChoose={toggleRemedy} />
        {hasExpandedInterpretation && <div className="query-interpretation"><Info size={15} /><div><strong>Interpreted clinical concepts</strong><div>{effectiveSegments.map((segment, index) => <span key={`${segment}-${index}`}>{segment}</span>)}</div>{corrections.length > 0 && <p>{corrections.map((correction) => `“${correction.from}” → “${correction.to}”`).join(" · ")}</p>}</div></div>}
        <SymptomChips symptoms={confirmedSymptoms} onRemove={removeSymptom} />
      </div>
      <div className="results-header"><div><h2>{activeSegments.length ? "Whole-case remedy ranking" : "Start with the first symptom"}</h2><p>{activeSegments.length ? `${results.length} source-linked candidates across ${effectiveSegments.length} interpreted concept${effectiveSegments.length === 1 ? "" : "s"} · ${status === "searching" ? "updating" : `searched in ${durationMs} ms`}` : "Use the patient’s wording; add location, sensation, timing and modalities as separate symptoms."}</p></div>{status === "searching" && <span className="searching-indicator"><span />Recalculating whole case</span>}</div>
      {error && <div className="error-state"><Info size={18} /><span>{error}</span></div>}
      {!activeSegments.length && <div className="starter-state"><div className="starter-icon"><BookOpen size={24} /></div><h3>Search by the patient’s actual description</h3><p>Begin typing above. Remedies will appear only when the source dataset contains a match.</p></div>}
      {activeSegments.length > 0 && status === "loading" && <ResultSkeleton />}
      {activeSegments.length > 0 && status === "ready" && !ai.error && ai.status !== "disabled" && results.length === 0 && <div className="starter-state"><CircleHelp size={24} /><h3>No clear source match yet</h3><p>Use fewer words, check the wording, or add the symptom as a separate entry.</p></div>}
      {recommendation && status !== "loading" && <AutomaticReviewSet recommendation={recommendation} results={results} segments={effectiveSegments} selectedRemedies={selectedRemedies} onEvidence={onEvidence} />}
      <div className="remedy-results">{results.map((remedy, index) => <RemedyResult key={remedy.id} rank={index + 1} remedy={remedy} selected={selectedRemedies.some((item) => item.id === remedy.id)} querySegments={effectiveSegments} onSelect={() => toggleRemedy(remedy)} onEvidence={() => onEvidence({ ...remedy, querySegments: effectiveSegments })} />)}</div>
      {effectiveSegments.length > 1 && status !== "loading" && <CoverageGroups combinations={combinations} segments={effectiveSegments} results={results} onEvidence={onEvidence} />}
    </div>
    <aside className="finder-summary">
      <div className="summary-block"><span className="summary-label">Interpreted clinical concepts</span><strong>{effectiveSegments.length || 0}</strong><p>Remedies matching more of the interpreted symptom concepts are kept higher in the list.</p></div>
      <div className="summary-symptoms">{effectiveSegments.length ? effectiveSegments.map((symptom, index) => <div key={`${symptom}-${index}`}><span>{index + 1}</span><p>{symptom}</p><Check size={14} /></div>) : <p className="empty-summary">No symptoms entered yet.</p>}</div>
      <div className="summary-divider" /><span className="summary-label">Current leader</span>
      {results[0] ? <div className="leader-card"><div className="leader-rank">1</div><div><strong>{results[0].name}</strong><span>{results[0].scientific}</span></div><p>{results[0].matchedSegmentCount} of {results[0].totalSegmentCount} symptoms matched · {results[0].alignmentPercent}% source alignment</p></div> : <p className="empty-summary">The leading remedy will appear here as you type.</p>}
      {selectedRemedies.length > 0 && <div className="selected-summary"><CheckCircle2 size={17} /><div><span>Current source-review set · {selectedRemedies.length}</span><strong>{selectedRemedies.map((remedy) => remedy.name).join(" + ")}</strong></div></div>}
      <div className="source-key"><span className="summary-label">Source emphasis</span><div><i className="priority-dot p3" />High</div><div><i className="priority-dot p2" />Partial</div><div><i className="priority-dot p1" />Standard</div></div>
      <div className="summary-note"><ShieldCheck size={16} /><p>The doctor reviews the source wording and makes the final selection.</p></div>
    </aside>
  </section>;
}

function LiveRemedySuggestions({ id, query, status, results, selectedRemedies = [], onChoose }) {
  const normalizedQuery = query.trim();
  if (normalizedQuery.length < 2) return null;
  const suggestions = results.slice(0, 5);
  const isUpdating = status === "loading" || status === "searching";
  return <div className="remedy-typeahead" id={id} role="listbox" aria-label="Live remedy suggestions">
    <div className="remedy-typeahead-head"><span>{isUpdating ? "Finding remedies…" : "Remedies matching as you type"}</span><b>{suggestions.length ? `Top ${suggestions.length}` : "Live search"}</b></div>
    {suggestions.length ? <div className="remedy-typeahead-list">{suggestions.map((remedy, index) => {
      const selected = selectedRemedies.some((item) => item.id === remedy.id);
      return <button type="button" role="option" aria-selected={selected} className={selected ? "selected" : ""} key={remedy.id} onClick={() => onChoose(remedy)}>
        <span className="remedy-typeahead-rank">{index + 1}</span>
        <span className="remedy-typeahead-name"><strong>{remedy.name}</strong><small>{remedy.scientific}</small></span>
        <span className="remedy-typeahead-score"><b>{remedy.alignmentPercent}%</b><small>source match</small></span>
        <ChevronRight size={15} />
      </button>;
    })}</div> : <div className="remedy-typeahead-empty">{isUpdating ? <><span className="mini-spinner" />Searching the source dataset…</> : "No clear match yet—keep typing the symptom."}</div>}
  </div>;
}

function SymptomChips({ symptoms, onRemove, emptyText }) {
  if (!symptoms.length) return emptyText ? <p className="empty-chips">{emptyText}</p> : null;
  return <div className="symptom-chips">{symptoms.map((symptom, index) => <span key={`${symptom}-${index}`}><b>{index + 1}</b>{symptom}<button onClick={() => onRemove(symptom)} aria-label={`Remove ${symptom}`}><X size={14} /></button></span>)}</div>;
}

function AutomaticReviewSet({ recommendation, results, segments, selectedRemedies, onEvidence }) {
  const remedies = recommendation.remedyIds.map((id) => results.find((remedy) => remedy.id === id)).filter(Boolean);
  const heading = recommendation.mode === "single"
    ? "One remedy is sufficient for source review"
    : recommendation.mode === "group"
      ? `${recommendation.count} complementary remedies are needed for source review`
      : "The source match is incomplete";
  return <section className={`auto-review-panel ${recommendation.mode}`} aria-live="polite">
    <div className="auto-review-head">
      <div className="auto-review-icon"><CheckCircle2 size={19} /></div>
      <div><span className="section-kicker">Automatic case analysis</span><h3>{heading}</h3></div>
      <span className="auto-review-count">{recommendation.count} {recommendation.count === 1 ? "remedy" : "remedies"}</span>
    </div>
    <p className="auto-review-reason">{recommendation.reason}</p>
    <div className="auto-review-remedies">{remedies.map((remedy) => <button key={remedy.id} onClick={() => onEvidence({ ...remedy, querySegments: segments })}>
      <span><b>{remedy.name}</b><small>{remedy.scientific}</small></span>
      <i>{selectedRemedies.some((item) => item.id === remedy.id) ? "In review set" : "Suggested"}</i>
      <ChevronRight size={15} />
    </button>)}</div>
    <div className="auto-review-coverage">
      <div className="auto-review-coverage-head"><strong>{recommendation.coveredSegmentCount} of {recommendation.totalSegmentCount} concepts covered</strong><span>{recommendation.confidenceLabel}</span></div>
      <div>{recommendation.assignments.map((assignment) => <span className={assignment.supported ? "covered" : "missing"} key={`${assignment.segmentIndex}-${assignment.remedyId}`}>
        {assignment.supported ? <Check size={12} /> : <X size={12} />}
        <b>{assignment.segment}</b>
        <small>{assignment.supported ? `${assignment.remedyName} · ${Math.round(assignment.score * 100)}%` : "Refine this symptom"}</small>
      </span>)}</div>
    </div>
    <div className="auto-review-warning"><ShieldCheck size={16} /><span>This set is selected automatically for source comparison. It is not a prescription, combination, dosing or potency recommendation.</span></div>
  </section>;
}

function RemedyResult({ rank, remedy, selected, querySegments, onSelect, onEvidence }) {
  const primaryEvidence = remedy.evidence[0];
  return <article className={`remedy-result ${selected ? "selected" : ""}`}>
    <div className="result-rank">{String(rank).padStart(2, "0")}</div>
    <div className="result-content">
      <div className="result-title-row"><div><h3>{remedy.name}</h3><p>{remedy.scientific} · {remedy.code}</p></div><div className="result-badges"><span className="alignment-score">{remedy.alignmentPercent}% source alignment</span><span className="match-label">{remedy.label}</span><PriorityBadge priority={remedy.highestPriority} /></div></div>
      <div className="coverage-row"><div className="coverage-track"><span style={{ width: `${Math.round((remedy.matchedSegmentCount / remedy.totalSegmentCount) * 100)}%` }} /></div><strong>{remedy.matchedSegmentCount} of {remedy.totalSegmentCount} symptoms supported</strong></div>
      <div className="segment-match-grid">{remedy.segmentMatches.map((match, index) => <div className={match.matched ? "matched" : "unmatched"} key={`${match.segment}-${index}`}>{match.matched ? <Check size={13} /> : <X size={13} />}<span>{index + 1}. {match.segment}</span>{match.matched && <b>{Math.round(match.score * 100)}%</b>}</div>)}</div>
      {primaryEvidence && <div className="source-preview"><div className="source-preview-head"><span>{primaryEvidence.sourceTitle || 'Materia Medica Pura'}</span><button onClick={onEvidence}>PDF page {primaryEvidence.page} · View evidence</button></div><p><HighlightedText text={primaryEvidence.text} segments={querySegments} /></p></div>}
    </div>
    <div className="result-action"><button className={selected ? "selected-btn" : "secondary-btn"} onClick={onSelect}>{selected ? <><CheckCircle2 size={16} /> In review set</> : "Add to review set"}</button><button className="text-btn" onClick={onEvidence}><BookOpen size={15} /> Source details</button></div>
  </article>;
}

function CoverageGroups({ combinations, segments, results, onEvidence }) {
  return <section className="coverage-groups">
    <div className="coverage-groups-head"><div><span className="section-kicker">Multi-remedy source coverage</span><h3>When no single remedy covers the complete symptom set</h3><p>These groups identify complementary source matches for comparison. They are not instructions to prescribe the remedies together.</p></div><span className="comparison-badge">Comparison only</span></div>
    {combinations.length ? <div className="coverage-group-list">{combinations.map((group, groupIndex) => <article className="coverage-group-card" key={group.id}>
      <div className="coverage-group-rank">{groupIndex + 1}</div>
      <div className="coverage-group-content"><div className="coverage-group-title"><strong>{group.coveredSegmentCount} of {group.totalSegmentCount} symptoms covered</strong><span>{group.members.length} source remedies</span></div>
        <div className="coverage-members">{group.members.map((member) => { const result = results.find((item) => item.id === member.id) || member; return <button key={member.id} onClick={() => onEvidence({ ...result, querySegments: segments })}><b>{member.name}</b><span>{member.uniqueSegmentIndexes.length} unique contribution{member.uniqueSegmentIndexes.length === 1 ? "" : "s"}</span><ChevronRight size={14} /></button>; })}</div>
        <div className="coverage-segments">{segments.map((segment, index) => <span className={group.coveredSegmentIndexes.includes(index) ? "covered" : "missing"} key={`${segment}-${index}`}>{group.coveredSegmentIndexes.includes(index) ? <Check size={12} /> : <X size={12} />}{index + 1}. {segment}</span>)}</div>
      </div>
    </article>)}</div> : <div className="coverage-groups-empty"><CheckCircle2 size={18} /><span>The leading individual remedies already cover as many entered symptoms as any multi-remedy group.</span></div>}
    <div className="combination-warning"><ShieldCheck size={16} /><span>Review each remedy’s original source evidence separately. This feature does not assess interactions, safety, dosing, potency or clinical effectiveness.</span></div>
  </section>;
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
    <p>{[...new Set(remedy.evidence.map(e => `${e.sourceTitle || 'Materia Medica Pura'}: PDF ${e.page}${e.pageEnd > e.page ? `–${e.pageEnd}` : ''}`))].join(' · ')}</p>
    <div className="evidence-list">{remedy.evidence.map((evidence) => <article key={`${evidence.id}-${evidence.segmentIndex}`}><div className="evidence-row-head"><span>For “{evidence.segment}”</span><div><span className="evidence-score">{Math.round(evidence.matchScore * 100)}% text alignment</span><PriorityBadge priority={evidence.priority} /><b>{evidence.sourceTitle || 'Materia Medica Pura'} · PDF {evidence.page}{evidence.pageEnd > evidence.page ? `–${evidence.pageEnd}` : ''}</b></div></div><p><HighlightedText text={evidence.text} segments={remedy.querySegments || [evidence.segment]} /></p>{evidence.emphasizedText && <div className="bold-source"><strong>Bold in source</strong><span>{evidence.emphasizedText.replaceAll("|", " ")}</span></div>}</article>)}</div>
    <div className="evidence-disclaimer"><ShieldCheck size={17} /><span>Source emphasis is a retrieval signal only. It is not diagnostic certainty or a treatment recommendation.</span></div>
    <div className="modal-actions"><button className="secondary-btn" onClick={onClose}>Close</button></div>
  </div></div>;
}

function AddPatientModal({ onClose, onSave }) {
  const [form, setForm] = useState({ name: "", age: "", sex: "", phone: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));
  const submit = async (event) => {
    event.preventDefault();
    if (form.name.trim().length < 2) { setError("Enter the patient’s full name."); return; }
    setSaving(true); setError("");
    try {
      await onSave({ ...form, name: form.name.trim(), age: form.age ? Number(form.age) : null });
    } catch (saveError) {
      setError(saveError.message);
      setSaving(false);
    }
  };
  return <div className="modal-backdrop" onClick={onClose}><form className="modal patient-modal" onSubmit={submit} onClick={(event) => event.stopPropagation()}>
    <div className="modal-head"><div><span className="eyebrow">New patient record</span><h2>Add an actual patient</h2><p>The patient ID is generated automatically.</p></div><button type="button" className="icon-btn" onClick={onClose} aria-label="Close patient form"><X size={19} /></button></div>
    <div className="patient-form-grid">
      <label className="field-wide"><span>Full name *</span><input autoFocus value={form.name} onChange={update("name")} placeholder="Enter the patient’s full name" autoComplete="name" /></label>
      <label><span>Age</span><input type="number" min="0" max="120" value={form.age} onChange={update("age")} placeholder="Years" /></label>
      <label><span>Sex</span><select value={form.sex} onChange={update("sex")}><option value="">Not recorded</option><option value="Female">Female</option><option value="Male">Male</option><option value="Other">Other</option></select></label>
      <label className="field-wide"><span>Phone (optional)</span><input value={form.phone} onChange={update("phone")} placeholder="Contact number" autoComplete="tel" /></label>
    </div>
    {error && <div className="form-error"><Info size={16} />{error}</div>}
    <div className="privacy-note"><ShieldCheck size={17} /><span>Enter only genuine patient details with appropriate consent. No sample profiles will be added.</span></div>
    <div className="modal-actions"><button type="button" className="secondary-btn" onClick={onClose} disabled={saving}>Cancel</button><button className="primary-btn" type="submit" disabled={saving}><UserPlus size={16} />{saving ? "Saving…" : "Add patient"}</button></div>
  </form></div>;
}

function CompactEmptyState({ icon, title, text, action, onAction }) {
  return <div className="compact-empty"><div className="compact-empty-icon">{icon}</div><div><h3>{title}</h3><p>{text}</p></div>{action && <button className="secondary-btn" onClick={onAction}>{action}</button>}</div>;
}

function InlineLoading({ text }) {
  return <div className="inline-loading"><span />{text}</div>;
}

function remediesForRecord(record) {
  if (Array.isArray(record.remedies) && record.remedies.length) return record.remedies;
  return record.remedyName ? [{ id: record.remedyId, code: record.remedyCode, name: record.remedyName, scientific: record.remedyScientific }] : [];
}

function Cases({ cases, recordsStatus }) {
  return <div><PageHeader eyebrow="Continuity" title="Case records" description="Only completed consultations appear here; no sample cases are preloaded." /><section className="panel">{recordsStatus === "loading" ? <InlineLoading text="Loading case records…" /> : cases.length ? <div className="table-wrap"><table><thead><tr><th>Case</th><th>Patient</th><th>Date</th><th>Symptoms</th><th>Source-review set</th></tr></thead><tbody>{cases.map((record) => <tr key={record.id}><td><strong>{record.id}</strong></td><td>{record.patientName}</td><td>{record.date}</td><td>{record.symptoms.join(" · ")}</td><td><span className="status">{remediesForRecord(record).map((remedy) => remedy.name).join(" + ")}</span></td></tr>)}</tbody></table></div> : <CompactEmptyState icon={<ClipboardList size={21} />} title="No case records yet" text="A case will appear after a practitioner completes and saves a consultation." />}</section></div>;
}

function SettingsPage() {
  return <div><PageHeader eyebrow="Workspace standards" title="Reference safeguards" description="These evidence and continuity rules remain active throughout the casebook." /><section className="panel settings-panel"><SettingRow icon={<BookOpen size={18} />} title="Original source wording" text="The preserved symptom text and PDF page remain visible for verification." /><SettingRow icon={<Database size={18} />} title="Source emphasis" text="Normal, partial and high-emphasis indicators remain distinct from match confidence." /><SettingRow icon={<CalendarDays size={18} />} title="Consultation continuity" text="Symptoms, reviewed remedies and the practitioner’s decision remain connected to the case." /></section></div>;
}

function SettingRow({ icon, title, text }) { return <div className="setting-row"><div className="setting-icon">{icon}</div><div><strong>{title}</strong><span>{text}</span></div><div className="setting-status"><CheckCircle2 size={14} /> Always active</div></div>; }
function initials(name) { return name.split(" ").map((part) => part[0]).join("").slice(0, 2); }

export default App;
