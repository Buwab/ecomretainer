# E-commerce Retention Engine — Demo PRD

## 1. Working title

**E-commerce Retention Engine**
A cohort-based retention and LTV dashboard that helps e-commerce teams identify where repeat purchase growth sits, quantify the value of improving second purchase rate, and determine when and how to trigger lifecycle communication.

---

## 2. Core problem

Most e-commerce brands know how much revenue they generate, but they often do not clearly understand **why certain customer cohorts retain better than others** or **when customers are most likely to make their second purchase**.

They usually look at:

* campaign revenue
* open/click rates
* ROAS
* total sales
* generic repeat purchase rate

But they often miss:

* which acquisition cohorts are high or low quality
* how much Year 1 spend depends on second purchase conversion
* when the probability of a second purchase naturally peaks
* which buyer types exist within a cohort
* whether low retention is caused by marketing, customer quality, product fit, price sensitivity, or complaints

The result: lifecycle e-mails are often generic, based on fixed timing rules, and not directly connected to cohort value or LTV impact.

---

## 3. Core insight

For many e-commerce businesses, the first purchase can be framed as **activation**. Everything after that is **retention**.

The most important transition is usually:

> **First purchase → Second purchase**

If more customers make a second purchase, and their later purchase behavior remains similar, Year 1 spend increases significantly. This makes second purchase rate a powerful and explainable lever for retention growth.

---

## 4. Product promise

The product helps e-commerce teams answer four questions:

1. **Where is the growth opportunity?**
   Which cohorts underperform on Year 1 spend and second purchase rate?

2. **What is the financial upside?**
   What happens to average Year 1 spend if second purchase rate improves from, for example, 15% to 20%?

3. **When should we act?**
   At what point after the first purchase does the probability of a second purchase peak?

4. **What should we say to whom?**
   Which buyer types exist within each cohort, and how should lifecycle messaging differ by segment?

---

## 5. Demo goal

The demo should show a smooth, visual dashboard that makes the concept immediately understandable for an e-commerce agency or brand.

The demo does **not** need to be connected to live customer data yet. It can use mock or synthetic order/event data, as long as the patterns are realistic.

The demo should make people think:

> “This is not just a dashboard. This could become a retention module in our toolkit.”

---

## 6. Primary users

### Agency team

An e-mail / CRM / lifecycle marketing agency that wants to turn data-driven retention insights into a repeatable client offering.

They care about:

* identifying new client opportunities
* proving commercial impact
* creating better lifecycle flows
* differentiating their agency proposition

### E-commerce brand

A brand that wants to increase repeat purchases and Year 1 spend.

They care about:

* repeat purchase rate
* revenue uplift
* LTV / Year 1 spend
* better timing of campaigns
* smarter customer segmentation

---

## 7. Key concepts

### Activation

The customer’s first purchase.

### Retention

All purchase behavior after the first purchase.

### Year 1 spend

Total customer spend in the first 365 days after first purchase.

### Second purchase rate

Percentage of customers in a cohort who place a second order within 365 days of their first order.

### Purchase progression

How many customers reach their 2nd, 3rd, 4th, 5th purchase within Year 1.

### Time to second purchase

Number of days between first and second purchase.

### Probability / hazard curve

A curve that shows when customers are most likely to make their second purchase, given that they have not yet made it.

### Buyer type

A segment based on first purchase behavior and pre-purchase behavior.

---

## 8. Dashboard structure

## 8.1 Executive summary

Purpose: instantly show the size of the opportunity.

Metrics:

* selected cohort period
* customers in cohort
* average Year 1 spend
* second purchase rate
* average order value first purchase
* average time to second purchase
* complaint/refund rate
* estimated uplift potential

Example insight:

> “Increasing second purchase rate from 15% to 20% could increase average Year 1 spend by €4.20 per customer.”

---

## 8.2 Cohort performance view

Purpose: show where the growth opportunity sits.

Rows:

* cohort month based on first purchase month

Columns:

* customers
* average Year 1 spend
* second purchase rate
* third purchase rate
* fourth purchase rate
* average time to second purchase
* complaint/refund rate

Optional visual:

* heatmap for underperforming cohorts
* trend line for Year 1 spend by cohort

Key question:

> Which cohorts perform better or worse, and why?

---

## 8.3 Purchase progression view

Purpose: show the retention funnel after first purchase.

Columns:

* 1st purchase: 100%
* 2nd purchase: x%
* 3rd purchase: x%
* 4th purchase: x%
* 5th purchase: x%

This can be shown as:

* funnel chart
* step chart
* cohort comparison table

Key question:

> Where do customers drop off in the repeat purchase journey?

---

## 8.4 Uplift simulator

Purpose: translate second purchase improvement into revenue impact.

Inputs:

* current second purchase rate
* target second purchase rate
* average second order value
* conditional third/fourth/fifth purchase rates
* average order values by purchase number
* cohort size

Output:

* extra Year 1 spend per customer
* total additional Year 1 revenue
* optional margin impact

Core assumption:

> If more customers reach the second purchase, their later purchase progression behaves like existing repeat buyers.

Scenarios:

1. Conservative: only extra second orders are counted.
2. Realistic: later purchase progression is also included.

---

## 8.5 Time-to-second-purchase probability curve

Purpose: determine best timing for lifecycle e-mails.

X-axis:

* days since first purchase

Y-axis options:

* cumulative probability of second purchase
* daily/weekly probability of second purchase among customers who have not yet repurchased

The dashboard should show:

* natural second purchase peak
* suggested e-mail windows
* difference by product category or buyer type

Example insight:

> “The probability of a second purchase peaks between day 24 and day 32. This is the best window for a reorder reminder.”

---

## 8.6 Cohort composition view

Purpose: explain why cohorts behave differently.

The key segmentation model uses two axes:

### Axis 1: Basket size on first purchase

Proxy for:

* value
* product usage duration
* price sensitivity
* intent quality

### Axis 2: Active days before first purchase in the previous 30 days

Proxy for:

* research intensity
* buying style
* impulsiveness
* consideration level

Example 2x2:

|                  | Low pre-purchase activity | High pre-purchase activity |
| ---------------- | ------------------------- | -------------------------- |
| Low basket size  | Deal hunter               | Careful low-spend buyer    |
| High basket size | High-value impulse buyer  | Considered premium buyer   |

Use cases:

* Black Friday cohorts may contain more low basket / low activity buyers.
* High basket / high activity buyers may need educational or reassurance-based follow-up.
* Low basket / low activity buyers may respond more to deals, urgency, or bundles.

---

## 8.7 Buyer type messaging recommendations

Purpose: connect data to e-mail actions.

For each buyer type, show:

* segment size
* second purchase rate
* average Year 1 spend
* time-to-second-purchase peak
* suggested messaging angle

Examples:

### Deal hunter

Likely behavior:

* low first basket
* low research
* often enters via discount moments

Messaging:

* limited-time deal
* bundle discount
* next purchase incentive

### Considered premium buyer

Likely behavior:

* high first basket
* multiple active days before purchase
* researched before buying

Messaging:

* product education
* routine building
* premium recommendations
* trust/reassurance

### High-value impulse buyer

Likely behavior:

* high first basket
* low pre-purchase activity

Messaging:

* fast reorder
* complementary product recommendations
* VIP treatment

### Careful low-spend buyer

Likely behavior:

* low basket
* high research

Messaging:

* product proof
* reviews
* low-risk cross-sell
* starter bundles

---

## 8.8 Quality check layer

Purpose: avoid treating operational problems as marketing problems.

Metrics:

* complaints
* refunds
* late deliveries
* support tickets
* negative reviews

Key insight:

> A cohort with high complaints may not need better e-mail timing. It may need product or operations improvement first.

This protects the agency from overpromising and makes the recommendation more credible.

---

## 9. Demo data requirements

Minimum required synthetic tables:

### customers

* customer_id
* acquisition_date
* acquisition_channel
* first_purchase_date
* cohort_month

### orders

* order_id
* customer_id
* order_date
* order_number
* order_value
* discount_used
* product_category
* product_id

### events

* customer_id
* event_date
* event_type
* session_id

Used to calculate active days before first purchase.

### support_events

* customer_id
* event_date
* type: complaint, refund, late_delivery

---

## 10. Core metrics

### Cohort metrics

* cohort size
* average Year 1 spend
* median Year 1 spend
* second purchase rate within 365 days
* third purchase rate within 365 days
* fourth purchase rate within 365 days
* median days to second purchase
* complaint/refund rate

### Buyer type metrics

* percentage of cohort
* average Year 1 spend
* second purchase rate
* median time to second purchase
* dominant product category

### Uplift metrics

* current second purchase rate
* target second purchase rate
* extra second purchases
* extra later purchases
* extra Year 1 revenue
* extra Year 1 revenue per customer
* optional gross margin uplift

---

## 11. Suggested demo flow

1. Open with high-level cohort performance.
2. Show that some cohorts have lower Year 1 spend.
3. Drill into one underperforming cohort.
4. Show that second purchase rate is the key driver.
5. Use simulator: increase second purchase rate from 15% to 20%.
6. Show revenue impact.
7. Open probability curve: identify best timing window.
8. Open cohort composition: show buyer types.
9. Translate buyer types into different e-mail strategies.
10. Show quality check: complaints/refunds explain some underperformance.
11. End with recommended actions and expected uplift.

---

## 12. What the demo should prove

The demo should prove that the agency can move from:

> “We send lifecycle e-mails”

To:

> “We identify the repeat-purchase opportunity, quantify the revenue upside, and activate customers at the right moment with the right message.”

---

## 13. What the demo should not overclaim

The demo should not claim that e-mail alone fixes retention.

It should clearly show that second purchase behavior depends on:

* product quality
* customer quality
* price sensitivity
* delivery experience
* timing
* messaging

E-mail is the first activation channel because it is fast, cheap, measurable, and already available to most e-commerce brands.

---

## 14. MVP demo scope

The first demo version should include:

1. Synthetic data generator
2. Cohort performance dashboard
3. Purchase progression chart
4. Uplift simulator
5. Time-to-second-purchase probability curve
6. Cohort composition 2x2
7. Buyer type recommendations
8. Quality check panel

Optional later:

* real Shopify/Klaviyo data import
* export recommended segments to e-mail platform
* A/B test measurement layer
* automated campaign timing recommendations
* margin-based LTV rather than spend-based LTV

---

## 15. Commercial positioning

This should be positioned as a productized agency module:

> **Retention & LTV Uplift Module**

Not as:

* a dashboard project
* a generic data analysis
* e-mail reporting

The commercial value is in turning repeat purchase behavior into a measurable and actionable revenue lever.

---

## 16. Next build step

Build a clickable/smooth dashboard demo with synthetic data.

Recommended stack:

* Next.js / React
* Tailwind
* Recharts
* synthetic JSON or local mock API

The demo should look polished enough to sell the idea, but does not need production-grade backend logic yet.
