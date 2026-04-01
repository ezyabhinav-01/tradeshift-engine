import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Globe, DollarSign, TrendingUp, Building2, Coins, Activity } from 'lucide-react';

interface Instrument {
    token: string;
    symbol: string;
    name: string | null;
    instrument_type: string | null;
    file?: string;
    exchange?: string;
}

interface SymbolSearchProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSelect: (symbol: string, token: string) => void;
}

const TABS = ['All', 'Stocks', 'Funds', 'Futures', 'Forex', 'Crypto', 'Indices', 'Bonds', 'Economy'];

const SimpleSearchModal: React.FC<SymbolSearchProps> = ({ open, onOpenChange, onSelect }) => {
    const [query, setQuery] = useState('');
    const [activeTab, setActiveTab] = useState('All');
    const [results, setResults] = useState<Instrument[]>([]);
    const [availableSymbols, setAvailableSymbols] = useState<Instrument[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    // Focus input when opened
    useEffect(() => {
        if (open && inputRef.current) {
            setTimeout(() => inputRef.current?.focus(), 50);
            setQuery(''); // reset query on open
            setActiveTab('All');
        }
    }, [open]);

    // Fetch available symbols on mount
    useEffect(() => {
        const fetchAvailableSymbols = async () => {
            setIsLoading(true);
            try {
                const response = await fetch(`/api/available-symbols`);
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const data = await response.json();

                const formattedSymbols = data.symbols.map((s: any) => ({
                    token: s.token,
                    symbol: s.symbol,
                    name: s.name,
                    instrument_type: s.instrument_type || 'INDEX',
                    file: s.file,
                    exchange: s.exchange || 'NSE'
                }));

                if (formattedSymbols.length === 0) throw new Error("No symbols returned by API");

                setAvailableSymbols(formattedSymbols);
                setResults(formattedSymbols);
            } catch (error) {
                console.error('Error fetching available symbols, using fallback:', error);

                const mockSymbols: Instrument[] = [
                    { token: '26000', symbol: 'NIFTY', name: 'Nifty 50 Index', instrument_type: 'INDEX', exchange: 'NSE' },
                    { token: '26009', symbol: 'BANKNIFTY', name: 'Nifty Bank Index', instrument_type: 'INDEX', exchange: 'NSE' },
                    { token: '3456', symbol: 'HDFCBANK', name: 'HDFC Bank Limited', instrument_type: 'STOCK', exchange: 'NSE' },
                    { token: '2885', symbol: 'RELIANCE', name: 'Reliance Industries Limited', instrument_type: 'STOCK', exchange: 'NSE' },
                    { token: 'crypto-btc', symbol: 'BTCUSD', name: 'Bitcoin / U.S. dollar', instrument_type: 'CRYPTO', exchange: 'BINANCE' }
                ];
                setAvailableSymbols(mockSymbols);
                setResults(mockSymbols);
            } finally {
                setIsLoading(false);
            }
        };

        if (open) {
            fetchAvailableSymbols();
        }
    }, [open]);

    // Filter symbols based on query and tab
    useEffect(() => {
        let filtered = availableSymbols;

        // Apply tab filter roughly
        if (activeTab !== 'All') {
            filtered = filtered.filter(s => {
                const type = s.instrument_type?.toUpperCase() || 'STOCK';
                if (activeTab === 'Stocks') return type === 'STOCK' || type === 'EQ';
                if (activeTab === 'Indices') return type === 'INDEX';
                if (activeTab === 'Crypto') return type === 'CRYPTO';
                // Very naive matching for other tabs just for demonstration if types aren't mapped
                return true; 
            });
        }

        // Apply text query
        if (query.length > 0) {
            const lowerQuery = query.toLowerCase();
            filtered = filtered.filter(symbol =>
                symbol.symbol.toLowerCase().includes(lowerQuery) ||
                (symbol.name && symbol.name.toLowerCase().includes(lowerQuery))
            );
        }

        setResults(filtered);
    }, [query, activeTab, availableSymbols]);

    const getIcon = (type: string | null) => {
        const t = (type || 'STOCK').toUpperCase();
        switch (t) {
            case 'INDEX': return <TrendingUp className="w-4 h-4" />;
            case 'CRYPTO': return <Coins className="w-4 h-4 text-orange-500" />;
            case 'FOREX': return <DollarSign className="w-4 h-4 text-green-500" />;
            default: return <Building2 className="w-4 h-4" />;
        }
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-start justify-center pt-8 md:pt-[10vh] px-4 font-sans">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                onClick={() => onOpenChange(false)}
            />

            {/* Modal Content */}
            <div className="relative w-full max-w-4xl bg-white dark:bg-[#131722] rounded-xl shadow-[0_0_40px_-10px_rgba(0,0,0,0.3)] overflow-hidden flex flex-col h-[85vh] md:h-[75vh]">
                
                {/* Search Header */}
                <div className="flex items-center px-4 md:px-6 py-4 border-b border-gray-100 dark:border-gray-800/60">
                    <Search className="w-6 h-6 text-gray-400 dark:text-gray-500 mr-4 hidden sm:block" />
                    <input
                        ref={inputRef}
                        type="text"
                        placeholder="Search"
                        className="flex-1 bg-transparent border-none outline-none text-2xl font-semibold text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 w-full"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Escape') onOpenChange(false);
                            if (e.key === 'Enter' && results.length > 0) {
                                onSelect(results[0].symbol, results[0].token);
                                onOpenChange(false);
                            }
                        }}
                    />
                    <button
                        onClick={() => onOpenChange(false)}
                        className="p-2 ml-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-400 dark:text-gray-500 transition-colors"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Primary Tabs (Symbols, Ideas, Scripts, People) */}
                <div className="flex items-center px-4 md:px-6 border-b border-gray-100 dark:border-gray-800/60 gap-6">
                    {['Symbols', 'Ideas', 'Scripts', 'People'].map(tab => (
                        <button
                            key={tab}
                            className={`py-3 text-[15px] font-bold transition-colors border-b-2
                                ${tab === 'Symbols' 
                                    ? 'border-gray-900 text-gray-900 dark:border-white dark:text-white' 
                                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                                }`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                {/* Secondary Pill Tabs */}
                <div className="flex items-center px-4 md:px-6 py-3 border-b border-gray-100 dark:border-gray-800/60 overflow-x-auto scrollbar-hide gap-2">
                    {TABS.map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-3.5 py-1.5 text-sm font-medium whitespace-nowrap rounded-full transition-colors
                                ${activeTab === tab 
                                    ? 'bg-gray-800 text-white dark:bg-gray-200 dark:text-gray-900' 
                                    : 'bg-gray-100 text-gray-700 dark:bg-[#1e222d] dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                                }`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                {/* Results List */}
                <div className="flex-1 overflow-y-auto bg-white dark:bg-[#131722] py-2">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center h-full text-gray-500 space-y-3">
                            <Activity className="w-8 h-8 animate-pulse text-blue-500" />
                            <span>Loading symbols...</span>
                        </div>
                    ) : results.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-gray-500 space-y-3">
                            <Globe className="w-12 h-12 opacity-20" />
                            <span className="text-lg">No symbols match your criteria</span>
                            <button onClick={() => setQuery('')} className="text-blue-500 hover:underline text-sm font-medium">Clear search</button>
                        </div>
                    ) : (
                        <div className="flex flex-col">
                            {results.map((instrument) => (
                                <div
                                    key={instrument.token}
                                    onClick={() => {
                                        onSelect(instrument.symbol, instrument.token);
                                        onOpenChange(false);
                                    }}
                                    className="group flex items-center px-4 md:px-6 py-2.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-[#1e222d] transition-colors"
                                >
                                    {/* Logo/Icon */}
                                    <div className="w-8 h-8 mr-4 flex-shrink-0 flex items-center justify-center rounded-full bg-slate-100 dark:bg-[#2a2e39] text-gray-600 dark:text-gray-300 border border-slate-200 dark:border-slate-700">
                                        {getIcon(instrument.instrument_type)}
                                    </div>
                                    
                                    {/* Primary Info */}
                                    <div className="flex-1 flex items-center min-w-0">
                                        <span className="font-bold text-gray-900 dark:text-white text-[15px] w-28 md:w-36 truncate">
                                            {instrument.symbol}
                                        </span>
                                        <span className="text-gray-800 dark:text-gray-300 text-[14px] truncate">
                                            {instrument.name || instrument.symbol}
                                        </span>
                                    </div>

                                    {/* Secondary Meta Info */}
                                    <div className="hidden sm:flex items-center gap-3 justify-end w-48 text-gray-500 dark:text-gray-400">
                                        <span className="text-xs lowercase tracking-wide opacity-80">
                                            {(instrument.instrument_type || 'stock').toLowerCase()}
                                        </span>
                                        <span className="font-bold text-gray-800 dark:text-gray-200 text-xs min-w-[40px] text-right">
                                            {instrument.exchange || 'NSE'}
                                        </span>
                                        <div className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center text-[10px] flex-shrink-0">
                                            {instrument.exchange?.[0] || 'N'}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SimpleSearchModal;
