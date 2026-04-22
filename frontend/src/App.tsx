import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { AccountDetailPage } from './pages/AccountDetailPage'
import { AccountsPage } from './pages/AccountsPage'
import { DashboardPage } from './pages/DashboardPage'
import { OpportunitiesPage } from './pages/OpportunitiesPage'
import { ProductsPage } from './pages/ProductsPage'
import { SalesOrderDetailPage } from './pages/SalesOrderDetailPage'
import { SalesOrdersPage } from './pages/SalesOrdersPage'

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<DashboardPage />} />
        <Route path="accounts" element={<AccountsPage />} />
        <Route path="accounts/:id" element={<AccountDetailPage />} />
        <Route path="opportunities" element={<OpportunitiesPage />} />
        <Route path="salesorders" element={<SalesOrdersPage />} />
        <Route path="salesorders/:id" element={<SalesOrderDetailPage />} />
        <Route path="products" element={<ProductsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
