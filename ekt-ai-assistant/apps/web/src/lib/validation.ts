import { z } from "zod";
const number = z.number().finite();
const warning = z.object({
  field: z.string(),
  message: z.string(),
  sources: z.record(z.string(), z.string()).optional(),
});
export const productSchema = z.object({
  id: number,
  name: z.string(),
  article: z.string().nullable(),
  supplierArticle: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  price: number.nullable(),
  quantity: number.nullable().optional(),
  image: z.string().nullable().optional(),
  productUrl: z.string().nullable().optional(),
  brand: z.string().nullable().optional(),
  properties: z.record(z.string(), z.unknown()).optional(),
  stores: z
    .array(z.object({ id: number, name: z.string(), quantity: number }))
    .optional(),
  certificates: z
    .array(z.object({ name: z.string(), url: z.string() }))
    .optional(),
  dataQualityWarnings: z.array(warning).optional(),
});
export const chatSchema = z.object({
  message: z.string(),
  products: z.array(productSchema).optional(),
  warnings: z.array(warning).optional(),
  pendingAction: z
    .object({
      type: z.literal("ADD_TO_CART"),
      productId: number,
      quantity: number,
    })
    .nullable()
    .optional(),
  cart: z
    .object({ success: z.boolean(), cartUrl: z.string().nullable().optional() })
    .nullable()
    .optional(),
});
export const extensionSchema = z.object({
  messageId: z.string().min(1).optional(),
  analogs: z
    .array(
      z.object({
        product: productSchema,
        reasons: z.array(z.string()),
        differences: z.array(z.string()),
      }),
    )
    .optional(),
  estimate: z
    .object({
      rows: z.array(
        z.object({
          requestText: z.string(),
          product: productSchema.optional(),
          status: z.enum(["found", "not_found", "analog"]),
          quantity: number.positive(),
          unitPrice: number.nullable().optional(),
          subtotal: number.nullable().optional(),
        }),
      ),
      total: number.nullable().optional(),
    })
    .optional(),
  comparison: z.array(productSchema).optional(),
  freshness: z
    .object({
      updatedAt: z.string().datetime({ offset: true }).optional(),
      cacheAgeSeconds: number.nonnegative().optional(),
      stale: z.boolean().optional(),
    })
    .optional(),
});
// TODO(BACKEND): approve upload response envelope. Unknown/processing statuses never count as processed.
export const uploadSchema = z.object({
  attachmentId: z.string().min(1),
  status: z.literal("processed"),
});
