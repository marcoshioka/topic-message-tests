# Pub/Sub Automation Lab

Laboratorio para testar fluxos assincronos de Pub/Sub sem depender do sistema real.
Roda 100% local: emulador do Google Cloud Pub/Sub no Docker, dois servicos Node,
um dashboard React e testes Playwright de integracao e de UI.

## Arquitetura

```
Dashboard (:5173)   Playwright
        |               |
        +-------+-------+
                |
                | POST /messages    (202 + correlationId)
                v
Publisher API (:3000) ------> requests-topic
                                    |
                                    v
                            requests-subscription
                                    |
                                    v
                              Consumer (:3001)
                                    |
                                    v
                              results-topic
                                /         \
                               v           v
                results-api-subscription   results-test-<worker>
                               |                     |
                               v                     v
                    Publisher API (store)        Playwright
                               |
                    GET /messages/:correlationId
```

Duas formas de validar o mesmo fluxo:

| Caminho | O que testa |
|---|---|
| `waitForResult()` no `results-topic` | Pub/Sub -> Consumer -> Pub/Sub |
| `GET /messages/:correlationId` | Pub/Sub -> aplicacao -> store -> API |

## Passo a passo

### 1. Instalar

```bash
npm install
```

### 2. Subir o emulador

```bash
npm run lab:up
```

Sobe o container `pubsub-emulator` em `localhost:8085`. Nada mais depende de rede
ou de projeto GCP real.

### 3. Rodar os testes

```bash
npm test
```

O Playwright sobe Publisher, Consumer e dashboard sozinho (`webServer` no
`playwright.config.ts`) e derruba no final. Topicos e subscriptions sao criados
de forma idempotente no boot de cada servico, entao ordem de subida nao importa.

### 4. Abrir o dashboard

```bash
npm run dev
```

Sobe emulador, Publisher, Consumer e o dashboard em <http://localhost:5173>.

E um "Postman para Pub/Sub": voce escolhe a `action`, escreve o payload,
clica em SEND MESSAGE e acompanha o `correlationId` sair de `ACCEPTED` para
`SUCCESS`/`FAILED` sozinho, com REQUEST e RESPONSE lado a lado e o tempo real
do round trip em ms.

### 5. Ou na mao, via curl

```bash
curl -X POST http://localhost:3000/messages -H 'content-type: application/json' -d '{"action":"PROCESS_ORDER","payload":{"orderId":"1001"}}'
```

Resposta imediata (o processamento e assincrono):

```json
{ "correlationId": "39fa1425-...", "status": "ACCEPTED" }
```

Consulte o desfecho:

```bash
curl http://localhost:3000/messages/39fa1425-...
```

### 6. Derrubar

```bash
npm run lab:down
```

## Estrutura

```
src/
  shared/
    config.ts          nomes de topico/subscription/portas em um lugar so
    types.ts           contratos das mensagens
    pubsubClient.ts    client + criacao idempotente da topologia
  publisher/
    index.ts           POST /messages, GET /messages/:correlationId
    store.ts           estado em memoria (troque por banco na fase 2)
  consumer/
    index.ts           consome requests-topic, processa, publica em results-topic
web/
  vite.config.ts       proxy /api -> Publisher API (sem CORS)
  src/
    App.tsx            polling de 1s ate o status final
    api.ts             cliente da Publisher API
    components/        formulario, lista e detalhe request/response
tests/
  helpers/
    publishMessage.ts  publica via API ou direto no topico
    resultCollector.ts espera a resposta por correlationId
    waitForRecord.ts   polling no GET /messages/:correlationId
  pubsub.spec.ts       integracao: Pub/Sub e API
  dashboard.spec.ts    UI: envio, status ao vivo, request/response
```

## CI

`.github/workflows/ci.yml` roda a suite inteira a cada push na `main`, em todo
pull request e sob demanda (`workflow_dispatch`).

O workflow sobe o **mesmo `docker-compose.yml`** do desenvolvimento, em vez de
declarar o emulador como service container do Actions. Motivo: service container
nao deixa sobrescrever o `command`, e a imagem precisa do
`gcloud beta emulators pubsub start`. Reusar o compose mantem uma fonte de
verdade so - se o lab sobe na sua maquina, sobe no CI.

O `npm run lab:up` usa `docker compose up -d --wait`, que segura ate o
healthcheck do emulador passar. Os testes nunca comecam antes do broker estar
de pe. Publisher, Consumer e dashboard sobem sozinhos pelo `webServer` do
Playwright.

Em caso de falha, o run publica o `playwright-report/` como artifact e imprime
o log do emulador - o suficiente para separar "o teste falhou" de "o broker
nao subiu".

## Decisoes que importam para automacao

**correlationId em tudo.** Sem ele, um teste consome a resposta de outra execucao
que estava rodando ao mesmo tempo. O teste "cada mensagem recebe so a propria
resposta" existe justamente para provar isso.

**Coletor unico, nao listener por espera.** A resposta pode chegar *antes* de voce
comecar a esperar por ela. Um listener criado tarde perde a mensagem e o teste
falha por timeout sem existir bug nenhum. O `resultCollector` mantem um listener
so, indexa tudo por `correlationId` e entrega mesmo o que ja chegou.

**Uma subscription por worker do Playwright.** Subscribers na mesma subscription
competem pelas mensagens: com `fullyParallel`, um worker roubaria a resposta do
outro. Cada worker usa `results-test-<TEST_PARALLEL_INDEX>`.

**Nada de `waitForTimeout`.** As esperas resolvem no instante em que a mensagem
chega e falham com timeout maximo, dizendo qual `correlationId` nao voltou.

**ack vs nack.** Falha de regra de negocio publica `FAILED` e da `ack` (a mensagem
foi processada). Falha tecnica da `nack`, devolvendo para retry. Payload
malformado leva `ack` para nao virar loop infinito.

## Cenarios ja cobertos

- `PROCESS_ORDER` com `orderId` -> `SUCCESS`
- `FAIL_ORDER` -> `FAILED` (regra de negocio)
- `PROCESS_ORDER` sem `orderId` -> `FAILED` (validacao)
- duas mensagens em paralelo -> cada uma recebe a propria resposta
- publicacao direta no topico, sem passar pela API
- API: 202 no aceite, 400 sem `action`, 404 em `correlationId` desconhecido
- evolucao de estado `ACCEPTED` -> `SUCCESS` via API

No dashboard:

- envio pela tela e status chegando a `SUCCESS` sozinho, sem reload
- falha de negocio com o motivo visivel no painel de RESPONSE
- round trip exibido em ms reais
- payload com JSON invalido barrado antes de chamar a API
- selecao pela lista abrindo o detalhe correto

## Proximos passos

- **Fase 2 (pulada, fica pendente):** trocar o store em memoria por
  Postgres/Redis, adicionar dead letter topic, retry com backoff e testes de
  reprocessamento. Enquanto o store for em memoria, reiniciar o Publisher zera
  o historico do dashboard.
- **Streaming no lugar do polling:** o dashboard faz polling de 1s no
  `GET /messages`. Com SSE ou WebSocket a tela reagiria no instante em que o
  resultado cai no `results-topic`.
