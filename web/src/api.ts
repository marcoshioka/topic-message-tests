import type { MessageRecord } from "../../src/shared/types";

/** Todas as chamadas passam pelo proxy do Vite (/api -> Publisher API). */
const BASE = "/api";

export async function sendMessage(input: {
  action: string;
  payload: Record<string, unknown>;
}): Promise<{ correlationId: string; status: string }> {
  const response = await fetch(`${BASE}/messages`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(body.error ?? `Publisher respondeu ${response.status}`);
  }

  return response.json();
}

export async function listMessages(): Promise<MessageRecord[]> {
  const response = await fetch(`${BASE}/messages`);

  if (!response.ok) throw new Error(`Publisher respondeu ${response.status}`);

  return response.json();
}
