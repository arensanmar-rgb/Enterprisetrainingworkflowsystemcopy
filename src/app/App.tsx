import React, { useState, useEffect, useRef } from "react";
import { readRequests, readUser, upsertRequest } from "../db";
import { TrainingRequest, User, INITIAL_REQUESTS, USERS } from "./data/mockData";
import { Login } from "./components/Login";
import { Shell } from "./components/Shell";
import {
  EmployeeDashboard, ManagerDashboard, UnitHeadDashboard,
  TalentDevDashboard, HRAdminDashboard,
} from "./components/Dashboards";
import { RequestDetail } from "./components/RequestDetail";
import { NominationModal } from "./components/NominationModal";
import { TrainingNeedAssessment } from "./components/TrainingNeedAssessment";

type View = { kind: "list" } | { kind: "detail"; id: string } | { kind: "assessment" };

function aiAudit(req: TrainingRequest): { pass: boolean; comment: string } {
  if (!req.courseTitle || !req.instituteId || !req.city)
    return { pass: false, comment: "AI Auditor: Missing required fields." };
  if (req.durationDays <= 0)
    return { pass: false, comment: "AI Auditor: Invalid date range." };
  if (req.usdCost > 10000)
    return { pass: false, comment: "AI Auditor: Cost exceeds $10,000 cap. Please justify or revise." };
  return { pass: true, comment: "AI Auditor: All consistency checks passed. ✓" };
}

function loadSavedRequests(): TrainingRequest[] {
  try {
    const saved = readRequests();
    return saved.map((r) => ({
      ...r,
      comments: Array.isArray(r.comments) ? r.comments
        : typeof r.comments === "string" ? JSON.parse(r.comments as string) : [],
    }));
  } catch {
    return INITIAL_REQUESTS;
  }
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [requests, setRequests] = useState<TrainingRequest[]>([]);
  const [view, setView] = useState<View>({ kind: "list" });
  const [showNominate, setShowNominate] = useState(false);

  useEffect(() => {
    const saved = loadSavedRequests();
    setRequests(saved.length > 0 ? saved : INITIAL_REQUESTS);
  }, []);

  const processedAI = useRef<Set<string>>(new Set());

  useEffect(() => {
    const pendingAI = requests.find(
      (r) => r.status === "PendingAI" && !processedAI.current.has(r.id)
    );
    if (!pendingAI) return;
    processedAI.current.add(pendingAI.id);
    const t = setTimeout(() => {
      const result = aiAudit(pendingAI);
      const updated: TrainingRequest = {
        ...pendingAI,
        status: result.pass ? "PendingUnitHead" : "AIRejected",
        comments: [...pendingAI.comments, result.comment],
      };
      upsertRequest(updated);
      setRequests((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    }, 1800);
    return () => clearTimeout(t);
  }, [requests]);

  const handleLogout = () => { setUser(null); setView({ kind: "list" }); };

  const handleUpdate = (updated: TrainingRequest) => {
    upsertRequest(updated);
    setRequests((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    setView({ kind: "list" });
  };

  const handleApprove = (r: TrainingRequest, comment?: string) => {
    if (!user) return;
    const extra = comment ? ` — "${comment}"` : "";
    if (user.role === "TrainingUnitHead") {
      handleUpdate({ ...r, status: "PendingTalentDev",
        comments: [...r.comments, `✅ Unit Head (${user.name}): Approved.${extra}`] });
    } else if (user.role === "TalentDevManager") {
      handleUpdate({ ...r, status: "Approved",
        comments: [...r.comments, `✅ Talent Dev (${user.name}): Final sign-off.${extra}`] });
    }
  };

  const handleReject = (r: TrainingRequest, comment?: string) => {
    if (!user) return;
    const extra = comment ? ` — "${comment}"` : "";
    handleUpdate({ ...r, status: "Rejected",
      comments: [...r.comments, `❌ ${user.name}: Rejected.${extra}`] });
  };

  const handleViewRequest = (id: string) => setView({ kind: "detail", id });

  if (!user) {
    return (
      <Login onLogin={(u) => {
        const found = readUser(u.id) ?? USERS.find((x) => x.id === u.id) ?? u;
        setUser(found);
        setRequests(loadSavedRequests());
      }} />
    );
  }

  if (view.kind === "assessment")
    return <TrainingNeedAssessment onBack={() => setView({ kind: "list" })} />;

  if (view.kind === "detail") {
    const req = requests.find((r) => r.id === view.id);
    if (!req) { setView({ kind: "list" }); return null; }
    return (
      <Shell user={user} onLogout={handleLogout} requests={requests} onViewRequest={handleViewRequest}>
        <RequestDetail request={req} user={user} onBack={() => setView({ kind: "list" })} onUpdate={handleUpdate} />
      </Shell>
    );
  }

  return (
    <Shell user={user} onLogout={handleLogout} requests={requests} onViewRequest={handleViewRequest}>
      {user.role === "Employee" && <EmployeeDashboard user={user} requests={requests}
        onView={(r) => setView({ kind: "detail", id: r.id })}
        onNavigateToAssessment={() => setView({ kind: "assessment" })} />}
      {user.role === "Manager" && <ManagerDashboard user={user} requests={requests}
        onView={(r) => setView({ kind: "detail", id: r.id })}
        onNewNomination={() => setShowNominate(true)}
        onNavigateToAssessment={() => setView({ kind: "assessment" })} />}
      {user.role === "TrainingUnitHead" && <UnitHeadDashboard user={user} requests={requests}
        onView={(r) => setView({ kind: "detail", id: r.id })}
        onApprove={handleApprove} onReject={handleReject}
        onNewNomination={() => setShowNominate(true)}
        onNavigateToAssessment={() => setView({ kind: "assessment" })} />}
      {user.role === "TalentDevManager" && <TalentDevDashboard user={user} requests={requests}
        onView={(r) => setView({ kind: "detail", id: r.id })}
        onApprove={handleApprove} onReject={handleReject}
        onNewNomination={() => setShowNominate(true)}
        onNavigateToAssessment={() => setView({ kind: "assessment" })} />}
      {user.role === "HRAdmin" && <HRAdminDashboard user={user} requests={requests}
        onView={(r) => setView({ kind: "detail", id: r.id })}
        onNavigateToAssessment={() => setView({ kind: "assessment" })} />}
      {showNominate && <NominationModal manager={user} onClose={() => setShowNominate(false)}
        onCreate={(r) => { upsertRequest(r); setRequests((prev) => [r, ...prev]); setShowNominate(false); }} />}
    </Shell>
  );
}