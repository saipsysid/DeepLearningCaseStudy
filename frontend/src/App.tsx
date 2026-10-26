import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { checkBackendHealth, getChatHistory, sendChatMessage } from "./api/chat";
import type { ChatMessage } from "./types/chat";
import { MAX_MESSAGE_LENGTH, QUICK_QUESTIONS } from "./utils/constants";

const SESSION_KEY = "blinkit-support-session-id";

function getOrCreateSessionId(): string {
  const existing = localStorage.getItem(SESSION_KEY);
  if (existing) return existing;
  const created = crypto.randomUUID();
  localStorage.setItem(SESSION_KEY, created);
  return created;
}

export default function App() {
  const sessionId = useMemo(() => getOrCreateSessionId(), []);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Hi! I am Blinkit's support assistant. Ask me about orders, delivery, refunds, or payments.",
      createdAt: new Date().toISOString(),
    },
  ]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [backendReady, setBackendReady] = useState<boolean | null>(null);
  const [openRouterConfigured, setOpenRouterConfigured] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getChatHistory(sessionId)
      .then((history) => {
        if (history.length > 0) {
          setMessages((current) => [...current.slice(0, 1), ...history]);
        }
      })
      .catch(() => {
        toast.error("Could not load your saved conversation.");
      });

    checkBackendHealth()
      .then((health) => {
        setBackendReady(true);
        setOpenRouterConfigured(health.openRouterConfigured);
      })
      .catch(() => {
        setBackendReady(false);
      });
  }, []);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  async function handleSend(text = draft) {
    const message = text.trim();
    if (!message || sending) return;

    if (message.length > MAX_MESSAGE_LENGTH) {
      toast.error(`Please keep messages under ${MAX_MESSAGE_LENGTH} characters.`);
      return;
    }

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: message,
      createdAt: new Date().toISOString(),
    };

    setMessages((current) => [...current, userMessage]);
    setDraft("");
    setSending(true);

    try {
      const history = [...messages, userMessage]
        .filter((item) => item.id !== "welcome")
        .map((item) => ({ role: item.role, content: item.content, id: item.id, createdAt: item.createdAt }));

      const response = await sendChatMessage(message, sessionId, history);
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: response.reply,
          createdAt: new Date().toISOString(),
        },
      ]);
    } catch (err) {
      const apiMessage =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data
          ?.error?.message ?? "Could not reach the support backend.";
      toast.error(apiMessage);
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: apiMessage,
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0F0F0F] text-white">
      <header className="border-b border-white/10 bg-[#1A1A1A]">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#F9C22E]">
              Blinkit Support
            </p>
            <h1 className="text-xl font-bold">AI customer assistant</h1>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              backendReady
                ? "bg-[#00A651]/20 text-[#00A651]"
                : backendReady === false
                  ? "bg-red-500/20 text-red-400"
                  : "bg-white/10 text-white/60"
            }`}
          >
            {backendReady === null
              ? "Checking backend..."
              : backendReady
                ? openRouterConfigured
                  ? "Backend online"
                  : "Backend online · add OpenRouter key"
                : "Backend offline"}
          </span>
        </div>
      </header>

      <main className="mx-auto grid max-w-4xl gap-4 px-4 py-6 lg:grid-cols-[220px_1fr]">
        <aside className="hidden lg:block">
          <h2 className="mb-3 text-sm font-semibold text-white/70">Try asking</h2>
          <div className="space-y-2">
            {QUICK_QUESTIONS.slice(0, 6).map((question) => (
              <button
                key={question}
                type="button"
                onClick={() => handleSend(question)}
                className="block w-full rounded-xl border border-white/10 bg-[#1A1A1A] px-3 py-2 text-left text-sm text-white/80 hover:border-[#F9C22E]/60"
              >
                {question}
              </button>
            ))}
          </div>
        </aside>

        <section className="flex h-[75vh] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#1A1A1A]">
          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.map((item) => (
              <div
                key={item.id}
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 msg-enter ${
                  item.role === "user"
                    ? "ml-auto bg-[#F9C22E] text-black"
                    : "bg-[#222222] text-white"
                }`}
              >
                {item.content}
              </div>
            ))}
            {sending && (
              <div className="flex gap-1 rounded-2xl bg-[#222222] px-4 py-3 w-fit">
                <span className="typing-dot inline-block h-2 w-2 bg-[#F9C22E]" />
                <span className="typing-dot inline-block h-2 w-2 bg-[#F9C22E]" />
                <span className="typing-dot inline-block h-2 w-2 bg-[#F9C22E]" />
              </div>
            )}
          </div>

          <form
            className="border-t border-white/10 p-3"
            onSubmit={(event) => {
              event.preventDefault();
              void handleSend();
            }}
          >
            <div className="flex gap-2">
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void handleSend();
                  }
                }}
                rows={2}
                maxLength={MAX_MESSAGE_LENGTH}
                placeholder="Ask about an order, refund, or delivery..."
                className="min-h-[52px] flex-1 resize-none rounded-xl border border-white/10 bg-[#0F0F0F] px-3 py-2 text-sm text-white"
              />
              <button type="submit" disabled={sending} className="btn-primary self-end">
                Send
              </button>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}
