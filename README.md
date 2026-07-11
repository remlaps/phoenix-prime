# Phoenix Prime on Steem

Phoenix Prime is an open-source, client-side web application designed to scan an account's entire transaction history for `@null` burn operations. When a burn operation is found, the app subjects the corresponding transaction block number to a comprehensive mathematical and structural analysis matrix, cataloging rare data configurations and collecting them into a visual dashboard.
### Block Dominance Matrix (New)

The tool goes beyond basic history scanning by actively cross-examining the global ledger state for competitive validation:

*   **Burn King (STEEM/SBD):** When a personal burn is identified, the engine dynamically fetches the entire parent block (`condenser_api.get_block`). It aggregates all competitive transfer operations directed to `@null` within those 3 seconds, evaluating whether your account was the absolute highest burner of that asset class in the entire block.

## Block Archeology Classifications

The engine analyzes each block number against structural patterns, recreational number theory rules, and classic sequence properties.

### Structural & Positional Patterns

*   **Palindrome:** Block numbers that read exactly the same forward and backward (e.g., `8455548`).
*   **Radar:** An even-length block number where the first half matches the second half identically (e.g., `439439`).
*   **3-Digit Bookend:** Block numbers where the first 3 digits and the last 3 digits match perfectly (e.g., `714...714`).
*   **Bi-Class:** Numbers composed entirely of only two distinct digits (e.g., `8118818`).
*   **5 of a Kind:** A block where a single digit appears exactly 5 times (e.g., `83858828`).
*   **6 of a Kind:** A block where a single digit appears exactly 6 times.
*   **7 of a Kind:** A block where a single digit appears exactly 7 times.
*   **8 of a Kind:** A block where a single digit appears exactly 8 times.
*   **9 of a Kind:** A block where a single digit appears exactly 9 times.
*   **10 of a Kind:** A block where a single digit appears exactly 10 times.
*   **4 Zeroes:** A block ending in exactly 4 consecutive zeroes (e.g., `8420000`).
*   **5 Zeroes:** A block ending in exactly 5 consecutive zeroes.
*   **6 Zeroes:** A block ending in exactly 6 consecutive zeroes.
*   **7 Zeroes:** A block ending in exactly 7 consecutive zeroes.
*   **8 Zeroes:** A block ending in exactly 8 consecutive zeroes (e.g., `8400000000`).

### Number Theory Properties

*   **Harshad Number:** A number that is perfectly divisible by the sum of its individual digits (e.g., block `24` is divisible by $2 + 4 = 6$).
*   **Happy Block:** A block number that eventually reaches $1$ when replacing the number with the sum of the squares of its digits repeatedly.
*   **Phoenix Prime:** A block number that has no positive divisors other than $1$ and itself.
*   **Fibonacci Helix:** A block number that belongs to the classic golden ratio Fibonacci sequence.
*   **Century Block (Milestone):** Round milestone markers hitting exact hundreds or thousands lines (perfectly divisible by $100$).
*   **Millennium:** A subset of milestones marking major epoch lines (perfectly divisible by $1,000$).
*   **Binary Code:** Rare computational blocks composed exclusively of the digits `0` and `1`.

### Baseline Control

*   **Even / Odd:** The fundamental parity classification applied to every single block.
*   **Standard:** A block that contains no rare attributes. If a block fails to trigger any of the special mathematical patterns or structural traits listed above, it is cataloged as a standard baseline item.

---

## How it Works

1.  **API Streaming:** The app securely hits the public Steem Data Service (`SDS`) history API via HTTPS endpoint frameworks to pool transfer histories.
2.  **Filtration Loop:** It isolates transactions going to `@null` and maps out their raw block sequences.
3.  **Matrix Analysis:** It processes the block data array dynamically via client-side JavaScript.
4.  **UI Assembly:** It builds high-density visual metric cards styled with custom context-aware borders and labels on your local browser dashboard.

---

## Getting Started

Since this utility is entirely self-contained within a single file architecture, running it is plug-and-play:

1. Save the project code file as `index.html`.
2. Double-click the file to launch it directly in any modern desktop or mobile browser.
3. Enter your Steem username in the input box and select **Scan Entire History**.