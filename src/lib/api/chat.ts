import type { OrganId } from "@/types/organ";
import type { ChatMessage, ConversationSummary } from "@/types/chat";
import { clearAccessToken, getAccessToken } from "@/lib/api/auth";

export type ChatErrorKind = "bad_request" | "unauthorized" | "not_found" | "server" | "network" | "timeout";

export type ChatError = Error & { kind: ChatErrorKind };

export type NormalizedChatResponse = {
  answer: string;
  sources: { title: string; url?: string }[];
  conversationId?: number;
};

function baseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "";
}

async function authorizedRequest(
  path: string,
  init: RequestInit,
): Promise<Response> {
  const accessToken = getAccessToken();
  if (!accessToken) throw chatError("unauthorized");

  let response: Response;
  try {
    response = await fetch(`${baseUrl()}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
        Authorization: `Bearer ${accessToken}`,
      },
    });
  } catch {
    throw chatError("network");
  }

  if (response.status === 401) {
    clearAccessToken();
    throw chatError("unauthorized");
  }
  return response;
}

function normalizeConversationPayload(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (!isRecord(payload)) return [];
  const data = payload.data;
  if (Array.isArray(data)) return data;
  if (isRecord(data) && Array.isArray(data.conversations)) return data.conversations;
  if (Array.isArray(payload.conversations)) return payload.conversations;
  return [];
}

function normalizeOrganId(value: unknown): OrganId | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  const aliases: Record<string, OrganId> = {
    brain: "brain",
    breast: "breasts",
    breasts: "breasts",
    heart: "heart",
    ovary: "ovaries",
    ovaries: "ovaries",
    thyroid: "thyroid",
    uterus: "uterus",
  };
  return aliases[normalized] ?? null;
}

function organLabel(organId: OrganId): string {
  return {
    brain: "brain",
    breasts: "breasts",
    heart: "heart",
    ovaries: "ovaries",
    thyroid: "thyroid",
    uterus: "uterus",
  }[organId];
}

function scopeQuestionToOrgan(organId: OrganId, question: string): string {
  const label = organLabel(organId);
  return `You are HerBody's ${label} AI companion. Answer only about the ${label}; do not identify yourself as or answer on behalf of another organ. User question: ${question}`;
}

export function normalizeConversations(payload: unknown): ConversationSummary[] {
  return normalizeConversationPayload(payload).flatMap((item) => {
    if (!isRecord(item)) return [];
    const nested =
      isRecord(item.conversation) ? item.conversation : item;
    const idValue =
      item.id ??
      item.conversationId ??
      nested.id ??
      nested.conversationId;
    const id = typeof idValue === "number"
      ? idValue
      : typeof idValue === "string" && idValue.trim()
        ? Number(idValue)
        : NaN;
    if (!Number.isInteger(id)) return [];
    const organValue =
      item.organId ??
      item.organ_id ??
      item.selectedOrgan ??
      nested.organId ??
      nested.organ_id ??
      nested.selectedOrgan ??
      (typeof item.organ === "string"
        ? item.organ
        : isRecord(item.organ)
          ? item.organ.id ?? item.organ.organId ?? item.organ.name
          : typeof nested.organ === "string"
            ? nested.organ
            : isRecord(nested.organ)
              ? nested.organ.id ?? nested.organ.organId ?? nested.organ.name
              : undefined);
    const organId = normalizeOrganId(organValue);
    const titleValue = item.title ?? item.name;
    const updatedValue = item.updatedAt ?? item.updated_at;
    return [{
      id,
      organId,
      title: typeof titleValue === "string" && titleValue.trim()
        ? titleValue
        : `Conversation ${id}`,
      updatedAt: typeof updatedValue === "string" ? updatedValue : undefined,
    }];
  });
}

export function normalizeConversationMessages(
  payload: unknown,
  fallbackOrganId: OrganId,
): ChatMessage[] {
  let items: unknown[] = [];
  if (isRecord(payload)) {
    const data = payload.data;
    if (Array.isArray(data)) items = data;
    else if (isRecord(data) && Array.isArray(data.messages)) items = data.messages;
    else if (isRecord(data) && isRecord(data.conversation) && Array.isArray(data.conversation.messages)) {
      items = data.conversation.messages;
    } else if (isRecord(payload.conversation) && Array.isArray(payload.conversation.messages)) {
      items = payload.conversation.messages;
    }
    else if (Array.isArray(payload.messages)) items = payload.messages;
  } else if (Array.isArray(payload)) {
    items = payload;
  }

  return items.flatMap((item, index) => {
    if (!isRecord(item)) return [];
    const textValue =
      item.text ?? item.content ?? item.message ?? item.answer ?? item.response;
    let text = typeof textValue === "string" ? textValue : "";
    if (!text) return [];
    const roleValue = item.role ?? item.sender ?? item.type;
    const role =
      roleValue === "user" || roleValue === "human"
        ? "user"
        : "organ";
    if (role === "user") {
      const prefix = scopeQuestionToOrgan(fallbackOrganId, "");
      const prefixWithoutQuestion = prefix.slice(0, -"User question: ".length);
      if (text.startsWith(prefixWithoutQuestion)) {
        text = text.slice(prefixWithoutQuestion.length);
      }
    }
    const idValue = item.id ?? item.messageId;
    const id = typeof idValue === "number" || typeof idValue === "string"
      ? String(idValue)
      : `${Date.now()}-${index}`;
    return [{ id, role, text, organId: fallbackOrganId }];
  });
}

function chatError(kind: ChatErrorKind): ChatError {
  return Object.assign(new Error(kind), { kind });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function safeHttpUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

export function normalizeChatResponse(payload: unknown): NormalizedChatResponse {
  const root = isRecord(payload) ? payload : {};
  const data = isRecord(root.data) ? root.data : null;
  const result = isRecord(root.result) ? root.result : null;
  const content = data && isRecord(data.content) ? data.content : null;
  const answerValue =
    data?.answer ??
    data?.response ??
    data?.text ??
    data?.content ??
    result?.answer ??
    result?.response ??
    result?.text ??
    result?.content ??
    root.answer ??
    root.response ??
    root.text ??
    (typeof root.content === "string" ? root.content : null) ??
    (typeof root.message === "string" &&
    root.message !== "AI response generated successfully."
      ? root.message
      : "") ??
    "";
  const answer = typeof answerValue === "string" ? answerValue : "";

  const sourceValue =
    data?.sources ??
    data?.medicalSources ??
    data?.references ??
    result?.sources ??
    result?.medicalSources ??
    result?.references ??
    content?.sources ??
    root.sources ??
    root.medicalSources ??
    root.references ??
    [];
  const sources = Array.isArray(sourceValue)
    ? sourceValue.flatMap((source) => {
        if (typeof source === "string") {
          const url = safeHttpUrl(source);
          return [{ title: source, ...(url ? { url } : {}) }];
        }
        if (!isRecord(source)) return [];
        const url = safeHttpUrl(source.url ?? source.link ?? source.href);
        const titleValue = source.title ?? source.name ?? source.source;
        const title =
          typeof titleValue === "string" && titleValue.trim()
            ? titleValue
            : url;
        if (!title) return [];
        return [{ title, ...(url ? { url } : {}) }];
      })
    : [];

  const conversationIdValue =
    data?.conversationId ??
    result?.conversationId ??
    root.conversationId ??
    root.id;
  const conversationId =
    typeof conversationIdValue === "number"
      ? conversationIdValue
      : typeof conversationIdValue === "string" && conversationIdValue.trim()
        ? Number(conversationIdValue)
        : undefined;
  return {
    answer,
    sources,
    conversationId: Number.isInteger(conversationId) ? conversationId : undefined,
  };
}

export async function getConversations(): Promise<ConversationSummary[]> {
  if (!baseUrl()) throw chatError("server");
  const response = await authorizedRequest("/api/ai/conversations", { method: "GET" });
  if (!response.ok) throw chatError(response.status === 404 ? "not_found" : "server");
  return normalizeConversations(await response.json());
}

export async function getConversation(
  conversationId: number,
  organId: OrganId,
): Promise<ChatMessage[]> {
  if (!baseUrl()) throw chatError("server");
  const response = await authorizedRequest(
    `/api/ai/conversations/${conversationId}`,
    { method: "GET" },
  );
  if (!response.ok) {
    if (response.status === 404) throw chatError("not_found");
    throw chatError("server");
  }
  const payload: unknown = await response.json();

  if (isRecord(payload)) {
    const data = isRecord(payload.data) ? payload.data : null;
    const conversation =
      isRecord(payload.conversation)
        ? payload.conversation
        : data && isRecord(data.conversation)
          ? data.conversation
          : null;
    const explicitOrgan =
      payload.organId ??
      payload.organ_id ??
      payload.organ ??
      data?.organId ??
      data?.organ_id ??
      data?.organ ??
      conversation?.organId ??
      conversation?.organ_id ??
      conversation?.organ;
    const normalizedExplicitOrgan = normalizeOrganId(explicitOrgan);
    if (normalizedExplicitOrgan && normalizedExplicitOrgan !== organId) {
      throw chatError("not_found");
    }
  }

  return normalizeConversationMessages(payload, organId);
}

export async function deleteConversation(conversationId: number): Promise<void> {
  if (!baseUrl()) throw chatError("server");
  const response = await authorizedRequest(
    `/api/ai/conversations/${conversationId}`,
    { method: "DELETE" },
  );
  if (!response.ok) throw chatError(response.status === 404 ? "not_found" : "server");
}

export async function sendChatMessage(
  organId: OrganId,
  question: string,
  signal?: AbortSignal,
  conversationId?: number,
): Promise<NormalizedChatResponse> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 60_000);
  const combined = new AbortController();
  const abortFromParent = () => combined.abort();
  signal?.addEventListener("abort", abortFromParent, { once: true });
  controller.signal.addEventListener("abort", () => combined.abort(), { once: true });

  try {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "";
    if (!baseUrl) {
      throw chatError("server");
    }
    const accessToken = getAccessToken();
    if (!accessToken) {
      throw chatError("unauthorized");
    }
    const response = await fetch(`${baseUrl}/api/ai/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        question: scopeQuestionToOrgan(organId, question),
        organId,
        ...(conversationId ? { conversationId } : {}),
      }),
      signal: combined.signal,
    });

    if (!response.ok) {
      if (response.status === 400) throw chatError("bad_request");
      if (response.status === 401) {
        clearAccessToken();
        throw chatError("unauthorized");
      }
      if (response.status === 404) throw chatError("not_found");
      throw chatError("server");
    }

    const payload: unknown = await response.json();
    return normalizeChatResponse(payload);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw chatError(signal?.aborted ? "network" : "timeout");
    }
    if (error instanceof Error && "kind" in error) throw error as ChatError;
    throw chatError("network");
  } finally {
    window.clearTimeout(timeout);
    signal?.removeEventListener("abort", abortFromParent);
  }
}
