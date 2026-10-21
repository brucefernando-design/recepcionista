import type { Business } from "../lib/types";
import { agentTools, executeTool } from "../lib/agent/tools";
import type { ChatTurn } from "../lib/agent";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODELS = [
  process.env.GROQ_MODEL || "qwen/qwen3.8-27b",
  "openai/gpt-oss-20b",
  "openai/gpt-oss-120b",
];

// Track per-model rate limit cooldowns so we don't waste latency hitting a rate-limited model
const modelCooldownUntil = new Map<string, number>();

function combineSignals(signal: AbortSignal | undefined, timeoutMs: number): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs);
  return signal ? (AbortSignal as any).any([signal, timeout]) : timeout;
}

const CORE_VOICE_TOOLS = new Set([
  "check_availability",
  "book_appointment",
  "transfer_to_human",
]);

const EXTENDED_VOICE_TOOLS = new Set([
  "find_free_slots",
  "request_callback",
  "lookup_my_appointments",
  "cancel_appointment",
  "reschedule_appointment",
]);

function normalizeSearch(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

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
    if (k === "description" && typeof v === "string") out[k] = shorten(v, 55);
    else out[k] = compactSchema(v);
  }
  return out;
}

export function buildVoiceTools(business: Business, contextText = "") {
  const norm = normalizeSearch(contextText);
  const needsExtended =
    /(cancel|cambi|reagend|mov|modific|mi cita|mis citas|tengo cita|recado|llamen|devolv|horarios libres|espacios)/i.test(
      norm
    );

  const tools = agentTools
    .filter(
      (t) =>
        CORE_VOICE_TOOLS.has(t.name) ||
        (needsExtended && EXTENDED_VOICE_TOOLS.has(t.name)) ||
        (t.name === "take_order" && business.type === "restaurant")
    )
    .map((t) => ({
      type: "function",
      function: {
        name: t.name,
        description: shorten(t.description, 100),
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

function buildWebKnowledgeSection(business: Business, contextText: string): string {
  const sources = (business.webSources || []).filter(
    (w) => w.summary && w.summary.trim().length > 0
  );
  if (sources.length === 0) return "";

  const normCtx = normalizeSearch(contextText);

  return sources
    .map((w) => {
      const cleanSummary = w.summary.replace(/\s+/g, " ").trim();
      // Extract distinctive keywords from title and URL subdomain/path
      const rawTokens = normalizeSearch(`${w.title} ${w.url}`)
        .split(/[^a-z0-9]+/)
        .filter(
          (tok) =>
            tok.length >= 4 &&
            !["https", "http", "html", "para", "mexico", "allia2", "sistema", "plataforma"].includes(tok)
        );

      // Include phonetic aliases for common names (e.g. tukardex -> cardex/kardex, cruceline -> cruce, easyconta -> conta)
      const aliases = [...rawTokens];
      if (rawTokens.some((t) => t.includes("kardex"))) aliases.push("cardex", "kardex", "colegio", "escolar");
      if (rawTokens.some((t) => t.includes("cruce") || t.includes("tms")))
        aliases.push("cruce", "flete", "transporte", "carta porte");
      if (rawTokens.some((t) => t.includes("conta")))
        aliases.push("conta", "contable", "contador", "nomina", "impuesto");
      if (rawTokens.some((t) => t.includes("hotel"))) aliases.push("hotel", "restaurante", "habitacion");
      if (rawTokens.some((t) => t.includes("whatsapp") || t.includes("wai")))
        aliases.push("whatsapp", "asistente");

      const isMatched =
        aliases.some((kw) => normCtx.includes(kw)) ||
        /(precio|plan|costo|cuanto cuesta|mensualidad|prueba gratis|que incluye|modulos)/i.test(normCtx);

      if (isMatched) {
        return `• [${w.title} (${w.url})]: ${cleanSummary.slice(0, 750)}`;
      }
      // Compact 1-line overview when not actively discussing this specific site
      const brief = cleanSummary.slice(0, 190) + (cleanSummary.length > 190 ? "…" : "");
      return `• [${w.title} (${w.url})]: ${brief}`;
    })
    .join("\n");
}

export function buildVoiceSystemPrompt(business: Business, contextText = ""): string {
  const servicesList =
    business.services
      .map((s) => `${s.name} (${s.durationMinutes} min${s.price ? `, $${s.price}` : ""})`)
      .join(", ") || "Consulta general (30 min)";

  const availableProducts = (business.menu || []).filter((m) => m.available !== false);
  const productsList = availableProducts
    .map(
      (m) =>
        `${m.name}${m.description ? ` (${m.description})` : ""}${
          m.price && m.price > 0 ? `, $${m.price}` : ""
        }`
    )
    .join(", ");

  const defaultService =
    business.services[0]?.name || availableProducts[0]?.name || "Consulta general";

  const hasMultipleOfferings =
    business.services.length > 1 || availableProducts.length > 0;

  const offeringsSection = [
    business.services.length > 0 ? `- Servicios disponibles: ${servicesList}.` : "",
    productsList ? `- Productos / Sistemas disponibles: ${productsList}.` : "",
    !hasMultipleOfferings
      ? `- Único servicio disponible: "${defaultService}". NUNCA preguntes qué servicio desea ni si es primera vez; usa siempre "${defaultService}" automáticamente.`
      : `- Si el cliente pregunta qué servicios o productos ofrecemos, menciónalos con naturalidad (tanto los Servicios como los Productos/Sistemas). Al agendar cita, si no especifica uno, usa "${defaultService}".`,
  ]
    .filter(Boolean)
    .join("\n");

  const faqs = business.faqs.map((f) => `${f.question}: ${f.answer}`).join(" | ");
  const webKnowledge = buildWebKnowledgeSection(business, contextText);

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
${business.announcement ? `Aviso importante para todos los clientes: ${business.announcement}` : ""}
${offeringsSection}
${faqs ? `Preguntas frecuentes (FAQs): ${faqs}` : ""}
${
  business.customPrompt
    ? `\nINSTRUCCIONES Y PROMPT PERSONALIZADO DEL NEGOCIO (SIGUE ESTO CON PRIORIDAD):\n${business.customPrompt.trim()}\n`
    : ""
}${
  webKnowledge
    ? `\nBASE DE CONOCIMIENTO DE SITIOS WEB DEL NEGOCIO:\n${webKnowledge}\n`
    : ""
}Calendario de referencia: ${nextDays.join(", ")}.

REGLAS ESTRICTAS DE LLAMADA EN VIVO:
1. Responde SIEMPRE en español natural, cálido y breve (máximo 1 o 2 oraciones cortas, sin listas ni símbolos).
2. HORA HABLADA: Al hablar con el cliente usa SIEMPRE formato natural de 12 horas ("a la 1 de la tarde", "a las 4 de la tarde", "a las 10 de la mañana"). Si pide "a la 1", "a las 2", "a las 3", "a las 4", "a las 5", entiende SIEMPRE horario de la tarde (13:00 a 17:00). En las herramientas pasa formato 24h ("13:00", "16:00").
3. FLUJO DE CITA: Para llamar a \`book_appointment\` necesitas: (a) fecha y hora, (b) nombre del cliente, (c) teléfono del cliente. Si las instrucciones personalizadas del negocio piden además correo electrónico o confirmar teléfono y correo, pídelos y confírmalos siempre con amabilidad.
4. Usa \`check_availability\` SOLO cuando el cliente proponga una fecha/hora nueva. Si ya verificaste el horario y el cliente te dice su nombre ("Fernando Sánchez"), teléfono o correo, NO vuelvas a llamar a \`check_availability\`: agradécele por su nombre, pídele el dato que falte, y en cuanto tengas fecha, hora, nombre y teléfono ejecuta \`book_appointment\` (con \`service_name\` del servicio/producto elegido o "${defaultService}").
5. Nunca digas que una cita quedó agendada sin haber llamado primero a \`book_appointment\`.
6. TRANSFERIR A HUMANO: Si el cliente pide hablar con una persona, asesor o humano ("transfiéreme", "pásame con alguien"), llama INMEDIATAMENTE a \`transfer_to_human\` y dile brevemente que en este momento estás transfiriendo su llamada.
7. COLGAR / DESPEDIDA: Cuando el cliente se despida ("gracias, hasta luego", "eso es todo", "adiós") o te pida colgar la llamada ("cuelga", "ya puedes colgar"), llama SIEMPRE a \`end_call\` y despídete con una frase breve y cálida.`;
}

async function groqFetchWithFailover(
  apiKey: string,
  baseBody: Record<string, any>,
  signal: AbortSignal | undefined
): Promise<Response> {
  const now = Date.now();
  const uniqueModels = Array.from(new Set(GROQ_MODELS));
  // Prefer models not currently on rate-limit cooldown
  const readyModels = uniqueModels.filter((m) => (modelCooldownUntil.get(m) || 0) <= now);
  const cooldownModels = uniqueModels.filter((m) => (modelCooldownUntil.get(m) || 0) > now);
  const orderedModels = [...readyModels, ...cooldownModels];

  let lastRes: Response | undefined;
  let lastErr: any;

  for (const model of orderedModels) {
    for (let attempt = 0; attempt < 2; attempt++) {
      if (signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }
      const payload: Record<string, any> = { ...baseBody, model };
      if (model.startsWith("qwen/")) {
        payload.reasoning_effort = "none";
      } else if (model.startsWith("openai/")) {
        payload.reasoning_effort = "low";
      }
      try {
        // Timeout applies only until response headers arrive, so long streamed replies are never cut mid-sentence.
        const timeoutCtl = new AbortController();
        const timer = setTimeout(() => timeoutCtl.abort(), 4500);
        const fetchSignal: AbortSignal = signal
          ? (AbortSignal as any).any([signal, timeoutCtl.signal])
          : timeoutCtl.signal;
        let res: Response;
        try {
          res = await fetch(GROQ_API_URL, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey.trim()}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
            signal: fetchSignal,
          });
        } finally {
          clearTimeout(timer);
        }

        const remTokens = parseInt(res.headers.get("x-ratelimit-remaining-tokens") || "99999", 10);
        if (!isNaN(remTokens) && remTokens < 1600) {
          // Proactively rotate away from this model for 20s before it hits 429
          modelCooldownUntil.set(model, Date.now() + 20000);
        }

        if (res.ok) return res;
        lastRes = res;

        const status = res.status;
        const errText = await res.text().catch(() => "");
        console.warn(`[Groq ${model}] status=${status} attempt=${attempt + 1}: ${errText.slice(0, 180)}`);

        if (status === 429) {
          // If daily token limit (TPD) is reached, cooldown for 10 minutes; if per-minute (TPM), cooldown for 25s
          const isDailyLimit = errText.includes("tokens per day") || errText.includes("(TPD)");
          modelCooldownUntil.set(model, Date.now() + (isDailyLimit ? 600000 : 25000));
          break;
        }
        if (status === 400 || status >= 500) {
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
  const recentContext = [
    ...history.slice(-4).map((t) => t.content),
    userMessage,
  ].join(" ");
  const systemPrompt = buildVoiceSystemPrompt(business, recentContext);
  const groqTools = buildVoiceTools(business, recentContext);

  const messages: any[] = [
    { role: "system", content: systemPrompt },
    ...history.slice(-8).map((t) => ({ role: t.role, content: t.content })),
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
        max_tokens: 550,
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

    // Safety net: if a reasoning model returned empty content and no tool call, do a fast non-tool recovery call
    if (fullReply.trim().length === 0 && !toolCallBuffer) {
      const recoveryRes = await groqFetchWithFailover(
        apiKey,
        {
          messages: [
            {
              role: "system",
              content: `Eres AIVA, recepcionista telefónica de ${business.name}. Responde SIEMPRE en español natural y breve (1 o 2 oraciones cortas). ${
                business.customPrompt ? business.customPrompt.slice(0, 450) : ""
              }`,
            },
            ...messages.slice(1).slice(-6),
          ],
          stream: false,
          temperature: 0.2,
          max_tokens: 450,
        },
        signal
      );
      if (recoveryRes.ok) {
        const recData = await recoveryRes.json();
        const recText = (recData.choices?.[0]?.message?.content || "")
          .replace(/<think>[\s\S]*?<\/think>/g, "")
          .trim();
        if (recText) {
          callbacks.onSentenceClause(recText);
          fullReply = recText;
        }
      }
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

      // Use a compact system prompt for the follow-up turn so we don't burn 3,000+ tokens re-sending all websites
      const compactFollowUpSystem = `Eres AIVA, recepcionista telefónica de ${business.name}. Responde SIEMPRE en español natural y breve (1 o 2 oraciones cortas, sin símbolos ni asteriscos), usando formato de 12 horas ("a las 2 de la tarde"). ${
        business.customPrompt ? business.customPrompt.slice(0, 450) : ""
      }`;
      const followUpMessages = [
        { role: "system", content: compactFollowUpSystem },
        ...messages.slice(1).slice(-6),
      ];

      const followUpRes = await groqFetchWithFailover(
        apiKey,
        {
          messages: followUpMessages,
          tools:
            step === 0 && toolName === "check_availability"
              ? groqTools.filter((t) => t.function.name === "book_appointment")
              : undefined,
          stream: false,
          temperature: 0.2,
          max_tokens: 450,
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
        } else if (toolName === "book_appointment") {
          reply = `¡Perfecto${args.customer_name ? `, ${args.customer_name}` : ""}! Tu cita ha quedado registrada para el ${args.date || "día solicitado"} a las ${args.time || "hora indicada"}. ¿Me confirmas tu correo electrónico o puedo ayudarte en algo más?`;
        } else if (toolName === "check_availability") {
          reply = "Ese horario está disponible. Para agendar tu cita, ¿me podrías indicar tu nombre completo, teléfono y correo electrónico?";
        } else {
          reply = "Listo, ha quedado registrado. ¿Le puedo ayudar en algo más?";
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
