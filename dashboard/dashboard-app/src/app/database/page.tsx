"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Database, Filter, ExternalLink, Loader2, X, Edit2 } from "lucide-react";
import DateRangePicker from "@/components/DateRangePicker";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { getSFDate } from "@/lib/utils";

interface Order {
  id: string;
  Order_ID?: string;
  order_id?: string;
  PickUp_Date?: string;
  order_date?: string;
  Order_Total?: number;
  Order_Net?: number;
  Order_Subtotal?: number;
  Tax?: number;
  total_amount?: number;
  platforms?: string;
  Customer_Name?: string;
  Order_Type?: string;
  PickUp_Time?: string;
  Deliver_Time?: string;
  Deliver_Address?: string;
  Deliver_Driver?: string;
  Deliver_Partner?: string;
  Order_Confirm_Date?: string;
  status?: string;
}

export default function DatabasePage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPlatform, setFilterPlatform] = useState("ALL");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [dateRange, setDateRange] = useState<{start: Date | null, end: Date | null}>({ 
    start: startOfMonth(getSFDate()), 
    end: endOfMonth(getSFDate()) 
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  
  const [editingOrder, setEditingOrder] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<any>({});

  const handleEditClick = (o: any) => {
    setEditingOrder(o);
    // Deep clone the object so we can edit absolutely every dynamic field without mutating state natively
    const clone = JSON.parse(JSON.stringify(o));
    // Ensure standard keys exist to prevent uncontrolled component warning
    clone.Customer_Name = clone.Customer_Name || clone.customer_name || '';
    clone.Order_Subtotal = clone.Order_Subtotal ?? clone.subtotal ?? 0;
    clone.Tax = clone.Tax ?? clone.tax ?? 0;
    clone.Order_Total = clone.Order_Total ?? clone.total_amount ?? 0;
    clone.Order_Net = clone.Order_Net ?? clone.Order_Total ?? clone.total_amount ?? 0;
    clone.status = clone.status || 'NEW';
    clone.Deliver_Driver = clone.Deliver_Driver || '';
    clone.Deliver_Address = clone.Deliver_Address || '';
    clone.PickUp_Date = clone.PickUp_Date || clone.order_date || '';
    setFormData(clone);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOrder) return;
    
    setSaving(true);
    try {
      // Build absolute raw object payload to force rewrite
      const payload = { ...formData };
      
      const res = await fetch(`/api/orders/${editingOrder.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || 'Failed to update order');
      }
      
      // Update local state without refresh
      setOrders(orders.map(o => o.id === editingOrder.id ? { ...o, ...payload } : o));
      setEditingOrder(null);
    } catch (err: any) {
      alert("Error saving: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const fetchOrders = async () => {
    try {
      const response = await fetch('/api/orders');
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      
      // Sort newest first
      const sorted = (data.orders || []).sort((a: any, b: any) => {
        const aDate = new Date(b.PickUp_Date || b.order_date || 0);
        const bDate = new Date(a.PickUp_Date || a.order_date || 0);
        return aDate.getTime() - bDate.getTime();
      });
      
      setOrders(sorted);
    } catch (err) {
      console.error("Error fetching orders:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const filteredOrders = orders.filter(o => {
    // 1. Search Query
    const matchesSearch = Object.values(o).some(val => 
      String(val).toLowerCase().includes(searchQuery.toLowerCase())
    );
    if (!matchesSearch) return false;

    // 2. Platform
    const platform = (o.platforms || o.Deliver_Partner || "Unknown").toUpperCase();
    if (filterPlatform !== "ALL" && platform !== filterPlatform) return false;

    // 3. Status
    const status = (o.status || "N/A").toUpperCase();
    if (filterStatus !== "ALL" && status !== filterStatus) return false;

    // 4. Date Range
    if (dateRange.start && dateRange.end) {
      const dateVal = o.PickUp_Date || o.order_date;
      if (!dateVal) return false;
      const orderDate = new Date(dateVal);
      // Strip time for accurate boundary checks
      orderDate.setHours(0,0,0,0);
      const s = new Date(dateRange.start); s.setHours(0,0,0,0);
      const e = new Date(dateRange.end); e.setHours(23,59,59,999);
      if (orderDate < s || orderDate > e) return false;
    }

    return true;
  });

  const getPlatformLink = (o: Order | any) => {
    // Rely exclusively on the natively scraped permanent link vaulted within Firebase first and foremost
    if (o.Order_URL) return o.Order_URL;
    
    // Legacy ClubFeast Fallback Logic
    const p = (o.platforms || o.Deliver_Partner || "").toUpperCase();
    const orderId = o.Order_ID || o.order_id || "";
    
    if (p === "CLUBFEAST") {
       // Deep-linking mathematically only survives for open SPA orders. Delivered history disables correctly.
       const pickupDate = new Date(`${o.PickUp_Date}T00:00:00`);
       const today = getSFDate();
       today.setHours(0, 0, 0, 0);
       
       if (pickupDate >= today) {
           return `https://restaurant.clubfeast.com/orders/${orderId}?canceled=false`;
       }
    }
    
    // For legacy orders synced prior to native extraction, force return "#" to hide the false-positive link icon
    return "#";
  };

  return (
    <div className="flex-1 p-8 overflow-hidden flex flex-col h-screen">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2 flex items-center gap-3">
            <Database className="text-shred-red" />
            Order Database
          </h1>
          <p className="text-gray-400">Master view of all historical and active platform orders.</p>
        </div>
        
        <div className="flex items-center gap-4 flex-wrap pb-2">
          
          {/* Platform Filter */}
          <select 
            value={filterPlatform}
            onChange={e => setFilterPlatform(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm font-mono text-gray-300 focus:outline-none focus:border-shred-red [&>option]:bg-[#0f0f11] [&>option]:text-white"
          >
            <option value="ALL">All Platforms</option>
            <option value="CATER2.ME">Cater2.Me</option>
            <option value="CLUBFEAST">ClubFeast</option>
            <option value="HUNGRY">Hungry</option>
            <option value="MANUAL ENTRY">Manual Entry</option>
          </select>

          {/* Status Filter */}
          <select 
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm font-mono text-gray-300 focus:outline-none focus:border-shred-red [&>option]:bg-[#0f0f11] [&>option]:text-white"
          >
            <option value="ALL">All Statuses</option>
            <option value="NEW">New</option>
            <option value="ACTIVE">Active</option>
            <option value="FINALIZED">Finalized</option>
            <option value="N/A">N/A</option>
          </select>

          {/* Date Range Picker */}
          <div className="relative">
            <button
              onClick={() => setShowDatePicker(!showDatePicker)}
              className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors text-sm font-mono text-gray-300 whitespace-nowrap"
            >
              <Filter size={16} />
              {dateRange.start && dateRange.end 
                ? `${format(dateRange.start, "MMM d, yy")} - ${format(dateRange.end, "MMM d, yy")}` 
                : "All Time"}
            </button>
            <AnimatePresence>
              {showDatePicker && (
                <DateRangePicker
                  initialRange={dateRange as any}
                  onApply={(range) => {
                    setDateRange(range);
                    setShowDatePicker(false);
                  }}
                  onCancel={() => setShowDatePicker(false)}
                />
              )}
            </AnimatePresence>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 bg-white/5 border border-white/10 rounded-xl focus:border-shred-red focus:ring-1 focus:ring-shred-red transition-all w-48 text-white placeholder-gray-500 font-mono text-sm"
            />
          </div>
          <div className="bg-white/5 border border-white/10 px-3 py-2 rounded-xl text-sm font-bold font-mono text-shred-red/80 whitespace-nowrap">
            {filteredOrders.length} ROWS
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto rounded-xl border border-white/10 glass">
        {loading ? (
          <div className="h-full flex items-center justify-center text-gray-400">Loading database...</div>
        ) : (
          <div className="inline-block min-w-full align-middle">
            <table className="min-w-full divide-y divide-white/10 text-left text-sm font-mono whitespace-nowrap">
              <thead className="bg-white/5 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 font-semibold text-gray-300">PLATFORM</th>
                  <th className="px-4 py-3 font-semibold text-gray-300">ORDER ID</th>
                  <th className="px-4 py-3 font-semibold text-gray-300">DELIVERY DATE</th>
                  <th className="px-4 py-3 font-semibold text-gray-300">DELIVERY TIME</th>
                  <th className="px-4 py-3 font-semibold text-gray-300">CUSTOMER</th>
                  <th className="px-4 py-3 font-semibold text-gray-300">ORDER TYPE</th>
                  <th className="px-4 py-3 font-semibold text-gray-300">STATUS</th>
                  <th className="px-4 py-3 font-semibold text-gray-300">SUBTOTAL</th>
                  <th className="px-4 py-3 font-semibold text-gray-300">TAX/FEES</th>
                  <th className="px-4 py-3 font-semibold text-gray-300">ORDER TOTAL</th>
                  <th className="px-4 py-3 font-semibold text-gray-300 text-shred-red">NET PAYOUT</th>
                  <th className="px-4 py-3 font-semibold text-gray-300">DRIVER</th>
                  <th className="px-4 py-3 font-semibold text-gray-300">ADDRESS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {filteredOrders.map((o, idx) => {
                  const sub = o.Order_Subtotal || 0;
                  const tax = o.Tax || 0;
                  const tot = o.Order_Total || o.total_amount || 0;
                  const net = o.Order_Net ?? o.Order_Total ?? o.total_amount ?? 0;

                  return (
                    <motion.tr 
                      key={o.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.02 }}
                      className="hover:bg-white/5 transition-colors group cursor-default"
                    >
                      <td className="px-4 py-3">
                        <span className="bg-white/10 px-2 py-1 rounded text-xs uppercase tracking-wider font-bold">
                          {o.platforms || o.Deliver_Partner || "Unknown"}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-bold text-gray-200">
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => handleEditClick(o)}
                            className="text-gray-500 hover:text-white bg-white/5 p-1 rounded transition-colors"
                            title="Edit Data"
                          >
                            <Edit2 size={12} />
                          </button>
                          <span>{o.Order_ID || o.order_id || 'N/A'}</span>
                          {(o.platforms || o.Deliver_Partner) && getPlatformLink(o) !== "#" ? (
                            <a 
                              href={getPlatformLink(o)}
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-gray-500 hover:text-shred-red transition-colors"
                              title="Open in Native Portal"
                            >
                              <ExternalLink size={14} />
                            </a>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-300">
                        {o.PickUp_Date || o.order_date || 'N/A'}
                      </td>
                      <td className="px-4 py-3 text-gray-300">
                        {o.Deliver_Time || o.PickUp_Time || 'N/A'}
                      </td>
                      <td className="px-4 py-3 font-medium text-white truncate max-w-[200px]" title={o.Customer_Name}>
                        {o.Customer_Name || 'N/A'}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs uppercase tracking-wider text-gray-400">
                          {o.Order_Type || 'N/A'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {o.status ? (
                          <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${o.status.toLowerCase() === 'finalized' ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'}`}>
                            {o.status}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="px-4 py-3 text-gray-400">
                        {sub === 0 && o.Order_Type === "MEAL MANAGER" ? <span className="text-gray-500 font-bold italic">TBD</span> : `$${sub.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`}
                      </td>
                      <td className="px-4 py-3 text-gray-400">
                        {tax === 0 && o.Order_Type === "MEAL MANAGER" ? <span className="text-gray-500 font-bold italic">TBD</span> : `$${tax.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-200">
                        {tot === 0 && o.Order_Type === "MEAL MANAGER" ? <span className="text-gray-500 font-bold italic">TBD</span> : `$${tot.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`}
                      </td>
                      <td className="px-4 py-3 font-bold text-green-400 bg-green-400/5 group-hover:bg-green-400/10">
                        {net === 0 && o.Order_Type === "MEAL MANAGER" ? <span className="text-green-800 font-bold italic">TBD</span> : `$${net.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`}
                      </td>
                      <td className="px-4 py-3 text-gray-400">
                        {o.Deliver_Driver || 'Unassigned'}
                      </td>
                      <td className="px-4 py-3 text-gray-400 truncate max-w-[250px]" title={o.Deliver_Address}>
                        {o.Deliver_Address || 'N/A'}
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AnimatePresence>
        {editingOrder && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setEditingOrder(null)}
            />
            
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-2xl bg-[#0a0a0a] border border-white/10 rounded-3xl p-8 shadow-2xl z-10 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-start mb-6 border-b border-white/5 pb-6">
                <div>
                  <h2 className="text-2xl font-black mb-1 text-white">Edit Record</h2>
                  <p className="text-sm font-mono text-gray-500">
                    ID: {editingOrder.Order_ID || editingOrder.order_id || editingOrder.id} • Date: {editingOrder.PickUp_Date || editingOrder.order_date}
                  </p>
                </div>
                <button onClick={() => setEditingOrder(null)} className="text-gray-500 hover:text-white bg-white/5 p-2 rounded-xl transition-colors">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSave} className="space-y-6">
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-1">Customer Name</label>
                    <input 
                      type="text" 
                      required
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 placeholder-gray-600 focus:outline-none focus:border-shred-red transition-colors text-white text-sm"
                      value={formData.Customer_Name}
                      onChange={(e) => setFormData({...formData, Customer_Name: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-1">Execution Date (YYYY-MM-DD)</label>
                    <input 
                      type="text" 
                      required
                      placeholder="e.g. 2026-03-31"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 placeholder-gray-600 focus:outline-none focus:border-shred-red transition-colors text-white font-mono text-sm"
                      value={formData.PickUp_Date}
                      onChange={(e) => setFormData({...formData, PickUp_Date: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-1">Status</label>
                    <select 
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-3 text-white focus:outline-none focus:border-shred-red transition-colors text-sm [&>option]:bg-[#0f0f11]"
                      value={formData.status}
                      onChange={(e) => setFormData({...formData, status: e.target.value})}
                    >
                      <option value="NEW">New</option>
                      <option value="ACTIVE">Active</option>
                      <option value="FINALIZED">Finalized</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-1">Assigned Driver</label>
                    <input 
                      type="text" 
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 placeholder-gray-600 focus:outline-none focus:border-shred-red transition-colors text-white text-sm"
                      value={formData.Deliver_Driver}
                      onChange={(e) => setFormData({...formData, Deliver_Driver: e.target.value})}
                    />
                  </div>
                </div>

                <div className="bg-white/5 border border-white/10 p-5 rounded-2xl grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-1">Subtotal ($)</label>
                    <input 
                      type="number" 
                      step="0.01"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 placeholder-gray-600 focus:outline-none focus:border-shred-red transition-colors text-white font-mono text-sm"
                      value={formData.Order_Subtotal}
                      onChange={(e) => setFormData({...formData, Order_Subtotal: parseFloat(e.target.value) || 0})}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-1">Tax & Fees ($)</label>
                    <input 
                      type="number" 
                      step="0.01"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 placeholder-gray-600 focus:outline-none focus:border-shred-red transition-colors text-white font-mono text-sm"
                      value={formData.Tax}
                      onChange={(e) => setFormData({...formData, Tax: parseFloat(e.target.value) || 0})}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-1">Gross Total ($)</label>
                    <input 
                      type="number" 
                      step="0.01"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 placeholder-gray-600 focus:outline-none focus:border-shred-red transition-colors text-white font-mono text-sm"
                      value={formData.Order_Total}
                      onChange={(e) => setFormData({...formData, Order_Total: parseFloat(e.target.value) || 0})}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-shred-red uppercase tracking-widest block mb-1">Net Payout ($)</label>
                    <input 
                      type="number" 
                      step="0.01"
                      className="w-full bg-shred-red/10 border border-shred-red/30 rounded-xl px-3 py-2 placeholder-gray-600 focus:outline-none focus:border-shred-red transition-colors text-white font-mono text-sm"
                      value={formData.Order_Net}
                      onChange={(e) => setFormData({...formData, Order_Net: parseFloat(e.target.value) || 0})}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-1">Delivery Address</label>
                  <input 
                    type="text" 
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 placeholder-gray-600 focus:outline-none focus:border-shred-red transition-colors text-white text-sm"
                    value={formData.Deliver_Address || ''}
                    onChange={(e) => setFormData({...formData, Deliver_Address: e.target.value})}
                  />
                </div>

                {/* Advanced Dynamic Fields Extractor */}
                <div className="pt-6 border-t border-white/5 space-y-4">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-shred-red flex items-center gap-2">
                    Advanced Metadata & Additional Fields
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Object.entries(formData).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => {
                      // Skip core standard keys rendered above and complex un-editable structures
                      const standardKeys = [
                        'id', 'Customer_Name', 'customer_name', 'PickUp_Date', 'order_date', 
                        'status', 'Deliver_Driver', 'Order_Subtotal', 'subtotal', 'Tax', 'tax', 
                        'Order_Total', 'total_amount', 'Order_Net', 'Deliver_Address', 'Item', 
                        'items', 'Order_ID', 'order_id'
                      ];
                      
                      if (standardKeys.includes(key)) return null;
                      if (typeof value === 'object' && value !== null) return null; // Block complex objects (like items arrays)
                      
                      const valType = typeof value;
                      const isNum = (valType === 'number');

                      return (
                        <div key={key}>
                          <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest block mb-1 truncate" title={key}>{key}</label>
                          {String(value).length > 60 && !isNum ? (
                             <textarea 
                               className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-gray-300 focus:outline-none focus:border-shred-red transition-colors text-xs font-mono min-h-[60px]"
                               value={String(value)}
                               onChange={(e) => setFormData({...formData, [key]: e.target.value})}
                             />
                          ) : (
                             <input 
                               type={isNum ? "number" : "text"} 
                               step={isNum ? "any" : undefined}
                               className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-gray-300 focus:outline-none focus:border-shred-red transition-colors text-xs font-mono"
                               value={value == null ? '' : String(value)}
                               onChange={(e) => setFormData({...formData, [key]: isNum ? (parseFloat(e.target.value) || 0) : e.target.value})}
                             />
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div className="pt-6 border-t border-white/5 flex gap-3 justify-end mt-8">
                  <button 
                    type="button" 
                    onClick={() => setEditingOrder(null)} 
                    className="px-6 py-3 rounded-xl font-bold border border-white/10 hover:bg-white/5 transition-colors text-white text-sm"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={saving}
                    className="px-8 py-3 rounded-xl font-bold bg-shred-red hover:bg-red-600 transition-all text-white text-sm flex items-center gap-2"
                  >
                    {saving ? <Loader2 size={16} className="animate-spin" /> : null}
                    {saving ? 'Syncing...' : 'Force Sync to Firebase'}
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
