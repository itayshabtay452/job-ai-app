// types/pdf-parse.d.ts
declare module "pdf-parse/lib/pdf-parse.js" {
  export type PdfParseResult = {
    text?: string;
    numpages?: number;
    numrender?: number;
    info?: any;
    metadata?: any;
    version?: string;
  };
  const pdfParse: (data: Buffer | Uint8Array) => Promise<PdfParseResult>;
  export default pdfParse;
}
