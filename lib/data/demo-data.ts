import type { LineItem, Order, ProductCategory } from "@/lib/types";

type Product = {
  name: string;
  category: ProductCategory;
  sku: string;
  price: number;
  replenishmentDays?: number;
};

const products: Product[] = [
  {
    name: "Daily Gel Cleanser",
    category: "Cleanser",
    sku: "LS-CLE-100",
    price: 32,
    replenishmentDays: 31,
  },
  {
    name: "Barrier Repair Cream",
    category: "Moisturizer",
    sku: "LS-MOI-050",
    price: 44,
    replenishmentDays: 42,
  },
  {
    name: "Vitamin C Serum",
    category: "Serum",
    sku: "LS-SER-C15",
    price: 68,
    replenishmentDays: 55,
  },
  {
    name: "Retinol Night Serum",
    category: "Serum",
    sku: "LS-SER-R02",
    price: 74,
    replenishmentDays: 65,
  },
  {
    name: "Hydration Toner",
    category: "Toner",
    sku: "LS-TON-150",
    price: 28,
    replenishmentDays: 38,
  },
  {
    name: "SPF Day Cream",
    category: "SPF",
    sku: "LS-SPF-050",
    price: 36,
    replenishmentDays: 45,
  },
  {
    name: "Glow Routine Set",
    category: "Set",
    sku: "LS-SET-GLOW",
    price: 118,
    replenishmentDays: 48,
  },
];

function createRng(seed = 42) {
  let value = seed;

  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function pick<T>(items: T[], random: () => number) {
  return items[Math.floor(random() * items.length)];
}

function makeItems(random: () => number, firstOrder: boolean, premium: boolean): LineItem[] {
  const main = premium
    ? pick(products.filter((product) => product.category === "Serum" || product.category === "Set"), random)
    : pick(products, random);
  const items: LineItem[] = [
    {
      productName: main.name,
      productCategory: main.category,
      sku: main.sku,
      quantity: 1,
      lineValue: main.price,
    },
  ];

  if (firstOrder && random() > 0.62) {
    const addOn = pick(products.filter((product) => product.sku !== main.sku), random);
    items.push({
      productName: addOn.name,
      productCategory: addOn.category,
      sku: addOn.sku,
      quantity: 1,
      lineValue: addOn.price,
    });
  }

  return items;
}

function orderValue(items: LineItem[], discountAmount: number) {
  return Math.max(
    0,
    items.reduce((sum, item) => sum + item.lineValue * item.quantity, 0) - discountAmount,
  );
}

export function generateDemoOrders(customerCount = 4200): Order[] {
  const random = createRng(88);
  const orders: Order[] = [];
  /** Spread first purchases across completed months before Dec 2025 (matches DATA_AS_OF horizon). */
  const cohortFirstStart = new Date("2024-03-01T00:00:00.000Z");
  const cohortFirstEnd = new Date("2025-11-20T00:00:00.000Z");
  const cohortSpanMs = cohortFirstEnd.getTime() - cohortFirstStart.getTime();

  for (let index = 0; index < customerCount; index += 1) {
    const customerId = `cust_${String(index + 1).padStart(5, "0")}`;
    const firstDate = new Date(cohortFirstStart.getTime() + Math.floor(random() * cohortSpanMs));
    const month = firstDate.getMonth();
    const isHolidayCohort = month === 10 || month === 11;
    const discountFirst = isHolidayCohort ? random() < 0.58 : random() < 0.31;
    const premium = random() < 0.24;
    const firstItems = makeItems(random, true, premium);
    const firstDiscount = discountFirst ? Math.round(orderValue(firstItems, 0) * 0.18) : 0;

    orders.push({
      orderId: `LS-${String(index + 1).padStart(6, "0")}-1`,
      customerId,
      orderDate: isoDate(firstDate),
      orderValue: orderValue(firstItems, firstDiscount),
      discountAmount: firstDiscount,
      discountCode: discountFirst ? "WELCOME20" : undefined,
      items: firstItems,
    });

    const baseSecondProbability = premium ? 0.31 : 0.23;
    const adjustedSecondProbability = discountFirst
      ? baseSecondProbability - 0.08
      : baseSecondProbability + 0.04;
    const secondProbability = isHolidayCohort
      ? adjustedSecondProbability - 0.04
      : adjustedSecondProbability;

    if (random() < secondProbability) {
      const firstCategory = firstItems[0]?.productCategory;
      const replenishmentWindow =
        products.find((product) => product.category === firstCategory)?.replenishmentDays ?? 40;
      const jitter = Math.floor(random() * 22) - 8;
      const secondDate = addDays(firstDate, Math.max(12, replenishmentWindow + jitter));
      const secondItems = makeItems(random, false, premium);
      const secondDiscount = discountFirst && random() < 0.38 ? 8 : 0;

      orders.push({
        orderId: `LS-${String(index + 1).padStart(6, "0")}-2`,
        customerId,
        orderDate: isoDate(secondDate),
        orderValue: orderValue(secondItems, secondDiscount),
        discountAmount: secondDiscount,
        discountCode: secondDiscount > 0 ? "NEXT8" : undefined,
        items: secondItems,
      });

      if (random() < 0.58) {
        const thirdDate = addDays(secondDate, 35 + Math.floor(random() * 42));
        const thirdItems = makeItems(random, false, premium);
        orders.push({
          orderId: `LS-${String(index + 1).padStart(6, "0")}-3`,
          customerId,
          orderDate: isoDate(thirdDate),
          orderValue: orderValue(thirdItems, 0),
          discountAmount: 0,
          items: thirdItems,
        });

        if (random() < 0.34) {
          const fourthDate = addDays(thirdDate, 28 + Math.floor(random() * 38));
          const fourthItems = makeItems(random, false, premium);
          orders.push({
            orderId: `LS-${String(index + 1).padStart(6, "0")}-4`,
            customerId,
            orderDate: isoDate(fourthDate),
            orderValue: orderValue(fourthItems, 0),
            discountAmount: 0,
            items: fourthItems,
          });

          if (random() < 0.28) {
            const fifthDate = addDays(fourthDate, 24 + Math.floor(random() * 32));
            const fifthItems = makeItems(random, false, premium);
            orders.push({
              orderId: `LS-${String(index + 1).padStart(6, "0")}-5`,
              customerId,
              orderDate: isoDate(fifthDate),
              orderValue: orderValue(fifthItems, 0),
              discountAmount: 0,
              items: fifthItems,
            });
          }
        }
      }
    }
  }

  return orders.sort(
    (a, b) => new Date(a.orderDate).getTime() - new Date(b.orderDate).getTime(),
  );
}
