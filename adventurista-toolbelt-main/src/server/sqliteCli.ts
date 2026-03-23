import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

function escapeSqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function toSqlLiteral(value: unknown): string {
  if (value === null || typeof value === 'undefined') return 'NULL';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL';
  if (typeof value === 'boolean') return value ? '1' : '0';
  if (typeof value === 'string') return escapeSqlString(value);
  return escapeSqlString(JSON.stringify(value));
}

function runSqlite3(args: string[], options: { input?: string; encoding?: 'utf8' } = {}) {
  try {
    return execFileSync('sqlite3', args, options);
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      throw new Error('The multiplayer host requires the sqlite3 command line tool, but it was not found on PATH. Install SQLite and make sure the sqlite3 executable is available in your terminal.');
    }

    throw error;
  }
}

export class SqliteCliDatabase {
  constructor(private readonly dbPath: string) {
    mkdirSync(dirname(dbPath), { recursive: true });
  }

  exec(sql: string): void {
    runSqlite3([this.dbPath], { input: sql });
  }

  query<T>(sql: string): T[] {
    const output = runSqlite3(['-json', this.dbPath, sql], { encoding: 'utf8' });
    return output.trim() ? JSON.parse(output) as T[] : [];
  }

  value<T>(sql: string): T | null {
    const rows = this.query<Record<string, T>>(sql);
    if (!rows.length) return null;
    return Object.values(rows[0])[0] ?? null;
  }

  static literal(value: unknown): string {
    return toSqlLiteral(value);
  }
}
