import type { APIRequestContext } from "@playwright/test";
import type { MessageRecord, MessageStatus } from "../../src/shared/types.js";
import { publisherUrl } from "./publishMessage.js";

/**
 * Espera o estado final aparecer na API (Pub/Sub -> consumer -> Pub/Sub -> API).
 * Polling curto e timeout maximo, em vez de sleep fixo.
 */
export async function waitForRecordStatus(
  request: APIRequestContext,
  correlationId: string,
  finalStatuses: MessageStatus[] = ["SUCCESS", "FAILED"],
  timeoutMs = 30_000,
  intervalMs = 300,
): Promise<MessageRecord> {
  const deadline = Date.now() + timeoutMs;
  let last: MessageRecord | null = null;

  while (Date.now() < deadline) {
    const response = await request.get(`${publisherUrl}/messages/${correlationId}`);

    if (response.ok()) {
      last = (await response.json()) as MessageRecord;
      if (finalStatuses.includes(last.status)) return last;
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(
    `Timeout de ${timeoutMs}ms esperando status final de correlationId=${correlationId}. ` +
      `Ultimo estado: ${last ? last.status : "nao encontrado"}`,
  );
}
