import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight, Bell, BookCopy, BookOpen, Bot, CalendarDays, Check,
  ChevronRight, CircleUserRound, Clock3, Database, Library, Menu,
  MessageSquareText, Plus, RefreshCw, Search, Send, Sparkles, UserPlus, Users, X,
} from 'lucide-react';
import { api } from './api';
import type { Book, ChatMessage, Dashboard, Loan, Member, Page } from './types';

const navItems: { id: Page; label: string; icon: typeof Library }[] = [
  { id: 'dashboard', label: 'Genel Bakış', icon: Library },
  { id: 'members', label: 'Üyeler', icon: Users },
  { id: 'circulation', label: 'Ödünç İşlemleri', icon: BookCopy },
  { id: 'catalog', label: 'Katalog', icon: BookOpen },
  { id: 'assistant', label: 'Yapay Zekâ', icon: Bot },
];

const emptyDashboard: Dashboard = { stats: { books: 0, members: 0, activeLoans: 0, available: 0 }, overdue: [] };
const localDate = (date = new Date()) => {
  const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, '0'); const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
const today = localDate();
const tomorrow = () => { const date = new Date(); date.setDate(date.getDate() + 1); return localDate(date); };
const defaultDue = () => { const date = new Date(); date.setDate(date.getDate() + 14); return localDate(date); };
const formatDate = (value?: string) => value ? new Intl.DateTimeFormat('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${value.slice(0, 10)}T12:00:00`)) : '—';

export default function App() {
  const [page, setPage] = useState<Page>('dashboard');
  const [mobileNav, setMobileNav] = useState(false);
  const [dashboard, setDashboard] = useState<Dashboard>(emptyDashboard);
  const [books, setBooks] = useState<Book[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const refresh = async () => {
    setLoading(true);
    try {
      const [dashboardData, bookData, memberData, loanData] = await Promise.all([
        api<Dashboard>('/dashboard'), api<Book[]>('/books'), api<Member[]>('/members'), api<Loan[]>('/loans'),
      ]);
      setDashboard(dashboardData); setBooks(bookData); setMembers(memberData); setLoans(loanData);
      setLoadError('');
    } catch (error) {
      setLoadError((error as Error).message || 'Veriler yüklenemedi.');
    } finally { setLoading(false); }
  };

  useEffect(() => { refresh().catch(console.error); }, []);

  const navigate = (next: Page) => { setPage(next); setMobileNav(false); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const title = navItems.find((item) => item.id === page)?.label || 'Genel Bakış';

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? 'open' : ''}`}>
        <div className="brand"><span>r</span><strong>raf.</strong></div>
        <button className="mobile-close" onClick={() => setMobileNav(false)} aria-label="Menüyü kapat"><X size={20} /></button>
        <p className="nav-caption">KÜTÜPHANE YÖNETİMİ</p>
        <nav>{navItems.map(({ id, label, icon: Icon }) => (
          <button key={id} className={page === id ? 'active' : ''} onClick={() => navigate(id)}>
            <Icon size={18} /><span>{label}</span>{page === id && <ChevronRight className="nav-arrow" size={15} />}
          </button>
        ))}</nav>
        <div className="sidebar-foot">
          <div className={`system-dot ${loadError ? 'offline' : ''}`}><span></span><div><strong>{loadError ? 'Bağlantı bekleniyor' : 'Sistem çalışıyor'}</strong><small>{loadError || 'PostgreSQL bağlı'}</small></div></div>
          <div className="employee"><div className="avatar">KÇ</div><div><strong>Kütüphane çalışanı</strong><small>Yönetici paneli</small></div></div>
        </div>
      </aside>
      {mobileNav && <button className="nav-backdrop" aria-label="Menüyü kapat" onClick={() => setMobileNav(false)} />}

      <main className="main-area">
        <header className="top-header">
          <button className="mobile-menu" onClick={() => setMobileNav(true)} aria-label="Menüyü aç"><Menu size={20} /></button>
          <div><p>RAF / YÖNETİM</p><h1>{title}</h1></div>
          <div className="header-actions"><span className="date"><CalendarDays size={15} />{formatDate(today)}</span><button aria-label="Bildirimler"><Bell size={18} /><i /></button><button className="refresh" onClick={refresh} aria-label="Verileri yenile"><RefreshCw size={17} className={loading ? 'spin' : ''} /></button></div>
        </header>

        <div className="page-content">
          {loadError && <div className="alert error"><X size={17} />{loadError}</div>}
          {page === 'dashboard' && <DashboardPage data={dashboard} members={members} books={books} onNavigate={navigate} />}
          {page === 'members' && <MembersPage members={members} onChanged={refresh} />}
          {page === 'circulation' && <CirculationPage books={books} members={members} loans={loans} onChanged={refresh} />}
          {page === 'catalog' && <CatalogPage books={books} onChanged={refresh} />}
          {page === 'assistant' && <AssistantPage />}
        </div>
      </main>
    </div>
  );
}

function DashboardPage({ data, members, books, onNavigate }: { data: Dashboard; members: Member[]; books: Book[]; onNavigate: (page: Page) => void }) {
  const cards = [
    { label: 'Toplam kitap', value: data.stats.books, note: 'katalog kaydı', icon: BookOpen, color: 'purple' },
    { label: 'Kayıtlı üye', value: data.stats.members, note: 'aktif profil', icon: Users, color: 'lime' },
    { label: 'Ödünçte', value: data.stats.activeLoans, note: 'açık işlem', icon: BookCopy, color: 'peach' },
    { label: 'Rafta', value: data.stats.available, note: 'müsait kitap', icon: Check, color: 'dark' },
  ];
  return <>
    <section className="welcome-band"><div><span className="kicker">{formatDate(today).toLocaleUpperCase('tr-TR')}</span><h2>Kütüphanede bugün<br /><em>neler oluyor?</em></h2><p>Kayıtları yönetin, ödünçleri takip edin ve yapay zekâ asistanından yardım alın.</p></div><button onClick={() => onNavigate('members')}><UserPlus size={18} />Yeni üye ekle<ArrowRight size={17} /></button></section>
    <section className="stat-grid">{cards.map(({ label, value, note, icon: Icon, color }) => <article className={`stat ${color}`} key={label}><div><span>{label}</span><Icon size={18} /></div><strong>{value}</strong><small>{note}</small></article>)}</section>
    <section className="dashboard-grid">
      <article className="surface overdue-panel"><div className="surface-title"><div><span>TAKİP LİSTESİ</span><h3>Geciken iadeler</h3></div><Clock3 size={20} /></div>{data.overdue.length ? <div className="overdue-list">{data.overdue.map((loan) => <div key={loan.id}><div className="book-mark"><BookOpen size={17} /></div><div><strong>{loan.title}</strong><span>{loan.member} · {formatDate(loan.dueAt)}</span></div><b>{loan.overdueDays} gün</b></div>)}</div> : <Empty icon={Check} title="Geciken iade yok" text="Tüm aktif işlemler zamanında görünüyor." />}</article>
      <article className="surface quick-panel"><div className="surface-title"><div><span>HIZLI ERİŞİM</span><h3>Günün işlemleri</h3></div><Sparkles size={20} /></div><div className="quick-list"><button onClick={() => onNavigate('members')}><span className="quick-icon lilac"><UserPlus size={20} /></span><div><strong>Yeni üye kaydı</strong><small>Kimlik ve iletişim bilgileri</small></div><ChevronRight size={17} /></button><button onClick={() => onNavigate('circulation')}><span className="quick-icon green"><BookCopy size={20} /></span><div><strong>Kitap ödünç ver</strong><small>{books.filter((book) => book.available).length} kitap müsait</small></div><ChevronRight size={17} /></button><button onClick={() => onNavigate('assistant')}><span className="quick-icon orange"><MessageSquareText size={20} /></span><div><strong>Asistana sor</strong><small>LLM + MCP ile sorgula</small></div><ChevronRight size={17} /></button></div></article>
    </section>
    <section className="surface recent-members"><div className="surface-title"><div><span>SON KAYITLAR</span><h3>Yeni üyeler</h3></div><button onClick={() => onNavigate('members')}>Tümünü gör <ArrowRight size={14} /></button></div><MemberTable members={members.slice(0, 5)} compact /></section>
  </>;
}

const initialMember = { fullName: '', tcIdentityNo: '', birthDate: '', email: '', phone: '', address: '' };
function MembersPage({ members, onChanged }: { members: Member[]; onChanged: () => Promise<void> }) {
  const [showForm, setShowForm] = useState(false); const [form, setForm] = useState(initialMember); const [query, setQuery] = useState(''); const [error, setError] = useState(''); const [success, setSuccess] = useState(''); const [saving, setSaving] = useState(false);
  const filtered = members.filter((member) => `${member.fullName} ${member.email || ''} ${member.phone || ''}`.toLocaleLowerCase('tr').includes(query.toLocaleLowerCase('tr')));
  const submit = async (event: FormEvent) => { event.preventDefault(); setSaving(true); setError(''); setSuccess(''); try { await api('/members', { method: 'POST', body: JSON.stringify(form) }); setSuccess(`${form.fullName} üye olarak kaydedildi.`); setForm(initialMember); setShowForm(false); await onChanged(); } catch (err) { setError((err as Error).message); } finally { setSaving(false); } };
  const set = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  return <>
    <section className="page-intro"><div><span className="kicker">ÜYE YÖNETİMİ</span><h2>Kütüphane üyeleri</h2><p>Yeni üyeleri çalışan olarak kaydedin ve mevcut kayıtları görüntüleyin.</p></div><button className="primary-button" onClick={() => { setShowForm(true); setError(''); }}><Plus size={18} />Yeni üye</button></section>
    {success && <div className="alert success"><Check size={17} />{success}</div>}{error && <div className="alert error"><X size={17} />{error}</div>}
    {showForm && <section className="surface member-form-card"><div className="surface-title"><div><span>YENİ KAYIT</span><h3>Üye bilgileri</h3></div><button className="icon-button" onClick={() => setShowForm(false)} aria-label="Formu kapat"><X size={18} /></button></div><div className="privacy-note"><Database size={17} /><p>Kimlik bilgileri yalnızca çalışan yönetim ekranında tutulur. Chatbot bu alanlara erişemez.</p></div><form className="member-form" onSubmit={submit}><label className="wide">Ad soyad<span>*</span><input value={form.fullName} onChange={(e) => set('fullName', e.target.value)} placeholder="Örn. Deniz Kaya" required /></label><label>TC kimlik numarası<span>*</span><input value={form.tcIdentityNo} onChange={(e) => set('tcIdentityNo', e.target.value.replace(/\D/g, '').slice(0, 11))} inputMode="numeric" placeholder="11 hane" required /></label><label>Doğum tarihi<span>*</span><input type="date" max={today} value={form.birthDate} onChange={(e) => set('birthDate', e.target.value)} required /></label><label>E-posta<input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="ornek@eposta.com" /></label><label>Telefon<input value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="05xx xxx xx xx" /></label><label className="wide">Adres<textarea value={form.address} onChange={(e) => set('address', e.target.value)} placeholder="Üyenin adresi" rows={3} /></label><div className="form-actions wide"><button type="button" className="secondary-button" onClick={() => setShowForm(false)}>Vazgeç</button><button className="primary-button" disabled={saving}>{saving ? 'Kaydediliyor…' : 'Üyeyi kaydet'}<ArrowRight size={16} /></button></div></form></section>}
    <section className="surface members-list"><div className="list-toolbar"><div><span className="kicker">{members.length} KAYIT</span><h3>Üye listesi</h3></div><label className="search-box"><Search size={16} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Üye ara" /></label></div><MemberTable members={filtered} /></section>
  </>;
}

function MemberTable({ members, compact = false }: { members: Member[]; compact?: boolean }) {
  if (!members.length) return <Empty icon={Users} title="Üye bulunamadı" text="Arama kriterlerini değiştirin veya yeni üye ekleyin." />;
  return <div className="table-wrap"><table><thead><tr><th>Üye</th><th>TC kimlik</th>{!compact && <th>Doğum tarihi</th>}<th>İletişim</th><th>Aktif kitap</th></tr></thead><tbody>{members.map((member) => <tr key={member.id}><td><div className="identity"><span>{member.fullName.split(' ').map((part) => part[0]).slice(0, 2).join('')}</span><div><strong>{member.fullName}</strong><small>Üye #{String(member.id).padStart(4, '0')}</small></div></div></td><td><code>{member.tcIdentityMasked || 'Eski kayıt'}</code></td>{!compact && <td>{formatDate(member.birthDate)}</td>}<td><strong className="contact">{member.phone || member.email || '—'}</strong></td><td><span className={`count-pill ${member.activeLoans ? 'has' : ''}`}>{member.activeLoans}</span></td></tr>)}</tbody></table></div>;
}

function CirculationPage({ books, members, loans, onChanged }: { books: Book[]; members: Member[]; loans: Loan[]; onChanged: () => Promise<void> }) {
  const [bookId, setBookId] = useState(''); const [memberId, setMemberId] = useState(''); const [dueAt, setDueAt] = useState(defaultDue()); const [feedback, setFeedback] = useState(''); const [error, setError] = useState(''); const [saving, setSaving] = useState(false);
  const available = books.filter((book) => book.available);
  const submit = async (event: FormEvent) => { event.preventDefault(); setSaving(true); setError(''); try { const loan = await api<{ title: string; member: string }>('/loans', { method: 'POST', body: JSON.stringify({ bookId: Number(bookId), memberId: Number(memberId), dueAt }) }); setFeedback(`“${loan.title}” ${loan.member} adına ödünç verildi.`); setBookId(''); setMemberId(''); setDueAt(defaultDue()); await onChanged(); } catch (err) { setError((err as Error).message); } finally { setSaving(false); } };
  const returnLoan = async (id: number) => { setError(''); try { await api(`/loans/${id}/return`, { method: 'POST', body: '{}' }); setFeedback('Kitap iade alındı ve tekrar rafa eklendi.'); await onChanged(); } catch (err) { setError((err as Error).message); } };
  return <><section className="page-intro"><div><span className="kicker">DOLAŞIM MASASI</span><h2>Ödünç ve iade</h2><p>Kitap hareketlerini PostgreSQL üzerinde güvenli ve anlık olarak yönetin.</p></div></section>{feedback && <div className="alert success"><Check size={17} />{feedback}</div>}{error && <div className="alert error"><X size={17} />{error}</div>}<section className="circulation-grid"><form className="surface loan-form" onSubmit={submit}><div className="surface-title"><div><span>YENİ İŞLEM</span><h3>Kitap ödünç ver</h3></div><span className="number-chip">01</span></div><label>Kitap nüshası<select value={bookId} onChange={(e) => setBookId(e.target.value)} required><option value="">Müsait nüsha seçin</option>{available.map((book) => <option value={book.id} key={book.id}>{book.title} · {book.inventoryCode} · {book.shelfCode}</option>)}</select></label><label>Üye<select value={memberId} onChange={(e) => setMemberId(e.target.value)} required><option value="">Üye seçin</option>{members.map((member) => <option value={member.id} key={member.id}>{member.fullName}</option>)}</select></label><label>Son teslim tarihi<input type="date" min={tomorrow()} value={dueAt} onChange={(e) => setDueAt(e.target.value)} required /></label><button className="primary-button full" disabled={saving || !available.length}>{saving ? 'İşleniyor…' : 'Ödünç işlemini tamamla'}<ArrowRight size={16} /></button></form><article className="surface policy-card"><div className="surface-title"><div><span>İŞLEM ÖZETİ</span><h3>Bugünkü durum</h3></div><span className="number-chip">02</span></div><div className="policy-metric"><span><BookOpen size={18} />Rafta bulunan</span><strong>{available.length}</strong></div><div className="policy-metric"><span><Clock3 size={18} />Açık ödünç</span><strong>{loans.length}</strong></div><div className="policy-metric danger"><span><CalendarDays size={18} />Geciken</span><strong>{loans.filter((loan) => loan.overdue).length}</strong></div><p>Standart ödünç süresi otomatik olarak 14 gün ayarlanır.</p></article></section><section className="surface loan-table"><div className="surface-title"><div><span>AÇIK KAYITLAR</span><h3>Ödünçteki kitaplar</h3></div><BookCopy size={20} /></div>{loans.length ? <div className="table-wrap"><table><thead><tr><th>Kitap</th><th>Üye</th><th>Alış tarihi</th><th>Teslim</th><th></th></tr></thead><tbody>{loans.map((loan) => <tr key={loan.id}><td><strong>{loan.title}</strong></td><td>{loan.member}</td><td>{formatDate(loan.borrowedAt)}</td><td><span className={`due-pill ${loan.overdue ? 'overdue' : ''}`}>{formatDate(loan.dueAt)}</span></td><td><button className="return-button" onClick={() => returnLoan(loan.id)}>İade al</button></td></tr>)}</tbody></table></div> : <Empty icon={Check} title="Açık ödünç yok" text="Tüm kitaplar rafta görünüyor." />}</section></>;
}

const initialBook = { title: '', author: '', isbn: '', inventoryCode: '', shelfCode: '', category: '' };
function CatalogPage({ books, onChanged }: { books: Book[]; onChanged: () => Promise<void> }) {
  const [query, setQuery] = useState(''); const [onlyAvailable, setOnlyAvailable] = useState(false); const [showForm, setShowForm] = useState(false); const [form, setForm] = useState(initialBook); const [error, setError] = useState(''); const [saving, setSaving] = useState(false);
  const filtered = useMemo(() => books.filter((book) => `${book.title} ${book.author} ${book.category} ${book.shelfCode}`.toLocaleLowerCase('tr').includes(query.toLocaleLowerCase('tr')) && (!onlyAvailable || book.available)), [books, query, onlyAvailable]);
  const set = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const submit = async (event: FormEvent) => { event.preventDefault(); setSaving(true); setError(''); try { await api('/books', { method: 'POST', body: JSON.stringify(form) }); setForm(initialBook); setShowForm(false); await onChanged(); } catch (err) { setError((err as Error).message); } finally { setSaving(false); } };
  return <><section className="page-intro"><div><span className="kicker">CANLI KATALOG</span><h2>Kitap koleksiyonu</h2><p>Her kayıt fiziksel bir nüshayı temsil eder; aynı eserden birden fazla nüsha ekleyebilirsiniz.</p></div><button className="primary-button" onClick={() => { setShowForm(true); setError(''); }}><Plus size={18} />Nüsha ekle</button></section>{error && <div className="alert error"><X size={17} />{error}</div>}{showForm && <section className="surface member-form-card"><div className="surface-title"><div><span>YENİ NÜSHA</span><h3>Katalog bilgileri</h3></div><button className="icon-button" onClick={() => setShowForm(false)} aria-label="Formu kapat"><X size={18} /></button></div><form className="member-form" onSubmit={submit}><label>Kitap adı<span>*</span><input value={form.title} onChange={(e) => set('title', e.target.value)} required /></label><label>Yazar<span>*</span><input value={form.author} onChange={(e) => set('author', e.target.value)} required /></label><label>Envanter kodu<span>*</span><input value={form.inventoryCode} onChange={(e) => set('inventoryCode', e.target.value)} placeholder="Örn. ROM-001" required /></label><label>Raf kodu<span>*</span><input value={form.shelfCode} onChange={(e) => set('shelfCode', e.target.value)} placeholder="Örn. A-04" required /></label><label>ISBN<input value={form.isbn} onChange={(e) => set('isbn', e.target.value)} /></label><label>Kategori<span>*</span><input value={form.category} onChange={(e) => set('category', e.target.value)} required /></label><div className="form-actions wide"><button type="button" className="secondary-button" onClick={() => setShowForm(false)}>Vazgeç</button><button className="primary-button" disabled={saving}>{saving ? 'Kaydediliyor…' : 'Nüshayı kaydet'}<ArrowRight size={16} /></button></div></form></section>}<section className="catalog-toolbar"><label className="search-box large"><Search size={17} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Başlık, yazar, kategori veya raf ara" /></label><label className="toggle"><input type="checkbox" checked={onlyAvailable} onChange={(e) => setOnlyAvailable(e.target.checked)} /><span />Yalnızca müsait</label></section><section className="book-grid">{filtered.map((book, index) => <article className="book-card" key={book.id}><div className={`book-cover tone-${index % 4}`}><span>{book.category}</span><BookOpen size={27} /><small>{book.shelfCode}</small></div><div className="book-info"><span className={`availability ${book.available ? 'yes' : 'no'}`}>{book.available ? 'Müsait' : 'Ödünçte'}</span><h3>{book.title}</h3><p>{book.author}</p><div><span>{book.inventoryCode}</span><strong>{book.available ? book.shelfCode : book.holder}</strong></div></div></article>)}</section></>;
}

function AssistantPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: 'assistant', content: 'Merhaba! Katalog, raflar, müsait kitaplar, aktif ödünçler ve geciken iadeler hakkında doğal dille soru sorabilirsiniz.' }]); const [input, setInput] = useState(''); const [sending, setSending] = useState(false); const [status, setStatus] = useState<{ configured: boolean; model: string; transport: string } | null>(null);
  useEffect(() => { api<{ configured: boolean; model: string; transport: string }>('/chat/status').then(setStatus).catch(() => setStatus(null)); }, []);
  const send = async (text: string) => { const message = text.trim(); if (!message || sending) return; const history = messages.slice(-8).map(({ role, content }) => ({ role, content })); setMessages((current) => [...current, { role: 'user', content: message }]); setInput(''); setSending(true); try { const result = await api<{ answer: string; toolsUsed: string[] }>('/chat', { method: 'POST', body: JSON.stringify({ message, history }) }); setMessages((current) => [...current, { role: 'assistant', content: result.answer, toolsUsed: result.toolsUsed }]); } catch (err) { setMessages((current) => [...current, { role: 'assistant', content: (err as Error).message }]); } finally { setSending(false); } };
  const submit = (event: FormEvent) => { event.preventDefault(); send(input); };
  const examples = ['Bilim kurgu türünde müsait kitap öner.', 'Kürk Mantolu Madonna şu anda kimde?', 'Teslim tarihi geçen kitapları listele.', 'Ayşe Demir’de hangi kitaplar var?'];
  return <><section className="page-intro assistant-intro"><div><span className="kicker">GEMINI + MODEL CONTEXT PROTOCOL</span><h2>Kütüphane asistanı</h2><p>Doğal dili anlayan model, yalnızca izinli MCP araçlarıyla PostgreSQL kayıtlarını sorgular.</p></div><div className={`llm-status ${status?.configured ? 'ready' : ''}`}><span /><div><strong>{status?.configured ? 'Gemini hazır' : 'Gemini API anahtarı gerekli'}</strong><small>{status?.model || 'gemini-3.5-flash-lite'} · MCP stdio</small></div></div></section><section className="assistant-layout"><article className="chat-panel"><div className="chat-head"><div className="ai-avatar"><Sparkles size={19} /></div><div><strong>Raf AI</strong><span>Çalışan asistanı</span></div><span className="online">çevrimiçi</span></div><div className="chat-messages">{messages.map((message, index) => <div className={`chat-message ${message.role}`} key={index}><div className="message-label">{message.role === 'assistant' ? <><Bot size={14} /> RAF AI</> : <><CircleUserRound size={14} /> SİZ</>}</div><p>{message.content}</p>{message.toolsUsed && message.toolsUsed.length > 0 && <div className="tool-tags">{message.toolsUsed.map((tool) => <span key={tool}><Database size={11} />{tool}</span>)}</div>}</div>)}{sending && <div className="chat-message assistant typing"><div className="message-label"><Bot size={14} /> RAF AI</div><p><i /><i /><i /></p></div>}</div><div className="suggestions">{examples.map((example) => <button key={example} onClick={() => send(example)}>{example}</button>)}</div><form className="chat-composer" onSubmit={submit}><input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Kütüphane kayıtlarıyla ilgili bir soru yazın…" /><button disabled={sending || !input.trim()} aria-label="Gönder"><Send size={18} /></button></form></article><aside className="mcp-panel"><div className="protocol-visual"><span className="node llm"><Sparkles size={18} />LLM</span><i /><span className="node mcp"><Database size={18} />MCP</span><i /><span className="node db"><Database size={18} />PostgreSQL</span></div><h3>Güvenli veri erişimi</h3><p>Model serbest SQL yazmaz. Aşağıdaki salt-okunur araçlardan uygun olanı seçer.</p><ul><li><Check size={14} />Kitap ve yazar arama</li><li><Check size={14} />Raf ve müsaitlik kontrolü</li><li><Check size={14} />Üyenin aktif kitapları</li><li><Check size={14} />Geciken iade listesi</li></ul><div className="privacy-box"><span>HASSAS VERİ KORUMASI</span><p>TC kimlik, doğum tarihi, telefon ve adres LLM ile paylaşılmaz.</p></div></aside></section></>;
}

function Empty({ icon: Icon, title, text }: { icon: typeof Check; title: string; text: string }) { return <div className="empty"><span><Icon size={22} /></span><strong>{title}</strong><p>{text}</p></div>; }
