import { NavLink, Outlet } from 'react-router-dom'

const navItems: { to: string; label: string; end?: boolean }[] = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/accounts', label: 'Accounts' },
  { to: '/opportunities', label: 'Opportunities' },
  { to: '/salesorders', label: 'Orders' },
  { to: '/products', label: 'Products' },
]

export function Layout() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-slate-900 text-white shadow">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-8">
          <span className="font-bold text-lg tracking-tight">
            <span className="text-emerald-400">He</span>CRM
          </span>
          <nav className="flex gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-md text-sm transition-colors ${
                    isActive
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-200 hover:bg-slate-800'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto text-xs text-slate-400">
            Dynamics 365 · Dataverse
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8">
        <Outlet />
      </main>
    </div>
  )
}
