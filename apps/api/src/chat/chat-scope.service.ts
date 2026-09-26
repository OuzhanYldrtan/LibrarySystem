import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { ChatDto } from './chat.dto.js';

export type ChatScope = 'library' | 'sensitive' | 'out_of_scope';

type ScopeEntity = { value: string };

const LIBRARY_TERMS = /\b(kutuphane|kitap|kitabi|kitaplar|eser|yazar|katalog|raf|isbn|uye|uyeler|okur|odunc|iade|teslim|geciken|gecikmis|musait|mevcut|roman|hikaye|siir|kategori|kimde|rafta)\b/u;
const SENSITIVE_TERMS = /\b(tc|kimlik|dogum tarihi|telefon|e-?posta|email|adres)\b/u;
const FOLLOW_UP_TERMS = /^(peki|ya |o |onu|onda|onun|bu |bunu|bunda|bunun|diger|baska|ayni)/u;
const STOP_WORDS = new Set([
  'acaba', 'bana', 'bir', 'bu', 'da', 'de', 'hangi', 'ile', 'icin', 'mi', 'mı', 'mu', 'mü',
  'ne', 'nerede', 'olan', 'su', 'şu', 'var', 've', 'ya', 'simdi', 'şimdi',
]);

function normalize(value: string) {
  return value
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/ı/g, 'i')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function tokens(value: string) {
  return normalize(value)
    .split(/\s+/u)
    .filter((token) => token.length >= 2 && !STOP_WORDS.has(token));
}

function mentionsKnownEntity(message: string, entities: ScopeEntity[]) {
  const normalizedMessage = normalize(message);
  const messageTokens = new Set(tokens(message));

  return entities.some(({ value }) => {
    const normalizedEntity = normalize(value);
    if (normalizedEntity.length >= 4 && normalizedMessage.includes(normalizedEntity)) return true;

    const entityTokens = tokens(value);
    if (!entityTokens.length) return false;
    const overlap = entityTokens.filter((token) => messageTokens.has(token));
    return entityTokens.length === 1
      ? overlap.length === 1 && entityTokens[0].length >= 4
      : overlap.length >= 2;
  });
}

@Injectable()
export class ChatScopeService {
  constructor(private readonly db: DatabaseService) {}

  async classify(dto: ChatDto): Promise<ChatScope> {
    const message = normalize(dto.message);
    if (SENSITIVE_TERMS.test(message)) return 'sensitive';
    if (LIBRARY_TERMS.test(message)) return 'library';

    const result = await this.db.query<ScopeEntity>(`
      SELECT title AS value FROM books
      UNION SELECT author AS value FROM books
      UNION SELECT category AS value FROM books
      UNION SELECT full_name AS value FROM members
    `);
    if (mentionsKnownEntity(dto.message, result.rows)) return 'library';

    if (FOLLOW_UP_TERMS.test(message)) {
      const recentContext = (dto.history || []).slice(-4).map((item) => item.content);
      if (recentContext.some((item) => LIBRARY_TERMS.test(normalize(item)) || mentionsKnownEntity(item, result.rows))) {
        return 'library';
      }
    }

    return 'out_of_scope';
  }
}
