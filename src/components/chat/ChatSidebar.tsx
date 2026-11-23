"use client";

import {
  type KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import OrganCard from "@/components/body/OrganCard";
import { ORGANS } from "@/lib/organs";
import { sendChatMessage, type ChatError } from "@/lib/api/chat";
import type { ChatMessage } from "@/types/chat";
import type { OrganId } from "@/types/organ";

type ChatSidebarProps = {
  selectedOrgan: OrganId | null;
  onSelect: (organ: OrganId) => void;
};

type ChatContentProps = ChatSidebarProps & {
  closeDrawer?: () => void;
};

const STARTER_QUESTIONS: Record<OrganId, [string, string, string]> = {
  brain: [
    "What do you do for my body?",
    "How do hormones affect me?",
    "How can I support brain health?",
  ],
  breasts: [
    "What do you do for my body?",
    "Why might breast tissue feel tender?",
    "What breast changes should I discuss?",
  ],
  heart: [
    "What do you do for my body?",
    "How can I support my heart?",
    "What do heart signals mean?",
  ],
  ovaries: [
    "What do you do for my body?",
    "How do you affect my cycle?",
    "What can change ovarian health?",
  ],
  thyroid: [
    "What do you do for my body?",
    "How do thyroid hormones affect me?",
    "What thyroid symptoms need attention?",
  ],
  uterus: [
    "What do you do for my body?",
    "How does the menstrual lining change?",
    "What uterine changes should I discuss?",
  ],
};

function makeId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;
}

function isChatError(error: unknown): error is ChatError {
  return error instanceof Error && "kind" in error;
}

function ChatContent({
  selectedOrgan,
  closeDrawer,
}: ChatContentProps) {
  const [histories, setHistories] = useState<Record<OrganId, ChatMessage[]>>({
    brain: [],
    breasts: [],
    heart: [],
    ovaries: [],
    thyroid: [],
    uterus: [],
  });
  const [draft, setDraft] = useState("");
  const [inFlight, setInFlight] = useState<Record<OrganId, boolean>>({
    brain: false,
    breasts: false,
    heart: false,
    ovaries: false,
    thyroid: false,
    uterus: false,
  });
  const [detailsOpen, setDetailsOpen] = useState(false);
  const retryQuestions = useRef<Map<string, string>>(new Map());
  const messagesRef = useRef<HTMLDivElement>(null);
  const pinnedToBottom = useRef(true);

  const activeMessages = useMemo(
    () => (selectedOrgan ? histories[selectedOrgan] : []),
    [histories, selectedOrgan],
  );
  const activeInFlight = selectedOrgan ? inFlight[selectedOrgan] : false;

  useEffect(() => {
    const container = messagesRef.current;
    if (!container || !pinnedToBottom.current) return;
    container.scrollTop = container.scrollHeight;
  }, [activeMessages, activeInFlight]);

  function handleScroll() {
    const container = messagesRef.current;
    if (!container) return;
    pinnedToBottom.current =
      container.scrollHeight - container.scrollTop - container.clientHeight < 40;
  }

  async function submitQuestion(question: string, retryMessageId?: string) {
    const trimmed = question.trim();
    if (!selectedOrgan || !trimmed || inFlight[selectedOrgan] || trimmed.length > 500) return;

    const organId = selectedOrgan;
    const userMessage: ChatMessage = {
      id: makeId(),
      role: "user",
      text: trimmed,
      organId,
      status: "sending",
    };

    setHistories((current) => ({
      ...current,
      [organId]: [...current[organId], userMessage],
    }));
    setInFlight((current) => ({ ...current, [organId]: true }));
    setDraft("");

    if (retryMessageId) {
      setHistories((current) => ({
        ...current,
        [organId]: current[organId].filter(
          (message) => message.id !== retryMessageId && message.status !== "error",
        ),
      }));
    }

    try {
      const response = await sendChatMessage(organId, trimmed);
      setHistories((current) => ({
        ...current,
        [organId]: [
          ...current[organId].map((message) =>
            message.id === userMessage.id ? { ...message, status: undefined } : message,
          ),
          {
            id: makeId(),
            role: "organ",
            text: response.answer || "I do not have enough information to answer that yet.",
            organId,
            sources: response.sources,
          },
        ],
      }));
    } catch (error) {
      let text = "I’m having trouble answering right now. Please try again.";
      if (isChatError(error) && error.kind === "bad_request") {
        text = "Please rephrase your question.";
      } else if (isChatError(error) && error.kind === "unauthorized") {
        text = "Please sign in again to continue.";
      } else if (isChatError(error) && error.kind === "not_found") {
        text = "This organ isn't available yet.";
      }

      retryQuestions.current.set(userMessage.id, trimmed);
      setHistories((current) => ({
        ...current,
        [organId]: [
          ...current[organId].map((message) =>
            message.id === userMessage.id ? { ...message, status: "error" } : message,
          ),
          {
            id: makeId(),
            role: "organ",
            text,
            organId,
            status: "error",
          },
        ],
      }));
    } finally {
      setInFlight((current) => ({ ...current, [organId]: false }));
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submitQuestion(draft);
    }
  }

  function retry(question: string, messageId: string) {
    void submitQuestion(question, messageId);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-brand-purple/10 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-bold text-brand-purple">
              {selectedOrgan ? ORGANS[selectedOrgan].label : "Organ companion"}
            </p>
            <span className="mt-1 inline-flex rounded-full bg-lavender px-2 py-0.5 text-[10px] font-semibold text-brand-purple">
              AI companion
            </span>
          </div>
          {selectedOrgan && (
            <button
              type="button"
              aria-expanded={detailsOpen}
              onClick={() => setDetailsOpen((open) => !open)}
              className="rounded-full border border-brand-purple/10 px-3 py-1.5 text-xs font-semibold text-brand-purple focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-purple"
            >
              {detailsOpen ? "Hide details" : "Organ details"}
            </button>
          )}
          {closeDrawer && (
            <button
              type="button"
              data-chat-close
              onClick={closeDrawer}
              className="rounded-full border border-brand-purple/10 px-3 py-1.5 text-xs font-semibold text-brand-purple focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-purple lg:hidden"
            >
              Close
            </button>
          )}
        </div>
        {detailsOpen && selectedOrgan && (
          <div className="mt-3 max-h-56 overflow-y-auto">
            <OrganCard selectedOrgan={selectedOrgan} />
          </div>
        )}
      </div>

      {!selectedOrgan ? (
        <div className="grid flex-1 place-items-center p-6 text-center text-sm leading-6 text-ink/70">
          Tap an organ to start a conversation.
        </div>
      ) : (
        <>
          {activeMessages.length === 0 && (
            <div className="flex flex-wrap gap-2 px-4 pt-3" aria-label="Starter questions">
              {STARTER_QUESTIONS[selectedOrgan].map((question) => (
                <button
                  key={question}
                  type="button"
                  onClick={() => void submitQuestion(question)}
                  disabled={activeInFlight}
                  className="max-w-full rounded-full border border-brand-purple/10 bg-lavender/60 px-3 py-2 text-left text-xs font-semibold text-brand-purple focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-purple disabled:cursor-wait disabled:opacity-60"
                >
                  {question}
                </button>
              ))}
            </div>
          )}

          <div
            ref={messagesRef}
            role="log"
            aria-live="polite"
            aria-label={`${ORGANS[selectedOrgan].label} conversation`}
            onScroll={handleScroll}
            className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4"
          >
            {activeMessages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {message.role === "user" ? (
                  <div
                    className={`max-w-[85%] rounded-2xl rounded-br-md px-3 py-2 text-sm whitespace-pre-wrap ${
                      message.status === "error"
                        ? "bg-brand-pink text-white"
                        : "bg-brand-purple text-white"
                    }`}
                  >
                    {message.text}
                  </div>
                ) : (
                  <article className="max-w-[88%] rounded-2xl rounded-bl-md border border-lavender bg-white px-3 py-2 text-sm text-ink">
                    <p className="whitespace-pre-wrap">{message.text}</p>
                    {message.status === "error" && (
                      <button
                        type="button"
                        onClick={() => {
                          const failedUser = [...activeMessages]
                            .reverse()
                            .find((item) => item.role === "user" && item.status === "error");
                          if (failedUser) {
                            const question = retryQuestions.current.get(failedUser.id);
                            if (question) retry(question, failedUser.id);
                          }
                        }}
                        className="mt-2 rounded-full border border-brand-purple/20 px-3 py-1 text-xs font-semibold text-brand-purple focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-purple"
                      >
                        Try again
                      </button>
                    )}
                    {message.sources && message.sources.length > 0 && (
                      <details className="mt-2 border-t border-brand-purple/10 pt-2">
                        <summary className="cursor-pointer text-xs font-semibold text-brand-purple focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-purple">
                          Sources
                        </summary>
                        <ul className="mt-2 space-y-1 text-xs">
                          {message.sources.map((source, index) =>
                            source.url ? (
                              <li key={`${source.title}-${index}`}>
                                <a
                                  href={source.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-brand-purple underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-purple"
                                >
                                  {source.title}
                                </a>
                              </li>
                            ) : (
                              <li key={`${source.title}-${index}`}>{source.title}</li>
                            ),
                          )}
                        </ul>
                      </details>
                    )}
                  </article>
                )}
              </div>
            ))}
            {activeInFlight && (
              <div className="flex justify-start" aria-label="Organ is typing">
                <div className="rounded-2xl rounded-bl-md border border-lavender bg-white px-4 py-3 text-brand-purple">
                  <span className="inline-flex gap-1" aria-hidden="true">
                    <span className="size-1.5 animate-pulse rounded-full bg-brand-purple" />
                    <span className="size-1.5 animate-pulse rounded-full bg-brand-purple [animation-delay:150ms]" />
                    <span className="size-1.5 animate-pulse rounded-full bg-brand-purple [animation-delay:300ms]" />
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-brand-purple/10 p-3">
            <label htmlFor="organ-chat-input" className="sr-only">
              Message {selectedOrgan ? ORGANS[selectedOrgan].label : "your organ"}
            </label>
            <div className="flex items-end gap-2">
              <textarea
                id="organ-chat-input"
                value={draft}
                maxLength={500}
                rows={2}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={handleKeyDown}
                disabled={activeInFlight}
                placeholder={`Ask ${ORGANS[selectedOrgan].label}...`}
                className="min-h-12 min-w-0 flex-1 resize-none rounded-2xl border border-brand-purple/15 bg-white px-3 py-2 text-sm outline-none focus:border-brand-purple focus-visible:ring-2 focus-visible:ring-brand-purple/30 disabled:cursor-wait disabled:opacity-60"
              />
              <button
                type="button"
                onClick={() => void submitQuestion(draft)}
                disabled={activeInFlight || draft.trim().length === 0 || draft.length > 500}
                className="shrink-0 rounded-full bg-brand-purple px-4 py-2.5 text-sm font-bold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-purple disabled:cursor-not-allowed disabled:opacity-50"
              >
                Send
              </button>
            </div>
            <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-ink/60">
              <span>{draft.length}/500</span>
            </div>
          </div>
        </>
      )}
      <p className="border-t border-brand-purple/10 px-4 py-2 text-center text-[10px] leading-4 text-ink/65">
        Educational information only. HerBody explains and guides; it does not diagnose.
      </p>
    </div>
  );
}

export default function ChatSidebar({ selectedOrgan, onSelect }: ChatSidebarProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!drawerOpen) return;
    document.querySelector<HTMLButtonElement>("[data-chat-close]")?.focus();
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") setDrawerOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [drawerOpen]);

  useEffect(() => {
    if (!drawerOpen) triggerRef.current?.focus();
  }, [drawerOpen]);

  const content = (
    <ChatContent
      selectedOrgan={selectedOrgan}
      onSelect={onSelect}
      closeDrawer={drawerOpen ? () => setDrawerOpen(false) : undefined}
    />
  );

  return (
    <>
      {selectedOrgan && (
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="fixed bottom-5 left-1/2 z-30 -translate-x-1/2 rounded-full bg-brand-purple px-5 py-3 text-sm font-bold text-white shadow-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-purple lg:hidden"
        >
          Chat with your {ORGANS[selectedOrgan].label}
        </button>
      )}

      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close chat"
            className="absolute inset-0 bg-ink/30"
            onClick={() => setDrawerOpen(false)}
          />
        </div>
      )}

      <aside
        role={drawerOpen ? "dialog" : undefined}
        aria-modal={drawerOpen ? true : undefined}
        aria-label="Organ AI companion chat"
        className={
          drawerOpen
            ? "fixed inset-x-0 bottom-0 z-50 flex h-[85vh] max-h-[85vh] min-h-0 flex-col overflow-hidden rounded-t-3xl border-t border-brand-purple/10 bg-blush shadow-xl lg:sticky lg:top-4 lg:z-auto lg:h-[620px] lg:w-[380px] lg:rounded-2xl lg:border lg:bg-white/80"
            : "hidden min-h-0 lg:sticky lg:top-4 lg:flex lg:h-[620px] lg:w-[380px] lg:flex-col lg:overflow-hidden lg:rounded-2xl lg:border lg:border-brand-purple/10 lg:bg-white/80 lg:shadow-sm"
        }
      >
        {content}
      </aside>
    </>
  );
}
