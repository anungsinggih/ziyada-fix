import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom'
import { useEffect, useState, lazy, Suspense } from 'react'
import { supabase } from './supabaseClient'
import { Icons } from './components/ui/Icons'
import { MobileHeader } from './components/MobileHeader'


// Eager load only essential components
import Login from './components/Login'

// Lazy load all page components
const Customers = lazy(() => import('./components/Customers'))
const Vendors = lazy(() => import('./components/Vendors'))
const CustomerPricePage = lazy(() => import('./components/CustomerPricePage'))
const COA = lazy(() => import('./components/COA'))
const OpeningBalance = lazy(() => import('./components/OpeningBalance'))
const Sales = lazy(() => import('./components/Sales'))
const SalesHistory = lazy(() => import('./components/SalesHistory'))
const SalesDetail = lazy(() => import('./components/SalesDetail'))
const SalesEdit = lazy(() => import('./components/SalesEdit'))
const Purchases = lazy(() => import('./components/Purchases'))
const PurchaseHistory = lazy(() => import('./components/PurchaseHistory'))
const PurchaseDetail = lazy(() => import('./components/PurchaseDetail'))
const PurchaseEdit = lazy(() => import('./components/PurchaseEdit'))
const PurchaseReturn = lazy(() => import('./components/PurchaseReturn'))
const PurchaseReturnHistory = lazy(() => import('./components/PurchaseReturnHistory'))
const PurchaseReturnDetail = lazy(() => import('./components/PurchaseReturnDetail'))
const StockAdjustment = lazy(() => import('./components/StockAdjustment'))
const StockCard = lazy(() => import('./components/StockCard'))
const OpeningStock = lazy(() => import('./components/OpeningStock'))
const SalesReturn = lazy(() => import('./components/SalesReturn'))
const SalesReturnHistory = lazy(() => import('./components/SalesReturnHistory'))
const SalesReturnDetail = lazy(() => import('./components/SalesReturnDetail'))
const Finance = lazy(() => import('./components/Finance'))
const Reporting = lazy(() => import('./components/Reporting'))
const PeriodLock = lazy(() => import('./components/PeriodLock'))
const DevResetData = lazy(() => import('./components/DevResetData'))
const Journals = lazy(() => import('./components/Journals'))
const ManualJournal = lazy(() => import('./components/ManualJournal'))
const Dashboard = lazy(() => import('./components/Dashboard'))
const CompanySettings = lazy(() => import('./components/CompanySettings'))
const Attributes = lazy(() => import('./components/Attributes'))
const Items = lazy(() => import('./components/Items'))
const BrandsCategories = lazy(() => import('./components/BrandsCategories'))
const Inventory = lazy(() => import('./components/Inventory'))

import type { Session } from '@supabase/supabase-js'

// ... imports

function SidebarLink({ to, icon: Icon, children, end = false }: { to: string, icon: React.ElementType, children: React.ReactNode, end?: boolean }) {
  const location = useLocation();
  const isActive = end ? location.pathname === to : location.pathname.startsWith(to);

  return (
    <Link
      to={to}
      className={`
        flex items-center gap-2 px-3 py-2 rounded-md transition-all duration-200 text-sm
        ${isActive
          ? 'bg-slate-800 text-white pl-4 shadow-md shadow-black/20'
          : 'text-slate-400 hover:bg-slate-800 hover:text-white hover:pl-4 opacity-80 hover:opacity-100'
        }
      `}
    >
      <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-400' : 'opacity-70 group-hover:opacity-100'}`} />
      {children}
    </Link>
  )
}


// ... imports

function PageWrapper({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  return (
    <div key={location.pathname} className="animate-in fade-in slide-in-from-bottom-2 duration-300 fill-mode-both">
      {children}
    </div>
  )
}

function SidebarGroup({ title, children, defaultOpen = false }: { title: string, children: React.ReactNode, defaultOpen?: boolean }) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  return (
    <div className="mb-6">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider hover:text-slate-300 transition-colors focus:outline-none group"
      >
        <span>{title}</span>
        {isOpen ?
          <Icons.ChevronDown className="w-3 h-3 text-slate-600 group-hover:text-slate-400" /> :
          <Icons.ChevronRight className="w-3 h-3 text-slate-600 group-hover:text-slate-400" />
        }
      </button>
      {isOpen && (
        <div className="mt-1 animate-in slide-in-from-top-1 duration-200 space-y-0.5">
          {children}
        </div>
      )}
    </div>
  )
}

function NotAuthorized({ message = "Anda tidak memiliki akses ke halaman ini." }: { message?: string }) {
  return (
    <div className="w-full p-8">
      <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-md flex items-center gap-2">
        <Icons.Warning className="w-5 h-5 flex-shrink-0" />
        {message}
      </div>
    </div>
  )
}

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [userProfile, setUserProfile] = useState<{ full_name: string | null, role: string } | null>(null)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [periodStatus, setPeriodStatus] = useState<'OPEN' | 'CLOSED' | null>(null)
  const isOwner = userProfile?.role === 'OWNER'
  const canAccessFinance = isOwner

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) fetchUserProfile(session.user.id)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) fetchUserProfile(session.user.id)
      else setUserProfile(null)
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) return
    const handleProfileUpdated = () => {
      fetchUserProfile(session.user.id)
    }
    window.addEventListener('user-profile-updated', handleProfileUpdated)
    return () => window.removeEventListener('user-profile-updated', handleProfileUpdated)
  }, [session])

  useEffect(() => {
    if (!session || !isOwner) {
      setPeriodStatus(null)
      return
    }
    let active = true
    const fetchPeriodStatus = async () => {
      try {
        const { data, error } = await supabase
          .from('accounting_periods')
          .select('status')
          .order('end_date', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (error) return
        if (active) setPeriodStatus((data?.status as 'OPEN' | 'CLOSED') || null)
      } catch {
        if (active) setPeriodStatus(null)
      }
    }
    fetchPeriodStatus()
    return () => {
      active = false
    }
  }, [session, isOwner])

  async function fetchUserProfile(userId: string) {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('full_name, role')
        .eq('id', userId)
        .single()

      if (!error && data) {
        setUserProfile(data)
      }
    } catch (e) {
      console.error("Error fetching profile", e)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div>Loading...</div>
  if (!session) return <Login />

  // Ensure RLS works by maybe setting a global context or just letting client handle it 
  // (supabase client auto-handles token)

  return (
    <BrowserRouter>
      <div className="flex min-h-screen bg-[var(--bg-surface-alt)] text-[var(--text-main)]">
        {/* Mobile menu backdrop */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-50 md:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}


        {/* Mobile-only header bar */}
        <MobileHeader
          mobileMenuOpen={mobileMenuOpen}
          onToggleMenu={() => setMobileMenuOpen(!mobileMenuOpen)}
          periodStatus={periodStatus}
        />


        {/* Sidebar - Overlay on mobile, fixed on desktop */}
        <nav className={`
          fixed md:static inset-y-0 left-0 z-50
          w-64 bg-slate-900/95 backdrop-blur-xl text-slate-300 flex flex-col shadow-2xl border-r border-slate-800/50
          transform transition-transform duration-300 ease-in-out
          ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}>
          <div className="p-4 sm:p-6 border-b border-slate-800">
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                <img src="/logo.png" alt="Ziyada ERP" className="h-8 w-auto rounded" />
                <span className="hidden sm:inline">Ziyada ERP</span>
                <span className="sm:hidden">Ziyada</span>
              </h1>
              {/* Mobile close button */}
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="md:hidden p-1 text-slate-400 hover:text-white"
                aria-label="Close menu"
              >
                <Icons.Close className="w-6 h-6" />
              </button>
            </div>

          </div>
          <div className="flex-1 overflow-y-auto py-6 px-4 space-y-8">
            {/* Dashboard */}
            <div className="mb-8 pl-0">
              <SidebarLink to="/" icon={Icons.Chart} end={true}>Dashboard</SidebarLink>
            </div>

            <div className="space-y-2">
              {/* Transactions Group */}
              <SidebarGroup title="Sales" defaultOpen={true}>
                <ul className="space-y-1 px-2">
                  <li><SidebarLink to="/sales/history" icon={Icons.FileText}>Sales</SidebarLink></li>
                  <li><SidebarLink to="/sales-returns/history" icon={Icons.FileText}>Sales Return</SidebarLink></li>
                </ul>
              </SidebarGroup>

              <SidebarGroup title="Purchases">
                <ul className="space-y-1 px-2">
                  <li><SidebarLink to="/purchases/history" icon={Icons.FileText}>Purchase</SidebarLink></li>
                  <li><SidebarLink to="/purchase-returns/history" icon={Icons.FileText}>Purchase Return</SidebarLink></li>
                </ul>
              </SidebarGroup>

              <SidebarGroup title="Inventory">
                <ul className="space-y-1 px-2">
                  <li><SidebarLink to="/inventory" icon={Icons.Chart}>Overview</SidebarLink></li>
                  <li><SidebarLink to="/stock-adj" icon={Icons.Edit}>Stock Adjustment</SidebarLink></li>
                </ul>
              </SidebarGroup>

              {/* Master Data */}
              <SidebarGroup title="Master Data">
                <ul className="space-y-1 px-2">
                  <li><SidebarLink to="/items" icon={Icons.Package}>Products</SidebarLink></li>
                  <li><SidebarLink to="/attributes" icon={Icons.Settings}>Attributes & Groups</SidebarLink></li>
                  <li><SidebarLink to="/brands-categories" icon={Icons.Tag}>Brands & Categories</SidebarLink></li>
                  <li><SidebarLink to="/customers" icon={Icons.Users}>Customers</SidebarLink></li>
                  <li><SidebarLink to="/vendors" icon={Icons.Users}>Suppliers</SidebarLink></li>
                </ul>
              </SidebarGroup>

              {canAccessFinance && (
                <SidebarGroup title="Accounting">
                  <ul className="space-y-1 px-2">
                    <li><SidebarLink to="/finance" icon={Icons.DollarSign}>Finance (AR/AP)</SidebarLink></li>
                    <li><SidebarLink to="/coa" icon={Icons.FileText}>COA</SidebarLink></li>
                    <li><SidebarLink to="/opening-balance" icon={Icons.DollarSign}>Opening Balance</SidebarLink></li>
                    <li><SidebarLink to="/journals" icon={Icons.FileText}>Journals</SidebarLink></li>
                    <li><SidebarLink to="/reports" icon={Icons.Chart}>Finance Reports</SidebarLink></li>
                    <li><SidebarLink to="/period-lock" icon={Icons.Info}>Period Management</SidebarLink></li>
                  </ul>
                </SidebarGroup>
              )}

              {/* System Sidebar Removed - Access via Profile */}
            </div>
          </div>

          {/* User Profile Footer */}
          {session && (
            <div className="border-t border-slate-800 bg-slate-900 relative">
              <button
                onClick={() => setUserMenuOpen((prev) => !prev)}
                className="w-full p-4 hover:bg-slate-800 transition-colors group text-left"
                aria-haspopup="menu"
                aria-expanded={userMenuOpen}
              >
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300 font-bold shadow-sm group-hover:bg-indigo-500/30 transition-colors">
                    {userProfile?.full_name?.charAt(0).toUpperCase() || session.user.email?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate group-hover:text-indigo-300 transition-colors">
                      {userProfile?.full_name || 'User'}
                    </p>
                    <p className="text-xs text-slate-500 truncate group-hover:text-slate-400">
                      {session.user.email}
                    </p>
                  </div>
                  <Icons.ChevronDown className="w-4 h-4 text-slate-600 group-hover:text-slate-400" />
                </div>
              </button>
              {userMenuOpen && (
                <div className="absolute left-0 right-0 bottom-full mb-2 mx-3 rounded-md border border-slate-700 bg-slate-900 shadow-lg overflow-hidden">
                  <Link
                    to="/settings"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
                  >
                    <Icons.Settings className="w-4 h-4" />
                    Settings
                  </Link>
                  <button
                    onClick={() => {
                      setUserMenuOpen(false)
                      supabase.auth.signOut()
                    }}
                    className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
                  >
                    <Icons.Close className="w-4 h-4" />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          )}
        </nav>
        <main className="flex-1 overflow-y-auto h-screen pt-20 md:pt-0 p-2 sm:p-4 md:p-6 lg:p-8">
          {periodStatus === 'CLOSED' && (
            <div className="mb-3 md:mb-4">
              <div className="flex items-center justify-between bg-red-50 border border-red-200 text-red-800 rounded-lg px-4 py-2">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Icons.Warning className="w-4 h-4" />
                  Period CLOSED
                </div>
                <span className="text-xs text-red-600">Transactions are locked for the current period.</span>
              </div>
            </div>
          )}
          <Suspense fallback={
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                <p className="text-gray-600">Loading...</p>
              </div>
            </div>
          }>
            <PageWrapper>
              <Routes>
                <Route path="/customers" element={<Customers />} />
                <Route path="/customers/:id/pricing" element={<CustomerPricePage />} />
                <Route path="/vendors" element={<Vendors />} />
                <Route path="/coa" element={<COA />} />
                <Route path="/opening-balance" element={<OpeningBalance />} />
                <Route path="/sales" element={<Sales />} />
                <Route path="/sales/history" element={<SalesHistory />} />
                <Route path="/sales/:id" element={<SalesDetail />} />
                <Route path="/sales/:id/edit" element={<SalesEdit />} />
                <Route path="/sales-return" element={<SalesReturn />} />
                <Route path="/sales-returns/history" element={<SalesReturnHistory />} />
                <Route path="/sales-returns/:id" element={<SalesReturnDetail />} />
                <Route path="/purchases" element={<Purchases />} />
                <Route path="/purchases/history" element={<PurchaseHistory />} />
                <Route path="/purchases/:id" element={<PurchaseDetail />} />
                <Route path="/purchases/:id/edit" element={<PurchaseEdit />} />
                <Route path="/purchase-return" element={<PurchaseReturn />} />
                <Route path="/purchase-returns/history" element={<PurchaseReturnHistory />} />
                <Route path="/purchase-returns/:id" element={<PurchaseReturnDetail />} />
                <Route path="/finance" element={canAccessFinance ? <Finance /> : <NotAuthorized />} />
                <Route path="/inventory" element={<Inventory />} />
                <Route path="/stock-adj" element={<StockAdjustment />} />
                <Route path="/opening-stock" element={<OpeningStock />} />
                <Route path="/stock-card" element={<StockCard />} />
                <Route path="/journals" element={canAccessFinance ? <Journals /> : <NotAuthorized />} />
                <Route path="/journals/manual" element={canAccessFinance ? <ManualJournal /> : <NotAuthorized />} />
                <Route path="/reports" element={canAccessFinance ? <Reporting /> : <NotAuthorized />} />
                <Route path="/period-lock" element={canAccessFinance ? <PeriodLock /> : <NotAuthorized />} />
                <Route path="/period-reports" element={canAccessFinance ? <Reporting /> : <NotAuthorized />} />
                <Route path="/settings" element={<CompanySettings />} />
                <Route path="/attributes" element={<Attributes />} />
                <Route path="/brands-categories" element={<BrandsCategories />} />
                <Route path="/items" element={<Items />} />
                {/* DEV ONLY Route */}
                {import.meta.env.DEV && <Route path="/dev-reset" element={<DevResetData />} />}
                <Route path="/" element={<Dashboard isOwner={isOwner} />} />
              </Routes>
            </PageWrapper>
          </Suspense>
        </main>
      </div >
    </BrowserRouter >
  )
}

export default App
