"""Draws the evidence summary PDF.

The bundled Noto Sans fonts (SIL Open Font License, see fonts/OFL.txt) cover English and the
scripts of the website's six other languages (Devanagari for Hindi and Marathi, Bengali, Tamil,
Telugu, Gujarati). HarfBuzz shapes them so vowel signs and conjuncts come out right. Only the
fonts a document needs are loaded, which keeps making a PDF fast.
"""

from datetime import datetime
from pathlib import Path

from fpdf import FPDF

from app.models import DossierText, Entity, EvidenceHash

_FONTS = Path(__file__).parent / "fonts"
# The order the details are read out to the helpline (the UTR is what they ask for first).
_ORDER = ("utr", "upi", "amount", "datetime", "phone", "link")

# Fonts for the other scripts: (font name, file name, first and last character of the script).
_SCRIPT_FONTS = (
    ("NotoHi", "NotoSansDevanagari-devanagari", 0x0900, 0x097F),
    ("NotoBn", "NotoSansBengali", 0x0980, 0x09FF),
    ("NotoGu", "NotoSansGujarati", 0x0A80, 0x0AFF),
    ("NotoTa", "NotoSansTamil", 0x0B80, 0x0BFF),
    ("NotoTe", "NotoSansTelugu", 0x0C00, 0x0C7F),
)

_GREY, _LIGHT, _WARNING, _ACCENT = (90, 100, 120), (238, 242, 250), (253, 236, 234), (30, 64, 175)


def _stamp(moment: datetime) -> str:
    return moment.strftime("%Y-%m-%d %H:%M UTC")


class _Document(FPDF):
    def __init__(self, generated_at: datetime, words: str) -> None:
        super().__init__(format="A4")
        self.generated_at = generated_at
        self._add_family("Noto", "NotoSansDevanagari-latin")
        needed = [
            (family, file)
            for family, file, first, last in _SCRIPT_FONTS
            if any(first <= ord(char) <= last for char in words)
        ]
        for family, file in needed:
            self._add_family(family, file)
        self.set_text_shaping(True)
        self.set_fallback_fonts([family for family, _ in needed])
        self.set_margins(18, 18, 18)
        self.set_auto_page_break(True, margin=20)
        self.set_creation_date(generated_at)
        self.set_creator("Kavach")

    def _add_family(self, family: str, file: str) -> None:
        for style, weight in (("", "Regular"), ("B", "Bold")):
            self.add_font(family, style, str(_FONTS / f"{file}-{weight}.ttf"))

    def footer(self) -> None:
        self.set_y(-14)
        self.set_font("Noto", "", 8)
        self.set_text_color(*_GREY)
        self.cell(0, 6, f"Kavach  |  {_stamp(self.generated_at)}  |  {self.page_no()}", align="C")

    def heading(self, words: str) -> None:
        self.ln(4)
        self.set_font("Noto", "B", 13)
        self.set_text_color(*_ACCENT)
        self.multi_cell(0, 7, words, new_x="LMARGIN", new_y="NEXT")

    def paragraph(
        self, words: str, *, size: int = 11, bold: bool = False, grey: bool = False
    ) -> None:
        self.set_font("Noto", "B" if bold else "", size)
        self.set_text_color(*(_GREY if grey else (20, 24, 40)))
        self.multi_cell(0, 6, words, new_x="LMARGIN", new_y="NEXT")

    def box(self, words: str, fill: tuple[int, int, int], *, bold: bool = False) -> None:
        self.set_fill_color(*fill)
        self.set_font("Noto", "B" if bold else "", 11)
        self.set_text_color(20, 24, 40)
        self.multi_cell(0, 6, words, fill=True, padding=3, new_x="LMARGIN", new_y="NEXT")


def _all_words(text: DossierText, details: list[Entity], evidence: list[EvidenceHash]) -> str:
    """Every string that will be drawn, to see which scripts the document needs."""
    return " ".join(
        [
            *text.model_dump(exclude={"detail_labels"}).values(),
            *text.detail_labels.values(),
            *(entity.value for entity in details),
            *(item.name for item in evidence),
        ]
    )


def render_dossier(
    text: DossierText,
    details: list[Entity],
    evidence: list[EvidenceHash],
    generated_at: datetime,
) -> bytes:
    """`details` must be what the person confirmed; `evidence` what the server recorded."""
    pdf = _Document(generated_at, _all_words(text, details, evidence))
    pdf.set_title(text.title)
    pdf.add_page()

    pdf.set_font("Noto", "B", 20)
    pdf.set_text_color(20, 24, 40)
    pdf.multi_cell(0, 10, text.title, new_x="LMARGIN", new_y="NEXT")
    pdf.ln(2)
    pdf.box(text.disclaimer, _LIGHT)

    pdf.heading(text.summary_title)
    pdf.paragraph(text.summary)

    pdf.heading(text.details_title)
    for entity in sorted(details, key=lambda entity: _ORDER.index(entity.type)):
        pdf.paragraph(text.detail_labels.get(entity.type, entity.type), size=9, grey=True)
        pdf.paragraph(entity.value, bold=True)
        pdf.ln(1)

    pdf.heading(text.evidence_title)
    pdf.paragraph(text.evidence_hint, size=9, grey=True)
    pdf.ln(1)
    for item in evidence:
        pdf.paragraph(item.name, bold=True)
        pdf.paragraph(f"SHA-256: {item.sha256}", size=9)
        pdf.paragraph(
            text.captured_at.replace("{time}", _stamp(item.captured_at)), size=9, grey=True
        )
        pdf.ln(1)
    pdf.box(text.keep_originals, _WARNING, bold=True)

    pdf.heading(text.script_title)
    pdf.box(text.script, _LIGHT)

    return bytes(pdf.output())
