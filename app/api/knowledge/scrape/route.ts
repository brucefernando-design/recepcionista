import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/postgres";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getGroqKey(): Promise<string> {
  if (process.env.GROQ_API_KEY) return process.env.GROQ_API_KEY.trim();
  try {
    const res = await query(
      "SELECT value FROM system_settings WHERE key = 'groq_api_key' LIMIT 1"
    );
    if (res.rows[0]?.value) return String(res.rows[0].value).trim();
  } catch {}
  return "";
}

function htmlToCleanText(html: string): { title: string; text: string } {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const metaDescMatch =
    html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i) ||
    html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["']/i) ||
    html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']*)["']/i);

  const title = (titleMatch?.[1] || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

  const metaDesc = (metaDescMatch?.[1] || "").trim();

  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\/(p|div|h1|h2|h3|h4|li|tr|section|article|br)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();

  const combined = [metaDesc ? `Descripción: ${metaDesc}` : "", stripped]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 12000);

  return { title, text: combined };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    let rawUrl = String(body.url || "").trim();
    if (!rawUrl) {
      return NextResponse.json(
        { error: "Ingresa una URL válida" },
        { status: 400 }
      );
    }
    if (!/^https?:\/\//i.test(rawUrl)) {
      rawUrl = `https://${rawUrl}`;
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(rawUrl);
    } catch {
      return NextResponse.json(
        { error: "Formato de URL inválido" },
        { status: 400 }
      );
    }

    let pageTitle = parsedUrl.hostname;
    let extractedText = "";

    // 1. Direct HTML fetch
    try {
      const res = await fetch(parsedUrl.toString(), {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "es-MX,es;q=0.9,en;q=0.8",
        },
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) {
        const html = await res.text();
        const cleaned = htmlToCleanText(html);
        if (cleaned.title) pageTitle = cleaned.title;
        extractedText = cleaned.text;
      }
    } catch (err) {
      console.warn("[scrape direct fetch warn]:", err);
    }

    // 2. If SPA or very little text extracted (< 250 chars), try Jina Reader fallback for JS-rendered pages
    if (extractedText.length < 250) {
      try {
        const jinaRes = await fetch(`https://r.jina.ai/${parsedUrl.toString()}`, {
          headers: { Accept: "text/plain" },
          signal: AbortSignal.timeout(12000),
        });
        if (jinaRes.ok) {
          const jinaText = (await jinaRes.text()).trim();
          if (jinaText.length > extractedText.length) {
            const firstLineTitle = jinaText.match(/^Title:\s*(.+)$/m)?.[1]?.trim();
            if (firstLineTitle) pageTitle = firstLineTitle;
            extractedText = jinaText.slice(0, 12000);
          }
        }
      } catch (err) {
        console.warn("[scrape jina fallback warn]:", err);
      }
    }

    if (!extractedText || extractedText.length < 20) {
      return NextResponse.json(
        {
          error:
            "No se pudo extraer texto de esa página web. Verifica que el enlace sea público o escribe el resumen manualmente.",
        },
        { status: 422 }
      );
    }

    // 3. Summarize into structured knowledge base via Groq
    const groqKey = await getGroqKey();
    let summary = extractedText.slice(0, 1500);

    if (groqKey) {
      const prompt = `Extrae y resume de forma clara, completa y estructurada en español toda la información útil de esta página web (${parsedUrl.toString()}) para que una recepcionista telefónica de IA pueda responder cualquier duda de los clientes.
Incluye:
- Qué es la empresa/producto/servicio y qué problemas resuelve.
- Lista de productos, módulos, funciones o servicios mencionados.
- Precios, planes, promociones o pruebas gratuitas (si aparecen).
- Datos de contacto, horarios o preguntas frecuentes (si aparecen).
Sé conciso (máximo 1200 caracteres) y usa texto corrido o viñetas simples.

CONTENIDO EXTRAÍDO DE LA WEB:
Título: ${pageTitle}
${extractedText.slice(0, 9000)}`;

      for (const model of ["qwen/qwen3.8-27b", "openai/gpt-oss-20b", "openai/gpt-oss-120b"]) {
        try {
          const payload: Record<string, any> = {
            model,
            messages: [{ role: "user", content: prompt }],
            temperature: 0.2,
            max_tokens: 550,
          };
          if (model.startsWith("qwen/")) payload.reasoning_effort = "none";

          const llmRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${groqKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(10000),
          });
          if (llmRes.ok) {
            const data = await llmRes.json();
            const content = (data.choices?.[0]?.message?.content || "")
              .replace(/<think>[\s\S]*?<\/think>/g, "")
              .trim();
            if (content.length > 40) {
              summary = content;
              break;
            }
          }
        } catch {}
      }
    }

    return NextResponse.json({
      id: `web_${Date.now()}`,
      url: parsedUrl.toString(),
      title: pageTitle || parsedUrl.hostname,
      summary,
      updatedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Error al procesar la página web" },
      { status: 500 }
    );
  }
}
