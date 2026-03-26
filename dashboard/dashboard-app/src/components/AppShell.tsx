"use client";

import React from "react";
import { AuthProvider, useAuth } from "@/lib/AuthContext";
import LoginGate from "@/components/LoginGate";
import Sidebar from "@/components/Sidebar";

function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const displayName = user?.displayName || user?.email?.split("@")[0] || "User";

  return (
    <div className="flex overflow-hidden">
      <Sidebar username={displayName} />
      <main className="flex-1 h-screen overflow-y-auto bg-black bg-opacity-50">
        <div className="p-8 pb-20">{children}</div>
      </main>
    </div>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <LoginGate>
        <AuthenticatedLayout>{children}</AuthenticatedLayout>
      </LoginGate>
    </AuthProvider>
  );
}
