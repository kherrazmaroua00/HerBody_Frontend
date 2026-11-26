"use client";

import Link from "next/link";
import {
  type KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { ORGANS } from "@/lib/organs";
import {
  deleteConversation,
  getConversation,
  getConversations,
  sendChatMessage,
  type ChatError,
} from "@/lib/api/chat";
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
  brain: ["What do you do for my body?", "How do hormones affect me?", "How can I support brain health?"],
  breasts: ["What do you do for my body?", "Why might breast tissue feel tender?", "What breast changes should I discuss?"],
  heart: ["What do you do for my body?", "How can I support my heart?", "What do heart signals mean?"],
  ovaries: ["What do you do for my body?", "How do you affect my cycle?", "What can change ovarian health?"],
  thyroid: ["What do you do for my body?", "How do thyroid hormones affect me?", "What thyroid symptoms need attention?"],
  uterus: ["What do you do for my body?", "How does the menstrual lining change?", "What uterine changes should I discuss?"],
};

function makeId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;
}

function isChatError(error: unknown): error is ChatError {
  return error instanceof Error && "kind" in error;
}

function ChatContent({ selectedOrgan, onSelect, closeDrawer }: ChatContentProps) {
  const emptyOrganMessages = (): Record<OrganId, ChatMessage[]> => ({
    brain: [], breasts: [], heart: [], ovaries: [], thyroid: [], uterus: [],
  });
  const emptyOrganIds = (): Record<OrganId, number | null> => ({
    brain: null, breasts: null, heart: null, ovaries: null, thyroid: null, uterus: null,
  });
  const emptyOrganFlags = (): Record<OrganId, boolean> => ({
    brain: false, breasts: false, heart: false, ovaries: false, thyroid: false, uterus: false,
  });
  const emptyOrganStrings = (): Record<OrganId, string> => ({
    brain: "", breasts: "", heart: "", ovaries: "", thyroid: "", uterus: "",
  });

  const [organMessages, setOrganMessages] = useState<Record<OrganId, ChatMessage[]>>(emptyOrganMessages);
  const [conversationIds, setConversationIds] = useState<Record<OrganId, number | null>>(emptyOrganIds);
  const [drafts, setDrafts] = useState<Record<OrganId, string>>(emptyOrganStrings);
  const [inFlightByOrgan, setInFlightByOrgan] = useState<Record<OrganId, boolean>>(emptyOrganFlags);
  const [chatErrors, setChatErrors] = useState<Record<OrganId, string>>(emptyOrganStrings);
  const [retryQuestions, setRetryQuestions] = useState<
    Record<OrganId, { text: string; messageId: string } | null>
  >({
    brain: null, breasts: null, heart: null, ovaries: null, thyroid: null, uterus: null,
  });
  const [loadingByOrgan, setLoadingByOrgan] = useState<Record<OrganId, boolean>>(emptyOrganFlags);
  const messagesRef = useRef<HTMLDivElement>(null);
  const pinnedToBottom = useRef(true);
  const loadedOrgans = useRef(new Set<OrganId>());

  const messages = selectedOrgan ? organMessages[selectedOrgan] : [];
  const draft = selectedOrgan ? drafts[selectedOrgan] : "";
  const inFlight = selectedOrgan ? inFlightByOrgan[selectedOrgan] : false;
  const chatError = selectedOrgan ? chatErrors[selectedOrgan] : "";
  const retryQuestion = selectedOrgan ? retryQuestions[selectedOrgan] : null;
  const conversationLoading = selectedOrgan ? loadingByOrgan[selectedOrgan] : false;

  useEffect(() => {
    const container = messagesRef.current;
    if (!container || !pinnedToBottom.current) return;
    container.scrollTop = container.scrollHeight;
  }, [selectedOrgan, organMessages, inFlightByOrgan]);

  useEffect(() => {
    if (!selectedOrgan || loadedOrgans.current.has(selectedOrgan)) return;

    const organId = selectedOrgan;
    let cancelled = false;

    async function restoreConversation() {
      setLoadingByOrgan((current) => ({ ...current, [organId]: true }));
      try {
        const conversations = await getConversations();
        const matching = conversations.find(
          (conversation) =>
            conversation.organId === organId,
        );
        if (!matching || cancelled) {
          if (!cancelled) loadedOrgans.current.add(organId);
          return;
        }

        const restoredMessages = await getConversation(matching.id, organId);
        if (cancelled) return;
        setConversationIds((current) => ({ ...current, [organId]: matching.id }));
        setOrganMessages((current) => ({
          ...current,
          [organId]: restoredMessages,
        }));
        loadedOrgans.current.add(organId);
      } catch (error) {
        if (!cancelled) {
          setChatErrors((current) => ({
            ...current,
            [organId]:
              isChatError(error) && error.kind === "unauthorized"
                ? "Please sign in again."
                : "Could not load this organ's conversation.",
          }));
        }
      } finally {
        if (!cancelled) {
          setLoadingByOrgan((current) => ({ ...current, [organId]: false }));
        }
      }
    }

    void restoreConversation();
    return () => { cancelled = true; };
  }, [selectedOrgan]);

  function changeOrgan(organId: OrganId) {
    onSelect(organId);
  }

  async function deleteOrganChat() {
    if (!selectedOrgan) return;
    const organId = selectedOrgan;
    if (!window.confirm(`Delete your ${ORGANS[organId].label} chat? This cannot be undone.`)) return;
    setLoadingByOrgan((current) => ({ ...current, [organId]: true }));
    try {
      const conversationId = conversationIds[organId];
      if (conversationId !== null) await deleteConversation(conversationId);
      setConversationIds((current) => ({ ...current, [organId]: null }));
      setOrganMessages((current) => ({ ...current, [organId]: [] }));
      setDrafts((current) => ({ ...current, [organId]: "" }));
      setChatErrors((current) => ({ ...current, [organId]: "" }));
      setRetryQuestions((current) => ({ ...current, [organId]: null }));
      loadedOrgans.current.add(organId);
    } catch (error) {
      setChatErrors((current) => ({
        ...current,
        [organId]:
        isChatError(error) && error.kind === "unauthorized"
          ? "Please sign in again."
          : "Could not delete this organ's chat.",
      }));
    } finally {
      setLoadingByOrgan((current) => ({ ...current, [organId]: false }));
    }
  }

  async function submitQuestion(question: string) {
    const trimmed = question.trim();
    if (!selectedOrgan || !trimmed || inFlight || trimmed.length > 500) return;

    const organId = selectedOrgan;
    const activeConversationId = conversationIds[organId];
    const userMessage: ChatMessage = {
      id: makeId(),
      role: "user",
      text: trimmed,
      organId,
      status: "sending",
    };
    setOrganMessages((current) => ({
      ...current,
      [organId]: [...current[organId], userMessage],
    }));
    setInFlightByOrgan((current) => ({ ...current, [organId]: true }));
    setDrafts((current) => ({ ...current, [organId]: "" }));
    setChatErrors((current) => ({ ...current, [organId]: "" }));

    try {
      const response = await sendChatMessage(
        organId,
        trimmed,
        undefined,
        activeConversationId ?? undefined,
      );
      if (response.conversationId) {
        setConversationIds((current) => ({
          ...current,
          [organId]: response.conversationId ?? null,
        }));
      }
      setOrganMessages((current): Record<OrganId, ChatMessage[]> => ({
        ...current,
        [organId]: [
          ...current[organId].map((message): ChatMessage =>
          message.id === userMessage.id
            ? { ...message, status: undefined }
            : message,
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
      setRetryQuestions((current) => ({ ...current, [organId]: null }));
    } catch (error) {
      let text = "I’m having trouble answering right now.";
      if (isChatError(error) && error.kind === "bad_request") text = "Please rephrase your question.";
      if (isChatError(error) && error.kind === "unauthorized") text = "Please sign in again.";
      if (isChatError(error) && error.kind === "not_found") text = "This organ isn't available yet.";
      setChatErrors((current) => ({ ...current, [organId]: text }));
      setRetryQuestions((current) => ({
        ...current,
        [organId]: { text: trimmed, messageId: userMessage.id },
      }));
      setOrganMessages((current): Record<OrganId, ChatMessage[]> => ({
        ...current,
        [organId]: current[organId].map((message): ChatMessage =>
          message.id === userMessage.id ? { ...message, status: "error" } : message,
        ),
      }));
    } finally {
      setInFlightByOrgan((current) => ({ ...current, [organId]: false }));
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submitQuestion(draft);
    }
  }

  function handleScroll() {
    const container = messagesRef.current;
    if (!container) return;
    pinnedToBottom.current =
      container.scrollHeight - container.scrollTop - container.clientHeight < 40;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-brand-purple/10 px-3 py-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="font-bold text-brand-purple">
              {selectedOrgan ? ORGANS[selectedOrgan].label : "Organ companion"}
            </p>
            <span className="mt-1 inline-flex rounded-full bg-lavender px-2 py-0.5 text-[10px] font-semibold text-brand-purple">
              AI companion
            </span>
          </div>
          <div className="flex items-center gap-2">
            {selectedOrgan && conversationIds[selectedOrgan] !== null && (
              <button
                type="button"
                aria-label={`Delete ${ORGANS[selectedOrgan].label} chat`}
                title={`Delete ${ORGANS[selectedOrgan].label} chat`}
                onClick={() => void deleteOrganChat()}
                disabled={conversationLoading || inFlight}
                className="grid size-8 place-items-center rounded-full text-ink/60 transition hover:bg-red-50 hover:text-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-purple disabled:cursor-not-allowed disabled:opacity-40"
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="size-4">
                  <path d="M3 6h18" />
                  <path d="M8 6V4h8v2" />
                  <path d="m19 6-1 14H6L5 6" />
                  <path d="M10 11v5M14 11v5" />
                </svg>
              </button>
            )}
            {closeDrawer && (
            <button
              type="button"
              data-chat-close
              onClick={closeDrawer}
              className="rounded-full border border-brand-purple/10 px-3 py-1.5 text-xs font-semibold text-brand-purple lg:hidden"
            >
              Close
            </button>
            )}
          </div>
        </div>
      </div>

      {!selectedOrgan ? (
        <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
          <p className="text-sm font-semibold text-brand-purple">Choose an organ to start</p>
          <p className="mt-1 text-xs leading-5 text-ink/65">Select an organ to begin a conversation.</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {(Object.keys(ORGANS) as OrganId[]).map((organId) => (
              <button
                key={organId}
                type="button"
                onClick={() => changeOrgan(organId)}
                className="rounded-full border border-brand-purple/15 bg-white px-3 py-2 text-xs font-semibold text-brand-purple"
              >
                {ORGANS[organId].label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <>
          {conversationLoading && (
            <p className="px-3 pt-3 text-xs text-ink/60">Loading your conversation…</p>
          )}
          {messages.length === 0 && !conversationLoading && (
            <div className="flex flex-wrap gap-2 px-3 pt-3" aria-label="Starter questions">
              {STARTER_QUESTIONS[selectedOrgan].map((question) => (
                <button
                  key={question}
                  type="button"
                  onClick={() => void submitQuestion(question)}
                  disabled={inFlight}
                  className="max-w-full rounded-full border border-brand-purple/10 bg-lavender/60 px-3 py-2 text-left text-xs font-semibold text-brand-purple disabled:opacity-60"
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
            className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3"
          >
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {message.role === "user" ? (
                  <div className="max-w-[85%] rounded-2xl rounded-br-md bg-brand-purple px-3 py-2 text-sm text-white whitespace-pre-wrap">
                    {message.text}
                  </div>
                ) : (
                  <article className="max-w-[88%] rounded-2xl rounded-bl-md border border-lavender bg-white px-3 py-2 text-sm text-ink">
                    <p className="whitespace-pre-wrap">{message.text}</p>
                    {message.sources && message.sources.length > 0 && (
                      <details className="mt-2 border-t border-brand-purple/10 pt-2">
                        <summary className="cursor-pointer text-xs font-semibold text-brand-purple">Sources</summary>
                        <ul className="mt-2 space-y-1 text-xs">
                          {message.sources.map((source, index) =>
                            source.url ? (
                              <li key={`${source.title}-${index}`}>
                                <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-brand-purple underline">
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
            {inFlight && (
              <div className="flex justify-start" aria-label="Organ is typing">
                <div className="rounded-2xl rounded-bl-md border border-lavender bg-white px-4 py-3">
                  <span className="inline-flex gap-1" aria-hidden="true">
                    <span className="size-1.5 animate-pulse rounded-full bg-brand-purple" />
                    <span className="size-1.5 animate-pulse rounded-full bg-brand-purple [animation-delay:150ms]" />
                    <span className="size-1.5 animate-pulse rounded-full bg-brand-purple [animation-delay:300ms]" />
                  </span>
                </div>
              </div>
            )}
            {chatError && (
              <div className="flex justify-start" role="alert">
                <article className="max-w-[88%] rounded-2xl rounded-bl-md border border-lavender bg-white px-3 py-2 text-sm text-ink">
                  <p>{chatError}</p>
                  {chatError === "Please sign in again." ? (
                    <Link
                      href="/login"
                      className="mt-2 inline-flex rounded-full border border-brand-purple/20 px-3 py-1 text-xs font-semibold text-brand-purple"
                    >
                      Sign in
                    </Link>
                  ) : retryQuestion && (
                    <button
                      type="button"
                      onClick={() => void submitQuestion(retryQuestion.text)}
                      className="mt-2 rounded-full border border-brand-purple/20 px-3 py-1 text-xs font-semibold text-brand-purple"
                    >
                      Try again
                    </button>
                  )}
                </article>
              </div>
            )}
          </div>

          <div className="border-t border-brand-purple/10 p-3">
            <label htmlFor="organ-chat-input" className="sr-only">Message {ORGANS[selectedOrgan].label}</label>
            <div className="flex items-end gap-2">
              <textarea
                id="organ-chat-input"
                value={draft}
                maxLength={500}
                rows={2}
                onChange={(event) =>
                  selectedOrgan &&
                  setDrafts((current) => ({
                    ...current,
                    [selectedOrgan]: event.target.value,
                  }))
                }
                onKeyDown={handleKeyDown}
                disabled={inFlight}
                placeholder={`Ask ${ORGANS[selectedOrgan].label}...`}
                className="min-h-12 min-w-0 flex-1 resize-none rounded-2xl border border-brand-purple/15 bg-white px-3 py-2 text-sm outline-none focus:border-brand-purple"
              />
              <button
                type="button"
                onClick={() => void submitQuestion(draft)}
                disabled={inFlight || draft.trim().length === 0}
                className="shrink-0 rounded-full bg-brand-purple px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
              >
                Send
              </button>
            </div>
            <div className="mt-1 text-right text-[10px] text-ink/60">{draft.length}/500</div>
          </div>
        </>
      )}
      <p className="border-t border-brand-purple/10 px-3 py-2 text-center text-[10px] leading-4 text-ink/65">
        Educational information only. HerBody does not diagnose.
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
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setDrawerOpen(true)}
        className="fixed bottom-5 left-1/2 z-30 -translate-x-1/2 rounded-full bg-brand-purple px-5 py-3 text-sm font-bold text-white shadow-lg lg:hidden"
      >
        {selectedOrgan ? `Chat with your ${ORGANS[selectedOrgan].label}` : "Open organ chat"}
      </button>

      {drawerOpen && (
        <button
          type="button"
          aria-label="Close chat"
          className="fixed inset-0 z-40 bg-ink/30 lg:hidden"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      <aside
        role={drawerOpen ? "dialog" : undefined}
        aria-modal={drawerOpen ? true : undefined}
        aria-label="Organ AI companion chat"
        className={
          drawerOpen
            ? "fixed inset-x-0 bottom-0 z-50 flex h-[85vh] max-h-[85vh] min-h-0 flex-col overflow-hidden rounded-t-3xl border-t border-brand-purple/10 bg-blush shadow-xl lg:sticky lg:top-4 lg:z-auto lg:h-[540px] lg:w-[340px] lg:rounded-2xl lg:border lg:bg-white/80"
            : "hidden min-h-0 lg:sticky lg:top-4 lg:flex lg:h-[540px] lg:w-[340px] lg:flex-col lg:overflow-hidden lg:rounded-2xl lg:border lg:border-brand-purple/10 lg:bg-white/80 lg:shadow-sm"
        }
      >
        {content}
      </aside>
    </>
  );
}
