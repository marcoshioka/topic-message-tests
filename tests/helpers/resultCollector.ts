import type { Subscription } from "@google-cloud/pubsub";
import { config } from "../../src/shared/config.js";
import { ensureSubscription, ensureTopology } from "../../src/shared/pubsubClient.js";
import type { ResultMessage } from "../../src/shared/types.js";

/**
 * Coletor de resultados do teste.
 *
 * Por que um coletor e nao um listener por chamada:
 * 1. A resposta pode chegar ANTES de voce comecar a esperar. Um listener criado
 *    tarde perde a mensagem e o teste falha por timeout sem bug nenhum no sistema.
 * 2. Varias esperas simultaneas na mesma subscription competem entre si e uma
 *    consome a mensagem da outra.
 *
 * Entao: um unico listener, que guarda tudo indexado por correlationId.
 */

let subscription: Subscription | null = null;

const received = new Map<string, ResultMessage>();
const waiters = new Map<string, (result: ResultMessage) => void>();

/** Uma subscription por worker do Playwright: workers nao roubam mensagem um do outro. */
function subscriptionName(): string {
  const workerIndex = process.env.TEST_PARALLEL_INDEX ?? "0";
  return `${config.subscriptions.testsPrefix}-${workerIndex}`;
}

export async function startCollector(): Promise<void> {
  if (subscription) return;

  await ensureTopology();
  subscription = await ensureSubscription(config.topics.results, subscriptionName());

  subscription.on("message", (message) => {
    const result = JSON.parse(message.data.toString()) as ResultMessage;

    received.set(result.correlationId, result);
    waiters.get(result.correlationId)?.(result);
    waiters.delete(result.correlationId);

    message.ack();
  });

  subscription.on("error", (error) => {
    console.error("[tests] erro na subscription de resultados:", error);
  });
}

export async function stopCollector(): Promise<void> {
  if (!subscription) return;
  await subscription.close();
  subscription = null;
  received.clear();
  waiters.clear();
}

/**
 * Espera o resultado daquele correlationId especifico.
 * Sem waitForTimeout: resolve assim que a mensagem chega (500ms ou 15s),
 * e falha rapido com contexto util se estourar o limite.
 */
export async function waitForResult(
  correlationId: string,
  timeoutMs = 30_000,
): Promise<ResultMessage> {
  await startCollector();

  const alreadyReceived = received.get(correlationId);
  if (alreadyReceived) return alreadyReceived;

  return new Promise<ResultMessage>((resolve, reject) => {
    const timer = setTimeout(() => {
      waiters.delete(correlationId);
      reject(
        new Error(
          `Timeout de ${timeoutMs}ms esperando resultado de correlationId=${correlationId}. ` +
            `Resultados recebidos ate agora: ${received.size}`,
        ),
      );
    }, timeoutMs);

    waiters.set(correlationId, (result) => {
      clearTimeout(timer);
      resolve(result);
    });
  });
}
