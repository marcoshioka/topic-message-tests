import { useState } from "react";
import { sendMessage } from "../api.js";

const ACTIONS = ["PROCESS_ORDER", "FAIL_ORDER", "CREATE_RUN"];

const DEFAULT_PAYLOAD = JSON.stringify({ orderId: "1001" }, null, 2);

interface Props {
  onSent: (correlationId: string) => void;
}

export function SendMessageForm({ onSent }: Props) {
  const [action, setAction] = useState(ACTIONS[0]);
  const [payload, setPayload] = useState(DEFAULT_PAYLOAD);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(payload);
    } catch {
      // Erro de JSON e o mais comum na mao: vale mostrar antes de bater na API.
      setError("Payload nao e um JSON valido");
      return;
    }

    setSending(true);
    try {
      const { correlationId } = await sendMessage({ action, payload: parsed });
      onSent(correlationId);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Falha ao enviar");
    } finally {
      setSending(false);
    }
  }

  return (
    <form className="card" onSubmit={submit} data-testid="send-form">
      <h2>Enviar mensagem</h2>

      <label>
        Topic
        {/* Read-only de proposito: a Publisher API publica sempre em requests-topic. */}
        <input value="requests-topic" readOnly className="readonly" />
      </label>

      <label>
        Action
        <input
          value={action}
          onChange={(event) => setAction(event.target.value)}
          list="actions"
          data-testid="action-input"
        />
        <datalist id="actions">
          {ACTIONS.map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>
      </label>

      <label>
        Payload
        <textarea
          value={payload}
          onChange={(event) => setPayload(event.target.value)}
          rows={8}
          spellCheck={false}
          data-testid="payload-input"
        />
      </label>

      {error && (
        <p className="error" data-testid="form-error">
          {error}
        </p>
      )}

      <button type="submit" disabled={sending} data-testid="send-button">
        {sending ? "ENVIANDO..." : "SEND MESSAGE"}
      </button>
    </form>
  );
}
