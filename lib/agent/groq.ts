import type { Business } from "../types";
import { buildSystemPrompt, type PromptContext } from "./prompt";
import { agentTools, executeTool } from "./tools";
import type { AgentTurnResult, ChatTurn, AgentTurnOptions } from "./index";
import { query } from "../postgres";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = process.env.GROQ_MODEL || "qwen/qwen3.8-27b";
const MAX_TOOL_ITERATIONS = 5;
const MAX_HISTORY_TURNS = 24;

let cachedGroqKey: string | null = null;

export async function getGroqApiKey(): Promise<string> {
  if (
    process.env.GROQ_API_KEY &&
    process.env.GROQ_API_KEY.trim().startsWith("gsk_")
  ) {
    return process.env.GROQ_API_KEY.trim();
  }
  if (cachedGroqKey) {
    return cachedGroqKey;
  }
  try {
    const res = await query(
      "SELECT value FROM system_settings WHERE key = 'groq_api_key' LIMIT 1"
    );
    if (res.rows[0]?.value) {
      cachedGroqKey = String(res.rows[0].value).trim();
      return cachedGroqKey;
    }
  } catch (err) {
    console.error("[Groq] failed to read key from DB:", err);
  }
  return "";
}

export async function isGroqConfigured(): Promise<boolean> {
  const key = await getGroqApiKey();
  return Boolean(key && key.startsWith("gsk_"));
}

interface GroqTool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

interface GroqMessage {
  role: "system" | "user" | "assistant" | "tool";
  content?: string | null;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: {
      name: string;
      arguments: string;
    };
  }>;
  tool_call_id?: string;
}

export async function runGroqTurn(
  business: Business,
  history: ChatTurn[],
  userMessage: string,
  opts: AgentTurnOptions = {}
): Promise<AgentTurnResult> {
  const apiKey = await getGroqApiKey();
  if (!apiKey) {
    throw new Error("No Groq API key configured");
  }

  const events: AgentTurnResult["events"] = [];
  let language: string | undefined;

  const ctx: PromptContext = {
    language: opts.language,
    callerContext: opts.callerContext,
  };

  let windowed = history.slice(-MAX_HISTORY_TURNS);
  while (windowed.length && windowed[0].role !== "user") {
    windowed = windowed.slice(1);
  }

  const systemPrompt = buildSystemPrompt(business, ctx);

  const groqTools: GroqTool[] = agentTools.map((t) => ({
    type: "function",
    function: {
      name: t.name,
      description: t.description ?? "",
      parameters: t.input_schema as Record<string, unknown>,
    },
  }));

  const messages: GroqMessage[] = [
    { role: "system", content: systemPrompt },
    ...windowed.map((t) => ({ role: t.role, content: t.content })),
    { role: "user", content: userMessage },
  ];

  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
    const res = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages,
        tools: groqTools,
        temperature: 0.2,
        max_tokens: 300,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[Groq API error]:", res.status, errText);
      throw new Error(`Groq API error (${res.status}): ${errText}`);
    }

    const data = await res.json();
    const choice = data.choices?.[0];
    const msg = choice?.message;

    if (!msg) {
      throw new Error("No response message from Groq");
    }

    // Check for tool calls
    if (msg.tool_calls && msg.tool_calls.length > 0) {
      messages.push({
        role: "assistant",
        content: msg.content ?? "",
        tool_calls: msg.tool_calls,
      });

      for (const call of msg.tool_calls) {
        let parsedArgs: Record<string, unknown> = {};
        try {
          parsedArgs = JSON.parse(call.function.arguments || "{}");
        } catch {
          parsedArgs = {};
        }

        const outcome = await executeTool(
          business,
          call.function.name,
          parsedArgs,
          { language: ctx.language }
        );

        if (outcome.event) events.push(outcome.event);
        if (outcome.language) {
          language = outcome.language;
          ctx.language = outcome.language;
        }

        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: outcome.result,
        });
      }
      continue;
    }

    const reply = (msg.content || "").trim();
    return {
      reply: reply || "Disculpe, ¿podría repetir eso por favor?",
      events,
      language,
    };
  }

  return {
    reply:
      "Tengo un inconveniente en este momento. Permítame comunicarle con un compañero del equipo.",
    events: ["transfer_requested"],
    language,
  };
}
