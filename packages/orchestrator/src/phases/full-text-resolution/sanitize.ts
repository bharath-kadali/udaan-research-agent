/**
 * File sanitization & "fake PDF" defense (Phase 4 §4.1). Publishers often
 * return HTTP 200 with an HTML login page for paywalled papers; we trap those
 * by content-type and by verifying the PDF magic number.
 */

// "%PDF-" => 25 50 44 46 2D
const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d];

export function hasPdfMagic(bytes: Uint8Array): boolean {
  if (bytes.length < PDF_MAGIC.length) return false;
  return PDF_MAGIC.every((byte, i) => bytes[i] === byte);
}

export function isHtmlContentType(contentType: string | null): boolean {
  return contentType !== null && contentType.toLowerCase().includes("text/html");
}
