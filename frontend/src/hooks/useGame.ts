import { useContext } from 'react';
import { GameContext, useGameActions, useGameMarket, useGamePlayback, useGameTrades } from '../context/GameContext';

export const useGame = () => {
    const context = useContext(GameContext);
    if (!context) throw new Error("useGame must be used within GameProvider");
    return context;
};

export { useGameActions, useGameMarket, useGamePlayback, useGameTrades };
