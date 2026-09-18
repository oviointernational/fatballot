import crypto from 'crypto';
import { getSupabase } from './supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

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

type Row = Record<string, any>;

function mapBlock(r: Row): AuditBlock {
  return {
    index: r.idx,
    timestamp: r.timestamp,
    eventType: r.event_type,
    actor: r.actor ?? {},
    details: r.details ?? {},
    previousHash: r.previous_hash,
    hash: r.hash
  };
}

// ---------------------------------------------------------------------------
// Hash-chained audit ledger persisted in public.audit_log (append-only).
// recordEvent keeps its synchronous fire-and-forget signature so no route
// changes are needed: appends are serialized through an in-memory queue,
// guaranteeing per-instance ordering of the hash chain.
// ---------------------------------------------------------------------------

export class AuditLedger {
  private supabase: SupabaseClient;
  private queue: Promise<void> = Promise.resolve();

  constructor() {
    this.supabase = getSupabase();
  }

  // Ensures the genesis block exists (fresh databases). Called once at boot.
  public async init(): Promise<void> {
    const { data, error } = await this.supabase
      .from('audit_log')
      .select('idx')
      .limit(1);
    if (error) throw new Error(`Audit ledger unavailable: ${error.message}. Run supabase/schema.sql on a fresh database.`);
    if ((data ?? []).length > 0) return;

    const timestamp = new Date('2026-09-01T00:00:00.000Z').toISOString();
    const eventType = 'GENESIS_BLOCK';
    const actor: AuditActor = { role: 'SYSTEM', name: 'FatBallot Security Core' };
    const details = { message: 'FatBallot Immutable Audit Ledger initialized with zero-knowledge cryptographic chaining.' };
    const previousHash = '0'.repeat(64);
    const hash = this.calculateHash(0, timestamp, eventType, actor, details, previousHash);

    const { error: insErr } = await this.supabase.from('audit_log').insert({
      idx: 0,
      timestamp,
      event_type: eventType,
      actor,
      details,
      previous_hash: previousHash,
      hash
    });
    if (insErr) throw new Error(`Audit ledger unavailable: ${insErr.message}.`);
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

  private async appendEvent(
    eventType: string,
    actor: AuditActor,
    details: Record<string, any>
  ): Promise<AuditBlock> {
    // Retry on unique-index races (two instances appending simultaneously).
    for (let attempt = 0; attempt < 3; attempt++) {
      const { data: last } = await this.supabase
        .from('audit_log')
        .select('idx, hash')
        .order('idx', { ascending: false })
        .limit(1)
        .maybeSingle();

      const index = last ? last.idx + 1 : 0;
      const timestamp = new Date().toISOString();
      const previousHash = last ? last.hash : '0'.repeat(64);
      const hash = this.calculateHash(index, timestamp, eventType, actor, details, previousHash);

      const { error } = await this.supabase.from('audit_log').insert({
        idx: index,
        timestamp,
        event_type: eventType,
        actor,
        details,
        previous_hash: previousHash,
        hash
      });
      if (!error) {
        return { index, timestamp, eventType, actor, details, previousHash, hash };
      }
      if (error.code !== '23505') {
        throw new Error(`Audit ledger write failed: ${error.message}`);
      }
      // Index taken by a concurrent writer — re-read and retry.
    }
    throw new Error('Audit ledger write failed after retries.');
  }

  public recordEvent(
    eventType: string,
    actor: AuditActor,
    details: Record<string, any> = {}
  ): void {
    this.queue = this.queue
      .then(() => this.appendEvent(eventType, actor, details))
      .then(() => undefined)
      .catch(err => {
        console.error('Audit ledger write failed:', err?.message || err);
      });
  }

  public async getChain(): Promise<AuditBlock[]> {
    const { data, error } = await this.supabase
      .from('audit_log')
      .select('*')
      .order('idx', { ascending: true });
    if (error) throw new Error(`Audit ledger read failed: ${error.message}`);
    return (data ?? []).map(mapBlock);
  }

  public async getUserLogs(raNumber: string): Promise<AuditBlock[]> {
    const { data, error } = await this.supabase
      .from('audit_log')
      .select('*')
      .eq('actor->>raNumber', raNumber)
      .order('idx', { ascending: true });
    if (error) throw new Error(`Audit ledger read failed: ${error.message}`);
    return (data ?? []).map(mapBlock);
  }

  public async getContestantLogs(candidateId: string, raNumber?: string): Promise<AuditBlock[]> {
    // Candidate-scoped entries live in details; fall back to a full scan for
    // RA-linked entries (ledger reads are small and infrequent).
    const { data, error } = await this.supabase
      .from('audit_log')
      .select('*')
      .eq('details->>candidateId', candidateId)
      .order('idx', { ascending: true });
    if (error) throw new Error(`Audit ledger read failed: ${error.message}`);
    const direct = (data ?? []).map(mapBlock);
    if (!raNumber) return direct;

    const chain = await this.getChain();
    const extra = chain.filter(b => {
      if (b.details?.candidateId === candidateId) return false; // already included
      if (b.actor?.raNumber === raNumber) return true;
      if (b.details?.newVoterRA === raNumber) return true;
      if (b.details?.voterRaNumber === raNumber) return true;
      return false;
    });
    return [...direct, ...extra].sort((a, b) => a.index - b.index);
  }

  public async verifyIntegrity(): Promise<VerificationResult> {
    const chain = await this.getChain();
    if (chain.length === 0) {
      return { valid: true, totalBlocks: 0 };
    }

    for (let i = 0; i < chain.length; i++) {
      const block = chain[i];

      if (i > 0) {
        const previousBlock = chain[i - 1];
        if (block.previousHash !== previousBlock.hash) {
          return {
            valid: false,
            totalBlocks: chain.length,
            tamperedBlockIndex: i,
            error: `Block #${i} previousHash does not match Block #${i - 1} hash.`
          };
        }
      } else if (block.previousHash !== '0'.repeat(64)) {
        return {
          valid: false,
          totalBlocks: chain.length,
          tamperedBlockIndex: 0,
          error: 'Genesis block previousHash is invalid.'
        };
      }

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
          totalBlocks: chain.length,
          tamperedBlockIndex: i,
          error: `Block #${i} hash mismatch: computed ${recalculatedHash}, recorded ${block.hash}.`
        };
      }
    }

    return {
      valid: true,
      totalBlocks: chain.length
    };
  }
}

export const auditLedger = new AuditLedger();
