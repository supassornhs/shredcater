"use client";

import React, { useState, useEffect } from "react";
import { Snowflake, Plus, X, Check, Scale, ShieldAlert, Loader2, Trash2, Download, Upload } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const ALLERGEN_OPTIONS = [
  "Vegan", "Vegetarian", "Have Gluten", "Have Soy", "Have Sesame", 
  "Have Nut", "Have Dairy", "Have Egg", "Have Alcohol", "Have Shell Fish", "Have Fish"
];

const UNIT_OPTIONS = ["Grams", "Piece", "ml"];

interface Ingredient {
  id?: string;
  name: string;
  amount: number;
  unit: string;
  allergens: string[];
  type?: string;
}

export default function FridgePage() {
  const [stock, setStock] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [unit, setUnit] = useState("Grams");
  const [selectedAllergens, setSelectedAllergens] = useState<string[]>([]);
  const [itemType, setItemType] = useState("ingredient");

  useEffect(() => {
    fetchStock();
  }, []);

  const fetchStock = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/stock");
      const data = await res.json();
      if (data.stock) setStock(data.stock);
    } catch (err) {
      console.error("Failed to fetch stock:", err);
    } finally {
      setLoading(false);
    }
  };

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleExportCSV = () => {
    const headers = ["name", "amount", "unit", "type", "allergens"];
    const rows = stock.map(item => {
      const allergensStr = (item.allergens || []).join("|");
      return [
        `"${item.name.replace(/"/g, '""')}"`,
        item.amount,
        `"${item.unit || ''}"`,
        `"${item.type || 'ingredient'}"`,
        `"${allergensStr}"`
      ].join(",");
    });
    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "fridge_stock_export.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const res = await fetch("/api/stock/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ csvData: text })
        });
        const data = await res.json();
        
        if (data.success) {
          alert(`Success! Uploaded ${data.count} items.`);
          fetchStock();
        } else {
          alert("Import failed: " + data.error);
        }
      } catch (err: any) {
        alert("Failed to parse file: " + err.message);
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
        setLoading(false);
      }
    };
    reader.readAsText(file);
  };

  const handleAddIngredient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !amount) return;

    try {
      setSubmitting(true);
      const res = await fetch("/api/stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          amount: parseFloat(amount),
          unit,
          allergens: selectedAllergens,
          type: itemType,
        }),
      });

      if (res.ok) {
        setShowModal(false);
        setName("");
        setAmount("");
        setSelectedAllergens([]);
        setItemType("ingredient");
        fetchStock();
      }
    } catch (err) {
      console.error("Failed to add ingredient:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const toggleAllergen = (allergen: string) => {
    setSelectedAllergens(prev => 
      prev.includes(allergen) ? prev.filter(a => a !== allergen) : [...prev, allergen]
    );
  };

  return (
    <div className="max-w-6xl mx-auto py-10 px-4 space-y-12 pb-32">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black tracking-tight mb-2">
            Fridge <span className="text-shred-red italic">Inventory</span>
          </h1>
          <p className="text-gray-500 font-medium">
            Manage raw ingredients and track allergens across your stock.
          </p>
        </div>

        <div className="flex flex-wrap gap-4">
          <input 
            type="file" 
            accept=".csv" 
            ref={fileInputRef} 
            className="hidden" 
            onChange={handleImportCSV} 
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-3 px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-white font-black text-[10px] uppercase tracking-widest shadow-xl hover:bg-white/10 active:scale-95 transition-all"
          >
            <Upload size={16} />
            Import
          </button>
          <button 
            onClick={handleExportCSV}
            className="flex items-center gap-3 px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-white font-black text-[10px] uppercase tracking-widest shadow-xl hover:bg-white/10 active:scale-95 transition-all"
          >
            <Download size={16} />
            Export
          </button>
          <button 
            onClick={() => setShowModal(true)}
            className="flex items-center gap-3 px-6 py-4 bg-shred-red rounded-2xl text-white font-black text-[10px] uppercase tracking-widest shadow-xl shadow-shred-red/20 hover:scale-105 active:scale-95 transition-all"
          >
            <Plus size={16} />
            Add
          </button>
        </div>
      </header>

      {/* Ingredient List */}
      <div className="grid grid-cols-1 gap-4">
        {loading ? (
          Array(3).fill(0).map((_, i) => (
            <div key={i} className="h-24 glass-card rounded-[2rem] animate-pulse" />
          ))
        ) : stock.length === 0 ? (
          <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-16 text-center">
            <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center text-gray-500 mx-auto mb-6">
              <Snowflake size={32} />
            </div>
            <h2 className="text-xl font-bold mb-2">Your Fridge is Empty</h2>
            <p className="text-gray-500 font-medium">Click "Add Ingredient" to start tracking your inventory.</p>
          </div>
        ) : (
          stock.map((item, i) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="glass-card rounded-[2rem] p-6 border border-white/5 flex items-center justify-between hover:border-shred-red/30 transition-all group"
            >
              <div className="flex items-center gap-6">
                <div className="w-14 h-14 bg-shred-red/10 rounded-2xl flex items-center justify-center text-shred-red">
                  <Snowflake size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-black">{item.name}</h3>
                  <div className="flex flex-wrap gap-2 mt-2 items-center">
                    <span className={`text-[8px] font-black uppercase tracking-tighter px-2 py-0.5 border rounded-full ${item.type === 'packaging' ? 'bg-blue-500/10 border-blue-500/50 text-blue-400' : 'bg-shred-red/10 border-shred-red/50 text-shred-red'}`}>
                      {item.type || 'ingredient'}
                    </span>
                    {(item.allergens || []).map(a => (
                      <span key={a} className="text-[8px] font-black uppercase tracking-tighter px-2 py-0.5 bg-white/5 border border-white/5 rounded-full text-gray-400">
                        {a}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-8">
                <div className="text-right">
                  <div className="text-3xl font-black text-white">{item.amount.toLocaleString()}</div>
                  <div className="text-[10px] text-gray-500 uppercase font-black tracking-widest text-right">{item.unit || "Grams"}</div>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Add Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowModal(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl glass-card rounded-[3rem] p-10 border border-white/10 shadow-2xl overflow-hidden"
            >
              <button 
                onClick={() => setShowModal(false)}
                className="absolute right-8 top-8 text-gray-500 hover:text-white transition-colors"
              >
                <X size={24} />
              </button>

              <div className="mb-10">
                <h2 className="text-3xl font-black mb-2">New <span className="text-shred-red italic">Ingredient</span></h2>
                <p className="text-gray-500 font-medium">Add to your centralized stock database.</p>
              </div>

              <form onSubmit={handleAddIngredient} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-4">Ingredient Name</label>
                    <input 
                      autoFocus
                      required
                      type="text"
                      placeholder="e.g. Fresh Atlantic Salmon"
                      className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 focus:outline-none focus:border-shred-red/50 transition-all font-bold"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-4">Starting Amount</label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <input 
                          required
                          type="number"
                          placeholder="0.00"
                          className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 focus:outline-none focus:border-shred-red/50 transition-all font-bold"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                        />
                      </div>
                      <select 
                        className="bg-white/5 border border-white/10 rounded-2xl py-4 px-4 focus:outline-none focus:border-shred-red/50 transition-all font-bold text-xs uppercase tracking-widest"
                        value={unit}
                        onChange={(e) => setUnit(e.target.value)}
                      >
                        {UNIT_OPTIONS.map(u => (
                          <option key={u} value={u} className="bg-[#121212]">{u}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-2 ml-4">
                    <ShieldAlert size={14} className="text-shred-red" />
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Item Type</label>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setItemType("ingredient")}
                      className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-all text-left ${itemType === 'ingredient' ? 'bg-shred-red/10 border-shred-red text-white' : 'bg-white/5 border-white/5 text-gray-500 hover:border-white/20'}`}
                    >
                      <span className="text-[10px] font-black uppercase tracking-tight">Ingredient</span>
                      {itemType === 'ingredient' && <Check size={12} className="text-shred-red" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => setItemType("packaging")}
                      className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-all text-left ${itemType === 'packaging' ? 'bg-shred-red/10 border-shred-red text-white' : 'bg-white/5 border-white/5 text-gray-500 hover:border-white/20'}`}
                    >
                      <span className="text-[10px] font-black uppercase tracking-tight">Packaging</span>
                      {itemType === 'packaging' && <Check size={12} className="text-shred-red" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-2 ml-4">
                    <ShieldAlert size={14} className="text-shred-red" />
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Is Considered</label>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {ALLERGEN_OPTIONS.map(opt => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => toggleAllergen(opt)}
                        className={`
                          flex items-center justify-between px-4 py-3 rounded-xl border transition-all text-left
                          ${selectedAllergens.includes(opt) 
                            ? 'bg-shred-red/10 border-shred-red text-white' 
                            : 'bg-white/5 border-white/5 text-gray-500 hover:border-white/20'}
                        `}
                      >
                        <span className="text-[10px] font-black uppercase tracking-tight">{opt}</span>
                        {selectedAllergens.includes(opt) && <Check size={12} className="text-shred-red" />}
                      </button>
                    ))}
                  </div>
                </div>

                <button 
                  disabled={submitting}
                  className="w-full py-5 bg-shred-red rounded-2xl text-white font-black uppercase tracking-[0.2em] text-xs shadow-xl shadow-shred-red/20 flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100"
                >
                  {submitting ? (
                    <Loader2 className="animate-spin" size={18} />
                  ) : (
                    <>
                      <Check size={18} />
                      Save to Stock
                    </>
                  )}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
