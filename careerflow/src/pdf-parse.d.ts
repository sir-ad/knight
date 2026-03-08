declare module "pdf-parse" {
  interface PDFParseResult {
    text?: string
  }

  export default function pdfParse(data: Uint8Array): Promise<PDFParseResult>
}
