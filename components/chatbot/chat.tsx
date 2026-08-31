"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, Send, User } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const STARTING_CREDITS = 50;

export type ChatMessage = { role: "user" | "bot"; text: string };

const markdownComponents = {
  p: (props: React.ComponentProps<"p">) => <p className="mb-2 last:mb-0" {...props} />,
  ul: (props: React.ComponentProps<"ul">) => <ul className="list-disc pl-5 mb-2 space-y-1" {...props} />,
  ol: (props: React.ComponentProps<"ol">) => <ol className="list-decimal pl-5 mb-2 space-y-1" {...props} />,
  li: (props: React.ComponentProps<"li">) => <li {...props} />,
  strong: (props: React.ComponentProps<"strong">) => <strong className="font-semibold" {...props} />,
  a: (props: React.ComponentProps<"a">) => (
    <a
      className="underline text-indigo-500 hover:text-indigo-400"
      target="_blank"
      rel="noreferrer"
      {...props}
    />
  ),

  pre: (props: React.ComponentProps<"pre">) => <pre className="my-0" {...props} />,
  code: ({ className, children, ...props }: React.ComponentProps<"code">) => {
    const isBlock = /language-/.test(className ?? "");
    return isBlock ? (
      <code
        className="block bg-zinc-900 text-zinc-100 rounded-lg p-3 overflow-x-auto text-xs my-2"
        {...props}
      >
        {children}
      </code>
    ) : (
      <code
        className="px-1 py-0.5 rounded bg-black/10 dark:bg-white/10 text-[0.85em]"
        {...props}
      >
        {children}
      </code>
    );
  },
};

function CreditMeter({ credits }: { credits: number }) {
  const pct = Math.max(0, Math.min(100, (credits / STARTING_CREDITS) * 100));
  const level = credits <= 5 ? "low" : credits <= 15 ? "mid" : "high";

  return (
    <div className="flex items-center gap-3">
      <div className="h-1.5 w-28 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500 ease-out",
            level === "high" && "bg-emerald-500",
            level === "mid" && "bg-amber-500",
            level === "low" && "bg-red-500"
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground tabular-nums">
        {credits} credit{credits === 1 ? "" : "s"} left
      </span>
    </div>
  );
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce"
          style={{ animationDelay: `${i * 120}ms` }}
        />
      ))}
    </div>
  );
}

function Avatar({ role }: { role: ChatMessage["role"] }) {
  return (
    <div
      className={cn(
        "flex items-center justify-center h-7 w-7 rounded-full shrink-0",
        role === "user"
          ? "bg-indigo-600 text-white"
          : "bg-zinc-200 dark:bg-zinc-800 text-foreground"
      )}
    >
      {role === "user" ? <User size={14} /> : <Bot size={14} />}
    </div>
  );
}

export function Chat({
  conversationId,
  messages,
  setMessages,
  credits,
  loadingHistory,
  onExchange,
}: {
  conversationId: string | null;
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  credits: number;
  loadingHistory: boolean;
  onExchange: (opts: {
    conversationId: string;
    title: string | null;
    creditsRemaining: number;
  }) => void;
}) {
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [outOfCredits, setOutOfCredits] = useState(credits <= 0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setOutOfCredits(credits <= 0);
  }, [credits]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, sending, loadingHistory]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || sending || outOfCredits) return;

    setMessages((m) => [...m, { role: "user", text }, { role: "bot", text: "" }]);
    setInput("");
    setSending(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, conversationId }),
      });

      if (res.status === 402) {
        setOutOfCredits(true);
        setMessages((m) => m.slice(0, -2));
        return;
      }

      if (!res.ok || !res.body) {
        setMessages((m) => {
          const copy = [...m];
          copy[copy.length - 1] = {
            role: "bot",
            text: "Something went wrong on our end. Try again.",
          };
          return copy;
        });
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let meta: {
        conversationId: string;
        title: string | null;
        creditsRemaining: number;
      } | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line);

          if (event.type === "meta") {
            meta = event;
          } else if (event.type === "delta") {
            setMessages((m) => {
              const copy = [...m];
              const last = copy[copy.length - 1];
              copy[copy.length - 1] = { role: "bot", text: last.text + event.text };
              return copy;
            });
          }
        }
      }

      if (meta) {
        onExchange({
          conversationId: meta.conversationId,
          title: meta.title,
          creditsRemaining: meta.creditsRemaining,
        });
      }
    } catch {
      setMessages((m) => {
        const copy = [...m];
        copy[copy.length - 1] = {
          role: "bot",
          text: "Could not reach the server. Check your connection and try again.",
        };
        return copy;
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="shrink-0 px-6 py-3 border-b flex items-center justify-between">
        <CreditMeter credits={credits} />
      </div>

      <div
        ref={scrollRef}
        className="flex-1 min-h-0 flex flex-col gap-3 overflow-y-auto px-6 py-5"
      >
        {loadingHistory && (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
            Loading conversation...
          </div>
        )}

        {!loadingHistory && messages.length === 0 && !outOfCredits && (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center">
            <Bot size={28} className="text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Send a message to start the conversation.
            </p>
          </div>
        )}

        {!loadingHistory &&
          messages.map((m, i) => {
            const isLast = i === messages.length - 1;
            const isStreamingPlaceholder =
              m.role === "bot" && m.text === "" && sending && isLast;

            return (
              <div
                key={i}
                className={cn(
                  "flex items-end gap-2 max-w-[70%]",
                  m.role === "user" ? "self-end flex-row-reverse" : "self-start"
                )}
              >
                <Avatar role={m.role} />
                <div
                  className={cn(
                    "rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                    m.role === "user"
                      ? "bg-indigo-600 text-white rounded-br-sm"
                      : "bg-zinc-100 dark:bg-zinc-800 text-foreground rounded-bl-sm"
                  )}
                >
                  {isStreamingPlaceholder ? (
                    <TypingDots />
                  ) : m.role === "bot" ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                      {m.text}
                    </ReactMarkdown>
                  ) : (
                    m.text
                  )}
                </div>
              </div>
            );
          })}
      </div>

      <div className="shrink-0 px-6 py-4 border-t">
        {outOfCredits ? (
          <div className="rounded-xl border border-red-300/50 bg-red-50 dark:bg-red-950/20 dark:border-red-900/40 px-4 py-3 text-sm text-red-600 dark:text-red-400">
            You are out of credits. Your balance refills to {STARTING_CREDITS} at midnight UTC.
          </div>
        ) : (
          <div className="flex gap-2 max-w-3xl mx-auto">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              placeholder="Type a message..."
              disabled={sending}
              autoFocus
            />
            <Button
              onClick={sendMessage}
              disabled={sending || !input.trim()}
              size="icon"
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              <Send size={16} />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}