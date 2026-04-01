import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'app'))
from simulation import TickSynthesizer

syn = TickSynthesizer()
# Test generating ticks for a typical candle
ticks = syn.generate_ticks(100.0, 105.0, 95.0, 102.0, num_ticks=60)
print(f"Candle 1 ticks: {ticks[:5]} ... {ticks[-5:]}")

# Test edge case: doji (0 range)
ticks = syn.generate_ticks(100.0, 100.0, 100.0, 100.0, num_ticks=60)
print(f"Candle 2 ticks (Doji): {ticks[:5]} ... {ticks[-5:]}")
