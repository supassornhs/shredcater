"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Globe, RefreshCw, CheckCircle2, AlertCircle, Link as LinkIcon, ExternalLink, Key, Check, X } from "lucide-react";

interface Platform {
  id: string;
  name: string;
  url: string;
  email: string;
  status: "connected" | "error" | "checking" | "idle";
  lastSync: string;
  iconColor: string;
}

export default function PlatformConnections() {
  const [platforms, setPlatforms] = useState<Platform[]>([
    {
      id: "clubfeast",
      name: "ClubFeast",
      url: "https://restaurant.clubfeast.com/?tab=open",
      email: "padpad@holyshred.co", // from index.js authorization header decoding, or general known email
      status: "connected",
      lastSync: "2 hours ago",
      iconColor: "text-blue-400",
    },
    {
      id: "cater2me",
      name: "Cater2.me",
      url: "https://vendor.cater2.me/",
      email: "Supassorn@holyshred.co",
      status: "connected",
      lastSync: "3 hours ago",
      iconColor: "text-green-400",
    },
    {
      id: "ezcater",
      name: "ezCater",
      url: "https://ezmanage.ezcater.com/orders",
      email: "Supassorn@holyshred.co",
      status: "connected",
      lastSync: "Just now",
      iconColor: "text-orange-400",
    },
    {
      id: "foodja",
      name: "Foodja",
      url: "https://foodja.com/restaurant-portal/",
      email: "Supassorn@holyshred.co",
      status: "connected",
      lastSync: "Just now",
      iconColor: "text-red-400",
    },
    {
      id: "hungry",
      name: "Hungry",
      url: "https://chefs.tryhungry.com/",
      email: "padpad@holyshred.co",
      status: "connected",
      lastSync: "Just now",
      iconColor: "text-purple-400",
    }
  ]);

  const [editingCookie, setEditingCookie] = useState<string | null>(null);
  const [cookieInput, setCookieInput] = useState<string>("");
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    // Fetch currently saved ClubFeast cookie from Firebase
    fetch('/api/settings').then(res => res.json()).then(data => {
      setPlatforms(prev => prev.map(p => {
         const conf = data[p.id];
         if (conf && (conf.cookie || conf.auth)) {
            return { ...p, status: 'connected', lastSync: conf.last_updated ? new Date(conf.last_updated._seconds * 1000).toLocaleTimeString() : 'Just updated' };
         }
         return { ...p, status: 'error', lastSync: 'Missing Auth' };
      }));
    }).catch(e => console.error("Error loading settings:", e));
  }, []);

  const savePlatformCookie = async (id: string) => {
    setSavingSettings(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, cookie: cookieInput }),
      });
      if (res.ok) {
         setPlatforms(prev => prev.map(p => p.id === id ? { ...p, status: 'connected', lastSync: 'Just updated' } : p));
         setEditingCookie(null);
         setCookieInput("");
      }
    } catch(err) {
      console.error(err);
    }
    setSavingSettings(false);
  };

  const testConnection = (id: string) => {
    setPlatforms(prev => prev.map(p => p.id === id ? { ...p, status: 'checking' } : p));
    
    // Simulate API call to test connection
    setTimeout(() => {
      setPlatforms(prev => prev.map(p => 
        p.id === id 
          ? { ...p, status: Math.random() > 0.1 ? 'connected' : 'error', lastSync: 'Just now' } 
          : p
      ));
    }, 2000);
  };

  const syncAll = () => {
    platforms.forEach(p => testConnection(p.id));
  };

  return (
    <div className="max-w-6xl mx-auto py-10 px-4 space-y-12">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-end justify-between gap-6"
      >
        <div>
          <h1 className="text-4xl font-black mb-2 flex items-center gap-4">
            <Globe className="text-shred-red" size={36} />
            Platform <span className="text-transparent bg-clip-text bg-gradient-to-r from-shred-red to-red-600">Connections</span>
          </h1>
          <p className="text-gray-400 text-lg">Manage and verify connections to your external catering sources.</p>
        </div>

        <button 
          onClick={syncAll}
          className="flex items-center gap-2 px-6 py-3 rounded-2xl font-bold bg-shred-red text-white hover:bg-red-600 transition-all shadow-[0_0_20px_rgba(255,49,49,0.3)] hover:shadow-[0_0_30px_rgba(255,49,49,0.5)]"
        >
          <RefreshCw size={18} className={platforms.some(p => p.status === 'checking') ? 'animate-spin' : ''} />
          Sync All Statuses
        </button>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {platforms.map((platform, i) => (
          <motion.div
            key={platform.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.1 }}
            className={`
              glass-card p-6 rounded-3xl border transition-all duration-300 relative overflow-hidden group
              ${platform.status === 'connected' ? 'border-white/10 hover:border-green-500/30' : 
                platform.status === 'error' ? 'border-red-500/50' : 'border-shred-red/30'}
            `}
          >
            {/* Status light */}
            <div className={`
              absolute top-0 left-0 w-full h-1 
              ${platform.status === 'connected' ? 'bg-gradient-to-r from-green-400 to-green-600' : 
                platform.status === 'error' ? 'bg-gradient-to-r from-red-500 to-red-700' : 
                'bg-gradient-to-r from-shred-red to-orange-500'}
            `} />

            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center ${platform.iconColor}`}>
                  <LinkIcon size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold">{platform.name}</h3>
                  <a href={platform.url} target="_blank" rel="noreferrer" className="text-xs text-gray-400 flex items-center gap-1 hover:text-shred-red transition-colors">
                    Visit Portal <ExternalLink size={12} />
                  </a>
                </div>
              </div>
            </div>

            <div className="space-y-4 mb-8">
              <div>
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Account Email</span>
                <p className="text-sm font-medium text-white">{platform.email}</p>
              </div>
              <div className="flex justify-between items-end">
                <div>
                  <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Last Synced</span>
                  <p className="text-sm font-medium text-white">{platform.lastSync}</p>
                </div>
                <div className="flex items-center gap-2">
                  {platform.status === 'connected' && <span className="flex items-center gap-1 text-xs font-bold text-green-400"><CheckCircle2 size={14} /> Connected</span>}
                  {platform.status === 'error' && <span className="flex items-center gap-1 text-xs font-bold text-red-500"><AlertCircle size={14} /> Error</span>}
                  {platform.status === 'checking' && <span className="flex items-center gap-1 text-xs font-bold text-shred-red"><RefreshCw size={14} className="animate-spin" /> Checking...</span>}
                </div>
              </div>
            </div>

            {editingCookie === platform.id ? (
              <AnimatePresence>
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="my-4">
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-black uppercase text-gray-500 tracking-widest flex items-center gap-1">
                      <Key size={10} /> Active Token / Cookie
                    </label>
                    <input 
                      type="text"
                      className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-shred-red transition-all"
                      placeholder="e.g. token=eyJ..."
                      value={cookieInput}
                      onChange={(e) => setCookieInput(e.target.value)}
                      autoFocus
                    />
                    <div className="flex gap-2 mt-2">
                       <button onClick={() => savePlatformCookie(platform.id)} disabled={savingSettings} className={`flex-1 py-2 rounded-lg text-xs font-bold text-white bg-shred-red hover:bg-red-600 transition-all flex items-center justify-center gap-1`}>
                         {savingSettings ? <RefreshCw size={14} className="animate-spin" /> : <><Check size={14} /> Save Authentication</>}
                       </button>
                       <button onClick={() => setEditingCookie(null)} className="px-3 py-2 rounded-lg text-xs font-bold text-gray-400 bg-white/5 hover:bg-white/10 transition-all flex items-center justify-center">
                         <X size={14} />
                       </button>
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            ) : (
              <div className="flex flex-col gap-3">
                  <button 
                    onClick={() => testConnection(platform.id)}
                    disabled={platform.status === 'checking'}
                    className={`
                      w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all
                      ${platform.status === 'checking' 
                        ? 'bg-white/5 text-gray-500 cursor-not-allowed' 
                        : 'bg-white/5 hover:bg-white/10 text-white'}
                    `}
                  >
                    <RefreshCw size={16} className={platform.status === 'checking' ? 'animate-spin' : ''} />
                    {platform.status === 'checking' ? 'Testing...' : 'Test Connection'}
                  </button>

                  <button 
                     onClick={() => setEditingCookie(platform.id)} 
                     className="w-full py-2 flex justify-center text-[10px] font-bold tracking-widest text-gray-500 uppercase hover:text-shred-red transition-colors items-center gap-1"
                  >
                     <Key size={12} /> Update Cookie Token
                  </button>
              </div>
            )}
            
          </motion.div>
        ))}
      </div>
    </div>
  );
}
