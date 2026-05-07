"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { generateDemoOrders } from "@/lib/data/demo-data";
import {
  acquisitionMixForProfiles,
  buildCustomerProfiles,
  buildRecommendations,
  calculateCohortCumulativeYear1RevenueCurve,
  calculateCohortDepthScenarioRevenue,
  calculateCohortMatrix,
  calculateCohortPurchaseDepthRates,
  calculateCohorts,
  calculateSegments,
  calculateTimingWindow,
  calculateUplift,
  cohortObservableYear1Months,
  cohortProfilesForMonth,
  DATA_AS_OF,
  formatCurrency,
  formatPercent,
  getMatureProfiles,
  isCohortEligibleForPastMonthsView,
  scenarios,
} from "@/lib/metrics/retention";
import { parseCsvOrders, parseCsvPreview, validateRequiredMapping } from "@/lib/import/csv";
import type { ColumnMapping, ImportPreview } from "@/lib/import/csv";
import type { CohortMatrixMode, Order, ScenarioPreset } from "@/lib/types";

const navItems = ["Overview", "Cohorts", "Scenario", "Timing", "Segments", "Action Plan"];
const demoCustomerCount = 64000;
const playTimingOptions = [
  {
    id: "reorder-reminder",
    label: "Reorder reminder",
    color: "#1d4ed8",
    signal: "Replenishment candidates",
    peakOffset: 0,
    intensity: 18,
    window: 7,
    note: "Use when replenishable products naturally cluster into a second-order window.",
  },
  {
    id: "second-purchase-incentive",
    label: "Second-purchase incentive",
    color: "#dc2626",
    signal: "Discount first buyers",
    peakOffset: -18,
    intensity: 14,
    window: 6,
    note: "Use earlier for discount-led buyers before the natural repeat window is missed.",
  },
  {
    id: "complete-routine",
    label: "Complete-the-routine",
    color: "#0f766e",
    signal: "Single-product starters",
    peakOffset: -30,
    intensity: 12,
    window: 5,
    note: "Use soon after activation while the first product experience is still fresh.",
  },
  {
    id: "premium-education",
    label: "Premium education",
    color: "#7c3aed",
    signal: "Premium first buyers",
    peakOffset: -22,
    intensity: 10,
    window: 8,
    note: "Use education before pushing another purchase, especially for higher-consideration products.",
  },
] as const;
type TimingPlayId = (typeof playTimingOptions)[number]["id"];

function labelForMappingKey(key: string) {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (match) => match.toUpperCase());
}

function niceStepForAxis(rough: number): number {
  if (!Number.isFinite(rough) || rough <= 0) return 1000;
  const exp = Math.floor(Math.log10(rough));
  const base = 10 ** exp;
  const f = rough / base;
  const n = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
  return n * base;
}

/** Strictly ascending ticks so the Y-axis stays a proper numeric scale (avoids Recharts mis-ordering). */
function revenueYAxisTicks(axisMax: number, divisions = 5): number[] {
  if (!Number.isFinite(axisMax) || axisMax <= 0) return [0, 5000, 10000];
  const step = niceStepForAxis(axisMax / Math.max(2, divisions - 1));
  const ticks: number[] = [0];
  for (let v = step; v < axisMax; v += step) {
    ticks.push(Math.round(v));
  }
  const cap = Math.ceil(axisMax / step) * step;
  const last = ticks[ticks.length - 1] ?? 0;
  if (cap > last) ticks.push(cap);
  return ticks;
}

export function RetentionDashboard() {
  const [orders, setOrders] = useState<Order[]>(() => generateDemoOrders(demoCustomerCount));
  const [dataLabel, setDataLabel] = useState("Luma Skin demo data");
  const [selectedPreset, setSelectedPreset] = useState<ScenarioPreset>("realistic");
  const [cohortMode, setCohortMode] = useState<CohortMatrixMode>("purchaseProgression");
  const [selectedTimingPlays, setSelectedTimingPlays] = useState<TimingPlayId[]>([
    "reorder-reminder",
  ]);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [uploadMessage, setUploadMessage] = useState("Using demo data. Upload a Shopify-like CSV to replace it.");
  const [isCopied, setIsCopied] = useState(false);

  const profiles = useMemo(() => buildCustomerProfiles(orders), [orders]);
  const matureProfiles = useMemo(() => getMatureProfiles(profiles), [profiles]);
  const cohorts = useMemo(() => calculateCohorts(matureProfiles), [matureProfiles]);
  const cohortMatrix = useMemo(
    () => calculateCohortMatrix(matureProfiles, cohortMode),
    [matureProfiles, cohortMode],
  );
  const segments = useMemo(() => calculateSegments(matureProfiles), [matureProfiles]);
  const scenario = scenarios.find((item) => item.preset === selectedPreset) ?? scenarios[1];
  const uplift = useMemo(
    () => calculateUplift(matureProfiles, scenario),
    [matureProfiles, scenario],
  );
  const upliftPerMatureCustomer =
    matureProfiles.length > 0 ? uplift.totalExtraRevenue / matureProfiles.length : 0;
  const timing = useMemo(() => calculateTimingWindow(matureProfiles), [matureProfiles]);
  const recommendations = useMemo(
    () => buildRecommendations(matureProfiles, uplift),
    [matureProfiles, uplift],
  );
  const latestCohort = cohorts.at(-1);
  const averageYearOneSpend =
    matureProfiles.reduce((sum, profile) => sum + profile.yearOneSpend, 0) /
    Math.max(1, matureProfiles.length);
  const missingMapping = validateRequiredMapping(mapping);

  const allCohortMetrics = useMemo(() => calculateCohorts(profiles), [profiles]);
  const simCohortOptions = useMemo(
    () => allCohortMetrics.filter((c) => isCohortEligibleForPastMonthsView(c.cohortMonth)),
    [allCohortMetrics],
  );
  const defaultSimCohort = simCohortOptions.at(-1)?.cohortMonth ?? "";
  const [simCohortMonth, setSimCohortMonth] = useState("");
  const [simTarget2, setSimTarget2] = useState(0.3);
  const [simTarget3, setSimTarget3] = useState(0.12);
  const [simTarget4, setSimTarget4] = useState(0.06);
  const [simTarget5, setSimTarget5] = useState(0.03);

  useEffect(() => {
    if (!simCohortOptions.length) return;
    if (!simCohortOptions.some((c) => c.cohortMonth === simCohortMonth)) {
      setSimCohortMonth(defaultSimCohort);
    }
  }, [simCohortOptions, defaultSimCohort, simCohortMonth]);

  useEffect(() => {
    if (!simCohortMonth) return;
    const m = allCohortMetrics.find((c) => c.cohortMonth === simCohortMonth);
    if (!m) return;
    setSimTarget2(Math.min(0.5, m.secondPurchaseRate + 0.03));
    setSimTarget3(Math.min(0.55, m.thirdPurchaseRate + 0.02));
    setSimTarget4(Math.min(0.45, m.fourthPurchaseRate + 0.015));
    setSimTarget5(Math.min(0.32, m.fifthPurchaseRate + 0.01));
  }, [simCohortMonth, allCohortMetrics]);

  const simCohortProfiles = useMemo(
    () => cohortProfilesForMonth(profiles, simCohortMonth),
    [profiles, simCohortMonth],
  );
  const simDepthRates = useMemo(
    () => calculateCohortPurchaseDepthRates(simCohortProfiles),
    [simCohortProfiles],
  );
  const simAcquisitionMix = useMemo(
    () => acquisitionMixForProfiles(simCohortProfiles),
    [simCohortProfiles],
  );
  const simObservableMonths = cohortObservableYear1Months(simCohortMonth);
  const simRevenueCurve = useMemo(
    () => calculateCohortCumulativeYear1RevenueCurve(simCohortProfiles, simObservableMonths),
    [simCohortProfiles, simObservableMonths],
  );
  const simDepthScenario = useMemo(
    () =>
      calculateCohortDepthScenarioRevenue(simCohortProfiles, {
        second: simTarget2,
        third: simTarget3,
        fourth: simTarget4,
        fifth: simTarget5,
      }),
    [simCohortProfiles, simTarget2, simTarget3, simTarget4, simTarget5],
  );
  const simCurveYMax = useMemo(() => {
    let max = simDepthScenario.modeledYearOneRevenue;
    for (const p of simRevenueCurve) {
      if (p.revenue != null) max = Math.max(max, p.revenue);
    }
    return max * 1.08 + 800;
  }, [simRevenueCurve, simDepthScenario.modeledYearOneRevenue]);
  const simRevenueYTicks = useMemo(() => revenueYAxisTicks(simCurveYMax, 6), [simCurveYMax]);
  const simRevenueYDomainMax = simRevenueYTicks[simRevenueYTicks.length - 1] ?? simCurveYMax;
  const cohortCurveChartData = useMemo(
    () =>
      simRevenueCurve.map((p) => ({
        label: `M${p.month}`,
        month: p.month,
        observedRevenue: p.revenue === null ? null : p.revenue,
        modeledY1Total: simDepthScenario.modeledYearOneRevenue,
      })),
    [simRevenueCurve, simDepthScenario.modeledYearOneRevenue],
  );

  const cohortCompositionChartData = useMemo(
    () =>
      cohorts.slice(-14).map((cohort) => ({
        cohortMonth: cohort.cohortMonth,
        discount: cohort.discountFirstBuyerRate,
        premium: cohort.premiumNonDiscountRate,
        other: cohort.otherAcquisitionRate,
        secondPurchaseRate: cohort.secondPurchaseRate,
        returnIssueRate: cohort.refundWarningRate,
      })),
    [cohorts],
  );

  const acquisitionLineAxisMax = useMemo(() => {
    if (cohortCompositionChartData.length === 0) return 0.45;
    let max = 0;
    for (const row of cohortCompositionChartData) {
      max = Math.max(max, row.secondPurchaseRate, row.returnIssueRate);
    }
    const padded = max * 1.15 + 0.02;
    return Math.min(1, Math.max(0.12, padded));
  }, [cohortCompositionChartData]);

  const selectedTimingOptions = playTimingOptions.filter((option) =>
    selectedTimingPlays.includes(option.id),
  );

  const timingData = useMemo(() => {
    return Array.from({ length: 10 }, (_, index) => {
      const day = 10 + index * 7;
      const row: { day: number } & Partial<Record<TimingPlayId, number>> = {
        day,
      };

      for (const option of selectedTimingOptions) {
        const peak = Math.max(10, timing.peak + option.peakOffset);
        const distance = Math.abs(day - peak);
        row[option.id] = Math.max(2, option.intensity - distance * 0.48);
      }

      return row;
    });
  }, [selectedTimingOptions, timing.peak]);

  const timingYAxisMax = useMemo(() => {
    let max = 0;
    for (const row of timingData) {
      for (const option of selectedTimingOptions) {
        const value = row[option.id];
        if (typeof value === "number") max = Math.max(max, value);
      }
    }
    return Math.max(6, Math.ceil(max * 1.12));
  }, [timingData, selectedTimingOptions]);

  function toggleTimingPlay(playId: TimingPlayId, multiSelect: boolean) {
    if (!multiSelect) {
      setSelectedTimingPlays([playId]);
      return;
    }

    setSelectedTimingPlays((current) => {
      if (current.includes(playId)) {
        return current.length === 1 ? current : current.filter((id) => id !== playId);
      }

      return [...current, playId];
    });
  }

  const actionPlan = useMemo(() => {
    return `# Retention Opportunity Action Plan

Dataset: ${dataLabel}
Estimated Year 1 uplift: ${formatCurrency(uplift.totalExtraRevenue)}
Scenario: ${scenario.label} (${formatPercent(uplift.currentSecondPurchaseRate)} -> ${formatPercent(uplift.targetSecondPurchaseRate)} second purchase rate)

## Top 3 prioritized lifecycle plays

${recommendations
  .map(
    (recommendation) => `### ${recommendation.priority}. ${recommendation.play}

Target segment: ${recommendation.targetSegment}
Observed signal: ${recommendation.observedSignal}
Timing: ${recommendation.timing}
Content angle: ${recommendation.contentAngle}
Estimated opportunity: ${formatCurrency(recommendation.expectedImpact)}
Primary KPI: ${recommendation.primaryKpi}
Priority signals: Impact ${recommendation.impact}, Confidence ${recommendation.confidence}, Ease ${recommendation.ease}`,
  )
  .join("\n\n")}

Assumption: uplift is an estimated opportunity, not guaranteed revenue. Later purchase behavior is modeled from existing repeat buyers.`;
  }, [dataLabel, recommendations, scenario, uplift]);

  async function handleFile(file: File) {
    const parsedPreview = await parseCsvPreview(file);
    setPreview(parsedPreview);
    setMapping(parsedPreview.mapping);
    setUploadMessage("Columns detected. Review the mapping, then apply this CSV to the dashboard.");
  }

  async function applyCsv(file: File | undefined) {
    if (!file) return;
    const parsedOrders = await parseCsvOrders(file, mapping);
    if (parsedOrders.length === 0) {
      setUploadMessage("No valid orders found. Check required fields and mapping.");
      return;
    }
    setOrders(parsedOrders);
    setDataLabel(file.name);
    setUploadMessage(`${parsedOrders.length.toLocaleString()} orders loaded locally in the browser.`);
  }

  async function copyActionPlan() {
    await navigator.clipboard.writeText(actionPlan);
    setIsCopied(true);
    window.setTimeout(() => setIsCopied(false), 1800);
  }

  return (
    <main className="shell">
      <section className="hero">
        <div className="eyebrow">Retention Opportunity Engine</div>
        <div className="heroGrid">
          <div>
            <h1>Turn Shopify order data into repeat revenue plays.</h1>
            <p>
              A client-presentable retention audit for skincare brands: upload order data,
              identify second-purchase leakage, model the upside, and leave with a prioritized
              action plan.
            </p>
          </div>
          <div className="heroMetric">
            <span>Estimated Year 1 uplift</span>
            <strong>{formatCurrency(uplift.totalExtraRevenue)}</strong>
            <small className="heroMetricSub">
              +{formatCurrency(upliftPerMatureCustomer)} avg. per matured customer
            </small>
            <small>
              {formatPercent(uplift.currentSecondPurchaseRate)} to{" "}
              {formatPercent(uplift.targetSecondPurchaseRate)} second purchase rate
            </small>
          </div>
        </div>
      </section>

      <nav className="navPills" aria-label="Audit sections">
        {navItems.map((item) => (
          <a href={`#${item.toLowerCase().replaceAll(" ", "-")}`} key={item}>
            {item}
          </a>
        ))}
      </nav>

      <section className="panel uploadPanel">
        <div>
          <span className="sectionKicker">Step 1</span>
          <h2>Use demo data or upload a Shopify-like CSV</h2>
            <p className="hideOnNarrow">
              CSV analysis runs client-side for the demo. No customer names or emails are needed,
              only a consistent customer identifier.
            </p>
        </div>
        <div className="uploadBox">
          <input
            id="csv"
            type="file"
            accept=".csv"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleFile(file);
            }}
          />
          <label htmlFor="csv">Upload Shopify CSV</label>
          <button
            className="ghostButton"
            onClick={() => {
              setOrders(generateDemoOrders(demoCustomerCount));
              setDataLabel("Luma Skin demo data");
              setPreview(null);
              setUploadMessage("Demo skincare dataset restored.");
            }}
          >
            Use demo data
          </button>
          <p>{uploadMessage}</p>
        </div>
      </section>

      {preview ? (
        <section className="panel mappingPanel">
          <div>
            <span className="sectionKicker">CSV mapping</span>
            <h2>Detected columns</h2>
            <p className="hideOnNarrow">
              Required fields: order ID, customer ID, order date, value, and product/category.
              Nice-to-have fields enrich segments and recommendations.
            </p>
          </div>
          <div className="mappingGrid">
            {Object.keys(mapping).map((key) => (
              <label key={key}>
                {labelForMappingKey(key)}
                <select
                  value={mapping[key as keyof ColumnMapping]}
                  onChange={(event) =>
                    setMapping((current) => ({
                      ...current,
                      [key]: event.target.value,
                    }))
                  }
                >
                  <option value="">Not mapped</option>
                  {preview.headers.map((header) => (
                    <option key={header} value={header}>
                      {header}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          {missingMapping.length > 0 ? (
            <p className="warning">Missing required mapping: {missingMapping.join(", ")}</p>
          ) : null}
          <button
            className="primaryButton"
            disabled={missingMapping.length > 0}
            onClick={() => {
              const input = document.getElementById("csv") as HTMLInputElement | null;
              void applyCsv(input?.files?.[0]);
            }}
          >
            Apply CSV to dashboard
          </button>
        </section>
      ) : null}

      <section className="statsGrid" id="overview">
        <MetricCard label="Matured customers" value={matureProfiles.length.toLocaleString()} />
        <MetricCard label="Average Year 1 spend" value={formatCurrency(averageYearOneSpend)} />
        <MetricCard
          label="Current second purchase rate"
          value={formatPercent(uplift.currentSecondPurchaseRate)}
        />
        <MetricCard
          label="Natural repeat window"
          value={`Day ${timing.start}-${timing.end}`}
        />
      </section>

      <section className="gridTwo" id="cohorts">
        <div className="panel cohortPanel">
          <div className="sectionHeader">
            <span className="sectionKicker">Opportunity</span>
            <h2>Cohort analysis</h2>
            <p className="hideOnNarrow">
              Rows are activation cohorts. Switch columns between extra purchases and months
              since activation to see where retention drops.
            </p>
          </div>
          <div className="cohortToolbar">
            <div className="segmentedControl" aria-label="Cohort value mode">
              <button
                className={cohortMode === "purchaseProgression" ? "active" : ""}
                onClick={() => setCohortMode("purchaseProgression")}
              >
                Extra purchases
              </button>
              <button
                className={cohortMode === "monthlyRetention" ? "active" : ""}
                onClick={() => setCohortMode("monthlyRetention")}
              >
                Months since activation
              </button>
            </div>
            <p className="hideOnNarrow">
              {cohortMode === "purchaseProgression"
                ? "Share of each cohort reaching the 2nd, 3rd, 4th and 5th purchase within Year 1."
                : "Monthly retention: share of the activation cohort placing an order in each month after first purchase."}
            </p>
          </div>
          <CohortMatrix
            columns={cohortMatrix.columns}
            rows={cohortMatrix.rows.slice(-14)}
            mode={cohortMode}
          />
          <div className="cohortCompositionBlock">
            <span className="sectionKicker">Acquisition mix</span>
            <h3>Discount vs premium entry vs 2nd purchase rate</h3>
            <p className="hideOnNarrow">
              Stacked bars: mutually exclusive first-order mix (left axis, 0–100%). Lines: 2nd
              purchase rate and return/issue signal (right axis scales to the data, with headroom)
              so you can compare retention vs operational risk by cohort.
            </p>
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart
                data={cohortCompositionChartData}
                margin={{ top: 8, right: 52, left: 4, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="cohortMonth" tick={{ fontSize: 11 }} tickLine={false} />
                <YAxis
                  domain={[0, 1]}
                  label={{ angle: -90, fill: "#64748b", fontSize: 11, position: "insideLeft", value: "Mix" }}
                  tickFormatter={(v) => `${Math.round(Number(v) * 100)}%`}
                  width={44}
                  yAxisId="left"
                />
                <YAxis
                  domain={[0, acquisitionLineAxisMax]}
                  orientation="right"
                  tickFormatter={(v) => `${Math.round(Number(v) * 100)}%`}
                  width={48}
                  yAxisId="right"
                />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0" }}
                  formatter={(value, name) => {
                    const label =
                      name === "secondPurchaseRate"
                        ? "2nd purchase rate"
                        : name === "returnIssueRate"
                          ? "Return / issue rate"
                          : String(name);
                    return [formatPercent(Number(value ?? 0)), label];
                  }}
                />
                <Legend />
                <Bar dataKey="discount" fill="#dc2626" name="Discount first" stackId="mix" yAxisId="left" />
                <Bar dataKey="premium" fill="#7c3aed" name="Premium (no discount)" stackId="mix" yAxisId="left" />
                <Bar dataKey="other" fill="#94a3b8" name="Other" stackId="mix" yAxisId="left" />
                <Line
                  dataKey="secondPurchaseRate"
                  dot={{ r: 3 }}
                  name="2nd purchase rate"
                  stroke="#0f172a"
                  strokeWidth={2}
                  type="monotone"
                  yAxisId="right"
                />
                <Line
                  dataKey="returnIssueRate"
                  dot={{ r: 3 }}
                  name="Return / issue rate"
                  stroke="#ea580c"
                  strokeDasharray="5 4"
                  strokeWidth={2}
                  type="monotone"
                  yAxisId="right"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel" id="scenario">
          <span className="sectionKicker">Scenario simulator</span>
          <h2>If you turn this knob, revenue moves.</h2>
          <p className="hideOnNarrow">
            Scenario presets model the opportunity from improving second purchase conversion,
            including downstream repeat behavior from existing repeat buyers.
          </p>
          <div className="scenarioButtons">
            {scenarios.map((item) => (
              <button
                className={item.preset === selectedPreset ? "active" : ""}
                key={item.preset}
                onClick={() => setSelectedPreset(item.preset)}
              >
                {item.label}
                <span>+{item.targetLiftPoints}%p</span>
              </button>
            ))}
          </div>
          <div className="calculation">
            <div className="primaryCalculation">
              <span>Total modeled Y1 uplift</span>
              <strong>{formatCurrency(uplift.totalExtraRevenue)}</strong>
            </div>
            <div>
              <span>Y1 uplift per +1%p second purchase rate</span>
              <strong>{formatCurrency(uplift.totalExtraRevenue / scenario.targetLiftPoints)}</strong>
            </div>
            <div>
              <span>Extra second purchases</span>
              <strong>{Math.round(uplift.extraSecondPurchases).toLocaleString()}</strong>
            </div>
            <div>
              <span>Revenue per extra 2nd buyer</span>
              <strong>{formatCurrency(uplift.revenuePerExtraSecondBuyer)}</strong>
            </div>
            <div>
              <span>Later-order contribution</span>
              <strong>{formatCurrency(uplift.downstreamRevenue)}</strong>
            </div>
          </div>
          <p className="calculationNote hideOnNarrow">
            Later-order contribution is the modeled value from 3rd+ purchases after the extra
            customers reach a second purchase.
          </p>

          {simCohortOptions.length > 0 ? (
            <div className="cohortSim">
              <h3>Cohort check with acquisition mix</h3>
              <p className="cohortSimIntro hideOnNarrow">
                Cohorts from the as-of calendar month ({DATA_AS_OF.toISOString().slice(0, 7)}) are
                omitted so you compare completed months. Bars: first-order mix. Chart: cumulative
                Year 1 order revenue by month since activation. Sliders set hypothetical 2nd–5th
                purchase rates; the dashed line is modeled total Y1 revenue (baseline plus uplift;
                2nd lift includes the same later-order contribution as the main scenario block).
              </p>

              <div className="cohortSimControls">
                <label>
                  Cohort
                  <select
                    value={simCohortMonth}
                    onChange={(event) => setSimCohortMonth(event.target.value)}
                  >
                    {simCohortOptions.map((c) => (
                      <option key={c.cohortMonth} value={c.cohortMonth}>
                        {c.cohortMonth} ({c.customers.toLocaleString()} customers)
                      </option>
                    ))}
                  </select>
                </label>
                <span
                  className={
                    simObservableMonths >= 12 ? "cohortSimBadge" : "cohortSimBadge running"
                  }
                >
                  {simObservableMonths >= 12
                    ? "Year 1 complete in dataset"
                    : `Year 1 still open — observed through M${simObservableMonths} (as of ${DATA_AS_OF.toISOString().slice(0, 10)})`}
                </span>
              </div>

              {simAcquisitionMix.customers > 0 ? (
                <div className="cohortMixWrap">
                  <div className="cohortMixBar" aria-label="First-order mix for selected cohort">
                    <div
                      style={{
                        width: `${simAcquisitionMix.discountFirstBuyerRate * 100}%`,
                        background: "#dc2626",
                      }}
                      title="Discount first"
                    />
                    <div
                      style={{
                        width: `${simAcquisitionMix.premiumNonDiscountRate * 100}%`,
                        background: "#7c3aed",
                      }}
                      title="Premium (no discount)"
                    />
                    <div
                      style={{
                        width: `${simAcquisitionMix.otherAcquisitionRate * 100}%`,
                        background: "#94a3b8",
                      }}
                      title="Other"
                    />
                  </div>
                  <div className="cohortMixLegend">
                    <span>
                      <span className="cohortMixSwatch" style={{ background: "#dc2626" }} />
                      Discount {formatPercent(simAcquisitionMix.discountFirstBuyerRate)}
                    </span>
                    <span>
                      <span className="cohortMixSwatch" style={{ background: "#7c3aed" }} />
                      Premium {formatPercent(simAcquisitionMix.premiumNonDiscountRate)}
                    </span>
                    <span>
                      <span className="cohortMixSwatch" style={{ background: "#94a3b8" }} />
                      Other {formatPercent(simAcquisitionMix.otherAcquisitionRate)}
                    </span>
                  </div>
                </div>
              ) : null}

              <div className="cohortSimSlidersGrid">
                <div className="cohortSimSliderRow">
                  <label htmlFor="cohort-sim-t2">
                    Target 2nd purchase rate
                    <input
                      id="cohort-sim-t2"
                      max={0.5}
                      min={simDepthRates.r2}
                      onChange={(event) => setSimTarget2(Number(event.target.value))}
                      step={0.005}
                      type="range"
                      value={Math.min(0.5, Math.max(simDepthRates.r2, simTarget2))}
                    />
                  </label>
                  <div className="cohortSimSliderMeta">
                    <span>Observed {formatPercent(simDepthRates.r2)}</span>
                    <span>Target {formatPercent(Math.min(0.5, Math.max(simDepthRates.r2, simTarget2)))}</span>
                  </div>
                </div>
                <div className="cohortSimSliderRow">
                  <label htmlFor="cohort-sim-t3">
                    Target 3rd purchase rate
                    <input
                      id="cohort-sim-t3"
                      max={0.55}
                      min={simDepthRates.r3}
                      onChange={(event) => setSimTarget3(Number(event.target.value))}
                      step={0.005}
                      type="range"
                      value={Math.min(0.55, Math.max(simDepthRates.r3, simTarget3))}
                    />
                  </label>
                  <div className="cohortSimSliderMeta">
                    <span>Observed {formatPercent(simDepthRates.r3)}</span>
                    <span>Target {formatPercent(Math.min(0.55, Math.max(simDepthRates.r3, simTarget3)))}</span>
                  </div>
                </div>
                <div className="cohortSimSliderRow">
                  <label htmlFor="cohort-sim-t4">
                    Target 4th purchase rate
                    <input
                      id="cohort-sim-t4"
                      max={0.45}
                      min={simDepthRates.r4}
                      onChange={(event) => setSimTarget4(Number(event.target.value))}
                      step={0.005}
                      type="range"
                      value={Math.min(0.45, Math.max(simDepthRates.r4, simTarget4))}
                    />
                  </label>
                  <div className="cohortSimSliderMeta">
                    <span>Observed {formatPercent(simDepthRates.r4)}</span>
                    <span>Target {formatPercent(Math.min(0.45, Math.max(simDepthRates.r4, simTarget4)))}</span>
                  </div>
                </div>
                <div className="cohortSimSliderRow">
                  <label htmlFor="cohort-sim-t5">
                    Target 5th purchase rate
                    <input
                      id="cohort-sim-t5"
                      max={0.32}
                      min={simDepthRates.r5}
                      onChange={(event) => setSimTarget5(Number(event.target.value))}
                      step={0.003}
                      type="range"
                      value={Math.min(0.32, Math.max(simDepthRates.r5, simTarget5))}
                    />
                  </label>
                  <div className="cohortSimSliderMeta">
                    <span>Observed {formatPercent(simDepthRates.r5)}</span>
                    <span>Target {formatPercent(Math.min(0.32, Math.max(simDepthRates.r5, simTarget5)))}</span>
                  </div>
                </div>
              </div>

              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={cohortCurveChartData} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis
                    domain={[0, simRevenueYDomainMax]}
                    tickFormatter={(v) => formatCurrency(Number(v))}
                    ticks={simRevenueYTicks}
                    type="number"
                    width={56}
                  />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0" }}
                    formatter={(value, name) => [
                      value == null ? "—" : formatCurrency(Number(value)),
                      name === "observedRevenue"
                        ? "Observed cumulative Y1 revenue"
                        : "Modeled Y1 total (sliders)",
                    ]}
                  />
                  <Legend />
                  <Line
                    connectNulls={false}
                    dataKey="observedRevenue"
                    dot={{ r: 3 }}
                    name="Observed cumulative Y1 revenue"
                    stroke="#0f172a"
                    strokeWidth={2}
                    type="monotone"
                  />
                  <Line
                    dataKey="modeledY1Total"
                    dot={false}
                    name="Modeled Y1 total (sliders)"
                    stroke="#2563eb"
                    strokeDasharray="5 4"
                    strokeWidth={2}
                    type="monotone"
                  />
                </LineChart>
              </ResponsiveContainer>

              <div className="cohortSimMiniCalc">
                <div>
                  <span>Baseline Y1 revenue (cohort)</span>
                  <strong>{formatCurrency(simDepthScenario.baselineYearOneRevenue)}</strong>
                </div>
                <div>
                  <span>Modeled Y1 revenue (sliders)</span>
                  <strong>{formatCurrency(simDepthScenario.modeledYearOneRevenue)}</strong>
                </div>
                <div>
                  <span>Incremental revenue</span>
                  <strong>{formatCurrency(simDepthScenario.incrementalRevenue)}</strong>
                </div>
                <div>
                  <span>From 2nd (incl. later orders)</span>
                  <strong>{formatCurrency(simDepthScenario.secondLift.totalExtraRevenue)}</strong>
                </div>
                <div>
                  <span>From 3rd / 4th / 5th (direct)</span>
                  <strong>
                    {formatCurrency(
                      simDepthScenario.incrementalFromThird +
                        simDepthScenario.incrementalFromFourth +
                        simDepthScenario.incrementalFromFifth,
                    )}
                  </strong>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <section className="gridTwo">
        <div className="panel chartPanel" id="timing">
          <span className="sectionKicker">Timing</span>
          <h2>Best timing window by play</h2>
          <p className="hideOnNarrow">
            Select a behavior signal or lifecycle play to see when the intervention should happen.
            Hold Cmd/Ctrl while clicking to compare multiple play curves in one view.
          </p>
          <div className="timingPlayGrid">
            {playTimingOptions.map((option) => (
              <button
                className={selectedTimingPlays.includes(option.id) ? "active" : ""}
                key={option.id}
                onClick={(event) => toggleTimingPlay(option.id, event.metaKey || event.ctrlKey)}
              >
                <span>{option.label}</span>
                <small>{option.signal}</small>
              </button>
            ))}
          </div>
          <div className="timingSummary multiTimingSummary">
            {selectedTimingOptions.map((option) => {
              const peak = Math.max(10, timing.peak + option.peakOffset);
              const start = Math.max(7, peak - option.window);
              const end = peak + option.window;

              return (
                <article key={option.id} style={{ borderColor: option.color }}>
                  <div>
                    <span>{option.label}</span>
                    <strong>
                      Day {start}-{end}
                    </strong>
                  </div>
                  <p className="hideOnNarrow">{option.note}</p>
                </article>
              );
            })}
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={timingData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(35, 28, 24, 0.08)" />
              <XAxis
                dataKey="day"
                domain={["dataMin", "dataMax"]}
                tickFormatter={(value) => `D${value}`}
                ticks={timingData.map((row) => row.day)}
                type="number"
              />
              <YAxis domain={[0, timingYAxisMax]} />
              <Tooltip contentStyle={{ borderRadius: 16, border: "none" }} />
              <Legend />
              {selectedTimingOptions.map((option) => {
                const peak = Math.max(10, timing.peak + option.peakOffset);
                const windowStart = Math.max(7, peak - option.window);
                const windowEnd = peak + option.window;
                return (
                  <g key={`${option.id}-refs`}>
                    <ReferenceArea
                      fill={option.color}
                      fillOpacity={0.12}
                      strokeOpacity={0}
                      x1={windowStart}
                      x2={windowEnd}
                    />
                    <ReferenceLine
                      stroke={option.color}
                      strokeDasharray="4 4"
                      strokeOpacity={0.85}
                      strokeWidth={2}
                      x={peak}
                    />
                  </g>
                );
              })}
              {selectedTimingOptions.map((option) => (
                <Line
                  dataKey={option.id}
                  dot={false}
                  key={option.id}
                  name={option.label}
                  stroke={option.color}
                  strokeWidth={3}
                  type="monotone"
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="panel" id="segments">
          <span className="sectionKicker">Behavior signals</span>
          <h2>Orders-only behavior signals</h2>
          <p className="hideOnNarrow">
            Signals are derived from order data only and may overlap. They are used to detect
            lifecycle opportunities, not to force every customer into one exclusive segment.
          </p>
          <div className="signalTableWrap">
            <table className="signalTable">
              <thead>
                <tr>
                  <th>Signal</th>
                  <th>Size</th>
                  <th>2nd purchase</th>
                  <th>Suggested play</th>
                </tr>
              </thead>
              <tbody>
                {segments.map((segment) => (
                  <tr key={segment.id}>
                    <td>
                      <strong>{segment.name}</strong>
                      <span>{segment.description}</span>
                    </td>
                    <td>{formatPercent(segment.share)}</td>
                    <td>{formatPercent(segment.secondPurchaseRate)}</td>
                    <td>{recommendedPlayForSegment(segment.id)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="panel actionPanel" id="action-plan">
        <div className="sectionHeader">
          <span className="sectionKicker">Action Plan</span>
          <h2>Top 3 prioritized lifecycle recommendations</h2>
          <p className="hideOnNarrow">
            Ranking is based on a simple mix of impact, confidence, and ease. The output is
            designed for agency/client conversations, not as guaranteed revenue.
          </p>
        </div>
        <div className="recommendationGrid">
          {recommendations.map((recommendation) => (
            <article key={recommendation.id} className="recommendation">
              <div className="priority">#{recommendation.priority}</div>
              <h3>{recommendation.play}</h3>
              <p className="target">{recommendation.targetSegment}</p>
              <p>{recommendation.observedSignal}</p>
              <dl>
                <div>
                  <dt>Timing</dt>
                  <dd>{recommendation.timing}</dd>
                </div>
                <div>
                  <dt>Content angle</dt>
                  <dd>{recommendation.contentAngle}</dd>
                </div>
                <div>
                  <dt>Estimated opportunity</dt>
                  <dd>{formatCurrency(recommendation.expectedImpact)}</dd>
                </div>
              </dl>
              <div className="scoreRow">
                <span>Impact {recommendation.impact}</span>
                <span>Confidence {recommendation.confidence}</span>
                <span>Ease {recommendation.ease}</span>
              </div>
            </article>
          ))}
        </div>
        <div className="copyBox">
          <div>
            <strong>Markdown action plan</strong>
            <p className="hideOnNarrow">Copy the summary into a client note, proposal, or internal playbook draft.</p>
          </div>
          <button className="primaryButton" onClick={() => void copyActionPlan()}>
            {isCopied ? "Copied" : "Copy action plan"}
          </button>
        </div>
      </section>

      <footer>
        <strong>This is the direction.</strong> A repeatable retention opportunity audit for
        e-commerce clients, starting from Shopify order data and ending in concrete lifecycle
        plays.
        {latestCohort ? <span> Latest matured cohort: {latestCohort.cohortMonth}.</span> : null}
      </footer>
    </main>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="metricCard">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function recommendedPlayForSegment(segmentId: string) {
  const plays: Record<string, string> = {
    "discount-first": "Recommended play: second-purchase incentive",
    "premium-first": "Recommended play: premium education flow",
    replenishment: "Recommended play: reorder reminder",
    "single-product": "Recommended play: complete-the-routine cross-sell",
  };

  return plays[segmentId] ?? "Recommended play: review segment behavior";
}

function CohortMatrix({
  columns,
  rows,
  mode,
}: {
  columns: { key: string; label: string }[];
  rows: {
    cohortMonth: string;
    customers: number;
    averageYearOneSpend: number;
    values: Record<string, number>;
  }[];
  mode: CohortMatrixMode;
}) {
  return (
    <div className="cohortTableWrap">
      <table className="cohortTable">
        <thead>
          <tr>
            <th className="stickyCol">Cohort</th>
            <th>Customers</th>
            <th>Avg Y1 spend</th>
            {columns.map((column) => (
              <th key={column.key}>{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.cohortMonth}>
              <th className="stickyCol" scope="row">
                {row.cohortMonth}
              </th>
              <td>{row.customers.toLocaleString()}</td>
              <td>{formatCurrency(row.averageYearOneSpend)}</td>
              {columns.map((column) => {
                const value = row.values[column.key] ?? 0;
                return (
                  <td key={column.key}>
                    <span
                      className="heatCell"
                      style={{
                        backgroundColor: heatColor(value, mode),
                        color: value > 0.34 ? "#ffffff" : undefined,
                      }}
                    >
                      {formatPercent(value)}
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function heatColor(value: number, mode: CohortMatrixMode) {
  const max = mode === "purchaseProgression" ? 0.34 : 1;
  const intensity = Math.min(1, value / max);
  const lightness = 96 - intensity * 52;
  const saturation = 62 - intensity * 12;
  return `hsl(214 ${saturation}% ${lightness}%)`;
}
