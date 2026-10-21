import { NextRequest, NextResponse } from 'next/server';

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';

export async function GET() {
  try {
    const res = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
      signal: AbortSignal.timeout(3000),
    });

    if (!res.ok) {
      return NextResponse.json({
        available: false,
        error: `Ollama returned HTTP ${res.status}`,
        models: [],
      });
    }

    const data = await res.json();
    return NextResponse.json({
      available: true,
      baseUrl: OLLAMA_BASE_URL,
      models: data.models || [],
    });
  } catch (error: unknown) {
    return NextResponse.json({
      available: false,
      baseUrl: OLLAMA_BASE_URL,
      error: error instanceof Error ? error.message : 'Ollama not running locally',
      models: [],
    });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { action, model = 'qwen2.5:0.5b', prompt, messages } = await req.json();

    if (action === 'pull') {
      // Initiate model download from Ollama registry
      const pullRes = await fetch(`${OLLAMA_BASE_URL}/api/pull`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: model, stream: false }),
      });
      const data = await pullRes.json();
      return NextResponse.json({ success: true, model, result: data });
    }

    if (action === 'chat' || prompt) {
      const chatMessages = messages || [{ role: 'user', content: prompt }];
      const chatRes = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: chatMessages,
          stream: false,
        }),
      });

      if (!chatRes.ok) {
        return NextResponse.json({
          success: false,
          error: `Ollama error: HTTP ${chatRes.status}`,
        });
      }

      const chatData = await chatRes.json();
      return NextResponse.json({
        success: true,
        model,
        message: chatData.message,
        totalDuration: chatData.total_duration,
        evalCount: chatData.eval_count,
        evalDuration: chatData.eval_duration,
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: unknown) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Ollama call failed',
    });
  }
}
