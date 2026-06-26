# Kapruka Flow AI

**Kapruka Agent Challenge 2026**  
**Author:** Thanuka Ellepola  
**Live demo:** [kapruka-flow-ai.vercel.app](https://kapruka-flow-ai.vercel.app)  
**Source:** [github.com/Thanuka9/kapruka-flow-AI](https://github.com/Thanuka9/kapruka-flow-AI)

---

## What this is

**Kapruka Flow** is an AI-first shopping experience built on the public [Kapruka MCP](https://mcp.kapruka.com/). Instead of browsing category by category, a customer describes what they want in natural language. The system turns that intent into **four budget-aware cart plans**, lets them compare and refine, then completes a **real guest checkout** on Kapruka.

**Tagline:** *Tell me what you need. I'll build the cart.*

---

## Problem it solves


| Typical e-commerce                       | Kapruka Flow                                         |
| ---------------------------------------- | ---------------------------------------------------- |
| Search keywords, open many product pages | One sentence of intent                               |
| One cart, manual tweaks                  | Four optimized plans (Ideal, Cheaper, Premium, Fast) |
| Opaque recommendations                   | Visible MCP tool activity and curation story         |
| English-only UX friction                 | English, Sinhala, and Tanglish (UI + prompts)        |


---

## How it works (60-second overview)

```
Customer intent  →  4-agent pipeline  →  4 cart plans  →  refine / compare  →  Kapruka checkout
                         ↓
                  Kapruka MCP (live catalog)
```

1. **Customer** types or speaks a goal (e.g. *"Amma birthday gift under 10000, deliver to Kandy tomorrow"*).
2. **Backend** runs a four-step agent pipeline against live MCP data.
3. **Frontend** shows the workspace animation, MCP activity feed, and four cart tabs.
4. **Customer** adjusts budget, chats with **Ruka** to refine, or compares versions.
5. **Checkout** validates stock and price via MCP, then returns a **Kapruka payment URL**.

No external LLM API key is required. Planning uses a **deterministic MCP-native engine** (intent parsing, relevance scoring, budget filling) so behavior is predictable and demo-safe.

---

## The four-agent pipeline


| Step | Agent        | Role                                                                    |
| ---- | ------------ | ----------------------------------------------------------------------- |
| 1    | **Intent**   | Parse language, budget, city, date, occasion, recipient from the prompt |
| 2    | **Catalog**  | Search and enrich products from Kapruka MCP                             |
| 3    | **Delivery** | Validate city and resolve delivery fee via MCP                          |
| 4    | **Cart**     | Build four plan variants within budget using relevance scoring          |


Every MCP call is surfaced in the UI activity ticker so judges can see *what* the system did, not just the final cart.

---

## What it can do

### Shopping intelligence

- Multilingual intent: **English**, **Sinhala**, **Tanglish**
- Four cart strategies: **Ideal**, **Cheaper**, **Premium**, **Fast delivery**
- Instant **budget slider** rebalance (client-side, no new API round-trip)
- **Conversational refine** with Ruka (add/remove items, change city or budget)
- **Compare Versions** matrix and cart evolution timeline
- **Age-restricted** product deprioritization in ranking

### Kapruka MCP integration (live)

- Product search and enrichment
- Category navigation (65+ categories)
- Delivery city validation and fees
- Stock and price check at checkout
- Guest order creation with payment link

### Customer experience

- Kapruka-style header (search, categories, cart)
- Trending product cards on landing with **Add to cart**
- Sign in / register with order history for personalization
- Saved product bookmarks (star on card)
- Shareable session links (`?session=...`)
- Localized UI in three languages

---

## End-to-end flow (what judges should see)


| #   | Action                     | Expected result                                                             |
| --- | -------------------------- | --------------------------------------------------------------------------- |
| 1   | Open the live demo         | MCP status healthy; landing shows search, trending products, commerce steps |
| 2   | Build a cart from a prompt | Workspace shows pipeline; four cart tabs populate                           |
| 3   | Switch plans / compare     | Different items and prices per plan; comparison modal works                 |
| 4   | Refine via chat            | e.g. *"add chocolates"* updates the active cart                             |
| 5   | Review & Checkout          | Steps: Sender → Recipient → Delivery & gift → Review → **Pay**              |
| 6   | Complete payment step      | Kapruka MCP returns order reference and payment URL                         |


**Sample prompts to try**

- *Amma birthday gift under 10000 deliver to Kandy tomorrow*
- *Ada Colombo ekata groceries 20000 ta adu* (Tanglish)
- *අම්මාට උපන්දින තෑග්ගක් කොළඹට* (Sinhala)

---

## Architecture (compact)


| Layer                | Technology            | Responsibility                                        |
| -------------------- | --------------------- | ----------------------------------------------------- |
| **UI**               | Next.js 13, React     | Intent canvas, cart workspace, checkout, localization |
| **API proxy**        | Next.js `/api/`*      | Forwards to backend with timeout and client IP        |
| **Orchestrator**     | FastAPI, Python 3.10  | REST API, rate limits, sessions, checkout             |
| **Intelligence**     | `mcp_intelligence.py` | Intent parse, relevance score, cart optimization      |
| **Agents**           | `agents.py`           | Four-step MCP pipeline                                |
| **Data**             | SQLite (WAL)          | Users, sessions, carts, orders, analytics             |
| **Catalog & orders** | Kapruka MCP           | All live product and checkout data                    |


---

## Design principles

1. **MCP-first** — Products and orders come from Kapruka MCP, not a static mock catalog (`ALLOW_FALLBACK_CATALOG=false` in production).
2. **Transparent AI** — Tool names and pipeline steps are visible to the user.
3. **Plans, not a single guess** — Four carts respect different trade-offs (cost, quality, speed).
4. **Sri Lanka-ready** — Sinhala/Tanglish prompts and UI; LKR budgets; local delivery cities.
5. **Guest checkout** — No Kapruka account required to complete an order; optional Flow account for history.

---

## Security and reliability (summary)

- Passwords: PBKDF2-SHA256 with per-user salt  
- CORS locked to deployed frontend origins  
- Rate limits on intent, checkout, login, and search  
- Checkout re-validates MCP price (±5%) and stock before order  
- MCP calls: bounded timeout, retry with backoff  
- Simulated checkout disabled in production (`ALLOW_SIMULATED_CHECKOUT=false`)

---

## Quick links


| Resource                | URL / path                                                                                                     |
| ----------------------- | -------------------------------------------------------------------------------------------------------------- |
| Live demo               | [https://kapruka-flow-ai.vercel.app](https://kapruka-flow-ai.vercel.app)                                       |
| Repository              | [https://github.com/Thanuka9/kapruka-flow-AI](https://github.com/Thanuka9/kapruka-flow-AI)                     |
| Kapruka MCP docs        | [https://mcp.kapruka.com/](https://mcp.kapruka.com/)                                                           |
| Full README (technical) | `README.md` in repo                                                                                            |
| Manual test matrix      | `test.md` in repo                                                                                              |
| Agent Challenge         | [https://www.kapruka.com/contactUs/agentChallenge.html](https://www.kapruka.com/contactUs/agentChallenge.html) |


---

## Suggested 5-minute judge walkthrough

1. **Landing** — Confirm trending products, **Add to cart**, and the six-step commerce strip.
2. **Build** — One multilingual prompt; watch MCP activity.
3. **Compare** — Switch Ideal / Cheaper / Premium / Fast; open Compare Versions.
4. **Refine** — Ask Ruka to add or remove an item.
5. **Checkout** — Fill sender, recipient, delivery city/date, gift message; proceed to Kapruka pay link.

---

*Built for the Kapruka Agent Challenge 2026 using the public Kapruka MCP — no proprietary API key required.*