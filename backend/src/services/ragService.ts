/**
 * RAG (Retrieval-Augmented Generation) service using ChromaDB.
 * Maintains a "blinkit_knowledge" collection of FAQ and policy documents.
 * Provides search and ingestion capabilities for the knowledge agent.
 */

import { ChromaClient, Collection } from "chromadb";

// ── Types ────────────────────────────────────────────────────────────────────

export interface KnowledgeDocument {
  id: string;
  text: string;
  metadata: {
    source: string;
    category: string;
    title: string;
    [key: string]: string | number | boolean;
  };
}

export interface SearchResult {
  id: string;
  text: string;
  metadata: KnowledgeDocument["metadata"];
  distance: number; // lower = more similar
  relevanceScore: number; // 0–1, higher = more relevant
}

// ── Client ───────────────────────────────────────────────────────────────────

const CHROMA_URL = process.env.CHROMA_URL ?? "http://localhost:8000";
const COLLECTION_NAME = process.env.CHROMA_COLLECTION ?? "blinkit_knowledge";

let chromaClient: ChromaClient | null = null;
let collection: Collection | null = null;
const FALLBACK_FAQS: KnowledgeDocument[] = [
  {
    id: "faq-001",
    text: "Blinkit delivery times depend on location. Track an active order in the Orders section of the app.",
    metadata: { source: "faq", category: "delivery", title: "Delivery Time & Tracking" },
  },
  {
    id: "faq-002",
    text: "Orders can generally be cancelled in the app before they are picked up by the delivery partner.",
    metadata: { source: "faq", category: "order", title: "How to Cancel an Order" },
  },
  {
    id: "faq-003",
    text: "For a wrong, damaged, or expired product, report an issue from Orders in the app. Refund timing depends on the payment method.",
    metadata: { source: "policy", category: "refund", title: "Refund Policy" },
  },
  {
    id: "faq-004",
    text: "A payment deduction without a placed order is normally returned to the original payment method. Contact support with the transaction ID if it does not appear.",
    metadata: { source: "policy", category: "payment", title: "Payment Deducted, Order Not Placed" },
  },
  {
    id: "faq-005",
    text: "Report a damaged, leaking, or expired item from the order details in the app and attach a photo when possible.",
    metadata: { source: "policy", category: "damage", title: "Damaged or Expired Item" },
  },
  {
    id: "faq-006",
    text: "For account and address changes, open Account in the app and edit your profile or saved addresses.",
    metadata: { source: "faq", category: "account", title: "Account and Address Changes" },
  },
  {
    id: "faq-007",
    text: "Blinkit supports payment methods shown at checkout, which may include UPI, cards, wallets, and cash on delivery in eligible locations.",
    metadata: { source: "faq", category: "payment", title: "Payment Methods" },
  },
];

/**
 * Initialize the ChromaDB client and get/create the knowledge collection.
 * Returns false if ChromaDB is unreachable (graceful degradation).
 */
export async function initChromaClient(): Promise<boolean> {
  try {
    chromaClient = new ChromaClient({ path: CHROMA_URL });

    // Verify connectivity
    await chromaClient.heartbeat();

    collection = await chromaClient.getOrCreateCollection({
      name: COLLECTION_NAME,
      metadata: {
        description: "Blinkit customer support knowledge base",
        hnsw_space: "cosine",
      },
    });

    // Seed built-in FAQ documents if collection is empty
    const count = await collection.count();
    if (count === 0) {
      await seedKnowledgeBase();
    }

    console.log(`[RAG] ChromaDB connected — collection: ${COLLECTION_NAME} (${await collection.count()} docs)`);
    return true;
  } catch (err) {
    console.warn("[RAG] ChromaDB unavailable — RAG features disabled:", (err as Error).message);
    chromaClient = null;
    collection = null;
    return false;
  }
}

/**
 * Search the knowledge base for documents relevant to the query.
 * Falls back to empty results if ChromaDB is not available.
 */
export async function searchKnowledge(
  query: string,
  topK = 3
): Promise<SearchResult[]> {
  if (!collection) {
    return searchFallbackFaqs(query, topK);
  }

  try {
    const results = await collection.query({
      queryTexts: [query],
      nResults: topK,
      include: ["documents", "metadatas", "distances"] as never,
    });

    const ids = results.ids[0] ?? [];
    const docs = results.documents[0] ?? [];
    const metas = results.metadatas[0] ?? [];
    const distances = results.distances?.[0] ?? [];

    const chromaResults = ids.map((id, i) => ({
      id,
      text: docs[i] ?? "",
      metadata: (metas[i] ?? {}) as KnowledgeDocument["metadata"],
      distance: distances[i] ?? 1,
      // Convert cosine distance (0=identical, 2=opposite) to relevance score
      relevanceScore: Math.max(0, 1 - (distances[i] ?? 1) / 2),
    }));
    return chromaResults.length > 0
      ? chromaResults
      : searchFallbackFaqs(query, topK);
  } catch (err) {
    console.warn("[RAG] ChromaDB search failed; using bundled FAQ search:", (err as Error).message);
    return searchFallbackFaqs(query, topK);
  }
}

function searchFallbackFaqs(query: string, topK: number): SearchResult[] {
  const stopWords = new Set(["a", "an", "and", "are", "for", "how", "i", "is", "it", "my", "of", "the", "to", "what", "when", "where", "which", "with"]);
  const queryTerms = query
    .toLowerCase()
    .match(/[a-z0-9]+/g)
    ?.filter((term) => !stopWords.has(term)) ?? [];
  if (queryTerms.length === 0) return [];

  return FALLBACK_FAQS.map((document) => {
    const documentText =
      `${document.metadata.title} ${document.metadata.category} ${document.text}`.toLowerCase();
    const documentTerms = new Set(documentText.match(/[a-z0-9]+/g) ?? []);
    const matchingTerms = new Set(queryTerms.filter((term) => documentTerms.has(term)));
    const relevanceScore = matchingTerms.size / queryTerms.length;
    return {
      id: document.id,
      text: document.text,
      metadata: document.metadata,
      distance: 1 - relevanceScore,
      relevanceScore,
    };
  })
    .filter((result) => result.relevanceScore > 0)
    .sort((left, right) => right.relevanceScore - left.relevanceScore)
    .slice(0, Math.max(1, Math.min(topK, 5)));
}

export function isChromaConnected(): boolean {
  return collection !== null;
}

/**
 * Add a document to the knowledge base.
 */
export async function addDocument(
  doc: KnowledgeDocument
): Promise<void> {
  if (!collection) {
    throw new Error("ChromaDB collection not initialized");
  }

  await collection.add({
    ids: [doc.id],
    documents: [doc.text],
    metadatas: [doc.metadata],
  });
}

/**
 * Delete a document from the knowledge base by ID.
 */
export async function deleteDocument(id: string): Promise<void> {
  if (!collection) return;
  await collection.delete({ ids: [id] });
}

/**
 * Check if ChromaDB is healthy.
 */
export async function checkChromaHealth(): Promise<boolean> {
  try {
    if (!chromaClient) return false;
    await chromaClient.heartbeat();
    return true;
  } catch {
    return false;
  }
}

// ── Seed Data ────────────────────────────────────────────────────────────────

async function seedKnowledgeBase(): Promise<void> {
  const faqs: KnowledgeDocument[] = [
    {
      id: "faq-001",
      text: "Blinkit delivers groceries in 10-20 minutes depending on your location. Delivery is available 24/7 in most cities. You can track your order in real time through the Blinkit app.",
      metadata: { source: "faq", category: "delivery", title: "Delivery Time & Tracking" },
    },
    {
      id: "faq-002",
      text: "To cancel an order on Blinkit, open the Orders section in the app, select the order you want to cancel, and tap 'Cancel Order'. Orders can only be cancelled before they are picked up by the delivery partner. Once picked up, cancellation is not possible.",
      metadata: { source: "faq", category: "order", title: "How to Cancel an Order" },
    },
    {
      id: "faq-003",
      text: "Blinkit's refund policy: If you received a wrong, damaged, or expired product, you are eligible for a full refund. Refunds are credited to your original payment method within 5-7 business days, or immediately to Blinkit wallet. To initiate a refund, go to Orders → select the item → Report an Issue.",
      metadata: { source: "policy", category: "refund", title: "Refund Policy" },
    },
    {
      id: "faq-004",
      text: "Blinkit accepts all major payment methods: Credit/Debit cards (Visa, Mastercard, Amex), UPI (GPay, PhonePe, Paytm), Net Banking, and Cash on Delivery (COD) in select areas. Blinkit wallet and gift cards are also accepted.",
      metadata: { source: "faq", category: "payment", title: "Accepted Payment Methods" },
    },
    {
      id: "faq-005",
      text: "Blinkit Pass is a subscription service offering free unlimited deliveries and exclusive member discounts. The monthly plan costs ₹49 and the annual plan costs ₹399. Benefits include zero delivery fees, priority support, and member-only offers.",
      metadata: { source: "product", category: "subscription", title: "Blinkit Pass Subscription" },
    },
    {
      id: "faq-006",
      text: "If you received a damaged item, please report it within 48 hours of delivery. Go to Orders → select the order → Report Issue → Damaged Item. Upload a photo of the damage. You will receive a full refund or replacement within 24 hours.",
      metadata: { source: "policy", category: "damage", title: "Damaged Item Policy" },
    },
    {
      id: "faq-007",
      text: "Delivery charges on Blinkit depend on your order value and distance. Orders above ₹199 get free delivery. For orders below ₹199, a delivery fee of ₹25-₹40 may apply. Surge pricing may apply during peak hours or bad weather.",
      metadata: { source: "faq", category: "delivery", title: "Delivery Charges" },
    },
    {
      id: "faq-008",
      text: "To track your order, open the Blinkit app and tap on 'Orders'. You will see a live map with your delivery partner's location. You can also call or message the delivery partner through the app. SMS notifications are sent at each status change.",
      metadata: { source: "faq", category: "order", title: "Order Tracking" },
    },
    {
      id: "faq-009",
      text: "Blinkit's return policy: Most grocery and household items cannot be returned after delivery except in cases of damage, expiry, or wrong item delivery. Sealed products in original packaging may be returned within 24 hours.",
      metadata: { source: "policy", category: "return", title: "Return Policy" },
    },
    {
      id: "faq-010",
      text: "To contact Blinkit customer support: Use in-app chat (fastest), call 1800-XXX-XXXX (toll-free, 8 AM – 10 PM), or email support@blinkit.com. For urgent issues like missing orders or wrong deliveries, use the in-app chat for fastest resolution.",
      metadata: { source: "faq", category: "support", title: "Contact Customer Support" },
    },
    {
      id: "faq-011",
      text: "Blinkit operates in 30+ cities across India including Delhi-NCR, Mumbai, Bangalore, Hyderabad, Pune, Chennai, Kolkata, Jaipur, Lucknow, and more. Check the app or website to see if delivery is available in your area.",
      metadata: { source: "faq", category: "general", title: "Service Areas" },
    },
    {
      id: "faq-012",
      text: "If your payment was deducted but the order was not placed, the amount will be automatically refunded to your original payment method within 5-7 business days. If you paid via UPI or wallet, refund is typically instant. Contact support with your transaction ID if the refund does not appear.",
      metadata: { source: "policy", category: "payment", title: "Payment Deducted But Order Not Placed" },
    },
    {
      id: "faq-013",
      text: "To apply a coupon or promo code on Blinkit: Add items to your cart, go to checkout, and enter the promo code in the 'Apply Coupon' field. The discount will be applied instantly. Coupons cannot be combined unless stated otherwise. Expired or invalid codes will show an error.",
      metadata: { source: "faq", category: "discount", title: "Applying Coupons & Promo Codes" },
    },
    {
      id: "faq-014",
      text: "Blinkit offers scheduled deliveries for orders you want at a specific time. Go to cart, select 'Schedule Delivery', and choose your preferred 30-minute window. Scheduled deliveries are available up to 24 hours in advance.",
      metadata: { source: "faq", category: "delivery", title: "Scheduled Delivery" },
    },
    {
      id: "faq-015",
      text: "Your Blinkit account stores your delivery addresses, order history, saved payment methods, and preferences. To update your profile, go to Account → Edit Profile. You can add up to 5 delivery addresses. Account deletion requests take 30 days to process.",
      metadata: { source: "faq", category: "account", title: "Account Management" },
    },
  ];

  if (!collection) return;

  await collection.add({
    ids: faqs.map((f) => f.id),
    documents: faqs.map((f) => f.text),
    metadatas: faqs.map((f) => f.metadata),
  });

  console.log(`[RAG] Seeded ${faqs.length} FAQ documents into ChromaDB.`);
}
