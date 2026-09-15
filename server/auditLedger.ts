import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

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

export class AuditLedger {
  private chain: AuditBlock[] = [];

  constructor() {
    this.ensureDataDir();
    this.loadChain();
    if (this.chain.length === 0) {
      this.createGenesisBlock();
    }
  }

  private ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
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
    const dataString = `${index}:${timestamp}:${eventType}:${JSON.stringify(actor)}:${JSON.stringify(details)}:${previousHash}`;
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

  private loadChain() {
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

  private saveChain() {
    try {
      fs.writeFileSync(LEDGER_FILE, JSON.stringify(this.chain, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to save audit ledger to disk', err);
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
