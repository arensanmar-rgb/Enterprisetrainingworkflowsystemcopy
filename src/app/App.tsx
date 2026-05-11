import { client } from '../db';
import { useState, useEffect } from 'react';
import { TrainingRequest, User } from "./data/mockData";
import { Login } from "./components/Login";
import { Shell } from "./components/Shell";
import {
  EmployeeDashboard,
  ManagerDashboard,
  UnitHeadDashboard,
  TalentDevDashboard,
  HRAdminDashboard,
} from "./components/Dashboards";
import { RequestDetail } from "./components/RequestDetail";
import { NominationModal } from "./components/NominationModal";
import { TrainingNeedAssessment } from "./components/TrainingNeedAssessment";

type View = { kind: "list" } | { kind: "detail"; id: string } | { kind: "assessment" };

function aiAudit(req: TrainingRequest): { pass: boolean; comment: string } {
  if (req.usdCost > 10000)
    return { pass: false, comment: "AI Auditor: Cost exceeds $10,000 cap. Please justify or revise." };
  if (req.durationDays <= 0)
    return { pass: false, comment: "AI Auditor: Invalid date range." };
  if (!req.courseTitle || !req.instituteId || !req.city)
    return { pass: false, comment: "AI Auditor: Missing required fields." };
  return { pass: true, comment: "AI Auditor: All consistency checks passed. ✓" };
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [requests, setRequests] = useState<TrainingRequest[]>([]);
  const [view, setView] = useState<View>({ kind: "list" });
  const [showNominate, setShowNominate] = useState(false);

  // Sync with Turso Database on Load
  useEffect(() => {
    async function loadInitialData() {
      try {
        // Fetch User Profile (Current User: 1234)
        const userRes = await client.execute({
          sql: "SELECT * FROM employees WHERE employee_id = ?",
          args: ["1234"]
        });
        
        if (userRes.rows.length > 0) {
          setUser(userRes.rows[0] as any);
        }

        // Fetch Real Requests from Database
        const reqsRes = await client.execute("SELECT * FROM training_requests");
        setRequests(reqsRes.rows as any);
      } catch (error) {
        console.error("Failed to load data from Turso:", error);
      }
    }
    loadInitialData();
  }, []);

  // AI Auditor background process
  useEffect(() => {
    const pendingAI = requests.find((r) => r.status === "PendingAI");
    if (!pendingAI) return;
    const t = setTimeout(() => {
      const result = aiAudit(pendingAI);
      setRequests((prev) =>
        prev.map((r) =>
          r.id === pendingAI.id
            ? { ...r, status: result.pass ? "PendingUnitHead" : "AIRejected", comments: [...r.comments, result.comment] }
            : r
        )
      );
    }, 1800);
    return () => clearTimeout(t);
  }, [requests]);

  if (!user) return <Login onLogin={setUser} />;

  const handleUpdate = (updated: TrainingRequest) => {
    setRequests((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    setView({ kind: "list" });
  };

  const handleApprove = (r: TrainingRequest, comment?: string) => {
    const extra = comment ? ` — "${comment}"` : "";
    if (user.role === "TrainingUnitHead") {
      handleUpdate({
        ...r,
        status: "PendingTalentDev",
        comments: [...r.comments, `✅ Unit Head (${user.name}): Approved.${extra}`],
      });
    } else if (user.role === "TalentDevManager") {
      handleUpdate({
        ...r,
        status: "Approved",
        comments: [...r.comments, `✅ Talent Dev (${user.name}): Final sign-off.${extra}`],
      });
    }
  };

  const handleReject = (r: TrainingRequest, comment?: string) => {
    const extra = comment ? ` — "${comment}"` : "";
    handleUpdate({
      ...r,
      status: "Rejected",
      comments: [...r.comments, `❌ ${user.name}: Rejected.${extra}`],
    });
  };

  const handleViewRequest = (id: string) => {
    setView({ kind: "detail", id });
  };

  if (view.kind === "assessment") {
    return <TrainingNeedAssessment onBack={() => setView({ kind: "list" })} />;
  }

  if (view.kind === "detail") {
    const req = requests.find((r) => r.id === view.id);
    if (!req) { setView({ kind: "list" }); return null; }
    return (
      <Shell
        user={user}
        onLogout={() => { setUser(null); setView({ kind: "list" }); }}
        requests={requests}
        onViewRequest={handleViewRequest}
      >
        <RequestDetail
          request={req}
          user={user}
          onBack={() => setView({ kind: "list" })}
          onUpdate={handleUpdate}
        />
      </Shell>
    );
  }

  return (
    <Shell
      user={user}
      onLogout={() => { setUser(null); setView({ kind: "list" }); }}
      requests={requests}
      onViewRequest={handleViewRequest}
    >
      {user.role === "Employee" && (
        <EmployeeDashboard
          user={user}
          requests={requests}
          onView={(r) => setView({ kind: "detail", id: r.id })}
          onNavigateToAssessment={() => setView({ kind: "assessment" })}
        />
      )}
      {user.role === "Manager" && (
        <ManagerDashboard
          user={user}
          requests={requests}
          onView={(r) => setView({ kind: "detail", id: r.id })}
          onNewNomination={() => setShowNominate(true)}
          onNavigateToAssessment={() => setView({ kind: "assessment" })}
        />
      )}
      {user.role === "TrainingUnitHead" && (
        <UnitHeadDashboard
          user={user}
          requests={requests}
          onView={(r) => setView({ kind: "detail", id: r.id })}
          onApprove={handleApprove}
          onReject={handleReject}
          onNewNomination={() => setShowNominate(true)}
          onNavigateToAssessment={() => setView({ kind: "assessment" })}
        />
      )}
      {user.role === "TalentDevManager" && (
        <TalentDevDashboard
          user={user}
          requests={requests}
          onView={(r) => setView({ kind: "detail", id: r.id })}
          onApprove={handleApprove}
          onReject={handleReject}
          onNewNomination={() => setShowNominate(true)}
          onNavigateToAssessment={() => setView({ kind: "assessment" })}
        />
      )}
      {user.role === "HRAdmin" && (
        <HRAdminDashboard
          user={user}
          requests={requests}
          onView={(r) => setView({ kind: "detail", id: r.id })}
          onNavigateToAssessment={() => setView({ kind: "assessment" })}
        />
      )}

      {showNominate && (
        <NominationModal
          manager={user}
          onClose={() => setShowNominate(false)}
          onCreate={async (r) => {
            try {
              // Persist to Turso
              await client.execute({
                sql: "INSERT INTO training_requests (emp_id, status) VALUES (?, ?)",
                args: [user.employee_id, "Workflow"]
              });
              
              // Update local state
              setRequests((prev) => [r, ...prev]);
              setShowNominate(false);
            } catch (error) {
              console.error("Database Error:", error);
            }
          }}
        />
      )}
    </Shell>
  );
}
