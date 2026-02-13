import React, { useState, useEffect, useCallback } from 'react';
import {
    CommandDialog,
    CommandInput,
    CommandList,
    CommandEmpty,
    CommandGroup,
    CommandItem,
} from '../ui/command';

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

export const SymbolSearch: React.FC<SymbolSearchProps> = ({ open, onOpenChange, onSelect }) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<Instrument[]>([]);
    const [availableSymbols, setAvailableSymbols] = useState<Instrument[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // Fetch available symbols on mount with Mock Fallback
    useEffect(() => {
        const fetchAvailableSymbols = async () => {
            setIsLoading(true);
            try {
                // console.log("Fetching available symbols...");
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

                // Ensure we have data
                if (formattedSymbols.length === 0) throw new Error("No symbols returned by API");

                setAvailableSymbols(formattedSymbols);
                setResults(formattedSymbols);
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
        onSelect(instrument.symbol, instrument.token);
        setQuery('');
        onOpenChange(false);
    }, [onSelect, onOpenChange]);

    console.log('🔍 SymbolSearch render:', { open, availableSymbols: availableSymbols.length, results: results.length });

    return (
        <CommandDialog open={open} onOpenChange={onOpenChange}>
            <CommandInput
                placeholder="Search symbol (e.g., NIFTY)..."
                value={query}
                name="symbol-search"
                id="search-input"
                onChange={(e) => setQuery(e.target.value)}
            />
            <CommandList>
                {isLoading && (
                    <div className="py-6 text-center text-sm text-gray-500">Loading symbols...</div>
                )}

                {!isLoading && results.length === 0 ? (
                    <CommandEmpty>No results found for "{query}".</CommandEmpty>
                ) : (
                    <CommandGroup heading="Available Instruments">
                        {results.map((instrument) => (
                            <CommandItem
                                key={instrument.token}
                                onSelect={() => handleSelect(instrument)}
                                className="flex items-center justify-between py-3 px-4 cursor-pointer hover:bg-accent aria-selected:bg-accent"
                            >
                                <div className="flex items-center gap-4">
                                    <span className="font-bold text-base min-w-[100px]">{instrument.symbol}</span>
                                    <span className="text-sm text-muted-foreground truncate max-w-[200px] hidden sm:block">
                                        {instrument.name || instrument.symbol}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
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
                            </CommandItem>
                        ))}
                    </CommandGroup>
                )}
            </CommandList>
        </CommandDialog>
    );
};

export default SymbolSearch;
