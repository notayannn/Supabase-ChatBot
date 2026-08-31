"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Sidebar } from "@/components/chatbot/sidebar";
import { Chat, type ChatMessage } from "@/components/chatbot/chat";

type Conversation = { id: string; title: string; updated_at: string };

export function ChatbotShell({
  userId,
  initialCredits,
  initialConversations,
}: {
  userId: string;
  initialCredits: number;
  initialConversations: Conversation[];
}) {
  const [conversations, setConversations] =
    useState<Conversation[]>(initialConversations);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [credits, setCredits] = useState(initialCredits);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const activeTitle =
    conversations.find((c) => c.id === activeId)?.title ?? "New chat";

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`credits-changes-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "credits",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const newCount = (payload.new as { credits_count: number }).credits_count;
          setCredits(newCount);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  async function selectConversation(id: string) {
    if (id === activeId) return;
    setActiveId(id);
    setLoadingMessages(true);
    try {
      const res = await fetch(`/api/conversations/${id}/messages`);
      const data = await res.json();
      setMessages(
        (data.messages ?? []).map((m: { role: "user" | "bot"; content: string }) => ({
          role: m.role,
          text: m.content,
        }))
      );
    } finally {
      setLoadingMessages(false);
    }
  }

  function startNewChat() {
    setActiveId(null);
    setMessages([]);
  }

  async function renameConversation(id: string, title: string) {
    setConversations((cs) =>
      cs.map((c) => (c.id === id ? { ...c, title } : c))
    );
    await fetch(`/api/conversations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
  }

  async function deleteConversation(id: string) {
    setConversations((cs) => cs.filter((c) => c.id !== id));
    if (id === activeId) {
      setActiveId(null);
      setMessages([]);
    }
    await fetch(`/api/conversations/${id}`, { method: "DELETE" });
  }

  function handleExchange(opts: {
    conversationId: string;
    title: string | null;
    creditsRemaining: number;
  }) {

    setCredits(opts.creditsRemaining);

    setConversations((cs) => {
      const now = new Date().toISOString();
      const exists = cs.some((c) => c.id === opts.conversationId);

      const next = exists
        ? cs.map((c) =>
            c.id === opts.conversationId
              ? { ...c, title: opts.title ?? c.title, updated_at: now }
              : c
          )
        : [
            {
              id: opts.conversationId,
              title: opts.title ?? "New chat",
              updated_at: now,
            },
            ...cs,
          ];

      return [...next].sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
    });

    setActiveId(opts.conversationId);
  }

  return (
    <>
      <Sidebar
        conversations={conversations}
        activeId={activeId}
        onSelect={selectConversation}
        onNewChat={startNewChat}
        onRename={renameConversation}
        onDelete={deleteConversation}
      />
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="shrink-0 px-6 pt-5 pb-3 border-b">
          <h1 className="font-bold text-xl">Chatbot</h1>
          <p className="text-sm text-muted-foreground truncate">{activeTitle}</p>
        </div>
        <Chat
          conversationId={activeId}
          messages={messages}
          setMessages={setMessages}
          credits={credits}
          loadingHistory={loadingMessages}
          onExchange={handleExchange}
        />
      </div>
    </>
  );
}