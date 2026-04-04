import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import gsap from 'gsap';
import { MarketJourneyInteractive } from '../components/MarketJourney/MarketJourneyInteractive';
import { useGSAP } from '@gsap/react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useAuth } from '../context/AuthContext';
import { useGame } from '../context/GameContext';
import { useMultiChartStore } from '../store/useMultiChartStore';
import { SymbolSearch } from '../components/features/SymbolSearch';
import { LogOut, ChevronLeft, ChevronRight, ChevronDown, UserCircle, BarChart3, BarChart2, Globe, Search, PieChart, BookOpen, Activity, MoreHorizontal, CheckCircle2, Newspaper, HelpCircle, LayoutDashboard } from 'lucide-react';
import './LandingPage.css';

gsap.registerPlugin(ScrollTrigger);

interface RevealProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  style?: React.CSSProperties;
  type?: 'reveal' | 'reveal-zoom' | 'reveal-left' | 'reveal-right';
  when?: boolean;
}

const Reveal: React.FC<RevealProps> = ({ children, className = "", delay = 0, style = {}, type = "reveal", when = true }) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!when) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('active');
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -50px 0px" }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [when]);

  return (
    <div
      ref={ref}
      className={`${type} ${className}`}
      style={{ ...style, transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
};

interface CountUpProps {
  end: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
}

const CountUp: React.FC<CountUpProps> = ({ end, duration = 2000, prefix = "", suffix = "" }) => {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !hasAnimated) {
        setHasAnimated(true);
        let startTimestamp: number | null = null;
        const step = (timestamp: number) => {
          if (!startTimestamp) startTimestamp = timestamp;
          const progress = Math.min((timestamp - startTimestamp) / duration, 1);
          const easeOut = 1 - Math.pow(1 - progress, 4);
          setCount(Math.floor(easeOut * end));
          if (progress < 1) {
            window.requestAnimationFrame(step);
          }
        };
        window.requestAnimationFrame(step);
      }
    }, { threshold: 0.1 });

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [end, duration, hasAnimated]);

  let formattedCount = count.toString();
  if (end >= 1000) {
    if (end % 1000 === 0) formattedCount = (count / 1000).toFixed(0) + "k";
    else formattedCount = count.toLocaleString();
  }

  return <span ref={ref}>{prefix}{formattedCount}{suffix}</span>;
};

interface ScrambleTextProps {
  text: string;
  duration?: number;
  delay?: number;
}

const ScrambleText: React.FC<ScrambleTextProps> = ({ text, duration = 3000, delay = 0 }) => {
  const [displayText, setDisplayText] = useState('');
  const chars = "hanibvanrdabimaatnndrajatya!@#$%^&*()";

  useEffect(() => {
    let timeoutId: any;
    let intervalId: any;

    timeoutId = setTimeout(() => {
      let iteration = 0;
      // Scramble-Type logic: Reveal characters one by one with a scramble 'tail'
      intervalId = setInterval(() => {
        setDisplayText(
          text
            .split("")
            .map((_char, index) => {
              // Resolved characters
              if (index < Math.floor(iteration)) {
                return text[index];
              }
              // The "Active" character being typed (scrambling)
              if (index === Math.floor(iteration)) {
                return chars[Math.floor(Math.random() * chars.length)];
              }
              // Not yet typed
              return "";
            })
            .join("")
        );

        if (iteration >= text.length) {
          clearInterval(intervalId);
        }

        iteration += 0.35; // Controls the "speed" of typing vs total duration
      }, duration / (text.length * 5)); // Higher frequency for a smoother scramble
    }, delay);

    return () => {
      clearTimeout(timeoutId);
      clearInterval(intervalId);
    };
  }, [text, duration, delay]);

  return (
    <span>
      {displayText}
      <span className="typewriter-cursor">|</span>
    </span>
  );
};

interface RotatingTypewriterProps {
  words: string[];
  typingSpeed?: number;
  deletingSpeed?: number;
  pauseDuration?: number;
}

const RotatingTypewriter: React.FC<RotatingTypewriterProps> = ({
  words,
  typingSpeed = 60,
  deletingSpeed = 20,
  pauseDuration = 1000
}) => {
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [displayedText, setDisplayedText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const word = words[currentWordIndex];
    let timer: any;

    if (!isDeleting && displayedText === word) {
      // Pause before deleting
      timer = setTimeout(() => setIsDeleting(true), pauseDuration);
    } else if (isDeleting && displayedText === "") {
      // Switch word and restart typing
      setIsDeleting(false);
      setCurrentWordIndex((prev) => (prev + 1) % words.length);
    } else {
      // Type or delete characters
      const speed = isDeleting ? deletingSpeed : typingSpeed;
      timer = setTimeout(() => {
        setDisplayedText(prev =>
          isDeleting ? word.substring(0, prev.length - 1) : word.substring(0, prev.length + 1)
        );
      }, speed);
    }

    return () => clearTimeout(timer);
  }, [displayedText, isDeleting, currentWordIndex, words, typingSpeed, deletingSpeed, pauseDuration]);

  return (
    <span className="accent" style={{
      background: 'linear-gradient(90deg, var(--accent-primary), var(--accent-secondary))',
      WebkitBackgroundClip: 'text',
      backgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      display: 'inline-block'
    }}>
      {displayedText}
      <span className="multicolor-cursor visible" />
    </span>
  );
};

const Ticker: React.FC = () => {
  const [mockPairs, setMockPairs] = useState([
    { pair: 'BTC/USD', price: 64320.50, change: 2.4 },
    { pair: 'ETH/USD', price: 3450.15, change: 1.8 },
    { pair: 'SOL/USD', price: 145.20, change: -0.5 },
    { pair: 'NVDA', price: 890.55, change: 4.2 },
    { pair: 'AAPL', price: 172.10, change: 0.3 },
    { pair: 'BNB/USD', price: 412.30, change: 1.1 },
    { pair: 'ADA/USD', price: 0.65, change: -1.2 },
    { pair: 'XRP/USD', price: 0.55, change: 0.8 },
  ]);

  useEffect(() => {
    const interval = setInterval(() => {
      setMockPairs(prevPairs => prevPairs.map(data => {
        if (Math.random() > 0.8) {
          const fluctuation = data.price * (Math.random() * 0.002 - 0.001);
          return { ...data, price: data.price + fluctuation };
        }
        return data;
      }));
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  const displayPairs = [...mockPairs, ...mockPairs, ...mockPairs];

  return (
    <Reveal type="reveal" delay={200} className="ticker-wrapper">
      <div className="ticker-track">
        {displayPairs.map((data, idx) => {
          const isPositive = data.change >= 0;
          const changeClass = isPositive ? 'success' : 'danger';
          const changeSymbol = isPositive ? '+' : '';
          return (
            <div key={idx} className="ticker-item">
              <span className="pair">{data.pair}</span>
              <span className="price">${data.price.toFixed(2)}</span>
              <span className={changeClass}>{changeSymbol}{data.change}%</span>
            </div>
          );
        })}
      </div>
    </Reveal>
  );
};

interface FeatureCardProps {
  icon: string;
  title: string;
  text: string;
  delay?: number;
}

const FeatureCard: React.FC<FeatureCardProps> = ({ icon, title, text, delay = 0 }) => {
  return (
    <Reveal type="reveal-zoom" delay={delay} className="feature-card">
      <div className="feature-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{text}</p>
    </Reveal>
  );
};

const BasicChart: React.FC = () => (
  <div style={{ padding: '2.5rem', width: '100%', height: '100%', boxSizing: 'border-box', background: 'var(--bg-glass)' }}>
    <div className="chart-header">
      <span className="pair">BTC / USD</span>
      <span className="price success">$64,320.50 <span className="change">+2.4%</span></span>
    </div>
    <div style={{ height: '180px', display: 'flex', alignItems: 'flex-end', gap: '8px', marginTop: '1rem' }}>
      <div style={{ width: '15%', background: 'var(--success)', height: '40%', borderRadius: '4px' }}></div>
      <div style={{ width: '15%', background: 'var(--danger)', height: '30%', borderRadius: '4px' }}></div>
      <div style={{ width: '15%', background: 'var(--success)', height: '60%', borderRadius: '4px' }}></div>
      <div style={{ width: '15%', background: 'var(--success)', height: '85%', borderRadius: '4px' }}></div>
      <div style={{ width: '15%', background: 'var(--danger)', height: '70%', borderRadius: '4px' }}></div>
      <div style={{ width: '15%', background: 'var(--success)', height: '100%', borderRadius: '4px', boxShadow: '0 0 15px var(--success)' }}></div>
    </div>
  </div>
);

const AdvancedChart: React.FC = () => (
  <div style={{ padding: '2.5rem', width: '100%', height: '100%', boxSizing: 'border-box', background: 'var(--bg-glass-hover)' }}>
    <div className="chart-header">
      <span className="pair" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        BTC / USD
        <span style={{ fontSize: '0.7rem', border: '1px solid var(--accent-primary)', padding: '2px 6px', borderRadius: '12px', color: 'var(--accent-primary)' }}>PRO</span>
      </span>
      <span className="price success">$64,320.50 <span className="change">+2.4%</span></span>
    </div>
    <div style={{ height: '180px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: '1rem', position: 'relative' }}>
      {/* Grid lines */}
      <div style={{ position: 'absolute', width: '100%', height: '1px', background: 'var(--border-glass)', top: '20%' }} />
      <div style={{ position: 'absolute', width: '100%', height: '1px', background: 'var(--border-glass)', top: '50%' }} />
      <div style={{ position: 'absolute', width: '100%', height: '1px', background: 'var(--border-glass)', top: '80%' }} />

      {/* Candlesticks */}
      {[
        { h: '50%', win: 'var(--success)', top: '-10%', body: '60%', bodyTop: '10%' },
        { h: '40%', win: 'var(--danger)', top: '-5%', body: '70%', bodyTop: '5%' },
        { h: '70%', win: 'var(--success)', top: '-20%', body: '50%', bodyTop: '0%' },
        { h: '95%', win: 'var(--success)', top: '-5%', body: '40%', bodyTop: '10%' },
        { h: '80%', win: 'var(--danger)', top: '-20%', body: '50%', bodyTop: '10%' },
        { h: '100%', win: 'var(--success)', top: '-25%', body: '60%', bodyTop: '-15%', shadow: true }
      ].map((c, i) => (
        <div key={i} style={{ position: 'relative', width: '12%', height: c.h, display: 'flex', justifyContent: 'center' }}>
          <div style={{ position: 'absolute', width: '2px', height: '110%', background: c.win, top: c.top }} />
          <div style={{ position: 'absolute', width: '100%', height: c.body, background: c.win, top: c.bodyTop, borderRadius: '2px', boxShadow: c.shadow ? `0 0 10px ${c.win}` : 'none' }} />
        </div>
      ))}
    </div>
  </div>
);

const DraggableHeroGraphic: React.FC<{ when?: boolean }> = ({ when = true }) => {
  const [isDraggable, setIsDraggable] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);

  const [sliderPos, setSliderPos] = useState(50);
  const [isSliding, setIsSliding] = useState(false);
  const chartContainerRef = useRef<HTMLDivElement>(null);

  const dragInfo = useRef({ startX: 0, startY: 0, initialX: 0, initialY: 0 });
  const activePointers = useRef(new Map<number, { x: number, y: number }>());
  const initialPinchDistance = useRef<number | null>(null);
  const initialScale = useRef(1);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const preventBrowserGestures = (e: Event) => {
      if (isDraggable) {
        e.preventDefault();
      }
    };

    el.addEventListener('wheel', preventBrowserGestures, { passive: false });
    el.addEventListener('touchmove', preventBrowserGestures, { passive: false });

    return () => {
      el.removeEventListener('wheel', preventBrowserGestures);
      el.removeEventListener('touchmove', preventBrowserGestures);
    };
  }, [isDraggable]);

  const handleDoubleClick = () => setIsDraggable(!isDraggable);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!isDraggable) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (activePointers.current.size === 1) {
      setIsDragging(true);
      dragInfo.current = {
        startX: e.clientX,
        startY: e.clientY,
        initialX: position.x,
        initialY: position.y
      };
    } else if (activePointers.current.size === 2) {
      setIsDragging(false);
      const pointers = Array.from(activePointers.current.values());
      const dist = Math.hypot(pointers[0].x - pointers[1].x, pointers[0].y - pointers[1].y);
      initialPinchDistance.current = dist;
      initialScale.current = scale;
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggable) return;

    if (activePointers.current.has(e.pointerId)) {
      activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    if (activePointers.current.size === 1 && isDragging) {
      const dx = e.clientX - dragInfo.current.startX;
      const dy = e.clientY - dragInfo.current.startY;
      setPosition({
        x: dragInfo.current.initialX + dx,
        y: dragInfo.current.initialY + dy
      });
    } else if (activePointers.current.size === 2) {
      const pointers = Array.from(activePointers.current.values());
      const dist = Math.hypot(pointers[0].x - pointers[1].x, pointers[0].y - pointers[1].y);

      if (initialPinchDistance.current) {
        const delta = dist / initialPinchDistance.current;
        const newScale = Math.min(Math.max(0.5, initialScale.current * delta), 3);
        setScale(newScale);
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    activePointers.current.delete(e.pointerId);
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);

    if (activePointers.current.size < 2) {
      initialPinchDistance.current = null;
    }

    if (activePointers.current.size === 0) {
      setIsDragging(false);
    } else if (activePointers.current.size === 1) {
      const remainingPointer = Array.from(activePointers.current.values())[0];
      setIsDragging(true);
      dragInfo.current = {
        startX: remainingPointer.x,
        startY: remainingPointer.y,
        initialX: position.x,
        initialY: position.y
      };
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (!isDraggable) return;
    const zoomSpeed = 0.005;
    setScale(prev => Math.min(Math.max(0.5, prev - (e.deltaY * zoomSpeed)), 3));
  };

  const handleSliderPointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    setIsSliding(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleSliderPointerMove = (e: React.PointerEvent) => {
    if (!isSliding || !chartContainerRef.current) return;
    const rect = chartContainerRef.current.getBoundingClientRect();
    let newX = e.clientX - rect.left;
    let newPos = (newX / rect.width) * 100;
    setSliderPos(Math.max(0, Math.min(100, newPos)));
  };

  const handleSliderPointerUp = (e: React.PointerEvent) => {
    if (!isSliding) return;
    setIsSliding(false);
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  };

  return (
    <Reveal type="reveal-left" delay={300} when={when} className="hero-graphic" style={{ zIndex: isDraggable ? 50 : 1 }}>
      <div
        ref={containerRef}
        className="graphics-container"
        onDoubleClick={handleDoubleClick}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onWheel={handleWheel}
        style={{
          transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
          cursor: isDraggable ? (isDragging ? 'grabbing' : 'grab') : 'default',
          touchAction: isDraggable ? 'none' : 'auto',
          transition: isDragging ? 'none' : 'transform 0.1s ease-out',
          boxShadow: isDraggable ? '0 0 0 2px var(--accent-secondary)' : 'none',
          borderRadius: '16px',
          userSelect: 'none'
        }}
      >
        {isDraggable && (
          <div style={{ position: 'absolute', top: '-40px', left: '50%', transform: 'translateX(-50%)', background: 'var(--accent-secondary)', color: '#000', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold', whiteSpace: 'nowrap', boxShadow: '0 4px 15px rgba(0, 187, 255, 0.4)', zIndex: 10 }}>
            🔓 Unlocked! (Drag or Pinch/Scroll to zoom)
          </div>
        )}

        <div
          ref={chartContainerRef}
          className={`glass-panel main-chart ${!isDraggable ? 'float-1' : ''}`}
          style={{ position: 'relative', padding: 0, overflow: 'hidden', touchAction: 'none', width: '100%', height: '320px', willChange: 'transform' }}
        >
          <div style={{ width: '100%', height: '100%' }}>
            <BasicChart />
          </div>

          <div style={{
            position: 'absolute',
            top: 0, left: 0, width: '100%', height: '100%',
            clipPath: `polygon(0 0, ${sliderPos}% 0, ${sliderPos}% 100%, 0 100%)`,
            pointerEvents: 'none'
          }}>
            <AdvancedChart />
          </div>

          <div style={{
            position: 'absolute', top: 0, bottom: 0,
            left: `${sliderPos}%`, width: '4px',
            background: 'var(--accent-secondary)',
            transform: 'translateX(-50%)',
            boxShadow: '0 0 10px rgba(0,0,0,0.5)',
            zIndex: 10
          }}></div>

          <div
            onPointerDown={handleSliderPointerDown}
            onPointerMove={handleSliderPointerMove}
            onPointerUp={handleSliderPointerUp}
            onPointerCancel={handleSliderPointerUp}
            style={{
              position: 'absolute', top: 0, bottom: 0,
              left: `${sliderPos}%`, width: '40px',
              transform: 'translateX(-50%)',
              cursor: 'ew-resize',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 11, touchAction: 'none'
            }}
          >
            <div style={{
              width: '28px', height: '28px',
              background: 'var(--accent-secondary)',
              borderRadius: '50%',
              boxShadow: '0 0 10px rgba(0,0,0,0.8)',
              display: 'flex', gap: '3px',
              justifyContent: 'center', alignItems: 'center'
            }}>
              <div style={{ width: '2px', height: '12px', background: '#fff', opacity: 0.8 }} />
              <div style={{ width: '2px', height: '12px', background: '#fff', opacity: 0.8 }} />
            </div>
          </div>
        </div>

        <div className={`glass-panel ${!isDraggable ? 'float-2' : ''}`} style={{ position: 'absolute', top: '-10%', right: '-5%', padding: '1rem', borderRadius: '50%', background: 'var(--bg-glass-hover)', pointerEvents: 'none', willChange: 'transform' }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--accent-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"></path><path d="M12 18V6"></path></svg>
        </div>

        <div className={`glass-panel ${!isDraggable ? 'float-3' : ''}`} style={{ position: 'absolute', bottom: '10%', left: '-10%', padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-glass-hover)', pointerEvents: 'none', willChange: 'transform' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"></polyline><polyline points="16 7 22 7 22 13"></polyline></svg>
          <span className="success" style={{ fontWeight: 'bold' }}>+12.4%</span>
        </div>
      </div>
    </Reveal>
  );
};

const showcaseData = [
  {
    id: 'trade',
    tab: 'Trade',
    title: 'Trade Instantly with Confidence',
    text: 'Execute trades in real-time with advanced charts and lightning-fast order execution.',
    highlights: ['Live charts', 'Instant buy/sell', 'Smart order types'],
    icon: <BarChart2 size={24} />
  },
  {
    id: 'markets',
    tab: 'Markets',
    title: 'Stay Ahead of the Market',
    text: 'Track stocks, indices, and trends with real-time data and insights.',
    highlights: ['Top gainers/losers', 'Market trends', 'Watchlists'],
    icon: <Globe size={24} />
  },
  {
    id: 'screener',
    tab: 'Screener',
    title: 'Discover Winning Stocks',
    text: 'Filter and analyze stocks using powerful screening tools.',
    highlights: ['Custom filters', 'Technical + fundamental data', 'Pre-built strategies'],
    icon: <Search size={24} />
  },
  {
    id: 'portfolio',
    tab: 'Portfolio',
    title: 'Track Your Wealth',
    text: 'Monitor your investments and performance in one place.',
    highlights: ['Real-time P&L', 'Asset allocation', 'Performance insights'],
    icon: <PieChart size={24} />
  },
  {
    id: 'learn',
    tab: 'Learn',
    title: 'Learn Before You Earn',
    text: 'Step-by-step trading courses designed for beginners to pros.',
    highlights: ['Video lessons', 'Live sessions', 'Practice mode'],
    icon: <BookOpen size={24} />
  },
  {
    id: 'indicators',
    tab: 'Indicators',
    title: 'Trade with Data, Not Guesswork',
    text: 'Use powerful technical indicators to make smarter decisions.',
    highlights: ['RSI, MACD, Bollinger Bands', 'Custom overlays', 'Strategy building'],
    icon: <Activity size={24} />
  },
  {
    id: 'more',
    tab: 'More',
    title: 'Everything in One Platform',
    text: 'Explore additional tools and features to enhance your trading experience.',
    highlights: ['Alerts & notifications', 'News & insights', 'Account management'],
    icon: <MoreHorizontal size={24} />
  }
];

const PhoneScreenContent: React.FC<{ activeId: string }> = ({ activeId }) => {
  return (
    <div className={`screen-content screen-${activeId}`}>
      {activeId === 'trade' && (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '0.5rem', padding: '0.75rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>BTC/USD <span className="success">+2.4%</span></div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: '0.25rem', marginBottom: '0.5rem' }}>
            <div style={{ width: '16%', background: 'var(--danger)', height: '25%', borderRadius: '2px' }} />
            <div style={{ width: '16%', background: 'var(--success)', height: '50%', borderRadius: '2px' }} />
            <div style={{ width: '16%', background: 'var(--danger)', height: '33%', borderRadius: '2px' }} />
            <div style={{ width: '16%', background: 'var(--success)', height: '66%', borderRadius: '2px' }} />
            <div style={{ width: '16%', background: 'var(--success)', height: '100%', borderRadius: '2px', boxShadow: '0 0 8px var(--success)' }} />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto' }}>
            <div style={{ flex: 1, background: 'var(--danger)', color: '#000', textAlign: 'center', fontSize: '10px', fontWeight: 'bold', padding: '0.5rem 0', borderRadius: '4px' }}>SELL</div>
            <div style={{ flex: 1, background: 'var(--success)', color: '#000', textAlign: 'center', fontSize: '10px', fontWeight: 'bold', padding: '0.5rem 0', borderRadius: '4px' }}>BUY</div>
          </div>
        </div>
      )}
      {activeId === 'markets' && (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '0.5rem', padding: '0.75rem' }}>
          <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#9ca3af', marginBottom: '0.25rem' }}>Top Movers</div>
          {[
            { s: 'NVDA', p: '890.55', c: '+4.2%', g: true },
            { s: 'AAPL', p: '172.10', c: '+0.3%', g: true },
            { s: 'TSLA', p: '175.22', c: '-2.1%', g: false },
            { s: 'MSFT', p: '410.00', c: '+1.1%', g: true },
          ].map((v, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px', background: 'rgba(255,255,255,0.05)', padding: '0.5rem', borderRadius: '4px' }}>
              <span style={{ fontWeight: 'bold' }}>{v.s}</span>
              <span className={v.g ? "success" : "danger"}>{v.c}</span>
            </div>
          ))}
        </div>
      )}
      {activeId === 'screener' && (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '0.5rem', padding: '0.75rem' }}>
          <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: '9999px', height: '1.5rem', width: '100%', display: 'flex', alignItems: 'center', padding: '0 0.5rem', opacity: 0.5, marginBottom: '0.5rem' }}>
            <Search size={10} style={{ marginRight: '0.25rem' }} />
            <div style={{ height: '0.375rem', width: '50%', background: 'rgba(255,255,255,0.2)', borderRadius: '9999px' }} />
          </div>
          <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '0.5rem' }}>
            <div style={{ height: '1rem', width: '2.5rem', background: 'rgba(0,187,255,0.2)', borderRadius: '4px', border: '1px solid rgba(0,187,255,0.5)', fontSize: '8px', color: 'var(--accent-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>PE &lt; 20</div>
            <div style={{ height: '1rem', width: '3rem', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', fontSize: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Vol &gt; 1M</div>
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <div style={{ height: '2rem', width: '100%', background: 'rgba(255,255,255,0.05)', borderRadius: '4px' }} />
            <div style={{ height: '2rem', width: '100%', background: 'rgba(255,255,255,0.05)', borderRadius: '4px' }} />
            <div style={{ height: '2rem', width: '100%', background: 'rgba(255,255,255,0.05)', borderRadius: '4px' }} />
          </div>
        </div>
      )}
      {activeId === 'portfolio' && (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', alignItems: 'center', padding: '0.75rem' }}>
          <div style={{ fontSize: '10px', color: '#9ca3af', marginTop: '0.5rem' }}>Total Balance</div>
          <div style={{ fontSize: '18px', fontWeight: 'bold' }}>$124,560</div>
          <div style={{ fontSize: '10px', marginBottom: '1rem' }} className="success">+ $4,560 (3.8%)</div>
          <div style={{ position: 'relative', width: '6rem', height: '6rem', marginBottom: '1rem' }}>
            <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '4px solid var(--accent-primary)', borderTopColor: 'var(--success)', borderRightColor: 'var(--danger)', opacity: 0.8, transform: 'rotate(45deg)' }} />
            <div style={{ position: 'absolute', inset: '0.5rem', background: 'radial-gradient(circle, var(--bg-glass) 0%, transparent 100%)', borderRadius: '50%', boxShadow: 'inset 0 0 10px rgba(0,0,0,0.5)' }} />
          </div>
          <div style={{ width: '100%', height: '2rem', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', marginTop: 'auto', display: 'flex', alignItems: 'center', padding: '0 0.5rem', fontSize: '8px', justifyContent: 'space-between' }}>
            <span>AAPL 40%</span>
            <div style={{ width: '50%', height: '0.25rem', background: 'var(--accent-primary)', borderRadius: '9999px' }} />
          </div>
        </div>
      )}
      {activeId === 'learn' && (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '0.5rem', padding: '0.75rem' }}>
          <div style={{ width: '100%', height: '5rem', background: 'linear-gradient(45deg, rgba(0,85,255,0.4), transparent)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', marginBottom: '0.5rem' }}>
            <div style={{ width: '2rem', height: '2rem', borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
              <div style={{ width: 0, height: 0, borderTop: '4px solid transparent', borderLeft: '6px solid white', borderBottom: '4px solid transparent', marginLeft: '2px' }} />
            </div>
          </div>
          <div style={{ fontSize: '12px', fontWeight: 'bold' }}>Trading Basics</div>
          <div style={{ height: '0.25rem', width: '100%', background: 'rgba(255,255,255,0.1)', borderRadius: '9999px', marginTop: '0.25rem' }}>
            <div style={{ height: '100%', width: '66%', background: 'var(--accent-secondary)', borderRadius: '9999px' }} />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
            <div style={{ flex: 1, height: '3rem', background: 'rgba(255,255,255,0.05)', borderRadius: '4px' }} />
            <div style={{ flex: 1, height: '3rem', background: 'rgba(255,255,255,0.05)', borderRadius: '4px' }} />
          </div>
        </div>
      )}
      {activeId === 'indicators' && (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '0.5rem', padding: '0.75rem', position: 'relative' }}>
          <div style={{ fontSize: '10px', display: 'flex', gap: '0.5rem' }}>
            <span style={{ color: 'var(--accent-secondary)', fontWeight: 'bold' }}>RSI</span>
            <span style={{ color: '#6b7280' }}>MACD</span>
            <span style={{ color: '#6b7280' }}>EMA</span>
          </div>
          <div style={{ flex: 1, position: 'relative', marginTop: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center' }}>
            <svg viewBox="0 0 100 50" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}>
              <path d="M0,25 Q10,10 20,25 T40,25 T60,20 T80,30 T100,10" fill="none" stroke="var(--accent-secondary)" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M0,35 Q15,15 25,30 T45,35 T65,15 T85,25 T100,20" fill="none" stroke="var(--success)" strokeWidth="1" strokeDasharray="2,2" />
            </svg>
          </div>
          <div style={{ height: '2rem', width: '100%', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', marginTop: 'auto', display: 'flex', alignItems: 'center', padding: '0 0.5rem' }}>
            <div style={{ height: '1rem', width: '1rem', background: 'rgba(0,187,255,0.2)', color: 'var(--accent-secondary)', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', marginRight: '0.5rem' }}>⚙</div>
            <div style={{ fontSize: '8px', color: '#9ca3af' }}>Settings</div>
          </div>
        </div>
      )}
      {activeId === 'more' && (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '0.5rem', padding: '0.75rem' }}>
          <div style={{ paddingBottom: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: '0.5rem', fontWeight: 'bold', fontSize: '12px' }}>More Tools</div>
          {[
            { i: '🔔', t: 'Smart Alerts' },
            { i: '📰', t: 'Live News Feed' },
            { i: '🛡️', t: 'Risk Management' },
            { i: '⚙️', t: 'Account Settings' }
          ].map((v, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '10px', background: 'rgba(255,255,255,0.05)', padding: '0.5rem', borderRadius: '4px' }}>
              <span>{v.i}</span>
              <span style={{ color: '#e5e7eb' }}>{v.t}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const MobileShowcaseSection = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);
  const [mobileScale, setMobileScale] = useState(1);
  const [dragX, setDragX] = useState(0);
  const [isDraggingCard, setIsDraggingCard] = useState(false);
  const [isHalfScreen, setIsHalfScreen] = useState(window.innerWidth < 1300);
  const [flippedIndices, setFlippedIndices] = useState<Record<number, boolean>>({});
  const pointerStartX = useRef<number | null>(null);
  const pointerStartY = useRef<number | null>(null);
  const storyTriggerRef = useRef<any>(null);
  const sectionRef = useRef<HTMLDivElement>(null);
  const leftColRef = useRef<HTMLDivElement>(null);
  const phonePosRef = useRef<HTMLDivElement>(null);

  const toggleFlip = (index: number) => {
    setFlippedIndices(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  useGSAP(() => {
    // 1. Reveal Section
    gsap.fromTo(sectionRef.current,
      { opacity: 0, y: 80 },
      {
        opacity: 1, y: 0, duration: 1, ease: 'power3.out',
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top 75%'
        }
      }
    );

    // 2. Pin the section and map progress to activeTab
    storyTriggerRef.current = ScrollTrigger.create({
      trigger: sectionRef.current,
      pin: true,
      start: 'top top',
      end: '+=4000', // Scroll length to finish the storyboard
      scrub: 0.1,
      onUpdate: (self) => {
        // Find the index of the tab based on scroll progress (0 to 1)
        const index = Math.min(showcaseData.length - 1, Math.floor(self.progress * showcaseData.length));
        setActiveTab((prev) => (prev !== index ? index : prev));
      }
    });

  }, { scope: sectionRef });

  // Update Half-Screen state on resize
  useEffect(() => {
    const handleResize = () => setIsHalfScreen(window.innerWidth < 1300);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Custom wheel listener for dynamic zooming with scroll locking
  useEffect(() => {
    const el = phonePosRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      if (!isZoomed) return;

      // Stop the page from scrolling while we are "locked" into the phone zoom
      e.preventDefault();

      const zoomSpeed = 0.003;
      setMobileScale(prev => {
        const newScale = prev - (e.deltaY * zoomSpeed);
        // Clamp scale between 1x and 4x
        return Math.min(Math.max(1, newScale), 4);
      });
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [isZoomed]);

  const toggleZoom = () => {
    if (!isZoomed) {
      setIsZoomed(true);
      setMobileScale(1.4); // Initial pop zoom
    } else {
      setIsZoomed(false);
      setMobileScale(1);
    }
  };

  const navigateStoryboard = (direction: 'next' | 'prev') => {
    if (!storyTriggerRef.current || !isHalfScreen) return;

    const trigger = storyTriggerRef.current;
    const totalDistance = trigger.end - trigger.start;
    const distPerTab = totalDistance / showcaseData.length;

    let targetIndex = activeTab;
    if (direction === 'prev' && activeTab > 0) targetIndex = activeTab - 1;
    else if (direction === 'next' && activeTab < showcaseData.length - 1) targetIndex = activeTab + 1;

    if (targetIndex === activeTab) return;

    // Instant Visual Feedback for the Stacked Animation
    setActiveTab(targetIndex);

    const targetScroll = trigger.start + (targetIndex * distPerTab) + (distPerTab / 2);

    gsap.to(window, {
      scrollTo: targetScroll,
      duration: 0.8,
      ease: 'power3.inOut'
    });
  };

  // Swipe and Grab handling logic to sync with ScrollTrigger
  const handlePointerDown = (e: React.PointerEvent) => {
    // Only enable horizontal grab-and-swipe in "half-screen" mode (width > 1024)
    if (window.innerWidth < 1024) {
      pointerStartY.current = e.clientY;
    } else {
      pointerStartX.current = e.clientX;
      pointerStartY.current = e.clientY;
      setIsDraggingCard(true);
    }
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (pointerStartY.current === null) return;

    if (window.innerWidth < 1024 || pointerStartX.current === null) {
      // Classic vertical swipe scroll for mobile
      const deltaY = pointerStartY.current - e.clientY;
      window.scrollBy(0, deltaY * 1.5);
      pointerStartY.current = e.clientY;
    } else {
      // Horizontal Grab-and-Swipe for "half-screen" mode
      const deltaX = e.clientX - pointerStartX.current;
      setDragX(deltaX);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDraggingCard && pointerStartX.current !== null) {
      const deltaX = e.clientX - pointerStartX.current;
      const threshold = 120; // Snap threshold

      if (Math.abs(deltaX) > threshold && storyTriggerRef.current && isHalfScreen) {
        // Precision Snap: Calculate exact target scroll using ScrollTrigger offsets
        const trigger = storyTriggerRef.current;
        const totalDistance = trigger.end - trigger.start;
        const distPerTab = totalDistance / showcaseData.length;

        let targetIndex = activeTab;
        if (deltaX > 0 && activeTab > 0) targetIndex = activeTab - 1; // Previous
        else if (deltaX < 0 && activeTab < showcaseData.length - 1) targetIndex = activeTab + 1; // Next

        // Center on the new tab segment (absolute position)
        const targetScroll = trigger.start + (targetIndex * distPerTab) + (distPerTab / 2);

        gsap.to(window, {
          scrollTo: targetScroll,
          duration: 0.8,
          ease: 'power3.out'
        });
      }
    }

    pointerStartX.current = null;
    pointerStartY.current = null;
    setDragX(0);
    setIsDraggingCard(false);
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
  };

  return (
    <section ref={sectionRef} className="mobile-showcase-section" id="learn">
      <div className="showcase-header text-center" style={{ marginBottom: '3rem' }}>
        <h2 className="section-title">Everything You Need to <RotatingTypewriter words={["TRADE", "EARN", "LEARN"]} /></h2>
      </div>

      <div className="showcase-grid" style={{ alignItems: 'center' }}>
        {/* Left Side: Mobile Phone Mockup */}
        <div className="showcase-left" ref={leftColRef} style={{ height: '75vh', minHeight: '550px', maxHeight: '750px' }}>
          <div
            className="phone-positioner"
            ref={phonePosRef}
            onDoubleClick={toggleZoom}
            style={{
              display: 'flex',
              width: '100%',
              justifyContent: 'center',
              height: '100%',
              alignItems: 'center'
            }}
          >
            {/* Zoom Hint Badge */}
            <div style={{
              position: 'absolute',
              top: '20px',
              left: '50%',
              transform: 'translateX(-50%)',
              background: isZoomed ? 'var(--accent-secondary)' : 'var(--accent-primary)',
              color: '#000',
              padding: '4px 12px',
              borderRadius: '20px',
              fontSize: '11px',
              fontWeight: 'bold',
              whiteSpace: 'nowrap',
              boxShadow: '0 4px 15px rgba(0, 85, 255, 0.4)',
              zIndex: 30,
              opacity: 0.8,
              pointerEvents: 'none',
              transition: 'all 0.3s ease'
            }}>
              {isZoomed ? 'Scroll to Zoom | Double Click to Reset' : 'Double Click to Zoom In'}
            </div>

            <div className={`phone-wrapper ${isZoomed ? 'zoomed' : ''}`}>
              <div
                className="phone-scaler"
                style={{
                  transform: `scale(${mobileScale})`,
                  cursor: isZoomed ? 'zoom-out' : 'zoom-in',
                  userSelect: 'none'
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  toggleZoom();
                }}
              >
                <div className="phone-frame">
                  <div className="phone-notch" />
                  <div className="phone-screen-container">
                    {showcaseData.map((item, i) => {
                      let layerClass = 'phone-screen-layer ';
                      if (activeTab === i) layerClass += 'active';
                      else if (i < activeTab) layerClass += 'past';

                      return (
                        <div
                          key={item.id}
                          className={layerClass}
                        >
                          <PhoneScreenContent activeId={item.id} />
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="phone-glow-backdrop" />
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Scrolling Story Track */}
        <div
          className="showcase-right"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          style={{
            position: 'relative',
            height: '75vh',
            minHeight: '550px',
            maxHeight: '750px',
            overflow: 'hidden',
            cursor: 'ns-resize',
            touchAction: 'none',
            WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 15%, black 85%, transparent)'
          }}
        >
          {/* Floating Navigation Arrows - Only in Half Screen Mode */}
          {isHalfScreen && (
            <div className="story-nav-overlay">
              <button
                className={`story-nav-btn prev ${activeTab === 0 ? 'disabled' : ''}`}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  navigateStoryboard('prev');
                }}
                aria-label="Previous Feature"
                title="Previous"
              >
                <ChevronLeft size={24} />
              </button>
              <button
                className={`story-nav-btn next ${activeTab === showcaseData.length - 1 ? 'disabled' : ''}`}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  navigateStoryboard('next');
                }}
                aria-label="Next Feature"
                title="Next"
              >
                <ChevronRight size={24} />
              </button>
            </div>
          )}

          <div
            className="story-scroll-track"
            style={{
              position: isHalfScreen ? 'relative' : 'static',
              width: '100%',
              height: isHalfScreen ? '100%' : `${showcaseData.length * 100}%`,
              transform: isHalfScreen ? 'none' : `translateY(calc(-${activeTab} * (100% / ${showcaseData.length})))`,
              transition: 'transform 0.8s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          >
            {showcaseData.map((item, i) => {
              const diff = i - activeTab;

              // Mode 1: Half-Screen / Stacking Logic (Narrow Viewports)
              let stackOpacity = 0;
              let stackScale = 0.85;
              let stackTranslateY = 40;
              let stackZIndex = 1;
              let stackPointerEvents: 'auto' | 'none' = 'none';

              if (diff === 0) {
                stackOpacity = 1;
                stackScale = 1;
                stackTranslateY = 0;
                stackZIndex = 10;
                stackPointerEvents = 'auto';
              } else if (diff < 0) {
                stackOpacity = 0;
                stackScale = 1.1;
                stackTranslateY = -100;
                stackZIndex = 20;
              } else {
                stackOpacity = 0.3;
                stackScale = 0.9 - (diff * 0.05);
                stackTranslateY = 20 + (diff * 15);
                stackZIndex = 10 - diff;
              }

              // Mode 2: Full-Screen / Scrolling Film-Strip Logic (Desktop Viewports)
              const scrollOpacity = activeTab === i ? 1 : 0.2;
              const scrollScale = activeTab === i ? 1 : 0.95;
              const scrollTranslateY = 0;
              const scrollZIndex = activeTab === i ? 10 : 2;
              const scrollPointerEvents: 'auto' | 'none' = activeTab === i ? 'auto' : 'none';

              return (
                <div
                  key={item.id}
                  className={`interactive-scene ${activeTab === i ? 'active' : ''} ${flippedIndices[i] ? 'is-flipped' : ''}`}
                  style={{
                    position: isHalfScreen ? 'absolute' : 'relative',
                    inset: isHalfScreen ? 0 : 'auto',
                    height: isHalfScreen ? '100%' : `${100 / showcaseData.length}%`,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    padding: '2rem 1rem',
                    opacity: isHalfScreen ? stackOpacity : scrollOpacity,
                    zIndex: isHalfScreen ? stackZIndex : scrollZIndex,
                    pointerEvents: isHalfScreen ? stackPointerEvents : scrollPointerEvents,
                    // Apply mode-specific transforms
                    transform: isHalfScreen
                      ? `scale(${stackScale}) translateY(${stackTranslateY}px) translateX(${activeTab === i ? dragX : 0}px)`
                      : `scale(${scrollScale}) translateY(${scrollTranslateY}px)`,
                    transition: isDraggingCard ? 'none' : 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
                    perspective: '1200px'
                  }}
                >
                  <div
                    className={`scene-card float-2 ${isDraggingCard && activeTab === i ? 'grabbing' : ''} ${flippedIndices[i] ? 'flipped' : ''}`}
                    onClick={(e) => {
                      // Only flip if it's the active tab and we aren't dragging
                      if (activeTab === i && !isDraggingCard) {
                        e.stopPropagation();
                        toggleFlip(i);
                      }
                    }}
                    style={{
                      animationDelay: `${i * 0.2}s`,
                      cursor: activeTab === i ? (isDraggingCard ? 'grabbing' : 'pointer') : 'default',
                      position: 'relative',
                      width: '100%',
                      transformStyle: 'preserve-3d',
                      transition: 'transform 0.7s cubic-bezier(0.4, 0, 0.2, 1)'
                    }}
                  >
                    {/* Front Face */}
                    <div className="scene-card-front" style={{ backfaceVisibility: 'hidden' }}>
                      <div className="tab-header" style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div className="tab-icon" style={{ scale: '1.25', transformOrigin: 'left' }}>{item.icon}</div>
                        <h3 className="tab-title" style={{ fontSize: '1.25rem', color: 'var(--accent-secondary)' }}>{item.tab}</h3>
                      </div>
                      <div className="tab-content-inner">
                        <h4 className="tab-subtitle" style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.75rem', color: 'var(--text-primary)' }}>{item.title}</h4>
                        <p className="tab-text" style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: 1.6 }}>{item.text}</p>
                        <ul className="tab-highlights" style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
                          {item.highlights.map((hl, hlIdx) => (
                            <li key={hlIdx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
                              <CheckCircle2 size={18} className="success" style={{ flexShrink: 0 }} />
                              <span>{hl}</span>
                            </li>
                          ))}
                        </ul>
                        <Link
                          to={user ? `/${item.id === 'more' ? 'settings' : item.id === 'indicators' ? 'trade' : item.id}` : '/signup'}
                          className="typing-btn"
                          onClick={(e) => e.stopPropagation()}
                          onPointerDown={(e) => e.stopPropagation()}
                          style={{
                            textDecoration: 'none',
                            display: 'inline-flex',
                            alignItems: 'center',
                            width: 'fit-content',
                            padding: '0.5rem 1.25rem',
                            fontSize: '0.85rem',
                            fontWeight: 600,
                            borderRadius: '50px',
                            background: 'var(--accent-primary)',
                            color: '#fff',
                            boxShadow: '0 4px 15px rgba(0, 85, 255, 0.3)',
                            overflow: 'hidden',
                            whiteSpace: 'nowrap',
                            border: '1px solid rgba(255, 255, 255, 0.2)'
                          }}
                        >
                          <span className={`typewriter-text ${activeTab === i ? 'animate' : ''}`}>Explore More</span>
                          <span className="typewriter-cursor">|</span>
                        </Link>
                      </div>
                    </div>

                    {/* Back Face */}
                    <div className="scene-card-back" style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', transform: 'rotateY(180deg)', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '2.5rem' }}>
                      <div className="tab-header" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <h3 className="tab-title" style={{ fontSize: '1.25rem', color: 'var(--accent-primary)' }}>Ready to {item.tab}?</h3>
                        <Activity size={24} className="accent-pulse" />
                      </div>
                      <p style={{ color: 'var(--text-secondary)', marginBottom: '2.5rem', fontSize: '1.1rem', lineHeight: 1.6 }}>
                        Dive into our {item.tab.toLowerCase()} tools and see how TradeShift can transform your trading experience.
                      </p>
                      <Link
                        to={user ? `/${item.id === 'more' ? 'settings' : item.id === 'indicators' ? 'trade' : item.id}` : '/signup'}
                        className="btn btn-primary"
                        onClick={(e) => e.stopPropagation()} // DON'T re-flip when clicking the link
                        onPointerDown={(e) => e.stopPropagation()}
                        style={{ fontSize: '1.1rem', padding: '1rem 2rem', textAlign: 'center', width: '100%' }}
                      >
                        Explore {item.tab}
                      </Link>
                      <div style={{ fontSize: '0.8rem', opacity: 0.6, marginTop: '2rem', textAlign: 'center' }}>Click anywhere to flip back</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  )
}

export const MeteorScrollSection: React.FC<{ canStart: boolean }> = ({ canStart }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const starRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const bgRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { user } = useAuth();

  useGSAP(() => {
    if (!canStart) return;

    const tl = gsap.timeline();

    // 1. Automatic Cinematic Entrance
    tl.fromTo(starRef.current,
      { scale: 1, autoAlpha: 1 },
      {
        scale: 100,
        duration: 2.0,
        ease: "power2.in",
        delay: 2.5, // Exactly synchronized with both typing lines (1.5s + 1s)
        onStart: () => {
          gsap.to(bgRef.current, { autoAlpha: 1, duration: 0.5 });
        }
      }
    )
      .to(starRef.current, { autoAlpha: 0, duration: 0.3 }, "-=0.3")
      .fromTo(contentRef.current,
        { autoAlpha: 0, scale: 0.8, y: '5vh' },
        { autoAlpha: 1, scale: 1, y: '0vh', duration: 0.2, ease: "power2.out" }
      );

    // 2. Scroll-Triggered Exit (Pinned)
    ScrollTrigger.create({
      trigger: containerRef.current,
      start: "top top",
      end: "+=2000",
      pin: true,
      scrub: 1,
      onUpdate: (self) => {
        if (self.progress > 0.5) {
          gsap.to(contentRef.current, { autoAlpha: 1 - ((self.progress - 0.5) * 2), y: -20 * (self.progress - 0.5) });
        }
      }
    });

  }, { scope: containerRef });

  return (
    <div ref={containerRef} style={{ height: '100vh', position: 'relative', marginTop: '2rem' }}>
      <div style={{ position: 'absolute', inset: 0, height: '100vh', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 40 }}>
        <div ref={bgRef} style={{ position: 'absolute', inset: 0, background: 'var(--meteor-bg)', zIndex: 1, visibility: 'hidden', opacity: 0 }} />
        <div ref={starRef} className="shooting-star" style={{ position: 'absolute', willChange: 'transform, opacity', zIndex: 2 }}>
          <div className="star-orbit"></div>
        </div>
        <div ref={contentRef} style={{ position: 'absolute', zIndex: 3, width: '80%', maxWidth: '1200px', height: '80vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2rem', visibility: 'hidden', opacity: 0 }}>
          <DraggableHeroGraphic />
          <button
            onClick={() => navigate(user ? '/trade' : '/signup')}
            className="btn primary"
            style={{
              padding: '1.25rem 3.5rem',
              fontSize: '1.25rem',
              fontWeight: '700',
              color: 'var(--bg-base)',
              background: 'var(--accent-secondary)',
              borderRadius: '3rem',
              boxShadow: '0 0 20px var(--accent-secondary)',
              cursor: 'pointer',
              border: 'none'
            }}
          >
            Start Here
          </button>
        </div>
      </div>
    </div>
  );
};

export default function LandingPage() {
  const [isLightMode, setIsLightMode] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const { user, logout } = useAuth();
  const { setSymbol } = useGame();
  const activeChartId = useMultiChartStore(state => state.activeChartId);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [showWelcome, setShowWelcome] = useState(() => {
    return !sessionStorage.getItem('welcomeIntroPlayed');
  });
  const [showFlash, setShowFlash] = useState(false);
  const [line1Done, setLine1Done] = useState(false);
  const [line2Done, setLine2Done] = useState(false);

  // Auto-dismiss the welcome intro
  useEffect(() => {
    if (!showWelcome) return;

    const timer = window.setTimeout(() => {
      // Primary GSAP Dismissal
      if (document.querySelector('.welcome-overlay')) {
        gsap.to('.welcome-overlay', {
          autoAlpha: 0,
          duration: 1,
          ease: 'power2.inOut',
          onComplete: () => {
             setShowWelcome(false);
             sessionStorage.setItem('welcomeIntroPlayed', 'true');
          }
        });
      } else {
        setShowWelcome(false);
        sessionStorage.setItem('welcomeIntroPlayed', 'true');
      }
    }, 3700);

    // CRITICAL SAFETY FALLBACK: Forces the landing page to load even if GSAP or API stutters
    const safetyTimeout = window.setTimeout(() => {
      setShowWelcome(false);
      sessionStorage.setItem('welcomeIntroPlayed', 'true');
    }, 6000); 

    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(safetyTimeout);
    };
  }, []);

  // Sequence the Hero typing after welcome is gone
  useEffect(() => {
    if (showWelcome) return;

    // Line 1 typing (1.5s)
    const timer1 = setTimeout(() => {
      setLine1Done(true);
    }, 1500);

    // Line 2 typing (starts after line 1)
    const timer2 = setTimeout(() => {
      setLine2Done(true);
    }, 2500); // Exactly at 2.5s (1.5s line 1 + 1.0s line 2)

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [showWelcome]);

  useEffect(() => {
    // Handle the return-flash logic from URL params
    if (searchParams.get('return') === 'true') {
      setShowFlash(true);
      setTimeout(() => setShowFlash(false), 800);
    }
  }, [searchParams]);

  const [isLandingMoreOpen, setIsLandingMoreOpen] = useState(false);
  const moreDropdownRef = useRef<HTMLDivElement>(null);

  // Close 'More' dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (moreDropdownRef.current && !moreDropdownRef.current.contains(event.target as Node)) {
        setIsLandingMoreOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await logout();
    setIsUserMenuOpen(false);
  };

  useEffect(() => {
    // Theme toggle logic scoped to the component's container if possible, 
    // but since we use global body classes in the CSS, we keep it for now.
    if (isLightMode) {
      document.body.classList.add('light-mode');
    } else {
      document.body.classList.remove('light-mode');
    }
  }, [isLightMode]);

  useEffect(() => {
    if (searchParams.get('flash') === 'true') {
      setShowFlash(true);
      const timer = setTimeout(() => {
        setShowFlash(false);
        const element = document.getElementById('features');
        if (element) {
          element.scrollIntoView({ behavior: 'instant' as any });
        }
      }, 400); // Cinematic flash duration
      return () => clearTimeout(timer);
    }
  }, [searchParams]);

  return (
    <div className={`landing-page-root ${isLightMode ? 'light-mode' : ''}`}>
      {/* Dynamic Welcome Intro Overlay */}
      {showWelcome && (
        <div className="welcome-overlay" style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: '#040c20',
          zIndex: 10000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column'
        }}>
          <div style={{ position: 'relative' }}>
            <h1 className="welcome-title" style={{
              fontSize: 'min(5vw, 60px)',
              fontWeight: 800,
              color: 'var(--accent-secondary)',
              letterSpacing: '0.15em',
              fontFamily: 'monospace' // Enforce terminal look
            }}>
              <ScrambleText text="WELCOME TO TRADESHIFT" duration={3000} delay={200} />
            </h1>
          </div>
        </div>
      )}

      {showFlash && <div className="flash-overlay" />}

      <SymbolSearch 
        open={isSearchOpen} 
        onOpenChange={setIsSearchOpen} 
        onSelect={(symbol, token) => {
          setSymbol(symbol, token);
          if (activeChartId) {
            useMultiChartStore.getState().updateChart(activeChartId, { symbol });
          }
          navigate('/trade');
        }}
        activeChartId={activeChartId}
      />

      <nav className="navbar">
        <div className="nav-container">
          <Link to="/" className="brand">TRADE<span className="accent">SHIFT</span></Link>
          
          <div className="nav-center-group" style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
            {/* SEARCH BAR TRIGGER */}
            <div 
              onClick={() => setIsSearchOpen(true)}
              className="landing-search-trigger hidden md:flex items-center rounded-full px-5 py-2.5 transition-all cursor-pointer group"
              style={{ minWidth: '180px' }}
            >
              <Search size={18} className="text-gray-400 mr-3 group-hover:text-white transition-colors" />
              <span className="text-sm font-medium text-gray-400 group-hover:text-white transition-colors select-none">
                Search (⌘K)
              </span>
            </div>

            <div className="nav-links">
              <Link to="/markets">Market</Link>
              <Link to="/screener">Screener</Link>
              <Link to="/portfolio" className="nav-link-btn" title="View Portfolio Overview">Portfolio</Link>
              <Link to="/learn" className="nav-link-btn" title="View Academy Curriculum">Learn</Link>
              <div className="nav-more-dropdown relative" ref={moreDropdownRef}>
                <button 
                  onClick={() => setIsLandingMoreOpen(!isLandingMoreOpen)}
                  className={`flex items-center gap-1 text-[14px] font-semibold transition-colors outline-none cursor-pointer ${isLandingMoreOpen ? 'text-accent-secondary' : 'hover:text-accent-secondary'}`} 
                  style={{ background: 'none', border: 'none', color: 'inherit', font: 'inherit', padding: 0 }}
                >
                  More <ChevronDown size={14} className={`transition-transform duration-200 ${isLandingMoreOpen ? 'rotate-180' : ''}`} />
                </button>
                
                {isLandingMoreOpen && (
                  <div className={`absolute right-0 top-full mt-2 z-[100] min-w-[190px] rounded-2xl p-2 shadow-2xl border ${
                    isLightMode 
                      ? 'bg-white border-slate-200' 
                      : 'bg-[#1e222d] border-[#2a2e39]'
                  } animate-in fade-in zoom-in-95 duration-200`}>
                    <Link
                        to="/news"
                        onClick={() => setIsLandingMoreOpen(false)}
                        className={`flex items-center gap-3 px-3 py-2.5 text-[15px] font-medium rounded-xl transition-colors outline-none cursor-pointer ${
                          isLightMode ? 'text-[#1e222d] hover:bg-slate-50' : 'text-slate-100 hover:bg-white/5'
                        }`}
                        style={{ textDecoration: 'none' }}
                    >
                        <Newspaper size={18} className="text-[#2962ff]" />
                        News & AI Insights
                    </Link>

                    <Link
                        to="/community"
                        onClick={() => setIsLandingMoreOpen(false)}
                        className={`flex items-center gap-3 px-3 py-2.5 text-[15px] font-medium rounded-xl transition-colors outline-none cursor-pointer ${
                          isLightMode ? 'text-[#1e222d] hover:bg-slate-50' : 'text-slate-100 hover:bg-white/5'
                        }`}
                        style={{ textDecoration: 'none' }}
                    >
                        <LayoutDashboard size={18} className="text-[#2962ff]" />
                        Community
                    </Link>

                    <Link
                        to="/help"
                        onClick={() => setIsLandingMoreOpen(false)}
                        className={`flex items-center gap-3 px-3 py-2.5 text-[15px] font-medium rounded-xl transition-colors outline-none cursor-pointer ${
                          isLightMode ? 'text-[#1e222d] hover:bg-slate-50' : 'text-slate-100 hover:bg-white/5'
                        }`}
                        style={{ textDecoration: 'none' }}
                    >
                        <HelpCircle size={18} className="text-[#2962ff]" />
                        Help & Support
                    </Link>

                    <div className={`h-[1px] my-1.5 ${isLightMode ? 'bg-slate-100' : 'bg-white/5'}`} />

                    <div className={`flex items-center gap-3 px-3 py-2.5 text-[15px] font-medium rounded-xl cursor-not-allowed ${
                      isLightMode ? 'text-[#787b86]' : 'text-slate-500'
                    }`}>
                        Technical Analysis (Soon)
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="nav-actions" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button
              onClick={() => setIsLightMode(!isLightMode)}
              className="theme-toggle"
              aria-label="Toggle Theme"
              title="Toggle Theme"
            >
              {isLightMode ? '🌙' : '☀️'}
            </button>

            {user ? (
              <div className="relative" style={{ marginLeft: '0.5rem' }}>
                <button
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="flex items-center gap-2 p-1 pl-2 rounded-full hover:bg-white/5 transition-all border border-transparent hover:border-white/10"
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit' }}
                >
                  <div className="w-8 h-8 rounded-full bg-tv-primary flex items-center justify-center text-white font-bold text-sm shadow-md" style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#0055ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                    {(user.full_name || user.email || "U").charAt(0).toUpperCase()}
                  </div>
                  <ChevronDown size={14} style={{ transition: 'transform 0.3s', transform: isUserMenuOpen ? 'rotate(180deg)' : 'none', opacity: 0.7 }} />
                </button>

                {isUserMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setIsUserMenuOpen(false)}
                      style={{ position: 'fixed', inset: 0, zIndex: 40 }}
                    ></div>
                    <div className="absolute right-0 mt-2 w-56 bg-[#1A1E29] border border-white/10 rounded-xl shadow-2xl py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                      <div className="px-4 py-3 border-b border-white/5 mb-1">
                        <p className="text-base font-bold text-white mt-0.5 tracking-tight">{user.demat_id || 'N/A'}</p>
                        <p className="text-[11px] text-gray-400 font-medium truncate">{user.email}</p>
                      </div>

                      <Link
                        to="/settings"
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5 transition-colors"
                        onClick={() => setIsUserMenuOpen(false)}
                      >
                        <UserCircle size={18} />
                        Profile Settings
                      </Link>

                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-500 hover:bg-red-500/10 transition-colors"
                      >
                        <LogOut size={18} />
                        Sign Out
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <>
                <button onClick={() => navigate('/login')} className="btn btn-outline">Log in</button>
                <button onClick={() => navigate('/signup')} className="btn btn-primary">Sign up</button>
              </>
            )}
          </div>
        </div>
      </nav>

      <header className="hero">
        <div className="hero-content">
          <Reveal type="reveal" delay={100} when={line2Done}>
            <div className="hero-badge">
              <span className="hero-badge-pulse" />
              <span className="hero-badge-text">Live Markets</span>
              <span className="hero-badge-separator">·</span>
              <span className="hero-badge-text">Zero Risk</span>
              <span className="hero-badge-separator">·</span>
              <span className="hero-badge-text">Unlimited Practice</span>
            </div>
          </Reveal>
          <Reveal type="reveal" delay={200}>
            <div className="hero-typing-title">
              {/* Row 1 Typography sync */}
              <div>
                <span className={`typewriter-text line-1 ${!showWelcome ? 'start-typing' : ''}`}>Master the Markets with</span>
                {!showWelcome && !line1Done && <span className="multicolor-cursor visible" />}
              </div>
              {/* Row 2 Typography sync */}
              <div>
                <span className={`typewriter-text line-2 ${line1Done ? 'start-typing' : ''}`}>Zero Risk{line1Done && <span className="multicolor-cursor visible" />}</span>
              </div>
            </div>
          </Reveal>
          <Reveal type="reveal" delay={300} when={line2Done}>
            <p className="hero-subtitle">Learn to trade crypto, stocks, and forex with real-time data, comprehensive educational modules, and a risk-free simulated environment.</p>
          </Reveal>

          <Reveal type="reveal" delay={400} className="hero-actions" when={line2Done}>
            <button onClick={() => navigate(user ? '/trade' : '/learn')} className="btn btn-primary btn-large">Start Learning Free</button>
            <button onClick={() => navigate('/learn')} className="btn btn-outline btn-large">View Curriculum</button>
          </Reveal>

          <Reveal type="reveal" delay={500} className="hero-stats" when={line2Done}>
            <div className="stat">
              <span className="stat-value"><CountUp end={100} prefix="$" suffix="k" /></span>
              <span className="stat-label">Virtual Starting Capital</span>
            </div>
            <div className="stat">
              <span className="stat-value"><CountUp end={150} suffix="+" /></span>
              <span className="stat-label">Interactive Lessons</span>
            </div>
            <div className="stat">
              <span className="stat-value">Real-time</span>
              <span className="stat-label">Live Market Data</span>
            </div>
          </Reveal>
        </div>

        <DraggableHeroGraphic when={line2Done} />
      </header>

      <MobileShowcaseSection />

      <MarketJourneyInteractive canStart={line2Done} />
      {/* <MeteorScrollSection canStart={line2Done} /> */}

      <Ticker />

      <section id="features" className="features">
        <Reveal type="reveal" delay={100}>
          <h2 className="section-title">Learn to Trade <span className="accent">Like a Pro</span></h2>
        </Reveal>
        <Reveal type="reveal" delay={200}>
          <p className="section-subtitle">Everything you need to go from beginner to profitable trader.</p>
        </Reveal>

        <div className="features-grid">
          <FeatureCard
            delay={300}
            icon="🎮"
            title="Risk-Free Simulator"
            text="Practice trading with $100,000 in virtual funds. Test your strategies in real-world market conditions safely."
          />
          <FeatureCard
            delay={400}
            icon="📚"
            title="Interactive Curriculum"
            text="Progress through structured lessons covering everything from technical analysis to advanced trading psychology."
          />
          <FeatureCard
            delay={500}
            icon="📈"
            title="Professional Charting"
            text="Access the same powerful charts, indicators, and drawing tools used by professional traders worldwide."
          />
          <FeatureCard
            delay={600}
            icon="🏆"
            title="Trading Tournaments"
            text="Compete against other learners in risk-free tournaments and prove your trading edge on the leaderboards."
          />
        </div>
      </section>

      <footer className="footer">
        <div className="footer-grid">
          <Reveal type="reveal" delay={100} className="footer-brand">
            <Link to="/landing" className="brand">TRADE<span className="accent">SHIFT</span></Link>
            <p>The #1 educational platform for mastering the financial markets.</p>
          </Reveal>
          <Reveal type="reveal" delay={200} className="footer-links">
            <h4>Simulator</h4>
            <a href="#">Crypto Simulator</a>
            <a href="#">Stock Simulator</a>
            <a href="#">Forex Simulator</a>
            <a href="#">Trading Competitions</a>
          </Reveal>
          <Reveal type="reveal" delay={300} className="footer-links">
            <h4>Education</h4>
            <a href="#">Beginner Courses</a>
            <a href="#">Technical Analysis</a>
            <a href="#">Trading Psychology</a>
            <a href="#">Video Library</a>
          </Reveal>
          <Reveal type="reveal" delay={400} className="footer-links">
            <h4>Legal</h4>
            <a href="#">Terms of Use</a>
            <a href="#">Privacy Policy</a>
            <a href="#">Disclaimer</a>
          </Reveal>
        </div>
        <Reveal type="reveal" delay={500} className="footer-bottom">
          <p>&copy; 2026 TRADE SHIFT Education. All rights reserved. Simulated trading only. No real money involved.</p>
        </Reveal>
      </footer>
    </div>
  );
}
