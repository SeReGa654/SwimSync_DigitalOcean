"""Time conversion utilities for swimming times.

All times stored in database as INT milliseconds.
Display formats:
  - Start protocol (Word):  M:SS.ms  (e.g., 0:42.00, 1:10.10)
  - Results protocol (Word): M.SS.ms  (e.g., 1.06.67)
  - CSV import format:       M.SS,ms  (e.g., 1.10,1)
  - Frontend UI:             M:SS.ms  (e.g., 1:10.10)
"""

import re
from typing import Optional


def parse_time(raw: str) -> Optional[int]:
    """Parse various time formats into milliseconds.
    
    Supports: M.SS,ms | M,SS,ms | M:SS.ms | M.SS.ms | SS.ms | SS,ms
    """
    if not raw or raw.strip().upper() in ('NT', '', '-', '—'):
        return None

    s = raw.strip()
    has_colon = ':' in s
    # Split by any of . , :
    tokens = re.split(r'[.,:]', s)
    tokens = [t.strip() for t in tokens if t.strip() != '']

    try:
        if len(tokens) >= 3:
            minutes = int(tokens[0])
            seconds = int(tokens[1])
            hundredths_str = tokens[2].ljust(2, '0')[:2]
            hundredths = int(hundredths_str)
            if minutes < 0 or seconds < 0 or seconds >= 60 or hundredths < 0 or hundredths > 99:
                return None
            return minutes * 60000 + seconds * 1000 + hundredths * 10
        elif len(tokens) == 2:
            p1 = int(tokens[0])
            p2_str = tokens[1].ljust(2, '0')[:2]
            p2 = int(p2_str)
            if p1 < 0 or p2 < 0:
                return None
            if has_colon:
                if p2 >= 60:
                    return None
                return p1 * 60000 + p2 * 1000
            return p1 * 1000 + p2 * 10
        elif len(tokens) == 1:
            seconds = int(tokens[0])
            if seconds < 0:
                return None
            return seconds * 1000
    except ValueError:
        return None
    return None


def ms_to_start_format(ms: Optional[int]) -> str:
    """Convert ms to start protocol format: M:SS.ms or SS.ms"""
    if ms is None:
        return "NT"
    total_sec = ms // 1000
    hundredths = (ms % 1000) // 10
    minutes = total_sec // 60
    seconds = total_sec % 60
    if minutes > 0:
        return f"{minutes}:{seconds:02d}.{hundredths:02d}"
    return f"{seconds:02d}.{hundredths:02d}"


def ms_to_result_format(ms: Optional[int]) -> str:
    """Convert ms to results protocol format: M.SS.ms or SS.ms"""
    if ms is None:
        return "NT"
    total_sec = ms // 1000
    hundredths = (ms % 1000) // 10
    minutes = total_sec // 60
    seconds = total_sec % 60
    if minutes > 0:
        return f"{minutes}.{seconds:02d}.{hundredths:02d}"
    return f"{seconds:02d}.{hundredths:02d}"


def ms_to_csv_format(ms: Optional[int]) -> str:
    """Convert ms to CSV import format: M.SS,ms"""
    if ms is None:
        return "NT"
    total_sec = ms // 1000
    hundredths = (ms % 1000) // 10
    minutes = total_sec // 60
    seconds = total_sec % 60
    return f"{minutes}.{seconds:02d},{hundredths:02d}"
