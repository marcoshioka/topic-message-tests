import { expect, test, type Page } from "@playwright/test";

/**
 * Testes de UI do dashboard.
 *
 * O store da Publisher API e compartilhado entre todos os testes, entao nada
 * aqui pode assumir lista vazia ou contagem exata: tudo e escopado pelo
 * correlationId que a propria tela devolve depois do envio.
 */

async function sendMessage(
  page: Page,
  action: string,
  payload: Record<string, unknown>,
): Promise<string> {
  const id = page.getByTestId("detail-correlation-id");

  // Do segundo envio em diante o painel ja esta visivel com a mensagem
  // anterior. Esperar por "visivel" nao esperaria nada e devolveria o id
  // velho, entao a espera e pelo id MUDAR.
  const previous = (await id.count()) > 0 ? (await id.innerText()).trim() : null;

  await page.getByTestId("action-input").fill(action);
  await page.getByTestId("payload-input").fill(JSON.stringify(payload, null, 2));
  await page.getByTestId("send-button").click();

  await expect(page.getByTestId("detail-panel")).toBeVisible();

  if (previous) {
    await expect(id).not.toHaveText(previous);
  } else {
    await expect(id).toHaveText(/^[0-9a-f-]{36}$/);
  }

  return (await id.innerText()).trim();
}

function detailStatus(page: Page) {
  return page.getByTestId("detail-panel").getByTestId("status-badge");
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("envia mensagem e acompanha ate SUCCESS na tela", async ({ page }) => {
  const correlationId = await sendMessage(page, "PROCESS_ORDER", { orderId: "7001" });

  expect(correlationId).toMatch(/^[0-9a-f-]{36}$/);

  // O polling da tela leva o status ate o estado final sozinho.
  await expect(detailStatus(page)).toHaveText("SUCCESS", { timeout: 30_000 });
  await expect(page.getByTestId("detail-response")).toContainText('"status": "SUCCESS"');
  await expect(page.getByTestId("detail-request")).toContainText('"orderId": "7001"');
});

test("mostra o motivo da falha no painel de RESPONSE", async ({ page }) => {
  await sendMessage(page, "FAIL_ORDER", { orderId: "7002" });

  await expect(detailStatus(page)).toHaveText("FAILED", { timeout: 30_000 });
  await expect(page.getByTestId("detail-response")).toContainText("rejeitado");
});

test("exibe o round trip real em ms depois da resposta", async ({ page }) => {
  await sendMessage(page, "PROCESS_ORDER", { orderId: "7003" });

  const latency = page.getByTestId("detail-latency");
  await expect(latency).toHaveText("aguardando resposta...");

  // Numero real, nao valor fixo: e o mesmo motivo pelo qual o teste
  // de integracao nao usa waitForTimeout.
  await expect(latency).toHaveText(/^\d+ ms$/, { timeout: 30_000 });
});

test("valida o JSON do payload antes de chamar a API", async ({ page }) => {
  await page.getByTestId("action-input").fill("PROCESS_ORDER");
  await page.getByTestId("payload-input").fill("{ isso nao e json }");
  await page.getByTestId("send-button").click();

  await expect(page.getByTestId("form-error")).toHaveText("Payload nao e um JSON valido");
  await expect(page.getByTestId("detail-panel")).toBeHidden();
});

test("seleciona uma mensagem pela lista e abre o detalhe dela", async ({ page }) => {
  const primeiro = await sendMessage(page, "PROCESS_ORDER", { orderId: "7004" });
  const segundo = await sendMessage(page, "PROCESS_ORDER", { orderId: "7005" });

  await expect(page.getByTestId("detail-correlation-id")).toHaveText(segundo);

  await page.getByTestId(`message-row-${primeiro}`).click();

  await expect(page.getByTestId("detail-correlation-id")).toHaveText(primeiro);
  await expect(page.getByTestId("detail-request")).toContainText('"orderId": "7004"');
});
