export type Dashboard = {
  stats: { books: number; members: number; activeLoans: number; available: number };
  overdue: { id: number; title: string; member: string; dueAt: string; overdueDays: number }[];
};

export type Book = {
  id: number; title: string; author: string; isbn?: string; shelfCode: string;
  inventoryCode: string; category: string; available: boolean; holder?: string; dueAt?: string;
};

export type Member = {
  id: number; fullName: string; tcIdentityMasked?: string; birthDate?: string;
  email?: string; phone?: string; address?: string; createdAt: string; activeLoans: number;
};

export type Loan = {
  id: number; title: string; member: string; borrowedAt: string; dueAt: string; overdue: boolean;
};

export type ChatMessage = { role: 'user' | 'assistant'; content: string; toolsUsed?: string[] };
export type Page = 'dashboard' | 'members' | 'circulation' | 'catalog' | 'assistant';
