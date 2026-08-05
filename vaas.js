/* ============================================================
 *  VAAS (Visibility as a Service) — Shared Selection & Display
 *  Implements VAAS_SELECTION_LOGIC.md
 *  Shared between index.html and leaderboard.html
 * ============================================================ */
(function () {
    const VAAS_CONFIG = {
        VAAS_INTERVAL: 30,          // blocks between content refresh
        HALFLIFE_BLOCKS: 1200,      // weight halves this often (~1 hour)
        MAXLIFE_BLOCKS: 28800,      // item expiry (~1 day)
        MINREP: 45.0,
        MIN_FOLLOWERS: 20,
        MIN_MED_FOLLOWER_REP: 35.0,
        NODE_URL: 'https://api.steemit.com',
        URL_LEFT: 'https://steemit.com',
        STORAGE_KEY: 'phoenix_prime_vaas_state_v1'
    };

    // In-memory pools
    const state = {
        postPool: [],      // Pool A — null-beneficiary posts
        memoPool: [],      // Pool B — promo/vanity transfers
        changePost: true,
        lastBlockChecked: 0,
        lastIrreversibleBlock: 0,
        steemPerSbd: 9.5,  // fallback; updated from feed history
        currentBlock: 0,
        polling: false,
        displayType: null, // 'ben' | 'promo' | null
        displayData: null  // serializable payload for the current display
    };
    const authorCache = {};

    // ---------- Heat-scale color table (§9.1) ----------
    const VAAS_COLORS = [
        'rgb(255,100,0)',   // 0-1 cool
        'rgb(255,100,0)',
        'rgb(255,128,64)',  // 2-4 warm
        'rgb(255,128,64)',
        'rgb(255,128,64)',
        'rgb(253,152,0)',   // 5-7 warmer
        'rgb(253,152,0)',
        'rgb(253,152,0)',
        'rgb(0,253,228)',   // 8-9 hot
        'rgb(0,253,228)',
        'rgb(50,132,255)'   // 10 hottest
    ];

    function heatColor(colorIndex) {
        if (colorIndex < 0 || colorIndex > 10) return 'black';
        return VAAS_COLORS[colorIndex];
    }

    function heatAlpha(colorIndex) {
        return (colorIndex === 8 || colorIndex === 9) ? 0.25 : 0.5;
    }

    function strokeWidth(colorIndex) {
        return 2 + Math.floor((1 + colorIndex) / 2);
    }

    // ---------- repLog10 (§11.2) ----------
    function repLog10(rep) {
        let repStr = String(rep);
        if (repStr === '0') return 25.0;
        let sign = 1;
        if (repStr.startsWith('-')) { sign = -1; repStr = repStr.substring(1); }
        const leadingDigits = parseInt(repStr.substring(0, Math.min(4, repStr.length)), 10);
        let log = Math.log10(leadingDigits) + 0.00000001;
        const n = repStr.length - 1;
        const logValue = n + (log - Math.floor(log));
        let out = Math.max(logValue - 9, 0) * sign;
        out = out * 9 + 25;
        return Math.round(out * 100) / 100;  // HALF_UP, 2 decimals
    }

    // ---------- Median helper ----------
    function median(arr) {
        if (!arr || arr.length === 0) return 24.99;
        const sorted = arr.slice().sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        if (sorted.length % 2 === 1) return sorted[mid];
        return (sorted[mid - 1] + sorted[mid]) / 2;
    }

    // ---------- Steem path / URL extraction (§3.2) ----------
    function extractSteemPath(memo) {
        const patterns = [
            /(?:https?:\/\/[^\s\/]+\/)?(?:[^\s\/]+\/)?@([a-z0-9.-]+)\/([^\s]+)/i,
            /(?:https?:\/\/[^\s\/]+\/)?@([a-z0-9.-]+)\/([^\s]+)/i,
            /@([a-z0-9.-]+)\/([^\s]+)/i
        ];
        for (const re of patterns) {
            const m = memo.match(re);
            if (m) {
                let path = m[0];
                const hostMatch = path.match(/^https?:\/\/[^\s\/]+/i);
                if (hostMatch) path = path.substring(hostMatch[0].length);
                if (!path.startsWith('/')) path = '/' + path;
                return path;
            }
        }
        return null;
    }

    function extractURL(memo) {
        const re = /(?:https?|ftp):\/\/[^\s]+/i;
        const m = memo.match(re);
        return m ? m[0] : null;
    }

    function parseSteemPath(path) {
        const m = path.match(/@([a-z0-9.-]+)\/([^\s]+)/i);
        if (!m) return null;
        return { author: m[1], permlink: m[2] };
    }

    // ---------- Age decay (§5) ----------
    function adjustedNullBenWeight(post, currentBlock) {
        let adjusted = post.nullBenWeight;
        let timeFactor = currentBlock - post.blockNumber;
        while (timeFactor > VAAS_CONFIG.HALFLIFE_BLOCKS) {
            timeFactor -= VAAS_CONFIG.HALFLIFE_BLOCKS;
            adjusted = Math.floor(adjusted / 2);  // integer division
        }
        return adjusted;
    }

    function adjustedPromoWeight(memo, currentBlock) {
        let adjusted = memo.xferNormal;
        let timeFactor = currentBlock - memo.blockNumber;
        while (timeFactor > VAAS_CONFIG.HALFLIFE_BLOCKS) {
            timeFactor -= VAAS_CONFIG.HALFLIFE_BLOCKS;
            adjusted = adjusted / 2.0;  // floating-point division
        }
        return adjusted;
    }

    // ---------- Expiry trimming (§5.3) ----------
    function trimExpired() {
        state.postPool = state.postPool.filter(p => (state.currentBlock - p.blockNumber) <= VAAS_CONFIG.MAXLIFE_BLOCKS);
        state.memoPool = state.memoPool.filter(m => (state.currentBlock - m.blockNumber) <= VAAS_CONFIG.MAXLIFE_BLOCKS);
    }

    // ---------- Weighted random selection (§8) ----------
    function getRandomPost() {
        if (state.postPool.length === 0) return null;
        let totalWeight = 0;
        for (const post of state.postPool) {
            totalWeight += adjustedNullBenWeight(post, state.currentBlock);
        }
        let randomValue = Math.floor(Math.random() * (totalWeight + 1));
        let postIndex = 0;
        while (randomValue > 0 && postIndex < state.postPool.length) {
            const post = state.postPool[postIndex];
            postIndex += 1;
            randomValue -= adjustedNullBenWeight(post, state.currentBlock);
        }
        return state.postPool[Math.max(0, postIndex - 1)];
    }

    function getRandomMemo() {
        if (state.memoPool.length === 0) return null;
        let totalWeight = 0.0;
        for (const memo of state.memoPool) {
            totalWeight += adjustedPromoWeight(memo, state.currentBlock);
        }
        let randomValue = Math.random() * totalWeight;
        let memoIndex = 0;
        while (randomValue > 0.0 && memoIndex < state.memoPool.length) {
            const memo = state.memoPool[memoIndex];
            memoIndex += 1;
            randomValue -= adjustedPromoWeight(memo, state.currentBlock);
        }
        return state.memoPool[Math.max(0, memoIndex - 1)];
    }

    // ---------- Type selection (§6) ----------
    function selectType() {
        const numTypes = 3;
        let vaasType = Math.floor(Math.random() * numTypes);
        let checkType = vaasType;
        for (let lcv = 0; lcv < numTypes; lcv++) {
            if (checkType === 0) {
                if (state.postPool.length !== 0) return checkType;
                checkType = checkType + 1;
            } else if (checkType === 1 || checkType === 2) {
                if (state.memoPool.length !== 0) return checkType;
                checkType = checkType + 1;
            }
            if (checkType === numTypes) checkType = 0;
        }
        return vaasType;
    }

    // ---------- API helpers ----------
    async function rpc(method, params) {
        const resp = await fetch(VAAS_CONFIG.NODE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jsonrpc: '2.0', method, params, id: 1 })
        });
        const data = await resp.json();
        if (data && data.error) throw new Error(data.error.message || 'RPC error');
        return data && data.result;
    }

    async function fetchAuthorData(author) {
        if (authorCache[author]) return authorCache[author];
        const result = { reputation: 0, followers: 0, medianRep: 24.99 };
        try {
            const repRes = await rpc('condenser_api.get_account_reputations', [author, 1]);
            if (repRes && repRes.length > 0 && repRes[0].reputation) {
                result.reputation = repLog10(repRes[0].reputation);
            }
            const folRes = await rpc('follow_api.get_follow_count', [author]);
            if (folRes && folRes.follower_count) {
                result.followers = folRes.follower_count;
            }
            const reps = [];
            let start = null;
            for (let page = 0; page < 5; page++) {
                const params = { account: author, start, type: 'blog', limit: 1000 };
                const fol = await rpc('follow_api.get_followers', params);
                if (!fol || fol.length === 0) break;
                for (const f of fol) {
                    if (typeof f.reputation !== 'undefined') reps.push(parseInt(f.reputation, 10));
                }
                start = fol[fol.length - 1].follower;
                if (fol.length < 1000) break;
            }
            result.medianRep = median(reps);
        } catch (e) {
            console.error('VAAS author data error:', e);
        }
        authorCache[author] = result;
        return result;
    }

    async function fetchPostMetadata(author, permlink) {
        let post = null;
        for (let attempt = 0; attempt < 5; attempt++) {
            try {
                post = await rpc('condenser_api.get_content', [author, permlink]);
                if (post) break;
            } catch (e) { /* retry */ }
            await sleep(300);
        }
        if (!post) return null;
        const payoutMatch = String(post.pending_payout_value || '0').match(/^([\d.]+)/);
        return {
            title: post.title || '',
            rootAuthor: post.root_author || '',
            rootTitle: post.root_title || '',
            pendingPayout: payoutMatch ? parseFloat(payoutMatch[1]) : 0,
            netVotes: parseInt(post.net_votes, 10) || 0,
            url: post.url || `/${author}/${permlink}`
        };
    }

    // Resolve the display title for a post. Blank titles (i.e. replies/comments)
    // are shown as a reply to the parent post using its root_author + root_title.
    function resolveTitle(meta) {
        if (!meta) return '';
        if (meta.title) return meta.title;
        if (meta.rootTitle) return `Re: @${meta.rootAuthor}: ${meta.rootTitle}`;
        return '';
    }

    const sleep = ms => new Promise(r => setTimeout(r, ms));

    async function fetchFeedHistory() {
        try {
            const res = await rpc('condenser_api.get_feed_history', []);
            if (res && res.price_history && res.price_history.length > 0) {
                const ratios = [];
                for (const entry of res.price_history) {
                    const q = String(entry.quote || '').match(/^([\d.]+)/);
                    const b = String(entry.base || '').match(/^([\d.]+)/);
                    if (q && b && parseFloat(b[1]) > 0) {
                        ratios.push(parseFloat(q[1]) / parseFloat(b[1]));
                    }
                }
                if (ratios.length > 0) state.steemPerSbd = median(ratios);
            }
        } catch (e) { /* keep fallback */ }
    }

    // ---------- Pool building (§3) ----------
    async function processBlockOps(ops, blockNum) {
        for (const opEntry of ops) {
            const opTuple = opEntry && opEntry.op;
            if (!Array.isArray(opTuple) || opTuple.length < 2) continue;
            const opName = opTuple[0];
            const opData = opTuple[1];
            if (!opData) continue;

            if (opName === 'comment_options') {
                const extensions = opData.extensions;
                if (!Array.isArray(extensions)) continue;
                let nullWeight = -1;
                for (const ext of extensions) {
                    if (!Array.isArray(ext) || ext.length < 2) continue;
                    const val = ext[1];
                    if (val && Array.isArray(val.beneficiaries)) {
                        for (const ben of val.beneficiaries) {
                            if (ben && ben.account === 'null') {
                                nullWeight = parseInt(ben.weight, 10) || 0;
                            }
                        }
                    }
                }
                if (nullWeight === -1) continue;
                const authorData = await fetchAuthorData(opData.author);
                if (authorData.reputation <= VAAS_CONFIG.MINREP) continue;
                if (authorData.followers <= VAAS_CONFIG.MIN_FOLLOWERS) continue;
                if (authorData.medianRep <= VAAS_CONFIG.MIN_MED_FOLLOWER_REP) continue;
                state.postPool.push({
                    author: opData.author,
                    permlink: opData.permlink,
                    nullBenWeight: nullWeight,
                    blockNumber: blockNum
                });
            } else if (opName === 'transfer') {
                if (opData.to !== 'null') continue;
                const memo = String(opData.memo || '').trim();
                if (memo === '') continue;
                const parts = String(opData.amount || '').split(' ');
                const amount = parseFloat(parts[0]) || 0;
                const type = parts[1] || 'STEEM';
                let xferNormal = amount;
                if (type === 'SBD') xferNormal = amount * state.steemPerSbd;
                state.memoPool.push({
                    xferFrom: opData.from,
                    xferTo: 'null',
                    xferMemo: memo,
                    xferType: type,
                    xferAmount: amount,
                    xferNormal: xferNormal,
                    blockNumber: blockNum,
                    firstURL: extractURL(memo),
                    firstSteemPath: extractSteemPath(memo)
                });
            }
        }
    }

    function setScrollText(elId, text) {
        const el = document.getElementById(elId);
        if (el) {
            el.textContent = text;
            el.style.animation = 'none';
            void el.offsetWidth;
            el.style.animation = '';
        }
    }

    function applyBorder(holderId, colorIndex) {
        const holder = document.getElementById(holderId);
        if (!holder) return;
        holder.style.borderColor = heatColor(colorIndex);
        holder.style.borderWidth = strokeWidth(colorIndex) + 'px';
        holder.style.boxShadow = '0 0 12px rgba(0,0,0,0.3)';
    }

    function showEmpty() {
        const ben = document.getElementById('vaas-ben-holder');
        const promo = document.getElementById('vaas-promo-holder');
        if (ben) ben.classList.add('hidden');
        if (promo) promo.classList.add('hidden');
    }

    function updateStatus() {
        const statusEl = document.getElementById('vaas-status');
        if (statusEl) {
            const promos = state.memoPool.filter(m => m.firstSteemPath).length;
            const broadcasts = state.memoPool.filter(m => !m.firstSteemPath).length;
            statusEl.textContent = `Block #${state.currentBlock.toLocaleString()} | Posts: ${state.postPool.length} | Promos: ${promos} | Broadcasts: ${broadcasts}`;
        }
    }

    // ---------- Display (§9) ----------
    function computeBenDisplay(post, authorData) {
        const nullWeight = post.nullBenWeight / 100.0;
        const colorIndex = Math.floor(nullWeight / 10);
        return {
            type: 'ben',
            heading: `🔥 @null Beneficiary Post — ${nullWeight.toFixed(1)}% burn`,
            scrollText: resolveTitle(post) || '(untitled)',
            colorIndex,
            details: [
                { label: 'Author', value: `@${post.author}` },
                { label: 'Rep', value: authorData.reputation.toFixed(2) },
                { label: 'Followers', value: authorData.followers.toLocaleString() },
                { label: 'Med Follower Rep', value: authorData.medianRep.toFixed(2) },
                { label: 'Payout', value: post.pendingPayout.toFixed(3) + ' SBD' },
                { label: 'Votes', value: post.netVotes.toLocaleString() }
            ],
            linkText: 'View on Steem →',
            linkHref: VAAS_CONFIG.URL_LEFT + post.steemURL
        };
    }

    function computePromoDisplay(memo, postMeta, authorData) {
        // Total promo amount for the (from, memo) pair
        let burnAmount = 0;
        for (const m of state.memoPool) {
            if (m.xferFrom === memo.xferFrom && m.xferMemo === memo.xferMemo) {
                burnAmount += m.xferNormal;
            }
        }

        let colorIndex;
        if (burnAmount < 0.001) colorIndex = 0;
        else if (burnAmount < 0.1) colorIndex = 2;
        else if (burnAmount < 10) colorIndex = 5;
        else if (burnAmount < 100) colorIndex = 8;
        else colorIndex = 10;

        const display = { type: 'promo', colorIndex, burnAmount: burnAmount.toFixed(3) };

        const parsed = memo.firstSteemPath ? parseSteemPath(memo.firstSteemPath) : null;
        if (parsed) {
            display.heading = `📢 Promo: ${burnAmount.toFixed(3)} STEEM`;
            display.scrollText = postMeta ? (resolveTitle(postMeta) || '(untitled)') : `@${parsed.author}`;
            display.details = [
                { label: 'Author', value: `@${parsed.author}` },
                { label: 'Rep', value: authorData ? authorData.reputation.toFixed(2) : '—' },
                { label: 'Followers', value: authorData ? authorData.followers.toLocaleString() : '—' },
                { label: 'Med Follower Rep', value: authorData ? authorData.medianRep.toFixed(2) : '—' },
                { label: 'Payout', value: postMeta ? postMeta.pendingPayout.toFixed(3) + ' SBD' : '—' },
                { label: 'Votes', value: postMeta ? postMeta.netVotes.toLocaleString() : '—' }
            ];
            let path = memo.firstSteemPath;
            if (!path.startsWith('/')) path = '/' + path;
            display.linkText = 'View Promoted Post →';
            display.linkHref = VAAS_CONFIG.URL_LEFT + path;
        } else {
            display.heading = `💬 @${memo.xferFrom} says:`;
            display.scrollText = memo.xferMemo;
            display.details = [
                { label: 'From', value: `@${memo.xferFrom}` },
                { label: 'Amount', value: `${memo.xferAmount.toFixed(3)} ${memo.xferType}` },
                { label: 'Normalized', value: memo.xferNormal.toFixed(3) + ' STEEM' },
                { label: 'Total Promo', value: burnAmount.toFixed(3) + ' STEEM' }
            ];
            if (memo.firstURL) {
                display.linkText = 'Open URL →';
                display.linkHref = memo.firstURL;
            } else {
                display.linkText = 'View Profile →';
                display.linkHref = VAAS_CONFIG.URL_LEFT + '/@' + memo.xferFrom;
            }
        }
        return display;
    }

    function renderDisplay(display) {
        const benHolder = document.getElementById('vaas-ben-holder');
        const promoHolder = document.getElementById('vaas-promo-holder');

        if (!display || !display.type) {
            showEmpty();
            return;
        }

        if (display.type === 'ben') {
            if (promoHolder) promoHolder.classList.add('hidden');
            if (benHolder) benHolder.classList.remove('hidden');
            applyBorder('vaas-ben-holder', display.colorIndex);
            const h = document.getElementById('vaas-ben-heading');
            if (h) h.textContent = display.heading;
            setScrollText('vaas-ben-scroll', display.scrollText);
            const d = document.getElementById('vaas-ben-details');
            if (d) d.innerHTML = display.details.map(x => `<span>${x.label}: <strong>${x.value}</strong></span>`).join('');
            const l = document.getElementById('vaas-ben-link');
            if (l) { l.href = display.linkHref; l.textContent = display.linkText; }
            state.displayType = 'ben';
            state.displayData = display;
        } else {
            if (benHolder) benHolder.classList.add('hidden');
            if (promoHolder) promoHolder.classList.remove('hidden');
            applyBorder('vaas-promo-holder', display.colorIndex);
            const h = document.getElementById('vaas-promo-heading');
            if (h) h.textContent = display.heading;
            setScrollText('vaas-promo-scroll', display.scrollText);
            const d = document.getElementById('vaas-promo-details');
            if (d) d.innerHTML = display.details.map(x => `<span>${x.label}: <strong>${x.value}</strong></span>`).join('');
            const l = document.getElementById('vaas-promo-link');
            if (l) { l.href = display.linkHref; l.textContent = display.linkText; }
            state.displayType = 'promo';
            state.displayData = display;
        }
    }

    // ---------- Display cycle (§7) ----------
    async function handleBeneficiaryPost() {
        if (!state.changePost) return;
        state.changePost = false;
        const post = getRandomPost();
        if (!post) {
            if (state.postPool.length === 0) showEmpty();
            return;
        }
        const meta = await fetchPostMetadata(post.author, post.permlink);
        if (!meta) { showEmpty(); return; }
        post.title = meta.title;
        post.rootAuthor = meta.rootAuthor;
        post.rootTitle = meta.rootTitle;
        post.pendingPayout = meta.pendingPayout;
        post.netVotes = meta.netVotes;
        post.steemURL = meta.url;
        const authorData = await fetchAuthorData(post.author);
        const display = computeBenDisplay(post, authorData);
        renderDisplay(display);
        persistShared();
    }

    async function handlePromoMemo() {
        if (!state.changePost) return;
        state.changePost = false;
        if (state.memoPool.length === 0) { showEmpty(); return; }
        const memo = getRandomMemo();
        if (!memo) return;
        let postMeta = null;
        let authorData = null;
        if (memo.firstSteemPath) {
            const parsed = parseSteemPath(memo.firstSteemPath);
            if (parsed) {
                postMeta = await fetchPostMetadata(parsed.author, parsed.permlink);
                authorData = await fetchAuthorData(parsed.author);
            }
        }
        const display = computePromoDisplay(memo, postMeta, authorData);
        renderDisplay(display);
        persistShared();
    }

    async function displayCycle() {
        trimExpired();
        const vaasType = selectType();
        if (vaasType === 0) {
            await handleBeneficiaryPost();
        } else if (vaasType === 1 || vaasType === 2) {
            await handlePromoMemo();
        } else {
            showEmpty();
        }
        updateStatus();
    }

    // ---------- Blockchain polling ----------
    async function pollBlock() {
        if (state.polling) return;
        state.polling = true;
        try {
            const props = await rpc('condenser_api.get_dynamic_global_properties', []);
            if (!props || !props.last_irreversible_block_num) return;
            const lastIrreversible = props.last_irreversible_block_num;
            state.lastIrreversibleBlock = lastIrreversible;
            if (state.lastBlockChecked === 0) {
                state.lastBlockChecked = lastIrreversible;
                state.currentBlock = lastIrreversible;
                updateStatus();
                return;
            }
            if (state.lastBlockChecked >= lastIrreversible) return;
            const blockNum = state.lastBlockChecked + 1;
            const ops = await rpc('condenser_api.get_ops_in_block', [blockNum, false]);
            if (ops && Array.isArray(ops)) {
                await processBlockOps(ops, blockNum);
            }
            state.lastBlockChecked = blockNum;
            state.currentBlock = blockNum;
            updateStatus();

            if (blockNum % VAAS_CONFIG.VAAS_INTERVAL === 1) {
                await displayCycle();
            } else if (blockNum % VAAS_CONFIG.VAAS_INTERVAL === 2) {
                state.changePost = true;
            }
        } catch (e) {
            console.error('VAAS poll error:', e);
        } finally {
            state.polling = false;
        }
    }

    // ---------- Cross-page shared state ----------
    function persistShared() {
        try {
            const data = {
                postPool: state.postPool,
                memoPool: state.memoPool,
                currentBlock: state.currentBlock,
                lastBlockChecked: state.lastBlockChecked,
                displayType: state.displayType,
                displayData: state.displayData,
                timestamp: Date.now()
            };
            localStorage.setItem(VAAS_CONFIG.STORAGE_KEY, JSON.stringify(data));
        } catch (e) { /* storage unavailable */ }
    }

    function restoreShared() {
        try {
            const raw = localStorage.getItem(VAAS_CONFIG.STORAGE_KEY);
            if (!raw) return false;
            const data = JSON.parse(raw);
            if (!data || typeof data !== 'object') return false;
            if (data.postPool && Array.isArray(data.postPool)) state.postPool = data.postPool;
            if (data.memoPool && Array.isArray(data.memoPool)) state.memoPool = data.memoPool;
            if (typeof data.currentBlock === 'number') state.currentBlock = data.currentBlock;
            if (typeof data.lastBlockChecked === 'number') state.lastBlockChecked = data.lastBlockChecked;
            if (data.displayType) state.displayType = data.displayType;
            if (data.displayData) {
                state.displayData = data.displayData;
                renderDisplay(data.displayData);
            }
            return true;
        } catch (e) {
            return false;
        }
    }

    // ---------- Init ----------
    async function init() {
        try {
            const restored = restoreShared();
            if (restored) {
                updateStatus();
            }
            await fetchFeedHistory();
            await pollBlock();
            const scheduleNextPoll = () => {
                const behind = state.lastIrreversibleBlock && state.lastBlockChecked < state.lastIrreversibleBlock;
                setTimeout(async () => {
                    await pollBlock();
                    scheduleNextPoll();
                }, behind ? 1000 : 3000);
            };
            scheduleNextPoll();
        } catch (e) {
            console.error('VAAS init error:', e);
            const statusEl = document.getElementById('vaas-status');
            if (statusEl) statusEl.textContent = 'VAAS initialization failed.';
        }
    }

    window.VAAS = {
        init
    };
})();