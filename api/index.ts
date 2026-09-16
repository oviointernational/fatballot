import { Request, Response } from 'express';
import app from '../server/app';
import { db } from '../server/database';
import { auditLedger } from '../server/auditLedger';

// Ensure the Supabase-backed store/ledger are loaded (and seeded when empty)
// before the first request is served on a cold start. Safe no-ops locally
// when no Supabase credentials are configured.
await db.init();
await auditLedger.init();

// Vercel rewrites /api/:path* to /api/index?__path=/api/:path* so that the
// original URL is preserved for Express route matching in this stateless function.
export default function handler(req: Request, res: Response) {
  const originalPath = req.query.__path;
  if (typeof originalPath === 'string' && originalPath) {
    req.url = originalPath;
  }
  app(req, res);
}