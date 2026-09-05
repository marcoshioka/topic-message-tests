/**
 * Configuracao unica do laboratorio.
 * Todos os servicos e os testes leem daqui, entao nomes de topico/subscription
 * nunca ficam duplicados como string solta pelo codigo.
 */
export const config = {
  projectId: process.env.PUBSUB_PROJECT_ID ?? "pubsub-lab",
  emulatorHost: process.env.PUBSUB_EMULATOR_HOST ?? "localhost:8085",

  topics: {
    requests: "requests-topic",
    results: "results-topic",
  },

  subscriptions: {
    /** consumida pelo Consumer: e quem realmente processa o pedido */
    consumer: "requests-subscription",
    /** consumida pela Publisher API: alimenta o GET /messages/:correlationId */
    api: "results-api-subscription",
    /** prefixo das subscriptions dos testes (uma por worker do Playwright) */
    testsPrefix: "results-test",
  },

  ports: {
    publisher: Number(process.env.PUBLISHER_PORT ?? 3000),
    consumer: Number(process.env.CONSUMER_PORT ?? 3001),
    dashboard: Number(process.env.DASHBOARD_PORT ?? 5173),
  },

  /** tempo simulado de processamento no Consumer */
  processingDelayMs: Number(process.env.PROCESSING_DELAY_MS ?? 1500),
} as const;
