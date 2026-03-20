"use client";

import React, { useState } from "react";
import ClientView from "@/components/ClientView";
import DishView from "@/components/DishView";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Users, UtensilsCrossed, Calendar as CalendarIcon, Filter, X, Loader2, Trash2, ChefHat } from "lucide-react";
import CalendarView from "@/components/CalendarView";
import DateRangePicker from "@/components/DateRangePicker";
import { format, isSameDay, startOfDay, endOfDay } from "date-fns";

type ViewType = "calendar" | "dish" | "client";

interface DateRange {
  start: Date | null;
  end: Date | null;
}

export default function OrdersPage() {
  const [view, setView] = useState<ViewType>("calendar");
  const [dateRange, setDateRange] = useState<DateRange>({ 
    start: startOfDay(new Date()), 
    end: endOfDay(new Date()) 
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [activeMenus, setActiveMenus] = useState<any[]>([]);
  const [orderItems, setOrderItems] = useState<{menuId: string, name: string, quantity: number}[]>([]);
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedOrderDetail, setSelectedOrderDetail] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [originalDate, setOriginalDate] = useState<string | null>(null);

  const defaultFormData = {
    Customer_Name: '',
    PickUp_Date: format(new Date(), 'yyyy-MM-dd'),
    Deliver_Time: '',
    Deliver_Address: '',
    Deliver_Instruction: '',
    Order_Notes: '',
    Utensils: false
  };

  const [formData, setFormData] = useState(defaultFormData);

  React.useEffect(() => {
    async function fetchMenus() {
      try {
        const res = await fetch('/api/menu');
        const data = await res.json();
        if (data.menus) setActiveMenus(data.menus);
      } catch(e) {}
    }
    fetchMenus();
  }, []);

  const addOrderItemRow = () => {
    setOrderItems([...orderItems, { menuId: '', name: '', quantity: 1 }]);
  };

  const updateOrderItem = (index: number, field: string, value: any) => {
    const newItems = [...orderItems];
    if (field === 'menuId') {
      const selectedMenu = activeMenus.find(m => m.id === value);
      newItems[index].menuId = value;
      newItems[index].name = selectedMenu ? selectedMenu.name : '';
    } else if (field === 'quantity') {
      newItems[index].quantity = parseInt(value, 10) || 1;
    }
    setOrderItems(newItems);
  };

  const removeOrderItem = (index: number) => {
    setOrderItems(orderItems.filter((_, i) => i !== index));
  };

  const handleManualOrderAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...formData,
        originalDate,
        Item: orderItems.map(item => ({
          Item_Name: item.name,
          Item_Amount: item.quantity
        }))
      };

      const url = editingOrderId ? `/api/orders/${editingOrderId}` : `/api/orders/add`;
      const method = editingOrderId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (!res.ok) throw new Error("Failed to save order");
      
      closeModal();
      window.location.reload();
    } catch (err) {
      alert("Error saving order: " + (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingOrderId || !originalDate) return;
    if (!confirm("Are you sure you want to permanently delete this manual order?")) return;

    try {
      setSaving(true);
      const res = await fetch(`/api/orders/${editingOrderId}?date=${originalDate}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error("Failed to delete order");
      closeModal();
      window.location.reload();
    } catch (err) {
      alert("Error deleting order: " + (err as Error).message);
      setSaving(false);
    }
  };

  const handleOrderClick = (order: any) => {
    if (order.platforms === 'Direct' || order.platforms === 'Manual Entry') {
      openEditModal(order);
    } else {
      setSelectedOrderDetail(order);
      setShowDetailModal(true);
    }
  };

  const openEditModal = (order: any) => {
    setEditingOrderId(order.id || order.Order_ID || order.order_id);
    
    // Attempt to recover exact YYYY-MM-DD
    let dateStr = format(new Date(), 'yyyy-MM-dd');
    if (order.PickUp_Date) {
      dateStr = new Date(order.PickUp_Date).toISOString().split('T')[0];
    } else if (order.order_date) {
      dateStr = new Date(order.order_date).toISOString().split('T')[0];
    }
    
    setOriginalDate(dateStr);
    
    setFormData({
      Customer_Name: order.Customer_Name || order.customer_name || '',
      PickUp_Date: dateStr,
      Deliver_Time: order.Deliver_Time || order.PickUp_Time || '',
      Deliver_Address: order.Deliver_Address || '',
      Deliver_Instruction: order.Deliver_Instruction || '',
      Order_Notes: order.Order_Notes || '',
      Utensils: order.Utensils === 'Yes'
    });

    const parsedItems = (order.Item || []).map((i: any) => {
       const matchedMenu = activeMenus.find(m => m.name.toLowerCase() === i.Item_Name?.toLowerCase());
       return {
          menuId: matchedMenu ? matchedMenu.id : '',
          name: i.Item_Name || '',
          quantity: i.Item_Amount || 1
       };
    });
    setOrderItems(parsedItems);
    setShowAddModal(true);
  };

  const openAddModal = () => {
    setEditingOrderId(null);
    setOriginalDate(null);
    setFormData(defaultFormData);
    setOrderItems([]);
    setShowAddModal(true);
  };

  const closeModal = () => {
    setShowAddModal(false);
    setEditingOrderId(null);
    setOriginalDate(null);
    setFormData(defaultFormData);
    setOrderItems([]);
  };

  const applyFilter = (range: DateRange) => {
    setDateRange(range);
    setShowDatePicker(false);
  };

  const clearFilter = () => {
    setDateRange({ start: startOfDay(new Date()), end: endOfDay(new Date()) });
    setShowDatePicker(false);
  };

  const getDateLabel = () => {
    if (!dateRange.start || !dateRange.end) return "Filter Dates";
    if (isSameDay(dateRange.start, dateRange.end)) {
      return format(dateRange.start, "MMM d");
    }
    return `${format(dateRange.start, "MMM d")} - ${format(dateRange.end, "MMM d")}`;
  };

  return (
    <div className="max-w-6xl mx-auto">
      <header className="mb-12 space-y-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
          <div>
            <h1 className="text-4xl font-black tracking-tight mb-2">
              Order <span className="text-shred-red italic">Insights</span>
            </h1>
            <p className="text-gray-500 font-medium">
              Manage your catering business with real-time data.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <button 
            onClick={openAddModal}
            className="flex items-center gap-3 px-6 py-3 bg-shred-red rounded-2xl text-white font-black text-[10px] uppercase tracking-widest shadow-xl shadow-shred-red/20 hover:scale-105 active:scale-95 transition-all"
          >
            <Plus size={14} />
            New Order
          </button>

            <div className="relative">
              <button 
                onClick={() => setShowDatePicker(!showDatePicker)}
                className={`
                  flex items-center gap-2 px-5 py-3 rounded-2xl border transition-all font-bold text-sm h-full
                  ${dateRange.start ? 'bg-shred-red/10 border-shred-red/50 text-shred-red' : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'}
                `}
              >
                <Filter size={16} />
                {getDateLabel()}
                <X 
                  size={14} 
                  className="ml-2 hover:text-white" 
                  onClick={(e) => { e.stopPropagation(); clearFilter(); }} 
                />
              </button>

              <AnimatePresence>
                {showDatePicker && (
                  <div className="absolute right-0 top-full mt-2 z-50 origin-top-right">
                    <DateRangePicker 
                      initialRange={dateRange}
                      onApply={applyFilter}
                      onCancel={() => setShowDatePicker(false)}
                    />
                  </div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        <div className="flex p-1.5 bg-white/5 rounded-2xl border border-white/10 w-fit">
          <button 
            onClick={() => setView("calendar")}
            className={`
              flex items-center gap-2 px-6 py-2.5 rounded-xl transition-all duration-300 font-bold text-sm
              ${view === 'calendar' ? 'bg-shred-red text-white shadow-lg shadow-shred-red/20' : 'text-gray-400 hover:text-white'}
            `}
          >
            <CalendarIcon size={16} />
            Calendar
          </button>
          <button 
            onClick={() => setView("dish")}
            className={`
              flex items-center gap-2 px-6 py-2.5 rounded-xl transition-all duration-300 font-bold text-sm
              ${view === 'dish' ? 'bg-shred-red text-white shadow-lg shadow-shred-red/20' : 'text-gray-400 hover:text-white'}
            `}
          >
            <UtensilsCrossed size={16} />
            Dish View
          </button>
          <button 
            onClick={() => setView("client")}
            className={`
              flex items-center gap-2 px-6 py-2.5 rounded-xl transition-all duration-300 font-bold text-sm
              ${view === 'client' ? 'bg-shred-red text-white shadow-lg shadow-shred-red/20' : 'text-gray-400 hover:text-white'}
            `}
          >
            <Users size={16} />
            Clients View
          </button>
        </div>
      </header>

      <motion.div
        key={view}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      >
        {view === "calendar" ? (
          <CalendarView onEditOrder={handleOrderClick} />
        ) : view === "dish" ? (
          <DishView dateRange={dateRange} />
        ) : (
          <ClientView dateRange={dateRange} />
        )}
      </motion.div>

      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={closeModal}
            />
            
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-2xl bg-[#0a0a0a] border border-white/10 rounded-3xl p-8 shadow-2xl z-10 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-black">{editingOrderId ? 'Edit' : 'Add'} <span className="text-shred-red italic">Manual Order</span></h2>
                <button onClick={closeModal} className="text-gray-500 hover:text-white transition-colors">
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleManualOrderAdd} className="space-y-5">
                <div className="grid grid-cols-2 gap-5">
                  <div className="space-y-2 col-span-2 md:col-span-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Client Name</label>
                    <input 
                      required
                      type="text" 
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-shred-red/50 transition-colors"
                      value={formData.Customer_Name}
                      onChange={e => setFormData({...formData, Customer_Name: e.target.value})}
                      placeholder="e.g. John Doe"
                    />
                  </div>

                  <div className="space-y-2 col-span-2 md:col-span-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Date</label>
                    <input 
                      required
                      type="date" 
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-shred-red/50 transition-colors"
                      value={formData.PickUp_Date}
                      onChange={e => setFormData({...formData, PickUp_Date: e.target.value})}
                    />
                  </div>
                  
                  <div className="space-y-2 col-span-2 md:col-span-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Time</label>
                    <input 
                      type="text" 
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-shred-red/50 transition-colors"
                      value={formData.Deliver_Time}
                      onChange={e => setFormData({...formData, Deliver_Time: e.target.value})}
                      placeholder="e.g. 12:30 PM"
                    />
                  </div>

                  {/* ITEMS SECTION */}
                  <div className="col-span-2 space-y-4 pt-2 border-t border-white/5">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
                        <ChefHat size={14}/>
                        Order Items
                      </label>
                      <button 
                        type="button"
                        onClick={addOrderItemRow}
                        className="text-[10px] font-bold uppercase tracking-widest text-shred-red bg-shred-red/10 px-3 py-1.5 rounded-lg hover:bg-shred-red/20 transition-colors"
                      >
                        + Add Item
                      </button>
                    </div>

                    {orderItems.length === 0 ? (
                      <div className="p-4 bg-white/5 border border-white/5 rounded-2xl text-center text-sm font-medium text-gray-500 italic">
                        No items added to this order.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {orderItems.map((item, idx) => (
                          <div key={idx} className="flex flex-col sm:flex-row gap-3 items-end sm:items-center bg-white/[0.02] border border-white/10 p-3 rounded-xl relative group">
                            
                            <div className="w-full sm:flex-1 space-y-1">
                              <label className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">Select Menu</label>
                              <select
                                required
                                className="w-full bg-[#111] border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-shred-red/50 transition-colors"
                                value={item.menuId}
                                onChange={e => updateOrderItem(idx, 'menuId', e.target.value)}
                              >
                                <option value="" disabled>-- Choose Menu Item --</option>
                                {activeMenus.map(m => (
                                  <option key={m.id} value={m.id}>{m.name}</option>
                                ))}
                              </select>
                            </div>

                            <div className="w-full sm:w-28 space-y-1">
                              <label className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">Quantity</label>
                              <input 
                                required
                                type="number"
                                min="1"
                                className="w-full bg-[#111] border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-shred-red/50 transition-colors"
                                value={item.quantity}
                                onChange={e => updateOrderItem(idx, 'quantity', e.target.value)}
                              />
                            </div>

                            <button 
                              type="button"
                              onClick={() => removeOrderItem(idx)}
                              className="bg-red-500/10 text-red-500 p-2 rounded-lg hover:bg-red-500 hover:text-white transition-all w-full sm:w-auto mt-2 sm:mt-0"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2 col-span-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Delivery Address</label>
                    <input 
                      type="text" 
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-shred-red/50 transition-colors"
                      value={formData.Deliver_Address}
                      onChange={e => setFormData({...formData, Deliver_Address: e.target.value})}
                      placeholder="123 Shred Street..."
                    />
                  </div>

                  <div className="space-y-2 col-span-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Delivery Instructions</label>
                    <textarea 
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-shred-red/50 transition-colors min-h-20"
                      value={formData.Deliver_Instruction}
                      onChange={e => setFormData({...formData, Deliver_Instruction: e.target.value})}
                      placeholder="Leave at front desk..."
                    />
                  </div>

                  <div className="space-y-2 col-span-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Order Notes (Dietary, Context)</label>
                    <textarea 
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-shred-red/50 transition-colors min-h-20"
                      value={formData.Order_Notes}
                      onChange={e => setFormData({...formData, Order_Notes: e.target.value})}
                      placeholder="Gluten allergy, VIP client..."
                    />
                  </div>

                  <div className="col-span-2 flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-4">
                    <input 
                      type="checkbox"
                      id="utensils"
                      className="w-5 h-5 accent-shred-red bg-white/10 border-white/20 rounded cursor-pointer"
                      checked={formData.Utensils}
                      onChange={e => setFormData({...formData, Utensils: e.target.checked})}
                    />
                    <label htmlFor="utensils" className="text-sm font-bold cursor-pointer select-none">Include Utensils</label>
                  </div>
                </div>

                <div className="pt-4 flex justify-between gap-3">
                  {editingOrderId ? (
                    <button 
                      type="button" 
                      onClick={handleDelete}
                      disabled={saving}
                      className="px-6 py-3 rounded-xl font-bold bg-white/5 border border-red-500/30 text-red-500 hover:bg-red-500 hover:text-white transition-colors text-sm flex items-center gap-2"
                    >
                      <Trash2 size={16} /> Delete Order
                    </button>
                  ) : (
                    <div></div>
                  )}

                  <div className="flex gap-3">
                    <button 
                      type="button" 
                      onClick={closeModal}
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
                      {saving ? 'Saving...' : 'Save Order'}
                    </button>
                  </div>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showDetailModal && selectedOrderDetail && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowDetailModal(false)}
            />
            
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-xl bg-[#0a0a0a] border border-white/10 rounded-3xl p-8 shadow-2xl z-10 max-h-[85vh] overflow-y-auto"
            >
              <div className="flex justify-between items-start mb-6 border-b border-white/5 pb-6">
                <div>
                  <h2 className="text-2xl font-black mb-1">{selectedOrderDetail.Customer_Name || selectedOrderDetail.customer_name || 'Automated Order'}</h2>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 bg-shred-red/20 text-shred-red border border-shred-red/30 rounded-lg text-[10px] font-black uppercase tracking-widest">
                      {selectedOrderDetail.platforms || 'External'}
                    </span>
                    <span className="text-xs font-bold text-gray-500">
                      {(selectedOrderDetail.Order_ID || selectedOrderDetail.order_id || '').startsWith('#') ? (selectedOrderDetail.Order_ID || selectedOrderDetail.order_id) : `#${selectedOrderDetail.Order_ID || selectedOrderDetail.order_id || 'Unknown'}`}
                    </span>
                  </div>
                </div>
                <button onClick={() => setShowDetailModal(false)} className="text-gray-500 hover:text-white bg-white/5 p-2 rounded-xl transition-colors">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-6">
                
                {/* Dates & Times */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                    <p className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-1">PickUp Date</p>
                    <p className="text-sm font-bold text-gray-300">{selectedOrderDetail.PickUp_Date || selectedOrderDetail.order_date || 'N/A'}</p>
                  </div>
                  <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                    <p className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-1">Confirm Date</p>
                    <p className="text-sm font-bold text-gray-300">{selectedOrderDetail.Order_Confirmation_Date || 'N/A'}</p>
                  </div>
                  <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                    <p className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-1">PickUp Time</p>
                    <p className="text-sm font-bold text-gray-300">{selectedOrderDetail.PickUp_Time || 'N/A'}</p>
                  </div>
                  <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                    <p className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-1">Deliver Time</p>
                    <p className="text-sm font-bold text-gray-300">{selectedOrderDetail.Deliver_Time || 'N/A'}</p>
                  </div>
                </div>

                {/* Operations */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                    <p className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-1">Order Type</p>
                    <p className="text-sm font-bold text-gray-300">{selectedOrderDetail.Order_Type || 'N/A'}</p>
                  </div>
                  <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                    <p className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-1">Delivery Partner</p>
                    <p className="text-sm font-bold text-gray-300">{selectedOrderDetail.Deliver_Partner || selectedOrderDetail.platforms || 'N/A'}</p>
                  </div>
                  <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                    <p className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-1">Delivery Driver</p>
                    <p className="text-xs font-bold text-gray-300 truncate">{selectedOrderDetail.Deliver_Driver || 'Not Assigned'}</p>
                  </div>
                  <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                    <p className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-1">Confirm Code</p>
                    <p className="text-xs font-bold text-shred-red tracking-wider">{selectedOrderDetail.Confirmation_Code || 'N/A'}</p>
                  </div>
                </div>

                {/* Addresses & Notes */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">Delivery Address</p>
                    <p className="text-sm font-bold text-gray-300 leading-snug">{selectedOrderDetail.Deliver_Address || 'Pickup / Undisclosed'}</p>
                  </div>
                  <div className="bg-shred-red/5 p-4 rounded-xl border border-shred-red/10">
                    <p className="text-[10px] font-black uppercase tracking-widest text-shred-red mb-2">Instructions / Notes</p>
                    <p className="text-sm font-medium text-white/80 leading-snug max-h-24 overflow-y-auto">
                      {selectedOrderDetail.Deliver_Instruction || selectedOrderDetail.Order_Notes || 'No specific instructions provided.'}
                    </p>
                  </div>
                </div>

                {/* Item List */}
                <div className="pt-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3 flex items-center gap-2">
                    <ChefHat size={14} /> Ordered Items
                  </p>
                  <div className="space-y-2">
                    {(!selectedOrderDetail.Item || selectedOrderDetail.Item.length === 0) ? (
                      <p className="text-xs text-gray-500 italic">No mapped dishes found in payload.</p>
                    ) : (
                      selectedOrderDetail.Item.map((item: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center bg-white/[0.02] border border-white/10 p-3 rounded-xl">
                          <span className="text-sm font-bold text-gray-300 truncate pr-4">{item.Item_Name || item.dish_name || 'Unknown Item'}</span>
                          <span className="text-sm font-black text-shred-red bg-shred-red/10 px-3 py-1 rounded-lg">x{item.Item_Amount || item.quantity || 1}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Financials & Utensils */}
                <div className="pt-4 border-t border-white/5 grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-1">Utensils</p>
                    <p className="text-sm font-bold text-gray-300">{selectedOrderDetail.Utensils || 'Not Specified'}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-1">Subtotal</p>
                    <p className="text-sm font-bold text-gray-300">${(selectedOrderDetail.Order_Subtotal || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-1">Tax</p>
                    <p className="text-sm font-bold text-gray-300">${(selectedOrderDetail.Tax || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1">Total</p>
                    <p className="text-lg font-black text-shred-red">${(selectedOrderDetail.Order_Total || selectedOrderDetail.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
