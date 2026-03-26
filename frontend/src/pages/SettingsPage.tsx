import { Activity, AlertCircle } from 'lucide-react';
import { useGame } from '../hooks/useGame';


const SettingsPage = () => {
  const { speed, setSpeed, resetSimulation, userSettings, updateUserSettings } = useGame();
  return (
    <div className="p-8 w-full max-w-2xl mx-auto font-sans">
      <h2 className="text-2xl font-bold text-tv-text-primary mb-6">Settings</h2>

      <div className="space-y-6">

        {/* Simulation Speed Control */}
        <div className="bg-tv-bg-pane p-6 rounded-lg border border-tv-border">
          <div className="flex items-center gap-3 mb-4 text-tv-text-primary">
            <Activity className="text-tv-primary" />
            <h3 className="font-semibold">Simulation Speed</h3>
          </div>
          <p className="text-tv-text-secondary text-sm mb-4">Control how fast the historical data is replayed.</p>

          <div className="flex items-center gap-4">
            <input
              type="range"
              min="1"
              max="20"
              value={speed}
              onChange={(e) => setSpeed(parseInt(e.target.value))}
              className="flex-1 h-2 bg-tv-bg-base rounded-lg appearance-none cursor-pointer accent-tv-primary"
            />
            <span className="text-tv-text-primary font-mono w-12 text-right">{speed}x</span>
          </div>
        </div>

        {/* Risk Management */}
        <div className="bg-tv-bg-pane p-6 rounded-lg border border-tv-border">
          <div className="flex items-center gap-3 mb-4 text-tv-text-primary">
            <AlertCircle className="text-tv-primary" />
            <h3 className="font-semibold">Risk Management</h3>
          </div>
          <div className="space-y-4">
            <div className="flex flex-col gap-2">
              <label className="text-sm text-tv-text-secondary">Max Daily Loss (₹)</label>
              <input
                type="number"
                value={userSettings?.max_daily_loss || 5000}
                onChange={(e) => updateUserSettings({ max_daily_loss: parseFloat(e.target.value) })}
                className="bg-tv-bg-base text-tv-text-primary border border-tv-border rounded px-3 py-2 outline-none focus:border-tv-primary"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm text-tv-text-secondary">Max Order Quantity (Lots)</label>
              <input
                type="number"
                value={userSettings?.max_order_quantity || 100}
                onChange={(e) => updateUserSettings({ max_order_quantity: parseInt(e.target.value) })}
                className="bg-tv-bg-base text-tv-text-primary border border-tv-border rounded px-3 py-2 outline-none focus:border-tv-primary"
              />
            </div>
          </div>
        </div>

        {/* Trading Preferences */}
        <div className="bg-tv-bg-pane p-6 rounded-lg border border-tv-border">
          <div className="flex items-center gap-3 mb-4 text-tv-text-primary">
            <Activity className="text-tv-primary" />
            <h3 className="font-semibold">Trading Preferences</h3>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-tv-text-primary font-medium text-sm">One-Click Trading</p>
                <p className="text-tv-text-secondary text-xs">Execute trades immediately without confirmation</p>
              </div>
              <button
                onClick={() => updateUserSettings({ one_click_trading_enabled: !userSettings?.one_click_trading_enabled })}
                className={`w-12 h-6 rounded-full transition-colors relative ${userSettings?.one_click_trading_enabled ? 'bg-tv-primary' : 'bg-tv-border'}`}
              >
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${userSettings?.one_click_trading_enabled ? 'left-7' : 'left-1'}`} />
              </button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-tv-text-primary font-medium text-sm">Session Confirmation</p>
                <p className="text-tv-text-secondary text-xs">Require confirmation on first trade of session</p>
              </div>
              <button
                onClick={() => updateUserSettings({ require_session_confirmation: !userSettings?.require_session_confirmation })}
                className={`w-12 h-6 rounded-full transition-colors relative ${userSettings?.require_session_confirmation ? 'bg-tv-primary' : 'bg-tv-border'}`}
              >
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${userSettings?.require_session_confirmation ? 'left-7' : 'left-1'}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Reset Section */}
        <div className="bg-tv-bg-pane p-6 rounded-lg border border-tv-border">
          <div className="flex items-center gap-3 mb-4 text-tv-text-primary">
            <AlertCircle className="text-[#f23645]" />
            <h3 className="font-semibold">Danger Zone</h3>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-tv-text-secondary text-sm">Reset account balance and clear trade history.</p>
            <button
              onClick={resetSimulation}
              className="px-4 py-2 bg-[#f23645]/10 text-[#f23645] hover:bg-[#f23645]/20 border border-[#f23645]/20 rounded transition-colors text-sm font-medium"
            >
              Reset Simulation
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;