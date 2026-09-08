import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter, Navigate, Route, Routes } from 'react-router'
import { TooltipProvider } from '@/components/ui/tooltip'
import './index.css'
import ErrorBoundary from './lib/ErrorBoundary'
import OfflineShell from './pages/offline/OfflineShell'
import OfflinePos from './pages/offline/OfflinePos'
import OfflineProduk from './pages/offline/OfflineProduk'
import OfflineTransaksi from './pages/offline/OfflineTransaksi'
import OfflineBackup from './pages/offline/OfflineBackup'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <TooltipProvider>
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<OfflineShell />}>
              <Route index element={<OfflinePos />} />
              <Route path="kasir" element={<OfflinePos />} />
              <Route path="produk" element={<OfflineProduk />} />
              <Route path="transaksi" element={<OfflineTransaksi />} />
              <Route path="backup" element={<OfflineBackup />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ErrorBoundary>
      </TooltipProvider>
    </HashRouter>
  </StrictMode>,
)
