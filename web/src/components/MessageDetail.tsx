import type { MessageRecord } from "../../../src/shared/types";
import { StatusBadge } from "./MessageList.js";

interface Props {
  record: MessageRecord | null;
}

/** Quanto tempo o round trip assincrono levou de ponta a ponta. */
function latency(record: MessageRecord): string | null {
  if (!record.processedAt) return null;

  const ms = new Date(record.processedAt).getTime() - new Date(record.createdAt).getTime();
  return `${ms} ms`;
}

export function MessageDetail({ record }: Props) {
  if (!record) {
    return (
      <div className="card">
        <h2>Detalhe</h2>
        <p className="empty" data-testid="detail-empty">
          Selecione uma mensagem na lista.
        </p>
      </div>
    );
  }

  const elapsed = latency(record);

  return (
    <div className="card" data-testid="detail-panel">
      <h2>Detalhe</h2>

      <dl className="meta">
        <dt>Correlation ID</dt>
        <dd className="mono" data-testid="detail-correlation-id">
          {record.correlationId}
        </dd>

        <dt>Status</dt>
        <dd>
          <StatusBadge status={record.status} />
        </dd>

        <dt>Round trip</dt>
        <dd data-testid="detail-latency">
          {/* Sem valor fixo aqui: e justamente essa variacao que
              torna waitForTimeout(10000) uma ma ideia no teste. */}
          {elapsed ?? "aguardando resposta..."}
        </dd>
      </dl>

      <h3>REQUEST</h3>
      <pre className="json" data-testid="detail-request">
        {JSON.stringify(record.request, null, 2)}
      </pre>

      <h3>RESPONSE</h3>
      <pre className="json" data-testid="detail-response">
        {record.response
          ? JSON.stringify(record.response, null, 2)
          : "// ainda em processamento"}
      </pre>
    </div>
  );
}
