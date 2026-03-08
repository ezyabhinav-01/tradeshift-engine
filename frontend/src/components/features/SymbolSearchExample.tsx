// Example: How to use SymbolSearch component in your app

import { useState } from 'react';
import { SymbolSearch } from './SymbolSearch';
import { useGame } from '../../context/GameContext';

export function ExampleUsage() {
    const { setSymbol, selectedSymbol } = useGame();
    const [open, setOpen] = useState(false);

    return (
        <div className="p-4">
            <h2 className="text-lg font-bold mb-4">Search for Instruments</h2>

            {/* Trigger Button */}
            <button
                onClick={() => setOpen(true)}
                className="px-4 py-2 rounded bg-secondary text-secondary-foreground border"
            >
                Search Symbol
            </button>

            {/* Search Dialog */}
            <SymbolSearch
                open={open}
                onOpenChange={setOpen}
                onSelect={setSymbol}
            />

            {/* Display Selected Symbol */}
            <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
                Selected: <strong>{selectedSymbol}</strong>
            </div>
        </div>
    );
}

// To integrate into your existing layout:
// 1. Import SymbolSearch component
// 2. Use the useGame hook to access setSymbol
// 3. Manage open/close state with useState
// 4. Add <SymbolSearch open={open} onOpenChange={setOpen} onSelect={setSymbol} />
// 5. The selected symbol will automatically update the game context
