import { PubSub, type Subscription, type Topic } from "@google-cloud/pubsub";
import { config } from "./config.js";

/** gRPC status code de ALREADY_EXISTS. */
const ALREADY_EXISTS = 6;

// O client so fala com o emulador se essa env existir. Fica aqui, e nao no
// config, para importar config nao ter efeito colateral (o vite.config le ele).
process.env.PUBSUB_EMULATOR_HOST = config.emulatorHost;

export const pubsub = new PubSub({ projectId: config.projectId });

function isAlreadyExists(error: unknown): boolean {
  return (error as { code?: number })?.code === ALREADY_EXISTS;
}

/**
 * Espera o emulador responder. Sem isso, subir os servicos junto com o
 * docker compose vira uma corrida: o servico sobe antes do emulador aceitar
 * conexao e morre no primeiro request.
 */
export async function waitForEmulator(timeoutMs = 30_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;

  while (Date.now() < deadline) {
    try {
      await pubsub.getTopics();
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  throw new Error(
    `Emulador do Pub/Sub nao respondeu em ${config.emulatorHost} apos ${timeoutMs}ms. ` +
      `Rode "npm run lab:up". Ultimo erro: ${String(lastError)}`,
  );
}

/** Cria o topico se ele ainda nao existir. Idempotente. */
export async function ensureTopic(name: string): Promise<Topic> {
  const topic = pubsub.topic(name);
  try {
    await topic.create();
  } catch (error) {
    if (!isAlreadyExists(error)) throw error;
  }
  return topic;
}

/** Cria a subscription se ela ainda nao existir. Idempotente. */
export async function ensureSubscription(
  topicName: string,
  subscriptionName: string,
): Promise<Subscription> {
  const topic = await ensureTopic(topicName);
  try {
    await topic.createSubscription(subscriptionName, { ackDeadlineSeconds: 30 });
  } catch (error) {
    if (!isAlreadyExists(error)) throw error;
  }
  return pubsub.subscription(subscriptionName);
}

/**
 * Garante a topologia inteira do lab.
 * Cada servico (e o teste) chama isso no boot, entao a ordem de subida
 * dos containers/processos deixa de importar.
 */
export async function ensureTopology(): Promise<void> {
  await waitForEmulator();
  await ensureTopic(config.topics.requests);
  await ensureTopic(config.topics.results);
  await ensureSubscription(config.topics.requests, config.subscriptions.consumer);
  await ensureSubscription(config.topics.results, config.subscriptions.api);
}
