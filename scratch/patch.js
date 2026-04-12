const fs = require('fs');

const file = '/Users/riteshkumarsingh/Desktop/tradeshift-engine/frontend/src/context/GameContext.tsx';
let data = fs.readFileSync(file, 'utf8');

// Find cancelOrder
const cancelStart = data.indexOf('  const cancelOrder = useCallback(async ');
const cancelEnd = data.indexOf('  }, [fetchActiveTrades, syncPortfolioNow]);', cancelStart) + 45;

const cancelCode = data.substring(cancelStart, cancelEnd);

// Remove cancelCode
data = data.substring(0, cancelStart) + data.substring(cancelEnd);

// Insert cancelCode before closePosition
const closeStart = data.indexOf('  const closePosition = useCallback(async ');
data = data.substring(0, closeStart) + cancelCode + '\n\n' + data.substring(closeStart);

// Clean up whitespace
fs.writeFileSync(file, data);
