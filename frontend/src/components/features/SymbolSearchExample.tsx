// Example: How to use SymbolSearch component in your app


import { SymbolSearch } from './components/features/SymbolSearch';
import { useGame } from './context/GameContext';

export function ExampleUsage() {
    const { setSymbol, selectedSymbol, selectedToken } = useGame();

    return (
        <div className="p-4">
            <h2 className="text-lg font-bold mb-4">Search for Instruments</h2>

            {/* Search Component */}
            <SymbolSearch
                onSelect={setSymbol}
                className="max-w-md"
            />

            {/* Display Selected Symbol */}
            <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
                Selected: <strong>{selectedSymbol}</strong> (Token: {selectedToken})
            </div>
        </div>
    );
}

// To integrate into your existing layout:
// 1. Import SymbolSearch component
// 2. Use the useGame hook to access setSymbol
// 3. Add <SymbolSearch onSelect={setSymbol} /> wherever you want the search UI
// 4. The selected symbol and token will automatically update the game context
