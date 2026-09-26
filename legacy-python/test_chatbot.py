import unittest

import server


class ChatbotAndLoanTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        server.initialize_database()

    def test_ten_members_are_seeded(self):
        self.assertEqual(server.library_stats()["members"], 10)

    def test_shelf_question(self):
        result = server.answer_chat("Dune hangi rafta?")
        self.assertEqual(result["intent"], "raf_konumu")
        self.assertIn("B-12", result["answer"])

    def test_holder_question(self):
        result = server.answer_chat("Kürk Mantolu Madonna kimde?")
        self.assertEqual(result["intent"], "kimde")
        self.assertIn("Ayşe Demir", result["answer"])

    def test_active_book_cannot_be_loaned_again(self):
        with server.connect() as db:
            book = db.execute("SELECT id FROM books WHERE title = %s", ("Kürk Mantolu Madonna",)).fetchone()
            member = db.execute("SELECT id FROM members WHERE full_name = %s", ("Can Aydın",)).fetchone()
        with self.assertRaises(server.ConflictError):
            server.create_loan({"bookId": book["id"], "memberId": member["id"], "dueAt": "2026-08-15"})


if __name__ == "__main__":
    unittest.main()
