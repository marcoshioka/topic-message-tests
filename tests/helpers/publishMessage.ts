import type { APIRequestContext } from "@playwright/test";
import { config } from "../../src/shared/config.js";
import { ensureTopology, pubsub } from "../../src/shared/pubsubClient.js";
import type { RequestMessage } from "../../src/shared/types.js";
import { startCollector } from "./resultCollector.js";
import { randomUUID } from "node:crypto";

export const publisherUrl = `http://localhost:${config.ports.publisher}`;

/** Caminho 1: entra pela API, como um cliente real faria. */
export async function publishViaApi(
  request: APIRequestContext,
  body: { action: string; payload?: Record<string, unknown> },
): Promise<string> {
  // Coletor ligado ANTES de publicar: nenhuma resposta rapida se perde.
  await startCollector();

  const response = await request.post(`${publisherUrl}/messages`, { data: body });

  if (response.status() !== 202) {
    throw new Error(`Publisher respondeu ${response.status()}: ${await response.text()}`);
  }

  const { correlationId } = (await response.json()) as { correlationId: string };
  return correlationId;
}

/** Caminho 2: publica direto no topico, sem passar pela API. Isola o consumer. */
export async function publishToTopic(body: {
  action: string;
  payload?: Record<string, unknown>;
}): Promise<string> {
  await ensureTopology();
  await startCollector();

  const correlationId = randomUUID();
  const message: RequestMessage = {
    correlationId,
    action: body.action,
    payload: body.payload ?? {},
    publishedAt: new Date().toISOString(),
  };

  await pubsub.topic(config.topics.requests).publishMessage({
    json: message,
    attributes: { correlationId, action: body.action },
  });

  return correlationId;
}
