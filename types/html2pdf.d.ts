declare module "html2pdf.js" {
  interface Html2PdfWorker {
    set: (options: Record<string, unknown>) => Html2PdfWorker;
    from: (element: HTMLElement) => Html2PdfWorker;
    toPdf: () => Promise<Html2PdfWorker>;
    output: (type: "blob") => Promise<Blob>;
    save: (filename?: string) => Promise<void>;
  }

  const html2pdf: () => Html2PdfWorker;

  export default html2pdf;
}
