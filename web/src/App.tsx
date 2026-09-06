import { type ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import { TooltipProvider } from '@/components/ui/tooltip'
import ErrorBoundary from './lib/ErrorBoundary'
import { useDB } from './lib/store'
import Landing from './pages/Landing'
import Masuk from './pages/Masuk'
import Daftar from './pages/Daftar'
import AppShell from './pages/AppShell'
import Dashboard from './pages/Dashboard'
import Pos from './pages/Pos'
import Produk from './pages/Produk'
import Stok from './pages/Stok'
import Transaksi from './pages/Transaksi'
import Laporan from './pages/Laporan'
import Users from './pages/Users'
import Pengaturan from './pages/Pengaturan'
import Shift from './pages/Shift'

// Kasir hanya boleh bekerja saat shift berjalan: tanpa shift aktif,
// dashboard, POS, dan transaksi dialihkan ke halaman Shift.
// Status shift dibaca dari store global (di-refresh AppShell, di-update instan saat mulai/tutup).
function RequireShift({ children }: { children: ReactNode }) {
  const db = useDB()
  const s = db.session
  const active = db.shiftActive

  if (s?.role !== 'cashier') return <>{children}</>
  if (active === null) return <p className="py-14 text-center text-sm text-muted-foreground">Memuat…</p>
  if (active === false) return <Navigate to="/app/shift" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <TooltipProvider>
      <ErrorBoundary>
        <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/masuk" element={<Masuk />} />
        <Route path="/daftar" element={<Daftar />} />
        <Route path="/app" element={<AppShell />}>
          <Route index element={<RequireShift><Dashboard /></RequireShift>} />
          <Route path="pos" element={<RequireShift><Pos /></RequireShift>} />
          <Route path="produk" element={<Produk />} />
          <Route path="stok" element={<Stok />} />
          <Route path="transaksi" element={<RequireShift><Transaksi /></RequireShift>} />
          <Route path="shift" element={<Shift />} />
          <Route path="laporan" element={<Laporan />} />
          <Route path="users" element={<Users />} />
          <Route path="pengaturan" element={<Pengaturan />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </ErrorBoundary>
    </TooltipProvider>
  )
}