# Phoenix Prime on Steem

Phoenix Prime is an open-source, client-side web application designed to scan an account's transaction history for `@null` burn operations. When a burn operation is found, the app subjects the corresponding transaction block number to a comprehensive mathematical and structural analysis matrix, cataloging rare data configurations and collecting them into a visual dashboard.

### Block Dominance Matrix

The tool goes beyond basic history scanning by actively cross-examining the global ledger state for competitive validation:

*   **BurnMaxer (STEEM/SBD):** When a personal burn is identified, the engine dynamically fetches the entire parent block (`condenser_api.get_block`). It aggregates all competitive transfer operations directed to `@null` within those 3 seconds, evaluating whether your account was the absolute highest burner of that asset class in the entire block.

## Block Archeology Classifications

The engine analyzes each block number against structural patterns, recreational number theory rules, and classic sequence properties.

### Structural & Positional Patterns

*   **Palindrome:** Block numbers that read exactly the same forward and backward (e.g., `8455548`).
*   **Radar:** An even-length block number where the first half matches the second half identically (e.g., `439439`).
*   **3-Digit Bookend:** Block numbers where the first 3 digits and the last 3 digits match perfectly (e.g., `714...714`).
*   **4-Digit Bookend:** Block numbers where the first 4 digits and the last 4 digits match perfectly (e.g., `1234...1234`).
*   **Mirror 3-Straight:** Block numbers containing a mirrored straight: 3-digit ascending (or descending) straight followed immediately by the same in reverse (e.g., `123321`, `321123`).
*   **Mirror 4-Straight:** Block numbers containing a mirrored straight: 4-digit ascending (or descending) straight followed immediately by the same in reverse (e.g., `1234321`, `43211234`).
*   **Bi-Class:** Numbers composed entirely of only two distinct digits (e.g., `8118818`).
*   **5+ of a Kind:** A block where a single digit appears at least 5 times.
*   **6+ of a Kind:** A block where a single digit appears at least 6 times.
*   **7+ of a Kind:** A block where a single digit appears at least 7 times.
*   **8+ of a Kind:** A block where a single digit appears at least 8 times.
*   **9+ of a Kind:** A block where a single digit appears at least 9 times (the maximum possible since block numbers have 9 digits).
*   **Straight:** A block containing 5 consecutive ascending or descending digits (e.g., `12345`, `34567`, `98765`).
*   **Unordered Straight 5:** A block containing all 5 digits of a straight in any order (e.g., `35142` contains `1,2,3,4,5`).
*   **Straight Ext:** A block containing 6-10 consecutive ascending digits.
*   **Unordered Straight Ext:** A block containing all 6+ digits of a straight in any order (e.g., `546372` contains `2,3,4,5,6,7`).
*   **Full House:** A block with 3 of one digit and 2 of another (e.g., `33344`, `55522`).
*   **Full House Ext:** An extended full house with 4+3, 5+4, or 6+5 of two distinct digits.
*   **4+ Zeroes:** A block ending in at least 4 consecutive zeroes (e.g., `8420000`).
*   **5+ Zeroes:** A block ending in at least 5 consecutive zeroes.
*   **6+ Zeroes:** A block ending in at least 6 consecutive zeroes.
*   **7+ Zeroes:** A block ending in at least 7 consecutive zeroes.
*   **8+ Zeroes:** A block ending in at least 8 consecutive zeroes (e.g., `8400000000`).

### Number Theory Properties

*   **Harshad Number:** A number that is perfectly divisible by the sum of its individual digits (e.g., block `24` is divisible by $2 + 4 = 6$).
*   **Happy Block:** A block number that eventually reaches $1$ when replacing the number with the sum of the squares of its digits repeatedly.
*   **Phoenix Prime:** A block number that has no positive divisors other than $1$ and itself.
*   **Twin Prime:** A prime block number where either $p-2$ or $p+2$ is also prime (e.g., block `5` is part of the twin prime pair `(3, 5)`).
*   **Fibonacci Helix:** A block number that belongs to the classic golden ratio Fibonacci sequence.
*   **Century Block (Milestone):** Round milestone markers hitting exact hundreds or thousands lines (perfectly divisible by $100$).
*   **Millennium:** A subset of milestones marking major epoch lines (perfectly divisible by $1,000$).
*   **Binary Code:** Rare computational blocks composed exclusively of the digits `0` and `1`.

### Baseline Control

*   **Even / Odd:** The fundamental parity classification applied to every single block.
*   **Standard:** A block that contains no rare attributes. If a block fails to trigger any of the special mathematical patterns or structural traits listed above, it is cataloged as a standard baseline item.

---

## Features

### Time-Range Filtering (Pre-Scan)
Before scanning, select a time range from the filter bar (All Time / 1 Day / 7 Days / 30 Days / 90 Days / 1 Year). The scan will only fetch burn records within that window, significantly reducing API calls and scan time for recent history. The summary dashboard displays the account name and time range searched.

### Upcoming Special Blocks Sidebar
A right sidebar automatically fetches the last irreversible block from the Steem API and analyzes the next 4,800 blocks (~4 hours). Block numbers with special mathematical or structural properties are listed with compact badge labels. Refresh the sidebar at any time with the Refresh button.

---

## How it Works

1.  **Range Selection:** Choose a time range (or All Time) from the filter buttons above the search box.
2.  **API Streaming:** The app hits the public Steem Data Service (`SDS`) history API via HTTPS endpoint frameworks to pool transfer histories within the selected time window.
3.  **Filtration Loop:** It isolates transactions going to `@null` and maps out their raw block sequences. When a time range is active, the engine stops fetching once records older than the cutoff are encountered (API returns DESC order).
4.  **Block Resolution:** Since `transfers_api` returns timestamps without block numbers, the engine performs binary search via `blocks_api/getBlock` to map each burn timestamp to its block number. During this process, all transfer-to-null operations in each visited block are indexed into a global burn ledger (no extra API calls needed).
5.  **Dominance Check:** Using the pre-built burn ledger, it evaluates whether your account was the highest STEEM/SBD burner in each block.
6.  **Matrix Analysis:** It processes the block data array dynamically via client-side JavaScript.
7.  **UI Assembly:** It builds high-density visual metric cards styled with custom context-aware borders and labels on your local browser dashboard. Stats with zero entries are hidden by default; click "Show Zero Categories" to reveal them.
8.  **Sidebar:** On page load, fetches the current chain state and scans the next 4,800 blocks for special categories.

---

## Getting Started

Since this utility is entirely self-contained within a single file architecture, running it is plug-and-play:

1. Save the project code file as `index.html`.
2. Double-click the file to launch it directly in any modern desktop or mobile browser.
3. Select a time range from the filter bar (optional).
4. Enter your Steem username in the input box and click **Scan History**.