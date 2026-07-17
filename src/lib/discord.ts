export async function sendDiscordNotification(
  webhookUrl: string,
  listing: {
    product_title: string | null;
    sku: string;
    size: string;
    sale_price: number;
    payout: number;
  },
  orderName: string
): Promise<{ ok: boolean; error?: string }> {
  if (!webhookUrl) {
    console.warn("[Discord] No webhook URL provided");
    return { ok: false, error: "Geen Discord webhook ingesteld" };
  }

  try {
    const embed = {
      title: "🎉 Item verkocht!",
      color: 0x00ff00,
      fields: [
        {
          name: "Product",
          value: listing.product_title || "Onbekend",
          inline: false,
        },
        {
          name: "SKU",
          value: listing.sku,
          inline: true,
        },
        {
          name: "Maat",
          value: listing.size,
          inline: true,
        },
        {
          name: "Verkoopprijs",
          value: `€${listing.sale_price.toFixed(2)}`,
          inline: true,
        },
        {
          name: "Jouw uitbetaling",
          value: `€${listing.payout.toFixed(2)}`,
          inline: true,
        },
        {
          name: "Order",
          value: orderName,
          inline: false,
        },
      ],
      timestamp: new Date().toISOString(),
    };

    console.log("[Discord] Sending notification to webhook");
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ embeds: [embed] }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Discord] Webhook failed: ${response.status} - ${errorText}`);
      return {
        ok: false,
        error: `Discord error: ${response.status}`,
      };
    }

    console.log("[Discord] Notification sent successfully");
    return { ok: true };
  } catch (error: any) {
    console.error("[Discord] Notification failed:", error);
    return {
      ok: false,
      error: error.message || "Discord verzenden mislukt",
    };
  }
}

