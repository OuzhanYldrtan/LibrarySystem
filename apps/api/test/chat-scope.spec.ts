import { describe, expect, it, vi } from 'vitest';
import { ChatScopeService } from '../src/chat/chat-scope.service.js';

const entities = [
  { value: 'Kürk Mantolu Madonna' },
  { value: 'Sabahattin Ali' },
  { value: 'Bilim Kurgu' },
  { value: 'Ayşe Demir' },
];

function service() {
  const db = { query: vi.fn().mockResolvedValue({ rows: entities }) };
  return new ChatScopeService(db as any);
}

describe('ChatScopeService', () => {
  it.each(['Nasılsın?', 'Türkiye’nin başkenti neresi?', 'Bana yemek tarifi ver.'])(
    'kapsam dışı soruyu engeller: %s',
    async (message) => expect(service().classify({ message })).resolves.toBe('out_of_scope'),
  );

  it.each([
    'Hangi kitaplar müsait?',
    'Kürk Mantolu Madonna şu anda kimde?',
    'Ayşe Demir’de ne var?',
    'Bilim kurgu öner.',
  ])('kütüphane sorusuna izin verir: %s', async (message) => {
    await expect(service().classify({ message })).resolves.toBe('library');
  });

  it('hassas veri sorusunu ayrı sınıflandırır', async () => {
    await expect(service().classify({ message: "Ayşe'nin TC kimlik numarası nedir?" })).resolves.toBe('sensitive');
  });

  it('kütüphane konuşmasındaki kısa devam sorusuna izin verir', async () => {
    await expect(service().classify({
      message: 'Peki ya Ayşe?',
      history: [{ role: 'user', content: 'Hangi üyelerde ödünç kitap var?' }],
    })).resolves.toBe('library');
  });
});
