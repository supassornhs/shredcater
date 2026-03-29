"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Database, Filter, ExternalLink } from "lucide-react";
import DateRangePicker from "@/components/DateRangePicker";
import { format, startOfMonth, endOfMonth } from "date-fns";

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
    start: startOfMonth(new Date()), 
    end: endOfMonth(new Date()) 
  });
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    async function fetchOrders() {
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
    }
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

    // Legacy Fallbacks (Note: Cater2.Me & Hungry UUIDs were historically discarded, so linking is impossible for legacy entries)
    const p = (o.platforms || o.Deliver_Partner || "").toUpperCase();
    const orderId = o.Order_ID || o.order_id || "";
    
    if (p === "CLUBFEAST") {
      return `https://restaurant.clubfeast.com/orders/${orderId}?canceled=false`;
    }
    
    // For legacy Cater2.Me and Hungry without a saved Order_URL, we return "#" because their deep-links require lost UUIDs 
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
    </div>
  );
}
