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

type Store = {
  consigners: Consigner[];
  listings: Listing[];
  payouts: Payout[];
  nextId: { consigner: number; listing: number; payout: number };
};

const empty: Store = {
  consigners: [],
  listings: [],
  payouts: [],
  nextId: { consigner: 1, listing: 1, payout: 1 },
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
      nextId: parsed.nextId ?? { consigner: 1, listing: 1, payout: 1 },
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
};

// ── Listings ─────────────────────────────────────────────────
export const listingsTable = {
  findById(id: number): Listing | undefined {
    return getStore().listings.find((l) => l.id === id);
  },
  insert(
    input: Omit<Listing, "id" | "created_at" | "sold_at" | "order_name"> & {
      sold_at?: string | null;
      order_name?: string | null;
    }
  ): Listing {
    const store = getStore();
    const row: Listing = {
      id: store.nextId.listing++,
      created_at: now(),
      sold_at: null,
      order_name: null,
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
