import React, { useState, useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';

interface Instrument {
    token: string;
    symbol: string;
    name: string | null;
    instrument_type: string | null;
    file?: string;
}

interface SymbolSearchProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSelect: (symbol: string, token: string) => void;
}

const SimpleSearchModal: React.FC<SymbolSearchProps> = ({ open, onOpenChange, onSelect }) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<Instrument[]>([]);
    const [availableSymbols, setAvailableSymbols] = useState<Instrument[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    // Focus input when opened
    useEffect(() => {
        if (open && inputRef.current) {
            // Small timeout to ensure render is complete
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [open]);

    // Fetch available symbols on mount
    useEffect(() => {
        const fetchAvailableSymbols = async () => {
            setIsLoading(true);
            try {
                const response = await fetch('http://localhost:8000/api/available-symbols');
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const data = await response.json();

                const formattedSymbols = data.symbols.map((s: any) => ({
                    token: s.token,
                    symbol: s.symbol,
                    name: s.name,
                    instrument_type: 'INDEX',
                    file: s.file
                }));

                if (formattedSymbols.length === 0) throw new Error("No symbols returned by API");

                setAvailableSymbols(formattedSymbols);
                setResults(formattedSymbols);
            } catch (error) {
                console.error('Error fetching available symbols, using fallback:', error);

                const mockSymbols: Instrument[] = [
                    { token: '26000', symbol: 'NIFTY', name: 'Nifty 50 Index', instrument_type: 'INDEX' },
                    { token: '26009', symbol: 'BANKNIFTY', name: 'Nifty Bank Index', instrument_type: 'INDEX' }
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

    // Filter symbols based on query
    useEffect(() => {
        if (query.length === 0) {
            setResults(availableSymbols);
            return;
        }

        const lowerQuery = query.toLowerCase();
        const filtered = availableSymbols.filter(symbol =>
            symbol.symbol.toLowerCase().includes(lowerQuery) ||
            (symbol.name && symbol.name.toLowerCase().includes(lowerQuery))
        );

        setResults(filtered);
    }, [query, availableSymbols]);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
                onClick={() => onOpenChange(false)}
            />

            {/* Modal Content */}
            <div className="relative w-full max-w-lg bg-gray-900 border border-gray-800 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">

                {/* Search Header */}
                <div className="flex items-center border-b border-gray-800 px-4 py-3 bg-gray-900/50">
                    <Search className="w-5 h-5 text-gray-500 mr-3" />
                    <input
                        ref={inputRef}
                        type="text"
                        placeholder="Search symbol (e.g., NIFTY)..."
                        className="flex-1 bg-transparent border-none outline-none text-lg text-white placeholder-gray-500"
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
                        className="p-1 hover:bg-gray-800 rounded-md text-gray-500"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Results List */}
                <div className="max-h-[300px] overflow-y-auto py-2">
                    {isLoading ? (
                        <div className="py-8 text-center text-gray-500 text-sm">Loading symbols...</div>
                    ) : results.length === 0 ? (
                        <div className="py-8 text-center text-gray-500 text-sm">No results found.</div>
                    ) : (
                        <div className="px-2">
                            <div className="text-xs font-semibold text-gray-500 px-2 py-2 mb-1">Available Instruments</div>
                            {results.map((instrument) => (
                                <button
                                    key={instrument.token}
                                    onClick={() => {
                                        onSelect(instrument.symbol, instrument.token);
                                        onOpenChange(false);
                                    }}
                                    className="w-full flex items-center justify-between px-3 py-3 rounded-lg hover:bg-gray-800 group transition-colors text-left"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500 font-bold text-xs border border-blue-500/20">
                                            {instrument.symbol[0]}
                                        </div>
                                        <div>
                                            <div className="font-medium text-gray-200">{instrument.symbol}</div>
                                            <div className="text-xs text-gray-500">{instrument.name || instrument.symbol}</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border bg-blue-500/10 text-blue-500 border-blue-500/20">
                                            INDEX
                                        </span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-4 py-2 bg-gray-900 border-t border-gray-800 text-[10px] text-gray-600 flex justify-between">
                    <span>Press <strong>ESC</strong> to close</span>
                    <span>Select with <strong>Enter</strong></span>
                </div>
            </div>
        </div>
    );
};

export default SimpleSearchModal;
