import type {
  CohortAcquisitionMix,
  CohortDepthScenarioResult,
  CohortMatrixColumn,
  CohortMatrixMode,
  CohortMatrixRow,
  CohortMetric,
  CohortRevenueCurvePoint,
  CohortSecondCurvePoint,
  CustomerProfile,
  Order,
  Recommendation,
  Scenario,
  SegmentMetric,
  UpliftResult,
} from "@/lib/types";

const YEAR_DAYS = 365;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Evaluation date for “mature” Year 1 and running-cohort views (must match demo CSV horizon). */
export const DATA_AS_OF = new Date("2025-12-31");

export const scenarios: Scenario[] = [
  { preset: "conservative", label: "Conservative", targetLiftPoints: 2 },
  { preset: "realistic", label: "Realistic", targetLiftPoints: 5 },
  { preset: "ambitious", label: "Ambitious", targetLiftPoints: 8 },
];

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthsBetween(start: Date, end: Date) {
  return (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth();
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values: number[]) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[middle - 1] + sorted[middle]) / 2)
    : sorted[middle];
}

export function buildCustomerProfiles(orders: Order[]): CustomerProfile[] {
  const grouped = new Map<string, Order[]>();

  for (const order of orders) {
    const existing = grouped.get(order.customerId) ?? [];
    existing.push(order);
    grouped.set(order.customerId, existing);
  }

  return [...grouped.entries()].map(([customerId, customerOrders]) => {
    const sortedOrders = [...customerOrders].sort(
      (a, b) => new Date(a.orderDate).getTime() - new Date(b.orderDate).getTime(),
    );
    const firstOrder = sortedOrders[0];
    const firstPurchaseDate = new Date(firstOrder.orderDate);
    const yearOneSpend = sortedOrders
      .filter(
        (order) =>
          new Date(order.orderDate).getTime() - firstPurchaseDate.getTime() <=
          YEAR_DAYS * DAY_MS,
      )
      .reduce((sum, order) => sum + order.orderValue, 0);
    const secondOrder = sortedOrders[1];
    const daysToSecond = secondOrder
      ? Math.round(
          (new Date(secondOrder.orderDate).getTime() - firstPurchaseDate.getTime()) / DAY_MS,
        )
      : undefined;

    return {
      customerId,
      orders: sortedOrders,
      firstOrder,
      firstPurchaseDate,
      cohortMonth: monthKey(firstPurchaseDate),
      yearOneSpend,
      secondOrder,
      daysToSecond,
    };
  });
}

export function getMatureProfiles(profiles: CustomerProfile[], asOf: Date = DATA_AS_OF) {
  return profiles.filter(
    (profile) => asOf.getTime() - profile.firstPurchaseDate.getTime() >= YEAR_DAYS * DAY_MS,
  );
}

export function calculateCohorts(profiles: CustomerProfile[]): CohortMetric[] {
  const grouped = new Map<string, CustomerProfile[]>();

  for (const profile of profiles) {
    const existing = grouped.get(profile.cohortMonth) ?? [];
    existing.push(profile);
    grouped.set(profile.cohortMonth, existing);
  }

  return [...grouped.entries()]
    .map(([cohortMonth, cohortProfiles]) => {
      const customers = cohortProfiles.length;
      const repeatCustomers = cohortProfiles.filter((profile) => profile.orders.length >= 2).length;
      const thirdCustomers = cohortProfiles.filter((profile) => profile.orders.length >= 3).length;
      const fourthCustomers = cohortProfiles.filter((profile) => profile.orders.length >= 4).length;
      const fifthCustomers = cohortProfiles.filter((profile) => profile.orders.length >= 5).length;
      const discountCount = cohortProfiles.filter(
        (profile) => profile.firstOrder.discountAmount > 0,
      ).length;
      const discountFirstBuyerRate = discountCount / customers;
      const premiumNonDiscountCount = cohortProfiles.filter(
        (profile) =>
          profile.firstOrder.discountAmount <= 0 && profile.firstOrder.orderValue >= 85,
      ).length;
      const premiumNonDiscountRate = premiumNonDiscountCount / customers;
      const otherAcquisitionRate = Math.max(
        0,
        1 - discountFirstBuyerRate - premiumNonDiscountRate,
      );
      const refundWarningRate = cohortMonth.endsWith("-11") ? 0.11 : 0.04;
      const daysToSecond = cohortProfiles
        .map((profile) => profile.daysToSecond)
        .filter((value): value is number => typeof value === "number");
      const contextNote =
        discountFirstBuyerRate > 0.45
          ? "Discount-heavy acquisition"
          : refundWarningRate > 0.08
            ? "Return / issue watch"
            : repeatCustomers / customers < 0.22
              ? "Low repeat conversion"
              : "Healthy baseline";

      return {
        cohortMonth,
        customers,
        averageYearOneSpend: average(cohortProfiles.map((profile) => profile.yearOneSpend)),
        secondPurchaseRate: repeatCustomers / customers,
        thirdPurchaseRate: thirdCustomers / customers,
        fourthPurchaseRate: fourthCustomers / customers,
        fifthPurchaseRate: fifthCustomers / customers,
        medianDaysToSecond: median(daysToSecond),
        refundWarningRate,
        discountFirstBuyerRate,
        premiumNonDiscountRate,
        otherAcquisitionRate,
        contextNote,
      };
    })
    .sort((a, b) => a.cohortMonth.localeCompare(b.cohortMonth));
}

export function calculateCohortMatrix(
  profiles: CustomerProfile[],
  mode: CohortMatrixMode,
): { columns: CohortMatrixColumn[]; rows: CohortMatrixRow[] } {
  const grouped = new Map<string, CustomerProfile[]>();

  for (const profile of profiles) {
    const existing = grouped.get(profile.cohortMonth) ?? [];
    existing.push(profile);
    grouped.set(profile.cohortMonth, existing);
  }

  const columns =
    mode === "purchaseProgression"
      ? [
          { key: "purchase2", label: "2nd purchase" },
          { key: "purchase3", label: "3rd purchase" },
          { key: "purchase4", label: "4th purchase" },
          { key: "purchase5", label: "5th purchase" },
        ]
      : Array.from({ length: 13 }, (_, month) => ({
          key: `month${month}`,
          label: `M${month}`,
        }));

  const rows = [...grouped.entries()]
    .map(([cohortMonth, cohortProfiles]) => {
      const customers = cohortProfiles.length;
      const values: Record<string, number> = {};

      if (mode === "purchaseProgression") {
        for (const column of columns) {
          const purchaseNumber = Number(column.key.replace("purchase", ""));
          values[column.key] =
            cohortProfiles.filter((profile) => profile.orders.length >= purchaseNumber).length /
            customers;
        }
      } else {
        for (const column of columns) {
          const monthIndex = Number(column.key.replace("month", ""));
          values[column.key] =
            cohortProfiles.filter((profile) =>
              profile.orders.some(
                (order) =>
                  monthsBetween(profile.firstPurchaseDate, new Date(order.orderDate)) ===
                  monthIndex,
              ),
            ).length / customers;
        }
      }

      return {
        cohortMonth,
        customers,
        averageYearOneSpend: average(cohortProfiles.map((profile) => profile.yearOneSpend)),
        values,
      };
    })
    .sort((a, b) => a.cohortMonth.localeCompare(b.cohortMonth));

  return { columns, rows };
}

export function calculateSegments(profiles: CustomerProfile[]): SegmentMetric[] {
  const segmentDefs = [
    {
      id: "discount-first",
      name: "Discount first buyers",
      description: "First order included a discount code or discount amount.",
      filter: (profile: CustomerProfile) => profile.firstOrder.discountAmount > 0,
    },
    {
      id: "premium-first",
      name: "Premium first buyers",
      description: "First order value is above the premium threshold.",
      filter: (profile: CustomerProfile) => profile.firstOrder.orderValue >= 85,
    },
    {
      id: "replenishment",
      name: "Replenishment candidates",
      description: "First order contains a replenishable skincare staple.",
      filter: (profile: CustomerProfile) =>
        profile.firstOrder.items.some((item) =>
          ["Cleanser", "Moisturizer", "SPF"].includes(item.productCategory),
        ),
    },
    {
      id: "single-product",
      name: "Single-product starters",
      description: "First order included one product, creating routine-building potential.",
      filter: (profile: CustomerProfile) => profile.firstOrder.items.length === 1,
    },
  ];

  return segmentDefs.map((segment) => {
    const matchingProfiles = profiles.filter(segment.filter);
    const daysToSecond = matchingProfiles
      .map((profile) => profile.daysToSecond)
      .filter((value): value is number => typeof value === "number");
    const repeatCustomers = matchingProfiles.filter((profile) => profile.orders.length >= 2).length;

    return {
      id: segment.id,
      name: segment.name,
      description: segment.description,
      customers: matchingProfiles.length,
      share: matchingProfiles.length / profiles.length,
      secondPurchaseRate:
        matchingProfiles.length > 0 ? repeatCustomers / matchingProfiles.length : 0,
      averageYearOneSpend: average(matchingProfiles.map((profile) => profile.yearOneSpend)),
      medianDaysToSecond: median(daysToSecond),
    };
  });
}

function upliftFromCurrentAndTarget(
  profiles: CustomerProfile[],
  secondPurchaseRate: number,
  targetSecondPurchaseRate: number,
): UpliftResult {
  const n = profiles.length;
  const liftRate = targetSecondPurchaseRate - secondPurchaseRate;
  const extraSecondPurchases = n * liftRate;
  const secondOrderValues = profiles
    .map((profile) => profile.secondOrder?.orderValue)
    .filter((value): value is number => typeof value === "number");
  const averageSecondOrderValue = average(secondOrderValues);
  const thirdGivenSecond =
    profiles.filter((profile) => profile.orders.length >= 3).length /
    Math.max(1, profiles.filter((profile) => profile.orders.length >= 2).length);
  const laterOrderValue = average(
    profiles.flatMap((profile) => profile.orders.slice(2).map((order) => order.orderValue)),
  );
  const downstreamRevenue = extraSecondPurchases * thirdGivenSecond * laterOrderValue;
  const directRevenue = extraSecondPurchases * averageSecondOrderValue;
  const totalExtraRevenue = directRevenue + downstreamRevenue;

  return {
    currentSecondPurchaseRate: secondPurchaseRate,
    targetSecondPurchaseRate,
    extraSecondPurchases,
    extraRevenuePerCustomer: totalExtraRevenue / Math.max(1, n),
    revenuePerExtraSecondBuyer: totalExtraRevenue / Math.max(1, extraSecondPurchases),
    totalExtraRevenue,
    downstreamRevenue,
  };
}

/** Model uplift for an arbitrary target 2nd-purchase rate (capped at 50%, floored at current). */
export function calculateUpliftForTargetRate(
  profiles: CustomerProfile[],
  targetSecondPurchaseRate: number,
): UpliftResult {
  const n = profiles.length;
  if (n === 0) {
    return {
      currentSecondPurchaseRate: 0,
      targetSecondPurchaseRate: 0,
      extraSecondPurchases: 0,
      extraRevenuePerCustomer: 0,
      revenuePerExtraSecondBuyer: 0,
      totalExtraRevenue: 0,
      downstreamRevenue: 0,
    };
  }
  const secondPurchaseRate =
    profiles.filter((profile) => profile.orders.length >= 2).length / n;
  const target = Math.min(0.5, Math.max(secondPurchaseRate, targetSecondPurchaseRate));
  return upliftFromCurrentAndTarget(profiles, secondPurchaseRate, target);
}

export function calculateUplift(
  profiles: CustomerProfile[],
  scenario: Scenario,
): UpliftResult {
  const n = profiles.length;
  if (n === 0) {
    return calculateUpliftForTargetRate([], 0);
  }
  const secondPurchaseRate =
    profiles.filter((profile) => profile.orders.length >= 2).length / n;
  const targetSecondPurchaseRate = Math.min(
    0.5,
    secondPurchaseRate + scenario.targetLiftPoints / 100,
  );
  return upliftFromCurrentAndTarget(profiles, secondPurchaseRate, targetSecondPurchaseRate);
}

export function cohortProfilesForMonth(
  profiles: CustomerProfile[],
  cohortMonth: string,
): CustomerProfile[] {
  return profiles.filter((profile) => profile.cohortMonth === cohortMonth);
}

export function acquisitionMixForProfiles(profiles: CustomerProfile[]): CohortAcquisitionMix {
  const customers = profiles.length;
  if (customers === 0) {
    return {
      customers: 0,
      discountFirstBuyerRate: 0,
      premiumNonDiscountRate: 0,
      otherAcquisitionRate: 0,
    };
  }
  const discountCount = profiles.filter((profile) => profile.firstOrder.discountAmount > 0).length;
  const discountFirstBuyerRate = discountCount / customers;
  const premiumNonDiscountCount = profiles.filter(
    (profile) =>
      profile.firstOrder.discountAmount <= 0 && profile.firstOrder.orderValue >= 85,
  ).length;
  const premiumNonDiscountRate = premiumNonDiscountCount / customers;
  const otherAcquisitionRate = Math.max(0, 1 - discountFirstBuyerRate - premiumNonDiscountRate);
  return {
    customers,
    discountFirstBuyerRate,
    premiumNonDiscountRate,
    otherAcquisitionRate,
  };
}

/** Months from first day of cohort month to as-of (used to cap Year-1 observability). */
export function cohortObservableYear1Months(
  cohortMonth: string,
  asOf: Date = DATA_AS_OF,
): number {
  const [y, m] = cohortMonth.split("-").map(Number);
  const cohortStart = new Date(y, m - 1, 1);
  return Math.min(12, Math.max(0, monthsBetween(cohortStart, asOf)));
}

export function calculateCohortCumulativeSecondCurve(
  cohortProfiles: CustomerProfile[],
  maxObservableMonthIndex: number,
): CohortSecondCurvePoint[] {
  const n = cohortProfiles.length;
  if (n === 0) return [];

  return Array.from({ length: 13 }, (_, month) => {
    if (month > maxObservableMonthIndex) {
      return { month, rate: null };
    }
    const reached = cohortProfiles.filter((profile) => {
      if (!profile.secondOrder) return false;
      return (
        monthsBetween(profile.firstPurchaseDate, new Date(profile.secondOrder.orderDate)) <=
        month
      );
    }).length;
    return { month, rate: reached / n };
  });
}

function orderWithinYearOne(profile: CustomerProfile, orderDate: Date): boolean {
  return orderDate.getTime() - profile.firstPurchaseDate.getTime() <= YEAR_DAYS * DAY_MS;
}

/** Excludes the as-of calendar month so recent “partial” cohorts line up with past completed months. */
export function isCohortEligibleForPastMonthsView(
  cohortMonth: string,
  asOf: Date = DATA_AS_OF,
): boolean {
  const cap = `${asOf.getFullYear()}-${String(asOf.getMonth() + 1).padStart(2, "0")}`;
  return cohortMonth < cap;
}

export function calculateCohortCumulativeYear1RevenueCurve(
  cohortProfiles: CustomerProfile[],
  maxObservableMonthIndex: number,
): CohortRevenueCurvePoint[] {
  const n = cohortProfiles.length;
  if (n === 0) return [];

  return Array.from({ length: 13 }, (_, month) => {
    if (month > maxObservableMonthIndex) {
      return { month, revenue: null };
    }
    let total = 0;
    for (const profile of cohortProfiles) {
      for (const order of profile.orders) {
        const orderDate = new Date(order.orderDate);
        if (!orderWithinYearOne(profile, orderDate)) continue;
        if (monthsBetween(profile.firstPurchaseDate, orderDate) <= month) {
          total += order.orderValue;
        }
      }
    }
    return { month, revenue: total };
  });
}

export function calculateCohortPurchaseDepthRates(profiles: CustomerProfile[]) {
  const n = profiles.length;
  if (n === 0) return { r2: 0, r3: 0, r4: 0, r5: 0 };
  return {
    r2: profiles.filter((p) => p.orders.length >= 2).length / n,
    r3: profiles.filter((p) => p.orders.length >= 3).length / n,
    r4: profiles.filter((p) => p.orders.length >= 4).length / n,
    r5: profiles.filter((p) => p.orders.length >= 5).length / n,
  };
}

function averageNthOrderValueYearOne(
  profiles: CustomerProfile[],
  oneBasedOrderIndex: 2 | 3 | 4 | 5,
): number {
  const idx = oneBasedOrderIndex - 1;
  const values: number[] = [];
  for (const profile of profiles) {
    const order = profile.orders[idx];
    if (!order) continue;
    const orderDate = new Date(order.orderDate);
    if (!orderWithinYearOne(profile, orderDate)) continue;
    values.push(order.orderValue);
  }
  return average(values);
}

export function calculateCohortDepthScenarioRevenue(
  profiles: CustomerProfile[],
  targets: { second: number; third: number; fourth: number; fifth: number },
): CohortDepthScenarioResult {
  const n = profiles.length;
  if (n === 0) {
    const emptyLift = calculateUpliftForTargetRate([], 0);
    return {
      baselineYearOneRevenue: 0,
      modeledYearOneRevenue: 0,
      incrementalRevenue: 0,
      secondLift: emptyLift,
      incrementalFromThird: 0,
      incrementalFromFourth: 0,
      incrementalFromFifth: 0,
    };
  }

  const rates = calculateCohortPurchaseDepthRates(profiles);
  const t2 = Math.min(0.5, Math.max(rates.r2, targets.second));
  const t3 = Math.min(0.55, Math.max(rates.r3, targets.third));
  const t4 = Math.min(0.45, Math.max(rates.r4, targets.fourth));
  const t5 = Math.min(0.32, Math.max(rates.r5, targets.fifth));

  const secondLift = calculateUpliftForTargetRate(profiles, t2);
  const inc3 = n * Math.max(0, t3 - rates.r3) * averageNthOrderValueYearOne(profiles, 3);
  const inc4 = n * Math.max(0, t4 - rates.r4) * averageNthOrderValueYearOne(profiles, 4);
  const inc5 = n * Math.max(0, t5 - rates.r5) * averageNthOrderValueYearOne(profiles, 5);

  const baseline = profiles.reduce((sum, profile) => sum + profile.yearOneSpend, 0);
  const incremental = secondLift.totalExtraRevenue + inc3 + inc4 + inc5;

  return {
    baselineYearOneRevenue: baseline,
    modeledYearOneRevenue: baseline + incremental,
    incrementalRevenue: incremental,
    secondLift: secondLift,
    incrementalFromThird: inc3,
    incrementalFromFourth: inc4,
    incrementalFromFifth: inc5,
  };
}

export function calculateTimingWindow(profiles: CustomerProfile[]) {
  const repeatDays = profiles
    .map((profile) => profile.daysToSecond)
    .filter((value): value is number => typeof value === "number" && value > 0);
  const peak = median(repeatDays) ?? 31;

  return {
    peak,
    start: Math.max(7, peak - 7),
    end: peak + 7,
  };
}

export function buildRecommendations(
  profiles: CustomerProfile[],
  uplift: UpliftResult,
): Recommendation[] {
  const segments = calculateSegments(profiles);
  const byId = new Map(segments.map((segment) => [segment.id, segment]));
  const discount = byId.get("discount-first");
  const replenishment = byId.get("replenishment");
  const premium = byId.get("premium-first");
  const singleProduct = byId.get("single-product");
  const timing = calculateTimingWindow(profiles);

  const candidates: Recommendation[] = [
    {
      id: "reorder-reminder",
      priority: 1,
      play: "Reorder reminder flow",
      targetSegment: "Replenishment candidates",
      observedSignal: `${Math.round((replenishment?.share ?? 0) * 100)}% of matured customers started with a replenishable product. Repeat purchases cluster around day ${timing.peak}.`,
      timing: `Day ${timing.start}-${timing.end} after first purchase`,
      contentAngle: "Running low? Replenish your routine with the products that fit your first order.",
      expectedImpact: uplift.totalExtraRevenue * 0.34,
      primaryKpi: "Second purchase rate within 45 days",
      impact: "High",
      confidence: "High",
      ease: "High",
    },
    {
      id: "second-purchase-incentive",
      priority: 2,
      play: "Second-purchase incentive",
      targetSegment: "Discount first buyers",
      observedSignal: `Discount first buyers represent ${Math.round((discount?.share ?? 0) * 100)}% of the cohort and show a lower second purchase rate than the overall baseline.`,
      timing: "Day 18-28 after first purchase",
      contentAngle: "Limited-time bundle threshold, next-order benefit, and routine completion.",
      expectedImpact: uplift.totalExtraRevenue * 0.28,
      primaryKpi: "Second purchase rate among discount first buyers",
      impact: "High",
      confidence: "Medium",
      ease: "High",
    },
    {
      id: "complete-routine",
      priority: 3,
      play: "Complete-the-routine cross-sell",
      targetSegment: "Single-product starters",
      observedSignal: `${Math.round((singleProduct?.share ?? 0) * 100)}% of first orders contain one product, leaving a clear routine-building opportunity.`,
      timing: "Day 10-21 after first purchase",
      contentAngle: "Build the full AM/PM skincare routine around the first product purchased.",
      expectedImpact: uplift.totalExtraRevenue * 0.2,
      primaryKpi: "Second order attach rate",
      impact: "Medium",
      confidence: "Medium",
      ease: "High",
    },
    {
      id: "premium-education",
      priority: 4,
      play: "Premium education flow",
      targetSegment: "Premium first buyers",
      observedSignal: `${Math.round((premium?.share ?? 0) * 100)}% of customers start with a high-value order and have above-average Year 1 spend potential.`,
      timing: "Day 14-30 after first purchase",
      contentAngle: "Results timeline, ingredient education, premium complements, and VIP framing.",
      expectedImpact: uplift.totalExtraRevenue * 0.14,
      primaryKpi: "Premium buyer repeat revenue",
      impact: "Medium",
      confidence: "Medium",
      ease: "Medium",
    },
    {
      id: "missed-window-winback",
      priority: 5,
      play: "Winback after missed window",
      targetSegment: "One-and-done risk",
      observedSignal: "Customers without a second purchase after the natural reorder window become harder to reactivate.",
      timing: `Day ${timing.end + 10}-${timing.end + 35} after first purchase`,
      contentAngle: "Reviews, objection handling, product finder, and a low-friction next step.",
      expectedImpact: uplift.totalExtraRevenue * 0.1,
      primaryKpi: "Recovered second purchases",
      impact: "Medium",
      confidence: "Low",
      ease: "Medium",
    },
  ];

  return candidates.slice(0, 3);
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatPercent(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(value);
}
