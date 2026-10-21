import { NextRequest } from 'next/server';

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';

export async function POST(req: NextRequest) {
  try {
    const {
      message,
      messages = [],
      model = 'deepseek-r1-distill-qwen-1.5b-q4',
      isZeroCloud = true,
    } = await req.json();

    if (!message || typeof message !== 'string') {
      return new Response(JSON.stringify({ error: 'Message is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const encoder = new TextEncoder();
    const ollamaModel = model.includes('deepseek') ? 'deepseek-r1:1.5b' : 'qwen2.5:0.5b';

    const stream = new ReadableStream({
      async start(controller) {
        controller.enqueue(
          encoder.encode(`event: start\ndata: ${JSON.stringify({ model, isZeroCloud })}\n\n`)
        );

        const emitError = (text: string) => {
          controller.enqueue(
            encoder.encode(`event: error\ndata: ${JSON.stringify({ error: text })}\n\n`)
          );
        };

        let streamed = false;
        try {
          const ollamaRes = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: ollamaModel,
              messages: [
                { role: 'system', content: 'You are OpenBot, a universal autonomous AI agent.' },
                ...messages.slice(-4),
                { role: 'user', content: message },
              ],
              stream: true,
            }),
          });

          if (!ollamaRes.ok) {
            const detail = await ollamaRes.text().catch(() => '');
            emitError(
              `Ollama at ${OLLAMA_BASE_URL} returned HTTP ${ollamaRes.status} for model "${ollamaModel}". ${detail.slice(0, 300)} Pull the model with \`ollama pull ${ollamaModel}\` or choose a different model.`
            );
          } else if (ollamaRes.body) {
            const reader = ollamaRes.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              const chunk = decoder.decode(value, { stream: true });
              const lines = chunk.split('\n');

              for (const line of lines) {
                if (!line.trim()) continue;
                try {
                  const parsed = JSON.parse(line);
                  if (parsed.message?.content) {
                    streamed = true;
                    controller.enqueue(
                      encoder.encode(
                        `event: token\ndata: ${JSON.stringify({ content: parsed.message.content })}\n\n`
                      )
                    );
                  }
                } catch {
                  // Non-JSON keep-alive line
                }
              }
            }
            if (!streamed) {
              emitError(`Ollama model "${ollamaModel}" returned an empty response.`);
            }
          }
        } catch (err: unknown) {
          // No synthetic fallback: report the real connectivity problem.
          emitError(
            `Local Ollama is not reachable at ${OLLAMA_BASE_URL} (${err instanceof Error ? err.message : String(err)}). Start Ollama and pull "${ollamaModel}", or use the non-streaming chat with a BYOK cloud key.`
          );
        }

        controller.enqueue(
          encoder.encode(`event: done\ndata: ${JSON.stringify({ status: streamed ? 'completed' : 'error' })}\n\n`)
        );
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (err: unknown) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Stream error' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
