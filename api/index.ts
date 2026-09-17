import { Request, Response } from 'express';

// NOTE: server modules are loaded LAZILY (dynamic import) inside the handler
// rather than via static imports. If a server module fails to load in the
// serverless runtime, a static import would crash the function before any of
// our code runs and the platform would answer with its opaque non-JSON
// "function failed" page. Dynamic import keeps module evaluation inside our
// try/catch so the real error is returned as JSON and visible in the browser.
type ServerModules = {
  app: (req: any, res: any) => unknown;
  db: {
    init: () => Promise<void>;
  };
  auditLedger: {
    init: () => Promise<void>;
  };
};

let modulesPromise: Promise<ServerModules> | null = null;
let initPromise: Promise<void> | null = null;

function loadServerModules(): Promise<ServerModules> {
  if (!modulesPromise) {
    modulesPromise = Promise.all([
      import('../server/app'),
      import('../server/database'),
      import('../server/auditLedger')
    ]).then(([appMod, dbMod, ledgerMod]) => ({
      app: interopDefault(appMod),
      db: dbMod.db,
      auditLedger: ledgerMod.auditLedger
    }));
  }
  return modulesPromise;
}

/**
 * Unwraps CJS/ESM double-wrapped default exports. Depending on how the
 * runtime compiles/bundles TypeScript (package has no "type": "module", so
 * output is often CJS), `mod.default` can itself be `{ default: fn }`
 * instead of the export. Named exports (db, auditLedger) are unaffected.
 */
function interopDefault<T>(mod: any): T {
  const direct = mod?.default ?? mod;
  if (direct && typeof direct === 'object' && typeof direct.default === 'function') {
    return direct.default as T;
  }
  return direct as T;
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
async function handler(req: Request, res: Response) {
  try {
    // Single-flight, idempotent initialization. Runs once per cold start; the
    // store/ledger are loaded (and seeded when empty) from Supabase before the
    // first request is served.
    if (!initPromise) {
      initPromise = loadServerModules()
        .then(({ db, auditLedger }) => Promise.all([db.init(), auditLedger.init()]).then(() => undefined))
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
    await initPromise;

    const { app } = await loadServerModules();
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
    sendJsonError(
      res,
      500,
      'INTERNAL_SERVER_ERROR',
      err?.message ? `${err.message}` : String(err)
    );
  }
}

export default handler;

// CJS/ESM interop for the serverless launcher: this package has no
// "type": "module", so TypeScript output is CommonJS and some runtimes
// resolve the entry via require() (or read `.default` off the CJS namespace,
// yielding `{ default: fn }` instead of the function). Assigning the handler
// directly covers every loader: require() -> fn, require().default -> fn,
// ESM default import -> fn.
declare const module: any;
if (typeof module !== 'undefined' && module.exports) {
  module.exports = handler;
  module.exports.default = handler;
}
