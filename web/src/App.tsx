import { Navigate, Route, Routes } from 'react-router'
import { TooltipProvider } from '@/components/ui/tooltip'
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

export default function App() {
  return (
    <TooltipProvider>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/masuk" element={<Masuk />} />
        <Route path="/daftar" element={<Daftar />} />
        <Route path="/app" element={<AppShell />}>
          <Route index element={<Dashboard />} />
          <Route path="pos" element={<Pos />} />
          <Route path="produk" element={<Produk />} />
          <Route path="stok" element={<Stok />} />
          <Route path="transaksi" element={<Transaksi />} />
          <Route path="laporan" element={<Laporan />} />
          <Route path="users" element={<Users />} />
          <Route path="pengaturan" element={<Pengaturan />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </TooltipProvider>
  )
}