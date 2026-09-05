import type { MessageRecord } from "../../../src/shared/types";

interface Props {
  messages: MessageRecord[];
  selectedId: string | null;
  onSelect: (correlationId: string) => void;
}

export function MessageList({ messages, selectedId, onSelect }: Props) {
  return (
    <div className="card">
      <h2>Mensagens</h2>

      {messages.length === 0 ? (
        <p className="empty" data-testid="empty-list">
          Nenhuma mensagem enviada ainda.
        </p>
      ) : (
        <ul className="list" data-testid="message-list">
          {messages.map((message) => (
            <li key={message.correlationId}>
              <button
                type="button"
                className={message.correlationId === selectedId ? "row selected" : "row"}
                onClick={() => onSelect(message.correlationId)}
                data-testid={`message-row-${message.correlationId}`}
              >
                <span className="mono">{message.correlationId.slice(0, 8)}</span>
                <span className="action">{message.action}</span>
                <StatusBadge status={message.status} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function StatusBadge({ status }: { status: MessageRecord["status"] }) {
  const inFlight = status === "ACCEPTED" || status === "PROCESSING";

  return (
    <span
      className={`badge badge-${status.toLowerCase()}${inFlight ? " pulse" : ""}`}
      data-testid="status-badge"
    >
      {status}
    </span>
  );
}
