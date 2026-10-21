import type { Business } from "../lib/types";
import { agentTools, executeTool } from "../lib/agent/tools";
import type { ChatTurn } from "../lib/agent";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODELS = [
  process.env.GROQ_MODEL || "qwen/qwen3.8-27b",
  "openai/gpt-oss-20b",
  "openai/gpt-oss-120b",
];

function combineSignals(signal: AbortSignal | undefined, timeoutMs: number): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs);
  return signal ? (AbortSignal as any).any([signal, timeout]) : timeout;
}

const VOICE_TOOLS = new Set([
  "check_availability",
  "book_appointment",
  "find_free_slots",
  "request_callback",
  "lookup_my_appointments",
  "cancel_appointment",
  "reschedule_appointment",
  "transfer_to_human",
]);

function shorten(text: string | undefined, max: number): string {
  if (!text) return "";
  const firstSentence = text.split(/(?<=[.!?])\s/)[0];
  return firstSentence.length > max ? firstSentence.slice(0, max - 1) + "…" : firstSentence;
}

function compactSchema(schema: any): any {
  if (!schema || typeof schema !== "object") return schema;
  if (Array.isArray(schema)) return schema.map(compactSchema);
  const out: any = {};
  for (const [k, v] of Object.entries(schema)) {
    if (k === "description" && typeof v === "string") out[k] = shorten(v, 60);
    else out[k] = compactSchema(v);
  }
  return out;
}

export function buildVoiceTools(business: Business) {
  const tools = agentTools
    .filter((t) => VOICE_TOOLS.has(t.name) || (t.name === "take_order" && business.type === "restaurant"))
    .map((t) => ({
      type: "function",
      function: {
        name: t.name,
        description: shorten(t.description, 120),
        parameters: compactSchema(t.input_schema),
      },
    }));

  tools.push({
    type: "function",
    function: {
      name: "end_call",
      description:
        "Hang up the phone call when the conversation is finished, the caller says goodbye, or asks you to hang up.",
      parameters: {
        type: "object",
        properties: {
          reason: {
            type: "string",
            description: "Reason for ending the call",
          },
        },
        required: ["reason"],
      },
    },
  });

  return tools;
}

export function buildVoiceSystemPrompt(business: Business): string {
  const servicesList =
    business.services.map((s) => `${s.name} (${s.durationMinutes} min${s.price ? `, $${s.price}` : ""})`).join(", ") ||
    "Consulta general (30 min)";
  const defaultService = business.services[0]?.name || "Consulta general";
  const singleServiceRule =
    business.services.length <= 1
      ? `- Único servicio disponible: "${defaultService}". NUNCA preguntes qué servicio desea ni si es primera vez; usa siempre "${defaultService}" automáticamente.`
      : `- Servicios: ${servicesList}.`;

  const faqs = business.faqs.map((f) => `${f.question}: ${f.answer}`).join(" | ");

  const dayNames = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  const now = new Date();
  const nextDays: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(now.getTime() + i * 86400000);
    const iso = d.toISOString().slice(0, 10);
    const dayName = dayNames[d.getUTCDay()];
    const label = i === 0 ? `Hoy ${dayName}` : i === 1 ? `Mañana ${dayName}` : `Próximo ${dayName}`;
    nextDays.push(`${label} = ${iso}`);
  }

  return `Eres AIVA, recepcionista telefónica de ${business.name} (${business.type}).
Horario: ${business.hours}. Dirección: ${business.address}. Teléfono: ${business.phone}.
${singleServiceRule}
${faqs ? `Preguntas frecuentes: ${faqs}` : ""}
Calendario de referencia: ${nextDays.join(", ")}.

REGLAS ESTRICTAS DE LLAMADA EN VIVO:
1. Responde SIEMPRE en español natural, cálido y breve (máximo 1 o 2 oraciones cortas, sin listas ni símbolos).
2. HORA HABLADA: Al hablar con el cliente usa SIEMPRE formato natural de 12 horas ("a la 1 de la tarde", "a las 4 de la tarde", "a las 10 de la mañana"). Si pide "a la 1", "a las 2", "a las 3", "a las 4", "a las 5", entiende SIEMPRE horario de la tarde (13:00 a 17:00). En las herramientas pasa formato 24h ("13:00", "16:00").
3. FLUJO DE CITA DIRECTO: Para agendar solo necesitas 3 cosas: (a) fecha y hora, (b) nombre del cliente, (c) teléfono del cliente.
4. Si aún NO tienes nombre o teléfono y el cliente propone fecha/hora, usa \`check_availability\`. Pero en cuanto YA tengas los 4 datos (fecha, hora, nombre y teléfono), NO llames a \`check_availability\`: ejecuta DIRECTAMENTE \`book_appointment\` (con \`service_name: "${defaultService}"\`), ya que \`book_appointment\` verifica la disponibilidad y guarda la cita en un solo paso. NUNCA hagas preguntas extra como "¿es tu primera visita?".
5. Nunca digas que una cita quedó agendada sin haber llamado primero a \`book_appointment\`.
6. TRANSFERIR A HUMANO: Si el cliente pide hablar con una persona, asesor o humano ("transfiéreme", "pásame con alguien"), llama INMEDIATAMENTE a \`transfer_to_human\` y dile brevemente que en este momento estás transfiriendo su llamada.
7. COLGAR / DESPEDIDA: Cuando el cliente se despida ("gracias, hasta luego", "eso es todo", "adiós") o te pida colgar la llamada ("cuelga", "ya puedes colgar"), llama SIEMPRE a \`end_call\` y despídete con una frase breve y cálida.`;
}

async function groqFetchWithFailover(
  apiKey: string,
  baseBody: Record<string, any>,
  signal: AbortSignal | undefined
): Promise<Response> {
  const uniqueModels = Array.from(new Set(GROQ_MODELS));
  let lastRes: Response | undefined;
  let lastErr: any;

  for (const model of uniqueModels) {
    for (let attempt = 0; attempt < 2; attempt++) {
      if (signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }
      const payload: Record<string, any> = { ...baseBody, model };
      if (model.startsWith("qwen/")) {
        payload.reasoning_effort = "none";
      }
      try {
        const res = await fetch(GROQ_API_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey.trim()}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
          signal: combineSignals(signal, 4500),
        });

        if (res.ok) return res;
        lastRes = res;

        const status = res.status;
        const errText = await res.text().catch(() => "");
        console.warn(`[Groq ${model}] status=${status} attempt=${attempt + 1}: ${errText.slice(0, 180)}`);

        // On 429 rate-limit or 400 tool_use_failed or 5xx, immediately switch to next model!
        if (status === 429 || status === 400 || status >= 500) {
          break;
        }
        return new Response(errText, { status });
      } catch (fetchErr: any) {
        if (signal?.aborted) {
          throw fetchErr;
        }
        lastErr = fetchErr;
        console.warn(`[Groq ${model}] timeout/network error on attempt ${attempt + 1}:`, fetchErr?.message || fetchErr);
        break;
      }
    }
  }

  if (lastRes) return lastRes;
  throw lastErr || new Error("All Groq models failed");
}

export interface GroqStreamCallbacks {
  onSentenceClause: (clause: string) => void;
  onComplete: (fullReply: string) => void;
  onError: (err: any) => void;
  onToolEvent?: (event: string, data?: any) => void;
}

export async function streamGroqResponse(
  apiKey: string,
  business: Business,
  history: ChatTurn[],
  userMessage: string,
  callbacks: GroqStreamCallbacks,
  signal?: AbortSignal
): Promise<void> {
  const systemPrompt = buildVoiceSystemPrompt(business);
  const groqTools = buildVoiceTools(business);

  const messages: any[] = [
    { role: "system", content: systemPrompt },
    ...history.slice(-10).map((t) => ({ role: t.role, content: t.content })),
    { role: "user", content: userMessage },
  ];

  try {
    const res = await groqFetchWithFailover(
      apiKey,
      {
        messages,
        tools: groqTools,
        stream: true,
        temperature: 0.2,
        max_tokens: 220,
      },
      signal
    );

    if (!res.ok) {
      const err = await res.text().catch(() => "");
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
    let inThinkBlock = false;
    let toolCallBuffer: { id: string; name: string; arguments: string } | null = null;

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
                id: tc.id || `call_${Date.now()}`,
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
            let token: string = delta.content;
            if (token.includes("<think>")) inThinkBlock = true;
            if (inThinkBlock) {
              if (token.includes("</think>")) {
                inThinkBlock = false;
                token = token.split("</think>").pop() || "";
              } else {
                continue;
              }
            }
            if (!token) continue;

            fullReply += token;
            sentenceBuffer += token;

            const buf = sentenceBuffer.trim();
            const endsSentence = /[.?!\n]\s*$/.test(sentenceBuffer) && buf.length > 8;
            const endsClause = /[,;:]\s*$/.test(sentenceBuffer) && buf.length > 35;
            if (endsSentence || endsClause) {
              callbacks.onSentenceClause(buf);
              sentenceBuffer = "";
            }
          }
        } catch {}
      }
    }

    if (sentenceBuffer.trim().length > 0) {
      callbacks.onSentenceClause(sentenceBuffer.trim());
    }

    // Handle tool call if model requested one (up to 2 chained tool calls: e.g. check_availability -> book_appointment)
    let currentToolCall = toolCallBuffer;
    for (let step = 0; step < 2 && currentToolCall && currentToolCall.name; step++) {
      let args: Record<string, any> = {};
      try {
        args = JSON.parse(currentToolCall.arguments || "{}");
      } catch {}

      if (currentToolCall.name === "book_appointment" && !args.service_name) {
        args.service_name = business.services[0]?.name || "Consulta general";
      }

      const toolName = currentToolCall.name;
      let toolOutcome: { result: string; event?: string; data?: any };
      try {
        console.log("[Tool call]:", toolName, JSON.stringify(args));
        if (toolName === "end_call") {
          toolOutcome = {
            result: "Llamada lista para finalizar. Despídete brevemente del cliente.",
            event: "call_ended",
          };
        } else {
          toolOutcome = await executeTool(business, toolName, args, {
            language: "es",
          });
        }
        console.log("[Tool result]:", String(toolOutcome.result).slice(0, 200));
        if (toolOutcome.event) {
          callbacks.onToolEvent?.(toolOutcome.event, toolOutcome.data);
        }
      } catch (toolErr: any) {
        console.error("[Tool error]:", toolErr);
        toolOutcome = {
          result: JSON.stringify({ error: "No se pudo completar la acción: " + (toolErr?.message || "error") }),
        };
      }

      // If the model already spoke its farewell/transfer sentence before invoking end_call/transfer_to_human, skip redundant follow-up
      if ((toolName === "end_call" || toolName === "transfer_to_human") && fullReply.trim().length > 0) {
        currentToolCall = null;
        break;
      }

      messages.push({
        role: "assistant",
        tool_calls: [
          {
            id: currentToolCall.id,
            type: "function",
            function: {
              name: toolName,
              arguments: JSON.stringify(args),
            },
          },
        ],
      });
      messages.push({
        role: "tool",
        tool_call_id: currentToolCall.id,
        content: toolOutcome.result,
      });

      currentToolCall = null;

      const followUpRes = await groqFetchWithFailover(
        apiKey,
        {
          messages,
          tools: step === 0 && toolName !== "end_call" && toolName !== "transfer_to_human" ? groqTools : undefined,
          stream: false,
          temperature: 0.2,
          max_tokens: 200,
        },
        signal
      );

      let reply = "";
      if (followUpRes.ok) {
        const followData = await followUpRes.json();
        const msg = followData.choices?.[0]?.message;
        if (msg?.tool_calls && msg.tool_calls.length > 0 && step === 0) {
          const nextTc = msg.tool_calls[0];
          currentToolCall = {
            id: nextTc.id || `call_${Date.now()}`,
            name: nextTc.function?.name || "",
            arguments: nextTc.function?.arguments || "{}",
          };
          continue;
        }
        reply = (msg?.content || "").replace(/<think>[\s\S]*?<\/think>/g, "").trim();
      } else {
        console.error("[Groq follow-up error]:", followUpRes.status);
      }

      if (!reply) {
        if (toolName === "end_call") {
          reply = `Muchas gracias por comunicarse con ${business.name}. ¡Que tenga un excelente día, hasta luego!`;
        } else if (toolName === "transfer_to_human") {
          reply = "Con mucho gusto, en este momento estoy transfiriendo su llamada con un asesor. Un momento por favor.";
        } else {
          reply = "Su solicitud ha sido procesada. ¿Le puedo ayudar en algo más?";
        }
      }
      callbacks.onSentenceClause(reply);
      fullReply += (fullReply ? " " : "") + reply;
    }

    callbacks.onComplete(fullReply.trim());
  } catch (err: any) {
    if (signal?.aborted) {
      console.log("[Groq stream] aborted by barge-in");
      return;
    }
    callbacks.onError(err);
  }
}
