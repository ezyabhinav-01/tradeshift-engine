import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface Option {
  value: string;
  label: string;
}

interface PremiumSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  className?: string;
  dropdownClassName?: string;
}

export function PremiumSelect({ value, onChange, options, className = '', dropdownClassName = '' }: PremiumSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(opt => opt.value === value) || options[0];

  return (
    <div className="relative inline-block w-full min-w-min" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center justify-between w-full appearance-none outline-none cursor-pointer transition-colors ${className}`}
      >
        <span className="truncate mr-2">{selectedOption?.label || ''}</span>
        <ChevronDown size={14} className={`shrink-0 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className={`absolute z-[100] mt-2 min-w-[180px] w-max max-w-[280px] bg-[#0A111A] dark:bg-[#0A111A] border border-white/10 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.5)] overflow-hidden animate-in fade-in zoom-in-95 duration-100 right-0 lg:right-auto lg:left-0 ${dropdownClassName}`}>
          <div className="py-2 flex flex-col max-h-[300px] overflow-y-auto px-1">
            {options.map((option) => {
              const isSelected = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  className={`flex items-center justify-between px-3 py-2 text-sm text-left transition-all rounded-lg w-full ${
                    isSelected 
                      ? 'bg-blue-500/10 text-blue-500 font-bold' 
                      : 'text-gray-300 hover:bg-white/5 hover:text-white font-medium'
                  }`}
                >
                  <span className="truncate">{option.label}</span>
                  {isSelected && <Check size={14} className="text-blue-500 ml-4 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
