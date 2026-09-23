import type { ChatResponse, Product } from "@contract";
export type Language = "kk" | "ru";
export type UploadState = "idle" | "uploading" | "processed" | "failed";
export type Attachment = {
  localId: string;
  name: string;
  size: number;
  state: UploadState;
  attachmentId?: string;
  error?: string;
};
export type DataFreshness = {
  updatedAt?: string;
  cacheAgeSeconds?: number;
  stale?: boolean;
};
export type EstimateRow = {
  requestText: string;
  product?: Product;
  status: "found" | "not_found" | "analog";
  quantity: number;
  unitPrice?: number | null;
  subtotal?: number | null;
};
export type SpecEstimate = { rows: EstimateRow[]; total?: number | null };
export type Analog = {
  product: Product;
  reasons: string[];
  differences: string[];
};
// Proposed optional adapter fields, NOT modifications to the shared contract.
export type ResponseView = ChatResponse & {
  messageId?: string;
  analogs?: Analog[];
  estimate?: SpecEstimate;
  comparison?: Product[];
  freshness?: DataFreshness;
};
export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  createdAt: string;
  response?: ResponseView;
  attachmentNames?: string[];
};
export type ConfirmationItem = {
  productId: number;
  name: string;
  quantity: number;
  price: number | null;
};
export type PendingConfirmation = { items: ConfirmationItem[]; bulk?: boolean };
export type DemoScenario =
  | "product"
  | "stock"
  | "analog"
  | "cart"
  | "estimate"
  | "compare"
  | "warning"
  | "missing"
  | "error";
