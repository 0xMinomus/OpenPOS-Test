import { Link, useLocation, useNavigate } from 'react-router'
import { Logo } from '../lib/ui'

const SECTIONS = [
  { id: 'fitur', label: 'Fitur' },
  { id: 'cara-kerja', label: 'Cara Kerja' },
  { id: 'tentang', label: 'Tentang' },
  { id: 'unduh', label: 'Unduh', to: '/unduh' },
]

export default function Navbar({ dark, logoTone = 'auto' }: { dark?: boolean; logoTone?: 'auto' | 'light' | 'dark' }) {
  const nav = useNavigate()
  const loc = useLocation()

  function goHome(e: React.MouseEvent) {
    e.preventDefault()
    if (loc.pathname === '/') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else {
      nav('/')
    }
  }

  function goSection(id: string) {
    if (loc.pathname === '/') {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } else {
      nav('/')
      setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120)
    }
  }

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-bg/90 backdrop-blur-xl">
      <div className="mx-auto grid min-w-0 max-w-6xl grid-cols-[1fr_auto_1fr] items-center gap-1.5 px-4 py-3 md:gap-5 md:px-8">
        <Link to="/" onClick={goHome} className="flex items-center justify-self-start">
          <Logo tone={logoTone} className="h-6 w-auto sm:h-7" />
        </Link>
        {!dark && (
          <nav className="hidden gap-8 text-sm text-muted md:flex" aria-label="Navigasi utama">
            {SECTIONS.map((s) => (
              s.to
                ? <Link key={s.id} to={s.to} className="hover:text-jet">{s.label}</Link>
                : <button key={s.id} onClick={() => goSection(s.id)} className="hover:text-jet">{s.label}</button>
            ))}
          </nav>
        )}
        <div className="flex min-w-0 items-center justify-self-end gap-1.5 md:gap-2.5">
          <Link to="/masuk" className="rounded-full border border-dove px-2.5 py-1.5 text-[13px] font-medium whitespace-nowrap hover:border-jet sm:px-3 md:px-4 md:py-2 md:text-sm">Masuk</Link>
          <Link to="/daftar" className="rounded-full border border-jet px-2.5 py-1.5 text-[13px] font-medium whitespace-nowrap hover:bg-jet hover:text-paper sm:px-3 md:px-4 md:py-2 md:text-sm">Mulai Gratis</Link>
        </div>
      </div>
    </header>
  )
}