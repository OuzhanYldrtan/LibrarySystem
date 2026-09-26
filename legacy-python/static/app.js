const bookList = document.querySelector("#bookList");
const loanList = document.querySelector("#loanList");
const bookCount = document.querySelector("#bookCount");
const memberCount = document.querySelector("#memberCount");
const loanCount = document.querySelector("#loanCount");
const availableCount = document.querySelector("#availableCount");
const filter = document.querySelector("#bookFilter");
const rentalForm = document.querySelector("#rentalForm");
const rentalBook = document.querySelector("#rentalBook");
const rentalMember = document.querySelector("#rentalMember");
const rentalDueAt = document.querySelector("#rentalDueAt");
const rentalFeedback = document.querySelector("#rentalFeedback");
const messages = document.querySelector("#messages");
const chatForm = document.querySelector("#chatForm");
const chatInput = document.querySelector("#chatInput");
let books = [];
let members = [];
let activeLoans = [];

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#039;", '"': "&quot;" })[char]);
}

function formatDate(value) {
  return new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "short" }).format(new Date(`${value}T12:00:00`));
}

function defaultDueDate() {
  const due = new Date();
  due.setDate(due.getDate() + 14);
  return due.toISOString().slice(0, 10);
}

function renderBooks(query = "") {
  const key = query.trim().toLocaleLowerCase("tr-TR");
  const matching = books.filter(book => `${book.title} ${book.author} ${book.shelfCode}`.toLocaleLowerCase("tr-TR").includes(key));
  bookList.innerHTML = matching.length ? matching.map(book => `
    <article class="book-row">
      <strong class="book-title">${escapeHtml(book.title)}</strong>
      <span class="badge ${book.available ? "available" : "loaned"}">${book.available ? "Müsait" : "Ödünçte"}</span>
      <div class="book-meta"><span>${escapeHtml(book.author)} · ${escapeHtml(book.shelfCode)}</span><span>${book.holder ? escapeHtml(book.holder) : escapeHtml(book.category)}</span></div>
    </article>`).join("") : "<p class=\"empty-state\">Sonuç bulunamadı.</p>";
}

function renderRentalOptions() {
  const currentBook = rentalBook.value;
  const currentMember = rentalMember.value;
  rentalBook.innerHTML = `<option value="">Kitap seçin</option>${books.filter(book => book.available).map(book => `<option value="${book.id}">${escapeHtml(book.title)} · ${escapeHtml(book.shelfCode)}</option>`).join("")}`;
  rentalMember.innerHTML = `<option value="">Üye seçin</option>${members.map(member => `<option value="${member.id}">${escapeHtml(member.fullName)}</option>`).join("")}`;
  rentalBook.value = currentBook;
  rentalMember.value = currentMember;
}

function renderLoans() {
  loanList.innerHTML = activeLoans.length ? activeLoans.map(loan => `
    <article class="loan-row">
      <strong class="loan-title">${escapeHtml(loan.title)}</strong>
      <span class="loan-meta">${escapeHtml(loan.member)} · teslim: ${formatDate(loan.dueAt)}</span>
      <button class="return-button" type="button" data-loan-id="${loan.id}">İade al</button>
    </article>`).join("") : "<p class=\"empty-state\">Şu anda açık ödünç işlemi yok.</p>";
}

async function loadData() {
  const [booksResponse, statsResponse, membersResponse, loansResponse] = await Promise.all([
    fetch("/api/books"), fetch("/api/stats"), fetch("/api/members"), fetch("/api/loans")
  ]);
  if (![booksResponse, statsResponse, membersResponse, loansResponse].every(response => response.ok)) throw new Error("Veriler alınamadı");
  [books, members, activeLoans] = await Promise.all([booksResponse.json(), membersResponse.json(), loansResponse.json()]);
  const stats = await statsResponse.json();
  bookCount.textContent = stats.books;
  memberCount.textContent = stats.members;
  loanCount.textContent = stats.activeLoans;
  availableCount.textContent = stats.available;
  renderBooks(filter.value);
  renderRentalOptions();
  renderLoans();
}

function showRentalFeedback(text, isError = false) {
  rentalFeedback.textContent = text;
  rentalFeedback.classList.toggle("error", isError);
}

async function postJson(url, payload) {
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "İşlem tamamlanamadı.");
  return data;
}

async function createLoan(event) {
  event.preventDefault();
  const button = rentalForm.querySelector("button[type=submit]");
  button.disabled = true;
  showRentalFeedback("Kayıt oluşturuluyor…");
  try {
    const loan = await postJson("/api/loans", { bookId: rentalBook.value, memberId: rentalMember.value, dueAt: rentalDueAt.value });
    showRentalFeedback(`“${loan.title}” ${loan.member} adına ödünç verildi.`);
    rentalForm.reset();
    rentalDueAt.value = defaultDueDate();
    await loadData();
  } catch (error) {
    showRentalFeedback(error.message, true);
  } finally {
    button.disabled = false;
  }
}

async function handleReturn(event) {
  const button = event.target.closest("[data-loan-id]");
  if (!button) return;
  button.disabled = true;
  try {
    await postJson(`/api/loans/${button.dataset.loanId}/return`, {});
    showRentalFeedback("Kitap iade alındı ve tekrar rafa eklendi.");
    await loadData();
  } catch (error) {
    showRentalFeedback(error.message, true);
    button.disabled = false;
  }
}

function appendMessage(content, type, extraClass = "") {
  const message = document.createElement("article");
  message.className = `message ${type} ${extraClass}`;
  message.textContent = content;
  messages.append(message);
  messages.scrollTop = messages.scrollHeight;
  return message;
}

async function ask(message) {
  const text = message.trim();
  if (!text) return;
  appendMessage(text, "user");
  chatInput.value = "";
  const thinking = appendMessage("PostgreSQL kayıtları kontrol ediliyor…", "bot", "thinking");
  try {
    const data = await postJson("/api/chat", { message: text });
    thinking.remove();
    appendMessage(data.answer || "Bir hata oluştu.", "bot");
  } catch {
    thinking.remove();
    appendMessage("Sunucuya ulaşılamadı. Sayfayı yenileyip tekrar deneyin.", "bot");
  }
}

rentalDueAt.min = new Date().toISOString().slice(0, 10);
rentalDueAt.value = defaultDueDate();
rentalForm.addEventListener("submit", createLoan);
loanList.addEventListener("click", handleReturn);
filter.addEventListener("input", () => renderBooks(filter.value));
chatForm.addEventListener("submit", event => { event.preventDefault(); ask(chatInput.value); });
document.querySelectorAll(".prompts button").forEach(button => button.addEventListener("click", () => ask(button.textContent)));
loadData().catch(() => { bookList.innerHTML = "<p class=\"empty-state\">Katalog yüklenemedi.</p>"; });
