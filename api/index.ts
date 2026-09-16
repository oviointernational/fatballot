import { Request, Response } from 'express';
import app from '../server/app';
import { db } from '../server/database';
import { auditLedger } from '../server/auditLedger';

// Ensure the Supabase-backed store/ledger are loaded (and seeded when empty)
// before the first request is served on a cold start. Safe no-ops locally
// when no Supabase credentials are configured.
try {
  await Promise.all([db.init(), auditLedger.init()]);
  console.log(
    `FatBallot cold start OK (supabase: ${
      Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY)
    })`
  );
} catch (err) {
  console.error('FatBallot cold start init failed:', err);
}

// Vercel rewrites /api/:path* to /api/index?__path=/api/:path* so that the
// original URL is preserved for Express route matching in this stateless function.
export default async function handler(req: Request, res: Response) {
  try {
    const originalPath = req.query.__path;
    if (typeof originalPath === 'string' && originalPath) {
      req.url = originalPath;
    }
    await app(req, res);
  } catch (err: any) {
    console.error('FatBallot handler error:', err);
    res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: err?.message || String(err)
    });
  }
}