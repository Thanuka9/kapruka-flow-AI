# KAPRUKA FLOW

## AI Shopping Experience for Kapruka Agent Challenge 2026

Author: Thanuka Ellepola
Version: V1.0

You are a AI/UI/Backend Engeneer with lot of knowlage

---

# 1. PROJECT VISION

Build an AI-first shopping experience for Kapruka.

Not:

- Search → Product → Cart

Not:

- Chatbot → Product List

Instead:

User Intent
→ AI Understanding
→ Product Discovery
→ Budget Optimization
→ Delivery Validation
→ Cart Creation
→ Checkout

The goal is to create an experience that feels intelligent, visual, useful, and memorable.

---

# 2. CHALLENGE UNDERSTANDING

Kapruka already has:

- Search
- Categories
- Product pages
- Checkout

Therefore our project should NOT replace those.

Our value:

AI makes decisions.

---

# 3. PRODUCT NAME

KAPRUKA FLOW

Tagline:

"Tell us what you want. We'll build the shopping plan."

---

# 4. CORE PRINCIPLES

## Principle 1

No traditional search.

## Principle 2

Conversation should feel natural.

## Principle 3

Products must appear visually.

## Principle 4

Shopping should evolve.

## Principle 5

MCP must be visible and meaningful.

---

# 5. USER JOURNEY

OPEN

↓

Intent

↓

AI Processing

↓

Cart Building

↓

Optimization

↓

Delivery

↓

Checkout

---

# 6. SCREEN 1 — INTENT CANVAS

Entire screen.

Prompt:

What do you want today?

Quick Actions:

Monthly Shopping

Need Something Today

Gift

Surprise Me

Build My Cart

Budget Shopping

Custom Request

Examples:

"I need groceries under 20k"

"My sister graduated"

"Need office snacks"

"Need dinner"

Elements:

Center Input

Animated Background

Quick Suggestions

Voice Input

Language Toggle

---

# 7. SCREEN 2 — AI WORKSPACE

Purpose:

Show AI working.

Panels:

Understanding

Finding Products

Budget Planning

Delivery Validation

Cart Building

Display:

🧠 Understanding

↓

🛒 Searching

↓

💰 Optimizing

↓

🚚 Delivery

↓

📦 Ready

Avoid exposing raw reasoning.

Show progress.

---

# 8. SCREEN 3 — CART EVOLUTION

This becomes the unique feature.

Version 1

↓

Cheaper

↓

Version 2

↓

Premium

↓

Version 3

↓

Fast Delivery

↓

Version 4

Each version stored.

User can switch.

---

# 9. SCREEN 4 — STORY LAYER

Explain selections.

Example:

Added tea because it fits evening shopping.

Added card because this feels incomplete.

Added lower-price alternative to stay inside budget.

Short explanations only.

---

# 10. SCREEN 5 — CONTROL BAR

Bottom actions:

Make Cheaper

Premium

Gift Mode

Today Delivery

Surprise

Sinhala

Tanglish

Replace Item

Optimize

---

# 11. SCREEN 6 — CHECKOUT

Summary:

Goal

Products

Budget

Delivery

Gift Message

Checkout

---

# 12. AI SYSTEM

Agents:

Intent Agent

↓

Shopping Agent

↓

Recommendation Agent

↓

Delivery Agent

↓

Cart Agent

Responsibilities:

Intent
Understand user goal.

Shopping
Retrieve MCP products.

Recommendation
Rank products.

Delivery
Validate timing.

Cart
Generate final selection.

---

# 13. MCP INTEGRATION

Endpoint:

mcp.kapruka.com/mcp

No API key.

Usage:

User Input

↓

Intent Parsing

↓

MCP Product Search

↓

Filtering

↓

Scoring

↓

Display

MCP Use Cases:

Product Lookup

Category Search

Cart Generation

Delivery Checks

Recommendations

---

# 14. UI SYSTEM

Theme:

Dark Premium

Primary:
Black

Secondary:
White

Accent:
Kapruka Red

Typography:

Inter

Animations:

Framer Motion

Cards:

Glass

Spacing:

Large

Rounded Corners

---

# 15. COMPONENTS

InputPanel

ProductGrid

CartPanel

AgentProgress

StoryCards

BudgetSlider

DeliveryPanel

SummaryPanel

LanguageToggle

---

# 16. PRODUCT CARD

Image

Title

Reason

Price

Delivery

Add

Replace

Save

---

# 17. CART PANEL

Items

Subtotal

Delivery

Budget

Progress

Buttons

---

# 18. DATABASE

Tables:

sessions

messages

cart_versions

user_preferences

delivery_state

analytics

---

# 19. PREFERENCE ENGINE

Track:

Budget

Language

Categories

Delivery Speed

Avoid:

Long-term storage

No account required.

---

# 20. LANGUAGES

English

Sinhala

Tanglish

Examples:

machan budget eka 10k

amma ta gift ekak

---

# 21. PERFORMANCE TARGETS

Initial Load:
<2 sec

AI Response:
<5 sec

Product Load:
<2 sec

Animation:
60 FPS

---

# 22. TECH STACK

Frontend

Next.js

Tailwind

Framer Motion

Backend

FastAPI

AI

OpenAI

Data

MCP

Deployment

Vercel

---

# 23. FOLDER STRUCTURE

frontend/

components/

pages/

hooks/

services/

backend/

agents/

api/

models/

utils/

shared/

---

# 24. ANALYTICS

Track:

Intent

Clicks

Cart Builds

Completion

Dropoff

---

# 25. MVP

Must Have:

Intent Screen

AI Workspace

MCP

Visual Products

Cart

Delivery

Checkout

Nice to Have:

Voice

Story

Cart Evolution

---

# 26. RISKS

Too many features

Slow MCP

Bad prompts

UI overload

Mitigation:

Keep scope small.

---

# 27. DEMO SCRIPT

Open

Type:

Need groceries under 20k

Show AI

Show Cart

Adjust

Checkout

Total:

45–60 sec

---

# 28. JUDGE WOW MOMENTS

Cart Evolution

Visual AI

Sinhala

Story Layer

Fast Experience

---

# 29. DEFINITION OF DONE

Public URL

Responsive

No crashes

Visual

MCP integrated

Shopping complete

Delivery handled

Checkout works

---

# 30. FINAL GOAL

Do not build:

AI chatbot.

Build:

The shopping experience people remember.
