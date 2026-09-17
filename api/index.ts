// TEMPORARY DIAGNOSTIC PROBE (zero runtime imports).
// This entry deliberately imports NOTHING at load time — not even types that
// could survive compilation — so module evaluation cannot fail. It then loads
// the real handler (server/handler.ts) inside try/catch and delegates. Every
// outcome is reported as JSON:
//  - real handler answers            -> normal API JSON (problem fixed)
//  - real handler throws load error  -> 200 JSON describing the exact failure
//  - THIS file itself 500s at platform level -> routing/launcher/config issue,
//    not application code (report the full page text back).
async function handler(req: any, res: any) {
  const report: any = {
    probe: 'fatballot-api-probe-v1',
    node: typeof process !== 'undefined' ? process.version : 'unknown',
    method: req?.method ?? null,
    url: req?.url ?? null,
    query: (req as any)?.query ?? null,
    steps: [] as string[]
  };
  const sendReport = (status: number) => {
    // Raw Node APIs only (statusCode/setHeader/end): Express may never have
    // loaded in this process, so res.status()/res.json() may not exist.
    try {
      if (!res.headersSent) {
        res.statusCode = status;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(report));
      }
    } catch {
      // Give up; platform will answer instead.
    }
  };
  try {
    report.steps.push('probe-enter');
    // Direct fingerprint path: answers WITHOUT loading any server module,
    // so it works even if server code is broken. Proves which deployment
    // is live and that the entry + routing work.
    const q = (req as any)?.query;
    const qp = q?.__path;
    const rawPath =
      typeof qp === 'string' && qp ? qp : String(req?.url ?? '').split('?')[0];
    report.resolvedPath = rawPath;
    if (rawPath === '/api/__probe' || rawPath === '/__probe') {
      report.steps.push('fingerprint-answered');
      sendReport(200);
      return;
    }
    const mod: any = await import('../server/handler');
    report.steps.push('handler-module-loaded');
    let real: any = mod?.default;
    if (real && typeof real === 'object' && typeof real.default === 'function') {
      real = real.default;
    }
    if (typeof real !== 'function' && typeof mod === 'function') real = mod;
    report.realType = typeof real;
    if (typeof real !== 'function') {
      report.realError = 'real handler did not resolve to a callable function';
      sendReport(200);
      return;
    }
    report.steps.push('delegating-to-real-handler');
    await real(req, res);
    report.steps.push('real-handler-returned');
    if (!res.headersSent && !(res as any).writableEnded) {
      report.note = 'real handler returned without answering; probe answering instead';
      sendReport(200);
    }
  } catch (err: any) {
    report.realError = err?.message ? String(err.message) : String(err);
    try {
      report.realStack = err?.stack ? String(err.stack).split('\n').slice(0, 8) : null;
    } catch {
      report.realStack = null;
    }
    sendReport(200);
  }
}

export default handler;

// CJS/ESM interop for the serverless launcher (see server/handler.ts).
declare const module: any;
if (typeof module !== 'undefined' && module.exports) {
  module.exports = handler;
  module.exports.default = handler;
}
