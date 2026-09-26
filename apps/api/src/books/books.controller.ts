import { Body, Controller, Get, Post } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { CreateBookDto } from './create-book.dto.js';
import { BooksService } from './books.service.js';

@Controller('books')
export class BooksController {
  constructor(private readonly db: DatabaseService, private readonly books: BooksService) {}

  @Get()
  async list() {
    const result = await this.db.query(`SELECT c.id, b.title, b.author, b.isbn,
      c.inventory_code, c.shelf_code, b.category, m.full_name AS holder, l.due_at
      FROM book_copies c JOIN books b ON b.id = c.book_id
      LEFT JOIN loans l ON l.copy_id = c.id AND l.returned_at IS NULL
      LEFT JOIN members m ON m.id = l.member_id
      ORDER BY b.title, c.inventory_code`);
    return result.rows.map((book) => ({
      id: book.id, title: book.title, author: book.author, isbn: book.isbn, inventoryCode: book.inventory_code,
      shelfCode: book.shelf_code, category: book.category,
      available: !book.holder, holder: book.holder, dueAt: book.due_at,
    }));
  }

  @Post()
  create(@Body() dto: CreateBookDto) { return this.books.create(dto); }
}
