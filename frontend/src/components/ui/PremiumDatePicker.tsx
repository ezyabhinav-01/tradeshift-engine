import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, X } from 'lucide-react';

interface PremiumDatePickerProps {
  value: string; // Format: YYYY-MM-DD
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
}

export function PremiumDatePicker({ value, onChange, className = '', placeholder = 'Select date' }: PremiumDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [viewDate, setViewDate] = useState(value ? new Date(value) : new Date());
  const [selectionMode, setSelectionMode] = useState<'day' | 'year'>('day');
  const containerRef = useRef<HTMLDivElement>(null);
  const yearGridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSelectionMode('day');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto-scroll to current year when year picker opens
  useEffect(() => {
    if (selectionMode === 'year' && yearGridRef.current) {
      const currentYearBtn = yearGridRef.current.querySelector('[data-current-year="true"]');
      if (currentYearBtn) {
        currentYearBtn.scrollIntoView({ block: 'center', behavior: 'instant' as any });
      }
    }
  }, [selectionMode]);

  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const handlePrevMonth = () => {
    if (selectionMode === 'day') {
      setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
    } else {
      setViewDate(new Date(viewDate.getFullYear() - 12, viewDate.getMonth(), 1));
    }
  };

  const handleNextMonth = () => {
    if (selectionMode === 'day') {
      setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
    } else {
      setViewDate(new Date(viewDate.getFullYear() + 12, viewDate.getMonth(), 1));
    }
  };

  const handleDateSelect = (day: number) => {
    const selectedDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
    const offset = selectedDate.getTimezoneOffset();
    selectedDate.setMinutes(selectedDate.getMinutes() - offset);
    const dateString = selectedDate.toISOString().split('T')[0];
    onChange(dateString);
    setIsOpen(false);
  };

  const handleYearSelect = (year: number) => {
    setViewDate(new Date(year, viewDate.getMonth(), 1));
    setSelectionMode('day');
  };

  const handleToday = () => {
    const today = new Date();
    const offset = today.getTimezoneOffset();
    today.setMinutes(today.getMinutes() - offset);
    const dateString = today.toISOString().split('T')[0];
    onChange(dateString);
    setViewDate(new Date());
    setIsOpen(false);
    setSelectionMode('day');
  };

  const handleClear = () => {
    onChange('');
    setIsOpen(false);
    setSelectionMode('day');
  };

  const renderDays = () => {
    const days = [];
    const totalDays = daysInMonth(viewDate.getFullYear(), viewDate.getMonth());
    const firstDay = firstDayOfMonth(viewDate.getFullYear(), viewDate.getMonth());

    for (let i = 0; i < firstDay; i++) {
        days.push(<div key={`empty-${i}`} className="h-8 w-8" />);
    }

    for (let d = 1; d <= totalDays; d++) {
      const isSelected = value === `${viewDate.getFullYear()}-${String(viewDate.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isToday = new Date().toDateString() === new Date(viewDate.getFullYear(), viewDate.getMonth(), d).toDateString();

      days.push(
        <button
          key={d}
          type="button"
          onClick={() => handleDateSelect(d)}
          className={`h-8 w-8 flex items-center justify-center rounded-md text-sm transition-all ${
            isSelected 
              ? 'bg-blue-600 text-white font-bold shadow-lg shadow-blue-500/20' 
              : isToday 
                ? 'border border-blue-500/50 text-blue-400' 
                : 'text-gray-300 hover:bg-white/10 hover:text-white'
          }`}
        >
          {d}
        </button>
      );
    }
    return days;
  };

  const renderYears = () => {
    const years = [];
    const currentYear = new Date().getFullYear();
    const startYear = 1920;
    const endYear = currentYear + 20;

    for (let y = startYear; y <= endYear; y++) {
      const isSelected = viewDate.getFullYear() === y;
      years.push(
        <button
          key={y}
          type="button"
          data-current-year={isSelected}
          onClick={() => handleYearSelect(y)}
          className={`py-2 flex items-center justify-center rounded-lg text-sm transition-all ${
            isSelected 
              ? 'bg-blue-600 text-white font-bold' 
              : 'text-gray-400 hover:bg-white/5 hover:text-white'
          }`}
        >
          {y}
        </button>
      );
    }
    return years;
  };

  const monthNames = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  return (
    <div className="relative inline-block w-full" ref={containerRef}>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-3 w-full bg-[#131722] border border-[#2a2e39] rounded-lg px-3 py-2 text-white text-sm cursor-pointer hover:border-[#363a45] transition-all group ${className}`}
      >
        <CalendarIcon size={16} className="text-blue-500 shrink-0 group-hover:scale-110 transition-transform" />
        <span className={`flex-1 truncate ${!value ? 'text-gray-500' : ''}`}>
          {value ? new Date(value).toLocaleDateString() : placeholder}
        </span>
        {value && (
          <X 
            size={14} 
            className="text-gray-500 hover:text-red-400 shrink-0 transition-colors" 
            onClick={(e) => {
              e.stopPropagation();
              handleClear();
            }}
          />
        )}
      </div>

      {isOpen && (
        <div className="absolute z-[200] mt-2 w-[280px] bg-[#1e222d] border border-[#2a2e39] rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.5)] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          <div className="p-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <button 
                type="button"
                onClick={() => setSelectionMode(selectionMode === 'day' ? 'year' : 'day')}
                className="flex items-center gap-1 hover:bg-white/5 px-2 py-1 rounded-md transition-colors group"
              >
                <span className="text-sm font-bold text-white tracking-tight group-hover:text-blue-400 transition-colors">
                  {monthNames[viewDate.getMonth()]} {viewDate.getFullYear()}
                </span>
                <ChevronLeft className={`size-3 text-gray-400 transition-transform ${selectionMode === 'year' ? 'rotate-90' : '-rotate-90'}`} />
              </button>
              <div className="flex items-center gap-2">
                <button 
                  onClick={handlePrevMonth}
                  className="p-1 hover:bg-white/5 rounded-md text-gray-400 hover:text-white transition-colors"
                >
                  <ChevronLeft size={18} />
                </button>
                <button 
                  onClick={handleNextMonth}
                  className="p-1 hover:bg-white/5 rounded-md text-gray-400 hover:text-white transition-colors"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>

            {selectionMode === 'day' ? (
              <>
                {/* Weekdays */}
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
                    <div key={day} className="h-8 w-8 flex items-center justify-center text-[11px] font-bold text-gray-500 uppercase">
                      {day}
                    </div>
                  ))}
                </div>

                {/* Days Grid */}
                <div className="grid grid-cols-7 gap-1">
                  {renderDays()}
                </div>
              </>
            ) : (
              <div 
                ref={yearGridRef}
                className="grid grid-cols-3 gap-2 overflow-y-auto max-h-[220px] scrollbar-thin scrollbar-thumb-white/10 pr-1"
              >
                {renderYears()}
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-[#2a2e39]">
              <button 
                onClick={handleClear}
                className="text-xs font-bold text-gray-500 hover:text-red-400 transition-colors"
              >
                Clear
              </button>
              <button 
                onClick={handleToday}
                className="text-xs font-bold text-blue-500 hover:text-blue-400 transition-colors"
              >
                Today
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
