import { expect, test } from "@playwright/test";
import { publishToTopic, publishViaApi, publisherUrl } from "./helpers/publishMessage.js";
import { stopCollector, waitForResult } from "./helpers/resultCollector.js";
import { waitForRecordStatus } from "./helpers/waitForRecord.js";

test.afterAll(async () => {
  await stopCollector();
});

test.describe("validacao pelo Pub/Sub (results-topic)", () => {
  test("processa a mensagem com sucesso", async ({ request }) => {
    const correlationId = await publishViaApi(request, {
      action: "PROCESS_ORDER",
      payload: { orderId: "1001" },
    });

    const result = await waitForResult(correlationId);

    expect(result.status).toBe("SUCCESS");
    expect(result.correlationId).toBe(correlationId);
    expect(result.payload.orderId).toBe("1001");
    expect(result.processedAt).toBeTruthy();
  });

  test("marca como FAILED quando a regra de negocio rejeita", async ({ request }) => {
    const correlationId = await publishViaApi(request, {
      action: "FAIL_ORDER",
      payload: { orderId: "2002" },
    });

    const result = await waitForResult(correlationId);

    expect(result.status).toBe("FAILED");
    expect(result.error).toContain("rejeitado");
  });

  test("marca como FAILED quando falta orderId", async ({ request }) => {
    const correlationId = await publishViaApi(request, { action: "PROCESS_ORDER" });

    const result = await waitForResult(correlationId);

    expect(result.status).toBe("FAILED");
    expect(result.error).toContain("orderId");
  });

  test("cada mensagem recebe so a propria resposta", async ({ request }) => {
    const [primeiro, segundo] = await Promise.all([
      publishViaApi(request, { action: "PROCESS_ORDER", payload: { orderId: "A" } }),
      publishViaApi(request, { action: "PROCESS_ORDER", payload: { orderId: "B" } }),
    ]);

    const [resultadoA, resultadoB] = await Promise.all([
      waitForResult(primeiro),
      waitForResult(segundo),
    ]);

    // E exatamente isso que o correlationId protege: sem ele, um teste
    // consumiria a resposta da execucao do outro.
    expect(resultadoA.payload.orderId).toBe("A");
    expect(resultadoB.payload.orderId).toBe("B");
  });

  test("publicando direto no topico, sem passar pela API", async () => {
    const correlationId = await publishToTopic({
      action: "PROCESS_ORDER",
      payload: { orderId: "3003" },
    });

    const result = await waitForResult(correlationId);

    expect(result.status).toBe("SUCCESS");
  });
});

test.describe("validacao pela API (Pub/Sub -> aplicacao -> API)", () => {
  test("aceita a requisicao com 202 e correlationId", async ({ request }) => {
    const response = await request.post(`${publisherUrl}/messages`, {
      data: { action: "PROCESS_ORDER", payload: { orderId: "4004" } },
    });

    expect(response.status()).toBe(202);

    const body = await response.json();
    expect(body.status).toBe("ACCEPTED");
    expect(body.correlationId).toMatch(/^[0-9a-f-]{36}$/);
  });

  test("o estado evolui de ACCEPTED para SUCCESS", async ({ request }) => {
    const correlationId = await publishViaApi(request, {
      action: "PROCESS_ORDER",
      payload: { orderId: "5005" },
    });

    const record = await waitForRecordStatus(request, correlationId);

    expect(record.status).toBe("SUCCESS");
    expect(record.request.orderId).toBe("5005");
    expect(record.response?.status).toBe("SUCCESS");
    expect(record.processedAt).not.toBeNull();
  });

  test("rejeita requisicao sem action", async ({ request }) => {
    const response = await request.post(`${publisherUrl}/messages`, { data: {} });

    expect(response.status()).toBe(400);
  });

  test("retorna 404 para correlationId desconhecido", async ({ request }) => {
    const response = await request.get(`${publisherUrl}/messages/nao-existe`);

    expect(response.status()).toBe(404);
  });
});
