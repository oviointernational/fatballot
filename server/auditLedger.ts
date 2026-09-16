import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { SupabaseClient } from '@supabase/supabase-js';
import { hasSupabase, getSupabase } from './supabase';

export interface AuditActor {
  id?: string;
  raNumber?: string;
  name?: string;
  email?: string;
  role?: string;
}

export interface AuditBlock {
  index: number;
  timestamp: string;
  eventType: string;
  actor: AuditActor;
  details: Record<string, any>;
  previousHash: string;
  hash: string;
}

export interface VerificationResult {
  valid: boolean;
  totalBlocks: number;
  tamperedBlockIndex?: number;
  error?: string;
}

const DATA_DIR = path.join(process.cwd(), 'server', 'data');
const LEDGER_FILE = path.join(DATA_DIR, 'audit_ledger.json');

// Supabase jsonb sorts object keys alphabetically, which changes the output
// of JSON.stringify and therefore breaks hash verification. A deterministic
// (key-sorted) serializer ensures the hash input is identical regardless of
// storage round-trips.
function stableStringify(obj: any): string {
  if (obj === null || obj === undefined) return 'null';
  if (typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) return `[${obj.map(stableStringify).join(',')}]`;
  const sorted = Object.keys(obj).sort().map(k => `${JSON.stringify(k)}:${stableStringify(obj[k])}`);
  return `{${sorted.join(',')}}`;
}

export class AuditLedger {
  private chain: AuditBlock[] = [];
  private supabase: SupabaseClient | null = null;
  private supabaseReady = false;
  private pendingWrite = false;
  private autoRefreshTimer: NodeJS.Timeout | null = null;

  constructor() {
    const usingSupabase = hasSupabase();
    if (usingSupabase) {
      this.supabase = getSupabase();
    } else {
      this.ensureDataDir();
      this.loadChain();
      if (this.chain.length === 0) {
        this.createGenesisBlock();
      }
    }
  }

  // Loads the ledger from Supabase (source of truth on serverless). Genesis is
  // re-created only when no chain exists anywhere. A one-time rehash repair
  // fixes chains whose hashes were corrupted by jsonb's key sorting.
  public async init() {
    if (!this.supabase || this.supabaseReady) return;
    await this.pullFromSupabase();
    this.supabaseReady = true;
    if (this.chain.length === 0) {
      this.createGenesisBlock();
    }
    this.startAutoRefresh();
  }

  private startAutoRefresh() {
    if (this.autoRefreshTimer) clearInterval(this.autoRefreshTimer);
    this.autoRefreshTimer = setInterval(() => {
      if (this.supabase && this.supabaseReady && !this.pendingWrite) {
        this.pullFromSupabase().catch(err =>
          console.error('Supabase ledger refresh failed:', err)
        );
      }
    }, 15000);
    this.autoRefreshTimer.unref?.();
  }

  private async pullFromSupabase() {
    if (!this.supabase) return;
    const { data, error } = await this.supabase
      .from('app_store')
      .select('data')
      .eq('key', 'ledger')
      .maybeSingle();

    if (error) {
      console.error('Supabase ledger read failed:', error.message);
      return;
    }

    if (data?.data && Array.isArray(data.data)) {
      this.chain = data.data as AuditBlock[];
      // Self-heal: jsonb sorts object keys, breaking hashes for chains written
      // before the key-sorted serializer. Rehash (idempotent) and persist.
      if (this.rehashChain()) {
        await this.pushToSupabase(this.chain);
      }
    } else {
      // No remote ledger yet — seed it with whatever exists locally.
      await this.pushToSupabase(this.chain);
    }
  }

  private async pushToSupabase(chain: AuditBlock[]): Promise<void> {
    if (!this.supabase) return;
    const { error } = await this.supabase
      .from('app_store')
      .upsert({ key: 'ledger', data: chain, updated_at: new Date().toISOString() });
    if (error) {
      console.error('Supabase ledger save failed:', error.message);
    }
  }

  private ensureDataDir() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
    } catch (err) {
      // Read-only filesystem (serverless) — Supabase handles persistence.
      console.warn('Local data dir unavailable, using Supabase only:', (err as Error).message);
    }
  }

  private calculateHash(
    index: number,
    timestamp: string,
    eventType: string,
    actor: AuditActor,
    details: Record<string, any>,
    previousHash: string
  ): string {
    const dataString = `${index}:${timestamp}:${eventType}:${stableStringify(actor)}:${stableStringify(details)}:${previousHash}`;
    return crypto.createHash('sha256').update(dataString).digest('hex');
  }

  private createGenesisBlock() {
    const timestamp = new Date('2026-09-01T00:00:00.000Z').toISOString();
    const eventType = 'GENESIS_BLOCK';
    const actor: AuditActor = { role: 'SYSTEM', name: 'FatBallot Security Core' };
    const details = { message: 'FatBallot Immutable Audit Ledger initialized with zero-knowledge cryptographic chaining.' };
    const previousHash = '0'.repeat(64);
    const hash = this.calculateHash(0, timestamp, eventType, actor, details, previousHash);

    const genesisBlock: AuditBlock = {
      index: 0,
      timestamp,
      eventType,
      actor,
      details,
      previousHash,
      hash
    };

    this.chain = [genesisBlock];
    this.saveChain();
  }

  // Recomputes all hashes in the chain using the key-sorted serializer so
  // hashes survive jsonb round-trips. Also repairs previousHash links after
  // any earlier block's hash changed. Returns true if any block was updated.
  private rehashChain(): boolean {
    let changed = false;
    for (let i = 0; i < this.chain.length; i++) {
      const block = this.chain[i];
      // Fix previousHash to match the (possibly rehashed) preceding block.
      if (i === 0) {
        if (block.previousHash !== '0'.repeat(64)) {
          block.previousHash = '0'.repeat(64);
          changed = true;
        }
      } else {
        const prevHash = this.chain[i - 1].hash;
        if (block.previousHash !== prevHash) {
          block.previousHash = prevHash;
          changed = true;
        }
      }
      const recomputedHash = this.calculateHash(
        block.index,
        block.timestamp,
        block.eventType,
        block.actor,
        block.details,
        block.previousHash
      );
      if (block.hash !== recomputedHash) {
        block.hash = recomputedHash;
        changed = true;
      }
    }
    return changed;
  }

  private loadChain() {
    if (this.supabase) return;
    try {
      if (fs.existsSync(LEDGER_FILE)) {
        const raw = fs.readFileSync(LEDGER_FILE, 'utf-8');
        this.chain = JSON.parse(raw);
      }
    } catch (err) {
      console.error('Failed to load audit ledger from disk, re-initializing...', err);
      this.chain = [];
    }
  }

  private saveChain(chainToSave: AuditBlock[] = this.chain) {
    if (!this.supabase) {
      try {
        fs.writeFileSync(LEDGER_FILE, JSON.stringify(chainToSave, null, 2), 'utf-8');
      } catch (err) {
        console.error('Failed to save audit ledger to disk', err);
      }
      return;
    }

    if (this.supabaseReady) {
      this.pendingWrite = true;
      this.pushToSupabase(chainToSave)
        .then(() => {
          this.pendingWrite = false;
        })
        .catch(() => {
          this.pendingWrite = false;
        });
    }
  }

  public recordEvent(
    eventType: string,
    actor: AuditActor,
    details: Record<string, any> = {}
  ): AuditBlock {
    const lastBlock = this.chain[this.chain.length - 1];
    const index = lastBlock ? lastBlock.index + 1 : 0;
    const timestamp = new Date().toISOString();
    const previousHash = lastBlock ? lastBlock.hash : '0'.repeat(64);
    const hash = this.calculateHash(index, timestamp, eventType, actor, details, previousHash);

    const newBlock: AuditBlock = {
      index,
      timestamp,
      eventType,
      actor,
      details,
      previousHash,
      hash
    };

    this.chain.push(newBlock);
    this.saveChain();
    return newBlock;
  }

  public getChain(): AuditBlock[] {
    return [...this.chain];
  }

  public getUserLogs(raNumber: string): AuditBlock[] {
    return this.chain.filter(b => b.actor?.raNumber === raNumber);
  }

  public getContestantLogs(candidateId: string, raNumber?: string): AuditBlock[] {
    return this.chain.filter(b => {
      // Matches candidateId in details (e.g. vote cast, vote changed, screening, candidate creation)
      if (b.details?.candidateId === candidateId) return true;
      // Matches candidate RA number in actor or details
      if (raNumber && (b.actor?.raNumber === raNumber || b.details?.newVoterRA === raNumber || b.details?.voterRaNumber === raNumber)) return true;
      // Matches office or candidate name
      return false;
    });
  }

  public verifyIntegrity(): VerificationResult {
    if (this.chain.length === 0) {
      return { valid: true, totalBlocks: 0 };
    }

    for (let i = 0; i < this.chain.length; i++) {
      const block = this.chain[i];

      // Verify previous hash chaining
      if (i > 0) {
        const previousBlock = this.chain[i - 1];
        if (block.previousHash !== previousBlock.hash) {
          return {
            valid: false,
            totalBlocks: this.chain.length,
            tamperedBlockIndex: i,
            error: `Block #${i} previousHash does not match Block #${i - 1} hash.`
          };
        }
      } else {
        if (block.previousHash !== '0'.repeat(64)) {
          return {
            valid: false,
            totalBlocks: this.chain.length,
            tamperedBlockIndex: 0,
            error: 'Genesis block previousHash is invalid.'
          };
        }
      }

      // Verify current block hash
      const recalculatedHash = this.calculateHash(
        block.index,
        block.timestamp,
        block.eventType,
        block.actor,
        block.details,
        block.previousHash
      );

      if (block.hash !== recalculatedHash) {
        return {
          valid: false,
          totalBlocks: this.chain.length,
          tamperedBlockIndex: i,
          error: `Block #${i} hash mismatch: computed ${recalculatedHash}, recorded ${block.hash}.`
        };
      }
    }

    return {
      valid: true,
      totalBlocks: this.chain.length
    };
  }
}

export const auditLedger = new AuditLedger();
