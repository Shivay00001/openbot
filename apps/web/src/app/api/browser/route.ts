import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { url, action = 'navigate' } = await req.json();

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    const targetUrl = url.startsWith('http') ? url : `https://${url}`;
    const startTime = Date.now();

    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36 OpenBot/1.0',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(15000),
    });

    const html = await response.text();
    const durationMs = Date.now() - startTime;

    // Extract real title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : new URL(targetUrl).hostname;

    // Extract real meta description
    const metaMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i);
    const description = metaMatch ? metaMatch[1].trim() : '';

    // Extract links
    const linkMatches = [...html.matchAll(/<a[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi)];
    const links = linkMatches
      .map((m) => {
        const href = m[1];
        const text = m[2].replace(/<[^>]+>/g, '').trim();
        let fullHref = href;
        try {
          fullHref = new URL(href, targetUrl).href;
        } catch {
          // ignore
        }
        return { href: fullHref, text: text || fullHref };
      })
      .filter((l) => l.text && l.href.startsWith('http'))
      .slice(0, 25);

    // Extract clean readable text
    let cleanText = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
      .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, ' ')
      .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, ' ')
      .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, ' ')
      .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (cleanText.length > 12000) {
      cleanText = cleanText.substring(0, 12000) + '... [truncated]';
    }

    return NextResponse.json({
      success: true,
      url: targetUrl,
      status: response.status,
      title,
      description,
      durationMs,
      wordCount: cleanText.split(/\s+/).length,
      links,
      content: cleanText,
    });
  } catch (error: unknown) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Browser request failed',
    });
  }
}
