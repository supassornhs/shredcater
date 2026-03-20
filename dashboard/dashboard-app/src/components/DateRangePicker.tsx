"use client";

import React, { useState } from "react";
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface DateRange {
  start: Date | null;
  end: Date | null;
}

interface DateRangePickerProps {
  onApply: (range: DateRange) => void;
  onCancel: () => void;
  initialRange?: DateRange;
}

export default function DateRangePicker({ onApply, onCancel, initialRange }: DateRangePickerProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [range, setRange] = useState<DateRange>(initialRange || { start: null, end: null });

  const days = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth),
  });

  // Paddings for start/end of week
  const firstDayOfWeek = startOfMonth(currentMonth).getDay();
  const prePadding = Array(firstDayOfWeek).fill(null);

  const handleDateClick = (day: Date) => {
    if (!range.start || (range.start && range.end)) {
      setRange({ start: day, end: null });
    } else if (day < range.start) {
      setRange({ start: day, end: range.start });
    } else {
      setRange({ ...range, end: day });
    }
  };

  const isInRange = (day: Date) => {
    if (!range.start || !range.end) return false;
    return isWithinInterval(day, { start: startOfDay(range.start), end: endOfDay(range.end) });
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.95 }}
      className="glass-card rounded-3xl p-6 w-[380px] shadow-2xl border border-white/10 z-[100] absolute right-0 mt-2"
    >
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-2 hover:bg-white/5 rounded-xl">
          <ChevronLeft size={20} />
        </button>
        <h3 className="font-bold text-lg">{format(currentMonth, "MMMM yyyy")}</h3>
        <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-2 hover:bg-white/5 rounded-xl">
          <ChevronRight size={20} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-4">
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
          <div key={d} className="text-center text-[10px] font-black text-gray-500 uppercase py-2">
            {d}
          </div>
        ))}
        {prePadding.map((_, i) => <div key={`pre-${i}`} />)}
        {days.map((day) => {
          const isSelected = (range.start && isSameDay(day, range.start)) || (range.end && isSameDay(day, range.end));
          const inRange = isInRange(day);
          
          return (
            <div 
              key={day.toISOString()}
              onClick={() => handleDateClick(day)}
              className={`
                h-10 flex items-center justify-center cursor-pointer rounded-lg text-sm transition-all relative
                ${isSelected ? 'bg-shred-red text-white font-bold z-10 shadow-lg shadow-shred-red/20' : 'hover:bg-white/5'}
                ${inRange && !isSelected ? 'bg-shred-red/10 text-shred-red' : ''}
              `}
            >
              {format(day, "d")}
              {inRange && !isSelected && (
                <div className="absolute inset-0 bg-shred-red/5 -z-10" />
              )}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="text-[10px] font-black text-gray-500 uppercase mb-1 block">Start Date</label>
          <div className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm flex items-center justify-between">
            {range.start ? format(range.start, "MM/dd/yyyy") : "Select..."}
            <CalendarIcon size={14} className="text-gray-500" />
          </div>
        </div>
        <div>
          <label className="text-[10px] font-black text-gray-500 uppercase mb-1 block">End Date</label>
          <div className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm flex items-center justify-between">
            {range.end ? format(range.end, "MM/dd/yyyy") : "Select..."}
            <CalendarIcon size={14} className="text-gray-500" />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/5">
        <button 
          onClick={onCancel}
          className="px-4 py-2 text-sm font-bold text-gray-400 hover:text-white transition-colors"
        >
          Cancel
        </button>
        <button 
          onClick={() => onApply(range)}
          className="px-6 py-2 bg-white text-black text-sm font-black rounded-xl hover:scale-105 transition-transform"
        >
          Apply Range
        </button>
      </div>
    </motion.div>
  );
}
