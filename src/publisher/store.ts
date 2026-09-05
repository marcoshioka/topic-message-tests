import type { MessageRecord, ResultMessage } from "../shared/types.js";

/**
 * Store em memoria. No MVP isso substitui o banco: a Publisher API precisa
 * de algum lugar para o teste consultar o estado por correlationId.
 * Na fase 2 e so trocar essa implementacao por Postgres/Redis mantendo a API.
 */
const records = new Map<string, MessageRecord>();

export function createRecord(input: {
  correlationId: string;
  action: string;
  request: Record<string, unknown>;
}): MessageRecord {
  const record: MessageRecord = {
    correlationId: input.correlationId,
    action: input.action,
    status: "ACCEPTED",
    request: input.request,
    response: null,
    createdAt: new Date().toISOString(),
    processedAt: null,
  };

  records.set(record.correlationId, record);
  return record;
}

export function applyResult(result: ResultMessage): MessageRecord | null {
  const record = records.get(result.correlationId);
  // Resultado de outra execucao (outro processo, outro teste): ignoramos.
  if (!record) return null;

  record.status = result.status;
  record.response = result;
  record.processedAt = result.processedAt;
  return record;
}

export function getRecord(correlationId: string): MessageRecord | undefined {
  return records.get(correlationId);
}

export function listRecords(): MessageRecord[] {
  return [...records.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
