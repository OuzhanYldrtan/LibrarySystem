import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { CreateLoanDto } from './loan.dto.js';

@Injectable()
export class LoansService {
  constructor(private readonly db: DatabaseService) {}

  async list() {
    const result = await this.db.query(`SELECT l.id, b.title, m.full_name,
      l.borrowed_at, l.due_at, (l.due_at < CURRENT_DATE) AS overdue
      FROM loans l JOIN books b ON b.id = l.book_id
      JOIN members m ON m.id = l.member_id
      WHERE l.returned_at IS NULL ORDER BY l.due_at, b.title`);
    return result.rows.map((loan) => ({
      id: loan.id, title: loan.title, member: loan.full_name,
      borrowedAt: loan.borrowed_at, dueAt: loan.due_at, overdue: loan.overdue,
    }));
  }

  async create(dto: CreateLoanDto) {
    if (dto.dueAt <= this.todayInTurkey()) {
      throw new BadRequestException('Teslim tarihi bugünden sonra olmalıdır.');
    }
    try {
      return await this.db.transaction(async (client) => {
        const book = await client.query(`SELECT c.id, c.book_id, b.title
          FROM book_copies c JOIN books b ON b.id = c.book_id WHERE c.id = $1 FOR UPDATE`, [dto.bookId]);
        const member = await client.query('SELECT id, full_name FROM members WHERE id = $1', [dto.memberId]);
        if (!book.rows[0] || !member.rows[0]) throw new NotFoundException('Kitap veya üye bulunamadı.');
        const active = await client.query('SELECT 1 FROM loans WHERE copy_id = $1 AND returned_at IS NULL', [dto.bookId]);
        if (active.rowCount) throw new ConflictException('Bu kitap şu anda başka bir üyede.');
        const loan = await client.query(`INSERT INTO loans (book_id, copy_id, member_id, due_at)
          VALUES ($1, $2, $3, $4) RETURNING id, borrowed_at, due_at`,
        [book.rows[0].book_id, dto.bookId, dto.memberId, dto.dueAt]);
        return {
          id: loan.rows[0].id, title: book.rows[0].title, member: member.rows[0].full_name,
          borrowedAt: loan.rows[0].borrowed_at, dueAt: loan.rows[0].due_at,
        };
      });
    } catch (error: unknown) {
      if (typeof error === 'object' && error && 'code' in error && error.code === '23505') {
        throw new ConflictException('Bu kitap şu anda başka bir üyede.');
      }
      throw error;
    }
  }

  async returnLoan(id: number) {
    const result = await this.db.query(`UPDATE loans SET returned_at = CURRENT_DATE
      WHERE id = $1 AND returned_at IS NULL RETURNING id`, [id]);
    if (!result.rowCount) throw new NotFoundException('Aktif ödünç kaydı bulunamadı.');
    return { message: 'Kitap başarıyla iade alındı.' };
  }

  private todayInTurkey() {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(new Date());
    const value = (type: string) => parts.find((part) => part.type === type)?.value;
    return `${value('year')}-${value('month')}-${value('day')}`;
  }
}
