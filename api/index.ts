import { Request, Response } from 'express';

// TEMPORARY PROBE — zero app imports, cannot crash at module load.
// Verifies: (1) the function executes at all, (2) the __path rewrite arrives.
export default async function handler(req: Request, res: Response) {
  res.status(200).json({
    probe: 'api-alive',
    receivedPath: (req.query as any)?.__path ?? null,
    url: req.url
  });
}