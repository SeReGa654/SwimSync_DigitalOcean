"""Parser for .docx team application files (Іменна заявка).

Standard structure: table with 10 columns.
"""

import re
from typing import List, Dict, Any, Optional
from docx import Document

from utils.ms_format import parse_time

# Rank normalization mapping
RANK_MAP = {
    'мсмк': 'MSMK', 'msмк': 'MSMK',
    'мс': 'MS', 'мсу': 'MS',
    'кмсу': 'KMSU', 'кмс': 'KMSU',
    '1': 'R1', 'і': 'R1', 'i': 'R1',
    '2': 'R2', 'іі': 'R2', 'ii': 'R2',
    '3': 'R3', 'ііі': 'R3', 'iii': 'R3',
    '1-ю': 'Y1', '1-ю.': 'Y1', '1 -ю': 'Y1', '1ю': 'Y1', '1ю.': 'Y1',
    'і юн': 'Y1', 'і юн.': 'Y1', 'i юн': 'Y1', 'i юн.': 'Y1',
    '2-ю': 'Y2', '2-ю.': 'Y2', 'іі юн': 'Y2', 'іі юн.': 'Y2', 'ii юн': 'Y2', 'ii юн.': 'Y2',
    '3-ю': 'Y3', '3-ю.': 'Y3', 'ііі юн': 'Y3', 'ііі юн.': 'Y3', 'iii юн': 'Y3', 'iii юн.': 'Y3',
}

# Style normalization mapping
STYLE_MAP = {
    'в/с': 'FREE', 'в.с': 'FREE', 'вільн': 'FREE', 'вільний': 'FREE', 'free': 'FREE', 'freestyle': 'FREE',
    'брас': 'BREAST', 'breast': 'BREAST', 'breaststroke': 'BREAST',
    'н/с': 'BACK', 'н.с': 'BACK', 'на спині': 'BACK', 'спин': 'BACK', 'back': 'BACK', 'backstroke': 'BACK',
    'бат': 'FLY', 'батерф': 'FLY', 'батерфляй': 'FLY', 'fly': 'FLY', 'butterfly': 'FLY', 'метелик': 'FLY',
    'к/п': 'MEDLEY', 'к.п': 'MEDLEY', 'компл': 'MEDLEY', 'комплексне': 'MEDLEY',
    'medley': 'MEDLEY', 'im': 'MEDLEY',
}

# Rank display names
RANK_DISPLAY = {
    'MSMK': 'МСМК', 'MS': 'МС', 'KMSU': 'КМСУ',
    'R1': 'І', 'R2': 'ІІ', 'R3': 'ІІІ',
    'Y1': 'І юн.', 'Y2': 'ІІ юн.', 'Y3': 'ІІІ юн.',
    'NONE': '—',
}

STYLE_DISPLAY_UA = {
    'FREE': 'Вільний стиль', 'BREAST': 'Брас', 'BACK': 'На спині',
    'FLY': 'Батерфляй', 'MEDLEY': 'Комплексне плавання',
    'Freestyle': 'Вільний стиль', 'Breaststroke': 'Брас',
    'Backstroke': 'На спині', 'Butterfly': 'Батерфляй', 'Medley': 'Комплексне плавання',
}

OUT_OF_COMPETITION_RE = re.compile(r'(поза\s+конкурс|п\/к|\(пк\)|\bпк\b)', re.IGNORECASE)


def normalize_rank(raw: str) -> str:
    """Normalize rank string to enum value."""
    if not raw:
        return 'NONE'
    s = raw.strip().lower()
    # Try exact match
    if s in RANK_MAP:
        return RANK_MAP[s]
    # Try partial match
    for key, val in RANK_MAP.items():
        if key in s:
            return val
    return 'NONE'


def parse_distance(raw: str) -> Optional[Dict[str, Any]]:
    """Parse distance string like '50 в/с' or '100м брас' into {distance_m, style}."""
    if not raw:
        return None
    s = raw.strip().lower()
    is_out_of_competition = bool(OUT_OF_COMPETITION_RE.search(s))
    # Extract distance number
    match = re.search(r'(\d+)', s)
    if not match:
        return None
    distance_m = int(match.group(1))
    # Extract style
    remaining = re.sub(r'\d+\s*м?\s*', '', s).strip()
    style = None
    for key, val in STYLE_MAP.items():
        if key in remaining:
            style = val
            break
    if not style:
        # Fallback — try to find in the whole string
        for key, val in STYLE_MAP.items():
            if key in s:
                style = val
                break
    if not style:
        return None
    return {'distance_m': distance_m, 'style': style, 'is_out_of_competition': is_out_of_competition}


def is_suspicious_time(ms: int, distance_m: int) -> bool:
    """Check if a time is physically impossible / too fast."""
    minimums = {50: 20000, 100: 45000, 200: 100000, 400: 220000, 800: 460000, 1500: 870000}
    min_time = minimums.get(distance_m, 15000)
    return ms < min_time


def parse_zayvka(file_bytes: bytes) -> Dict[str, Any]:
    """Parse a .docx team application (Іменна заявка).
    
    Returns:
    {
        team_name: str,
        athletes: [{last_name, first_name, birth_year, rank, coach, club, region, doctor_approved}],
        entries: [{athlete_index, distance_m, style, entry_time_ms}],
        warnings: [{row, field, message}],
        errors: [{row, message}],
    }
    """
    from io import BytesIO
    doc = Document(BytesIO(file_bytes))
    
    result = {
        'team_name': '',
        'athletes': [],
        'entries': [],
        'warnings': [],
        'errors': [],
    }
    
    # STEP 1 — Extract team metadata from header paragraphs
    for para in doc.paragraphs:
        text = para.text.strip()
        if 'ВІД КОМАНДИ' in text.upper() or 'ІМЕННА ЗАЯВКА' in text.upper():
            # Try to find team name in this or next paragraph
            # Often it's underlined text or the text after "від команди"
            match = re.search(r'(?:від команди|ВІД КОМАНДИ)\s*[:\-]?\s*(.+)', text, re.IGNORECASE)
            if match:
                result['team_name'] = match.group(1).strip().strip('"').strip('«').strip('»')
            continue
        # If team_name still empty, try to find it from underlined runs
        if not result['team_name']:
            for run in para.runs:
                if run.underline and run.text.strip():
                    result['team_name'] = run.text.strip()
                    break
    
    # STEP 2 — Find the main table
    target_table = None
    for table in doc.tables:
        if len(table.columns) >= 9:
            # Check header row for known keywords
            header_text = ' '.join(cell.text.lower() for cell in table.rows[0].cells)
            if any(kw in header_text for kw in ['прізвище', 'дата народж', 'дистанц', 'рік']):
                target_table = table
                break
    
    if not target_table:
        # Fallback: use first table with >= 9 columns
        for table in doc.tables:
            if len(table.columns) >= 9:
                target_table = table
                break
    
    if not target_table:
        result['errors'].append({'row': 0, 'message': 'Не вдалося знайти таблицю заявки'})
        return result
    
    # Try to detect gender from document context (headers before table)
    doc_gender = 'M'  # default
    full_text = '\n'.join(p.text for p in doc.paragraphs).lower()
    if any(kw in full_text for kw in ['дівчат', 'жін', 'дівчата', 'жінки', 'жіноч', 'women', 'female', 'girls']):
        if not any(kw in full_text for kw in ['хлопц', 'чолов', 'юнак', 'men', 'male', 'boys']):
            doc_gender = 'F'
    
    # STEP 3 — Parse table rows (skip header)
    for row_idx, row in enumerate(target_table.rows[1:], start=1):
        cells = row.cells
        if len(cells) < 9:
            continue
        
        try:
            # col[0] → № (skip)
            # col[1] → Last name + First name
            name_raw = cells[1].text.strip()
            if not name_raw or name_raw.isdigit():
                continue
            name_parts = name_raw.split()
            last_name = name_parts[0] if len(name_parts) > 0 else ''
            first_name = ' '.join(name_parts[1:]) if len(name_parts) > 1 else ''
            
            # col[2] → birth_year
            birth_year_raw = cells[2].text.strip()
            birth_year_match = re.search(r'\d{4}', birth_year_raw)
            if not birth_year_match:
                result['errors'].append({'row': row_idx, 'message': f'Рік народження не розпізнано: "{birth_year_raw}"'})
                continue
            birth_year = int(birth_year_match.group())
            
            # col[3] → rank
            rank_raw = cells[3].text.strip()
            rank = normalize_rank(rank_raw)
            if rank == 'NONE' and rank_raw:
                result['warnings'].append({
                    'row': row_idx, 'field': 'rank',
                    'message': f'Розряд не розпізнано: "{rank_raw}"'
                })
            
            # col[4] → distances (multiline)
            dist_cell = cells[4]
            distances_raw = [p.text.strip() for p in dist_cell.paragraphs if p.text.strip()]
            normalized_distances: List[str] = []
            for dist_text in distances_raw:
                has_distance = re.search(r'\d+', dist_text) is not None
                has_marker_only = OUT_OF_COMPETITION_RE.search(dist_text) and not has_distance
                if has_marker_only and normalized_distances:
                    normalized_distances[-1] = f"{normalized_distances[-1]} {dist_text}".strip()
                    continue
                normalized_distances.append(dist_text)
            distances_raw = normalized_distances
            
            # col[5] → times (multiline)
            time_cell = cells[5]
            times_raw = [p.text.strip() for p in time_cell.paragraphs if p.text.strip()]
            
            # col[6] → club
            club = cells[6].text.strip() if len(cells) > 6 else ''
            
            # col[7] → region
            region = cells[7].text.strip() if len(cells) > 7 else ''
            
            # col[8] → coach
            coach = cells[8].text.strip() if len(cells) > 8 else ''
            
            # col[9] → doctor_approved
            doctor_approved = False
            if len(cells) > 9:
                doc_text = cells[9].text.strip().lower()
                doctor_approved = bool(doc_text) and doc_text not in ('ні', 'no', 'false', '0', '-')
            
            # Check distance/time count match
            if len(distances_raw) != len(times_raw):
                result['warnings'].append({
                    'row': row_idx, 'field': 'distances',
                    'message': f'Кількість дистанцій ({len(distances_raw)}) ≠ часів ({len(times_raw)})'
                })
            
            # Create athlete
            # Try to detect gender from an extra column or from doc context
            row_gender = doc_gender
            gender_found_in_cols = False
            # Look at all columns for gender hints (only for short columns to avoid matching Names/Cities etc)
            for ci in range(len(cells)):
                c_text = cells[ci].text.strip().lower()
                if len(c_text) < 15:
                    # Check for male indicators
                    if re.search(r'\b(ч|ch|m|хл|хлоп|male|men|чол)\b', c_text) or c_text == 'чол' or c_text == 'ч':
                        row_gender = 'M'
                        gender_found_in_cols = True
                        break
                    # Check for female indicators
                    elif re.search(r'\b(ж|zh|f|дів|дівч|female|women|жін)\b', c_text) or c_text == 'жін' or c_text == 'ж':
                        row_gender = 'F'
                        gender_found_in_cols = True
                        break
            
            if not gender_found_in_cols:
                # Use name heuristics for Ukrainian names
                fn = first_name.strip().lower()
                ln = last_name.strip().lower()
                if fn:
                    if fn.endswith('а') or fn.endswith('я'):
                        if fn not in ['ілля', 'микола', 'микита', 'сава', 'кузьма', 'лука', 'хома', 'ілля']:
                            row_gender = 'F'
                        else:
                            row_gender = 'M'
                    else:
                        row_gender = 'M'
                elif ln:
                    if ln.endswith('ва') or ln.endswith('на') or ln.endswith('ка') or ln.endswith('ая'):
                        row_gender = 'F'
            
            athlete_data = {
                'last_name': last_name,
                'first_name': first_name,
                'birth_year': birth_year,
                'gender': row_gender,
                'rank': rank,
                'rank_raw': rank_raw,
                'coach': coach,
                'club': club,
                'region': region,
                'doctor_approved': doctor_approved,
            }
            athlete_index = len(result['athletes'])
            result['athletes'].append(athlete_data)
            
            # Create entries
            for i, dist_raw in enumerate(distances_raw):
                time_raw = times_raw[i] if i < len(times_raw) else ''
                
                parsed_dist = parse_distance(dist_raw)
                if not parsed_dist:
                    result['warnings'].append({
                        'row': row_idx, 'field': 'distance',
                        'message': f'Дистанція не розпізнана: "{dist_raw}"'
                    })
                    continue
                
                entry_time_ms = parse_time(time_raw)
                if entry_time_ms is None and time_raw and time_raw.upper() != 'NT':
                    result['warnings'].append({
                        'row': row_idx, 'field': 'time',
                        'message': f'Час не розпізнано: "{time_raw}"'
                    })
                
                if entry_time_ms is not None and is_suspicious_time(entry_time_ms, parsed_dist['distance_m']):
                    result['warnings'].append({
                        'row': row_idx, 'field': 'time',
                        'message': f'Фізично неможливий час: {time_raw} для {dist_raw}'
                    })
                
                result['entries'].append({
                    'athlete_index': athlete_index,
                    'distance_m': parsed_dist['distance_m'],
                    'style': parsed_dist['style'],
                    'gender': row_gender,
                    'entry_time_ms': entry_time_ms,
                    'is_out_of_competition': parsed_dist.get('is_out_of_competition', False),
                    'distance_raw': dist_raw,
                    'time_raw': time_raw,
                })
        
        except Exception as e:
            result['errors'].append({'row': row_idx, 'message': f'Помилка парсингу рядка: {str(e)}'})
    
    return result
