import type { OrganId } from "@/types/organ";
import { clearAccessToken, getAccessToken } from "@/lib/api/auth";

export type ChatErrorKind = "bad_request" | "unauthorized" | "not_found" | "server" | "network" | "timeout";

export type ChatError = Error & { kind: ChatErrorKind };

export type NormalizedChatResponse = {
  answer: string;
  sources: { title: string; url?: string }[];
};

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

  return { answer, sources };
}

export async function sendChatMessage(
  organId: OrganId,
  question: string,
  signal?: AbortSignal,
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
    const organLabels: Record<OrganId, string> = {
      brain: "brain",
      breasts: "breasts",
      heart: "heart",
      ovaries: "ovaries",
      thyroid: "thyroid",
      uterus: "uterus",
    };
    const contextualQuestion =
      `As the ${organLabels[organId]}, answer this question from that organ's first-person perspective: ${question}`;
    const response = await fetch(`${baseUrl}/api/ai/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ question: contextualQuestion, organId }),
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
