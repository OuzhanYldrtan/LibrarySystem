import { ConflictException, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { CreateBookDto } from './create-book.dto.js';

@Injectable()
export class BooksService {
  constructor(private readonly db: DatabaseService) {}

  async create(dto: CreateBookDto) {
    try {
      return await this.db.transaction(async (client) => {
        let book = await client.query(`SELECT id, title, author, isbn, category FROM books
          WHERE title = $1 AND author = $2 AND isbn IS NOT DISTINCT FROM NULLIF($3, '') AND category = $4
          LIMIT 1`, [dto.title, dto.author, dto.isbn || '', dto.category]);
        if (!book.rows[0]) {
          book = await client.query(`INSERT INTO books (title, author, isbn, shelf_code, category)
            VALUES ($1, $2, NULLIF($3, ''), $4, $5)
            RETURNING id, title, author, isbn, category`,
          [dto.title, dto.author, dto.isbn || '', dto.shelfCode, dto.category]);
        }
        const copy = await client.query(`INSERT INTO book_copies (book_id, inventory_code, shelf_code)
          VALUES ($1, $2, $3) RETURNING id, inventory_code, shelf_code`,
        [book.rows[0].id, dto.inventoryCode, dto.shelfCode]);
        return {
          id: copy.rows[0].id, title: book.rows[0].title, author: book.rows[0].author,
          isbn: book.rows[0].isbn, category: book.rows[0].category,
          inventoryCode: copy.rows[0].inventory_code, shelfCode: copy.rows[0].shelf_code,
          available: true, holder: null, dueAt: null,
        };
      });
    } catch (error: unknown) {
      if (typeof error === 'object' && error && 'code' in error && error.code === '23505') {
        throw new ConflictException('Bu envanter koduyla kayıtlı bir nüsha zaten var.');
      }
      throw error;
    }
  }
}
