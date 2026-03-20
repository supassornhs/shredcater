"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ChefHat, CheckCircle2, Circle, Clock, Package, Printer, ListTodo } from "lucide-react";
import { format } from "date-fns";

interface DishSummary {
  dish_name: string;
  total_quantity: number;
  platforms: string[];
}

export default function PreparationView({ dateRange }: { dateRange: { start: Date | null, end: Date | null } }) {
  const [items, setItems] = useState<DishSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [completedItems, setCompletedItems] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function fetchPrepData() {
      try {
        setLoading(true);
        const response = await fetch('/api/orders');
        const data = await response.json();

        if (data.error) throw new Error(data.error);

        const summaryMap = new Map<string, DishSummary>();

        (data.orders || []).forEach((order: any) => {
          if (dateRange.start && dateRange.end && order.order_date) {
            const orderDate = new Date(order.order_date);
            if (orderDate < dateRange.start || orderDate > dateRange.end) return;
          }

          (order.items || []).forEach((item: any) => {
            const name = item.dish_name;
            const quantity = item.quantity || 0;

            if (summaryMap.has(name)) {
              const existing = summaryMap.get(name)!;
              existing.total_quantity += quantity;
              if (!existing.platforms.includes(order.platform)) {
                existing.platforms.push(order.platform);
              }
            } else {
              summaryMap.set(name, {
                dish_name: name,
                total_quantity: quantity,
                platforms: [order.platform]
              });
            }
          });
        });

        setItems(Array.from(summaryMap.values()).sort((a, b) => b.total_quantity - a.total_quantity));
      } catch (err) {
        console.error("Prep View Error:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchPrepData();
  }, [dateRange]);

  const toggleComplete = (name: string) => {
    const newSet = new Set(completedItems);
    if (newSet.has(name)) newSet.delete(name);
    else newSet.add(name);
    setCompletedItems(newSet);
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {Array(4).fill(0).map((_, i) => (
          <div key={i} className="h-24 glass-card rounded-3xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-8 print:p-0">
      <div className="flex items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-shred-red/10 text-shred-red">
            <ListTodo size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-black">Kitchen <span className="text-shred-red italic">Prep List</span></h2>
            <p className="text-gray-500 text-sm font-medium">Items to prepare for {items.reduce((sum, i) => sum + i.total_quantity, 0)} total units</p>
          </div>
        </div>

        <button 
          onClick={handlePrint}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-white/10 hover:bg-white/5 transition-all font-bold text-xs"
        >
          <Printer size={16} />
          Print Ticket
        </button>
      </div>

      {items.length === 0 ? (
        <div className="py-20 glass-card rounded-[3rem] text-center border-dashed border-2 border-white/10">
          <ChefHat size={48} className="mx-auto text-gray-700 mb-4" />
          <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">No items to prepare for this period</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 print:grid-cols-1">
          {items.map((item, i) => {
            const isDone = completedItems.has(item.dish_name);
            return (
              <motion.div
                key={item.dish_name}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`
                  glass-card rounded-3xl p-6 border transition-all flex items-center justify-between
                  ${isDone ? 'bg-green-500/5 border-green-500/20 opacity-60' : 'border-white/5 hover:border-shred-red/20'}
                `}
              >
                <div className="flex items-center gap-6">
                  <button 
                    onClick={() => toggleComplete(item.dish_name)}
                    className={`transition-colors print:hidden ${isDone ? 'text-green-500' : 'text-gray-600 hover:text-white'}`}
                  >
                    {isDone ? <CheckCircle2 size={28} /> : <Circle size={28} />}
                  </button>
                  
                  <div>
                    <h3 className={`text-xl font-black ${isDone ? 'line-through text-gray-500' : 'text-white'}`}>
                      {item.dish_name}
                    </h3>
                    <div className="flex items-center gap-4 mt-2">
                       <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-gray-500">
                        <Package size={12} className="text-shred-red" />
                        {item.platforms.join(" • ")}
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-gray-500">
                        <Clock size={12} />
                        Today
                      </div>
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className={`text-4xl font-black ${isDone ? 'text-gray-500' : 'text-shred-red'}`}>
                    x{item.total_quantity}
                  </div>
                  <div className="text-[10px] text-gray-500 uppercase font-black tracking-widest mt-1">
                    Units Needed
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Print-only CSS */}
      <style jsx global>{`
        @media print {
          body * { visibility: hidden; }
          .print-section, .print-section * { visibility: visible; }
          .print-section { position: absolute; left: 0; top: 0; width: 100%; }
        }
      `}</style>
    </div>
  );
}
