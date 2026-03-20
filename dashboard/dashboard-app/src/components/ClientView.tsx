"use client";

import React, { useState, useEffect } from "react";
import { collectionGroup, getDocs, query, orderBy, getFirestore } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { motion, AnimatePresence } from "framer-motion";
import { Search, ChevronDown, Package, Clock, DollarSign, ExternalLink } from "lucide-react";

interface Order {
  id: string;
  order_id: string;
  order_date: string;
  platform: string;
  customer_name?: string;
  total_amount?: number;
  items: Array<{ dish_name: string; quantity: number }>;
  last_updated: any;
}

export default function ClientView({ dateRange }: { dateRange: { start: Date | null, end: Date | null } }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  useEffect(() => {
    async function fetchOrders() {
      try {
        const response = await fetch('/api/orders');
        const data = await response.json();
        
        if (data.error) throw new Error(data.error);

        const fetchedOrders = (data.orders || []) as Order[];
        
        // Sort by date manually
        fetchedOrders.sort((a, b) => new Date(b.order_date).getTime() - new Date(a.order_date).getTime());
        
        setOrders(fetchedOrders);
      } catch (err) {
        console.error("Error fetching orders:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchOrders();
  }, []);

  const filteredOrders = orders.filter(o => {
    const matchesSearch = (o.customer_name || "").toLowerCase().includes(search.toLowerCase()) ||
                         o.order_id.toLowerCase().includes(search.toLowerCase());
    
    if (!dateRange.start || !dateRange.end) return matchesSearch;

    const orderDate = new Date(o.order_date);
    const isInRange = orderDate >= dateRange.start && orderDate <= dateRange.end;
    
    return matchesSearch && isInRange;
  });

  return (
    <div className="space-y-6">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
        <input 
          type="text" 
          placeholder="Search by client name or ID..." 
          className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-4 focus:outline-none focus:border-shred-red/50 transition-all font-medium"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="grid gap-4">
        {loading ? (
          Array(3).fill(0).map((_, i) => (
            <div key={i} className="h-24 glass-card rounded-2xl animate-pulse" />
          ))
        ) : filteredOrders.map((order) => (
          <motion.div 
            key={order.id}
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => setSelectedOrder(selectedOrder?.id === order.id ? null : order)}
            className={`glass-card rounded-2xl p-5 cursor-pointer group ${selectedOrder?.id === order.id ? 'border-shred-red/30 bg-white/10' : ''}`}
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-shred-red/10 flex items-center justify-center text-shred-red">
                  <Package size={22} />
                </div>
                <div>
                  <h3 className="font-bold text-lg group-hover:text-shred-red transition-colors">
                    {order.customer_name || `Order #${order.order_id}`}
                  </h3>
                  <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                    <span className="flex items-center gap-1"><Clock size={14} /> {order.order_date}</span>
                    <span className="flex items-center gap-1 font-medium text-red-400">{order.platform}</span>
                  </div>
                </div>
              </div>

              <div className="text-right">
                <div className="text-xl font-bold font-mono">${order.total_amount?.toLocaleString() || '0'}</div>
                <div className="text-xs text-gray-500 uppercase tracking-widest mt-1">Total Amount</div>
              </div>
            </div>

            <AnimatePresence>
              {selectedOrder?.id === order.id && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="pt-6 mt-6 border-t border-white/5 space-y-4">
                    <h4 className="text-sm font-semibold uppercase tracking-wider text-gray-400 flex items-center gap-2">
                      <ChevronDown size={14} /> Order Details
                    </h4>
                    <div className="grid gap-2">
                        {order.items.map((item, idx) => (
                          <div key={idx} className="flex justify-between items-center bg-white/5 p-3 rounded-xl border border-white/5">
                            <span className="font-medium">{item.dish_name}</span>
                            <span className="px-3 py-1 bg-shred-red/20 text-shred-red text-xs font-bold rounded-lg uppercase">x{item.quantity}</span>
                          </div>
                        ))}
                    </div>
                    {/* Placeholder for notes */}
                    <div className="bg-shred-red/5 p-4 rounded-xl border border-shred-red/20 italic text-sm text-gray-300">
                      No additional notes provided for this order.
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
