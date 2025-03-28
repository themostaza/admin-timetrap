'use client'

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronLeft, Users, Settings, LogOut, FileClock, FolderKanban } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SidebarProps {
  isCollapsed: boolean;
  setIsCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
}

const Sidebar = ({ isCollapsed, setIsCollapsed }: SidebarProps) => {
  const pathname = usePathname();
  
  const handleLogout = async () => {
  };

  const navItems = [
    { 
      name: 'projects', 
      icon: <FolderKanban className="h-5 w-5" />,  
      href: '/dashboard/projects' 
    },
    { 
      name: 'time analysys', 
      icon: <FileClock className="h-5 w-5" />,  
      href: '/admin/analysis' 
    },
    
    { 
      name: 'working calendar', 
      icon: <Settings className="h-5 w-5" />,  
      href: '/admin/working-calendar' 
    }
  ];

  return (
    <div className={`fixed top-0 left-0 h-screen bg-gray-900 text-white transition-all duration-300 ${isCollapsed ? 'w-16' : 'w-64'} flex flex-col`}>
      <div className="p-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="mb-4 hover:bg-gray-800"
        >
          <ChevronLeft className={`h-4 w-4 transition-transform ${isCollapsed ? 'rotate-180' : ''}`} />
        </Button>
        
        <div className={`transition-opacity ${isCollapsed ? 'opacity-0 hidden' : 'opacity-100'}`}>
          <div className="flex items-center space-x-2">
            {/* <Zap className="h-6 w-6 text-white" /> */}
            <h1 className="text-2xl font-bold">timeTrap</h1>
          </div>
          <p className="text-sm text-gray-400">value your time</p>
        </div>
      </div>

      <nav className="flex-1 px-2">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center px-2 py-3 my-1 rounded-lg transition-colors
              ${pathname === item.href ? 'bg-gray-800' : 'hover:bg-gray-800'}`}
          >
            <div className="min-w-[24px]">
              {item.icon}
            </div>
            {!isCollapsed && <span className="ml-3">{item.name}</span>}
          </Link>
        ))}
      </nav>

      <div className="p-4 border-t border-gray-800">
        <div className={`flex items-center ${isCollapsed ? 'justify-center' : ''}`}>
          <Users className="h-5 w-5" />
          {!isCollapsed && <span className="ml-3">Vettoruzzo test</span>}
        </div>
        <Button
          variant="ghost"
          onClick={handleLogout}
          className={`mt-2 text-red-400 hover:text-red-300 hover:bg-gray-800 w-full flex items-center justify-${isCollapsed ? 'center' : 'start'}`}
        >
          <LogOut className="h-4 w-4" />
          {!isCollapsed && <span className="ml-3">Logout</span>}
        </Button>
      </div>
    </div>
  );
};

export default Sidebar;