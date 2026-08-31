"use client";

import { useState } from "react";
import { Plus, MessageSquare, Pencil, Trash2, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Conversation = { id: string; title: string; updated_at: string };

export function Sidebar({
  conversations,
  activeId,
  onSelect,
  onNewChat,
  onRename,
  onDelete,
}: {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");

  function startRename(c: Conversation) {
    setEditingId(c.id);
    setDraftTitle(c.title);
  }

  function confirmRename(id: string) {
    const trimmed = draftTitle.trim();
    if (trimmed) onRename(id, trimmed);
    setEditingId(null);
  }

  return (
    <aside className="w-72 shrink-0 h-full flex flex-col border-r bg-violet-50/60 dark:bg-violet-950/10">
      <div className="p-3 shrink-0">
        <button
          onClick={onNewChat}
          className="w-full flex items-center justify-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium py-2.5 transition-colors"
        >
          <Plus size={16} />
          New chat
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-2 pb-3">
        {conversations.length === 0 && (
          <p className="text-xs text-muted-foreground px-3 py-6 text-center">
            No conversations yet.
          </p>
        )}

        {conversations.map((c) => (
          <div
            key={c.id}
            className={cn(
              "group flex items-center gap-2 rounded-lg px-3 py-2.5 mb-1 cursor-pointer text-sm",
              c.id === activeId
                ? "bg-violet-200/70 dark:bg-violet-900/40 text-indigo-900 dark:text-violet-100"
                : "hover:bg-violet-100/70 dark:hover:bg-violet-900/20 text-foreground"
            )}
            onClick={() => editingId !== c.id && onSelect(c.id)}
          >
            <MessageSquare size={15} className="shrink-0 opacity-60" />

            {editingId === c.id ? (
              <div
                className="flex-1 flex items-center gap-1"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  autoFocus
                  value={draftTitle}
                  onChange={(e) => setDraftTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") confirmRename(c.id);
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  className="flex-1 min-w-0 bg-transparent border-b border-indigo-400 outline-none text-sm"
                />
                <button
                  onClick={() => confirmRename(c.id)}
                  className="p-1 hover:text-indigo-600"
                >
                  <Check size={14} />
                </button>
                <button
                  onClick={() => setEditingId(null)}
                  className="p-1 hover:text-red-500"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <>
                <span className="flex-1 min-w-0 truncate">{c.title}</span>
                <div className="hidden group-hover:flex items-center gap-1 shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      startRename(c);
                    }}
                    className="p-1 rounded hover:text-indigo-600"
                    title="Rename"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Delete "${c.title}"?`)) onDelete(c.id);
                    }}
                    className="p-1 rounded hover:text-red-500"
                    title="Delete"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </aside>
  );
}