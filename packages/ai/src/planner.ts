import { INTENTS } from "../../shared/types.ts";
import type { IntentPlan, IntentPlanner } from "./contracts.ts";
import { SYSTEM_PROMPT } from "./prompt.ts";
import { INTENT_PLAN_SCHEMA } from "./schemas.ts";

export function validatePlan(value: unknown): IntentPlan {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid plan");
  const p = value as Record<string, unknown>;
  if (Object.keys(p).some(key => !["intent", "query", "productIds", "quantity", "store"].includes(key))) throw new Error("Unexpected plan field");
  if (!INTENTS.includes(p.intent as IntentPlan["intent"])) throw new Error("Invalid intent");
  if (p.query !== undefined && (typeof p.query !== "string" || p.query.length > 2000)) throw new Error("Invalid query");
  if (p.store !== undefined && (typeof p.store !== "string" || p.store.length > 100)) throw new Error("Invalid store");
  if (p.quantity !== undefined && (!Number.isSafeInteger(p.quantity) || (p.quantity as number) < 1 || (p.quantity as number) > 1000000)) throw new Error("Invalid quantity");
  if (p.productIds !== undefined && (!Array.isArray(p.productIds) || p.productIds.length > 3 || p.productIds.some(id => !Number.isSafeInteger(id) || id < 1))) throw new Error("Invalid products");
  return p as unknown as IntentPlan;
}

/** Plug in the team's LLM here. No SDK, credentials or provider assumptions. */
export class JsonIntentPlanner implements IntentPlanner {
  private readonly generate: (request: { system: string; input: string; schema: unknown }) => Promise<unknown>;
  constructor(generate: (request: { system: string; input: string; schema: unknown }) => Promise<unknown>) {
    this.generate = generate;
  }
  async plan(input: Parameters<IntentPlanner["plan"]>[0]): Promise<IntentPlan> {
    const result = await this.generate({ system: SYSTEM_PROMPT, input: JSON.stringify(input), schema: INTENT_PLAN_SCHEMA });
    return validatePlan(typeof result === "string" ? JSON.parse(result) : result);
  }
}
