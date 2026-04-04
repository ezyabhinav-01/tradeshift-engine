import React, { useRef, useState } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Activity } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

// A simple local typewriter component for the cinematic intro
const GSAPTypewriter: React.FC<{ text: string; delay?: number; onComplete?: () => void }> = ({ text, delay = 0, onComplete }) => {
  const textRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (!textRef.current) return;

    const chars = text.split("");
    textRef.current.innerHTML = "";
    chars.forEach((char) => {
      const span = document.createElement("span");
      span.innerText = char;
      span.style.opacity = "0";
      textRef.current?.appendChild(span);
    });

    gsap.to(textRef.current.children, {
      opacity: 1,
      duration: 0.05,
      stagger: 0.05,
      delay: delay,
      ease: "power2.inOut",
      onComplete: onComplete
    });
  }, { scope: textRef });

  return <div ref={textRef} style={{ display: 'inline-block' }} />;
};

export const MarketJourneyInteractive: React.FC<{ canStart: boolean }> = ({ canStart }) => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Orchestrator Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const meteorShipRef = useRef<HTMLDivElement>(null);

  // Phases
  const introLayerRef = useRef<HTMLDivElement>(null);

  // Holographic Data Cards (Phase 2 - The Data Stream)
  const card1Ref = useRef<HTMLDivElement>(null); // Nifty/Sensex
  const card2Ref = useRef<HTMLDivElement>(null); // IPO/Equity/NFO
  const card3Ref = useRef<HTMLDivElement>(null); // Price Action & S/R
  const card4Ref = useRef<HTMLDivElement>(null); // Indicators 
  const card5Ref = useRef<HTMLDivElement>(null); // Ecosystem & Costs

  // Interactive Zone (Phase 3 & 4)
  const decisionLayerRef = useRef<HTMLDivElement>(null);
  const simulationBackdropRef = useRef<HTMLDivElement>(null);

  // Psychology Zone & Exit
  const psychologyLayerRef = useRef<HTMLDivElement>(null);
  const exitLayerRef = useRef<HTMLDivElement>(null);

  const [introStarted, setIntroStarted] = useState(false);
  const [decisionResult, setDecisionResult] = useState<'none' | 'success' | 'crash'>('none');

  useGSAP(() => {
    if (!canStart || !containerRef.current) return;

    // SCENE 0: Initial Mount Setup
    gsap.set(meteorShipRef.current, { y: '50vh', scale: 0, opacity: 0 });
    gsap.set(introLayerRef.current, { opacity: 0 });

    // Hide all cards initially in the "depth" of the screen
    const cards = [card1Ref, card2Ref, card3Ref, card4Ref, card5Ref];
    cards.forEach(card => {
      gsap.set(card.current, { opacity: 0, y: '30vh', scale: 0.8 });
    });

    gsap.set(decisionLayerRef.current, { opacity: 0, y: '20vh', scale: 0.9 });
    gsap.set(psychologyLayerRef.current, { opacity: 0, y: '20vh' });
    gsap.set(exitLayerRef.current, { opacity: 0 });

    // Let the component settle, then animate ship entering "camera"
    const entryTl = gsap.timeline({
      scrollTrigger: {
        trigger: containerRef.current,
        start: 'top 80%',
        once: true,
        onEnter: () => setIntroStarted(true)
      }
    });

    entryTl
      .to(meteorShipRef.current, { scale: 1, opacity: 1, duration: 2, ease: "power3.out" })
      .to(introLayerRef.current, { opacity: 1, duration: 1 }, "-=1");

    // ============================================
    // THE MASTER SCROLLTIMELINE (Scrollytelling)
    // ============================================
    const masterTl = gsap.timeline({
      scrollTrigger: {
        trigger: containerRef.current,
        start: 'top top',
        end: '+=15000', // Massive scroll depth for 15 educational points
        scrub: 1.5,
        pin: true,
      }
    });

    // --- PHASE 1: Leaving Ignition ---
    masterTl
      .to(introLayerRef.current, { opacity: 0, scale: 1.1, duration: 1 })
      .to(meteorShipRef.current, { scale: 0.6, y: '-15vh', duration: 2 }, "<");

    // --- PHASE 2: The Data Stream (Cards flying past) ---
    // Instead of just fading the whole card, we grab its "pieces" and assemble them from the corners!
    const streamCard = (cardRef: React.RefObject<HTMLDivElement | null>, shipGlow: string) => {
      if (!cardRef.current) return;

      const header = cardRef.current.querySelector('.card-header');
      const pieces = cardRef.current.querySelectorAll('.card-piece');

      // Setup initial invisible, scattered state
      gsap.set(cardRef.current, { opacity: 1, y: '0vh', scale: 1 }); // Main wrapper stays centered natively
      if (header) gsap.set(header, { scale: 0, opacity: 0, y: '-20vh' });

      pieces.forEach((piece, index) => {
        // Decide which corner it comes from based on index
        const startX = index % 2 === 0 ? '-80vw' : '80vw'; // Left or Right
        const startY = index < 2 ? '-60vh' : '60vh';       // Top or Bottom
        // Give it a wild initial rotation
        gsap.set(piece, { x: startX, y: startY, opacity: 0, rotation: index % 2 === 0 ? -45 : 45, scale: 0.5 });
      });

      // Create the combination assembly timeline
      masterTl
        // Pieces fly in from deep space corners and snap together!
        .to(pieces, { x: '0vw', y: '0vh', opacity: 1, rotation: 0, scale: 1, duration: 1.5, ease: 'back.out(1.2)', stagger: 0.2 })
        // Header stamps in
        .to(header, { scale: 1, opacity: 1, y: '0vh', duration: 0.8, ease: 'bounce.out' }, "-=1")
        // Ship glow shifts colors
        .to(meteorShipRef.current, { filter: `drop-shadow(0 0 40px ${shipGlow})`, duration: 1 }, "<")
        // Hold format for a reading beat then blast them away together up and out
        .to(cardRef.current, { opacity: 0, y: '-30vh', scale: 1.2, duration: 1.5, ease: 'power2.in' }, "+=1.5");
    };

    streamCard(card1Ref, '#00ccff'); // Giants
    streamCard(card2Ref, '#10b981'); // Lifecycle
    streamCard(card3Ref, '#ef4444'); // Price Action
    streamCard(card4Ref, '#a855f7'); // Indicators
    streamCard(card5Ref, '#f59e0b'); // Ecosystem

    // --- PHASE 3: Entering The Decision Zone ---
    masterTl
      .to(meteorShipRef.current, { scale: 0.8, y: '25vh', filter: 'drop-shadow(0 0 15px rgba(255,255,255,0.5))', duration: 1.5 })
      .to(decisionLayerRef.current, { opacity: 1, y: '0vh', scale: 1, duration: 1.5 }, "<")
      // Wait for user interaction or scroll to pass through
      .to(decisionLayerRef.current, { opacity: 0, scale: 0.8, duration: 1.5 }, "+=3");

    // --- PHASE 4: Psychology Zone ---
    masterTl
      .to(psychologyLayerRef.current, { opacity: 1, y: '0vh', duration: 1.5 }, "-=0.5")
      // Heartbeat pulse effect on the meteor
      .to(meteorShipRef.current, { filter: 'drop-shadow(0 0 50px rgba(157, 0, 255, 0.8))', scale: 1.1, duration: 0.5, yoyo: true, repeat: 3 }, "<")
      // Fade out Psychology
      .to(psychologyLayerRef.current, { opacity: 0, y: '-20vh', duration: 1.5 }, "+=2");

    // --- PHASE 5: The Exit ---
    masterTl
      // Meteor blasts off into warp
      .to(meteorShipRef.current, { scale: 1.5, y: '-150vh', filter: 'drop-shadow(0 0 100px #fff)', duration: 2, ease: "power3.in" })
      // Show final success layer
      .to(exitLayerRef.current, { opacity: 1, duration: 1 }, "-=1");

  }, { scope: containerRef, dependencies: [canStart] });

  // Standalone interaction handler for the Gamified Decision Zone
  const handleDecision = (choice: 'buy' | 'sell' | 'wait') => {
    // We animate independently of the scroll timeline!
    if (choice === 'buy' || choice === 'sell') {
      setDecisionResult('crash');
      gsap.to(simulationBackdropRef.current, { background: 'rgba(239,68,68,0.3)', duration: 0.5 });
      // Intense shake effect
      gsap.to(containerRef.current, { x: 20, yoyo: true, repeat: 9, duration: 0.05, ease: 'linear', onComplete: () => { gsap.to(containerRef.current, { x: 0 }) } });
      gsap.to(meteorShipRef.current, { filter: 'drop-shadow(0 0 80px #ef4444)', duration: 0.5, yoyo: true, repeat: 1 });
      setTimeout(() => setDecisionResult('none'), 3000);
    } else {
      setDecisionResult('success');
      gsap.to(simulationBackdropRef.current, { background: 'rgba(16,185,129,0.3)', duration: 0.5 });
      // Smooth warp-speed boost
      gsap.to(meteorShipRef.current, { y: '-=15vh', duration: 0.5, ease: 'back.out(1.7)', yoyo: true, repeat: 1 });
      gsap.to(meteorShipRef.current, { filter: 'drop-shadow(0 0 80px #10b981)', duration: 0.5, yoyo: true, repeat: 1 });
      setTimeout(() => setDecisionResult('none'), 3000);
    }
  };

  return (
    <div ref={containerRef} className="market-journey-root" style={{
      height: '100vh',
      background: 'radial-gradient(ellipse at bottom, #020617 0%, #000000 100%)',
      position: 'relative',
      overflow: 'hidden',
      color: '#fff',
      zIndex: 40
    }}>

      {/* Backgrounds */}
      <div style={{ position: 'absolute', inset: 0, background: 'url("/assets/stars.png") repeat', opacity: 0.3, zIndex: 0 }} />
      <div ref={simulationBackdropRef} style={{ position: 'absolute', inset: 0, zIndex: 1, transition: 'background 0.5s ease' }} />

      {/* The Meteor Avatar (Always visible, piloted by GSAP) */}
      <div ref={meteorShipRef} style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', zIndex: 20, willChange: 'transform' }}>
        <div style={{ width: '50px', height: '50px', background: 'var(--accent-secondary)', borderRadius: '50%', position: 'relative' }}>
          <div style={{ position: 'absolute', width: '20px', height: '120px', background: 'linear-gradient(to top, transparent, var(--accent-secondary))', bottom: '100%', left: '15px', borderRadius: '50%', transform: 'rotate(180deg)' }} />
          <Activity size={24} color="#000" style={{ position: 'absolute', top: '13px', left: '13px' }} />
        </div>
      </div>

      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', perspective: '1200px', zIndex: 10 }}>

        {/* =========================================
            SCENE 1: IGNITION ZONE 
            ========================================= */}
        <div ref={introLayerRef} style={{ position: 'absolute', textAlign: 'center', top: '25%', width: '100%', opacity: 0, pointerEvents: 'none' }}>
          <h2 style={{ fontSize: '3rem', fontWeight: 800, letterSpacing: '2px', color: 'var(--accent-secondary)', textShadow: '0 0 20px rgba(0,204,255,0.4)', marginBottom: '1rem' }}>
            {introStarted && <GSAPTypewriter text="Welcome to the Market Universe..." />}
          </h2>
          <p style={{ fontSize: '1.5rem', color: '#ccc', maxWidth: '800px', margin: '0 auto', lineHeight: 1.6 }}>
            What is a market? It's simply a place where buyers and sellers meet. <br />
            <strong style={{ color: '#fff' }}>Price moves because people agree or disagree on value.</strong>
          </p>
          <p style={{ fontSize: '1.25rem', color: '#9ca3af', opacity: 0.8, animation: 'pulse 3s infinite', marginTop: '2rem' }}>
            Scroll to travel the data stream ↓
          </p>
        </div>


        {/* =========================================
            SCENE 2: THE DATA STREAM (HOLO-CARDS)
            ========================================= */}
        {/* Card 1: Giants */}
        <div ref={card1Ref} style={{ position: 'absolute', width: '90%', maxWidth: '1200px', textAlign: 'center', opacity: 0, pointerEvents: 'none' }}>
          <h2 className="card-header" style={{ fontSize: '2.5rem', color: '#fff', marginBottom: '2rem' }}>Indian Market Giants</h2>
          <div style={{ display: 'flex', gap: '2rem' }}>
            <div className="card-piece" style={{ flex: 1, background: 'rgba(0,0,0,0.5)', padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(0,204,255,0.3)', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
              <h3 style={{ color: 'var(--accent-primary)', marginBottom: '0.5rem', fontSize: '1.5rem' }}>NIFTY 50</h3>
              <p style={{ color: '#a1a1aa' }}>The pulse of India. Represents the top 50 largest companies listed on the NSE.</p>
            </div>
            <div className="card-piece" style={{ flex: 1, background: 'rgba(0,0,0,0.5)', padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(0,204,255,0.3)', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
              <h3 style={{ color: 'var(--accent-secondary)', marginBottom: '0.5rem', fontSize: '1.5rem' }}>SENSEX</h3>
              <p style={{ color: '#a1a1aa' }}>The historic barometer. Represents the top 30 companies on the BSE.</p>
            </div>
          </div>
        </div>

        {/* Card 2: Lifecycle & Segments */}
        <div ref={card2Ref} style={{ position: 'absolute', width: '90%', maxWidth: '1200px', textAlign: 'center', opacity: 0, pointerEvents: 'none' }}>
          <h2 className="card-header" style={{ fontSize: '2.5rem', color: '#fff', marginBottom: '2rem' }}>The Trading Arsenal</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', textAlign: 'left' }}>
            <div className="card-piece" style={{ padding: '1.5rem', background: 'rgba(0,0,0,0.4)', borderRadius: '12px', borderLeft: '4px solid var(--accent-secondary)' }}>
              <strong style={{ color: '#fff', fontSize: '1.2rem' }}>Primary Market (IPO)</strong><br />
              <span style={{ color: '#aaa', fontSize: '0.9rem', display: 'block', marginTop: '0.5rem' }}>A company issues shares directly to the public to raise money.</span>
            </div>
            <div className="card-piece" style={{ padding: '1.5rem', background: 'rgba(0,0,0,0.4)', borderRadius: '12px', borderLeft: '4px solid var(--accent-secondary)' }}>
              <strong style={{ color: '#fff', fontSize: '1.2rem' }}>Secondary Market</strong><br />
              <span style={{ color: '#aaa', fontSize: '0.9rem', display: 'block', marginTop: '0.5rem' }}>You trade existing shares with other investors. The company sees no money.</span>
            </div>
            <div className="card-piece" style={{ padding: '1.5rem', background: 'rgba(0,0,0,0.4)', borderRadius: '12px', borderLeft: '4px solid var(--success)' }}>
              <strong style={{ color: '#fff', fontSize: '1.2rem' }}>Equity (Stocks)</strong><br />
              <span style={{ color: '#aaa', fontSize: '0.9rem', display: 'block', marginTop: '0.5rem' }}>You own a physical piece of the company. Good for long-term.</span>
            </div>
            <div className="card-piece" style={{ padding: '1.5rem', background: 'rgba(0,0,0,0.4)', borderRadius: '12px', borderLeft: '4px solid var(--danger)' }}>
              <strong style={{ color: '#fff', fontSize: '1.2rem' }}>NFO (Futures & Options)</strong><br />
              <span style={{ color: '#aaa', fontSize: '0.9rem', display: 'block', marginTop: '0.5rem' }}>High-risk derivatives. You trade contracts on price movements.</span>
            </div>
          </div>
        </div>

        {/* Card 3: Price Action */}
        <div ref={card3Ref} style={{ position: 'absolute', width: '90%', maxWidth: '1200px', textAlign: 'center', opacity: 0, pointerEvents: 'none' }}>
          <div className="card-header">
            <h2 style={{ fontSize: '2.5rem', color: '#fff', marginBottom: '1.5rem' }}>Price Action & Volatility</h2>
            <p style={{ fontSize: '1.2rem', color: '#ccc', marginBottom: '2rem' }}>Traders don't read words, they read Candlesticks. Each candle tells a story of the battle between buyers and sellers.</p>
          </div>
          <div style={{ display: 'flex', gap: '1.5rem', textAlign: 'left' }}>
            <div className="card-piece" style={{ flex: 1, padding: '2rem', background: 'rgba(16,185,129,0.1)', borderRadius: '16px', border: '1px solid var(--success)', boxShadow: '0 10px 30px rgba(16,185,129,0.2)' }}>
              <strong style={{ color: 'var(--success)', fontSize: '1.3rem' }}>Support (The Floor)</strong><br />
              <span style={{ color: '#ccc', fontSize: '1rem', display: 'block', marginTop: '0.5rem' }}>Price level where buyers consistently step in.</span>
            </div>
            <div className="card-piece" style={{ flex: 1, padding: '2rem', background: 'rgba(239,68,68,0.1)', borderRadius: '16px', border: '1px solid var(--danger)', boxShadow: '0 10px 30px rgba(239,68,68,0.2)' }}>
              <strong style={{ color: 'var(--danger)', fontSize: '1.3rem' }}>Resistance (Ceiling)</strong><br />
              <span style={{ color: '#ccc', fontSize: '1rem', display: 'block', marginTop: '0.5rem' }}>Price level where sellers consistently dump shares.</span>
            </div>
          </div>
        </div>

        {/* Card 4: Indicators */}
        <div ref={card4Ref} style={{ position: 'absolute', width: '90%', maxWidth: '1200px', textAlign: 'left', opacity: 0, pointerEvents: 'none' }}>
          <div className="card-header">
            <h2 style={{ fontSize: '2.5rem', color: '#fff', marginBottom: '1rem', textAlign: 'center' }}>The Tech Indicators</h2>
            <p style={{ fontSize: '1.1rem', color: '#ccc', fontStyle: 'italic', textAlign: 'center', marginBottom: '2rem' }}>Indicators do not predict the future; they map the present.</p>
          </div>
          <ul style={{ fontSize: '1.2rem', lineHeight: 2, color: '#e5e7eb', paddingLeft: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <li className="card-piece" style={{ background: 'rgba(168,85,247,0.1)', padding: '1rem', borderRadius: '8px', listStyle: 'none' }}><strong style={{ color: '#a855f7' }}>Moving Averages (EMA):</strong> Smooths out price noise to reveal the true trend direction.</li>
            <li className="card-piece" style={{ background: 'rgba(168,85,247,0.1)', padding: '1rem', borderRadius: '8px', listStyle: 'none' }}><strong style={{ color: '#a855f7' }}>Relative Strength Index (RSI):</strong> Measures momentum. Is the market overbought or oversold?</li>
            <li className="card-piece" style={{ background: 'rgba(168,85,247,0.1)', padding: '1rem', borderRadius: '8px', listStyle: 'none' }}><strong style={{ color: '#a855f7' }}>MACD:</strong> Spots shifts in trend strength before they become obvious.</li>
          </ul>
        </div>

        {/* Card 5: Ecosystem */}
        <div ref={card5Ref} style={{ position: 'absolute', width: '90%', maxWidth: '1200px', textAlign: 'center', opacity: 0, pointerEvents: 'none' }}>
          <h2 className="card-header" style={{ fontSize: '2.5rem', color: '#fff', marginBottom: '2rem' }}>The Market Ecosystem</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', textAlign: 'left' }}>
            <div className="card-piece" style={{ background: 'rgba(0,0,0,0.5)', padding: '1.5rem', borderRadius: '12px' }}>
              <strong style={{ color: '#f59e0b', fontSize: '1.2rem' }}>The Regulators & Exchanges</strong>
              <p style={{ color: '#ccc', marginTop: '0.5rem', fontSize: '0.9rem' }}><strong>SEBI</strong> polices the market. The <strong>NSE/BSE</strong> exchanges execute your trades in milliseconds.</p>
            </div>
            <div className="card-piece" style={{ background: 'rgba(0,0,0,0.5)', padding: '1.5rem', borderRadius: '12px' }}>
              <strong style={{ color: '#f59e0b', fontSize: '1.2rem' }}>The Brokers & Deposits</strong>
              <p style={{ color: '#ccc', marginTop: '0.5rem', fontSize: '0.9rem' }}>Brokers act as your gateway. Your shares are held safely in a digital depository (CDSL/NSDL).</p>
            </div>
            <div className="card-piece" style={{ gridColumn: 'span 2', background: 'rgba(239,68,68,0.1)', padding: '1.5rem', borderRadius: '12px', borderLeft: '4px solid var(--danger)' }}>
              <strong style={{ color: '#ef4444', fontSize: '1.2rem' }}>The Hidden Reality: Costs</strong>
              <p style={{ color: '#aaa', fontSize: '1rem', marginTop: '0.5rem' }}>Trading isn't free. You must account for Brokerage fees, GST, Stamp Duty, and Slippage during volatility.</p>
            </div>
          </div>
        </div>


        {/* =========================================
            SCENE 3: DECISION ZONE (INTERACTIVE)
            ========================================= */}
        <div ref={decisionLayerRef} style={{ position: 'absolute', width: '100%', maxWidth: '1200px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', opacity: 0, pointerEvents: 'none' }}>
          <h2 style={{ fontSize: '3rem', color: 'var(--danger)', textShadow: '0 0 40px rgba(239,68,68,0.5)', textTransform: 'uppercase', marginBottom: '1rem' }}>Survival &gt; Profit</h2>
          <p style={{ fontSize: '1.2rem', color: '#ccc', marginBottom: '2rem' }}>
            Amateurs obsess over profits. Professionals obsess over losses.<br />
            <strong>Always use a Stop-Loss.</strong>
          </p>

          <div style={{ background: 'rgba(0,0,0,0.8)', padding: '2.5rem', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.1)', width: '100%' }}>
            <h3 style={{ fontSize: '1.5rem', color: '#fff', marginBottom: '1.5rem' }}>
              Price hits a massive Resistance ceiling. RSI is at 88 (Severely Overbought). What is your move?
            </h3>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={() => handleDecision('buy')}
                style={{ padding: '1rem 2rem', background: 'rgba(16,185,129,0.1)', border: '2px solid var(--success)', color: 'var(--success)', borderRadius: '8px', cursor: 'pointer', pointerEvents: 'auto', fontWeight: 'bold' }}
              >BUY NOW</button>
              <button
                onClick={() => handleDecision('sell')}
                style={{ padding: '1rem 2rem', background: 'rgba(239,68,68,0.1)', border: '2px solid var(--danger)', color: 'var(--danger)', borderRadius: '8px', cursor: 'pointer', pointerEvents: 'auto', fontWeight: 'bold' }}
              >SHORT SELL</button>
              <button
                onClick={() => handleDecision('wait')}
                style={{ padding: '1rem 2rem', background: 'rgba(0,204,255,0.1)', border: '2px solid var(--accent-secondary)', color: 'var(--accent-secondary)', borderRadius: '8px', cursor: 'pointer', pointerEvents: 'auto', fontWeight: 'bold' }}
              >WAIT FOR CONFIRMATION</button>
            </div>

            {decisionResult === 'crash' && (
              <div style={{ marginTop: '2rem', color: 'var(--danger)', fontSize: '1.2rem', fontWeight: 'bold' }}>
                CRASH! You acted purely on impulse. Let the market prove its direction.
              </div>
            )}
            {decisionResult === 'success' && (
              <div style={{ marginTop: '2rem', color: 'var(--success)', fontSize: '1.2rem', fontWeight: 'bold' }}>
                PROFIT SECURED! You waited for the candlestick to close. Discipline wins.
              </div>
            )}
          </div>
        </div>


        {/* =========================================
            SCENE 4: PSYCHOLOGY ZONE
            ========================================= */}
        <div ref={psychologyLayerRef} style={{ position: 'absolute', width: '100%', maxWidth: '1200px', textAlign: 'center', opacity: 0, pointerEvents: 'none' }}>
          <h2 style={{ fontSize: '3.5rem', color: '#9d00ff', textShadow: '0 0 30px rgba(157,0,255,0.6)', marginBottom: '1rem' }}>Discipline equals Freedom</h2>
          <p style={{ fontSize: '1.5rem', color: '#ccc', maxWidth: '800px', margin: '0 auto' }}>
            Fear makes you sell early. Greed makes you hold too long.<br /> Every trade requires an Entry, a Stop-Loss, and a Target.<br />
            <strong style={{ color: '#fff' }}>No Strategy = Gambling.</strong>
          </p>
        </div>


        {/* =========================================
            SCENE 5: FINAL CTA (EXIT)
            ========================================= */}
        <div ref={exitLayerRef} style={{ position: 'absolute', textAlign: 'center', maxWidth: '1200px', opacity: 0, pointerEvents: 'none' }}>
          <h2 style={{ fontSize: '4rem', fontWeight: 800, marginBottom: '1rem', background: 'linear-gradient(45deg, #0055ff, #00ccff)', backgroundClip: 'text', WebkitTextFillColor: 'transparent', WebkitBackgroundClip: 'text' }}>
            Your Journey Begins
          </h2>
          <p style={{ fontSize: '1.5rem', color: '#ccc', maxWidth: '600px', margin: '0 auto 3rem auto' }}>
            You now understand how the Indian markets function. The next step is practicing your edge before risking real capital.
          </p>
          <button
            onClick={() => navigate(user ? '/trade' : '/signup')}
            style={{ padding: '1.5rem 4rem', fontSize: '1.5rem', fontWeight: 'bold', borderRadius: '50px', background: 'var(--accent-secondary)', color: 'var(--bg-base)', border: 'none', cursor: 'pointer', pointerEvents: 'auto', boxShadow: '0 10px 40px rgba(0, 204, 255, 0.4)', transition: 'transform 0.2s ease' }}
          >
            Enter The Simulator
          </button>
        </div>

      </div>
    </div>
  );
};
