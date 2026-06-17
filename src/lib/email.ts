import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendSoldNotification(
  consignerEmail: string,
  consignerName: string,
  productTitle: string,
  sku: string,
  size: string,
  salePrice: number,
  payout: number,
  orderName: string
): Promise<void> {
  const formattedSalePrice = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "EUR",
  }).format(salePrice);

  const formattedPayout = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "EUR",
  }).format(payout);

  await resend.emails.send({
    from: "SNR Kickz <noreply@snrkickz.com>",
    to: consignerEmail,
    subject: `Your item sold — ${productTitle} (${orderName})`,
    html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your item sold</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background-color:#111111;padding:32px 40px;">
              <p style="margin:0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">SNR Kickz</p>
              <p style="margin:6px 0 0;font-size:13px;color:#888888;text-transform:uppercase;letter-spacing:1px;">Consignment Platform</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px;">

              <p style="margin:0 0 8px;font-size:24px;font-weight:700;color:#111111;">Your item just sold! 🎉</p>
              <p style="margin:0 0 32px;font-size:15px;color:#555555;line-height:1.6;">
                Hi ${consignerName}, great news — one of your consigned items has been sold. A payout has been queued and will be processed shortly.
              </p>

              <!-- Order badge -->
              <table cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
                <tr>
                  <td style="background-color:#f4f4f5;border-radius:4px;padding:8px 14px;">
                    <span style="font-size:13px;color:#555555;">Order&nbsp;</span>
                    <span style="font-size:13px;font-weight:600;color:#111111;">${orderName}</span>
                  </td>
                </tr>
              </table>

              <!-- Item details -->
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;margin-bottom:32px;">
                <tr>
                  <td style="padding:16px 20px;background-color:#f9fafb;border-bottom:1px solid #e5e7eb;">
                    <p style="margin:0;font-size:11px;font-weight:600;color:#888888;text-transform:uppercase;letter-spacing:0.8px;">Item Sold</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:20px;">
                    <p style="margin:0 0 4px;font-size:16px;font-weight:600;color:#111111;">${productTitle}</p>
                    <p style="margin:0;font-size:14px;color:#666666;">SKU: ${sku}&nbsp;&nbsp;·&nbsp;&nbsp;Size: ${size}</p>
                  </td>
                </tr>
              </table>

              <!-- Financials -->
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;margin-bottom:32px;">
                <tr>
                  <td style="padding:16px 20px;background-color:#f9fafb;border-bottom:1px solid #e5e7eb;">
                    <p style="margin:0;font-size:11px;font-weight:600;color:#888888;text-transform:uppercase;letter-spacing:0.8px;">Payout Summary</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:20px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:6px 0;font-size:14px;color:#555555;">Sale price</td>
                        <td align="right" style="padding:6px 0;font-size:14px;color:#111111;">${formattedSalePrice}</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;border-top:1px solid #e5e7eb;font-size:15px;font-weight:700;color:#111111;">Your payout</td>
                        <td align="right" style="padding:6px 0;border-top:1px solid #e5e7eb;font-size:15px;font-weight:700;color:#111111;">${formattedPayout}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 32px;font-size:14px;color:#555555;line-height:1.6;">
                Thank you for consigning with SNR Kickz. If you have any questions about your payout, feel free to reach out to us.
              </p>

              <p style="margin:0;font-size:14px;color:#555555;">
                Best regards,<br />
                <strong style="color:#111111;">The SNR Kickz Team</strong>
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px;background-color:#f9fafb;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:12px;color:#aaaaaa;text-align:center;">
                © ${new Date().getFullYear()} SNR Kickz · This email was sent because an item you consigned was sold.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim(),
  });
}
