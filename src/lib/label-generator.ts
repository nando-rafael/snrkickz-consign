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
  return new Promise((resolve, reject) => {
    try {
      // A6 format: 105mm x 148mm = 297pt x 420pt
      const doc = new PDFDocument({
        size: [297, 420],
        margin: 15,
        bufferPages: true,
      });

      const buffers: Buffer[] = [];

      doc.on("data", (chunk: Buffer) => {
        buffers.push(chunk);
      });

      doc.on("error", (err: Error) => {
        console.error("[Label] PDF Error:", err);
        reject(err);
      });

      // Title
      doc
        .fontSize(16)
        .font("Helvetica-Bold")
        .text("SHIPPING LABEL", { align: "center" });

      doc.moveTo(15, 40).lineTo(282, 40).stroke();

      // Order info
      doc.fontSize(11).font("Helvetica");
      doc.text(`Order: ${listing.order_name || "N/A"}`, 20, 50);
      doc.text(`Listing #${listing.id}`, 20, 68);

      // Product info
      doc.fontSize(10);
      doc.text(`SKU: ${listing.sku}`, 20, 86);
      doc.text(`Product: ${listing.product_title || "N/A"}`, 20, 102);
      doc.text(`Size: ${listing.size}`, 20, 118);
      doc.text(`Payout: €${listing.payout.toFixed(2)}`, 20, 134);

      // Consigner section
      doc.moveTo(15, 155).lineTo(282, 155).stroke();
      doc.fontSize(10).font("Helvetica-Bold").text("CONSIGNOR", 20, 165);
      doc.fontSize(10).font("Helvetica").text(listing.consigner_name, 20, 183);

      // ID at bottom
      doc.fontSize(9).text(`ID: ${listing.id}`, 20, 350, { align: "center" });

      // Footer
      doc.moveTo(15, 395).lineTo(282, 395).stroke();
      doc
        .fontSize(8)
        .text(`Generated: ${new Date().toLocaleDateString("nl-NL")}`, 20, 402);

      doc.end();

      doc.on("end", () => {
        try {
          const pdfBuffer = Buffer.concat(buffers);
          resolve(pdfBuffer);
        } catch (err) {
          console.error("[Label] Buffer concat error:", err);
          reject(err);
        }
      });
    } catch (err) {
      console.error("[Label] Generation error:", err);
      reject(err);
    }
  });
}
