import { useCallback, useEffect, useMemo, useState } from "react";
import type { MessageRecord } from "../../src/shared/types";
import { listMessages } from "./api.js";
import { MessageDetail } from "./components/MessageDetail.js";
import { MessageList } from "./components/MessageList.js";
import { SendMessageForm } from "./components/SendMessageForm.js";

const POLL_INTERVAL_MS = 1000;

export function App() {
  const [messages, setMessages] = useState<MessageRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setMessages(await listMessages());
      setConnectionError(null);
    } catch (error) {
      setConnectionError(
        error instanceof Error ? error.message : "Publisher API indisponivel",
      );
    }
  }, []);

  // Polling simples: a resposta e assincrona, entao a tela precisa
  // continuar buscando ate o status final chegar.
  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  const selected = useMemo(
    () => messages.find((message) => message.correlationId === selectedId) ?? null,
    [messages, selectedId],
  );

  const pending = messages.filter((message) => message.status === "ACCEPTED").length;

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>Pub/Sub Test Lab</h1>
          <p className="subtitle">
            requests-topic &rarr; consumer &rarr; results-topic &rarr; API
          </p>
        </div>
        <div className="counters">
          <span data-testid="counter-total">{messages.length} mensagens</span>
          <span data-testid="counter-pending" className={pending > 0 ? "pulse" : undefined}>
            {pending} em voo
          </span>
        </div>
      </header>

      {connectionError && (
        <div className="banner error" data-testid="connection-error">
          {connectionError} &mdash; a Publisher API esta rodando em :3000?
        </div>
      )}

      <main className="layout">
        <section className="column">
          <SendMessageForm
            onSent={(correlationId) => {
              setSelectedId(correlationId);
              void refresh();
            }}
          />
          <MessageList
            messages={messages}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </section>

        <section className="column">
          <MessageDetail record={selected} />
        </section>
      </main>
    </div>
  );
}
