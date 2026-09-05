import express from "express";
import { config } from "../shared/config.js";
import { ensureTopology, pubsub } from "../shared/pubsubClient.js";
import type { RequestMessage, ResultMessage } from "../shared/types.js";

/** Regra de negocio ficticia, so para o lab ter caminho feliz e caminho triste. */
function processRequest(request: RequestMessage): ResultMessage {
  const base = {
    correlationId: request.correlationId,
    action: request.action,
    payload: request.payload,
    processedAt: new Date().toISOString(),
  };

  if (request.action === "FAIL_ORDER" || request.payload?.shouldFail === true) {
    return { ...base, status: "FAILED", error: "Processamento rejeitado pela regra de negocio" };
  }

  if (request.action === "PROCESS_ORDER" && !request.payload?.orderId) {
    return { ...base, status: "FAILED", error: "orderId e obrigatorio para PROCESS_ORDER" };
  }

  return { ...base, status: "SUCCESS" };
}

function startConsuming(): void {
  const subscription = pubsub.subscription(config.subscriptions.consumer, {
    flowControl: { maxMessages: 10 },
  });

  subscription.on("message", async (message) => {
    let request: RequestMessage;

    try {
      request = JSON.parse(message.data.toString()) as RequestMessage;
    } catch {
      // Mensagem malformada nunca vai processar: ack para nao ficar em loop.
      console.error("[consumer] payload invalido, descartando", message.id);
      message.ack();
      return;
    }

    console.log(
      `[consumer] recebido ${request.action} correlationId=${request.correlationId}`,
    );

    try {
      // Processamento assincrono simulado: e justamente essa latencia variavel
      // que quebra teste feito com waitForTimeout fixo.
      await new Promise((resolve) => setTimeout(resolve, config.processingDelayMs));

      const result = processRequest(request);

      await pubsub.topic(config.topics.results).publishMessage({
        json: result,
        attributes: { correlationId: result.correlationId, status: result.status },
      });

      console.log(
        `[consumer] publicado ${result.status} correlationId=${result.correlationId}`,
      );
      message.ack();
    } catch (error) {
      // Falha tecnica (broker fora, bug): nack devolve a mensagem para retry.
      console.error("[consumer] erro tecnico, devolvendo para retry:", error);
      message.nack();
    }
  });

  subscription.on("error", (error) => {
    console.error("[consumer] erro na subscription:", error);
  });
}

async function main(): Promise<void> {
  await ensureTopology();
  startConsuming();

  // Endpoint de health so para o Playwright/docker saberem que o consumer subiu.
  const app = express();
  app.get("/health", (_req, res) => res.json({ status: "UP", service: "consumer" }));
  app.listen(config.ports.consumer, () => {
    console.log(`[consumer] ouvindo ${config.subscriptions.consumer} (health :${config.ports.consumer})`);
  });
}

main().catch((error) => {
  console.error("[consumer] falha ao iniciar:", error);
  process.exit(1);
});
