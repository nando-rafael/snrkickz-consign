const API_VERSION = "2025-01";

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Ontbrekende env variabele: ${name}`);
  return v;
}

/**
 * Token management.
 * - Staat SHOPIFY_ADMIN_TOKEN in .env (legacy shpat_ token)? Dan gebruiken we die.
 * - Anders: client credentials grant met SHOPIFY_CLIENT_ID + SHOPIFY_CLIENT_SECRET
 *   (nieuwe Dev Dashboard apps). Token wordt gecachet en automatisch ververst.
 */
type TokenCache = { token: string; expiresAt: number };
const globalForToken = globalThis as unknown as { __shopifyToken?: TokenCache };

async function getAccessToken(): Promise<string> {
  const staticToken = process.env.SHOPIFY_ADMIN_TOKEN;
  if (staticToken) return staticToken;

  const cached = globalForToken.__shopifyToken;
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;

  const res = await fetch(
    `https://${env("SHOPIFY_STORE_DOMAIN")}/admin/oauth/access_token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "client_credentials",
        client_id: env("SHOPIFY_CLIENT_ID"),
        client_secret: env("SHOPIFY_CLIENT_SECRET"),
      }),
      cache: "no-store",
    }
  );
  if (!res.ok) {
    throw new Error(
      `Token ophalen mislukt (${res.status}): ${await res.text()}. Check SHOPIFY_CLIENT_ID/SECRET en of de app op de store is geïnstalleerd.`
    );
  }
  const json = await res.json();
  globalForToken.__shopifyToken = {
    token: json.access_token,
    expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
  };
  return json.access_token;
}

export async function shopifyGraphQL(
  query: string,
  variables: Record<string, unknown> = {}
) {
  const token = await getAccessToken();
  const res = await fetch(
    `https://${env("SHOPIFY_STORE_DOMAIN")}/admin/api/${API_VERSION}/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": token,
      },
      body: JSON.stringify({ query, variables }),
      cache: "no-store",
    }
  );
  if (!res.ok) {
    throw new Error(`Shopify API ${res.status}: ${await res.text()}`);
  }
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data;
}

export type ShopifyVariant = {
  id: string;
  sku: string;
  size: string;
  price: string;
  inventoryQuantity: number;
  inventoryItemId: string;
};

export type ShopifyProductMatch = {
  productId: string;
  productTitle: string;
  imageUrl: string | null;
  sku: string;
  variants: ShopifyVariant[];
};

const VARIANT_FIELDS = `
  id
  sku
  title
  price
  inventoryQuantity
  inventoryItem { id }
  product {
    id
    title
    featuredMedia { preview { image { url } } }
  }
`;

function mapVariant(n: any): ShopifyVariant {
  return {
    id: n.id,
    sku: n.sku,
    size: n.title,
    price: n.price,
    inventoryQuantity: n.inventoryQuantity ?? 0,
    inventoryItemId: n.inventoryItem?.id,
  };
}

/**
 * Zoekt een product op basis-SKU (stylecode). In de Snrkickz catalogus delen
 * alle maten van een product dezelfde SKU; de maat staat in de variant-titel.
 * Geeft het product terug met al zijn maten.
 */
export async function findProductBySku(
  baseSku: string
): Promise<ShopifyProductMatch | null> {
  const data = await shopifyGraphQL(
    `query ($q: String!) {
      productVariants(first: 100, query: $q) {
        nodes { ${VARIANT_FIELDS} }
      }
    }`,
    { q: `sku:${baseSku}` }
  );
  const nodes: any[] = (data?.productVariants?.nodes ?? []).filter(
    (n: any) => (n.sku || "").toUpperCase() === baseSku.toUpperCase()
  );
  if (nodes.length === 0) return null;

  const product = nodes[0].product;
  // Alleen variants van hetzelfde product (voor het geval een SKU dubbel voorkomt)
  const sameProduct = nodes.filter((n) => n.product?.id === product?.id);

  return {
    productId: product?.id,
    productTitle: product?.title,
    imageUrl: product?.featuredMedia?.preview?.image?.url ?? null,
    sku: nodes[0].sku,
    variants: sameProduct.map(mapVariant),
  };
}

/** Haalt een specifieke variant op via GID, met productinfo. */
export async function getVariantById(variantId: string): Promise<
  | (ShopifyVariant & {
      productId: string;
      productTitle: string;
      imageUrl: string | null;
    })
  | null
> {
  const data = await shopifyGraphQL(
    `query ($id: ID!) {
      node(id: $id) {
        ... on ProductVariant { ${VARIANT_FIELDS} }
      }
    }`,
    { id: variantId }
  );
  const n = data?.node;
  if (!n?.id) return null;
  return {
    ...mapVariant(n),
    productId: n.product?.id,
    productTitle: n.product?.title,
    imageUrl: n.product?.featuredMedia?.preview?.image?.url ?? null,
  };
}

export async function adjustInventory(inventoryItemId: string, delta: number) {
  const data = await shopifyGraphQL(
    `mutation ($input: InventoryAdjustQuantitiesInput!) {
      inventoryAdjustQuantities(input: $input) {
        userErrors { field message }
      }
    }`,
    {
      input: {
        reason: "correction",
        name: "available",
        changes: [
          {
            delta,
            inventoryItemId,
            locationId: env("SHOPIFY_LOCATION_ID"),
          },
        ],
      },
    }
  );
  const errs = data?.inventoryAdjustQuantities?.userErrors ?? [];
  if (errs.length) {
    throw new Error(errs.map((e: any) => e.message).join("; "));
  }
}

export async function setVariantPrice(
  productId: string,
  variantId: string,
  price: number
) {
  const data = await shopifyGraphQL(
    `mutation ($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
      productVariantsBulkUpdate(productId: $productId, variants: $variants) {
        userErrors { field message }
      }
    }`,
    { productId, variants: [{ id: variantId, price: price.toFixed(2) }] }
  );
  const errs = data?.productVariantsBulkUpdate?.userErrors ?? [];
  if (errs.length) {
    throw new Error(errs.map((e: any) => e.message).join("; "));
  }
}
