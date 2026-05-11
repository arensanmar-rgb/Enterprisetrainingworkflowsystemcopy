import { INITIAL_REQUESTS, USERS } from "./app/data/mockData";
import type { TrainingRequest, User } from "./app/data/mockData";

interface MockResult {
  rows: Record<string, unknown>[];
}

const STORAGE_KEYS = {
  requests: "twms_training_requests",
  users: "twms_users",
} as const;

function seedStorage() {
  if (!localStorage.getItem(STORAGE_KEYS.requests)) {
    localStorage.setItem(STORAGE_KEYS.requests, JSON.stringify(INITIAL_REQUESTS));
  }
  if (!localStorage.getItem(STORAGE_KEYS.users)) {
    localStorage.setItem(STORAGE_KEYS.users, JSON.stringify(USERS));
  }
}

function getRequests(): TrainingRequest[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.requests) ?? "[]");
  } catch {
    return [...INITIAL_REQUESTS];
  }
}

function getUsers(): User[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.users) ?? "[]");
  } catch {
    return [...USERS];
  }
}

function saveRequests(requests: TrainingRequest[]) {
  localStorage.setItem(STORAGE_KEYS.requests, JSON.stringify(requests));
}

type SqlArg = string | number | null;
interface ExecuteInput { sql: string; args?: SqlArg[]; }

async function execute(input: string | ExecuteInput): Promise<MockResult> {
  seedStorage();
  const sql = typeof input === "string" ? input : input.sql;
  const args = typeof input === "string" ? [] : (input.args ?? []);
  const sqlLower = sql.trim().toLowerCase();

  if (sqlLower.includes("from employees") && sqlLower.includes("where")) {
    const id = String(args[0] ?? "");
    const found = getUsers().find((u) => u.id.toLowerCase() === id.toLowerCase());
    return { rows: found ? [found as unknown as Record<string, unknown>] : [] };
  }
  if (sqlLower.includes("from training_requests") && !sqlLower.includes("insert")) {
    return { rows: getRequests() as unknown as Record<string, unknown>[] };
  }
  return { rows: [] };
}

export function upsertRequest(request: TrainingRequest): void {
  seedStorage();
  const all = getRequests();
  const idx = all.findIndex((r) => r.id === request.id);
  if (idx >= 0) { all[idx] = request; } else { all.unshift(request); }
  saveRequests(all);
}

export function readRequests(): TrainingRequest[] {
  seedStorage();
  return getRequests();
}

export function readUser(id: string): User | null {
  seedStorage();
  return getUsers().find((u) => u.id.toLowerCase() === id.toLowerCase()) ?? null;
}

export const client = { execute };