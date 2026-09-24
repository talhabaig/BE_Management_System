import type { VercelRequest, VercelResponse } from '@vercel/node';

let cachedApp: ((req: VercelRequest, res: VercelResponse) => unknown) | null = null;

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    if (!cachedApp) {
      const loaded = await import('../src/app');
      cachedApp = loaded.app as unknown as (req: VercelRequest, res: VercelResponse) => unknown;
    }
    cachedApp(req, res);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown startup error';
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        success: false,
        error: {
          code: 'FUNCTION_STARTUP_ERROR',
          message,
        },
      }),
    );
  }
}
