"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, ChefHat, Activity, ChevronRight, Hash, Globe } from "lucide-react";

interface DishBreakdown {
  order_id: string;
  platform: string;
  quantity: number;
  order_date: string;
}

interface Dish {
  dish_name: string;
  total_quantity: number;
  orders: DishBreakdown[];
}

export default function DishView({ dateRange }: { dateRange: { start: Date | null, end: Date | null } }) {
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedDish, setSelectedDish] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDishes() {
      try {
        setLoading(true);
        const response = await fetch('/api/orders');
        const data = await response.json();

        if (data.error) throw new Error(data.error);
        
        const dishMap = new Map<string, Dish>();
        
        // Iterate through orders to get full context for each dish
        (data.orders || []).forEach((order: any) => {
          const activeDateStr = order.PickUp_Date || order.order_date;
          if (dateRange.start && dateRange.end && activeDateStr) {
            const orderDate = new Date(activeDateStr);
            if (orderDate < dateRange.start || orderDate > dateRange.end) return;
          }

          const itemsList = order.Item || order.items || [];
          itemsList.forEach((item: any) => {
            const name = item.Item_Name || item.dish_name || 'Unknown Dish';
            const quantity = Number(item.Item_Amount) || Number(item.quantity) || 1;

            if (dishMap.has(name)) {
              const existing = dishMap.get(name)!;
              existing.total_quantity += quantity;
              existing.orders.push({
                order_id: order.Order_ID || order.order_id || 'Unknown',
                platform: order.platforms || order.platform || order.Deliver_Partner || 'Unknown',
                quantity: quantity,
                order_date: order.PickUp_Date || order.order_date || 'Unknown Date'
              });
            } else {
              dishMap.set(name, {
                dish_name: name,
                total_quantity: quantity,
                orders: [{
                  order_id: order.Order_ID || order.order_id || 'Unknown',
                  platform: order.platforms || order.platform || order.Deliver_Partner || 'Unknown',
                  quantity: quantity,
                  order_date: order.PickUp_Date || order.order_date || 'Unknown Date'
                }]
              });
            }
          });
        });
        
        setDishes(Array.from(dishMap.values()).sort((a,b) => b.total_quantity - a.total_quantity));
      } catch (err) {
        console.error("Error fetching dishes:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchDishes();
  }, [dateRange]);

  const filteredDishes = dishes.filter(d => 
    d.dish_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
        <input 
          type="text" 
          placeholder="Search by dish name..." 
          className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-4 focus:outline-none focus:border-shred-red/50 transition-all font-medium"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-3">
        {loading ? (
          Array(5).fill(0).map((_, i) => (
            <div key={i} className="h-20 glass-card rounded-2xl animate-pulse" />
          ))
        ) : filteredDishes.map((dish) => (
          <motion.div 
            key={dish.dish_name}
            layout
            className={`glass-card rounded-2xl overflow-hidden border border-white/5 transition-all ${selectedDish === dish.dish_name ? 'ring-1 ring-shred-red/30' : ''}`}
          >
            <div 
              onClick={() => setSelectedDish(selectedDish === dish.dish_name ? null : dish.dish_name)}
              className="p-5 flex items-center justify-between cursor-pointer hover:bg-white/[0.02] transition-colors gap-4"
            >
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-12 h-12 rounded-xl bg-shred-red/10 flex items-center justify-center text-shred-red shrink-0">
                  <ChefHat size={22} />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-lg truncate">{dish.dish_name}</h3>
                  <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                    <span className="flex items-center gap-1"><Activity size={12} /> {dish.orders?.length || 0} orders</span>
                    <span className="flex items-center gap-1 font-medium text-shred-red/80">
                      <Globe size={12} /> {Array.from(new Set(dish.orders?.map(o => o.platform) || [])).join(', ')}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-8">
                <div className="text-right">
                  <div className="text-2xl font-black text-white">{dish.total_quantity}</div>
                  <div className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Units Sold</div>
                </div>
                <motion.div
                  animate={{ rotate: selectedDish === dish.dish_name ? 90 : 0 }}
                  className="text-gray-500"
                >
                  <ChevronRight size={20} />
                </motion.div>
              </div>
            </div>

            <AnimatePresence>
              {selectedDish === dish.dish_name && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="bg-black/20"
                >
                  <div className="p-5 pt-4 grid grid-cols-1 md:grid-cols-2 gap-3 pb-6">
                    {dish.orders.map((order, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-white/5 p-5 rounded-2xl border border-white/5 hover:bg-white/10 transition-colors">
                        <div>
                          <div className="text-xs font-bold text-gray-400 flex items-center gap-1 mb-2">
                            <Hash size={10} /> {order.order_id}
                          </div>
                          <div className="text-xs font-medium text-shred-red">{order.platform}</div>
                        </div>
                        <div className="flex flex-col items-end">
                          <div className="text-sm font-black text-white">x{order.quantity}</div>
                          <div className="text-[10px] text-gray-500 mt-1">{order.order_date}</div>
                        </div>
                      </div>
                    ))}
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
