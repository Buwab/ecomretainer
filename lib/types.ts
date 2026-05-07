export type ProductCategory =
  | "Cleanser"
  | "Moisturizer"
  | "Serum"
  | "SPF"
  | "Toner"
  | "Mask"
  | "Set";

export type LineItem = {
  productName: string;
  productCategory: ProductCategory | string;
  sku: string;
  quantity: number;
  lineValue: number;
};

export type Order = {
  orderId: string;
  customerId: string;
  orderDate: string;
  orderValue: number;
  discountAmount: number;
  discountCode?: string;
  items: LineItem[];
};

export type CustomerProfile = {
  customerId: string;
  orders: Order[];
  firstOrder: Order;
  firstPurchaseDate: Date;
  cohortMonth: string;
  yearOneSpend: number;
  secondOrder?: Order;
  daysToSecond?: number;
};

export type CohortMetric = {
  cohortMonth: string;
  customers: number;
  averageYearOneSpend: number;
  secondPurchaseRate: number;
  thirdPurchaseRate: number;
  fourthPurchaseRate: number;
  fifthPurchaseRate: number;
  medianDaysToSecond: number | null;
  refundWarningRate: number;
  discountFirstBuyerRate: number;
  /** Mutually exclusive with discount: no discount, first order value ≥ threshold */
  premiumNonDiscountRate: number;
  /** Rest of cohort after discount vs premium split */
  otherAcquisitionRate: number;
  contextNote: string;
};

export type CohortMatrixMode = "purchaseProgression" | "monthlyRetention";

export type CohortMatrixColumn = {
  key: string;
  label: string;
};

export type CohortMatrixRow = {
  cohortMonth: string;
  customers: number;
  averageYearOneSpend: number;
  values: Record<string, number>;
};

export type SegmentMetric = {
  id: string;
  name: string;
  description: string;
  customers: number;
  share: number;
  secondPurchaseRate: number;
  averageYearOneSpend: number;
  medianDaysToSecond: number | null;
};

export type ScenarioPreset = "conservative" | "realistic" | "ambitious";

export type Scenario = {
  preset: ScenarioPreset;
  label: string;
  targetLiftPoints: number;
};

export type UpliftResult = {
  currentSecondPurchaseRate: number;
  targetSecondPurchaseRate: number;
  extraSecondPurchases: number;
  extraRevenuePerCustomer: number;
  revenuePerExtraSecondBuyer: number;
  totalExtraRevenue: number;
  downstreamRevenue: number;
};

/** First-order mix for a set of customers (same rules as cohort metrics). */
export type CohortAcquisitionMix = {
  customers: number;
  discountFirstBuyerRate: number;
  premiumNonDiscountRate: number;
  otherAcquisitionRate: number;
};

export type CohortSecondCurvePoint = {
  month: number;
  /** Cumulative share with a 2nd order within M months of first purchase; null if Year 1 not observable yet. */
  rate: number | null;
};

/** Cumulative Year 1 order revenue for a cohort by months since activation. */
export type CohortRevenueCurvePoint = {
  month: number;
  revenue: number | null;
};

export type CohortDepthScenarioResult = {
  baselineYearOneRevenue: number;
  modeledYearOneRevenue: number;
  incrementalRevenue: number;
  secondLift: UpliftResult;
  incrementalFromThird: number;
  incrementalFromFourth: number;
  incrementalFromFifth: number;
};

export type Recommendation = {
  id: string;
  priority: number;
  play: string;
  targetSegment: string;
  observedSignal: string;
  timing: string;
  contentAngle: string;
  expectedImpact: number;
  primaryKpi: string;
  impact: "Low" | "Medium" | "High";
  confidence: "Low" | "Medium" | "High";
  ease: "Low" | "Medium" | "High";
};
