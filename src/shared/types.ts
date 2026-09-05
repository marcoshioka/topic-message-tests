export type MessageStatus = "ACCEPTED" | "PROCESSING" | "SUCCESS" | "FAILED";

/** O que o Publisher coloca em requests-topic. */
export interface RequestMessage {
  correlationId: string;
  action: string;
  payload: Record<string, unknown>;
  publishedAt: string;
}

/** O que o Consumer coloca em results-topic. */
export interface ResultMessage {
  correlationId: string;
  action: string;
  status: Extract<MessageStatus, "SUCCESS" | "FAILED">;
  payload: Record<string, unknown>;
  error?: string;
  processedAt: string;
}

/** Estado agregado que a Publisher API expoe em GET /messages/:correlationId. */
export interface MessageRecord {
  correlationId: string;
  action: string;
  status: MessageStatus;
  request: Record<string, unknown>;
  response: ResultMessage | null;
  createdAt: string;
  processedAt: string | null;
}
