import { Request, Response } from 'express';
import app from '../server/app';
import { db } from '../server/database';
import { auditLedger } from '../server/auditLedger';

let initPromise: Promise<void> | null = null;

// Single-flight, idempotent initialization. Runs once per cold start; the
// store/ledger are loaded (and seeded when empty) from Supabase before the
// first request is served. No top-level await so the bundle stays
// CommonJS/ESM-safe under any function builder.
function ensureInitialized(): Promise<void> {
  if (!initPromise) {
    initPromise = Promise.all([db.init(), auditLedger.init()])
      .then(() => {
        console.log(
          `FatBallot cold start OK (supabase: ${
            Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY)
          })`
        );
      })
      .catch(err => {
        // Initialization must never take the function down: log and serve
        // from the local seed so the API always answers (as JSON).
        console.error('FatBallot cold start init failed (serving from seed):', err);
      });
  }
  return initPromise;
}

function sendJsonError(res: Response, status: number, error: string, message: string) {
  try {
    if (!res.headersSent) {
      res.status(status).json({ error, message });
    }
  } catch {
    try {
      if (!res.headersSent) {
        res.status(status).end(JSON.stringify({ error, message }));
      }
    } catch {
      // Last resort: the platform will return its own error page.
    }
  }
}

// Vercel rewrites /api/:path* to /api/index?__path=/api/:path* so that the
// original URL is preserved for Express route matching in this stateless function.
export default async function handler(req: Request, res: Response) {
  try {
    await ensureInitialized();
    const query = (req as any).query;
    const originalPath = query?.__path;
    if (typeof originalPath === 'string' && originalPath) {
      req.url = originalPath;
    }
    await app(req, res);
    // Belt-and-braces: if nothing handled the request, answer JSON, never
    // the platform's default (non-JSON) error page.
    if (!res.headersSent && !res.writableEnded) {
      sendJsonError(res, 404, 'NOT_FOUND', 'Unknown API endpoint.');
    }
  } catch (err: any) {
    console.error('FatBallot handler error:', err);
    sendJsonError(res, 500, 'INTERNAL_SERVER_ERROR', err?.message || String(err));
  }
}
