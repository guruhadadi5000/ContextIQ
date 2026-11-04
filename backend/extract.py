import io

MAX_UPLOAD_BYTES = 4 * 1024 * 1024
MAX_TEXT_CHARS = 60_000


class DocumentError(Exception):
    def __init__(self, message: str, status_code: int):
        super().__init__(message)
        self.status_code = status_code


def extract_text(filename: str, data: bytes) -> dict:
    if len(data) > MAX_UPLOAD_BYTES:
        raise DocumentError(
            "This file is larger than 4 MB. Upload a smaller document.",
            413,
        )

    extension = filename.lower().rsplit(".", 1)[-1] if "." in filename else ""
    if extension == "txt":
        text = data.decode("utf-8", errors="replace").strip()
    elif extension == "pdf":
        text = _pdf_text(data)
    elif extension == "docx":
        text = _docx_text(data)
    else:
        raise DocumentError("Upload a PDF, TXT, or DOCX file.", 400)

    if not text:
        raise DocumentError("No text could be read from this file.", 400)

    if len(text) > MAX_TEXT_CHARS:
        raise DocumentError(
            (
                f"This document is {len(text):,} characters after extraction. "
                f"ContextIQ reads the whole file in one request, so the limit is "
                f"{MAX_TEXT_CHARS:,} characters. Upload a shorter document."
            ),
            413,
        )

    return {"filename": filename, "text": text, "characters": len(text)}


def _pdf_text(data: bytes) -> str:
    from pypdf import PdfReader
    from pypdf.errors import PdfReadError

    try:
        reader = PdfReader(io.BytesIO(data))
    except PdfReadError as error:
        raise DocumentError("This PDF could not be read.", 400) from error

    pages = []
    for number, page in enumerate(reader.pages, start=1):
        page_text = (page.extract_text() or "").strip()
        if page_text:
            pages.append(f"[Page {number}]\n{page_text}")
    return "\n\n".join(pages).strip()


def _docx_text(data: bytes) -> str:
    from docx import Document
    from docx.opc.exceptions import PackageNotFoundError

    try:
        document = Document(io.BytesIO(data))
    except (PackageNotFoundError, ValueError) as error:
        raise DocumentError("This DOCX could not be read.", 400) from error

    paragraphs = [paragraph.text.strip() for paragraph in document.paragraphs]
    return "\n".join(paragraph for paragraph in paragraphs if paragraph).strip()
