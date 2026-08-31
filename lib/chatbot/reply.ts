export type ChatTurn = { role: "user" | "assistant"; content: string };

export async function streamBotReply(
  history: ChatTurn[],
  onDelta: (text: string) => void
): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  const lastUserMessage = history[history.length - 1]?.content ?? "";

  if (!apiKey) {
    const fallback = `You said: "${lastUserMessage}". (No GROQ_API_KEY set.)`;
    onDelta(fallback);
    return fallback;
  }

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "openai/gpt-oss-120b",
      stream: true,
      messages: [
        { role: "system", content: "You are a helpful, concise assistant." },
        ...history,
      ],
    }),
  });

  if (!res.ok || !res.body) {
    const errText = await res.text();
    console.error("Groq API error:", res.status, errText);
    const fallback = "Sorry, I couldn't generate a response right now. Please try again.";
    onDelta(fallback);
    return fallback;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let fullText = "";
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;

      const payload = trimmed.slice(5).trim();
      if (payload === "[DONE]") continue;

      try {
        const parsed = JSON.parse(payload);
        const delta: string = parsed.choices?.[0]?.delta?.content ?? "";
        if (delta) {
          fullText += delta;
          onDelta(delta);
        }
      } catch {

      }
    }
  }

  return fullText || "Sorry, I didn't get a response back.";
}