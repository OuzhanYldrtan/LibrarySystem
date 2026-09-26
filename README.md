# Raf Kütüphane Yönetim Platformu

Kütüphane çalışanları için React, NestJS, PostgreSQL ve LLM + MCP tabanlı yönetim uygulaması.

## Mimari

```text
React (5173) ──HTTP──> NestJS API (3000) ──SQL──> PostgreSQL
                              │
                              └──> Gemini API
                                      │
                                      └──function call──> MCP istemcisi
                                                               │ stdio
                                                               └──> Kütüphane MCP sunucusu ──> PostgreSQL
```

Chatbot SQL üretmez. Model; `search_books`, `get_book_status`, `get_member_loans`, `list_overdue_loans` ve `list_available_books` araçlarından birini seçer. NestJS çağrıyı MCP sunucusuna iletir.

TC kimlik, doğum tarihi, telefon, e-posta ve adres MCP araçlarında yer almaz ve LLM'e gönderilmez.
Kütüphane kapsamı dışındaki sorular backend filtresinde durdurulur ve Gemini API'ye gönderilmez.

## Özellikler

- Çalışan genel bakış ekranı ve canlı istatistikler
- TC kimlik algoritması doğrulamalı yeni üye kaydı
- Maskeli TC görüntüleme
- Bir eserin birden çok fiziksel nüshasını kaydetme, ödünç verme ve iade alma
- Katalog, raf ve müsaitlik araması
- Gemini Flash-Lite + MCP tabanlı doğal dil chatbotu
- Aynı kitabın iki kişiye aynı anda verilmesini engelleyen PostgreSQL indeksi

## Kurulum

Node.js 20+ ve çalışan bir PostgreSQL sunucusu gerekir.

```bash
pnpm install
cp .env.example .env
pnpm dev
```

Uygulama: [http://localhost:5173](http://localhost:5173)  
NestJS API: [http://localhost:3000/api/health](http://localhost:3000/api/health)

## LLM'i açma

Google AI Studio'da bir Gemini API anahtarı oluşturun ve kök dizindeki `.env` dosyasına ekleyin:

```dotenv
GEMINI_API_KEY=AIza...
GEMINI_MODEL=gemini-3.5-flash-lite
```

Anahtar yokken üye, katalog ve ödünç özellikleri çalışmaya devam eder; yalnızca LLM sohbeti devre dışı kalır.

## PostgreSQL

Varsayılan yerel bağlantı:

```dotenv
PGDATABASE=library_assistant
PGHOST=/tmp
PGPORT=5432
```

Harici sunucu için `DATABASE_URL` kullanabilirsiniz:

```dotenv
DATABASE_URL=postgresql://kullanici:sifre@sunucu:5432/library_assistant
```

NestJS ilk açılışta eski tek-kitap kayıtlarını otomatik olarak birer fiziksel nüshaya dönüştürür. Yeni yapıda eser bilgileri `books`, ödünç verilebilen nüshalar ise `book_copies` tablosunda tutulur.

## Komutlar

```bash
pnpm dev      # React + NestJS + MCP geliştirme süreçleri
pnpm build    # Üç uygulamanın üretim derlemesi
pnpm test     # API doğrulama testleri
```

Eski Python prototipi kökte durur ancak yeni uygulama tarafından kullanılmaz.
