"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChefHat, Plus, Save, Trash2, X, Loader2, Pencil } from "lucide-react";

interface StockItem {
  id: string;
  name: string;
  amount: number;
  type?: string;
  allergens?: string[];
}

interface ComponentIngredient {
  stockId: string;
  name: string;
  amount: number;
}

const PLATFORMS = ["Doordash", "Ezcater", "Chef", "ClubFeast", "Foodja", "Fooda", "Cater2.me", "ZeroCater", "Forkable"];

export default function MenuSettingsPage() {
  const [stock, setStock] = useState<StockItem[]>([]);
  const [activeComponents, setActiveComponents] = useState<any[]>([]);
  const [activeMenus, setActiveMenus] = useState<any[]>([]);
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [showMenuModal, setShowMenuModal] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Component State
  const [componentName, setComponentName] = useState("");
  const [serving, setServing] = useState<number>(1);
  const [ingredients, setIngredients] = useState<ComponentIngredient[]>([]);

  // Menu State
  const [menuName, setMenuName] = useState("");
  const [menuPrice, setMenuPrice] = useState<number | "">("");
  const [menuPackaging, setMenuPackaging] = useState<{name: string, quantity: number}[]>([]);
  const [selectedComponents, setSelectedComponents] = useState<string[]>([]);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);

  const [editingComponentId, setEditingComponentId] = useState<string | null>(null);
  const [editingMenuId, setEditingMenuId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const [resStock, resComp, resMenu] = await Promise.all([
          fetch('/api/stock'),
          fetch('/api/components'),
          fetch('/api/menu')
        ]);
        const dataStock = await resStock.json();
        const dataComp = await resComp.json();
        const dataMenu = await resMenu.json();
        
        if (dataStock.stock) setStock(dataStock.stock);
        if (dataComp.components) setActiveComponents(dataComp.components);
        if (dataMenu.menus) setActiveMenus(dataMenu.menus);
      } catch (err) {
        console.error(err);
      }
    }
    fetchData();
  }, [showAddModal, showMenuModal]);

  const openEditComponent = (c: any) => {
    setEditingComponentId(c.id);
    setComponentName(c.name);
    setServing(c.serving || 1);
    setIngredients(c.ingredients || []);
    setShowAddModal(true);
  };

  const openEditMenu = (m: any) => {
    setEditingMenuId(m.id);
    setMenuName(m.name);
    setMenuPrice(m.price || "");
    setMenuPackaging(
      Array.isArray(m.packaging) 
        ? m.packaging 
        : typeof m.packaging === 'string' && m.packaging !== "" 
          ? [{ name: m.packaging, quantity: 1 }] 
          : []
    );
    setSelectedComponents(m.components || []);
    setSelectedPlatforms(m.platforms || []);
    setShowMenuModal(true);
  };

  const handleDeleteMenu = async (id: string) => {
    if (!confirm("Are you sure you want to delete this menu?")) return;
    try {
      await fetch(`/api/menu/${id}`, { method: 'DELETE' });
      setActiveMenus(activeMenus.filter(m => m.id !== id));
    } catch(err) { alert(err); }
  };

  const handleDeleteComponent = async (id: string) => {
    if (!confirm("Are you sure you want to delete this component? This may break menus using it.")) return;
    try {
      await fetch(`/api/components/${id}`, { method: 'DELETE' });
      setActiveComponents(activeComponents.filter(c => c.id !== id));
    } catch(err) { alert(err); }
  };

  const handleAddComponent = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: componentName,
        serving,
        ingredients
      };
      
      let url = '/api/components/add';
      let method = 'POST';
      if (editingComponentId) {
        url = `/api/components/${editingComponentId}`;
        method = 'PUT';
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to save component");
      }
      
      setShowAddModal(false);
      setEditingComponentId(null);
      setComponentName("");
      setServing(1);
      setIngredients([]);
      // A quick alert and we wait for the useEffect dependency map to refetch cleanly the next time
    } catch (err) {
      alert("Failed to save: " + (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const addIngredientRow = () => {
    setIngredients([...ingredients, { stockId: '', name: '', amount: 0 }]);
  };

  const updateIngredient = (index: number, field: string, value: any) => {
    const newIngs = [...ingredients];
    if (field === 'stockId') {
      const selectedItem = stock.find(s => s.id === value);
      newIngs[index].stockId = value;
      newIngs[index].name = selectedItem ? selectedItem.name : '';
    } else if (field === 'amount') {
      newIngs[index].amount = Number(value);
    }
    setIngredients(newIngs);
  };

  const removeIngredient = (index: number) => {
    setIngredients(ingredients.filter((_, i) => i !== index));
  };

  const handleAddMenu = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      // Auto-compute allergens from components -> ingredients -> stock
      const allergenSet = new Set<string>();
      selectedComponents.forEach(cId => {
        const compObj = activeComponents.find(c => c.id === cId);
        if (compObj && compObj.ingredients) {
          compObj.ingredients.forEach((ing: ComponentIngredient) => {
            const stockItem = stock.find(s => s.id === ing.stockId || s.name === ing.name);
            if (stockItem && Array.isArray(stockItem.allergens)) {
              stockItem.allergens.forEach(a => allergenSet.add(a));
            }
          });
        }
      });
      const computedAllergens = Array.from(allergenSet);

      const payload = {
        name: menuName,
        price: Number(menuPrice) || 0,
        components: selectedComponents,
        packaging: menuPackaging,
        platforms: selectedPlatforms,
        allergens: computedAllergens
      };
      
      let url = '/api/menu/add';
      let method = 'POST';
      if (editingMenuId) {
        url = `/api/menu/${editingMenuId}`;
        method = 'PUT';
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to save menu");
      }
      
      setShowMenuModal(false);
      setEditingMenuId(null);
      setMenuName("");
      setMenuPrice("");
      setMenuPackaging([]);
      setSelectedComponents([]);
      setSelectedPlatforms([]);
    } catch (err) {
      alert("Failed to save: " + (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const toggleComponent = (id: string) => {
    if (selectedComponents.includes(id)) setSelectedComponents(selectedComponents.filter(c => c !== id));
    else setSelectedComponents([...selectedComponents, id]);
  };

  const togglePlatform = (p: string) => {
    if (selectedPlatforms.includes(p)) setSelectedPlatforms(selectedPlatforms.filter(pl => pl !== p));
    else setSelectedPlatforms([...selectedPlatforms, p]);
  };

  return (
    <div className="max-w-6xl mx-auto py-10 px-4 space-y-12 mb-20">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black tracking-tight mb-2">
            Menu <span className="text-shred-red italic">Settings</span>
          </h1>
          <p className="text-gray-500 font-medium">
            Manage your component recipes directly integrated with your stock inventory.
          </p>
        </div>

        <div className="flex gap-4">
          <button 
            onClick={() => setShowMenuModal(true)}
            className="flex items-center gap-3 px-6 py-3 bg-white/5 border border-white/10 rounded-2xl text-white font-black text-[10px] uppercase tracking-widest shadow-xl hover:bg-white/10 active:scale-95 transition-all"
          >
            <Plus size={14} />
            Add Menu
          </button>
          
          <button 
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-3 px-6 py-3 bg-shred-red rounded-2xl text-white font-black text-[10px] uppercase tracking-widest shadow-xl shadow-shred-red/20 hover:scale-105 active:scale-95 transition-all"
          >
            <Plus size={14} />
            Add Component
          </button>
        </div>
      </header>

      <div className="space-y-12">
        {/* MENUS SECTION */}
        <section className="space-y-6">
          <h2 className="text-2xl font-black flex items-center gap-3">
            <ChefHat className="text-shred-red" size={24} />
            Active <span className="text-shred-red italic">Menus</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {activeMenus.length === 0 ? (
              <div className="col-span-full py-16 glass-card rounded-[2.5rem] text-center border-dashed border-2 border-white/10">
                <p className="text-gray-500 font-medium">No menus constructed yet. Start combining components into menus.</p>
              </div>
            ) : (
              activeMenus.map(m => (
                <div key={m.id} className="glass-card p-6 rounded-3xl border border-white/5 hover:border-shred-red/30 transition-all flex flex-col gap-5 overflow-hidden shadow-2xl">
                  <div className="flex justify-between items-start gap-3">
                    <h3 className="text-xl font-black leading-tight">{m.name}</h3>
                    <div className="flex items-center gap-2">
                       <div className="bg-shred-red/10 text-shred-red px-3 py-1.5 rounded-xl border border-shred-red/20 font-black text-sm shrink-0 shadow-lg shadow-shred-red/5">
                         ${m.price.toFixed(2)}
                       </div>
                       <button onClick={() => openEditMenu(m)} title="Edit menu" className="p-1.5 text-gray-400 hover:text-white transition-colors bg-white/5 rounded-lg border border-white/5 hover:bg-white/10"><Pencil size={14} /></button>
                       <button onClick={() => handleDeleteMenu(m.id)} title="Delete menu" className="p-1.5 text-gray-400 hover:text-red-500 transition-colors bg-white/5 rounded-lg border border-white/5 hover:bg-red-500/10"><Trash2 size={14} /></button>
                    </div>
                  </div>
                  
                  {m.packaging && Array.isArray(m.packaging) && m.packaging.length > 0 ? (
                    <div className="flex items-center gap-2 flex-wrap pb-2 border-b border-white/5">
                      <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">PKG:</span>
                      {m.packaging.map((pkgObj: any, idx: number) => (
                        <span key={idx} className="text-[10px] font-bold text-black bg-white px-2 py-0.5 rounded-md shadow-xl truncate">
                          {pkgObj.name} x{pkgObj.quantity}
                        </span>
                      ))}
                    </div>
                  ) : typeof m.packaging === 'string' && m.packaging !== "" ? (
                    <div className="flex items-center gap-2 pb-2 border-b border-white/5">
                      <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">PKG:</span>
                      <span className="text-[10px] font-bold text-black bg-white px-2 py-0.5 rounded-md shadow-xl truncate">{m.packaging} x1</span>
                    </div>
                  ) : null}

                  <div className="space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Sub-Components</p>
                    <div className="flex flex-wrap gap-2">
                       {m.components?.map((cId: string) => {
                         const compObj = activeComponents.find(c => c.id === cId);
                         return (
                           <span key={cId} className="text-[9px] font-bold uppercase tracking-wider bg-white/5 border border-white/10 px-2 py-1 rounded-md text-gray-300">
                             {compObj ? compObj.name : 'Unknown Component'}
                           </span>
                         )
                       })}
                    </div>
                  </div>

                  {(() => {
                    const allergenSet = new Set<string>();
                    m.components?.forEach((cId: string) => {
                      const compObj = activeComponents.find(c => c.id === cId);
                      if (compObj && compObj.ingredients) {
                        compObj.ingredients.forEach((ing: ComponentIngredient) => {
                          const stockItem = stock.find(s => s.id === ing.stockId || s.name === ing.name);
                          if (stockItem && Array.isArray(stockItem.allergens)) {
                            stockItem.allergens.forEach(a => allergenSet.add(a));
                          }
                        });
                      }
                    });
                    const allergens = Array.from(allergenSet);
                    if (allergens.length === 0) return null;
                    return (
                      <div className="space-y-2 pt-2 border-t border-white/5">
                        <p className="text-[9px] font-black uppercase tracking-widest text-shred-red">Allergens & Dietary</p>
                        <div className="flex flex-wrap gap-1.5">
                           {allergens.map(a => (
                               <span key={a} className="text-[8px] font-black uppercase tracking-wider bg-shred-red/10 border border-shred-red/20 text-shred-red px-1.5 py-0.5 rounded shadow-xl">
                                 {a}
                               </span>
                           ))}
                        </div>
                      </div>
                    );
                  })()}

                  <div className="mt-auto pt-4 border-t border-white/5 space-y-2">
                    <p className="text-[9px] font-black uppercase tracking-widest text-gray-600">Active Platforms</p>
                    <div className="flex flex-wrap gap-1.5">
                       {m.platforms?.map((p: string) => (
                           <span key={p} className="text-[8px] font-black uppercase tracking-wider bg-black border border-white/10 text-gray-400 px-1.5 py-0.5 rounded shadow-xl">
                             {p}
                           </span>
                       ))}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <hr className="border-white/5" />

        {/* COMPONENTS SECTION */}
        <section className="space-y-6">
          <h2 className="text-2xl font-black flex items-center gap-3">
            <ChefHat className="text-gray-500" size={24} />
            Component <span className="text-gray-500 italic">Library</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {activeComponents.length === 0 ? (
              <div className="col-span-full py-16 glass-card rounded-[2.5rem] text-center border-dashed border-2 border-white/10">
                <p className="text-gray-500 font-medium">Your component library is empty. Add base recipes here.</p>
              </div>
            ) : (
              activeComponents.map(c => (
                <div key={c.id} className="glass-card p-5 rounded-3xl border border-white/5 hover:border-white/20 transition-all flex flex-col gap-4 shadow-xl">
                  <div className="flex justify-between items-start gap-4">
                    <h3 className="text-lg font-bold leading-tight">{c.name}</h3>
                    <div className="flex items-center gap-1.5">
                       <div className="bg-white/5 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase text-gray-400 tracking-wider border border-white/5 shrink-0">
                         Serves {c.serving || 1}
                       </div>
                       <button onClick={() => openEditComponent(c)} title="Edit component" className="p-1.5 text-gray-400 hover:text-white transition-colors bg-white/5 rounded-lg border border-white/5 hover:bg-white/10"><Pencil size={12} /></button>
                       <button onClick={() => handleDeleteComponent(c.id)} title="Delete component" className="p-1.5 text-gray-400 hover:text-red-500 transition-colors bg-white/5 rounded-lg border border-white/5 hover:bg-red-500/10"><Trash2 size={12} /></button>
                    </div>
                  </div>
                  
                  <div className="space-y-2 mt-auto">
                    <p className="text-[9px] font-black uppercase tracking-widest text-gray-500 pb-1 border-b border-white/5">Recipe Mapping</p>
                    <ul className="text-xs text-gray-400 space-y-1.5 list-inside">
                       {c.ingredients?.map((ing: any, i: number) => {
                          const stockItem = stock.find(s => s.id === ing.stockId || s.name === ing.name);
                          const ingAllergens = stockItem?.allergens || [];
                          return (
                            <li key={i} className="flex flex-col gap-1" title={`${ing.name} (${ing.amount})`}>
                              <div className="flex gap-2 items-center">
                                <span className="text-[10px] font-black w-6 tabular-nums">{ing.amount}</span>
                                <span className="truncate">{ing.name}</span>
                              </div>
                              {ingAllergens.length > 0 && (
                                <div className="flex flex-wrap gap-1 md:pl-8 mt-0.5">
                                  {ingAllergens.map((a: string) => (
                                    <span key={a} className="text-[7px] font-black uppercase tracking-wider bg-shred-red/5 border border-shred-red/10 text-shred-red px-1 rounded shadow-sm">
                                      {a}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </li>
                          );
                       })}
                    </ul>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowAddModal(false)}
            />
            
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-2xl bg-[#0a0a0a] border border-white/10 rounded-3xl p-8 shadow-2xl z-10 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-black">{editingComponentId ? 'Edit ' : 'Add '}<span className="text-shred-red italic">Component</span></h2>
                <button 
                  onClick={() => { setShowAddModal(false); setEditingComponentId(null); }} 
                  className="text-gray-500 hover:text-white transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleAddComponent} className="space-y-6">
                
                {/* Basic Info */}
                <div className="grid grid-cols-2 gap-5">
                  <div className="space-y-2 col-span-2 md:col-span-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Component Name</label>
                    <input 
                      required
                      type="text" 
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-shred-red/50 transition-colors"
                      value={componentName}
                      onChange={e => setComponentName(e.target.value)}
                      placeholder="e.g. Garlic Chicken"
                    />
                  </div>

                  <div className="space-y-2 col-span-2 md:col-span-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Serving</label>
                    <input 
                      required
                      type="number" 
                      min="1"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-shred-red/50 transition-colors"
                      value={serving}
                      onChange={e => setServing(Number(e.target.value))}
                    />
                  </div>
                </div>

                <hr className="border-white/5" />

                {/* Ingredients Section */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
                      <ChefHat size={14}/>
                      Recipe Ingredients
                    </label>
                    <button 
                      type="button"
                      onClick={addIngredientRow}
                      className="text-[10px] font-bold uppercase tracking-widest text-shred-red bg-shred-red/10 px-3 py-1.5 rounded-lg hover:bg-shred-red/20 transition-colors"
                    >
                      + Add Ingredient
                    </button>
                  </div>

                  {ingredients.length === 0 ? (
                    <div className="p-4 bg-white/5 border border-white/5 rounded-2xl text-center text-sm font-medium text-gray-500 italic">
                      No ingredients added yet. Click above to add them from stock.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {ingredients.map((ing, idx) => (
                        <div key={idx} className="flex flex-col sm:flex-row gap-3 items-end sm:items-center bg-white/[0.02] border border-white/10 p-3 rounded-xl relative group">
                          
                          <div className="w-full sm:flex-1 space-y-1">
                            <label className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">Search Stock</label>
                            <input
                              required
                              list={`stock-list-${idx}`}
                              placeholder="Type to search..."
                              className="w-full bg-[#111] border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-shred-red/50 transition-colors max-w-[240px]"
                              value={ing.name}
                              onChange={e => {
                                const val = e.target.value;
                                const matchedItem = stock.find(s => s.name === val);
                                
                                const newIngs = [...ingredients];
                                newIngs[idx].name = val;
                                
                                if (matchedItem) {
                                  newIngs[idx].stockId = matchedItem.id;
                                } else {
                                  newIngs[idx].stockId = ''; // Clear ID if they keep typing and mismatch
                                }
                                
                                setIngredients(newIngs);
                              }}
                            />
                            <datalist id={`stock-list-${idx}`}>
                              {stock.filter(s => s.type !== 'packaging').map(s => (
                                <option key={s.id} value={s.name}>{`Stock: ${s.amount || 0}`}</option>
                              ))}
                            </datalist>
                          </div>

                          <div className="w-full sm:w-28 space-y-1">
                            <label className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">Amount Used (g)</label>
                            <input 
                              required
                              type="number"
                              step="0.01" 
                              min="0"
                              placeholder="e.g. 150"
                              className="w-full bg-[#111] border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-shred-red/50 transition-colors"
                              value={ing.amount || ""}
                              onChange={e => updateIngredient(idx, 'amount', e.target.value)}
                            />
                          </div>

                          <button 
                            type="button"
                            onClick={() => removeIngredient(idx)}
                            className="bg-red-500/10 text-red-500 p-2 rounded-lg hover:bg-red-500 hover:text-white transition-all w-full sm:w-auto mt-2 sm:mt-0"
                          >
                            <Trash2 size={16} />
                          </button>

                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pt-6 flex justify-end gap-3 border-t border-white/5">
                  <button 
                    type="button" 
                    onClick={() => { setShowAddModal(false); setEditingComponentId(null); }}
                    className="px-6 py-3 rounded-xl font-bold bg-white/5 hover:bg-white/10 transition-colors text-sm"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={saving}
                    className="px-6 py-3 rounded-xl font-bold bg-shred-red hover:bg-red-600 transition-colors text-white text-sm flex items-center gap-2"
                  >
                    {saving ? <Loader2 size={16} className="animate-spin" /> : null}
                    {saving ? 'Saving...' : editingComponentId ? 'Save Edits' : 'Save Component'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ADD MENU MODAL */}
      <AnimatePresence>
        {showMenuModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => { setShowMenuModal(false); setEditingMenuId(null); }}
            />
            
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-2xl bg-[#0a0a0a] border border-white/10 rounded-3xl p-8 shadow-2xl z-10 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-black">{editingMenuId ? 'Edit ' : 'Add '}<span className="text-shred-red italic">Menu Master</span></h2>
                <button 
                  onClick={() => { setShowMenuModal(false); setEditingMenuId(null); }} 
                  className="text-gray-500 hover:text-white transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleAddMenu} className="space-y-6">
                
                {/* Basic Info */}
                <div className="grid grid-cols-2 gap-5">
                  <div className="space-y-2 col-span-2 md:col-span-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Menu Name</label>
                    <input 
                      required
                      type="text" 
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-shred-red/50 transition-colors"
                      value={menuName}
                      onChange={e => setMenuName(e.target.value)}
                      placeholder="e.g. Italian Feast Bundle"
                    />
                  </div>

                  <div className="space-y-2 col-span-2 md:col-span-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Price ($)</label>
                    <input 
                      required
                      type="number" 
                      step="0.01"
                      min="0"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-shred-red/50 transition-colors"
                      value={menuPrice}
                      onChange={e => setMenuPrice(e.target.value ? Number(e.target.value) : "")}
                      placeholder="e.g. 50.00"
                    />
                  </div>

                  <div className="space-y-4 col-span-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Packaging Requirements</label>
                      <button 
                        type="button"
                        onClick={() => setMenuPackaging([...menuPackaging, { name: '', quantity: 1 }])}
                        className="text-[10px] font-bold uppercase tracking-widest text-shred-red bg-shred-red/10 px-3 py-1.5 rounded-lg hover:bg-shred-red/20 transition-colors"
                      >
                        + Add Packaging
                      </button>
                    </div>
                    
                    {menuPackaging.length === 0 ? (
                      <div className="p-3 bg-white/5 border border-white/5 rounded-2xl text-center text-sm font-medium text-gray-500 italic">
                        No packaging mapped. Ensure the menu has transport materials.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {menuPackaging.map((pkg, idx) => (
                          <div key={idx} className="flex gap-3 items-center bg-white/[0.02] border border-white/10 p-3 rounded-xl">
                            <select 
                              className="flex-1 bg-[#111] border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-shred-red/50 transition-colors"
                              value={pkg.name}
                              onChange={e => {
                                const newPkg = [...menuPackaging];
                                newPkg[idx].name = e.target.value;
                                setMenuPackaging(newPkg);
                              }}
                            >
                              <option value="" disabled>-- Select Packaging (from Stock) --</option>
                              {stock.filter(s => s.type === 'packaging').map(p => (
                                <option key={p.id} value={p.name}>
                                  {p.name} (In stock: {p.amount || 0})
                                </option>
                              ))}
                            </select>
                            <input 
                              type="number"
                              min="1"
                              className="w-20 bg-[#111] border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-shred-red/50 transition-colors text-center"
                              value={pkg.quantity}
                              onChange={e => {
                                const newPkg = [...menuPackaging];
                                newPkg[idx].quantity = Number(e.target.value);
                                setMenuPackaging(newPkg);
                              }}
                            />
                            <button 
                              type="button" 
                              onClick={() => setMenuPackaging(menuPackaging.filter((_, i) => i !== idx))} 
                              className="text-red-500 bg-red-500/10 p-2 hover:bg-red-500 hover:text-white transition-all rounded-lg shrink-0"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <hr className="border-white/5" />

                {/* Sub-Components */}
                <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
                      <ChefHat size={14}/>
                      Included Components
                    </label>
                    
                    {activeComponents.length === 0 ? (
                      <div className="p-4 bg-white/5 border border-white/5 rounded-2xl text-center text-sm font-medium text-gray-500 italic">
                        No components available. Please add components first using the other button.
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {activeComponents.map((c) => {
                          const isSelected = selectedComponents.includes(c.id);
                          return (
                            <div 
                              key={c.id}
                              onClick={() => toggleComponent(c.id)}
                              className={`
                                cursor-pointer px-3 py-4 rounded-xl border text-sm font-bold text-center transition-all flex flex-col items-center justify-center min-h-16
                                ${isSelected ? 'bg-shred-red/10 border-shred-red text-shred-red shadow-[0_0_15px_rgba(255,49,49,0.2)]' : 'bg-white/5 border-white/10 text-gray-400 hover:text-white hover:border-white/30'}
                              `}
                            >
                              <span className="truncate w-full block">{c.name}</span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                </div>

                <hr className="border-white/5" />

                {/* Availability */}
                <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                      Platform Availability
                    </label>
                    
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                      {PLATFORMS.map((p) => {
                        const isSelected = selectedPlatforms.includes(p);
                        return (
                          <div 
                            key={p}
                            onClick={() => togglePlatform(p)}
                            className={`
                              cursor-pointer px-2 py-3 rounded-lg border text-xs font-bold text-center transition-all select-none
                              ${isSelected ? 'bg-white text-black border-white shadow-lg' : 'bg-[#111] border-white/10 text-gray-500 hover:text-white'}
                            `}
                          >
                            {p}
                          </div>
                        )
                      })}
                    </div>
                </div>

                <div className="pt-6 flex justify-end gap-3 border-t border-white/5">
                  <button 
                    type="button" 
                    onClick={() => { setShowMenuModal(false); setEditingMenuId(null); }}
                    className="px-6 py-3 rounded-xl font-bold bg-white/5 hover:bg-white/10 transition-colors text-sm"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={saving}
                    className="px-6 py-3 rounded-xl font-bold bg-white text-black hover:bg-gray-200 transition-colors text-sm flex items-center gap-2"
                  >
                    {saving ? <Loader2 size={16} className="animate-spin" /> : null}
                    {saving ? 'Saving...' : editingMenuId ? 'Save Edits' : 'Create Menu Node'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
