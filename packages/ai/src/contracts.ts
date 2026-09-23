import type { Availability, CartLine, CartResult, Intent, Language, Product, PurchaseTerms, SearchResult, SpecificationResult, SpecificationRow } from "../../shared/types.ts";

export interface ReadContext { sessionId: string; fresh?: boolean }
export interface MutationContext {
  sessionId: string;
  confirmed: true;
  idempotencyKey: string;
  /** Adapter must atomically reject changed prices / insufficient stock. */
  expectedLines: CartLine[];
}
/** Implemented by person 1. Bind sessionId to the authenticated server session. */
export interface BackendTools {
  search_products(query: string, context: ReadContext): Promise<SearchResult>;
  get_product_detail(productId: number, context: ReadContext): Promise<Product>;
  get_availability(productId: number, context: ReadContext): Promise<Availability>;
  get_analog_candidates(productId: number, context: ReadContext): Promise<Product[]>;
  get_purchase_terms(context: ReadContext): Promise<PurchaseTerms>;
  matchSpecification(rows: SpecificationRow[], context: ReadContext): Promise<SpecificationResult>;
  add_to_cart(productId: number, quantity: number, confirmed: true, context: MutationContext): Promise<CartResult>;
  /** Atomic all-or-none operation, never a loop of single-item mutations. */
  add_many_to_cart(items: CartLine[], context: MutationContext): Promise<CartResult>;
  /** Required to resolve a timeout without risking a second cart mutation. */
  get_cart_action_status(actionId: string, context: ReadContext): Promise<
    { status: "succeeded"; result: CartResult } | { status: "not_applied" | "unknown" }
  >;
  recordFeedback(messageId: string, rating: "up" | "down", context: ReadContext): Promise<void>;
}
export interface Attachment {
  name: string;
  mimeType: string;
  bytes?: Uint8Array;
  /** Server-side extraction only. Never deserialize this directly from a public request. */
  extracted?: { success: true; text?: string; rows?: SpecificationRow[] } | { success: false };
}
export interface FileExtractor {
  extract(file: Attachment): Promise<{ success: boolean; text?: string; rows?: SpecificationRow[] }>;
}
export interface IntentPlan {
  intent: Intent;
  query?: string;
  productIds?: number[];
  quantity?: number;
  store?: string;
}
export interface IntentPlanner {
  plan(input: { text: string; language: Language; selectedProductId: number | null; recentProductIds: number[] }): Promise<IntentPlan>;
}
export interface ChatInput {
  sessionId: string;
  text?: string;
  language?: Language;
  attachments?: Attachment[];
  /** UI selection is checked against products previously returned in this session. */
  selectedProductId?: number;
  confirmation?: { actionId: string; decision: "confirm" | "cancel" };
}
export type AuditEvent = { event: "suspicious content in file" | "backend_error" | "planner_error"; sessionId: string };
