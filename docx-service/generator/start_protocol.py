"""Generator for Start Protocol (.docx) per specification.

Page: Portrait, margins 15/15/20/15 mm
Font: Times New Roman 11pt (headers 12pt Bold)
Time format: M:SS.ms (colon between minutes/seconds)
Heat headers: merged cells, bold, centered
"""

from io import BytesIO
from typing import List, Dict, Any, Optional
from docx import Document
from docx.shared import Pt, Cm, Emu
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

from utils.ms_format import ms_to_start_format
from docx_service_parser.zayvka_parser import STYLE_DISPLAY_UA

FONT_NAME = 'Times New Roman'

COLUMN_WIDTHS = [Cm(1.5), Cm(5.5), Cm(2.5), Cm(1.8), Cm(2.2), Cm(5.0)]
COLUMN_HEADERS = ['Доріжка', "Прізвище та Ім'я", 'Вікова Група', 'Рік Нар.', 'Заяв. Рез', 'Тренер']
COLUMN_ALIGN = [
    WD_ALIGN_PARAGRAPH.CENTER,
    WD_ALIGN_PARAGRAPH.LEFT,
    WD_ALIGN_PARAGRAPH.CENTER,
    WD_ALIGN_PARAGRAPH.CENTER,
    WD_ALIGN_PARAGRAPH.CENTER,
    WD_ALIGN_PARAGRAPH.LEFT,
]


def set_cell_font(cell, font_name=FONT_NAME, font_size=11, bold=False, align=None):
    """Set font properties for a table cell."""
    for paragraph in cell.paragraphs:
        if align is not None:
            paragraph.alignment = align
        paragraph.paragraph_format.space_before = Pt(0)
        paragraph.paragraph_format.space_after = Pt(0)
        for run in paragraph.runs:
            run.font.name = font_name
            run.font.size = Pt(font_size)
            run.bold = bold
            rFonts = run._element.rPr
            if rFonts is None:
                rFonts = OxmlElement('w:rPr')
                run._element.append(rFonts)
            rFont = OxmlElement('w:rFonts')
            rFont.set(qn('w:eastAsia'), font_name)
            rFont.set(qn('w:cs'), font_name)


def set_cell_text(cell, text, font_name=FONT_NAME, font_size=11, bold=False, align=None):
    """Set text in cell with formatting."""
    cell.text = text
    set_cell_font(cell, font_name, font_size, bold, align)

def format_entry_name(entry: Dict[str, Any]) -> str:
    name = entry.get('full_name', '')
    if entry.get('is_out_of_competition'):
        return f"{name} (ПК)" if name else 'ПК'
    return name


def set_column_widths(table, widths):
    """Set column widths on a table."""
    for row in table.rows:
        for i, cell in enumerate(row.cells):
            if i < len(widths):
                cell.width = widths[i]


def add_paragraph_styled(doc, text, font_size=11, bold=False, underline=False, alignment=None):
    """Add a paragraph with styling."""
    p = doc.add_paragraph()
    run = p.add_run(text)
    run.font.name = FONT_NAME
    run.font.size = Pt(font_size)
    run.bold = bold
    run.underline = underline
    if alignment:
        p.alignment = alignment
    p.paragraph_format.space_before = Pt(2)
    p.paragraph_format.space_after = Pt(2)
    return p


"""
def remove_table_borders(table):
    tbl = table._tbl
    tblPr = tbl.tblPr if tbl.tblPr is not None else OxmlElement('w:tblPr')
    borders = OxmlElement('w:tblBorders')
    for border_name in ['top', 'left', 'bottom', 'right']:
        border = OxmlElement(f'w:{border_name}')
        border.set(qn('w:val'), 'none')
        border.set(qn('w:sz'), '0')
        border.set(qn('w:space'), '0')
        border.set(qn('w:color'), 'auto')
        borders.append(border)
    for border_name in ['insideH', 'insideV']:
        border = OxmlElement(f'w:{border_name}')
        border.set(qn('w:val'), 'single')
        border.set(qn('w:sz'), '4')
        border.set(qn('w:space'), '0')
        border.set(qn('w:color'), '999999')
        borders.append(border)
    tblPr.append(borders)
    
"""


def remove_table_borders(table):
    """Remove ALL table borders (outer and inner)."""
    tbl = table._tbl
    tblPr = tbl.tblPr if tbl.tblPr is not None else OxmlElement('w:tblPr')
    borders = OxmlElement('w:tblBorders')
    
    # Додаємо 'insideH' та 'insideV' до списку разом із зовнішніми межами
    for border_name in ['top', 'left', 'bottom', 'right', 'insideH', 'insideV']:
        border = OxmlElement(f'w:{border_name}')
        border.set(qn('w:val'), 'none')  # 'none' робить лінію повністю невидимою
        border.set(qn('w:sz'), '0')      # товщина 0
        border.set(qn('w:space'), '0')
        border.set(qn('w:color'), 'auto')
        borders.append(border)        
    tblPr.append(borders)


def generate_start_protocol(competition: Dict, events_data: List[Dict]) -> bytes:
    """Generate start protocol Word document.
    
    Args:
        competition: {name, categories_str, location, venue, pool_length, date_from, date_to}
        events_data: [{distance_m, style, gender, heats: [{number, entries: [{lane, full_name, age_group, birth_year, entry_time_ms, coach}]}]}]
    
    Returns: .docx file as bytes
    """
    doc = Document()

    # Page margins
    for section in doc.sections:
        section.top_margin = Cm(1.5)
        section.bottom_margin = Cm(1.5)
        section.left_margin = Cm(2.0)
        section.right_margin = Cm(1.5)

    # Title
    add_paragraph_styled(doc, competition.get('name', ''), 12, bold=True,
                         alignment=WD_ALIGN_PARAGRAPH.CENTER)

    # Categories
    cats = competition.get('categories_str', '')
    if cats:
        add_paragraph_styled(doc, cats, 12, bold=True,
                             alignment=WD_ALIGN_PARAGRAPH.CENTER)

    # Date + Pool
    date_str = competition.get('date_from', '')
    if competition.get('date_to') and competition['date_to'] != date_str:
        date_str += f" – {competition['date_to']}"
    pool_str = f"Басейн: {competition.get('pool_length', 50)} м"
    venue = competition.get('venue', '')
    location = competition.get('location', '')

    info_text = f"{date_str}          {pool_str}"
    add_paragraph_styled(doc, info_text, 11, alignment=WD_ALIGN_PARAGRAPH.CENTER)
    if location or venue:
        add_paragraph_styled(doc, f"{location} {venue}".strip(), 11,
                             alignment=WD_ALIGN_PARAGRAPH.CENTER)

    # "Стартовий протокол"
    add_paragraph_styled(doc, "Стартовий протокол", 12, bold=True,
                         alignment=WD_ALIGN_PARAGRAPH.CENTER)

    # "День проведення" — bold, underlined
    day_date = competition.get('date_from', '')
    add_paragraph_styled(doc, f"День проведення: {day_date}", 12,
                         bold=True, underline=True,
                         alignment=WD_ALIGN_PARAGRAPH.CENTER)

    for evt_idx, event in enumerate(events_data):
        # Empty line between events (except first)
        if evt_idx > 0:
            doc.add_paragraph()

        # Event title
        gender_ua = 'Чол.' if event.get('gender') == 'M' else 'Жін.' if event.get('gender') == 'F' else 'Зміш.'
        style_ua = STYLE_DISPLAY_UA.get(event.get('style', ''), event.get('style', ''))
        add_paragraph_styled(
            doc, f"{event['distance_m']}м {style_ua} {gender_ua}",
            11, bold=True, alignment=WD_ALIGN_PARAGRAPH.LEFT
        )

        # Create table
        table = doc.add_table(rows=1, cols=6)
        remove_table_borders(table)
        set_column_widths(table, COLUMN_WIDTHS)

        # Header row
        hdr_cells = table.rows[0].cells
        for i, header in enumerate(COLUMN_HEADERS):
            set_cell_text(hdr_cells[i], header, bold=True, align=COLUMN_ALIGN[i])

        # Heats
        for heat in event.get('heats', []):
            # Heat header — merged row
            hdr_row = table.add_row()
            merged = hdr_row.cells[0].merge(hdr_row.cells[5])
            set_cell_text(merged, f"Заплив № {heat['number']}", bold=True,
                          align=WD_ALIGN_PARAGRAPH.CENTER)

            # Entries
            for entry in heat.get('entries', []):
                row = table.add_row()
                set_cell_text(row.cells[0], str(entry.get('lane', '')),
                              align=WD_ALIGN_PARAGRAPH.CENTER)
                set_cell_text(row.cells[1], format_entry_name(entry),
                              align=WD_ALIGN_PARAGRAPH.LEFT)
                set_cell_text(row.cells[2], entry.get('age_group', ''),
                              align=WD_ALIGN_PARAGRAPH.CENTER)
                set_cell_text(row.cells[3], str(entry.get('birth_year', '')),
                              align=WD_ALIGN_PARAGRAPH.CENTER)
                set_cell_text(row.cells[4], ms_to_start_format(entry.get('entry_time_ms')),
                              align=WD_ALIGN_PARAGRAPH.CENTER)
                set_cell_text(row.cells[5], entry.get('coach', ''),
                              align=WD_ALIGN_PARAGRAPH.LEFT)

    # Serialize to bytes
    buffer = BytesIO()
    doc.save(buffer)
    return buffer.getvalue()
