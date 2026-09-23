// Verbatim fallback from the brief. No shared package exists in this workspace.
// When integrating, point @contract in tsconfig.json to packages/shared/types.ts.
export interface Product {
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
  properties?: Record<string, unknown>;
  stores?: StoreStock[];
  certificates?: Certificate[];
  dataQualityWarnings?: DataQualityWarning[];
}
export interface StoreStock {
  id: number;
  name: string;
  quantity: number;
}
export interface Certificate {
  name: string;
  url: string;
}
export interface DataQualityWarning {
  field: string;
  message: string;
  sources?: Record<string, string>;
}
export interface ChatResponse {
  message: string;
  products?: Product[];
  warnings?: DataQualityWarning[];
  pendingAction?: {
    type: "ADD_TO_CART";
    productId: number;
    quantity: number;
  } | null;
  cart?: { success: boolean; cartUrl?: string | null } | null;
}
