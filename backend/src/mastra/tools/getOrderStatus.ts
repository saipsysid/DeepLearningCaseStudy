/**
 * Mastra Tool: getOrderStatus
 * Looks up a Blinkit order by order ID from the SQLite orders table
 * and returns its current status and key details.
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { dbHelpers } from "../../database/db";

export const getOrderStatus = createTool({
  id: "getOrderStatus",
  description:
    "Look up the status and details of a Blinkit order by its order ID. Use this when the customer mentions an order number (e.g. ORD-001).",
  inputSchema: z.object({
    orderId: z
      .string()
      .describe(
        "The order ID to look up (e.g. ORD-001). Extract from the user's message."
      ),
  }),
  outputSchema: z.object({
    found: z.boolean(),
    order: z
      .object({
        id: z.string(),
        customer_name: z.string(),
        status: z.string(),
        total_amount: z.number(),
        items: z.array(
          z.object({ name: z.string(), qty: z.number(), price: z.number() })
        ),
        delivery_address: z.string(),
        created_at: z.string(),
        delivered_at: z.string().nullable(),
        notes: z.string().nullable(),
      })
      .nullable(),
    message: z.string(),
  }),
  execute: async ({ context }) => {
    const { orderId } = context;

    // Normalize input: allow lowercase or without dash
    const normalized = orderId.toUpperCase().replace(/^(ORD)?-?(\d+)$/, "ORD-$2");

    const row = dbHelpers.getOrderById(normalized);

    if (!row) {
      return {
        found: false,
        order: null,
        message: `No order found with ID "${orderId}". Please double-check the order ID.`,
      };
    }

    let items: { name: string; qty: number; price: number }[] = [];
    try {
      items = JSON.parse(row.items);
    } catch {
      items = [];
    }

    const statusMessages: Record<string, string> = {
      pending: "Your order has been received and is being prepared.",
      processing: "Your order is being packed and will be dispatched shortly.",
      shipped: "Your order is on the way! Your delivery partner has picked it up.",
      delivered: "Your order has been delivered successfully.",
      cancelled: "This order was cancelled.",
      refund_requested: "A refund has been requested for this order and is being processed.",
      refunded: "The refund for this order has been completed.",
    };

    return {
      found: true,
      order: {
        id: row.id,
        customer_name: row.customer_name,
        status: row.status,
        total_amount: row.total_amount,
        items,
        delivery_address: row.delivery_address,
        created_at: row.created_at,
        delivered_at: row.delivered_at,
        notes: row.notes,
      },
      message:
        statusMessages[row.status] ??
        `Order status: ${row.status}`,
    };
  },
});
