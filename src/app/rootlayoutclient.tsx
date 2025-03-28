'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import Sidebar from '@/components/sidebar'
import { Toaster } from 'sonner'

export default function RootLayoutClient({
  children,
}: {
  children: React.ReactNode
}) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const pathname = usePathname()
  
  const excludedPages = [
    '/login',
    '/',
    '/terms',
    '/privacy',
  ]
  
  // Verifica se la pagina corrente è nella lista delle pagine escluse
  const shouldHideMenu = excludedPages.includes(pathname)

  // Se la pagina è nella lista delle escluse, mostra solo il contenuto
  if (shouldHideMenu) {
    return (
      <>
        {children}
        <Toaster />
      </>
    )
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} />
      <main className={`${isCollapsed ? 'ml-16' : 'ml-64'} transition-all duration-300 flex-1`}>
        {children}
      </main>
      <Toaster />
    </div>
  )
}