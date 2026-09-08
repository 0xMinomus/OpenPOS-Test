import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter, Navigate, Route, Routes } from 'react-router'
import { TooltipProvider } from '@/components/ui/tooltip'
import './index.css'
import ErrorBoundary from './lib/ErrorBoundary'
import { getLocalDB, hasAccount } from './lib/localdb'
import { setSession } from './lib/store'
import OfflineShell from './pages/offline/OfflineShell'
import Dashboard from './pages/offline/Dashboard'
import OfflinePos from './pages/offline/OfflinePos'
import OfflineProduk from './pages/offline/OfflineProduk'
import Stok from './pages/offline/Stok'
import OfflineTransaksi from './pages/offline/OfflineTransaksi'
import Laporan from './pages/offline/Laporan'
import Pengaturan from './pages/offline/Pengaturan'
import OfflineBackup from './pages/offline/OfflineBackup'

// Sesi offline disiapkan SEBELUM render: halaman (mis. Dashboard) membaca
// session.id di render pertama — bila telat di-set lewat effect, crash
// "Cannot read properties of null (reading 'id')" tiap boot dengan akun.
if (hasAccount()) {
  const s = getLocalDB().settings
  setSession({ id: 'local', email: '', name: s.ownerName, role: 'admin', store: s.storeName })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <TooltipProvider>
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<OfflineShell />}>
              <Route index element={<Dashboard />} />
              <Route path="pos" element={<OfflinePos />} />
              <Route path="produk" element={<OfflineProduk />} />
              <Route path="stok" element={<Stok />} />
              <Route path="transaksi" element={<OfflineTransaksi />} />
              <Route path="laporan" element={<Laporan />} />
              <Route path="pengaturan" element={<Pengaturan />} />
              <Route path="backup" element={<OfflineBackup />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ErrorBoundary>
      </TooltipProvider>
    </HashRouter>
  </StrictMode>,
)
