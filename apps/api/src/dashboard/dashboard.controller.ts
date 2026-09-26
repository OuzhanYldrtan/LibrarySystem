import { Controller, Get } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly db: DatabaseService) {}

  @Get()
  async overview() {
    const [stats, overdue] = await Promise.all([
      this.db.query<{
        books: number; members: number; active_loans: number; available: number;
      }>(`SELECT
          (SELECT COUNT(*)::int FROM book_copies) AS books,
          (SELECT COUNT(*)::int FROM members) AS members,
          (SELECT COUNT(*)::int FROM loans WHERE returned_at IS NULL) AS active_loans,
          (SELECT COUNT(*)::int FROM book_copies c WHERE NOT EXISTS (
            SELECT 1 FROM loans l WHERE l.copy_id = c.id AND l.returned_at IS NULL
          )) AS available`),
      this.db.query(`SELECT l.id, b.title, m.full_name, l.due_at,
          (CURRENT_DATE - l.due_at)::int AS overdue_days
        FROM loans l JOIN books b ON b.id = l.book_id
        JOIN members m ON m.id = l.member_id
        WHERE l.returned_at IS NULL AND l.due_at < CURRENT_DATE
        ORDER BY l.due_at LIMIT 6`),
    ]);
    const row = stats.rows[0];
    return {
      stats: { books: row.books, members: row.members, activeLoans: row.active_loans, available: row.available },
      overdue: overdue.rows.map((item) => ({
        id: item.id, title: item.title, member: item.full_name,
        dueAt: item.due_at, overdueDays: item.overdue_days,
      })),
    };
  }
}
