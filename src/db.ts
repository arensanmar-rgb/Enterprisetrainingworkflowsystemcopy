import { createClient } from "@supabase/supabase-js";
import type { TrainingRequest, User } from "./app/data/mockData";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

const supabase = createClient(supabaseUrl, supabaseKey);

// ── Map DB row → TrainingRequest ──────────────────────────────────────────────
function rowToRequest(row: Record<string, unknown>): TrainingRequest {
  return {
    id: row.id as string,
    employeeId: row.employee_id as string,
    employeeName: row.employee_name as string,
    employeeDepartment: row.employee_department as string | undefined,
    nominatorId: row.nominator_id as string,
    nominatorName: row.nominator_name as string,
    competency: row.competency as string,
    quarter: row.quarter as string,
    courseTitle: row.course_title as string,
    customCourse: row.custom_course as string | undefined,
    instituteId: row.institute_id as string,
    startDate: row.start_date as string,
    endDate: row.end_date as string,
    durationDays: row.duration_days as number,
    basicCost: row.basic_cost as number,
    currency: row.currency as string,
    usdCost: row.usd_cost as number,
    venueType: row.venue_type as string,
    city: row.city as string,
    status: row.status as TrainingRequest["status"],
    comments: (row.comments as string[]) ?? [],
    createdAt: row.created_at as string,
  };
}

// ── Map TrainingRequest → DB row ──────────────────────────────────────────────
function requestToRow(r: TrainingRequest): Record<string, unknown> {
  return {
    id: r.id,
    employee_id: r.employeeId,
    employee_name: r.employeeName,
    employee_department: r.employeeDepartment,
    nominator_id: r.nominatorId,
    nominator_name: r.nominatorName,
    competency: r.competency,
    quarter: r.quarter,
    course_title: r.courseTitle,
    custom_course: r.customCourse,
    institute_id: r.instituteId,
    start_date: r.startDate,
    end_date: r.endDate,
    duration_days: r.durationDays,
    basic_cost: r.basicCost,
    currency: r.currency,
    usd_cost: r.usdCost,
    venue_type: r.venueType,
    city: r.city,
    status: r.status,
    comments: r.comments,
    created_at: r.createdAt,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function readRequests(): Promise<TrainingRequest[]> {
  const { data, error } = await supabase
    .from("training_requests")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("readRequests error:", error.message);
    return [];
  }
  return (data ?? []).map(rowToRequest);
}

export async function upsertRequest(request: TrainingRequest): Promise<void> {
  const { error } = await supabase
    .from("training_requests")
    .upsert(requestToRow(request), { onConflict: "id" });

  if (error) {
    console.error("upsertRequest error:", error.message);
    throw new Error(error.message);
  }
}

export async function readUser(id: string): Promise<User | null> {
  const { data, error } = await supabase
    .from("employees")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    name: data.name,
    role: data.role,
    managerId: data.manager_id ?? undefined,
    competency: data.competency ?? undefined,
    position: data.position,
    department: data.department,
    grade: data.grade,
  } as User;
}

// Legacy client shim (keeps old imports working)
export const client = {
  execute: async () => ({ rows: [] }),
};
