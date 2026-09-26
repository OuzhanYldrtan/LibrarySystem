#!/usr/bin/env python3
"""PostgreSQL destekli Kütüphane Asistanı web uygulaması."""

from __future__ import annotations

import json
import os
import re
import unicodedata
from datetime import date, datetime, timedelta
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import psycopg
from psycopg import sql
from psycopg.rows import dict_row

ROOT = Path(__file__).parent
STATIC = ROOT / "static"
DEFAULT_DATABASE_NAME = os.environ.get("LIBRARY_DB_NAME", "library_assistant")
DATABASE_URL = os.environ.get("DATABASE_URL", f"dbname={DEFAULT_DATABASE_NAME}")


class ConflictError(ValueError):
    """İş kuralı ihlallerini HTTP 409 ile döndürmek için kullanılır."""


def connect() -> psycopg.Connection:
    return psycopg.connect(DATABASE_URL, row_factory=dict_row)


def ensure_development_database() -> None:
    """Yerel geliştirmede uygulama veritabanını ilk çalıştırmada hazırlar."""
    if os.environ.get("DATABASE_URL"):
        return
    if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", DEFAULT_DATABASE_NAME):
        raise ValueError("LIBRARY_DB_NAME geçerli bir PostgreSQL veritabanı adı olmalı.")
    with psycopg.connect("dbname=postgres", autocommit=True) as admin:
        exists = admin.execute(
            "SELECT 1 FROM pg_database WHERE datname = %s", (DEFAULT_DATABASE_NAME,)
        ).fetchone()
        if not exists:
            admin.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(DEFAULT_DATABASE_NAME)))


def initialize_database() -> None:
    ensure_development_database()
    with connect() as db:
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS books (
                id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                title TEXT NOT NULL UNIQUE,
                author TEXT NOT NULL,
                isbn TEXT UNIQUE,
                shelf_code TEXT NOT NULL,
                category TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS members (
                id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                full_name TEXT NOT NULL UNIQUE,
                email TEXT NOT NULL UNIQUE
            );

            CREATE TABLE IF NOT EXISTS loans (
                id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                book_id INTEGER NOT NULL REFERENCES books(id),
                member_id INTEGER NOT NULL REFERENCES members(id),
                borrowed_at DATE NOT NULL DEFAULT CURRENT_DATE,
                due_at DATE NOT NULL,
                returned_at DATE
            );

            CREATE UNIQUE INDEX IF NOT EXISTS one_active_loan_per_book
            ON loans (book_id) WHERE returned_at IS NULL;
            """
        )

        with db.cursor() as cursor:
            cursor.executemany(
                """
                INSERT INTO books (title, author, isbn, shelf_code, category)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (title) DO NOTHING
                """,
                [
                    ("Dune", "Frank Herbert", "9780441172719", "B-12", "Bilim Kurgu"),
                    ("Kürk Mantolu Madonna", "Sabahattin Ali", "9789753638022", "A-04", "Roman"),
                    ("Simyacı", "Paulo Coelho", "9789750719380", "A-09", "Roman"),
                    ("Sefiller", "Victor Hugo", "9789750719381", "C-03", "Klasik"),
                    ("1984", "George Orwell", "9789750719382", "B-04", "Distopya"),
                    ("Küçük Prens", "Antoine de Saint-Exupéry", "9789750719403", "A-01", "Çocuk Klasikleri"),
                    ("Saatleri Ayarlama Enstitüsü", "Ahmet Hamdi Tanpınar", "9789750719410", "A-14", "Türk Edebiyatı"),
                    ("Atomik Alışkanlıklar", "James Clear", "9789750719427", "D-02", "Kişisel Gelişim"),
                ],
            )
            cursor.executemany(
                """
                INSERT INTO members (full_name, email) VALUES (%s, %s)
                ON CONFLICT (full_name) DO NOTHING
                """,
                [
                    ("Ayşe Demir", "ayse.demir@example.com"),
                    ("Mehmet Kaya", "mehmet.kaya@example.com"),
                    ("Elif Yıldız", "elif.yildiz@example.com"),
                    ("Can Aydın", "can.aydin@example.com"),
                    ("Zeynep Arslan", "zeynep.arslan@example.com"),
                    ("Berk Çelik", "berk.celik@example.com"),
                    ("Deniz Şahin", "deniz.sahin@example.com"),
                    ("Selin Koç", "selin.koc@example.com"),
                    ("Mert Yılmaz", "mert.yilmaz@example.com"),
                    ("İpek Eren", "ipek.eren@example.com"),
                ],
            )

        seed_loans = [
            ("Kürk Mantolu Madonna", "Ayşe Demir", date(2026, 7, 10), date(2026, 7, 24), None),
            ("Sefiller", "Mehmet Kaya", date(2026, 7, 16), date(2026, 7, 30), None),
            ("1984", "Elif Yıldız", date(2026, 6, 1), date(2026, 6, 15), date(2026, 6, 12)),
        ]
        for book_title, member_name, borrowed_at, due_at, returned_at in seed_loans:
            db.execute(
                """
                INSERT INTO loans (book_id, member_id, borrowed_at, due_at, returned_at)
                SELECT b.id, m.id, %s, %s, %s
                FROM books AS b CROSS JOIN members AS m
                WHERE b.title = %s AND m.full_name = %s
                  AND NOT EXISTS (
                    SELECT 1 FROM loans AS l
                    WHERE l.book_id = b.id AND l.member_id = m.id AND l.borrowed_at = %s
                  )
                """,
                (borrowed_at, due_at, returned_at, book_title, member_name, borrowed_at),
            )


def normalize(value: str) -> str:
    replacements = str.maketrans({"ı": "i", "İ": "i", "ş": "s", "Ş": "s", "ğ": "g", "Ğ": "g", "ü": "u", "Ü": "u", "ö": "o", "Ö": "o", "ç": "c", "Ç": "c"})
    value = value.translate(replacements).lower()
    return "".join(char for char in unicodedata.normalize("NFKD", value) if not unicodedata.combining(char))


def book_from_message(db: psycopg.Connection, message: str) -> dict[str, Any] | None:
    message_key = normalize(message)
    books = db.execute("SELECT * FROM books ORDER BY LENGTH(title) DESC").fetchall()
    return next((book for book in books if normalize(book["title"]) in message_key), None)


def active_loan(db: psycopg.Connection, book_id: int) -> dict[str, Any] | None:
    return db.execute(
        """
        SELECT m.full_name, l.borrowed_at, l.due_at
        FROM loans AS l JOIN members AS m ON m.id = l.member_id
        WHERE l.book_id = %s AND l.returned_at IS NULL
        ORDER BY l.borrowed_at DESC LIMIT 1
        """,
        (book_id,),
    ).fetchone()


def member_from_message(db: psycopg.Connection, message: str) -> dict[str, Any] | None:
    message_key = normalize(message)
    members = db.execute("SELECT * FROM members ORDER BY LENGTH(full_name) DESC").fetchall()
    return next((member for member in members if normalize(member["full_name"]) in message_key), None)


def answer_chat(message: str) -> dict[str, str]:
    cleaned = " ".join(message.split())
    key = normalize(cleaned)
    if not cleaned:
        return {"intent": "yardim", "answer": "Bir soru yazın. Örneğin: ‘Dune hangi rafta?’"}

    with connect() as db:
        member = member_from_message(db, cleaned)
        wants_member_books = any(word in key for word in ("hangi kitap", "kitaplari", "kitaplar", "aldigi"))
        if member and wants_member_books:
            books = db.execute(
                """
                SELECT b.title, l.due_at FROM loans AS l
                JOIN books AS b ON b.id = l.book_id
                WHERE l.member_id = %s AND l.returned_at IS NULL ORDER BY b.title
                """,
                (member["id"],),
            ).fetchall()
            if not books:
                return {"intent": "uye_kitaplari", "answer": f"{member['full_name']} adlı üyede şu anda aktif ödünç kitap yok."}
            listed = ", ".join(f"{book['title']} (son teslim: {book['due_at']})" for book in books)
            return {"intent": "uye_kitaplari", "answer": f"{member['full_name']} adlı üyedeki aktif kitaplar: {listed}."}

        book = book_from_message(db, cleaned)
        if book:
            loan = active_loan(db, book["id"])
            asks_shelf = any(word in key for word in ("raf", "nerede", "konum", "yer"))
            asks_holder = any(word in key for word in ("kimde", "kim aldi", "kullanic", "uyede", "odunc"))
            asks_available = any(word in key for word in ("musait", "müsait", "uygun", "var mi", "bulunuyor"))
            if asks_shelf:
                return {"intent": "raf_konumu", "answer": f"‘{book['title']}’ kitabı {book['shelf_code']} rafında, {book['category']} bölümünde kayıtlı."}
            if asks_holder:
                if loan:
                    return {"intent": "kimde", "answer": f"‘{book['title']}’ şu anda {loan['full_name']} adlı üyede. Son teslim tarihi: {loan['due_at']}."}
                return {"intent": "kimde", "answer": f"‘{book['title']}’ şu anda hiç kimsede değil; {book['shelf_code']} rafında bulunuyor."}
            if asks_available:
                if loan:
                    return {"intent": "musaitlik", "answer": f"‘{book['title']}’ şu an müsait değil; {loan['full_name']} adlı üyede ve {loan['due_at']} tarihinde teslim edilmesi bekleniyor."}
                return {"intent": "musaitlik", "answer": f"Evet, ‘{book['title']}’ müsait. {book['shelf_code']} rafından alabilirsiniz."}
            return {"intent": "kitap_bilgisi", "answer": f"‘{book['title']}’ — {book['author']}. Raf: {book['shelf_code']}. Kimin elinde olduğunu veya müsaitliğini de sorabilirsiniz."}

        if any(word in key for word in ("kitaplari listele", "kitaplar", "tum kitap", "tüm kitap")):
            books = db.execute("SELECT title, shelf_code FROM books ORDER BY title").fetchall()
            listed = ", ".join(f"{book['title']} ({book['shelf_code']})" for book in books)
            return {"intent": "kitap_listesi", "answer": f"Kayıtlı kitaplar: {listed}."}

    return {"intent": "anlasilmadi", "answer": "Bu soruyu henüz anlayamadım. Kitap adıyla ‘hangi rafta’, ‘kimde’ veya ‘müsait mi’ diye sorabilirsiniz."}


def serialize_book(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": row["id"], "title": row["title"], "author": row["author"],
        "shelfCode": row["shelf_code"], "category": row["category"],
        "holder": row["holder"], "dueAt": row["due_at"], "available": row["holder"] is None,
    }


def list_books() -> list[dict[str, Any]]:
    with connect() as db:
        rows = db.execute(
            """
            SELECT b.id, b.title, b.author, b.shelf_code, b.category,
                   m.full_name AS holder, l.due_at
            FROM books AS b
            LEFT JOIN loans AS l ON l.book_id = b.id AND l.returned_at IS NULL
            LEFT JOIN members AS m ON m.id = l.member_id
            ORDER BY b.title
            """
        ).fetchall()
    return [serialize_book(row) for row in rows]


def list_members() -> list[dict[str, Any]]:
    with connect() as db:
        rows = db.execute("SELECT id, full_name FROM members ORDER BY full_name").fetchall()
    return [{"id": row["id"], "fullName": row["full_name"]} for row in rows]


def list_active_loans() -> list[dict[str, Any]]:
    with connect() as db:
        rows = db.execute(
            """
            SELECT l.id, b.title, m.full_name, l.borrowed_at, l.due_at
            FROM loans AS l JOIN books AS b ON b.id = l.book_id
            JOIN members AS m ON m.id = l.member_id
            WHERE l.returned_at IS NULL ORDER BY l.due_at, b.title
            """
        ).fetchall()
    return [
        {"id": row["id"], "title": row["title"], "member": row["full_name"], "borrowedAt": row["borrowed_at"], "dueAt": row["due_at"]}
        for row in rows
    ]


def library_stats() -> dict[str, int]:
    with connect() as db:
        row = db.execute(
            """
            SELECT (SELECT COUNT(*) FROM books) AS books,
                   (SELECT COUNT(*) FROM members) AS members,
                   (SELECT COUNT(*) FROM loans WHERE returned_at IS NULL) AS active_loans
            """
        ).fetchone()
    return {"books": row["books"], "members": row["members"], "activeLoans": row["active_loans"], "available": row["books"] - row["active_loans"]}


def create_loan(payload: dict[str, Any]) -> dict[str, Any]:
    try:
        book_id, member_id = int(payload["bookId"]), int(payload["memberId"])
    except (KeyError, TypeError, ValueError) as error:
        raise ValueError("Kitap ve üye seçimi zorunludur.") from error
    raw_due_date = payload.get("dueAt")
    try:
        due_at = date.fromisoformat(raw_due_date) if raw_due_date else date.today() + timedelta(days=14)
    except (TypeError, ValueError) as error:
        raise ValueError("Teslim tarihi YYYY-AA-GG biçiminde olmalı.") from error
    if due_at <= date.today():
        raise ValueError("Teslim tarihi bugünden sonra olmalı.")

    with connect() as db:
        book = db.execute("SELECT id, title FROM books WHERE id = %s FOR UPDATE", (book_id,)).fetchone()
        member = db.execute("SELECT id, full_name FROM members WHERE id = %s", (member_id,)).fetchone()
        if not book or not member:
            raise ValueError("Seçilen kitap veya üye bulunamadı.")
        if active_loan(db, book_id):
            raise ConflictError("Bu kitap şu anda başka bir üyede.")
        loan = db.execute(
            """
            INSERT INTO loans (book_id, member_id, borrowed_at, due_at)
            VALUES (%s, %s, CURRENT_DATE, %s) RETURNING id, borrowed_at
            """,
            (book_id, member_id, due_at),
        ).fetchone()
    return {"id": loan["id"], "title": book["title"], "member": member["full_name"], "borrowedAt": loan["borrowed_at"], "dueAt": due_at}


def return_loan(loan_id: int) -> None:
    with connect() as db:
        returned = db.execute(
            "UPDATE loans SET returned_at = CURRENT_DATE WHERE id = %s AND returned_at IS NULL RETURNING id",
            (loan_id,),
        ).fetchone()
    if not returned:
        raise ValueError("Aktif ödünç kaydı bulunamadı.")


def json_default(value: Any) -> str:
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    raise TypeError(f"{type(value).__name__} JSON'a dönüştürülemez")


class LibraryHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, directory=str(STATIC), **kwargs)

    def send_json(self, payload: Any, status: HTTPStatus = HTTPStatus.OK) -> None:
        body = json.dumps(payload, ensure_ascii=False, default=json_default).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def request_payload(self) -> dict[str, Any]:
        length = int(self.headers.get("Content-Length", "0"))
        payload = json.loads(self.rfile.read(length).decode("utf-8"))
        if not isinstance(payload, dict):
            raise ValueError("Geçerli bir JSON nesnesi gönderin.")
        return payload

    def do_GET(self) -> None:
        path = urlparse(self.path).path
        if path == "/api/books":
            self.send_json(list_books())
        elif path == "/api/members":
            self.send_json(list_members())
        elif path == "/api/loans":
            self.send_json(list_active_loans())
        elif path == "/api/stats":
            self.send_json(library_stats())
        elif path == "/api/health":
            self.send_json({"status": "ok", "database": "postgresql", "date": date.today()})
        else:
            super().do_GET()

    def do_POST(self) -> None:
        path = urlparse(self.path).path
        try:
            payload = self.request_payload()
            if path == "/api/chat":
                message = payload.get("message", "")
                if not isinstance(message, str):
                    raise ValueError("message metin olmalı")
                self.send_json(answer_chat(message))
            elif path == "/api/loans":
                self.send_json(create_loan(payload), HTTPStatus.CREATED)
            else:
                match = re.fullmatch(r"/api/loans/(\d+)/return", path)
                if not match:
                    self.send_error(HTTPStatus.NOT_FOUND)
                    return
                return_loan(int(match.group(1)))
                self.send_json({"message": "Kitap başarıyla iade edildi."})
        except ConflictError as error:
            self.send_json({"error": str(error)}, HTTPStatus.CONFLICT)
        except (json.JSONDecodeError, ValueError) as error:
            self.send_json({"error": str(error) or "Geçerli bir istek gönderin."}, HTTPStatus.BAD_REQUEST)
        except psycopg.Error:
            self.send_json({"error": "Veritabanı işlemi tamamlanamadı."}, HTTPStatus.INTERNAL_SERVER_ERROR)

    def log_message(self, format: str, *args: Any) -> None:
        print(f"[web] {self.address_string()} - {format % args}")


if __name__ == "__main__":
    initialize_database()
    port = int(os.environ.get("LIBRARY_PORT", "8000"))
    server = ThreadingHTTPServer(("127.0.0.1", port), LibraryHandler)
    print(f"PostgreSQL Kütüphane Asistanı çalışıyor: http://localhost:{port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nSunucu durduruldu.")
    finally:
        server.server_close()
