/**
 * Production seed reset for FatBallot.
 *
 * Rebuilds the store with PRODUCTION data only:
 *  - exactly one Superadmin voter (editable via Admin portal afterwards)
 *  - zero candidates, zero votes, zero agents, zero observers
 *  - structural offices / timeline / screening criteria / settings preserved
 *
 * Targets:
 *  1. Local disk store  (server/data/store.json) — always reset.
 *  2. Supabase `app_store` blob (key 'store') — reset when SUPABASE_URL +
 *     SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY) are present.
 *  3. Fresh genesis audit ledger — written locally and remotely unless
 *     --keep-ledger is passed (a launch reset SHOULD renew the ledger so no
 *     demo-era events linger in production).
 *
 * Superadmin identity comes from the environment (overrides the placeholder):
 *   SUPERADMIN_RA, SUPERADMIN_EMAIL, SUPERADMIN_FIRST_NAME, SUPERADMIN_LAST_NAME
 *
 * Usage:
 *   npx tsx scripts/seed-production.ts [--keep-ledger]
 *   SUPERADMIN_EMAIL=you@example.com npx tsx scripts/seed-production.ts
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import {
  initialSettings,
  initialOffices,
  initialTimeline,
  initialYCEC,
  initialScreeningCriteria,
  initialVoters
} from '../server/mockData';

const KEEP_LEDGER = process.argv.includes('--keep-ledger');

function stableStringify(obj: any): string {
  if (obj === null || obj === undefined) return 'null';
  if (typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) return `[${obj.map(stableStringify).join(',')}]`;
  const sorted = Object.keys(obj).sort().map(k => `${JSON.stringify(k)}:${stableStringify(obj[k])}`);
  return `{${sorted.join(',')}}`;
}

function buildSuperadmin() {
  const base = initialVoters[0];
  const ra = (process.env.SUPERADMIN_RA || base.raNumber).replace(/^RA-?/i, '').trim() || base.raNumber;
  return {
    ...base,
    raNumber: ra,
    email: (process.env.SUPERADMIN_EMAIL || base.email).trim().toLowerCase(),
    firstName: (process.env.SUPERADMIN_FIRST_NAME || base.firstName).trim() || base.firstName,
    lastName: (process.env.SUPERADMIN_LAST_NAME || base.lastName).trim() || base.lastName,
    role: 'superadmin' as const,
    isAccredited: true,
    registeredAt: base.registeredAt
  };
}

function buildStore() {
  return {
    settings: { ...initialSettings },
    offices: [...initialOffices],
    candidates: [],
    voters: [buildSuperadmin()],
    timeline: [...initialTimeline],
    ycec: [...initialYCEC],
    votes: [],
    sessions: [],
    magicLinks: [],
    screeningCriteria: [...initialScreeningCriteria],
    candidateScreenings: [],
    agents: [],
    observers: []
  };
}

function buildGenesisLedger() {
  const timestamp = new Date('2026-09-01T00:00:00.000Z').toISOString();
  const eventType = 'GENESIS_BLOCK';
  const actor = { role: 'SYSTEM', name: 'FatBallot Security Core' };
  const details = { message: 'FatBallot Immutable Audit Ledger initialized with zero-knowledge cryptographic chaining.' };
  const previousHash = '0'.repeat(64);
  const dataString = `0:${timestamp}:${eventType}:${stableStringify(actor)}:${stableStringify(details)}:${previousHash}`;
  const hash = crypto.createHash('sha256').update(dataString).digest('hex');
  return [{ index: 0, timestamp, eventType, actor, details, previousHash, hash }];
}

async function main() {
  const store = buildStore();
  console.log(`Superadmin: RA-${store.voters[0].raNumber} <${store.voters[0].email}> ${store.voters[0].firstName} ${store.voters[0].lastName}`);

  // 1. Local disk store
  const dataDir = path.join(process.cwd(), 'server', 'data');
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(path.join(dataDir, 'store.json'), JSON.stringify(store, null, 2), 'utf-8');
  console.log('✔ Local server/data/store.json reset (production seed).');

  if (!KEEP_LEDGER) {
    const ledger = buildGenesisLedger();
    fs.writeFileSync(path.join(dataDir, 'audit_ledger.json'), JSON.stringify(ledger, null, 2), 'utf-8');
    console.log('✔ Local audit ledger renewed (genesis only).');
  } else {
    console.log('○ Ledger kept (--keep-ledger).');
  }

  // 2 + 3. Supabase remote blobs
  const url = process.env.SUPABASE_URL || 'https://gavjqssxqfzbpniammrm.supabase.co';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
  if (!key) {
    console.log('○ No Supabase key in env — remote store untouched. Set SUPABASE_SERVICE_ROLE_KEY to reset production data.');
    return;
  }
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const { error: storeErr } = await supabase
    .from('app_store')
    .upsert({ key: 'store', data: store, updated_at: new Date().toISOString() });
  if (storeErr) throw new Error(`Remote store reset failed: ${storeErr.message}`);
  console.log('✔ Remote Supabase store reset (production seed).');

  if (!KEEP_LEDGER) {
    const ledger = buildGenesisLedger();
    const { error: ledgerErr } = await supabase
      .from('app_store')
      .upsert({ key: 'ledger', data: ledger, updated_at: new Date().toISOString() });
    if (ledgerErr) throw new Error(`Remote ledger reset failed: ${ledgerErr.message}`);
    console.log('✔ Remote audit ledger renewed (genesis only).');
  }
}

main().catch(err => {
  console.error(err.message || err);
  process.exit(1);
});
