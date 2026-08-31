import { redirect } from "next/navigation";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { ChatbotShell } from "@/components/chatbot/chatbot-shell";

async function ChatbotContent() {
  const supabase = await createClient();
  const { data: userData, error } = await supabase.auth.getUser();

  if (error || !userData?.user) {
    redirect("/auth/login");
  }

  const [{ data: creditsRow }, { data: conversations }] = await Promise.all([
    supabase
      .from("credits")
      .select("credits_count")
      .eq("user_id", userData.user.id)
      .single(),
    supabase
      .from("chat_conversations")
      .select("id, title, updated_at")
      .eq("user_id", userData.user.id)
      .order("updated_at", { ascending: false }),
  ]);

  return (
    <ChatbotShell
      userId={userData.user.id}
      initialCredits={creditsRow?.credits_count ?? 0}
      initialConversations={conversations ?? []}
    />
  );
}

export default function ChatbotPage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
          Loading...
        </div>
      }
    >
      <ChatbotContent />
    </Suspense>
  );
}