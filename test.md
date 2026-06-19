Here is a full end-to-end test plan for Kapruka Flow — not just the recent upgrades. Use it as your pre-judge QA sheet.

Kapruka Flow — Full Test Plan 0. Before you start
Step Action Pass if
0.1
Backend running: uvicorn app.main:app --reload --port 8000
No startup errors
0.2
Frontend running: npm run dev (or npm run build + npm start)
Loads at http://localhost:3000
0.3
Click New Flow (or clear localStorage keys kapruka*flow*\*)
Input screen, no stale cart
0.4
Hard refresh once (Ctrl+Shift+R)
Latest JS/CSS loaded
0.5
MCP reachable: open /api/health or watch header MCP indicator
Green / healthy (or cached fallback, not crash)
Record: Browser (Chrome/Edge), viewport (desktop 1440px + mobile 390px), date/time.

1. Build & compile (must pass before demo)

# Test Command / action Pass if

1.1
Python syntax
python -m compileall backend/app
Exit 0, no errors
1.2
Production frontend build
cd frontend && npm run build
Build succeeds
1.3
Production serve smoke
npm start, open /
Page loads, no white screen 2. Backend API (direct or via frontend proxy)
Test each endpoint; note status code + body shape.

# Endpoint Method Test input Pass if

2.1
/api/health
GET
—
200, intelligence present, MCP status
2.2
/healthz
GET
—
200
2.3
/api/version
GET
—
200, version info
2.4
/api/categories
GET
—
200, categories array (or cached fallback)
2.5
/api/categories
GET
Hit 5× quickly
No 500; cache reduces MCP hammering
2.6
/api/search?q=chocolate
GET
q=chocolate
200, results array with priced items
2.7
/api/cities?q=col
GET
q=col
200, city suggestions
2.8
/api/intent
POST
See §3 prompts
200, session_id, 4 cart versions, pipeline_events, metadata
2.9
/api/intent
POST
Nonsense / empty catalog case
503 with clear message, not 500
2.10
/api/session?session_id=…
GET
Valid session from 2.8
Restores cart + metadata
2.11
/api/cart
POST
Update evolution
200, persists
2.12
/api/login
POST
Register new email + password
200, user object
2.13
/api/login
POST
Same email login
200
2.14
/api/login
POST
Wrong password
4xx, no crash
2.15
/api/orders?email=…
GET
Logged-in user
Orders list (may be empty first time)
2.16
/api/checkout
POST
Valid session + cart_version + delivery fields
200 success OR clear error (not 500)
2.17
/api/analytics
POST
Any event
200 / accepted silently 3. Intent pipeline & intelligence (core AI)
Run each from the input screen (Compose). Watch workspace animation + MCP activity ticker.

3.1 English prompts

# Prompt Pass if

3.1.1
Need dinner budget shopping under 10000 LKR
Budget limit 10,000; items + delivery ≤ 10,000 on Ideal
3.1.2
Amma birthday gift under 10000 deliver to Kandy tomorrow
Gift context in story/chat; city Kandy; budget 10,000
3.1.3
groceries under 20000 LKR
Grocery-ish items; budget 20,000
3.1.4
I need tea and cake hamper (no budget)
Budget inferred (~25k default); Ruka mentions assumed budget
3.1.5
flowers for Colombo today
Fast/today delivery bias; city Colombo
3.2 Sinhala (si-LK)

# Prompt Pass if

3.2.1
මට හෙටට රුපියල් 8000කට අඩුවෙන් මල් කළඹක් ඕනෑ
Budget ~8000; Sinhala story/reasons where applicable
3.2.2
Switch language to Sinhala, run any gift prompt
UI strings in Sinhala
3.3 Tanglish (en-LK)

# Prompt Pass if

3.3.1
Mata cake ekakui chocolates tikakui Colombo deliver karanna heta udeta
Parses city, delivery urgency, gift-ish items
3.3.2
Control bar Tanglish (from cart)
Re-runs last prompt in Tanglish
3.4 Pipeline transparency (judge wow)

# Check Pass if

3.4.1
Workspace steps
Understanding → Finding → Budget → Delivery → Cart animate
3.4.2
Quantified events
e.g. “Found X products”, “Removed Y over budget”, “Selected Z matches”
3.4.3
Intent event
Shows budget, city, occasion, gift, language where parsed
3.4.4
Completes without hanging
Reaches cart within ~2 min (or timeout shows error) 4. Four cart plans (Ideal · Cheaper · Premium · Fast)
After any successful build:

# Test Pass if

4.1
Tab Ideal Plan
Has items; subtotal + delivery ≤ budget
4.2
Tab Cheaper
Generally lower subtotal than Ideal (or fewer/pricier items)
4.3
Tab Premium
Higher-quality mix; still ≤ budget (hard cap)
4.4
Tab Fast Delivery
Items skew to Today/Fast tags where possible
4.5
Plan diff banner
Switching tabs shows what changed (brief diff UI)
4.6
Product cards
Name, price LKR, category, delivery badge, curation note
4.7
Images
Real image OR branded placeholder (not bare broken box)
4.8
View on Kapruka link
Opens product URL when present 5. Budget system (critical — you hit bugs here)

# Test Pass if

5.1
Ideal total vs limit
Never “Over Budget” on first load if budget was explicit
5.2
Drag slider to 5,000
Cart refits; total ≤ 5,000
5.3
Drag slider to 50,000
More items or same; total ≤ 50,000
5.4
Premium tab after slider
Still ≤ current budget limit
5.5
Add expensive item manually
Total may exceed; meter shows Over Budget (allowed)
5.6
Over-budget hint
Amber tip appears; checkout still allowed (user choice)
5.7
Suggested add-ons when under budget
Mix of affordable + one “stretch” higher item
5.8
Suggested add-ons when over budget
Cheapest trade-down options listed first 6. Ruka conversational refine (chat sidebar)
On cart screen, use chat input + quick chips.

# Message Pass if

6.1
make it cheaper
Switches to Cheaper; Ruka confirms
6.2
go premium
Premium tab; Ruka confirms
6.3
deliver today
Fast tab; Ruka confirms
6.4
keep it under 8000
Re-balanced; total ≤ 8,000
6.5
deliver to Galle
Delivery city updates; Ruka confirms
6.6
add chocolates
MCP search; item added; Ruka names product
6.7
remove the cake (or match item name)
Item removed; Ruka confirms
6.8
make it a gift
Gift mode flagged; Ruka confirms
6.9
add chocolates under 3000
Budget applied then add; item survives
6.10
asdf / hi
Clarifying question (not silent fail)
6.11
Quick chip Make cheaper
Same as 6.1
6.12
Reload page
Chat thread + cart restored
6.13
Evolution timeline
“Chat refine: …” step appears 7. Manual cart editing

# Test Pass if

7.1
Remove item
Gone from grid; subtotal updates
7.2
Replace → pick alternative
Item swapped; reason updated
7.3
Replace → search catalog (3+ chars)
MCP search results in dropdown
7.4
Add from Suggested add-ons
Item in cart; not duplicated
7.5
Star / save on card
Persists in localStorage
7.6
Header cart count
Matches active plan item count 8. Control Center (cart sidebar)

# Button Pass if

8.1
Make Cheaper
Active tab → Cheaper
8.2
Upgrade Premium
Active tab → Premium
8.3
Today Delivery
Active tab → Fast
8.4
Gift Mode
Checkout modal opens
8.5
Surprise Me
New pipeline run
8.6
Sinhala
Re-build in si-LK
8.7
Tanglish
Re-build in en-LK
8.8
Optimize
Strict budget re-run
8.9
Evolution timeline
Each action adds step; rollback restores snapshot 9. Header & navigation

# Test Pass if

9.1
Logo click
Resets to input (New Flow)
9.2
Header search chocolate cake
Starts build with that query
9.3
All Categories dropdown
Lists MCP categories; pick one → build
9.4
Quick category chips (header)
Same
9.5
Language selector (header + input)
EN / Sinhala / Tanglish UI updates
9.6
MCP health indicator
Reflects /api/health (not spamming errors)
9.7
Amazing Crate / cart icon
Goes to cart view when session exists 10. Input screen UX

# Test Pass if

10.1
Ruka greeting bubble
Shows name “Ruka”, no em dashes
10.2
Seasonal nudge chip
Visible (month-appropriate)
10.3
▶ Watch the demo
Runs Amma/Kandy/10k flow end-to-end
10.4
Quick suggestion chips
Fill input on click
10.5
Voice button
Simulated typing OR real mic (browser dependent)
10.6
Logged-in: “For You” + Picked for you
Chips from order history after ≥1 order
10.7
Empty submit
Does nothing (no crash) 11. Authentication

# Test Pass if

11.1
Open Login modal
Centered on screen; footer buttons visible without page scroll
11.2
Register new account
Success; header shows user
11.3
Logout
Clears session user
11.4
Login existing
Success
11.5
Profile modal
Order history table; bookmark count
11.6
Escape / backdrop click
Closes modal
11.7
Page scroll locked while modal open
Background doesn’t scroll 12. Checkout

# Test Pass if

12.1
Proceed to Checkout
Modal centered; form visible without hunting
12.2
Required fields validation
Blocks submit if empty
12.3
City autocomplete
Typing Kan suggests Kandy etc.
12.4
Guest: optional email
Field visible when not logged in
12.5
Guest: Create account checkbox
Shows password field
12.6
Submit order
Success screen + payment link OR clear error
12.7
Optional account after checkout
Auto-login if checkbox + password used
12.8
Invoice block
Items, subtotal, delivery, total match cart
12.9
Pinned footer
Total + Pay/Cancel always visible on mobile
12.10
Logged-in checkout
Email pre-filled from user 13. MCP showcase panel (judge rubric)
After a successful build, sidebar should show:

# Check Pass if

13.1
Live product count
e.g. “42 live products”
13.2
Kapruka MCP tools used
Lists tools with call counts
13.3
Expected tools (typical run)
kapruka_search_products, kapruka_get_product, kapruka_list_delivery_cities, kapruka_check_delivery
13.4
Footer mcp.kapruka.com
Visible 14. Session, share & persistence

# Test Pass if

14.1
Share Flow
Copies ?session=… URL
14.2
Open shared URL in new tab
Same cart restored
14.3
Refresh mid-cart
Session restores from DB/localStorage
14.4
New Flow
Clears cart; back to input 15. Error handling & resilience

# Test Pass if

15.1
MCP slow / busy
Workspace completes or degrades gracefully (not infinite spinner)
15.2
Zero products returned
no_products message; returns to input
15.3
Flow error toast
Retry + Dismiss work
15.4
Intent timeout (120s)
Error message, return to input
15.5
Rapid health/category polls
No self-inflicted 429 crash loops
15.6
Checkout failure
Error state + Try Again in modal 16. Mobile (390px width)

# Area Pass if

16.1
Header
Search + nav usable; no horizontal overflow
16.2
Input screen
Compose button not clipped
16.3
Cart plan tabs
Scroll horizontally; labels readable
16.4
Product grid
Single column
16.5
Ruka chat
Thread scrolls; composer usable
16.6
Checkout modal
Centered; pinned footer buttons tappable
16.7
Login modal
Centered; Sign Up visible 17. Localization sweep
Switch language to each; spot-check same flow:

Language Check strings on
English
Input, workspace, cart, chat, checkout, errors
Sinhala
Ruka greeting, budget meter, chat replies
Tanglish
Control bar Tanglish rebuild + UI labels 18. Judge demo script (60–90 seconds — rehearse this)
New Flow → input screen
Click ▶ Watch the demo (or type Amma/Kandy/10k prompt)
Point at workspace: “Ruka is querying Kapruka MCP live…”
Land on cart → show 4 plans, budget meter healthy, MCP tools used
Chat: add chocolates → item appears
Chat: make it cheaper → plan switches
Show Suggested add-ons (user choice, can go over budget)
Proceed to Checkout → guest fill → optional account tick
Mention: Sinhala/Tanglish, logged-in personalization, share link
Pass if: Whole script completes once without refresh hacks.

19. Production readiness (before you host)

# Item Pass if

19.1
npm run build clean
✓
19.2
Backend env: no simulated checkout in prod
ALLOW_SIMULATED_CHECKOUT=false
19.3
CORS allows your frontend origin
API calls work from deployed URL
19.4
SQLite / DB writable on server
Sessions persist
19.5
One full demo on deployed URL
Same as §18
19.6
Second browser / incognito
Share link + guest checkout work 20. Sign-off checklist
Print this and tick when done:

[ ] §1 Build & compile
[ ] §2 All API endpoints
[ ] §3 Intent (EN + Sinhala + Tanglish)
[ ] §4 Four cart plans
[ ] §5 Budget hard cap + slider + suggestions
[ ] §6 Ruka chat (all 13 cases)
[ ] §7 Manual cart edit
[ ] §8 Control Center
[ ] §9 Header & nav
[ ] §10 Input screen + demo button
[ ] §11 Auth modals centered
[ ] §12 Checkout + optional account
[ ] §13 MCP tools panel
[ ] §14 Share & persistence
[ ] §15 Errors & 429 resilience
[ ] §16 Mobile 390px
[ ] §17 Localization
[ ] §18 Judge demo rehearsed
[ ] §19 Production deploy smoke
Priority if you're short on time
P0 (blockers): §1, §3.1.2, §5, §6, §12, §16, §18
P1 (judge impression): §4, §6, §13, §10.3, §11
P2 (nice to have): §8, §14, §17, §15
