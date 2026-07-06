import PDFDocument from "pdfkit";

export async function generateShippingLabel(listing: {
  id: number;
  sku: string;
  product_title: string | null;
  size: string;
  payout: number;
  consigner_name: string;
  order_name: string | null;
}): Promise<Buffer> {
  try {
    // A6 format: 105mm x 148mm (in points: 297 x 420)
    const doc = new PDFDocument({
      size: [297, 420],
      margin: 10,
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));

    // Header
    doc.fontSize(14).font("Helvetica-Bold").text("SHIPPING LABEL", { align: "center" });
    doc.moveTo(10, 35).lineTo(287, 35).stroke();

    // Listing info
    doc.fontSize(10).font("Helvetica");
    doc.text(`Order: ${listing.order_name || "N/A"}`, 15, 45);
    doc.text(`Listing #${listing.id}`, 15, 60);
    doc.text(`SKU: ${listing.sku}`, 15, 75);
    doc.text(`Product: ${listing.product_title || "N/A"}`, 15, 90);
    doc.text(`Size: ${listing.size}`, 15, 105);
    doc.text(`Payout: €${listing.payout}`, 15, 120);

    // Consigner info
    doc.moveTo(10, 135).lineTo(287, 135).stroke();
    doc.fontSize(9).font("Helvetica-Bold").text("CONSIGNOR", 15, 145);
    doc.fontSize(9).font("Helvetica").text(listing.consigner_name, 15, 160);

    // QR code placeholder (or barcode)
    doc.fontSize(8).text(`ID: ${listing.id}`, 15, 280, { align: "center" });

    // Footer
    doc.moveTo(10, 400).lineTo(287, 400).stroke();
    doc.fontSize(7).text(`Generated: ${new Date().toLocaleDateString()}`, 15, 405, { align: "center" });

    doc.end();

    return new Promise((resolve, reject) => {
      doc.on("end", () => {
        try {
          resolve(Buffer.concat(chunks));
        } catch (e) {
          reject(new Error(`Failed to concat PDF chunks: ${e}`));
        }
      });
      doc.on("error", (e) => {
        console.error("[PDFKit Error]", e);
        reject(new Error(`PDF generation error: ${e.message}`));
      });
    });
  } catch (e: any) {
    console.error("[Label Generator] Error:", e);
    throw new Error(`Label generation failed: ${e.message}`);
  }
}
