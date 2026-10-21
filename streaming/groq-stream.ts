import type { Business } from "../lib/types";
import { buildSystemPrompt } from "../lib/agent/prompt";
import { agentTools, executeTool } from "../lib/agent/tools";
import type { ChatTurn } from "../lib/agent";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = process.env.GROQ_MODEL || "qwen/qwen3.8-27b";

function combineSignals(signal: AbortSignal | undefined, timeoutMs: number): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs);
  return signal ? (AbortSignal as any).any([signal, timeout]) : timeout;
}

export interface GroqStreamCallbacks {
  onSentenceClause: (clause: string) => void;
  onComplete: (fullReply: string) => void;
  onError: (err: any) => void;
}

export async function streamGroqResponse(
  apiKey: string,
  business: Business,
  history: ChatTurn[],
  userMessage: string,
  callbacks: GroqStreamCallbacks,
  signal?: AbortSignal
): Promise<void> {
  const systemPrompt = buildSystemPrompt(business, { language: "es" });

  const groqTools = agentTools.map((t) => ({
    type: "function",
    function: {
      name: t.name,
      description: t.description,
      parameters: t.input_schema,
    },
  }));

  const messages: any[] = [
    { role: "system", content: systemPrompt },
    ...history.slice(-16).map((t) => ({ role: t.role, content: t.content })),
    { role: "user", content: userMessage },
  ];

  try {
    const res = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages,
        tools: groqTools,
        stream: true,
        temperature: 0.2,
        max_tokens: 250,
      }),
      signal: combineSignals(signal, 15000),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Groq stream error: ${res.status} ${err}`);
    }

    if (!res.body) {
      throw new Error("No response body from Groq stream");
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let sentenceBuffer = "";
    let fullReply = "";
    let toolCallBuffer: { id: string; name: string; arguments: string } | null = null;

    const sentencePunctuation = /[.?!,;:\n]+/;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === "data: [DONE]") continue;
        if (!trimmed.startsWith("data: ")) continue;

        try {
          const json = JSON.parse(trimmed.slice(6));
          const delta = json.choices?.[0]?.delta;

          if (delta?.tool_calls && delta.tool_calls.length > 0) {
            const tc = delta.tool_calls[0];
            if (!toolCallBuffer) {
              toolCallBuffer = {
                id: tc.id || "",
                name: tc.function?.name || "",
                arguments: tc.function?.arguments || "",
              };
            } else {
              if (tc.id) toolCallBuffer.id = tc.id;
              if (tc.function?.name) toolCallBuffer.name += tc.function.name;
              if (tc.function?.arguments) toolCallBuffer.arguments += tc.function.arguments;
            }
            continue;
          }

          if (delta?.content) {
            const token = delta.content;
            fullReply += token;
            sentenceBuffer += token;

            // Check if sentenceBuffer has a completed phrase or punctuation mark
            const buf = sentenceBuffer.trim();
            const endsSentence = /[.?!\n]\s*$/.test(sentenceBuffer) && buf.length > 8;
            const endsClause = /[,;:]\s*$/.test(sentenceBuffer) && buf.length > 35;
            if (endsSentence || endsClause) {
              const clause = buf;
              callbacks.onSentenceClause(clause);
              sentenceBuffer = "";
            }
          }
        } catch {}
      }
    }

    // Flush any remaining text in sentence buffer
    if (sentenceBuffer.trim().length > 0) {
      callbacks.onSentenceClause(sentenceBuffer.trim());
    }

    // Handle tool call if model requested one
    if (toolCallBuffer && toolCallBuffer.name) {
      let args = {};
      try {
        args = JSON.parse(toolCallBuffer.arguments || "{}");
      } catch {}

      let toolOutcome: { result: string };
      try {
        console.log("[Tool call]:", toolCallBuffer.name, JSON.stringify(args));
        toolOutcome = await executeTool(business, toolCallBuffer.name, args, {
          language: "es",
        });
        console.log("[Tool result]:", String(toolOutcome.result).slice(0, 200));
      } catch (toolErr: any) {
        console.error("[Tool error]:", toolErr);
        toolOutcome = {
          result: JSON.stringify({ error: "No se pudo completar la acción: " + (toolErr?.message || "error") }),
        };
      }

      messages.push({
        role: "assistant",
        tool_calls: [
          {
            id: toolCallBuffer.id,
            type: "function",
            function: {
              name: toolCallBuffer.name,
              arguments: toolCallBuffer.arguments,
            },
          },
        ],
      });
      messages.push({
        role: "tool",
        tool_call_id: toolCallBuffer.id,
        content: toolOutcome.result,
      });

      // Stream the final response after tool execution
      const followUpRes = await fetch(GROQ_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey.trim()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages,
          stream: false,
          max_tokens: 200,
        }),
        signal: combineSignals(signal, 15000),
      });

      let reply = "";
      if (followUpRes.ok) {
        const followData = await followUpRes.json();
        reply = (followData.choices?.[0]?.message?.content || "").trim();
      } else {
        console.error("[Groq follow-up error]:", followUpRes.status, await followUpRes.text());
      }
      if (!reply) reply = "Disculpe, tuve un inconveniente al procesar su solicitud. ¿Me lo puede repetir, por favor?";
      callbacks.onSentenceClause(reply);
      fullReply += " " + reply;
    }

    callbacks.onComplete(fullReply.trim());
  } catch (err: any) {
    if (err.name === "AbortError") {
      console.log("[Groq stream] aborted by barge-in");
      return;
    }
    callbacks.onError(err);
  }
}
