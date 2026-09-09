import { Navigate, Route, Routes } from 'react-router'
import { TooltipProvider } from '@/components/ui/tooltip'
import ErrorBoundary from './lib/ErrorBoundary'
import Landing from './pages/Landing'
import Masuk from './pages/Masuk'
import Daftar from './pages/Daftar'
import PilihAkun from './pages/PilihAkun'
import AppShell from './pages/AppShell'
import Dashboard from './pages/Dashboard'
import Karyawan from './pages/Karyawan'
import Pos from './pages/Pos'
import Produk from './pages/Produk'
import Stok from './pages/Stok'
import Transaksi from './pages/Transaksi'
import Laporan from './pages/Laporan'
import Users from './pages/Users'
import Pengaturan from './pages/Pengaturan'
import Unduh from './pages/Unduh'

export default function App() {
  return (
    <TooltipProvider>
      <ErrorBoundary>
        <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/masuk" element={<Masuk />} />
        <Route path="/daftar" element={<Daftar />} />
        <Route path="/pilih-akun" element={<PilihAkun />} />
        <Route path="/unduh" element={<Unduh />} />
        <Route path="/app" element={<AppShell />}>
          <Route index element={<Dashboard />} />
          <Route path="pos" element={<Pos />} />
          <Route path="produk" element={<Produk />} />
          <Route path="stok" element={<Stok />} />
          <Route path="transaksi" element={<Transaksi />} />
          <Route path="laporan" element={<Laporan />} />
          <Route path="karyawan" element={<Karyawan />} />
          <Route path="users" element={<Users />} />
          <Route path="pengaturan" element={<Pengaturan />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </ErrorBoundary>
    </TooltipProvider>
  )
}