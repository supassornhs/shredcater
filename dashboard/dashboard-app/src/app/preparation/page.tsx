"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ListTodo, Filter, X } from "lucide-react";
import PreparationView from "@/components/PreparationView";
import DateRangePicker from "@/components/DateRangePicker";
import { format, isSameDay, startOfDay, endOfDay } from "date-fns";

interface DateRange {
  start: Date | null;
  end: Date | null;
}

export default function PreparationPage() {
  const [dateRange, setDateRange] = useState<DateRange>({ 
    start: startOfDay(new Date()), 
    end: endOfDay(new Date()) 
  });
  const [showDatePicker, setShowDatePicker] = useState(false);

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
      <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black tracking-tight mb-2">
            Kitchen <span className="text-shred-red italic">Preparation</span>
          </h1>
          <p className="text-gray-500 font-medium">
            Plan your production and prep lists across all platforms.
          </p>
        </div>

        <div className="flex flex-col md:flex-row items-center gap-4">
          <div className="relative">
            <button 
              onClick={() => setShowDatePicker(!showDatePicker)}
              className={`
                flex items-center gap-2 px-5 py-2.5 rounded-2xl border transition-all font-bold text-sm
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
      </header>

      <PreparationView dateRange={dateRange} />
    </div>
  );
}
