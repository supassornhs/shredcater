"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ShoppingCart, TrendingUp, Users, Calendar, Filter, X, Globe, Clock, Activity, LayoutGrid, List } from "lucide-react";
import DateRangePicker from "@/components/DateRangePicker";
import { format, isSameDay, startOfDay, endOfDay, startOfMonth, endOfMonth, differenceInCalendarDays, getDay, getHours } from "date-fns";
import { normalizeDishName } from "@/lib/utils";

interface OrderItem {
  Item_Name: string;
  Item_Amount: number;
  Item_Price?: number;
  Item_Customization?: string;
  Item_Total?: number;
}

interface Order {
  id: string;
  Order_ID?: string;
  order_id?: string;
  PickUp_Date?: string;
  order_date?: string;
  Order_Total?: number;
  total_amount?: number;
  platforms?: string;
  Customer_Name?: string;
  Order_Confirm_Date?: string;
  Order_Type?: string;
  PickUp_Time?: string;
  Deliver_Time?: string;
  Deliver_Address?: string;
  Deliver_Instruction?: string;
  Deliver_Driver?: string;
  Deliver_Partner?: string;
  Order_Subtotal?: number;
  Tax?: number;
  Order_Notes?: string;
  Utensils?: string;
  Confirmation_Code?: string;
  Item: OrderItem[];
  last_updated?: {
    _seconds: number;
    _nanoseconds: number;
  };
}

interface DateRange {
  start: Date | null;
  end: Date | null;
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const TIME_SLOTS = ["08:00", "10:00", "12:00", "14:00", "16:00"];

export default function Home() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>({ 
    start: startOfMonth(new Date()), 
    end: endOfMonth(new Date()) 
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [heatmapMode, setHeatmapMode] = useState<'orders' | 'items'>('orders');

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

  const applyFilter = (range: DateRange) => {
    setDateRange(range);
    setShowDatePicker(false);
  };

  const clearFilter = () => {
    setDateRange({ start: startOfMonth(new Date()), end: endOfMonth(new Date()) });
    setShowDatePicker(false);
  };

  const getDateLabel = () => {
    if (!dateRange.start || !dateRange.end) return "Filter Dates";
    if (isSameDay(dateRange.start, dateRange.end)) {
      return format(dateRange.start, "MMM d");
    }
    return `${format(dateRange.start, "MMM d")} - ${format(dateRange.end, "MMM d")}`;
  };

  const filteredOrders = orders.filter(o => {
    if (!dateRange.start || !dateRange.end) return true;
    const dateVal = o.PickUp_Date || o.order_date;
    if (!dateVal) return false;
    const orderDate = new Date(dateVal);
    return orderDate >= dateRange.start && orderDate <= dateRange.end;
  });

  const totalRevenue = filteredOrders.reduce((sum, o) => sum + (o.Order_Subtotal ?? o.Order_Total ?? o.total_amount ?? 0), 0);
  const totalOrders = filteredOrders.length;
  const avgRevPerOrder = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  
  const diffDays = (dateRange.start && dateRange.end) 
    ? differenceInCalendarDays(dateRange.end, dateRange.start) + 1 
    : 1;
  const avgRevPerDay = totalRevenue / diffDays;

  const stats = [
    { label: "Orders", value: totalOrders.toLocaleString(), icon: ShoppingCart, color: "text-shred-red" },
    { label: "Revenue", value: `$${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, icon: TrendingUp, color: "text-shred-red" },
    { label: "Avg per Order", value: `$${avgRevPerOrder.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, icon: Users, color: "text-shred-red" },
    { label: "Avg per Day", value: `$${avgRevPerDay.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, icon: Calendar, color: "text-shred-red" },
  ];

  const platformStats = filteredOrders.reduce((acc, o) => {
    const p = o.platforms || o.Deliver_Partner || "Unknown";
    if (!acc[p]) acc[p] = { orders: 0, revenue: 0 };
    acc[p].orders += 1;
    acc[p].revenue += (o.Order_Subtotal ?? o.Order_Total ?? o.total_amount ?? 0);
    return acc;
  }, {} as Record<string, { orders: number, revenue: number }>);

  const menuStats = filteredOrders.reduce((acc, o) => {
    (o.Item || []).forEach((item) => {
      let name = item.Item_Name || "Unknown Dish";
      name = normalizeDishName(name);

      if (!acc[name]) acc[name] = { quantity: 0 };
      acc[name].quantity += (item.Item_Amount || 0);
    });
    return acc;
  }, {} as Record<string, { quantity: number }>);

  const sortedMenus = Object.entries(menuStats).sort((a, b) => b[1].quantity - a[1].quantity);

  // Heatmap Data Calculation
  const heatmapData = Array(7).fill(0).map(() => Array(5).fill(0));
  
  filteredOrders.forEach(o => {
    const activeDate = o.PickUp_Date || o.order_date;
    if (!activeDate) return;
    const [yyyy, mm, dd] = activeDate.split('-');
    let d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
    
    let hour = 12; // Fallback to Noon if no time specified
    const timeStr = o.Deliver_Time || o.PickUp_Time;
    
    if (timeStr) {
      const match = timeStr.match(/(\d+)/);
      if (match) {
        let h = parseInt(match[1]);
        if (timeStr.toLowerCase().includes('pm') && h !== 12) h += 12;
        if (timeStr.toLowerCase().includes('am') && h === 12) h = 0;
        hour = h;
      }
    } else {
      let rawHour = getHours(d);
      if (rawHour !== 0) {
        hour = rawHour;
      } else if (o.last_updated?._seconds) {
        hour = getHours(new Date(o.last_updated._seconds * 1000));
      }
    }
    
    if ((o.Order_ID || o.order_id || '').includes('-L')) hour = 11;
    if ((o.Order_ID || o.order_id || '').includes('-D')) hour = 18;

    const dayIdx = (getDay(d) + 6) % 7;

    let slotIdx = -1;
    if (hour < 10) slotIdx = 0;
    else if (hour >= 10 && hour < 12) slotIdx = 1;
    else if (hour >= 12 && hour < 14) slotIdx = 2;
    else if (hour >= 14 && hour < 16) slotIdx = 3;
    else if (hour >= 16) slotIdx = 4;

    if (slotIdx !== -1) {
      if (heatmapMode === 'orders') {
        heatmapData[dayIdx][slotIdx]++;
      } else {
        const itemQty = (o.Item || []).reduce((sum, item) => sum + (item.Item_Amount || 0), 0);
        heatmapData[dayIdx][slotIdx] += itemQty;
      }
    }
  });

  const getIntensity = (val: number) => {
    const thresholds = heatmapMode === 'orders' 
      ? { peak: 5, high: 3, mod: 1 } 
      : { peak: 50, high: 20, mod: 5 }; // Scaled for items/dishes

    if (val === 0) return "bg-white/[0.04] border-white/5";
    if (val >= thresholds.peak) return "bg-shred-red border-shred-red shadow-[0_0_20px_rgba(255,49,49,0.5)]";
    if (val >= thresholds.high) return "bg-shred-red/80 border-shred-red/50";
    if (val >= thresholds.mod) return "bg-shred-red/50 border-shred-red/30";
    return "bg-shred-red/25 border-shred-red/10"; // Low (>= 0)
  };

  return (
    <div className="max-w-6xl mx-auto py-10 px-4 space-y-16 pb-20">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-end justify-between gap-6"
      >
        <div>
          <h1 className="text-5xl font-black mb-4 leading-tight">Welcome back, <span className="text-transparent bg-clip-text bg-gradient-to-r from-shred-red to-red-600">PadPad</span></h1>
          <p className="text-gray-500 text-lg">Here's what's happening with HolyShred today.</p>
        </div>

        <div className="relative shrink-0">
          <button 
            onClick={() => setShowDatePicker(!showDatePicker)}
            className={`
              flex items-center gap-2 px-5 py-3 rounded-2xl border transition-all font-bold text-sm
              bg-shred-red/10 border-shred-red/50 text-shred-red
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
      </motion.div>

      {/* Hero Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {loading ? (
          Array(4).fill(0).map((_, i) => (
            <div key={i} className="h-40 glass-card rounded-3xl animate-pulse" />
          ))
        ) : stats.map((stat, i) => (
          <motion.div 
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="glass-card p-6 md:p-8 rounded-3xl"
          >
            <div className={`p-3 rounded-2xl bg-white/5 w-fit mb-6 ${stat.color}`}>
              <stat.icon size={24} />
            </div>
            <div className="text-gray-500 font-bold uppercase tracking-widest text-[10px] mb-2">{stat.label}</div>
            <div className="text-3xl md:text-4xl font-black">{stat.value === "$0" || stat.value === "0" ? "-" : stat.value}</div>
          </motion.div>
        ))}
      </div>

      {/* Middle Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* Left Column: Platform Breakdown */}
        <div className="space-y-6">
          <h2 className="text-2xl font-black flex items-center gap-3">
            <Globe className="text-shred-red" size={24} />
            Platform <span className="text-shred-red italic">Breakdown</span>
          </h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Object.entries(platformStats).length === 0 && !loading ? (
              <div className="col-span-full py-10 glass-card rounded-[2rem] text-center border-dashed border-2 border-white/10">
                <p className="text-gray-500 font-medium">No sales data.</p>
              </div>
            ) : (
              Object.entries(platformStats).map(([name, data], i) => (
                <motion.div
                  key={name}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.05 }}
                  className="glass-card p-5 rounded-3xl border border-white/5 hover:border-shred-red/30 transition-all group"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="text-[10px] font-black uppercase tracking-widest text-shred-red py-1 px-2 bg-shred-red/10 rounded-full">
                      {name}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="text-[9px] font-black text-gray-500 uppercase tracking-wider">Orders</div>
                      <div className="text-xl font-black">{data.orders}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[9px] font-black text-gray-500 uppercase tracking-wider">Revenue</div>
                      <div className="text-xl font-black text-shred-red">${data.revenue.toLocaleString()}</div>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>

        {/* Right Column: Menu Popularity */}
        <div className="space-y-6">
          <h2 className="text-2xl font-black flex items-center gap-3">
            <ShoppingCart className="text-shred-red" size={24} />
            Menu <span className="text-shred-red italic">Popularity</span>
          </h2>
          
          <div className="space-y-2">
            {sortedMenus.length === 0 && !loading ? (
              <div className="py-10 glass-card rounded-[2rem] text-center border-dashed border-2 border-white/10">
                <p className="text-gray-500 font-medium">No menu data.</p>
              </div>
            ) : (
              sortedMenus.slice(0, 10).map(([name, data], i) => (
                <motion.div
                  key={name}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="glass-card px-4 py-3 rounded-2xl border border-white/5 flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-shred-red/10 flex items-center justify-center text-shred-red font-black text-[10px]">
                      #{i + 1}
                    </div>
                    <div>
                      <h4 className="font-bold text-xs text-white group-hover:text-shred-red transition-colors">{name}</h4>
                    </div>
                  </div>
                  <div className="text-right px-3 py-1 bg-white/5 rounded-lg border border-white/5">
                    <span className="text-sm font-black italic">{data.quantity} <span className="text-[8px] text-gray-500 uppercase not-italic ml-1">Units</span></span>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Heatmap Section */}
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-black flex items-center gap-3">
              <Activity className="text-shred-red" size={24} />
              Heatmap <span className="text-shred-red italic">Breakdown</span>
            </h2>
            
            <div className="flex bg-white/5 p-1 rounded-xl border border-white/5 h-fit">
              <button 
                onClick={() => setHeatmapMode('orders')}
                className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-2 ${heatmapMode === 'orders' ? 'bg-shred-red text-white shadow-lg shadow-shred-red/20' : 'text-gray-500 hover:text-white'}`}
              >
                <LayoutGrid size={12} />
                Orders
              </button>
              <button 
                onClick={() => setHeatmapMode('items')}
                className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-2 ${heatmapMode === 'items' ? 'bg-shred-red text-white shadow-lg shadow-shred-red/20' : 'text-gray-500 hover:text-white'}`}
              >
                <List size={12} />
                Dishes
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-[10px] font-black uppercase tracking-widest text-gray-500">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-shred-red/25 border border-shred-red/10" />
              <span>0 (Low)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-shred-red/50 border border-shred-red/30" />
              <span>{heatmapMode === 'orders' ? '1+' : '5+'} (Mod)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-shred-red/80 border border-shred-red/50" />
              <span>{heatmapMode === 'orders' ? '3+' : '20+'} (High)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-shred-red shadow-[0_0_10px_rgba(255,49,49,0.5)]" />
              <span>{heatmapMode === 'orders' ? '5+' : '50+'} (Peak)</span>
            </div>
          </div>
        </div>

        <div className="glass-card p-8 rounded-[3rem] border border-white/5">
          <div className="grid grid-cols-[80px_1fr] gap-8">
            {/* Time Labels */}
            <div className="flex flex-col justify-between py-6 h-full">
              {TIME_SLOTS.map(time => (
                <div key={time} className="flex items-center gap-2 text-[10px] font-black text-gray-500 uppercase tracking-wider h-12">
                  <Clock size={12} />
                  {time}
                </div>
              ))}
              <div className="h-12 flex items-center text-[10px] font-black text-gray-500 uppercase tracking-wider">18:00</div>
            </div>

            {/* Matrix */}
            <div className="space-y-4">
              <div className="grid grid-cols-7 gap-4">
                {DAYS.map(day => (
                  <div key={day} className="text-center text-xs font-black text-gray-500 uppercase tracking-widest">{day}</div>
                ))}
              </div>
              
              <div className="grid grid-cols-7 gap-4">
                {DAYS.map((_, dayCol) => (
                  <div key={dayCol} className="space-y-4">
                    {TIME_SLOTS.map((_, slotRow) => {
                      const value = heatmapData[dayCol][slotRow];
                      return (
                        <motion.div
                          key={slotRow}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: (dayCol + slotRow) * 0.02 }}
                          className={`
                            h-12 rounded-xl border border-white/5 transition-all duration-500 flex items-center justify-center
                            ${getIntensity(value)}
                          `}
                        >
                          {value >= 0 && (
                            <span className="text-[10px] font-black text-black/80">{value}</span>
                          )}
                        </motion.div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
