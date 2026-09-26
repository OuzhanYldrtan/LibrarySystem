import os from 'node:os';
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import pg, { type PoolClient, type QueryResultRow } from 'pg';

const { Pool } = pg;
pg.types.setTypeParser(1082, (value) => value);

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly pool = new Pool(
    process.env.DATABASE_URL
      ? { connectionString: process.env.DATABASE_URL }
      : {
          host: process.env.PGHOST || '/tmp',
          port: Number(process.env.PGPORT || 5432),
          database: process.env.PGDATABASE || 'library_assistant',
          user: process.env.PGUSER || os.userInfo().username,
        },
  );

  async onModuleInit() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS books (
        id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        title TEXT NOT NULL,
        author TEXT NOT NULL,
        isbn TEXT,
        shelf_code TEXT NOT NULL,
        category TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS book_copies (
        id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
        inventory_code TEXT NOT NULL UNIQUE,
        shelf_code TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS members (
        id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        full_name TEXT NOT NULL UNIQUE,
        email TEXT UNIQUE
      );
      CREATE TABLE IF NOT EXISTS loans (
        id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        book_id INTEGER NOT NULL REFERENCES books(id),
        member_id INTEGER NOT NULL REFERENCES members(id),
        borrowed_at DATE NOT NULL DEFAULT CURRENT_DATE,
        due_at DATE NOT NULL,
        returned_at DATE
      );
      ALTER TABLE members ADD COLUMN IF NOT EXISTS tc_identity_no VARCHAR(11);
      ALTER TABLE members ADD COLUMN IF NOT EXISTS birth_date DATE;
      ALTER TABLE members ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
      ALTER TABLE members ADD COLUMN IF NOT EXISTS address TEXT;
      ALTER TABLE members ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
      ALTER TABLE loans ADD COLUMN IF NOT EXISTS copy_id INTEGER REFERENCES book_copies(id);
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'books_title_key') THEN
          ALTER TABLE books DROP CONSTRAINT books_title_key;
        END IF;
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'books_isbn_key') THEN
          ALTER TABLE books DROP CONSTRAINT books_isbn_key;
        END IF;
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'members_full_name_key') THEN
          ALTER TABLE members DROP CONSTRAINT members_full_name_key;
        END IF;
      END $$;
      INSERT INTO book_copies (book_id, inventory_code, shelf_code)
      SELECT id, 'LEGACY-' || id, shelf_code
      FROM books
      ON CONFLICT (inventory_code) DO NOTHING;
      UPDATE loans l
      SET copy_id = c.id
      FROM book_copies c
      WHERE c.book_id = l.book_id AND c.inventory_code = 'LEGACY-' || l.book_id
        AND l.copy_id IS NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS members_tc_identity_unique
        ON members(tc_identity_no) WHERE tc_identity_no IS NOT NULL;
      DROP INDEX IF EXISTS one_active_loan_per_book;
      CREATE UNIQUE INDEX IF NOT EXISTS one_active_loan_per_copy
        ON loans(copy_id) WHERE returned_at IS NULL;
    `);
  }

  query<T extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = []) {
    return this.pool.query<T>(text, params);
  }

  async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async onModuleDestroy() {
    await this.pool.end();
  }
}
