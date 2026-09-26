import os from 'node:os';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import pg from 'pg';
import { z } from 'zod';

const { Pool } = pg;
pg.types.setTypeParser(1082, (value) => value);
const pool = new Pool(
  process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : {
        host: process.env.PGHOST || '/tmp',
        port: Number(process.env.PGPORT || 5432),
        database: process.env.PGDATABASE || 'library_assistant',
        user: process.env.PGUSER || os.userInfo().username,
      },
);

const server = new McpServer(
  { name: 'raf-library-mcp', version: '1.0.0' },
  {
    instructions:
      'Kütüphane kataloğu, müsaitlik ve aktif ödünç kayıtları için salt-okunur araçlar. TC kimlik, doğum tarihi, e-posta, telefon ve adres hiçbir araçta paylaşılmaz.',
  },
);

server.registerTool(
  'search_books',
  {
    description: 'Başlık veya yazar adına göre kitap ara; raf ve müsaitlik durumunu döndürür.',
    inputSchema: z.object({
      query: z.string().min(1).describe('Kitap başlığı veya yazar adı'),
      availableOnly: z.boolean().optional().default(false),
    }),
  },
  async ({ query, availableOnly }) => {
    const result = await pool.query(
      `SELECT b.title, b.author, c.shelf_code, c.inventory_code, b.category,
              m.full_name AS holder, l.due_at
       FROM book_copies c JOIN books b ON b.id = c.book_id
       LEFT JOIN loans l ON l.copy_id = c.id AND l.returned_at IS NULL
       LEFT JOIN members m ON m.id = l.member_id
       WHERE (b.title ILIKE $1 OR b.author ILIKE $1)
         AND ($2::boolean = false OR l.id IS NULL)
       ORDER BY b.title LIMIT 12`,
      [`%${query}%`, availableOnly],
    );
    return {
      content: [{ type: 'text', text: JSON.stringify(result.rows) }],
      structuredContent: { books: result.rows },
    };
  },
);

server.registerTool(
  'get_book_status',
  {
    description: 'Belirli bir kitabın rafını, müsaitliğini ve ödünçteyse kimde olduğunu getirir.',
    inputSchema: z.object({ title: z.string().min(1).describe('Kitabın adı') }),
  },
  async ({ title }) => {
    const result = await pool.query(
      `SELECT b.title, b.author, c.shelf_code, c.inventory_code, b.category,
              (l.id IS NULL) AS available, m.full_name AS holder, l.due_at
       FROM book_copies c JOIN books b ON b.id = c.book_id
       LEFT JOIN loans l ON l.copy_id = c.id AND l.returned_at IS NULL
       LEFT JOIN members m ON m.id = l.member_id
       WHERE b.title ILIKE $1
       ORDER BY b.title, c.inventory_code
       LIMIT 5`,
      [`%${title}%`],
    );
    return {
      content: [{ type: 'text', text: JSON.stringify(result.rows) }],
      structuredContent: { matches: result.rows },
    };
  },
);

server.registerTool(
  'get_member_loans',
  {
    description: 'Üyenin yalnızca adıyla aktif ödünç kitaplarını ve teslim tarihlerini getirir; hassas kimlik verilerini döndürmez.',
    inputSchema: z.object({ memberName: z.string().min(2).describe('Üyenin adı ve soyadı') }),
  },
  async ({ memberName }) => {
    const result = await pool.query(
      `SELECT m.full_name, b.title, b.author, l.borrowed_at, l.due_at
       FROM members m
       JOIN loans l ON l.member_id = m.id AND l.returned_at IS NULL
       JOIN books b ON b.id = l.book_id
       WHERE m.full_name ILIKE $1 ORDER BY l.due_at`,
      [`%${memberName}%`],
    );
    return {
      content: [{ type: 'text', text: JSON.stringify(result.rows) }],
      structuredContent: { loans: result.rows },
    };
  },
);

server.registerTool(
  'list_overdue_loans',
  {
    description: 'Teslim tarihi geçmiş aktif ödünç kayıtlarını üye adı ve kitapla listeler.',
    inputSchema: z.object({}),
  },
  async () => {
    const result = await pool.query(
      `SELECT b.title, m.full_name, l.due_at, CURRENT_DATE - l.due_at AS overdue_days
       FROM loans l JOIN books b ON b.id = l.book_id
       JOIN members m ON m.id = l.member_id
       WHERE l.returned_at IS NULL AND l.due_at < CURRENT_DATE
       ORDER BY l.due_at`,
    );
    return {
      content: [{ type: 'text', text: JSON.stringify(result.rows) }],
      structuredContent: { overdueLoans: result.rows },
    };
  },
);

server.registerTool(
  'list_available_books',
  {
    description: 'Şu anda rafta bulunan müsait kitapları kategori seçeneğiyle listeler.',
    inputSchema: z.object({ category: z.string().optional().describe('İsteğe bağlı kategori') }),
  },
  async ({ category }) => {
    const result = await pool.query(
      `SELECT b.title, b.author, c.shelf_code, c.inventory_code, b.category
       FROM book_copies c JOIN books b ON b.id = c.book_id
       WHERE NOT EXISTS (SELECT 1 FROM loans l WHERE l.copy_id = c.id AND l.returned_at IS NULL)
         AND ($1::text IS NULL OR b.category ILIKE $1)
       ORDER BY b.title LIMIT 30`,
      [category ? `%${category}%` : null],
    );
    return {
      content: [{ type: 'text', text: JSON.stringify(result.rows) }],
      structuredContent: { books: result.rows },
    };
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Raf Library MCP server running on stdio');
}

main().catch((error) => {
  console.error('MCP server failed', error);
  process.exit(1);
});
