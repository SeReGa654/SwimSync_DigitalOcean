"""Generator for Results Protocol (.docx) per specification.

11 columns: Місце, Доріжка, Прізвище та Ім'я, Рік Нар., Розряд, Команда,
            Регіон, Результат, Вик. розряд, Очки WA, Тренер
Time format: M.SS.ms (two dots)
Places: І, ІІ, ІІІ for 1-3; arabic 4+
PK entries shown after separator row.
Each age category → separate section.
"""

from io import BytesIO
from typing import List, Dict, Any, Optional
from docx import Document
from docx.shared import Pt, Cm
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

from utils.ms_format import ms_to_result_format
from docx_service_parser.zayvka_parser import STYLE_DISPLAY_UA, RANK_DISPLAY
from generator.start_protocol import (
    FONT_NAME, set_cell_text, set_column_widths, add_paragraph_styled, remove_table_borders
)

RESULT_COLUMN_WIDTHS = [
    Cm(1.2), Cm(5.0), Cm(1.4), Cm(1.3), Cm(3.0),
    Cm(2.0), Cm(1.8), Cm(1.5),
]
RESULT_HEADERS = [
    'Місце', "Прізвище та Ім'я", 'Рік Нар.', 'Розряд', 'Команда',
    'Результат', 'Вик. розр.', 'Очки WA',
]
RESULT_ALIGN = [
    WD_ALIGN_PARAGRAPH.CENTER,
    WD_ALIGN_PARAGRAPH.LEFT, WD_ALIGN_PARAGRAPH.CENTER,
    WD_ALIGN_PARAGRAPH.CENTER, WD_ALIGN_PARAGRAPH.LEFT,
    WD_ALIGN_PARAGRAPH.CENTER, WD_ALIGN_PARAGRAPH.CENTER,
    WD_ALIGN_PARAGRAPH.CENTER,
]

PLACE_ROMAN = {1: 'І', 2: 'ІІ', 3: 'ІІІ'}


def format_place(place: Optional[int], status: str) -> str:
    """Format place for display."""
    if status in ('DQ', 'DNS', 'DNF', 'PK'):
        return status if status != 'PK' else 'п/к'
    if place is None:
        return '—'
    return PLACE_ROMAN.get(place, str(place))


def generate_result_protocol(competition: Dict, events_data: List[Dict]) -> bytes:
    """Generate results protocol Word document.
    
    Args:
        competition: same as start protocol
        events_data: [{
            distance_m, style, gender, 
            age_groups: [{
                name, 
                results: [{
                    place, place_display, lane, full_name, birth_year, rank,
                    club, region, finish_time_ms, achieved_rank, points_wa, coach, status
                }]
            }]
        }]
    """
    doc = Document()

    for section in doc.sections:
        section.top_margin = Cm(1.5)
        section.bottom_margin = Cm(1.5)
        section.left_margin = Cm(1.5)
        section.right_margin = Cm(1.0)

    # Title
    add_paragraph_styled(doc, competition.get('name', ''), 12, bold=True,
                         alignment=WD_ALIGN_PARAGRAPH.CENTER)
    cats = competition.get('categories_str', '')
    if cats:
        add_paragraph_styled(doc, cats, 12, bold=True,
                             alignment=WD_ALIGN_PARAGRAPH.CENTER)

    # Date + Pool info
    date_str = competition.get('date_from', '')
    if competition.get('date_to') and competition['date_to'] != date_str:
        date_str += f" – {competition['date_to']}"
    pool_str = f"Басейн: {competition.get('pool_length', 50)} м"
    add_paragraph_styled(doc, f"{date_str}          {pool_str}", 11,
                         alignment=WD_ALIGN_PARAGRAPH.CENTER)

    add_paragraph_styled(doc, "Протокол результатів", 12, bold=True,
                         alignment=WD_ALIGN_PARAGRAPH.CENTER)

    for evt_idx, event in enumerate(events_data):
        if evt_idx > 0:
            doc.add_paragraph()

        gender_ua = 'Чол.' if event.get('gender') == 'M' else 'Жін.' if event.get('gender') == 'F' else 'Зміш.'
        style_ua = STYLE_DISPLAY_UA.get(event.get('style', ''), event.get('style', ''))

        for ag in event.get('age_groups', []):
            # Section title: distance + style + gender (age group name)
            ag_name = ag.get('name', '')
            title = f"{event['distance_m']}м {style_ua} {gender_ua}"
            if ag_name:
                title += f" ({ag_name})"
            add_paragraph_styled(doc, title, 11, bold=True, alignment=WD_ALIGN_PARAGRAPH.LEFT)

            # Table
            table = doc.add_table(rows=1, cols=8)
            remove_table_borders(table)
            set_column_widths(table, RESULT_COLUMN_WIDTHS)

            # Header
            hdr = table.rows[0].cells
            for i, h in enumerate(RESULT_HEADERS):
                set_cell_text(hdr[i], h, font_size=9, bold=True, align=RESULT_ALIGN[i])

            # Separate OK results and PK results
            ok_results = [r for r in ag.get('results', []) if r.get('status') != 'PK']
            pk_results = [r for r in ag.get('results', []) if r.get('status') == 'PK']

            for r in ok_results:
                row = table.add_row()
                cells = row.cells
                place_str = format_place(r.get('place'), r.get('status', 'OK'))
                place_val = r.get('place')
                is_place_bold = place_val is not None and place_val <= 3
                set_cell_text(cells[0], place_str, font_size=10, bold=is_place_bold,
                              align=WD_ALIGN_PARAGRAPH.CENTER)
                set_cell_text(cells[1], r.get('full_name', ''), font_size=10,
                              align=WD_ALIGN_PARAGRAPH.LEFT)
                by = r.get('birth_year')
                set_cell_text(cells[2], str(by) if by else '—', font_size=10,
                              align=WD_ALIGN_PARAGRAPH.CENTER)
                rk = r.get('rank', 'NONE')
                rank_display = RANK_DISPLAY.get(rk, rk) if rk else '—'
                set_cell_text(cells[3], rank_display, font_size=10,
                              align=WD_ALIGN_PARAGRAPH.CENTER)
                set_cell_text(cells[4], r.get('club', ''), font_size=10,
                              align=WD_ALIGN_PARAGRAPH.LEFT)

                if r.get('status') in ('DQ', 'DNS', 'DNF'):
                    txt = r['status']
                    if r.get('dq_reason'):
                        txt += f" ({r['dq_reason']})"
                    set_cell_text(cells[5], txt, font_size=10,
                                  align=WD_ALIGN_PARAGRAPH.CENTER)
                else:
                    set_cell_text(cells[5], ms_to_result_format(r.get('finish_time_ms')),
                                  font_size=10, align=WD_ALIGN_PARAGRAPH.CENTER)

                ach_rank = RANK_DISPLAY.get(r.get('achieved_rank', ''), r.get('achieved_rank', '') or '')
                set_cell_text(cells[6], ach_rank, font_size=10,
                              align=WD_ALIGN_PARAGRAPH.CENTER)
                pts = str(r.get('points_wa', '') or '')
                set_cell_text(cells[7], pts, font_size=10,
                              align=WD_ALIGN_PARAGRAPH.CENTER)

            # PK separator and entries
            if pk_results:
                sep_row = table.add_row()
                merged = sep_row.cells[0].merge(sep_row.cells[7])
                set_cell_text(merged, '', font_size=6)

                for r in pk_results:
                    row = table.add_row()
                    cells = row.cells
                    set_cell_text(cells[0], 'п/к', font_size=10,
                                  align=WD_ALIGN_PARAGRAPH.CENTER)
                    set_cell_text(cells[1], r.get('full_name', ''), font_size=10,
                                  align=WD_ALIGN_PARAGRAPH.LEFT)
                    by = r.get('birth_year')
                    set_cell_text(cells[2], str(by) if by else '—', font_size=10,
                                  align=WD_ALIGN_PARAGRAPH.CENTER)
                    rk = r.get('rank', 'NONE')
                    rank_display = RANK_DISPLAY.get(rk, rk) if rk else '—'
                    set_cell_text(cells[3], rank_display, font_size=10,
                                  align=WD_ALIGN_PARAGRAPH.CENTER)
                    set_cell_text(cells[4], r.get('club', ''), font_size=10,
                                  align=WD_ALIGN_PARAGRAPH.LEFT)
                    set_cell_text(cells[5], ms_to_result_format(r.get('finish_time_ms')),
                                  font_size=10, align=WD_ALIGN_PARAGRAPH.CENTER)
                    ach_rank = RANK_DISPLAY.get(r.get('achieved_rank', ''), r.get('achieved_rank', '') or '')
                    set_cell_text(cells[6], ach_rank, font_size=10,
                                  align=WD_ALIGN_PARAGRAPH.CENTER)
                    pts = str(r.get('points_wa', '') or '')
                    set_cell_text(cells[7], pts, font_size=10,
                                  align=WD_ALIGN_PARAGRAPH.CENTER)

    buffer = BytesIO()
    doc.save(buffer)
    return buffer.getvalue()
