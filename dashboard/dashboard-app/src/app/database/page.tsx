"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Search, Database } from "lucide-react";

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

  const filteredOrders = orders.filter(o => 
    Object.values(o).some(val => 
      String(val).toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

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
        
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search any field..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-xl focus:border-shred-red focus:ring-1 focus:ring-shred-red transition-all w-64 text-white placeholder-gray-500 font-mono text-sm"
            />
          </div>
          <div className="bg-white/5 border border-white/10 px-4 py-2 rounded-xl text-sm font-mono text-gray-300">
            Records: {filteredOrders.length}
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
                  const net = o.Order_Net || 0;

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
                        {o.Order_ID || o.order_id || 'N/A'}
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
                        ${sub.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                      </td>
                      <td className="px-4 py-3 text-gray-400">
                        ${tax.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-200">
                        ${tot.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                      </td>
                      <td className="px-4 py-3 font-bold text-green-400 bg-green-400/5 group-hover:bg-green-400/10">
                        ${net.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
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
