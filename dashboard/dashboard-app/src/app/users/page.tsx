"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Plus, Trash2, Mail, Shield, Loader2, Search, UserPlus, X } from "lucide-react";

interface AllowedUser {
  id: string;
  email: string;
  added_at?: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<AllowedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [newEmail, setNewEmail] = useState("");
  const [adding, setAdding] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/auth/users");
      const data = await res.json();
      setUsers(data.users || []);
    } catch {
      console.error("Failed to fetch users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const addUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) return;

    setAdding(true);
    setError("");

    try {
      const res = await fetch("/api/auth/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newEmail.trim() }),
      });
      const data = await res.json();

      if (data.error) {
        setError(data.error);
      } else {
        setNewEmail("");
        setShowAddForm(false);
        fetchUsers();
      }
    } catch {
      setError("Failed to add user");
    } finally {
      setAdding(false);
    }
  };

  const removeUser = async (id: string) => {
    setDeletingId(id);
    try {
      await fetch("/api/auth/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      fetchUsers();
    } catch {
      console.error("Failed to remove user");
    } finally {
      setDeletingId(null);
    }
  };

  const filteredUsers = users.filter((u) =>
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-4xl mx-auto py-10 px-4 space-y-10">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-end justify-between gap-6"
      >
        <div>
          <h1 className="text-5xl font-black mb-4 leading-tight">
            Authorized{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-shred-red to-red-600">
              Users
            </span>
          </h1>
          <p className="text-gray-500 text-lg">
            Manage who can access the ShredCater dashboard.
          </p>
        </div>

        <button
          onClick={() => { setShowAddForm(true); setError(""); }}
          className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-shred-red text-white font-bold text-sm
            hover:bg-red-600 active:scale-[0.97] transition-all duration-200
            shadow-lg shadow-shred-red/20 shrink-0"
        >
          <UserPlus size={18} />
          Add User
        </button>
      </motion.div>

      {/* Add User Modal */}
      <AnimatePresence>
        {showAddForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowAddForm(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="glass-card rounded-[2rem] p-8 w-full max-w-md border border-white/10"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-black flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-shred-red/10">
                    <UserPlus size={20} className="text-shred-red" />
                  </div>
                  Add New User
                </h2>
                <button
                  onClick={() => setShowAddForm(false)}
                  className="p-2 rounded-xl hover:bg-white/10 transition-colors text-gray-400 hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={addUser} className="space-y-4">
                <div>
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 block">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail
                      size={16}
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"
                    />
                    <input
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="user@example.com"
                      className="w-full pl-11 pr-4 py-3.5 rounded-xl bg-white/5 border border-white/10 
                        text-white placeholder-gray-600 focus:outline-none focus:border-shred-red/50 
                        focus:bg-white/[0.07] transition-all text-sm font-medium"
                      autoFocus
                      required
                    />
                  </div>
                </div>

                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-red-400 text-xs font-medium bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3"
                  >
                    {error}
                  </motion.div>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 
                      text-gray-400 font-bold text-sm hover:bg-white/10 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={adding || !newEmail.trim()}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl 
                      bg-shred-red text-white font-bold text-sm
                      hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed 
                      transition-all active:scale-[0.97]"
                  >
                    {adding ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Plus size={16} />
                    )}
                    {adding ? "Adding..." : "Add User"}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats Bar */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass-card rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
      >
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-shred-red/10">
              <Shield size={16} className="text-shred-red" />
            </div>
            <div>
              <div className="text-[9px] font-black text-gray-500 uppercase tracking-wider">
                Total Users
              </div>
              <div className="text-lg font-black">{users.length}</div>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search users..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 
              text-white placeholder-gray-600 focus:outline-none focus:border-shred-red/30 
              transition-all text-xs font-medium"
          />
        </div>
      </motion.div>

      {/* User List */}
      <div className="space-y-3">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 size={28} className="text-shred-red animate-spin" />
            <p className="text-gray-500 text-sm font-medium">Loading users...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="glass-card rounded-[2rem] py-16 text-center border-dashed border-2 border-white/10"
          >
            <Users size={32} className="text-gray-600 mx-auto mb-4" />
            <p className="text-gray-500 font-medium">
              {searchQuery ? "No users match your search." : "No authorized users yet."}
            </p>
            {!searchQuery && (
              <p className="text-gray-600 text-sm mt-2">
                Click "Add User" to authorize someone.
              </p>
            )}
          </motion.div>
        ) : (
          <AnimatePresence mode="popLayout">
            {filteredUsers.map((user, i) => (
              <motion.div
                key={user.id}
                layout
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20, transition: { duration: 0.2 } }}
                transition={{ delay: i * 0.03 }}
                className="glass-card rounded-2xl px-6 py-4 border border-white/5 
                  hover:border-white/15 transition-all group flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-shred-red/20 to-red-600/10 
                    flex items-center justify-center border border-shred-red/20 
                    group-hover:border-shred-red/40 transition-colors">
                    <span className="text-shred-red font-black text-sm">
                      {user.email.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <div className="font-bold text-sm text-white group-hover:text-shred-red transition-colors">
                      {user.email}
                    </div>
                    {user.added_at && (
                      <div className="text-[10px] text-gray-600 font-medium mt-0.5">
                        Added {new Date(user.added_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </div>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => removeUser(user.id)}
                  disabled={deletingId === user.id}
                  className="p-2.5 rounded-xl text-gray-600 hover:text-red-400 hover:bg-red-500/10 
                    transition-all opacity-0 group-hover:opacity-100 disabled:opacity-50"
                  title="Remove user"
                >
                  {deletingId === user.id ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Trash2 size={16} />
                  )}
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
