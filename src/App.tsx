import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import { useEffect, useState, lazy, Suspense } from 'react'
import { supabase } from './supabaseClient'
import { Icons } from './components/ui/Icons'
import { MobileHeader } from './components/MobileHeader'

// Eager load only essential components
import Login from './components/Login'

// Lazy load all page components
const Customers = lazy(() => import('./components/Customers'))
const Vendors = lazy(() => import('./components/Vendors'))
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
const Dashboard = lazy(() => import('./components/Dashboard'))
const CompanySettings = lazy(() => import('./components/CompanySettings'))
const Attributes = lazy(() => import('./components/Attributes'))
const Products = lazy(() => import('./components/Products'))
const BrandsCategories = lazy(() => import('./components/BrandsCategories'))
const Inventory = lazy(() => import('./components/Inventory'))

import type { Session } from '@supabase/supabase-js'

// ... imports



function SidebarGroup({ title, children, defaultOpen = false }: { title: string, children: React.ReactNode, defaultOpen?: boolean }) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  return (
    <div className="mb-2">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-2 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider hover:text-slate-300 transition-colors focus:outline-none group"
      >
        <span>{title}</span>
        {isOpen ?
          <Icons.ChevronDown className="w-3 h-3 text-slate-600 group-hover:text-slate-400" /> :
          <Icons.ChevronRight className="w-3 h-3 text-slate-600 group-hover:text-slate-400" />
        }
      </button>
      {isOpen && (
        <div className="mt-1 animate-in slide-in-from-top-1 duration-200">
          {children}
        </div>
      )}
    </div>
  )
}

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
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
            className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}


        {/* Mobile-only header bar */}
        <MobileHeader
          mobileMenuOpen={mobileMenuOpen}
          onToggleMenu={() => setMobileMenuOpen(!mobileMenuOpen)}
        />


        {/* Sidebar - Overlay on mobile, fixed on desktop */}
        <nav className={`
          fixed md:static inset-y-0 left-0 z-50
          w-64 bg-slate-900 text-slate-300 flex flex-col shadow-xl border-r border-slate-800
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
            <Link to="/" className="flex items-center gap-3 px-3 py-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-md transition-colors mb-6 group">
              <Icons.Chart className="w-5 h-5 text-slate-400 group-hover:text-[var(--primary)] transition-colors" />
              <span className="font-medium">Dashboard</span>
            </Link>

            <div className="space-y-4">
              {/* Transactions Group */}
              <SidebarGroup title="Sales">
                <ul className="space-y-1 px-2">
                  <li><Link to="/sales/history" className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-slate-800 hover:text-white transition-colors text-sm text-slate-300"><Icons.FileText className="w-4 h-4" /> Sales History</Link></li>
                  <li><Link to="/sales-returns/history" className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-slate-800 hover:text-white transition-colors text-sm text-slate-300"><Icons.FileText className="w-4 h-4" /> Sales Return History</Link></li>
                </ul>
              </SidebarGroup>

              <SidebarGroup title="Purchases">
                <ul className="space-y-1 px-2">
                  <li><Link to="/purchases/history" className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-slate-800 hover:text-white transition-colors text-sm text-slate-300"><Icons.FileText className="w-4 h-4" /> Purchase History</Link></li>
                  <li><Link to="/purchase-returns/history" className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-slate-800 hover:text-white transition-colors text-sm text-slate-300"><Icons.FileText className="w-4 h-4" /> Purchase Return History</Link></li>
                </ul>
              </SidebarGroup>


              <SidebarGroup title="Inventory">
                <ul className="space-y-1 px-2">
                  <li><Link to="/inventory" className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-slate-800 hover:text-white transition-colors text-sm text-slate-300"><Icons.Chart className="w-4 h-4" /> Overview</Link></li>
                  <li><Link to="/stock-adj" className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-slate-800 hover:text-white transition-colors text-sm text-slate-300"><Icons.Edit className="w-4 h-4" /> Stock Adj (History)</Link></li>
                </ul>
              </SidebarGroup>

              {/* Master Data */}
              <SidebarGroup title="Master Data">
                <ul className="space-y-1 px-2">
                  <li><Link to="/products" className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-slate-800 hover:text-white transition-colors text-sm text-slate-300"><Icons.Package className="w-4 h-4" /> Products</Link></li>
                  <li><Link to="/attributes" className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-slate-800 hover:text-white transition-colors text-sm text-slate-300"><Icons.Settings className="w-4 h-4" /> Attributes & Groups</Link></li>
                  <li><Link to="/brands-categories" className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-slate-800 hover:text-white transition-colors text-sm text-slate-300"><Icons.Tag className="w-4 h-4" /> Brands & Categories</Link></li>
                  <li><Link to="/customers" className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-slate-800 hover:text-white transition-colors text-sm text-slate-300"><Icons.Users className="w-4 h-4" /> Customers</Link></li>
                  <li><Link to="/vendors" className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-slate-800 hover:text-white transition-colors text-sm text-slate-300"><Icons.Users className="w-4 h-4" /> Vendors</Link></li>
                </ul>
              </SidebarGroup>

              <SidebarGroup title="Accounting">
                <ul className="space-y-1 px-2">
                  <li><Link to="/finance" className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-slate-800 hover:text-white transition-colors text-sm text-slate-300"><Icons.DollarSign className="w-4 h-4" /> Finance (AR/AP)</Link></li>
                  <li><Link to="/coa" className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-slate-800 hover:text-white transition-colors text-sm text-slate-300"><Icons.FileText className="w-4 h-4" /> COA</Link></li>
                  <li><Link to="/opening-balance" className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-slate-800 hover:text-white transition-colors text-sm text-slate-300"><Icons.DollarSign className="w-4 h-4" /> Opening Balance</Link></li>
                  <li><Link to="/journals" className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-slate-800 hover:text-white transition-colors text-sm text-slate-300"><Icons.FileText className="w-4 h-4" /> Journals</Link></li>
                  <li><Link to="/reports" className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-slate-800 hover:text-white transition-colors text-sm text-slate-300"><Icons.Chart className="w-4 h-4" /> Reports</Link></li>
                  <li><Link to="/period-lock" className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-slate-800 hover:text-white transition-colors text-sm text-slate-300"><Icons.Info className="w-4 h-4" /> Period Lock</Link></li>
                </ul>
              </SidebarGroup>

              {/* System */}
              <SidebarGroup title="System">
                <ul className="space-y-1 px-2">
                  <li><Link to="/settings" className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-slate-800 hover:text-white transition-colors text-sm text-slate-300"><Icons.Settings className="w-4 h-4" /> Settings</Link></li>
                  <li><button onClick={handleLogout} className="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-slate-800 hover:text-white transition-colors text-sm text-slate-300"><Icons.Close className="w-4 h-4" /> Sign Out</button></li>
                </ul>
              </SidebarGroup>
            </div>

            {/* DEV ONLY Section */}
            {import.meta.env.DEV && (
              <div className="border-t border-slate-700 pt-4 px-4 pb-6">
                <h3 className="text-xs font-semibold text-orange-400 uppercase tracking-wider mb-3 px-2 flex items-center gap-2"><Icons.Settings className="w-3 h-3" /> Dev Tools</h3>
                <ul className="space-y-1">
                  <li><Link to="/dev-reset" className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-orange-800 hover:text-orange-100 transition-colors text-sm bg-orange-900/30 text-orange-300"><Icons.Trash className="w-4 h-4" /> Reset Data</Link></li>
                </ul>
              </div>
            )}
          </div>
        </nav>
        <main className="flex-1 overflow-y-auto h-screen pt-20 md:pt-0 p-2 sm:p-4 md:p-6 lg:p-8">
          <Suspense fallback={
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                <p className="text-gray-600">Loading...</p>
              </div>
            </div>
          }>
            <Routes>
              <Route path="/customers" element={<Customers />} />
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
              <Route path="/finance" element={<Finance />} />
              <Route path="/inventory" element={<Inventory />} />
              <Route path="/stock-adj" element={<StockAdjustment />} />
              <Route path="/opening-stock" element={<OpeningStock />} />
              <Route path="/stock-card" element={<StockCard />} />
              <Route path="/journals" element={<Journals />} />
              <Route path="/reports" element={<Reporting />} />
              <Route path="/period-lock" element={<PeriodLock />} />
              <Route path="/period-lock" element={<PeriodLock />} />
              <Route path="/period-reports" element={<PeriodLock />} />
              <Route path="/settings" element={<CompanySettings />} />
              <Route path="/attributes" element={<Attributes />} />
              <Route path="/brands-categories" element={<BrandsCategories />} />
              <Route path="/products" element={<Products />} />
              {/* DEV ONLY Route */}
              {import.meta.env.DEV && <Route path="/dev-reset" element={<DevResetData />} />}
              <Route path="/" element={<Dashboard />} />
            </Routes>
          </Suspense>
        </main>
      </div>
    </BrowserRouter>
  )
}

export default App
