export type Language = "kk" | "ru";
export interface Freshness {
  fetchedAt?: string;
  source?: "ekt_api" | "cache" | "file";
  sourceName?: string;
  /** Import time is not the time the API data was fetched. */
  importedAt?: string;
}
export interface DataQualityWarning {
  field: string;
  message: string;
  sources?: Record<string, string>;
  values?: Record<string, string>;
}
export interface StoreStock { id: number; name: string; quantity: number | null }
export interface Certificate { name: string; url: string }
export interface Product extends Freshness {
  id: number;
  name: string;
  article: string | null;
  supplierArticle?: string | null;
  description?: string | null;
  price: number | null;
  quantity?: number | null;
  image?: string | null;
  productUrl?: string | null;
  brand?: string | null;
  category?: string | null;
  properties?: Record<string, unknown>;
  stores?: StoreStock[];
  certificates?: Certificate[];
  dataQualityWarnings?: DataQualityWarning[];
}
export interface Availability extends Freshness {
  total: number | null;
  available: boolean | null;
  stores: StoreStock[];
}
export interface SearchResult extends Freshness {
  items: Product[];
  /** Only the catalog/search service may assert a strong match. */
  exactMatchId?: number;
}
export interface PurchaseTerms extends Freshness {
  approved: boolean;
  sourceUrl?: string;
  payment?: string | null;
  delivery?: string | null;
  minimumOrder?: string | null;
}
export interface SpecificationRow { query: string; requestedQty: number }
export interface SpecificationMatch {
  inputQuery: string;
  matchedProduct: Product | null;
  status: "found" | "not_found" | "analog_suggested";
  analog: Product | null;
  requestedQty: number;
  availableQty: number | null;
  unitPrice: number | null;
  lineTotal: number | null;
}
export interface SpecificationResult extends Freshness {
  rows: SpecificationMatch[];
  totalFound: number;
  totalMissing: number;
  grandTotal: number | null;
}
export interface AnalogExplanation {
  product: Product;
  matches: string[];
  differences: string[];
  unknown: string[];
  exactReplacement: boolean;
  message: string;
}
export interface Estimate extends SpecificationResult {
  explanations: AnalogExplanation[];
  /** True if at least one found line has no known price. */
  incompleteTotal: boolean;
}
export interface CartLine { productId: number; quantity: number; unitPrice: number; storeId?: number }
export interface PendingAction {
  type: "ADD_TO_CART" | "ADD_MANY_TO_CART";
  actionId: string;
  productId?: number;
  quantity?: number;
  items: CartLine[];
  total: number;
  expiresAt: string;
}
export interface CartResult {
  success: boolean;
  cartUrl?: string | null;
  mocked?: boolean;
}
export interface ChatResponse {
  messageId: string;
  intent: Intent;
  message: string;
  products: Product[];
  warnings: DataQualityWarning[];
  pendingAction: PendingAction | null;
  cart: CartResult | null;
  analogs?: AnalogExplanation[];
  estimate?: Estimate;
  freshness?: Freshness[];
  error?: "INVALID_INPUT" | "BACKEND_UNAVAILABLE" | "EXTRACTION_FAILED" | "CART_OUTCOME_UNKNOWN";
}
export const INTENTS = [
  "PRODUCT_SEARCH", "PRODUCT_INFO", "PRICE_CHECK", "STOCK_CHECK", "STORE_STOCK_CHECK",
  "PRODUCT_COMPARE", "ANALOG_SEARCH", "PURCHASE_TERMS", "ADD_TO_CART_REQUEST",
  "ADD_TO_CART_CONFIRMATION", "FILE_PRODUCT_SEARCH", "SPEC_FILE_ESTIMATE", "UNKNOWN",
] as const;
export type Intent = typeof INTENTS[number];
