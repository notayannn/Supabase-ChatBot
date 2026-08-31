import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { streamBotReply, type ChatTurn } from "@/lib/chatbot/reply";

const HISTORY_LIMIT = 20;

function ndjson(obj: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(obj) + "\n");
}

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();

  const { data: userData, error: authError } = await supabase.auth.getUser();
  if (authError || !userData?.user) {
    return jsonError("Not authenticated", 401);
  }
  const user = userData.user;

  const body = await req.json();
  const message: string = body?.message ?? "";
  let conversationId: string | null = body?.conversationId ?? null;

  if (!message.trim()) {
    return jsonError("Message is required", 400);
  }

  let title: string | null = null;
  if (!conversationId) {
    const { data: newConvo, error: convoError } = await supabase
      .from("chat_conversations")
      .insert({ user_id: user.id, title: message.slice(0, 48) })
      .select()
      .single();

    if (convoError || !newConvo) {
      return jsonError("Could not start a new conversation", 500);
    }
    conversationId = newConvo.id;
    title = newConvo.title;
  }

  const { data: priorMessages } = await supabase
    .from("chat_messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(HISTORY_LIMIT);

  const history: ChatTurn[] = (priorMessages ?? []).map((m) => ({
    role: m.role === "bot" ? "assistant" : "user",
    content: m.content,
  }));
  history.push({ role: "user", content: message });

  const { data: remaining, error: creditError } = await supabase.rpc(
    "decrement_credit",
    { p_user_id: user.id }
  );

  if (creditError) {
    return jsonError("Out of credits", 402);
  }

  //Save user message
  await supabase.from("chat_messages").insert({
    conversation_id: conversationId,
    role: "user",
    content: message,
  });

  const convoId = conversationId;
  const convoTitle = title;

  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(
        ndjson({
          type: "meta",
          conversationId: convoId,
          title: convoTitle,
          creditsRemaining: remaining,
        })
      );

      const fullText = await streamBotReply(history, (delta) => {
        controller.enqueue(ndjson({ type: "delta", text: delta }));
      });

      await supabase.from("chat_messages").insert({
        conversation_id: convoId,
        role: "bot",
        content: fullText,
      });

      await supabase
        .from("chat_conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", convoId);

      controller.enqueue(ndjson({ type: "done" }));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}