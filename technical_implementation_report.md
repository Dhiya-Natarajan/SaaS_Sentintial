# SaaS-Sentinel Technical Implementation Report

## Summary
SaaS-Sentinel is an intelligent API gateway and middleware layer designed to broker, monitor, and selectively mold traffic between an application and third-party SaaS services (e.g., OpenAI, Anthropic, Stripe). Constructed primarily with TypeScript, Node.js (via Bun), Express, and Prisma, the system goes beyond a typical reverse proxy by incorporating transparent request rewriting, cost tracking, dynamic Machine Learning anomaly detection, and sophisticated policy enforcement (e.g., model downgrade and traffic rerouting).

## High-Level Architecture & Tech Stack
- **Runtime & Gateway:** Bun + Express + `http-proxy-middleware`.
- **Database & ORM:** PostgreSQL (via Prisma ORM) for metrics, rule definitions, and enforcement logs.
- **Machine Learning Layer:** `ml-isolation-forest` for behavioral anomaly detection on API requests. Statistical time-series forecasting for usage/cost predictions.
- **Provider Routing:** Protocol translation for vendor-agnostic routing (e.g., transforming OpenAI endpoints seamlessly mapping requests to Anthropic).

---

## Component-Level Implementation Details

### 1. The Core Proxy Gateway ([src/middleware/proxy.middleware.ts](file:///c:/Users/Dhiya%20Natarajan/Desktop/SaaS-Sentinel/src/middleware/proxy.middleware.ts))
The true routing heartbeat of SaaS-Sentinel lies in its Express middleware. It intercepts designated paths (`/proxy/openai`, `/proxy/anthropic`, etc.) and performs the following actions:
- **Pre-Flight Evaluation:** It intercepts network flows and injects request details (Service, Endpoint, Method, current usage) into the [ControlEngineService](file:///c:/Users/Dhiya%20Natarajan/Desktop/SaaS-Sentinel/src/services/control-engine.service.ts#79-332) for policy evaluation before forwarding traffic.
- **Header Masking & Auth Injection:** The system strips incoming authorization tokens to prevent tampering, securely injecting upstream vendor API keys server-side via [applyUpstreamHeaders](file:///c:/Users/Dhiya%20Natarajan/Desktop/SaaS-Sentinel/src/middleware/proxy.middleware.ts#84-100). 
- **Response Taping:** Uses `responseInterceptor` to tape the upstream output, capture response body sizes, and dynamically log metric telemetry post request execution.
- **Error/Fallback Handling:** If the policy engine encounters latency or fails, the gateway degrades gracefully using [buildFallbackDecision](file:///c:/Users/Dhiya%20Natarajan/Desktop/SaaS-Sentinel/src/middleware/proxy.middleware.ts#58-75), ensuring critical traffic can still bypass via the legacy default configurations.

### 2. Provider Routing & Protocol Translation ([src/providers/provider-routing.ts](file:///c:/Users/Dhiya%20Natarajan/Desktop/SaaS-Sentinel/src/providers/provider-routing.ts))
SaaS-Sentinel possesses a unique translation engine capable of on-the-fly vendor switching. 
- **Classification:** It classifies requests natively ([classifyRequest](file:///c:/Users/Dhiya%20Natarajan/Desktop/SaaS-Sentinel/src/providers/provider-routing.ts#66-101)), identifying them as `openai-chat-completions` or `anthropic-messages`.
- **Translation Bridge:** The gateway can seamlessly convert OpenAI request schemas into Anthropic schemas ([buildOpenAIToAnthropicRequest](file:///c:/Users/Dhiya%20Natarajan/Desktop/SaaS-Sentinel/src/providers/provider-routing.ts#131-186)). This involves re-mapping OpenAI roles (System, User) to Anthropic formats, remapping the model tags (e.g., standardizing `gpt-4` to an Anthropic fallback model like `claude-3-haiku`), and reformatting system prompts.
- **Response Normalization:** The proxy also reverse-translates Anthropic responses backward into standard OpenAI `chatcmpl` format so that downstream applications remain completely unaware a vendor reroute ever occurred.

### 3. Machine Learning & Anomaly Detection 

#### 3.1. Behavioral Anomalies ([src/services/anomaly.service.ts](file:///c:/Users/Dhiya%20Natarajan/Desktop/SaaS-Sentinel/src/services/anomaly.service.ts))
The system employs an **Isolation Forest** ML algorithm to detect structural abnormalities.
- **Feature Engineering:** It generates an 11-dimension vector per request considering values like `latency`, `statusCode`, `requestSize`, `responseSize`, hashed endpoint metadata, and cyclical time variables (e.g., converting continuous timestamps to `Math.sin/cos` transformations representing current Hour-Angles and Weekdays to identify "abnormal" times of day).
- **Automated Training:** Pulls the last 2000 clean requests from the database via Prisma and scales features between `[0,1]`. The model calculates its dynamic anomaly threshold based on an explicit contamination factor (e.g., top 5% of variance gets marked anomalous).
- **Detection Result:** Assigns real-time threshold scoring to proxy traffic, issuing high anomaly warnings directly to standard output.

#### 3.2. Usage Rate Anomalies ([src/ml/detect-anomaly.ts](file:///c:/Users/Dhiya%20Natarajan/Desktop/SaaS-Sentinel/src/ml/detect-anomaly.ts))
Uses statistical thresholds to deduce usage multipliers, categorizing traffic severity into `NONE`, `LOW`, `MEDIUM`, or `HIGH` based strictly on API velocity and historical baselines, allowing strict rate-limiting triggers when usage multipliers spike beyond standard bounds (e.g. `> 1.5x` baseline).

#### 3.3. Cost Forecasting ([src/services/forecast.service.ts](file:///c:/Users/Dhiya%20Natarajan/Desktop/SaaS-Sentinel/src/services/forecast.service.ts))
Generates 24-hour lookahead usage models mapped to standard default API cost templates, allowing active analytics predicting the upcoming daily expense cycle.

### 4. Control Engine & Policy Enforcement ([src/services/control-engine.service.ts](file:///c:/Users/Dhiya%20Natarajan/Desktop/SaaS-Sentinel/src/services/control-engine.service.ts))
Acts as the central "Brain" receiving inputs from the Proxy and ML layers. Based on dynamic `severity` generated from usage models, it executes Control Actions:
- **`BLOCK`**: Issued for `SECURITY_POLICY` bounds or `HIGH` severity thresholds.
- **`THROTTLE`**: Delays the requests forcibly by a static timeout multiplier based on rate bounds (e.g., 200ms up to 1000ms delay queues).
- **`DOWNGRADE`**: In `MEDIUM` severity levels, the engine will intercept the JSON HTTP payload and hot-swap the Model identifier to a cheaper tier (e.g., exchanging `gpt-4o` automatically to `gpt-4o-mini`).
- **`REROUTE`**: Initiates the protocol translation engine, redirecting load from constrained providers (e.g., OpenAI) directly onto fallback providers (e.g., Anthropic).

### 5. Metrics & DB Access ([src/services/metrics.service.ts](file:///c:/Users/Dhiya%20Natarajan/Desktop/SaaS-Sentinel/src/services/metrics.service.ts))
- Leverages Prisma database abstractions configured tightly for metric aggregation.
- Matches active HTTP requests against defined polymorphic [PricingRule](file:///c:/Users/Dhiya%20Natarajan/Desktop/SaaS-Sentinel/src/services/metrics.service.ts#142-173) matrices. Calculates the granular flat-rate cost of any particular transaction based on active effective timestamp windows and HTTP target filters.

---

## Operational Endpoints
The proxy exposes vast operational transparency endpoints routed through `Express` ([src/server.ts](file:///c:/Users/Dhiya%20Natarajan/Desktop/SaaS-Sentinel/src/server.ts)):
- `/analytics/trend`, `/analytics/summary`, `/analytics/live`: Provide cost structures and metric breakdowns.
- `/enforcements`: Fetches the audit log generated by the Policy Control engine. 
- `/ml/retrain`: Manually forces a synchronous recalculation of the ML baseline Isolation Models.
