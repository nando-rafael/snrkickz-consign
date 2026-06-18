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
): Promise<boolean> {
  if (!webhookUrl) return false;

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

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ embeds: [embed] }),
    });

    return response.ok;
  } catch (error) {
    console.error("Discord notification failed:", error);
    return false;
  }
}

