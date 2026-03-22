import React, { useState, useEffect, useCallback } from 'react';
import {
    CommandDialog,
    CommandInput,
    CommandList,
    CommandEmpty,
    CommandGroup,
    CommandItem,
} from '../ui/command';
import { useMultiChartStore } from '../../store/useMultiChartStore';
import { Plus } from 'lucide-react';

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
    activeChartId?: string;
}

export const SymbolSearch: React.FC<SymbolSearchProps> = ({ open, onOpenChange, onSelect }) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<Instrument[]>([]);
    const [availableSymbols, setAvailableSymbols] = useState<Instrument[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const { addChart, charts } = useMultiChartStore();
    const canAddMore = charts.length < 4;

    // Fetch available symbols on mount with Mock Fallback
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
                    instrument_type: 'INDEX',
                    file: s.file
                }));

                // Ensure we have data
                if (formattedSymbols.length === 0) throw new Error("No symbols returned by API");

                // Deduplicate by symbol to prevent key collisions (backend default token "0" would cause overlap)
                const uniqueSymbols = Array.from(new Map(formattedSymbols.map((s: any) => [s.symbol, s])).values()) as Instrument[];

                setAvailableSymbols(uniqueSymbols);
                setResults(uniqueSymbols);
            } catch (error) {
                console.error('Error fetching available symbols, using fallback:', error);

                // FALLBACK MOCK DATA (So user always sees something)
                // This ensures the UI works even if backend connection fails
                const mockSymbols: Instrument[] = [
                    { token: '26000', symbol: 'NIFTY 50', name: 'Nifty 50 Index', instrument_type: 'INDEX' },
                    { token: '26009', symbol: 'BANKNIFTY', name: 'Nifty Bank Index', instrument_type: 'INDEX' }
                ];
                setAvailableSymbols(mockSymbols);
                setResults(mockSymbols);
            } finally {
                setIsLoading(false);
            }
        };

        if (open) {
            fetchAvailableSymbols(); // Only fetch when opened to ensure fresh state or retry
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

    const handleSelect = useCallback((instrument: Instrument) => {
        console.log('🎯 SymbolSearch: handleSelect triggered for:', instrument.symbol, instrument.token);
        onSelect(instrument.symbol, instrument.token);
        setQuery('');
        onOpenChange(false);
    }, [onSelect, onOpenChange]);

    const handleAddNew = useCallback((e: React.MouseEvent, instrument: Instrument) => {
        e.stopPropagation(); // Don't trigger main select
        addChart(instrument.symbol);
        setQuery('');
        onOpenChange(false);
    }, [addChart, onOpenChange]);

    console.log('🔍 SymbolSearch render:', { open, availableSymbols: availableSymbols.length, results: results.length });

    return (
        <CommandDialog open={open} onOpenChange={onOpenChange} shouldFilter={false}>
            <CommandInput
                placeholder="Search symbol (e.g., NIFTY)..."
                value={query}
                name="symbol-search"
                id="search-input"
                onValueChange={(val: string) => setQuery(val)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && results.length > 0) {
                        handleSelect(results[0]);
                    }
                }}
            />
            <CommandList>
                {isLoading && (
                    <div className="py-6 text-center text-sm text-gray-500">Loading symbols...</div>
                )}

                {!isLoading && results.length === 0 ? (
                    <CommandEmpty>No results found for "{query}".</CommandEmpty>
                ) : (
                    <CommandGroup heading="Available Instruments">
                        {query.length > 0 && !results.find(r => r.symbol.toLowerCase() === query.toLowerCase()) && (
                            <CommandItem
                                key="custom-search"
                                value={query}
                                onSelect={() => handleSelect({ symbol: query.toUpperCase(), token: '0', name: `Custom: ${query.toUpperCase()}`, instrument_type: 'EQUITY' })}
                                className="p-0"
                                key="custom-search"
                                value={query}
                                onSelect={() => handleSelect({ symbol: query.toUpperCase(), token: '0', name: `Custom: ${query.toUpperCase()}`, instrument_type: 'EQUITY' })}
                                className="p-0 pointer-events-auto"
                            >
                                <button 
                                    type="button"
                                    className="flex flex-1 items-center justify-between py-3 px-4 cursor-pointer hover:bg-accent group transition-colors border-b border-white/5 w-full aria-selected:bg-accent focus:outline-none pointer-events-auto"
                                    onPointerDown={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleSelect({ symbol: query.toUpperCase(), token: '0', name: `Custom: ${query.toUpperCase()}`, instrument_type: 'EQUITY' });
                                    }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleSelect({ symbol: query.toUpperCase(), token: '0', name: `Custom: ${query.toUpperCase()}`, instrument_type: 'EQUITY' });
                                    }}
                                >
                                    <div className="flex items-center gap-4">
                                        <span className="font-bold text-primary">Search for "{query.toUpperCase()}"</span>
                                    </div>
                                    <span className="text-xs text-muted-foreground italic">Press Enter</span>
                                </button>
                            </CommandItem>
                        )}
                        {results.map((instrument) => (
                            <CommandItem
                                key={`${instrument.symbol}-${instrument.token}`}
                                value={`${instrument.symbol}-${instrument.token}`}
                                onSelect={() => handleSelect(instrument)}
                                className="p-0 m-0 w-full pointer-events-auto"
                            >
                                <button
                                    type="button"
                                    className="flex flex-1 items-center justify-between py-3 px-4 cursor-pointer hover:bg-accent group transition-colors w-full aria-selected:bg-accent focus:outline-none pointer-events-auto"
                                    onPointerDown={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleSelect(instrument);
                                    }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleSelect(instrument);
                                    }}
                                >
                                    <div className="flex items-center gap-4">
                                        <span className="font-bold text-base min-w-[100px] pointer-events-none">{instrument.symbol}</span>
                                        <span className="text-sm text-muted-foreground truncate max-w-[200px] hidden sm:block pointer-events-none">
                                            {instrument.name || instrument.symbol}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        {/* Action Buttons */}
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <div
                                                onClick={(e) => handleAddNew(e, instrument)}
                                                className={`p-1.5 rounded-md text-primary transition-colors ${canAddMore ? 'hover:bg-primary/20 cursor-pointer pointer-events-auto' : 'opacity-30 cursor-not-allowed pointer-events-none'}`}
                                                title={canAddMore ? "Open in New Chart" : "Max charts reached"}
                                            >
                                                <Plus size={16} strokeWidth={3} />
                                            </div>
                                        </div>
                                        
                                        <div className="flex items-center gap-2 pointer-events-none">
                                            <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground border">
                                                NSE
                                            </span>
                                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${(instrument.instrument_type || 'INDEX') === 'INDEX'
                                                ? 'bg-blue-500/10 text-blue-500 border-blue-500/20'
                                                : 'bg-orange-500/10 text-orange-500 border-orange-500/20'
                                                }`}>
                                                {instrument.instrument_type || 'INDEX'}
                                            </span>
                                        </div>
                                    </div>
                                </button>
                            </CommandItem>
                        ))}
                    </CommandGroup>
                )}
            </CommandList>
        </CommandDialog>
    );
};

export default SymbolSearch;
