import os
from io import BytesIO
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_RIGHT
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

FONT_DIR = os.path.join(os.path.dirname(__file__), "assets")
FONT_REGULAR = os.path.join(FONT_DIR, "DejaVuSans.ttf")
FONT_BOLD = os.path.join(FONT_DIR, "DejaVuSans-Bold.ttf")

_FONT_NAME = "Helvetica"
_FONT_NAME_BOLD = "Helvetica-Bold"
if os.path.exists(FONT_REGULAR) and os.path.exists(FONT_BOLD):
    pdfmetrics.registerFont(TTFont("DejaVuSans", FONT_REGULAR))
    pdfmetrics.registerFont(TTFont("DejaVuSans-Bold", FONT_BOLD))
    _FONT_NAME = "DejaVuSans"
    _FONT_NAME_BOLD = "DejaVuSans-Bold"

ONES = ["", "ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT", "NINE",
        "TEN", "ELEVEN", "TWELVE", "THIRTEEN", "FOURTEEN", "FIFTEEN", "SIXTEEN",
        "SEVENTEEN", "EIGHTEEN", "NINETEEN"]
TENS = ["", "", "TWENTY", "THIRTY", "FORTY", "FIFTY", "SIXTY", "SEVENTY", "EIGHTY", "NINETY"]


def _two_digit(n):
    if n < 20:
        return ONES[n]
    return (TENS[n // 10] + (" " + ONES[n % 10] if n % 10 else "")).strip()


def _three_digit(n):
    if n >= 100:
        return ONES[n // 100] + " HUNDRED" + (" " + _two_digit(n % 100) if n % 100 else "")
    return _two_digit(n)


def amount_to_words(amount):
    rupees = int(amount)
    if rupees == 0:
        return "ZERO RUPEES ONLY"

    parts = []
    crore, rupees = divmod(rupees, 10000000)
    lakh, rupees = divmod(rupees, 100000)
    thousand, rupees = divmod(rupees, 1000)
    hundred = rupees

    if crore:
        parts.append(_three_digit(crore) + " CRORE")
    if lakh:
        parts.append(_three_digit(lakh) + " LAKH")
    if thousand:
        parts.append(_three_digit(thousand) + " THOUSAND")
    if hundred:
        parts.append(_three_digit(hundred))

    return " ".join(parts) + " RUPEES ONLY"


def _fmt(amount):
    return f"₹{float(amount):,.2f}"


def build_invoice_pdf(invoice, enquiry, payment, pending_installments, logo_path):
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=20 * mm, bottomMargin=20 * mm)
    styles = getSampleStyleSheet()
    elements = []

    title_style = ParagraphStyle("title", fontName=_FONT_NAME_BOLD, fontSize=17, leading=20, textColor=colors.HexColor("#1a3fa0"))
    sub_style = ParagraphStyle("sub", fontName=_FONT_NAME, fontSize=10, leading=14, textColor=colors.HexColor("#374151"))
    date_style = ParagraphStyle("date", fontName=_FONT_NAME, fontSize=10, leading=14, alignment=TA_RIGHT)

    header_text = [
        Paragraph("Vetri Technology Solutions", title_style),
        Paragraph("IT Training with 100% Placement", sub_style),
        Paragraph("Contact Us: 8438558527, 8438558627", sub_style),
    ]

    if os.path.exists(logo_path):
        logo = Image(logo_path, width=25 * mm, height=25 * mm)
    else:
        logo = Paragraph(f"[logo not found: {logo_path}]", sub_style)

    header_table = Table(
        [[logo, header_text, Paragraph(f"<b>Billing Date:</b> {invoice.generated_at.strftime('%d-%m-%Y')}", date_style)]],
        colWidths=[30 * mm, 115 * mm, 35 * mm],
    )
    header_table.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#1a3fa0")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    elements.append(header_table)
    elements.append(Spacer(1, 12))

    next_installment_line = "—"
    if pending_installments:
        nxt = pending_installments[0]
        next_installment_line = f"{_fmt(nxt.amount)} due {nxt.due_date.strftime('%d-%m-%Y')} (#{nxt.installment_number})"

    rows = [
        ["Bill No:", str(invoice.invoice_id)],
        ["Trainee Name:", enquiry.name],
        ["Certification Name:", enquiry.course.course_name],
        ["Date of Joining:", enquiry.created_at.strftime("%b. %d, %Y") if enquiry.created_at else "—"],
        ["Base Fee:", _fmt(invoice.base_fee)],
        [f"GST ({invoice.gst_percentage}%):", _fmt(invoice.gst_amount)],
        ["Total Amount:", _fmt(invoice.total_amount)],
        ["Amount Paid:", _fmt(invoice.amount_paid_till_date)],
        ["Balance Amount:", _fmt(invoice.balance_amount)],
    ]
    if pending_installments:
        rows.append([f"Next Installment (#{pending_installments[0].installment_number}):", next_installment_line])
    rows.append(["Amount in Words:", amount_to_words(invoice.total_amount)])

    detail_table = Table(rows, colWidths=[55 * mm, 115 * mm])
    detail_table.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#1a3fa0")),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#1a3fa0")),
        ("FONTNAME", (0, 0), (0, -1), _FONT_NAME_BOLD),
        ("FONTNAME", (1, 0), (1, -1), _FONT_NAME),
        ("TEXTCOLOR", (1, 0), (1, -1), colors.HexColor("#1a3fa0")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    elements.append(detail_table)
    elements.append(Spacer(1, 40))

    sig_style = ParagraphStyle("sig", fontName=_FONT_NAME_BOLD, textColor=colors.HexColor("#1a3fa0"))
    sig_table = Table(
        [[Paragraph("Trainee Signature", sig_style), Paragraph("Admin Signature", sig_style)]],
        colWidths=[85 * mm, 85 * mm],
    )
    elements.append(sig_table)

    doc.build(elements)
    buffer.seek(0)
    return buffer