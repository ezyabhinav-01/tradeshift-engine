import React, { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface LiveValueProps {
  value: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  formatter?: (val: number) => string;
}

const LiveValue: React.FC<LiveValueProps> = ({ 
  value, 
  prefix = '', 
  suffix = '', 
  className, 
  formatter = (val) => val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}) => {
  const [flashClass, setFlashClass] = useState('');
  const prevValueRef = useRef(value);

  useEffect(() => {
    if (value > prevValueRef.current) {
      setFlashClass('animate-flash-green');
    } else if (value < prevValueRef.current) {
      setFlashClass('animate-flash-red');
    }

    const timer = setTimeout(() => {
      setFlashClass('');
    }, 800);

    prevValueRef.current = value;
    return () => clearTimeout(timer);
  }, [value]);

  return (
    <span className={cn('inline-block px-1 rounded transition-all duration-300', flashClass, className)}>
      {prefix}{formatter(value)}{suffix}
    </span>
  );
};

export default React.memo(LiveValue);
