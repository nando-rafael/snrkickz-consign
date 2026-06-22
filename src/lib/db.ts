import fs from "fs";
import path from "path";

const dataDir = process.env.DATA_DIR || path.join(process.cwd(), "data");
const dbFile = path.join(dataDir, "store.json");

export type Consigner = {
  id: number;
  email: string;
  name: string;
  password_hash: string;
  iban: string | null;
  discord_username: string | null;
  discord_webhook_url: string | null;
  created_at: string;
};

export type Listing = {
  id: number;
  consigner_id: number;
  sku: string;
  style_code: string;
  size: string;
  product_title: string | null;
  product_image: string | null;
  product_id: string | null;
  variant_id: string | null;
  inventory_item_id: string | null;
  payout: number;
  sale_price: number;
  original_price: number | null;
  quantity: number;
  status: "ACTIVE" | "SOLD" | "DELISTED";
  order_name: string | null;
  created_at: string;
  sold_at: string | null;
};

export type Payout = {
  id: number;
  consigner_id: number;
  listing_id: number;
  amount: number;
  order_name: string | null;
  status: "PENDING" | "PAID";
  created_at: string;
  paid_at: string | null;
};

export type Inventory = {
  id: number;
  sku: string;
  product_title: string;
  size: string;
  quantity: number;
  created_at: string;
};

export type ProductRequest = {
  id: number;
  consigner_id: number;
  sku: string;
  product_name: string;
  stockx_url: string;
  status: "PENDING" | "APPROVED" | "LIVE" | "REJECTED";
  created_at: string;
  handled_at: string | null;
};

type Store = {
  consigners: Consigner[];
  listings: Listing[];
  payouts: Payout[];
  inventory: Inventory[];
  productRequests: ProductRequest[];
  nextId: { consigner: number; listing: number; payout: number; inventory: number; productRequest: number };
};

const empty: Store = {
  consigners: [],
  listings: [],
  payouts: [],
  inventory: [],
  productRequests: [],
  nextId: { consigner: 1, listing: 1, payout: 1, inventory: 1, productRequest: 1 },
};

function load(): Store {
  try {
    if (!fs.existsSync(dbFile)) return JSON.parse(JSON.stringify(empty));
    const raw = fs.readFileSync(dbFile, "utf8");
    const parsed = JSON.parse(raw) as Partial<Store>;
    return {
      consigners: parsed.consigners ?? [],
      listings: parsed.listings ?? [],
      payouts: parsed.payouts ?? [],
      inventory: parsed.inventory ?? [],
      productRequests: parsed.productRequests ?? [],
      nextId: {
        consigner: parsed.nextId?.consigner ?? 1,
        listing: parsed.nextId?.listing ?? 1,
        payout: parsed.nextId?.payout ?? 1,
        inventory: parsed.nextId?.inventory ?? 1,
        productRequest: parsed.nextId?.productRequest ?? 1,
      },
    };
  } catch {
    return JSON.parse(JSON.stringify(empty));
  }
}

function save(store: Store): void {
  fs.mkdirSync(dataDir, { recursive: true });
  // Atomic write: tmp -> rename
  const tmp = dbFile + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2));
  fs.renameSync(tmp, dbFile);
}

const globalForDb = globalThis as unknown as { __consignStore?: Store };
function getStore(): Store {
  if (!globalForDb.__consignStore) {
    globalForDb.__consignStore = load();
  }
  return globalForDb.__consignStore;
}

function now(): string {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

// ── Consigners ───────────────────────────────────────────────
export const consignersTable = {
  findByEmail(email: string): Consigner | undefined {
    return getStore().consigners.find(
      (c) => c.email.toLowerCase() === email.toLowerCase()
    );
  },
  findById(id: number): Consigner | undefined {
    return getStore().consigners.find((c) => c.id === id);
  },
  insert(input: Omit<Consigner, "id" | "created_at">): Consigner {
    const store = getStore();
    const row: Consigner = {
      id: store.nextId.consigner++,
      ...input,
      created_at: now(),
    };
    store.consigners.push(row);
    save(store);
    return row;
  },
  update(id: number, input: Partial<Omit<Consigner, "id" | "created_at">>): Consigner | undefined {
    const store = getStore();
    const row = store.consigners.find((c) => c.id === id);
    if (!row) return undefined;
    Object.assign(row, input);
    save(store);
    return row;
  },
  listAll(): Consigner[] {
    return getStore()
      .consigners.slice()
      .sort((a, b) => a.name.localeCompare(b.name));
  },
};

// ── Listings ─────────────────────────────────────────────────
export const listingsTable = {
  findById(id: number): Listing | undefined {
    return getStore().listings.find((l) => l.id === id);
  },
  insert(
    input: Omit<Listing, "id" | "created_at" | "sold_at" | "order_name" | "quantity"> & {
      sold_at?: string | null;
      order_name?: string | null;
      quantity?: number;
    }
  ): Listing {
    const store = getStore();
    const row: Listing = {
      id: store.nextId.listing++,
      created_at: now(),
      sold_at: null,
      order_name: null,
      quantity: 1,
      ...input,
    };
    store.listings.push(row);
    save(store);
    return row;
  },
  listByConsigner(consignerId: number): Listing[] {
    return getStore()
      .listings.filter((l) => l.consigner_id === consignerId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  },
  listAll(limit = 200): Listing[] {
    return getStore()
      .listings.slice()
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, limit);
  },
  findActiveByVariantLowestPayout(variantId: string): Listing | undefined {
    return getStore()
      .listings.filter(
        (l) => l.variant_id === variantId && l.status === "ACTIVE"
      )
      .sort((a, b) => a.payout - b.payout)[0];
  },
  findActiveByVariantSortedBySalePrice(variantId: string): Listing[] {
    return getStore()
      .listings.filter(
        (l) => l.variant_id === variantId && l.status === "ACTIVE"
      )
      .sort((a, b) => a.sale_price - b.sale_price);
  },
  findEarliestOriginalPrice(variantId: string): Listing | undefined {
    return getStore()
      .listings.filter(
        (l) => l.variant_id === variantId && l.original_price != null
      )
      .sort((a, b) => a.created_at.localeCompare(b.created_at))[0];
  },
  markSold(id: number, orderName: string): void {
    const store = getStore();
    const l = store.listings.find((x) => x.id === id);
    if (!l) return;
    l.status = "SOLD";
    l.order_name = orderName;
    l.sold_at = now();
    save(store);
  },
  markDelisted(id: number): void {
    const store = getStore();
    const l = store.listings.find((x) => x.id === id);
    if (!l) return;
    l.status = "DELISTED";
    save(store);
  },
};

// ── Inventory ────────────────────────────────────────────────
export const inventoryTable = {
  listAll(): Inventory[] {
    return getStore()
      .inventory.slice()
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  },
  findById(id: number): Inventory | undefined {
    return getStore().inventory.find((i) => i.id === id);
  },
  insert(input: Omit<Inventory, "id" | "created_at">): Inventory {
    const store = getStore();
    const row: Inventory = {
      id: store.nextId.inventory++,
      ...input,
      created_at: now(),
    };
    store.inventory.push(row);
    save(store);
    return row;
  },
  updateQuantity(id: number, newQuantity: number): void {
    const store = getStore();
    const item = store.inventory.find((i) => i.id === id);
    if (!item) return;
    item.quantity = newQuantity;
    save(store);
  },
  delete(id: number): void {
    const store = getStore();
    store.inventory = store.inventory.filter((i) => i.id !== id);
    save(store);
  },
};

// ── Payouts ──────────────────────────────────────────────────
export const payoutsTable = {
  insert(input: {
    consigner_id: number;
    listing_id: number;
    amount: number;
    order_name: string | null;
  }): Payout {
    const store = getStore();
    const row: Payout = {
      id: store.nextId.payout++,
      ...input,
      status: "PENDING",
      created_at: now(),
      paid_at: null,
    };
    store.payouts.push(row);
    save(store);
    return row;
  },
  listByConsigner(consignerId: number): Payout[] {
    return getStore()
      .payouts.filter((p) => p.consigner_id === consignerId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  },
  listAll(limit = 200): Payout[] {
    return getStore()
      .payouts.slice()
      .sort((a, b) => {
        if (a.status !== b.status) return a.status === "PENDING" ? -1 : 1;
        return b.created_at.localeCompare(a.created_at);
      })
      .slice(0, limit);
  },
  markPaid(id: number): void {
    const store = getStore();
    const p = store.payouts.find((x) => x.id === id);
    if (!p || p.status !== "PENDING") return;
    p.status = "PAID";
    p.paid_at = now();
    save(store);
  },
};

// ── Product Requests ─────────────────────────────────────────
export const productRequestsTable = {
  insert(input: Omit<ProductRequest, "id" | "created_at" | "handled_at">): ProductRequest {
    const store = getStore();
    const row: ProductRequest = {
      id: store.nextId.productRequest++,
      ...input,
      created_at: now(),
      handled_at: null,
    };
    store.productRequests.push(row);
    save(store);
    return row;
  },
  findById(id: number): ProductRequest | undefined {
    return getStore().productRequests.find((r) => r.id === id);
  },
  listByConsigner(consignerId: number): ProductRequest[] {
    return getStore()
      .productRequests.filter((r) => r.consigner_id === consignerId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  },
  listAll(): ProductRequest[] {
    return getStore()
      .productRequests.slice()
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  },
  updateStatus(
    id: number,
    status: ProductRequest["status"],
    handledAt: string
  ): ProductRequest | undefined {
    const store = getStore();
    const row = store.productRequests.find((r) => r.id === id);
    if (!row) return undefined;
    row.status = status;
    row.handled_at = handledAt;
    save(store);
    return row;
  },
  findBySku(sku: string): ProductRequest | undefined {
    return getStore().productRequests.find(
      (r) =>
        r.sku.toUpperCase() === sku.toUpperCase() &&
        (r.status === "PENDING" || r.status === "APPROVED")
    );
  },
};

