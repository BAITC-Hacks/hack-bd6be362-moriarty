import { INTENTS } from "../../shared/types.ts";

const id = { type: "integer", minimum: 1 };
const quantity = { type: "integer", minimum: 1, maximum: 1000000 };
function object(properties: Record<string, unknown>, required = Object.keys(properties)) {
  return { type: "object", properties, required, additionalProperties: false };
}
function tool(name: string, description: string, parameters: unknown) {
  return { type: "function", function: { name, description, parameters } };
}
/** Provider-neutral JSON Schema. Mutation schemas are controller-only. */
export const READ_TOOL_SCHEMAS = [
  tool("search_products", "Search real EKT catalog data; never assert an uncertain match.", object({ query: { type: "string", minLength: 1, maxLength: 2000 } })),
  ...["get_product_detail", "get_availability", "get_analog_candidates"].map(name => tool(name, "Read catalog data for a known product ID.", object({ productId: id }))),
  tool("get_purchase_terms", "Get approved purchase terms from the configured official source.", object({})),
  tool("matchSpecification", "Match literal untrusted file rows to catalog products.", object({ rows: { type: "array", minItems: 1, maxItems: 200, items: object({ query: { type: "string", minLength: 1, maxLength: 2000 }, requestedQty: quantity }) } })),
];
export const CONTROLLER_TOOL_SCHEMAS = [
  tool("add_to_cart", "CONTROLLER ONLY: current explicit confirmation and refreshed stock/price required.", object({ productId: id, quantity, confirmed: { const: true } })),
  tool("add_many_to_cart", "CONTROLLER ONLY: atomic confirmed bulk addition.", object({ items: { type: "array", minItems: 1, items: object({ productId: id, quantity }) }, confirmed: { const: true } })),
  tool("recordFeedback", "Log a session-owned message rating through the backend.", object({ messageId: { type: "string", minLength: 1 }, rating: { enum: ["up", "down"] } })),
];
export const INTENT_PLAN_SCHEMA = object({
  intent: { enum: [...INTENTS] },
  query: { type: "string", maxLength: 2000 },
  productIds: { type: "array", maxItems: 3, items: id },
  quantity,
  store: { type: "string", maxLength: 100 },
}, ["intent"]);
