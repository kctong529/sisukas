# Heatmap Projection (planned)

Input:
- segments: Segment[] from intervalOverlap
- timezone: e.g. Europe/Helsinki
- weekStart: ISO datetime (or derived from a date)
- binMinutes: 15/30/60
- intensityFn: dt * max(0, concurrent - 1) by default

Output:
- grid[7][binsPerDay] = accumulated intensity
- optionally: normalization metadata (max cell value, total conflict load, etc.)

Notes:
- Must handle DST weeks (23/25 hours) intentionally.
- Should clip segments to the chosen week window.
