import Papa from "papaparse";
import { z } from "zod";
import type { LineItem, Order } from "@/lib/types";

type MappingKey =
  | "orderId"
  | "customerId"
  | "orderDate"
  | "orderValue"
  | "discountAmount"
  | "discountCode"
  | "productName"
  | "productCategory"
  | "sku"
  | "quantity"
  | "lineValue";

export type ColumnMapping = Partial<Record<MappingKey, string>>;

export type ImportPreview = {
  headers: string[];
  mapping: ColumnMapping;
  rows: Record<string, string | undefined>[];
};

const aliases: Record<MappingKey, string[]> = {
  orderId: ["order_id", "order id", "name", "order"],
  customerId: ["customer_id_hash", "customer id", "customer", "email hash", "email"],
  orderDate: ["order_date", "created at", "paid at", "date"],
  orderValue: ["order_value", "total", "subtotal", "current total price"],
  discountAmount: ["discount_amount", "discount amount", "discounts", "total discounts"],
  discountCode: ["discount_code", "discount code", "discount codes"],
  productName: ["product_name", "lineitem name", "line item name", "product", "title"],
  productCategory: ["product_category", "category", "product type", "type"],
  sku: ["sku", "lineitem sku", "line item sku"],
  quantity: ["quantity", "lineitem quantity", "line item quantity"],
  lineValue: ["line_item_value", "lineitem price", "line item price", "price"],
};

const rawRowSchema = z.record(z.string(), z.string().optional());

function normalizeHeader(header: string) {
  return header.trim().toLowerCase();
}

function parseNumber(value: string | undefined) {
  if (!value) return 0;
  const normalized = value.replace(/[€,]/g, "").trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function detectMapping(headers: string[]): ColumnMapping {
  const normalizedHeaders = headers.map((header) => ({
    original: header,
    normalized: normalizeHeader(header),
  }));

  return Object.fromEntries(
    Object.entries(aliases).flatMap(([key, candidates]) => {
      const match = normalizedHeaders.find((header) =>
        candidates.includes(header.normalized),
      );
      return match ? [[key, match.original]] : [];
    }),
  ) as ColumnMapping;
}

export function parseCsvPreview(file: File): Promise<ImportPreview> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      preview: 8,
      skipEmptyLines: true,
      complete: (result) => {
        const headers = result.meta.fields ?? [];
        resolve({
          headers,
          mapping: detectMapping(headers),
          rows: result.data.map((row) => rawRowSchema.parse(row)),
        });
      },
      error: reject,
    });
  });
}

export function parseCsvOrders(file: File, mapping: ColumnMapping): Promise<Order[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        try {
          const grouped = new Map<string, Order>();

          for (const row of result.data) {
            const orderId = row[mapping.orderId ?? ""];
            const customerId = row[mapping.customerId ?? ""];
            const orderDate = row[mapping.orderDate ?? ""];
            const productName = row[mapping.productName ?? ""] ?? "Unknown product";

            if (!orderId || !customerId || !orderDate) continue;

            const lineValue = parseNumber(row[mapping.lineValue ?? ""]);
            const orderValue = parseNumber(row[mapping.orderValue ?? ""]);
            const discountAmount = parseNumber(row[mapping.discountAmount ?? ""]);
            const quantity = Math.max(1, parseNumber(row[mapping.quantity ?? ""]) || 1);
            const item: LineItem = {
              productName,
              productCategory: row[mapping.productCategory ?? ""] ?? "Uncategorized",
              sku: row[mapping.sku ?? ""] ?? productName.toLowerCase().replaceAll(" ", "-"),
              quantity,
              lineValue: lineValue || orderValue,
            };

            const existing = grouped.get(orderId);
            if (existing) {
              existing.items.push(item);
              existing.orderValue = orderValue || existing.orderValue + item.lineValue * quantity;
            } else {
              grouped.set(orderId, {
                orderId,
                customerId,
                orderDate,
                orderValue: orderValue || item.lineValue * quantity - discountAmount,
                discountAmount,
                discountCode: row[mapping.discountCode ?? ""],
                items: [item],
              });
            }
          }

          resolve([...grouped.values()]);
        } catch (error) {
          reject(error);
        }
      },
      error: reject,
    });
  });
}

export function validateRequiredMapping(mapping: ColumnMapping) {
  const missing: MappingKey[] = [];

  for (const key of ["orderId", "customerId", "orderDate"] as const) {
    if (!mapping[key]) missing.push(key);
  }

  if (!mapping.orderValue && !mapping.lineValue) {
    missing.push("orderValue");
  }

  if (!mapping.productName && !mapping.productCategory) {
    missing.push("productName");
  }

  return missing;
}
