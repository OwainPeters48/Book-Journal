import { useState, useEffect, useRef } from 'react'
import './index.css'

const C = {
  parchment: '#f5f0e8', parchmentDark: '#ede5d0',
  ink: '#2c2416', inkLight: '#5c4a2a',
  accent: '#8b3a1a', accentLight: '#c4623a',
  gold: '#b8860b', paper: '#faf7f0',
  green: '#2d6a2d', red: '#8b1a1a',
}

// ── Storage — real localStorage now we're outside the sandbox ─────────────────
const store = {
  get: (k) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null } catch { return null } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch {} },
}

// ── Anthropic API — proxied through Netlify function ──────────────────────────
async function claudeRaw(messages, system, maxTokens = 1000) {
  const r = await fetch('/api/claude', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, system, max_tokens: maxTokens }),
  })
  const d = await r.json()
  return d.content?.map(b => b.text || '').join('') || ''
}
async function ai(messages, system) {
  try { return await claudeRaw(messages, system) || 'Sorry, no response.' }
  catch { return 'Something went wrong. Please try again.' }
}

// ── Google Books search — direct from browser, instant ───────────────────────
const GB_KEY = import.meta.env.VITE_GOOGLE_BOOKS_KEY || ''

function makeGBCoverUrls(item) {
  const info = item?.volumeInfo || {}
  const ids = info.industryIdentifiers || []
  const isbn13 = (ids.find(x => x.type === 'ISBN_13') || {}).identifier || ''
  const isbn10 = (ids.find(x => x.type === 'ISBN_10') || {}).identifier || ''
  const urls = []
  if (info.imageLinks) {
    // Request larger image — zoom=3 gives ~300px wide
    const base = (info.imageLinks.thumbnail || info.imageLinks.smallThumbnail || '')
      .replace('http://', 'https://')
      .replace(/zoom=\d/, 'zoom=3')
      .replace('&edge=curl', '')
    if (base) urls.push(base)
    // Also try zoom=1 as fallback
    urls.push(base.replace('zoom=3', 'zoom=1'))
  }
  if (isbn13) urls.push(`https://covers.openlibrary.org/b/isbn/${isbn13}-L.jpg`)
  if (isbn10) urls.push(`https://covers.openlibrary.org/b/isbn/${isbn10}-L.jpg`)
  return urls.filter(Boolean)
}

async function searchBooks(query) {
  try {
    const key = GB_KEY ? `&key=${GB_KEY}` : ''
    const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=10&printType=books${key}`
    const res = await fetch(url)
    if (!res.ok) throw new Error()
    const data = await res.json()
    if (!data.items?.length) return []
    return data.items.map(item => {
      const info = item.volumeInfo || {}
      const ids = info.industryIdentifiers || []
      const isbn13 = (ids.find(x => x.type === 'ISBN_13') || {}).identifier || ''
      const isbn10 = (ids.find(x => x.type === 'ISBN_10') || {}).identifier || ''
      const coverUrls = makeGBCoverUrls(item)
      return {
        title: info.title || '',
        author: (info.authors || [])[0] || 'Unknown',
        year: (info.publishedDate || '').slice(0, 4),
        publisher: info.publisher || '',
        translator: null,
        description: info.description ? info.description.slice(0, 140) + '…' : '',
        isbn13, isbn10,
        coverUrl: coverUrls[0] || null,
        _coverUrls: coverUrls,
      }
    })
  } catch { return [] }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function Orn() { return <span style={{ color: C.gold, userSelect: 'none' }}>✦</span> }
function HR({ my = 20 }) { return <hr style={{ border: 'none', borderTop: '1px solid #ede5d0', margin: `${my}px 0` }} /> }

function Stars({ value = 0, onChange, max = 10 }) {
  const [hover, setHover] = useState(null)
  return (
    <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
      {Array.from({ length: max }, (_, i) => i + 1).map(n => (
        <span key={n}
          style={{ fontSize: '1em', cursor: onChange ? 'pointer' : 'default', color: (hover ?? value) >= n ? C.gold : C.parchmentDark, transition: 'color .1s' }}
          onMouseEnter={() => onChange && setHover(n)}
          onMouseLeave={() => onChange && setHover(null)}
          onClick={() => onChange?.(n)}>★</span>
      ))}
      {value > 0 && <span style={{ marginLeft: 5, fontSize: '.85em', color: C.inkLight }}>{value}/10</span>}
    </div>
  )
}

function Cover({ urls = [], size = [72, 104] }) {
  const [i, setI] = useState(0)
  const [w, h] = size
  const src = (urls || [])[i]
  function next() { setI(p => p < (urls || []).length - 1 ? p + 1 : (urls || []).length) }
  function onLoad(e) { if (e.target.naturalWidth <= 1 || e.target.naturalHeight <= 1) next() }
  if (src && i < (urls || []).length)
    return <img src={src} alt="" style={{ width: w, height: h, objectFit: 'cover', borderRadius: 5, flexShrink: 0, boxShadow: '1px 3px 10px rgba(44,36,22,.2)' }} onError={next} onLoad={onLoad} />
  return <div style={{ width: w, height: h, background: 'linear-gradient(135deg,#ede5d0,#f5f0e8)', borderRadius: 5, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: w > 50 ? '2em' : '1.2em', opacity: .35 }}>📖</div>
}

function GridCover({ book }) {
  const urls = book._coverUrls || (book.coverUrl ? [book.coverUrl] : [])
  const [i, setI] = useState(0)
  const src = urls[i]
  function next() { setI(p => p < urls.length - 1 ? p + 1 : urls.length) }
  function onLoad(e) { if (e.target.naturalWidth <= 1) next() }
  if (src && i < urls.length)
    return <img src={src} alt="" style={{ width: '100%', height: 158, objectFit: 'cover', display: 'block' }} onError={next} onLoad={onLoad} />
  return <div style={{ height: 158, background: 'linear-gradient(135deg,#ede5d0,#f5f0e8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.8em', opacity: .3 }}>📖</div>
}

// ── Modals ────────────────────────────────────────────────────────────────────
function SetupModal({ onDone }) {
  const [u, setU] = useState('')
  const [err, setErr] = useState('')
  function submit() {
    const name = u.trim().toLowerCase().replace(/[^a-z0-9_]/g, '')
    if (name.length < 3) { setErr('Min 3 characters.'); return }
    const code = name + '-' + Math.random().toString(36).slice(2, 6).toUpperCase()
    onDone({ username: name, friendCode: code })
  }
  return (
    <div className="modal-bg">
      <div className="fade" style={{ background: C.paper, borderRadius: 14, padding: 36, width: 420, maxWidth: '95vw', border: '1px solid #ede5d0', boxShadow: '0 24px 64px rgba(44,36,22,.3)' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: '2em', color: C.gold, marginBottom: 10 }}>✦</div>
          <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: '1.6em', marginBottom: 8 }}>Welcome to your Reading Journal</h2>
          <p style={{ color: C.inkLight, fontSize: '.94em' }}>Choose a username to get started.</p>
        </div>
        <input value={u} onChange={e => setU(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()}
          placeholder="your_username" maxLength={30} autoFocus
          style={{ width: '100%', padding: '11px 14px', background: C.parchment, border: '1px solid #ede5d0', borderRadius: 8, fontSize: '1.1em', color: C.ink, marginBottom: 6 }} />
        {err && <p style={{ color: C.accent, fontSize: '.85em', marginBottom: 6 }}>{err}</p>}
        <p style={{ fontSize: '.76em', color: C.inkLight, marginBottom: 16 }}>Lowercase, numbers, underscores only.</p>
        <button onClick={submit} className="btn-p" style={{ width: '100%', padding: '11px', fontSize: '.82em', letterSpacing: '.1em' }}>CREATE MY LIBRARY</button>
      </div>
    </div>
  )
}

function ConfirmModal({ message, onConfirm, onCancel }) {
  return (
    <div className="modal-bg" onClick={onCancel}>
      <div onClick={e => e.stopPropagation()} className="fade" style={{ background: C.paper, borderRadius: 12, padding: 28, width: 360, maxWidth: '95vw', border: '1px solid #ede5d0', boxShadow: '0 16px 48px rgba(44,36,22,.28)' }}>
        <p style={{ fontFamily: "'Playfair Display',serif", fontSize: '1.1em', marginBottom: 20, lineHeight: 1.5 }}>{message}</p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onCancel} className="btn-s" style={{ flex: 1, padding: '9px', fontSize: '1em' }}>Cancel</button>
          <button onClick={onConfirm} style={{ flex: 1, padding: '9px', background: C.red, border: 'none', borderRadius: 7, fontFamily: "'Cinzel',serif", fontSize: '.75em', cursor: 'pointer', color: '#fff' }}>DELETE</button>
        </div>
      </div>
    </div>
  )
}

// ── Add Book Modal ────────────────────────────────────────────────────────────
function AddBookModal({ onClose, onAdd }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [sel, setSel] = useState(null)
  const [fmt, setFmt] = useState('book')
  const [status, setStatus] = useState('reading')
  const timer = useRef(null)

  function handleInput(q) {
    setQuery(q); setSel(null)
    clearTimeout(timer.current)
    if (q.trim().length < 2) { setResults([]); setSearched(false); return }
    timer.current = setTimeout(async () => {
      setLoading(true); setSearched(true)
      const res = await searchBooks(q)
      setResults(res); setLoading(false)
    }, 300)
  }

  function confirmAdd() {
    const book = results[sel ?? 0]
    if (!book) return
    onAdd({ ...book, format: fmt, status })
    onClose()
  }

  return (
    <div className="modal-bg" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="fade" style={{ background: C.paper, borderRadius: 14, padding: '24px 22px', width: 540, maxWidth: '98vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(44,36,22,.32)', border: '1px solid #ede5d0' }}>
        <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: '1.4em', marginBottom: 4 }}>Add a Book</h2>
        <p style={{ color: C.inkLight, fontSize: '.87em', marginBottom: 14 }}>Search by title or author name.</p>

        <div style={{ position: 'relative', marginBottom: 12 }}>
          <input value={query} onChange={e => handleInput(e.target.value)} autoFocus
            placeholder="e.g. East of Eden, Dostoevsky, The Road…"
            style={{ width: '100%', padding: '11px 36px 11px 14px', background: C.parchment, border: '1px solid #ede5d0', borderRadius: 8, fontSize: '1.06em', color: C.ink }} />
          {loading && <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: C.inkLight, fontSize: '.9em' }}>⟳</span>}
        </div>

        <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
          {[['book', '📖 Book'], ['audiobook', '🎧 Audiobook']].map(([f, label]) => (
            <button key={f} onClick={() => setFmt(f)} className="pill"
              style={{ background: fmt === f ? C.ink : 'transparent', color: fmt === f ? C.parchment : C.inkLight, borderColor: fmt === f ? C.ink : '#ede5d0' }}>{label}</button>
          ))}
          <span style={{ color: '#ede5d0', alignSelf: 'center', padding: '0 4px' }}>|</span>
          {[['reading', 'Reading'], ['finished', 'Finished'], ['wishlist', 'Wishlist']].map(([s, label]) => (
            <button key={s} onClick={() => setStatus(s)} className="pill"
              style={{ background: status === s ? C.accent : 'transparent', color: status === s ? '#fff' : C.inkLight, borderColor: status === s ? C.accent : '#ede5d0' }}>{label}</button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', minHeight: 120 }}>
          {!searched && !loading && (
            <div style={{ textAlign: 'center', padding: '32px 0', color: C.inkLight }}>
              <Orn /><p style={{ fontStyle: 'italic', marginTop: 10, fontSize: '.94em' }}>Start typing to search.</p>
            </div>
          )}
          {loading && <div style={{ textAlign: 'center', padding: '32px 0', color: C.inkLight, fontStyle: 'italic' }}>Searching…</div>}
          {!loading && searched && results.length === 0 && <div style={{ textAlign: 'center', padding: '32px 0', color: C.inkLight, fontStyle: 'italic' }}>No results — try a different title or author.</div>}
          {!loading && results.map((book, idx) => (
            <div key={idx} className={`erow${sel === idx ? ' sel' : ''}`} onClick={() => setSel(idx)}>
              <Cover urls={book._coverUrls || []} size={[48, 68]} />
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "'Playfair Display',serif", fontSize: '.98em', color: C.ink, marginBottom: 1 }}>{book.title}</div>
                <div style={{ fontSize: '.83em', color: C.inkLight, fontStyle: 'italic', marginBottom: 2 }}>{book.author}{book.year ? ' · ' + book.year : ''}</div>
                {book.publisher && <div style={{ fontSize: '.78em', color: C.inkLight, marginBottom: 3 }}>{book.publisher}</div>}
                {book.description && <div style={{ fontSize: '.79em', color: C.inkLight, lineHeight: 1.4 }}>{book.description}</div>}
              </div>
              {sel === idx && <span style={{ color: C.accent, fontSize: '1.1em', flexShrink: 0, marginTop: 2 }}>✓</span>}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          <button onClick={onClose} className="btn-s" style={{ flex: 1, padding: '9px', fontSize: '1em' }}>Cancel</button>
          <button onClick={confirmAdd} disabled={!results.length} className="btn-p" style={{ flex: 2, padding: '9px', fontSize: '.78em', letterSpacing: '.08em' }}>
            {sel !== null ? 'ADD SELECTED' : 'ADD FIRST RESULT'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Book Page ─────────────────────────────────────────────────────────────────
function BookPage({ book, allBooks, onUpdate, onDelete, onBack }) {
  const [tab, setTab] = useState('overview')
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [primerLoading, setPrimerLoading] = useState(false)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [showDel, setShowDel] = useState(false)
  const chatEnd = useRef(null)

  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior: 'smooth' }) }, [book.chatHistory?.length])

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'primer', label: 'Before You Read' },
    { id: 'discuss', label: 'Discuss' },
    ...(book.status === 'finished' ? [{ id: 'next', label: "What's Next" }] : []),
  ]

  async function genPrimer() {
    setPrimerLoading(true)
    const read = allBooks.filter(b => b.status === 'finished' && b.id !== book.id).map(b => b.title + ' by ' + b.author).join(', ')
    const text = await ai([{ role: 'user', content: 'Primer for ' + book.title }],
      'Write a Before You Read primer for "' + book.title + '" by ' + book.author + '. ' + (read ? 'Reader has read: ' + read + '. ' : '') +
      'EXACTLY 2 paragraphs. Essential context, key themes, significance. Punchy and specific.')
    onUpdate({ ...book, primer: text })
    setPrimerLoading(false)
  }

  async function sendChat() {
    if (!chatInput.trim() || chatLoading) return
    const msg = { role: 'user', content: chatInput.trim() }
    const history = [...(book.chatHistory || []), msg]
    onUpdate({ ...book, chatHistory: history })
    setChatInput(''); setChatLoading(true)
    const read = allBooks.filter(b => b.status === 'finished' && b.id !== book.id).map(b => b.title + ' by ' + b.author).join(', ')
    const text = await ai(history,
      'You are a literary companion discussing "' + book.title + '" by ' + book.author + '.' + (read ? ' Reader has also read: ' + read + '.' : '') +
      ' Engage deeply. Be intellectually serious but warm. Draw connections. Ask follow-up questions.')
    onUpdate({ ...book, chatHistory: [...history, { role: 'assistant', content: text }] })
    setChatLoading(false)
  }

  async function genSummary() {
    if (!(book.chatHistory?.length)) return
    setSummaryLoading(true)
    const transcript = book.chatHistory.map(m => (m.role === 'user' ? 'Reader' : 'AI') + ': ' + m.content).join('\n\n')
    const rev = book.review ? '\n\nReader\'s review: "' + book.review + '"' : ''
    const text = await ai([{ role: 'user', content: 'Summarise:\n\n' + transcript + rev }],
      'Summarise this discussion about "' + book.title + '" by ' + book.author +
      '. Write in second person (You found…). 2–3 paragraphs. Capture their personal intellectual experience.')
    onUpdate({ ...book, discussionSummary: text })
    setSummaryLoading(false)
  }

  return (
    <div className="fade" style={{ maxWidth: 720, margin: '0 auto', paddingBottom: 60 }}>
      {showDel && <ConfirmModal message={'Remove "' + book.title + '" from your library? This cannot be undone.'} onConfirm={() => { onDelete(book.id); onBack() }} onCancel={() => setShowDel(false)} />}

      <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.inkLight, fontSize: '1em', padding: '18px 0', display: 'flex', alignItems: 'center', gap: 6 }}>← Back to Library</button>

      <div style={{ background: C.paper, border: '1px solid #ede5d0', borderRadius: 12, padding: '22px 26px', marginBottom: 20, display: 'flex', gap: 20, alignItems: 'flex-start' }}>
        <Cover urls={book._coverUrls || (book.coverUrl ? [book.coverUrl] : [])} size={[88, 128]} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '.72em', fontFamily: "'Cinzel',serif", letterSpacing: '.1em', color: C.accent, marginBottom: 6 }}>
            {book.format === 'audiobook' ? '🎧 AUDIOBOOK' : '📖 BOOK'}
          </div>
          <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: '1.7em', lineHeight: 1.2, color: C.ink, marginBottom: 4 }}>{book.title}</h1>
          <p style={{ fontSize: '1.05em', color: C.inkLight, fontStyle: 'italic', marginBottom: 4 }}>{book.author}{book.year ? ' · ' + book.year : ''}</p>
          {book.publisher && <p style={{ fontSize: '.82em', color: C.inkLight, marginBottom: 8 }}>{book.publisher}{book.translator ? ' · Trans. ' + book.translator : ''}</p>}
          {book.status === 'finished' && book.rating > 0 && <div style={{ marginBottom: 10 }}><Stars value={book.rating} /></div>}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 8 }}>
            <div style={{ fontSize: '.7em', fontFamily: "'Cinzel',serif", letterSpacing: '.08em', color: C.inkLight }}>STATUS</div>
            <select value={book.status} onChange={e => onUpdate({ ...book, status: e.target.value })}
              style={{ padding: '5px 10px', background: C.parchment, border: '1px solid #ede5d0', borderRadius: 6, fontSize: '.9em', color: C.ink, cursor: 'pointer', fontFamily: "'EB Garamond',serif" }}>
              <option value="reading">Currently Reading</option>
              <option value="finished">Finished</option>
              <option value="wishlist">Wishlist</option>
            </select>
            <button onClick={() => setShowDel(true)}
              style={{ background: 'transparent', color: C.red, border: '1px solid ' + C.red, fontFamily: "'Cinzel',serif", letterSpacing: '.06em', cursor: 'pointer', fontSize: '.7em', padding: '6px 12px', borderRadius: 6 }}>
              DELETE BOOK
            </button>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 2, borderBottom: '1px solid #ede5d0' }}>
        {tabs.map(t => <button key={t.id} onClick={() => setTab(t.id)} className={'tab' + (tab === t.id ? ' on' : '')}>{t.label.toUpperCase()}</button>)}
      </div>

      <div style={{ background: C.paper, border: '1px solid #ede5d0', borderTop: 'none', borderRadius: '0 0 10px 10px', padding: 26 }}>

        {tab === 'overview' && (
          <div className="fade">
            <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: '1.2em', marginBottom: 12 }}>My Review</h3>
            <textarea value={book.review || ''} onChange={e => onUpdate({ ...book, review: e.target.value })}
              placeholder="What did you make of this book? Write your thoughts here…" rows={5}
              style={{ width: '100%', padding: 14, background: C.parchment, border: '1px solid #ede5d0', borderRadius: 6, fontSize: '1.05em', color: C.ink, lineHeight: 1.7, resize: 'vertical', fontFamily: "'EB Garamond',serif" }} />
            {book.status === 'finished' && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: '.78em', fontFamily: "'Cinzel',serif", letterSpacing: '.08em', color: C.inkLight, marginBottom: 8 }}>MY RATING</div>
                <Stars value={book.rating || 0} onChange={v => onUpdate({ ...book, rating: v })} max={10} />
              </div>
            )}
            {book.discussionSummary && (<>
              <HR />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: '1.15em' }}>
                  What You Took Away
                  <span style={{ fontSize: '.65em', color: C.inkLight, fontStyle: 'italic', marginLeft: 8 }}>from your discussion</span>
                </h3>
                <button onClick={genSummary} disabled={summaryLoading}
                  style={{ fontSize: '.68em', padding: '5px 10px', background: 'transparent', border: '1px solid #ede5d0', borderRadius: 5, fontFamily: "'Cinzel',serif", cursor: 'pointer', color: C.inkLight, whiteSpace: 'nowrap' }}>
                  {summaryLoading ? '…' : 'REGENERATE'}
                </button>
              </div>
              <p style={{ lineHeight: 1.85, whiteSpace: 'pre-wrap', fontSize: '1.02em' }}>{book.discussionSummary}</p>
            </>)}
          </div>
        )}

        {tab === 'primer' && (
          <div className="fade">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
              <div>
                <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: '1.2em' }}>Before You Read</h3>
                <p style={{ color: C.inkLight, fontSize: '.88em', marginTop: 3 }}>Essential context in two paragraphs.</p>
              </div>
              <button onClick={genPrimer} className="btn-p" disabled={primerLoading} style={{ padding: '8px 15px', fontSize: '.72em', letterSpacing: '.06em', whiteSpace: 'nowrap' }}>
                {primerLoading ? 'GENERATING…' : book.primer ? 'REGENERATE' : 'GENERATE PRIMER'}
              </button>
            </div>
            {book.primer
              ? <p style={{ lineHeight: 1.9, whiteSpace: 'pre-wrap', fontSize: '1.05em' }}>{book.primer}</p>
              : <div style={{ textAlign: 'center', padding: '50px 20px', color: C.inkLight }}><Orn /><p style={{ fontStyle: 'italic', marginTop: 12 }}>Click Generate for a concise context guide.</p></div>
            }
          </div>
        )}

        {tab === 'discuss' && (
          <div className="fade">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div>
                <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: '1.2em' }}>Discussion</h3>
                <p style={{ color: C.inkLight, fontSize: '.87em', marginTop: 2 }}>Saved permanently to this book.</p>
              </div>
              {(book.chatHistory?.length || 0) >= 2 && (
                <button onClick={genSummary} disabled={summaryLoading}
                  style={{ padding: '7px 13px', background: C.gold, border: 'none', borderRadius: 6, fontFamily: "'Cinzel',serif", fontSize: '.68em', letterSpacing: '.06em', cursor: 'pointer', color: '#fff', opacity: summaryLoading ? .7 : 1, whiteSpace: 'nowrap' }}>
                  {summaryLoading ? 'SAVING…' : 'SUMMARISE → OVERVIEW'}
                </button>
              )}
            </div>
            <div style={{ minHeight: 260, maxHeight: 420, overflowY: 'auto', marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 11 }}>
              {!book.chatHistory?.length && (
                <div style={{ textAlign: 'center', padding: '46px 20px', color: C.inkLight }}>
                  <Orn /><p style={{ fontStyle: 'italic', marginTop: 12, fontSize: '1.04em' }}>Start discussing <em>{book.title}</em>.</p>
                </div>
              )}
              {(book.chatHistory || []).map((m, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  <div className={m.role === 'user' ? 'chat-u' : 'chat-a'} style={{ maxWidth: '82%', padding: '10px 15px', fontSize: '1em', lineHeight: 1.7 }}>{m.content}</div>
                </div>
              ))}
              {chatLoading && <div style={{ display: 'flex' }}><div className="chat-a" style={{ padding: '10px 15px', color: C.inkLight, fontStyle: 'italic' }}>Thinking…</div></div>}
              <div ref={chatEnd} />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <textarea value={chatInput} onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat() } }}
                placeholder="Share your thoughts…" rows={2}
                style={{ flex: 1, padding: '10px 13px', background: C.parchment, border: '1px solid #ede5d0', borderRadius: 8, fontSize: '1em', color: C.ink, resize: 'none', lineHeight: 1.6, fontFamily: "'EB Garamond',serif" }} />
              <button onClick={sendChat} disabled={chatLoading || !chatInput.trim()} className="btn-p" style={{ padding: '10px 16px', fontSize: '.72em', letterSpacing: '.06em' }}>SEND</button>
            </div>
            <p style={{ fontSize: '.78em', color: C.inkLight, marginTop: 5 }}>Enter to send · Shift+Enter for new line</p>
          </div>
        )}

        {tab === 'next' && <NextTab book={book} allBooks={allBooks} />}
      </div>
    </div>
  )
}

// ── What's Next Tab ───────────────────────────────────────────────────────────
function NextTab({ book, allBooks }) {
  const [suggs, setSuggs] = useState([])
  const [loading, setLoading] = useState(false)
  const [repl, setRepl] = useState(null)

  async function fetchAll(excl = []) {
    setLoading(true)
    const read = allBooks.filter(b => b.status === 'finished').map(b => b.title + ' by ' + b.author + (b.rating ? ' (' + b.rating + '/10)' : '')).join('\n')
    const ex = excl.length ? '\nDo NOT suggest: ' + excl.join(', ') : ''
    const text = await ai([{ role: 'user', content: 'Suggest next reads.' }],
      'Literary advisor. Just finished "' + book.title + '" by ' + book.author + '.\nHistory:\n' + (read || 'None.') + ex +
      '\nReturn JSON array of 4 objects: {title,author,reason(2 sentences),predictedRating(1-10)}. Raw JSON only.')
    try { setSuggs(JSON.parse(text.trim().replace(/^```[a-z]*\n?/, '').replace(/```$/, '').trim())) }
    catch { setSuggs([]) }
    setLoading(false)
  }

  async function fetchOne(excl) {
    const read = allBooks.filter(b => b.status === 'finished').map(b => b.title + ' by ' + b.author + (b.rating ? ' (' + b.rating + '/10)' : '')).join('\n')
    const text = await ai([{ role: 'user', content: 'One replacement.' }],
      'Suggest ONE book. Just finished "' + book.title + '" by ' + book.author + '.\nHistory:\n' + (read || 'None.') + '\nDo NOT suggest: ' + excl.join(', ') +
      '\nReturn JSON: {title,author,reason,predictedRating}. Raw JSON only.')
    try { return JSON.parse(text.trim().replace(/^```[a-z]*\n?/, '').replace(/```$/, '').trim()) }
    catch { return null }
  }

  async function replace(idx) {
    setRepl(idx)
    const one = await fetchOne(suggs.map(s => s.title + ' by ' + s.author))
    if (one) setSuggs(prev => prev.map((s, i) => i === idx ? one : s))
    setRepl(null)
  }

  async function remove(idx) {
    const excl = suggs.map(s => s.title + ' by ' + s.author)
    setSuggs(prev => prev.filter((_, i) => i !== idx))
    const one = await fetchOne(excl)
    if (one) setSuggs(prev => [...prev, one])
  }

  const rc = r => r >= 8 ? C.green : r >= 6 ? C.gold : C.inkLight

  return (
    <div className="fade">
      <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: '1.2em', marginBottom: 6 }}>What to Read Next</h3>
      <p style={{ color: C.inkLight, fontSize: '.88em', marginBottom: 18 }}>Personalised picks with predicted enjoyment ratings.</p>
      {!suggs.length && (
        <button onClick={() => fetchAll()} disabled={loading} className="btn-p" style={{ padding: '9px 20px', fontSize: '.75em', letterSpacing: '.08em', marginBottom: 18 }}>
          {loading ? 'THINKING…' : 'SUGGEST NEXT READS'}
        </button>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {suggs.map((s, i) => (
          <div key={i} className="scard">
            {repl === i && <div style={{ position: 'absolute', inset: 0, background: 'rgba(250,247,240,.85)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontStyle: 'italic', color: C.inkLight, zIndex: 2 }}>Finding replacement…</div>}
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "'Playfair Display',serif", fontSize: '1.1em', color: C.ink, marginBottom: 2 }}>{s.title}</div>
                <div style={{ fontSize: '.85em', color: C.inkLight, fontStyle: 'italic', marginBottom: 8 }}>{s.author}</div>
                <p style={{ fontSize: '.95em', lineHeight: 1.65 }}>{s.reason}</p>
              </div>
              <div style={{ textAlign: 'center', flexShrink: 0 }}>
                <div style={{ fontFamily: "'Playfair Display',serif", fontSize: '1.7em', fontWeight: 700, color: rc(s.predictedRating), lineHeight: 1 }}>{s.predictedRating}</div>
                <div style={{ fontSize: '.62em', fontFamily: "'Cinzel',serif", color: C.inkLight, letterSpacing: '.06em' }}>/10</div>
                <div style={{ fontSize: '.6em', color: C.inkLight, marginTop: 1 }}>predicted</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button onClick={() => replace(i)} disabled={repl !== null} style={{ padding: '5px 12px', background: 'transparent', border: '1px solid #ede5d0', borderRadius: 5, fontFamily: "'Cinzel',serif", fontSize: '.65em', letterSpacing: '.06em', cursor: 'pointer', color: C.inkLight }}>↻ REPLACE</button>
              <button onClick={() => remove(i)} style={{ padding: '5px 12px', background: 'transparent', border: '1px solid #ede5d0', borderRadius: 5, fontFamily: "'Cinzel',serif", fontSize: '.65em', letterSpacing: '.06em', cursor: 'pointer', color: C.red }}>✕ REMOVE</button>
            </div>
          </div>
        ))}
      </div>
      {suggs.length > 0 && (
        <button onClick={() => fetchAll(suggs.map(s => s.title + ' by ' + s.author))} disabled={loading}
          style={{ marginTop: 16, padding: '8px 18px', background: 'transparent', border: '1px solid #ede5d0', borderRadius: 6, fontFamily: "'Cinzel',serif", fontSize: '.7em', letterSpacing: '.07em', cursor: 'pointer', color: C.inkLight }}>
          {loading ? '…' : '↻ REFRESH ALL'}
        </button>
      )}
    </div>
  )
}

// ── Library ───────────────────────────────────────────────────────────────────
function Library({ books, onSelect }) {
  const [fmt, setFmt] = useState('all')
  const [st, setSt] = useState('all')
  const filtered = books.filter(b => (fmt === 'all' || b.format === fmt) && (st === 'all' || b.status === st))
  const groups = { reading: filtered.filter(b => b.status === 'reading'), finished: filtered.filter(b => b.status === 'finished'), wishlist: filtered.filter(b => b.status === 'wishlist') }
  const labels = { reading: 'CURRENTLY READING', finished: 'FINISHED', wishlist: 'WISHLIST' }

  return (
    <div className="fade">
      <div style={{ display: 'flex', gap: 6, marginBottom: 26, flexWrap: 'wrap', alignItems: 'center' }}>
        {[['all', 'ALL'], ['book', '📖 BOOKS'], ['audiobook', '🎧 AUDIOBOOKS']].map(([f, label]) => (
          <button key={f} onClick={() => setFmt(f)} className="pill" style={{ background: fmt === f ? C.ink : 'transparent', color: fmt === f ? C.parchment : C.inkLight, borderColor: fmt === f ? C.ink : '#ede5d0' }}>{label}</button>
        ))}
        <span style={{ color: '#ede5d0', padding: '0 4px' }}>|</span>
        {[['all', 'ALL'], ['reading', 'READING'], ['finished', 'FINISHED'], ['wishlist', 'WISHLIST']].map(([s, label]) => (
          <button key={s} onClick={() => setSt(s)} className="pill" style={{ background: st === s ? C.accent : 'transparent', color: st === s ? '#fff' : C.inkLight, borderColor: st === s ? C.accent : '#ede5d0' }}>{label}</button>
        ))}
      </div>
      {Object.entries(groups).map(([status, bks]) => !bks.length ? null : (
        <div key={status} style={{ marginBottom: 38 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <Orn /><h2 style={{ fontFamily: "'Cinzel',serif", fontSize: '.8em', letterSpacing: '.14em', color: C.inkLight }}>{labels[status]}</h2>
            <span style={{ fontSize: '.78em', color: C.inkLight, opacity: .6 }}>({bks.length})</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(148px,1fr))', gap: 14 }}>
            {bks.map(book => (
              <div key={book.id} className="book-card" onClick={() => onSelect(book.id)}
                style={{ background: C.paper, border: '1px solid #ede5d0', borderRadius: 10, overflow: 'hidden', boxShadow: '0 2px 8px rgba(44,36,22,.06)' }}>
                <GridCover book={book} />
                <div style={{ padding: '11px 12px 14px' }}>
                  <div style={{ fontSize: '.65em', fontFamily: "'Cinzel',serif", color: C.accent, letterSpacing: '.06em', marginBottom: 4 }}>{book.format === 'audiobook' ? '🎧' : '📖'}</div>
                  <div style={{ fontFamily: "'Playfair Display',serif", fontSize: '.93em', lineHeight: 1.3, marginBottom: 4, color: C.ink }}>{book.title}</div>
                  <div style={{ fontSize: '.82em', color: C.inkLight, fontStyle: 'italic', marginBottom: 6 }}>{book.author}</div>
                  {book.rating > 0 && <Stars value={book.rating} max={10} />}
                  <div style={{ marginTop: 5, display: 'flex', gap: 6, fontSize: '.72em', color: C.inkLight }}>
                    {(book.chatHistory?.length || 0) > 0 && <span>💬 {book.chatHistory.length}</span>}
                    {book.primer && <span>📜</span>}
                    {book.discussionSummary && <span>✦</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
      {books.length === 0 && (
        <div style={{ textAlign: 'center', padding: '80px 20px', color: C.inkLight }}>
          <div style={{ fontSize: '3em', marginBottom: 16 }}><Orn /></div>
          <p style={{ fontFamily: "'Playfair Display',serif", fontSize: '1.4em', fontStyle: 'italic', marginBottom: 8 }}>Your library awaits.</p>
          <p style={{ fontSize: '.95em' }}>Add your first book to begin.</p>
        </div>
      )}
    </div>
  )
}

// ── Suggestions Page ──────────────────────────────────────────────────────────
function SuggestionsPage({ books }) {
  const [suggs, setSuggs] = useState([])
  const [loading, setLoading] = useState(false)
  const [repl, setRepl] = useState(null)
  const finished = books.filter(b => b.status === 'finished')

  async function fetchAll(excl = []) {
    setLoading(true)
    const read = finished.map(b => b.title + ' by ' + b.author + (b.rating ? ' (' + b.rating + '/10)' : '')).join('\n')
    const ex = excl.length ? '\nDo NOT suggest: ' + excl.join(', ') : ''
    const text = await ai([{ role: 'user', content: 'Suggest my next reads.' }],
      'Literary advisor. History:\n' + (read || 'None.') + ex +
      '\nReturn JSON array of 5 objects: {title,author,reason(2 sentences),predictedRating(1-10)}. Raw JSON only.')
    try { setSuggs(JSON.parse(text.trim().replace(/^```[a-z]*\n?/, '').replace(/```$/, '').trim())) }
    catch { setSuggs([]) }
    setLoading(false)
  }

  async function fetchOne(excl) {
    const read = finished.map(b => b.title + ' by ' + b.author + (b.rating ? ' (' + b.rating + '/10)' : '')).join('\n')
    const text = await ai([{ role: 'user', content: 'One replacement.' }],
      'Suggest ONE book. History:\n' + (read || 'None.') + '\nDo NOT suggest: ' + excl.join(', ') +
      '\nReturn JSON: {title,author,reason,predictedRating}. Raw JSON only.')
    try { return JSON.parse(text.trim().replace(/^```[a-z]*\n?/, '').replace(/```$/, '').trim()) }
    catch { return null }
  }

  async function replace(idx) {
    setRepl(idx)
    const one = await fetchOne(suggs.map(s => s.title + ' by ' + s.author))
    if (one) setSuggs(prev => prev.map((s, i) => i === idx ? one : s))
    setRepl(null)
  }

  async function remove(idx) {
    const excl = suggs.map(s => s.title + ' by ' + s.author)
    setSuggs(prev => prev.filter((_, i) => i !== idx))
    const one = await fetchOne(excl)
    if (one) setSuggs(prev => [...prev, one])
  }

  const rc = r => r >= 8 ? C.green : r >= 6 ? C.gold : C.inkLight

  return (
    <div className="fade" style={{ maxWidth: 660, margin: '0 auto' }}>
      <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: '1.8em', marginBottom: 6 }}>What to Read Next</h2>
      <p style={{ color: C.inkLight, marginBottom: 22 }}>{finished.length === 0 ? 'Finish some books and personalised suggestions will appear here.' : 'Based on your ' + finished.length + ' finished book' + (finished.length !== 1 ? 's' : '') + '.'}</p>
      {!suggs.length && (
        <button onClick={() => fetchAll()} disabled={loading || !finished.length} className="btn-p" style={{ padding: '11px 24px', fontSize: '.78em', letterSpacing: '.1em', marginBottom: 24 }}>
          {loading ? 'THINKING…' : 'SUGGEST MY NEXT READS'}
        </button>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {suggs.map((s, i) => (
          <div key={i} className="scard">
            {repl === i && <div style={{ position: 'absolute', inset: 0, background: 'rgba(250,247,240,.85)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontStyle: 'italic', color: C.inkLight, zIndex: 2 }}>Finding replacement…</div>}
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "'Playfair Display',serif", fontSize: '1.1em', color: C.ink, marginBottom: 2 }}>{s.title}</div>
                <div style={{ fontSize: '.85em', color: C.inkLight, fontStyle: 'italic', marginBottom: 8 }}>{s.author}</div>
                <p style={{ fontSize: '.95em', lineHeight: 1.65 }}>{s.reason}</p>
              </div>
              <div style={{ textAlign: 'center', flexShrink: 0 }}>
                <div style={{ fontFamily: "'Playfair Display',serif", fontSize: '1.7em', fontWeight: 700, color: rc(s.predictedRating), lineHeight: 1 }}>{s.predictedRating}</div>
                <div style={{ fontSize: '.62em', fontFamily: "'Cinzel',serif", color: C.inkLight, letterSpacing: '.06em' }}>/10</div>
                <div style={{ fontSize: '.6em', color: C.inkLight, marginTop: 1 }}>predicted</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button onClick={() => replace(i)} disabled={repl !== null} style={{ padding: '5px 12px', background: 'transparent', border: '1px solid #ede5d0', borderRadius: 5, fontFamily: "'Cinzel',serif", fontSize: '.65em', letterSpacing: '.06em', cursor: 'pointer', color: C.inkLight }}>↻ REPLACE</button>
              <button onClick={() => remove(i)} style={{ padding: '5px 12px', background: 'transparent', border: '1px solid #ede5d0', borderRadius: 5, fontFamily: "'Cinzel',serif", fontSize: '.65em', letterSpacing: '.06em', cursor: 'pointer', color: C.red }}>✕ REMOVE</button>
            </div>
          </div>
        ))}
      </div>
      {suggs.length > 0 && (
        <button onClick={() => fetchAll(suggs.map(s => s.title + ' by ' + s.author))} disabled={loading}
          style={{ marginTop: 16, padding: '8px 18px', background: 'transparent', border: '1px solid #ede5d0', borderRadius: 6, fontFamily: "'Cinzel',serif", fontSize: '.7em', letterSpacing: '.07em', cursor: 'pointer', color: C.inkLight }}>
          {loading ? '…' : '↻ REFRESH ALL'}
        </button>
      )}
    </div>
  )
}

// ── Friends Page ──────────────────────────────────────────────────────────────
function FriendsPage({ myUser, myBooks }) {
  const [view, setView] = useState('friends')
  const [friends, setFriends] = useState(() => store.get('friends:' + myUser.username) || [])
  const [addCode, setAddCode] = useState(''); const [addErr, setAddErr] = useState(''); const [addOk, setAddOk] = useState('')
  const [selFriend, setSelFriend] = useState(null); const [friendBooks, setFriendBooks] = useState([])
  const [recTitle, setRecTitle] = useState(''); const [recNote, setRecNote] = useState(''); const [recTarget, setRecTarget] = useState('')
  const [inbox, setInbox] = useState(() => store.get('inbox:' + myUser.username) || [])
  const [copied, setCopied] = useState(false)

  // Note: friends features work per-device with localStorage.
  // For cross-device friend features, a backend would be needed.

  function addFriend() {
    setAddErr(''); setAddOk('')
    const code = addCode.trim()
    if (!code) { setAddErr('Enter a friend code.'); return }
    setAddErr('Friend codes work across devices when using a shared backend. For now, you can see friend codes but cross-device sync requires the optional database setup.')
  }

  const myFin = myBooks.filter(b => b.status === 'finished')

  return (
    <div className="fade" style={{ maxWidth: 720, margin: '0 auto' }}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 22, flexWrap: 'wrap' }}>
        {[['friends', 'My Friends'], ['add', 'Add Friend'], ['inbox', 'Inbox' + (inbox.length ? ' (' + inbox.length + ')' : '')]].map(([v, label]) => (
          <button key={v} onClick={() => setView(v)} className="pill" style={{ background: view === v ? C.accent : 'transparent', color: view === v ? '#fff' : C.inkLight, borderColor: view === v ? C.accent : '#ede5d0' }}>{label}</button>
        ))}
      </div>

      <div style={{ background: C.paper, border: '1px solid #ede5d0', borderRadius: 10, padding: '14px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontSize: '.7em', fontFamily: "'Cinzel',serif", letterSpacing: '.1em', color: C.inkLight, marginBottom: 3 }}>YOUR FRIEND CODE</div>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: '1.3em', color: C.accent }}>{myUser.friendCode}</div>
        </div>
        <button onClick={() => { navigator.clipboard?.writeText(myUser.friendCode).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) }) }} className="btn-p" style={{ padding: '7px 16px', fontSize: '.72em', letterSpacing: '.08em' }}>
          {copied ? 'COPIED ✓' : 'COPY CODE'}
        </button>
      </div>

      <div style={{ background: '#fff8e7', border: '1px solid #e8d89a', borderRadius: 8, padding: '12px 16px', marginBottom: 20, fontSize: '.88em', color: '#6b5a1a' }}>
        ℹ️ Friends features are local to this device. Cross-device friend syncing would require adding a small database — ask Claude to add Supabase integration if you want this.
      </div>

      {view === 'friends' && (
        <div>
          <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: '1.25em', marginBottom: 16 }}>Friends ({friends.length})</h3>
          {!friends.length && <p style={{ color: C.inkLight, fontStyle: 'italic' }}>No friends added yet.</p>}
        </div>
      )}

      {view === 'add' && (
        <div>
          <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: '1.25em', marginBottom: 6 }}>Add a Friend</h3>
          <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
            <input value={addCode} onChange={e => setAddCode(e.target.value)} placeholder="e.g. owain-X4K2"
              style={{ flex: 1, padding: '10px 14px', background: C.parchment, border: '1px solid #ede5d0', borderRadius: 8, fontSize: '1.05em', color: C.ink, fontFamily: "'EB Garamond',serif" }} />
            <button onClick={addFriend} className="btn-p" style={{ padding: '10px 20px', fontSize: '.75em', letterSpacing: '.08em' }}>ADD</button>
          </div>
          {addErr && <p style={{ color: C.accent, fontSize: '.88em' }}>{addErr}</p>}
          {addOk && <p style={{ color: C.green, fontSize: '.88em' }}>{addOk}</p>}
        </div>
      )}

      {view === 'inbox' && (
        <div>
          <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: '1.25em', marginBottom: 16 }}>Inbox ({inbox.length})</h3>
          {!inbox.length && <p style={{ color: C.inkLight, fontStyle: 'italic' }}>No recommendations yet.</p>}
        </div>
      )}
    </div>
  )
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(() => store.get('myUser'))
  const [books, setBooks] = useState(() => {
    const u = store.get('myUser')
    return u ? (store.get('books:' + u.username) || []) : []
  })
  const [page, setPage] = useState('library')
  const [selId, setSelId] = useState(null)
  const [showAdd, setShowAdd] = useState(false)

  useEffect(() => {
    if (user) store.set('books:' + user.username, books)
  }, [books, user])

  function setupUser(u) {
    store.set('myUser', u)
    setUser(u)
    setBooks([])
  }

  function addBook(data) {
    setBooks(p => [...p, { id: Date.now().toString(), ...data, rating: 0, review: '', chatHistory: [], primer: '', discussionSummary: '', dateAdded: new Date().toISOString() }])
  }
  function updateBook(u) { setBooks(p => p.map(b => b.id === u.id ? u : b)) }
  function deleteBook(id) { setBooks(p => p.filter(b => b.id !== id)) }

  const selBook = books.find(b => b.id === selId)

  if (!user) return <SetupModal onDone={setupUser} />

  return (
    <div style={{ minHeight: '100vh', background: '#f5f0e8' }}>
      {showAdd && <AddBookModal onClose={() => setShowAdd(false)} onAdd={addBook} />}
      <header style={{ background: '#2c2416', borderBottom: '3px solid #b8860b', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 62 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => { setPage('library'); setSelId(null) }}>
            <span style={{ color: '#b8860b', fontSize: '1.2em' }}>✦</span>
            <span style={{ fontFamily: "'Cinzel',serif", fontSize: '.95em', letterSpacing: '.18em', color: '#f5f0e8' }}>READING JOURNAL</span>
          </div>
          <nav style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            {[['library', 'LIBRARY'], ['suggestions', 'SUGGESTIONS'], ['friends', 'FRIENDS']].map(([p, label]) => (
              <button key={p} onClick={() => { setPage(p); setSelId(null) }} className="nav-btn"
                style={{ color: page === p && !selId ? '#b8860b' : 'rgba(245,240,232,.55)', background: page === p && !selId ? 'rgba(255,255,255,.1)' : 'transparent' }}>
                {label}
              </button>
            ))}
            <button onClick={() => setShowAdd(true)} className="btn-p" style={{ marginLeft: 8, padding: '7px 15px', fontSize: '.7em', letterSpacing: '.1em' }}>+ ADD BOOK</button>
          </nav>
        </div>
      </header>
      <main style={{ maxWidth: 900, margin: '0 auto', padding: '30px 22px' }}>
        {selBook
          ? <BookPage book={selBook} allBooks={books} onUpdate={updateBook} onDelete={deleteBook} onBack={() => { setSelId(null); setPage('library') }} />
          : page === 'library' ? <Library books={books} onSelect={id => setSelId(id)} />
            : page === 'suggestions' ? <SuggestionsPage books={books} />
              : <FriendsPage myUser={user} myBooks={books} />
        }
      </main>
    </div>
  )
}
