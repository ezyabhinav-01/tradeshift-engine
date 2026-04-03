import React, { useRef, useState, useEffect } from 'react';

interface OtpInputProps {
  length: number;
  onComplete: (otp: string) => void;
  disabled?: boolean;
  type?: 'text' | 'password';
}

const OtpInput: React.FC<OtpInputProps> = ({ length, onComplete, disabled, type = 'text' }) => {
  const [otp, setOtp] = useState<string[]>(new Array(length).fill(''));
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (inputs.current[0]) {
      inputs.current[0].focus();
    }
  }, []);

  const handleChange = (element: HTMLInputElement, index: number) => {
    const value = element.value;
    if (isNaN(Number(value))) return;

    const newOtp = [...otp];
    newOtp[index] = value.substring(value.length - 1);
    setOtp(newOtp);

    // Auto focus next
    if (value && index < length - 1) {
      inputs.current[index + 1]?.focus();
    }

    // Check if complete
    const combined = newOtp.join('');
    if (combined.length === length) {
      onComplete(combined);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Backspace') {
      if (!otp[index] && index > 0) {
        inputs.current[index - 1]?.focus();
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const data = e.clipboardData.getData('text').slice(0, length);
    if (!/^\d+$/.test(data)) return;

    const newOtp = [...otp];
    data.split('').forEach((char, index) => {
      newOtp[index] = char;
    });
    setOtp(newOtp);

    // Focus last filled or next empty
    const nextIndex = data.length < length ? data.length : length - 1;
    inputs.current[nextIndex]?.focus();

    if (data.length === length) {
      onComplete(data);
    }
  };

  return (
    <div className="flex justify-center gap-2 sm:gap-4" onPaste={handlePaste}>
      {otp.map((digit, index) => (
        <input
          key={index}
          type={type}
          ref={(el) => (inputs.current[index] = el)}
          value={digit}
          disabled={disabled}
          onChange={(e) => handleChange(e.target, index)}
          onKeyDown={(e) => handleKeyDown(e, index)}
          className={`w-10 h-12 sm:w-14 sm:h-16 text-center text-2xl sm:text-3xl font-bold rounded-xl border-2 transition-all outline-none 
            ${disabled ? 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 opacity-50' : 
            digit ? 'border-tv-primary bg-tv-primary/5 dark:bg-tv-primary/10 text-tv-primary shadow-[0_0_15px_-3px_rgba(41,98,255,0.2)]' : 
            'border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 text-slate-900 dark:text-white focus:border-tv-primary/50'}`}
          maxLength={1}
          autoComplete="one-time-code"
        />
      ))}
    </div>
  );
};

export default OtpInput;
