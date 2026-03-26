"use client";

import React from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/AuthContext";
import { LogIn, ShieldAlert, LogOut, Mail } from "lucide-react";

export default function LoginGate({ children }: { children: React.ReactNode }) {
  const { user, loading, isAllowed, signInWithGoogle, logout } = useAuth();

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-obsidian">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center gap-6"
        >
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-shred-red to-red-600 flex items-center justify-center shadow-lg shadow-shred-red/30 animate-pulse">
            <span className="text-black font-bold text-3xl">S</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-shred-red animate-bounce" style={{ animationDelay: "0ms" }} />
            <div className="w-2 h-2 rounded-full bg-shred-red animate-bounce" style={{ animationDelay: "150ms" }} />
            <div className="w-2 h-2 rounded-full bg-shred-red animate-bounce" style={{ animationDelay: "300ms" }} />
          </div>
        </motion.div>
      </div>
    );
  }

  // Not signed in — show login screen
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-obsidian relative overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-shred-red/5 rounded-full blur-[150px]" />
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-shred-red/3 rounded-full blur-[120px]" />
        </div>
        
        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-[0.02]" style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)",
          backgroundSize: "60px 60px"
        }} />

        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="relative z-10 w-full max-w-md mx-6"
        >
          <div className="glass-card rounded-[2.5rem] p-10 border border-white/10 text-center">
            {/* Logo */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="w-20 h-20 rounded-2xl bg-gradient-to-br from-shred-red to-red-600 flex items-center justify-center shadow-2xl shadow-shred-red/30 mx-auto mb-8"
            >
              <span className="text-black font-bold text-4xl">S</span>
            </motion.div>

            <h1 className="text-3xl font-black mb-2 tracking-tight">
              Shred<span className="text-shred-red">Cater</span>
            </h1>
            <p className="text-gray-500 text-sm mb-10 font-medium">
              Admin Dashboard — Sign in to continue
            </p>

            <button
              onClick={signInWithGoogle}
              className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-2xl 
                bg-white text-black font-bold text-sm
                hover:bg-gray-100 active:scale-[0.98] transition-all duration-200
                shadow-lg shadow-white/10 group"
            >
              {/* Google G icon */}
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Sign in with Google
            </button>

            <p className="text-gray-600 text-[10px] mt-6 font-medium uppercase tracking-widest">
              Authorized personnel only
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  // Signed in but not allowed
  if (isAllowed === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-obsidian relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/3 left-1/3 w-96 h-96 bg-red-500/5 rounded-full blur-[150px]" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="relative z-10 w-full max-w-md mx-6"
        >
          <div className="glass-card rounded-[2.5rem] p-10 border border-red-500/20 text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="w-20 h-20 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto mb-8 border border-red-500/20"
            >
              <ShieldAlert size={36} className="text-red-400" />
            </motion.div>

            <h1 className="text-2xl font-black mb-3 text-red-400">
              Access Denied
            </h1>
            <p className="text-gray-500 text-sm mb-4 font-medium leading-relaxed">
              Your account is not authorized to access this dashboard.
            </p>

            <div className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/5 border border-white/10 mb-8">
              <Mail size={14} className="text-gray-400" />
              <span className="text-sm text-gray-300 font-medium truncate">
                {user.email}
              </span>
            </div>

            <p className="text-gray-600 text-xs mb-6">
              Please contact an administrator to get access.
            </p>

            <button
              onClick={logout}
              className="flex items-center justify-center gap-2 px-6 py-3 rounded-2xl w-full
                bg-white/5 border border-white/10 text-gray-400
                hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20
                transition-all duration-200 font-bold text-sm"
            >
              <LogOut size={16} />
              Sign out & try another account
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // Still checking allowlist
  if (isAllowed === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-obsidian">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="w-12 h-12 rounded-xl border-2 border-shred-red/30 border-t-shred-red animate-spin" />
          <p className="text-gray-500 text-sm font-medium">Verifying access...</p>
        </motion.div>
      </div>
    );
  }

  // Allowed — render children
  return <>{children}</>;
}
