"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Package, Calendar as CalendarIcon, Clock } from "lucide-react";

interface Order {
  id: string;
  Order_ID?: string;
  order_id?: string;
  PickUp_Date?: string;
  order_date?: string;
  Customer_Name?: string;
  customer_name?: string;
  platforms?: string;
}

export default function CalendarView({ onEditOrder }: { onEditOrder?: (order: any) => void }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => {
    async function fetchOrders() {
      try {
        const response = await fetch('/api/orders');
        const data = await response.json();
        if (data.error) throw new Error(data.error);
        setOrders(data.orders || []);
      } catch (err) {
        console.error("Error fetching orders:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchOrders();
  }, []);

  const changeMonth = (offset: number) => {
    const nextDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1);
    setCurrentDate(nextDate);
  };

  // Calendar Math
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthName = currentDate.toLocaleString('default', { month: 'long' });

  const ordersByDate = orders.reduce((acc, order) => {
    try {
      const activeDate = order.PickUp_Date || order.order_date;
      if (!activeDate) return acc;
      
      let dateStr = activeDate;
      if (dateStr.includes('T')) dateStr = dateStr.split('T')[0];
      
      if (!acc[dateStr]) acc[dateStr] = [];
      acc[dateStr].push(order);
    } catch (e) {}
    return acc;
  }, {} as Record<string, Order[]>);

  const days = [];
  // Fillers for previous month
  for (let i = 0; i < firstDay; i++) {
    days.push(<div key={`empty-${i}`} className="min-h-32 border border-white/5 bg-transparent opacity-20" />);
  }

  // Days of the month
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dayOrders = ordersByDate[dateStr] || [];
    const isToday = new Date().toISOString().split('T')[0] === dateStr;

    days.push(
      <div key={d} className={`min-h-32 border border-white/5 p-3 bg-white/5 hover:bg-white/[0.08] transition-colors relative group ${isToday ? 'ring-1 ring-shred-red/50 bg-shred-red/5' : ''}`}>
        <div className={`text-xs font-bold ${isToday ? 'text-shred-red' : 'text-gray-500'} mb-3`}>
          {d}
        </div>
        
        <div className="space-y-2 pb-2">
          {dayOrders.map((order, idx) => (
            <div 
              key={idx} 
              onClick={() => onEditOrder && onEditOrder(order)}
              className={`px-2.5 py-2 rounded-xl bg-white/5 border border-white/10 text-[10px] hover:bg-white/10 transition-all font-medium flex items-start gap-2 group/badge ${onEditOrder ? 'cursor-pointer hover:border-shred-red/50 hover:scale-[1.02]' : 'cursor-default'}`}
              title={`${order.Customer_Name || order.customer_name || 'No Name'} (${order.platforms || 'Unknown'})`}
            >
              <div className="w-1.5 h-1.5 rounded-full bg-shred-red shrink-0 mt-1" />
              <div className="flex flex-col min-w-0 w-full leading-tight">
                <span className="font-bold text-white truncate w-full mb-0.5">
                  {order.Customer_Name || order.customer_name || ((order.Order_ID || order.order_id || '').startsWith('#') ? (order.Order_ID || order.order_id) : `#${order.Order_ID || order.order_id}`)}
                </span>
                <span className="text-[8px] text-gray-400 font-bold uppercase truncate">
                  {order.platforms || 'Unknown Platform'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-[2rem] overflow-hidden border border-white/10 shadow-2xl">
      <header className="p-6 border-b border-white/5 bg-white/5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-shred-red/10 text-shred-red">
            <CalendarIcon size={24} />
          </div>
          <div>
            <h2 className="text-xl font-black">{monthName} <span className="text-gray-500 font-medium">{year}</span></h2>
          </div>
        </div>
        
        <div className="flex gap-2">
          <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
            <ChevronLeft size={20} />
          </button>
          <button onClick={() => setCurrentDate(new Date())} className="px-4 py-2 text-xs font-bold uppercase tracking-widest hover:bg-white/10 rounded-xl transition-colors translate-y-[1px]">
            Today
          </button>
          <button onClick={() => changeMonth(1)} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
            <ChevronRight size={20} />
          </button>
        </div>
      </header>

      <div className="grid grid-cols-7 border-b border-white/5">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="py-3 text-center text-[10px] font-black uppercase tracking-widest text-gray-500 border-r border-white/5">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 bg-white/[0.02]">
        {loading ? (
           Array(35).fill(0).map((_, i) => <div key={i} className="h-32 border border-white/5 animate-pulse bg-white/5" />)
        ) : (
          days
        )}
      </div>
    </div>
  );
}
