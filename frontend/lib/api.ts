export const apiBase =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const sessionKeys = {
  chat: "contextiq.chatSession",
  document: "contextiq.documentSession",
} as const;

export type SessionKind = keyof typeof sessionKeys;

export function readSession(kind: SessionKind): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(sessionKeys[kind]) ?? "";
}

export function writeSession(kind: SessionKind, sessionId: string) {
  if (typeof window === "undefined" || !sessionId) return;
  localStorage.setItem(sessionKeys[kind], sessionId);
}

export interface StoredMessage {
  role: string;
  content: string;
  timestamp?: string;
}

export function parseTimestamp(value?: string): Date {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

const acceptedExtensions = new Set(["pdf", "txt", "docx"]);

export function uploadError(file: File): string | null {
  const extension = file.name.toLowerCase().split(".").pop() ?? "";
  if (!acceptedExtensions.has(extension)) {
    return "Upload a PDF, TXT, or DOCX file.";
  }
  if (file.size === 0) return "This file is empty.";
  if (file.size > MAX_UPLOAD_BYTES) {
    return "This file is larger than 4 MB. Upload a smaller document.";
  }
  return null;
}

export async function streamChat(
  message: string,
  sessionId: string,
  onDelta: (content: string) => void,
): Promise<string> {
  const response = await fetch(`${apiBase}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      session_id: sessionId || undefined,
    }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const detail = typeof data.detail === "string" ? data.detail : "";
    throw new Error(detail || "The message could not be sent.");
  }
  if (!response.body) throw new Error("The message could not be sent.");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  let nextSessionId = sessionId;

  const handle = (payload: {
    delta?: string;
    error?: string;
    session_id?: string;
  }) => {
    if (payload.error) throw new Error(payload.error);
    if (payload.session_id) nextSessionId = payload.session_id;
    if (payload.delta) {
      content += payload.delta;
      onDelta(content);
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() ?? "";
    for (const chunk of chunks) {
      const line = chunk.split("\n").find((item) => item.startsWith("data:"));
      if (!line) continue;
      handle(JSON.parse(line.slice(5).trim()));
    }
  }

  if (buffer.trim()) {
    const line = buffer.split("\n").find((item) => item.startsWith("data:"));
    if (line) handle(JSON.parse(line.slice(5).trim()));
  }
  if (!content.trim()) throw new Error("The model returned an empty reply.");
  return nextSessionId;
}

export function splitSource(content: string): {
  answer: string;
  source?: string;
} {
  const lines = content.trimEnd().split("\n");
  const last = lines[lines.length - 1]?.trim() ?? "";
  if (!last.startsWith("Source:")) {
    return { answer: content };
  }
  return {
    answer: lines.slice(0, -1).join("\n").trim(),
    source: last.replace(/^Source:\s*/, ""),
  };
}
