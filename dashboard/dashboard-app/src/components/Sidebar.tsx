"use client";

import React from "react";
import { 
  LayoutDashboard, 
  ShoppingCart, 
  LogOut,
  ChevronRight,
  User,
  Users,
  ListTodo,
  ChefHat,
  Snowflake,
  Globe,
  Database
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/AuthContext";

interface SidebarProps {
  username: string;
}

const menuItems = [
  { name: "Dashboard", icon: LayoutDashboard, path: "/" },
  { name: "Orders", icon: ShoppingCart, path: "/orders" },
  { name: "Database", icon: Database, path: "/database" },
  { name: "Preparation", icon: ListTodo, path: "/preparation" },
  { name: "Fridge", icon: Snowflake, path: "/fridge" },
  { name: "Menu Setting", icon: ChefHat, path: "/menu-settings" },
  { name: "Connections", icon: Globe, path: "/platform-connections" },
  { name: "Users", icon: Users, path: "/users" },
];

export default function Sidebar({ username }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <aside className="w-64 h-screen glass border-r border-white/10 flex flex-col p-6 z-50">
      <div className="flex items-center gap-3 mb-12">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-shred-red to-red-600 flex items-center justify-center shadow-lg shadow-shred-red/20">
          <span className="text-black font-bold text-xl">S</span>
        </div>
        <h1 className="text-xl font-bold tracking-tight neon-text">
          Shred<span className="text-shred-red">Cater</span>
        </h1>
      </div>

      <nav className="flex-1 space-y-2">
        {menuItems.map((item) => {
          const isActive = pathname === item.path || (item.path !== '/' && pathname.startsWith(item.path));
          return (
            <Link key={item.name} href={item.path}>
              <div className={`
                flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200 group
                ${isActive ? 'bg-white/10 text-shred-red' : 'text-gray-400 hover:text-white hover:bg-white/5'}
              `}>
                <item.icon size={20} className={isActive ? 'text-shred-red' : 'group-hover:text-white'} />
                <span className="font-medium">{item.name}</span>
                {isActive && (
                  <motion.div 
                    layoutId="active-pill"
                    className="ml-auto"
                  >
                    <ChevronRight size={14} />
                  </motion.div>
                )}
              </div>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto pt-6 border-t border-white/10">
        <div className="flex items-center gap-3 px-2 mb-4">
          {user?.photoURL ? (
            <img
              src={user.photoURL}
              alt="avatar"
              className="w-8 h-8 rounded-full border border-white/20"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center border border-white/20">
              <User size={16} />
            </div>
          )}
          <div className="flex flex-col overflow-hidden">
            <span className="text-sm font-medium truncate">{username}</span>
            <span className="text-xs text-gray-500 truncate">{user?.email || "Administrator"}</span>
          </div>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-4 px-4 py-3 w-full text-red-400 hover:bg-red-500/10 rounded-xl transition-colors"
        >
          <LogOut size={20} />
          <span className="font-medium">Logout</span>
        </button>
      </div>
    </aside>
  );
}

