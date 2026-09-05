import express from "express";
import { randomUUID } from "node:crypto";
import { config } from "../shared/config.js";
import { ensureTopology, pubsub } from "../shared/pubsubClient.js";
import type { RequestMessage, ResultMessage } from "../shared/types.js";
import { applyResult, createRecord, getRecord, listRecords } from "./store.js";

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "UP", service: "publisher" });
});

/**
 * Entrada do fluxo assincrono.
 * Responde 202 com o correlationId: o resultado NAO vem por aqui,
 * ele aparece depois em results-topic e no GET /messages/:correlationId.
 */
app.post("/messages", async (req, res) => {
  const { action, payload } = req.body ?? {};

  if (typeof action !== "string" || action.length === 0) {
    res.status(400).json({ error: "Campo 'action' e obrigatorio" });
    return;
  }

  const correlationId = randomUUID();
  const message: RequestMessage = {
    correlationId,
    action,
    payload: payload ?? {},
    publishedAt: new Date().toISOString(),
  };

  await pubsub.topic(config.topics.requests).publishMessage({
    json: message,
    // Atributo alem do body: permite filtrar/depurar sem desserializar o payload.
    attributes: { correlationId, action },
  });

  createRecord({ correlationId, action, request: message.payload });
  console.log(`[publisher] publicado ${action} correlationId=${correlationId}`);

  res.status(202).json({ correlationId, status: "ACCEPTED" });
});

app.get("/messages", (_req, res) => {
  res.json(listRecords());
});

app.get("/messages/:correlationId", (req, res) => {
  const record = getRecord(req.params.correlationId);

  if (!record) {
    res.status(404).json({ error: "correlationId nao encontrado" });
    return;
  }

  res.json(record);
});

/** A API tambem escuta results-topic para saber o desfecho de cada mensagem. */
function consumeResults(): void {
  const subscription = pubsub.subscription(config.subscriptions.api);

  subscription.on("message", (message) => {
    const result = JSON.parse(message.data.toString()) as ResultMessage;
    const updated = applyResult(result);

    if (updated) {
      console.log(
        `[publisher] resultado ${result.status} correlationId=${result.correlationId}`,
      );
    }

    message.ack();
  });

  subscription.on("error", (error) => {
    console.error("[publisher] erro na subscription de resultados:", error);
  });
}

async function main(): Promise<void> {
  await ensureTopology();
  consumeResults();

  app.listen(config.ports.publisher, () => {
    console.log(`[publisher] ouvindo em http://localhost:${config.ports.publisher}`);
  });
}

main().catch((error) => {
  console.error("[publisher] falha ao iniciar:", error);
  process.exit(1);
});
