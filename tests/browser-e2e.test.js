/**
 * LazySloth Cleaner - Headless Browser End-to-End Test Suite
 * 
 * Uses native Node 24 WebSocket and Chrome/Edge DevTools Protocol (CDP)
 * to test real DOM rendering, interactions, duplicate detection, and console cleanliness.
 */

const http = require('http');
const { spawn } = require('child_process');
const server = require('../server.js');

const PORT = 3000;
const CDP_PORT = 9222;

const BROWSER_PATHS = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
];

function findBrowserPath() {
    const fs = require('fs');
    for (const p of BROWSER_PATHS) {
        if (fs.existsSync(p)) return p;
    }
    throw new Error('No compatible Chrome or Edge browser executable found.');
}

async function waitHttpOk(url, maxAttempts = 30) {
    for (let i = 0; i < maxAttempts; i++) {
        try {
            const res = await fetch(url);
            if (res.ok) return await res.json();
        } catch (e) {
            // Wait and retry
        }
        await new Promise(r => setTimeout(r, 200));
    }
    throw new Error(`Timeout waiting for ${url}`);
}

class CDPClient {
    constructor(wsUrl) {
        this.ws = new WebSocket(wsUrl);
        this.id = 1;
        this.callbacks = new Map();
        this.events = [];
        this.consoleMessages = [];

        this.readyPromise = new Promise((resolve, reject) => {
            this.ws.onopen = resolve;
            this.ws.onerror = reject;
        });

        this.ws.onmessage = (event) => {
            const msg = JSON.parse(event.data);
            if (msg.id && this.callbacks.has(msg.id)) {
                const cb = this.callbacks.get(msg.id);
                this.callbacks.delete(msg.id);
                if (msg.error) cb.reject(new Error(msg.error.message));
                else cb.resolve(msg.result);
            } else if (msg.method) {
                if (msg.method === 'Console.messageAdded') {
                    this.consoleMessages.push(msg.params.message);
                } else if (msg.method === 'Runtime.consoleAPICalled') {
                    this.consoleMessages.push(msg.params);
                } else if (msg.method === 'Runtime.exceptionThrown') {
                    this.consoleMessages.push({
                        level: 'error',
                        text: msg.params.exceptionDetails.text,
                        exception: msg.params.exceptionDetails.exception,
                        stack: msg.params.exceptionDetails.stackTrace
                    });
                }
            }
        };
    }

    async send(method, params = {}) {
        await this.readyPromise;
        const msgId = this.id++;
        return new Promise((resolve, reject) => {
            this.callbacks.set(msgId, { resolve, reject });
            this.ws.send(JSON.stringify({ id: msgId, method, params }));
        });
    }

    async evaluate(expression) {
        const result = await this.send('Runtime.evaluate', {
            expression,
            returnByValue: true,
            awaitPromise: true
        });
        if (result.exceptionDetails) {
            const desc = result.exceptionDetails.exception ? result.exceptionDetails.exception.description : result.exceptionDetails.text;
            throw new Error(`Evaluation failed for "${expression}": ${desc}`);
        }
        return result.result ? result.result.value : undefined;
    }

    close() {
        this.ws.close();
    }
}

async function runE2ETests() {
    console.log('========================================================');
    console.log('  LazySloth Cleaner - Headless Browser E2E Test Suite');
    console.log('========================================================\n');

    // 1. Check or start static server
    let serverStartedByTest = false;
    try {
        const check = await fetch(`http://localhost:${PORT}/lazysloth_cleaner.html`);
        if (check.ok) {
            console.log(`✓ Reusing existing running static server on http://localhost:${PORT}`);
        } else {
            throw new Error('Server not OK');
        }
    } catch (e) {
        await new Promise((resolve, reject) => {
            server.once('error', reject);
            server.listen(PORT, () => {
                serverStartedByTest = true;
                resolve();
            });
        });
        console.log(`✓ Local static server started on http://localhost:${PORT}`);
    }

    // 2. Launch headless browser
    const browserPath = findBrowserPath();
    console.log(`✓ Using browser at: ${browserPath}`);

    const browserProc = spawn(browserPath, [
        '--headless=new',
        `--remote-debugging-port=${CDP_PORT}`,
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-gpu',
        '--disable-background-networking',
        'about:blank'
    ], { stdio: 'ignore' });

    let cdp = null;

    try {
        // 3. Connect to browser CDP
        const versionData = await waitHttpOk(`http://127.0.0.1:${CDP_PORT}/json/version`);
        console.log(`✓ Connected to browser CDP: ${versionData.Browser}`);

        const targets = await waitHttpOk(`http://127.0.0.1:${CDP_PORT}/json/list`);
        const pageTarget = targets.find(t => t.type === 'page');
        if (!pageTarget) throw new Error('No page target found');

        cdp = new CDPClient(pageTarget.webSocketDebuggerUrl);
        await cdp.send('Page.enable');
        await cdp.send('Runtime.enable');
        await cdp.send('Console.enable');

        // 4. Navigate to application
        console.log('\nNavigating to http://localhost:3000/lazysloth_cleaner.html...');
        await cdp.send('Page.navigate', { url: `http://localhost:${PORT}/lazysloth_cleaner.html` });

        // Wait for page to load
        await new Promise(r => setTimeout(r, 1200));

        console.log('Console messages so far:', cdp.consoleMessages);

        // Test 1: Page Title and Mascot Header
        console.log('\n[Check 1] Page Title & Brand Integrity');
        const title = await cdp.evaluate('document.title');
        console.log(`  Page title: "${title}"`);
        if (!title.includes('LazySloth Cleaner')) throw new Error('Title does not match "LazySloth Cleaner"');

        const headerBrand = await cdp.evaluate('document.querySelector("header h1").innerText.trim()');
        console.log(`  Header brand text: "${headerBrand}"`);
        if (headerBrand !== 'LazySloth Cleaner') throw new Error('Header brand does not equal "LazySloth Cleaner"');

        // Test 2: Mascot SVG and Initial Sleeping (NAP) State
        console.log('\n[Check 2] Mascot SVG & Sleeping State on Home Screen');
        const hasSvg = await cdp.evaluate('Boolean(document.getElementById("sloth-svg"))');
        console.log(`  Mascot SVG rendered: ${hasSvg}`);
        if (!hasSvg) throw new Error('Mascot SVG not found');

        const eyesClosedClasses = await cdp.evaluate('document.getElementById("eyes-closed").getAttribute("class")');
        const eyesOpenClasses = await cdp.evaluate('document.getElementById("eyes-open").getAttribute("class")');
        console.log(`  eyes-closed classes: "${eyesClosedClasses}", eyes-open classes: "${eyesOpenClasses}"`);
        const isNap = await cdp.evaluate('!document.getElementById("eyes-closed").classList.contains("hidden")');
        console.log(`  Eyes closed (Nap mode on home): ${isNap}`);
        if (!isNap) throw new Error('Sloth should be sleeping on home screen');

        // Test 3: Navigation Tab Switching
        console.log('\n[Check 3] Navigation to Photos, Inbox, Review, Settings');
        
        // Go to Photos
        await cdp.evaluate('LazySlothApp.switchTab("photos")');
        const photosVisible = await cdp.evaluate('!document.getElementById("view-photos").classList.contains("hidden")');
        const homeHidden1 = await cdp.evaluate('document.getElementById("view-home").classList.contains("hidden")');
        console.log(`  Switched to Photos (Photos visible: ${photosVisible}, Home hidden: ${homeHidden1})`);
        if (!photosVisible || !homeHidden1) throw new Error('Tab switch to photos failed');

        // Go to Inbox
        await cdp.evaluate('LazySlothApp.switchTab("inbox")');
        const inboxVisible = await cdp.evaluate('!document.getElementById("view-inbox").classList.contains("hidden")');
        console.log(`  Switched to Inbox (Inbox visible: ${inboxVisible})`);
        if (!inboxVisible) throw new Error('Tab switch to inbox failed');

        // Toggle SMS subtab
        await cdp.evaluate('LazySlothApp.toggleInboxSubTab("sms")');
        const smsPanelVisible = await cdp.evaluate('!document.getElementById("panel-sms").classList.contains("hidden")');
        console.log(`  Switched to SMS subtab (SMS panel visible: ${smsPanelVisible})`);
        if (!smsPanelVisible) throw new Error('Switch to SMS subtab failed');

        // Go to Review
        await cdp.evaluate('LazySlothApp.switchTab("review")');
        const reviewVisible = await cdp.evaluate('!document.getElementById("view-review").classList.contains("hidden")');
        console.log(`  Switched to Review (Review visible: ${reviewVisible})`);
        if (!reviewVisible) throw new Error('Tab switch to review failed');

        // Go to Settings
        await cdp.evaluate('LazySlothApp.switchTab("settings")');
        const settingsVisible = await cdp.evaluate('!document.getElementById("view-settings").classList.contains("hidden")');
        console.log(`  Switched to Settings (Settings visible: ${settingsVisible})`);
        if (!settingsVisible) throw new Error('Tab switch to settings failed');

        // Test 4: Reduced Motion Preference
        console.log('\n[Check 4] Reduced Motion Toggle');
        await cdp.evaluate(`(() => {
            const toggle = document.getElementById("motion-toggle");
            toggle.checked = true;
            toggle.dispatchEvent(new Event("change"));
        })()`);
        const hasReducedClass = await cdp.evaluate('document.body.classList.contains("reduced-motion")');
        console.log(`  Body has "reduced-motion" class: ${hasReducedClass}`);
        if (!hasReducedClass) throw new Error('Reduced motion toggle did not apply class to body');

        // Reset motion toggle
        await cdp.evaluate(`(() => {
            const toggle = document.getElementById("motion-toggle");
            toggle.checked = false;
            toggle.dispatchEvent(new Event("change"));
        })()`);

        // Test 5: Real Local Photo Duplicate Detection Workflow
        console.log('\n[Check 5] Real Local Photo Duplicate Detection & Hashing');
        await cdp.evaluate('LazySlothApp.switchTab("photos")');
        
        console.log('  Triggering loadSamplePhotos() (synthetic duplicate + document test)...');
        await cdp.evaluate('LazySlothApp.loadSamplePhotos()');

        // Wait for scanning to complete
        await new Promise(r => setTimeout(r, 1500));

        const photoCardsCount = await cdp.evaluate('document.querySelectorAll("#photo-grid .paper-card").length');
        console.log(`  Photo cards rendered in grid: ${photoCardsCount}`);
        if (photoCardsCount !== 4) throw new Error(`Expected 4 photo cards, got ${photoCardsCount}`);

        const exactMatchBadges = await cdp.evaluate('document.querySelectorAll("#photo-grid .bg-coral").length');
        console.log(`  Exact Match duplicate badges found: ${exactMatchBadges}`);
        if (exactMatchBadges < 1) throw new Error('Exact duplicate badge not rendered');

        const keepSafeBadges = await cdp.evaluate('document.querySelectorAll("#photo-grid .bg-emerald-600").length');
        console.log(`  Keep Safe (notes/originals) badges found: ${keepSafeBadges}`);
        if (keepSafeBadges < 2) throw new Error('Keep safe badges missing');

        // Test 6: Review Queue Synchronization & Badges
        console.log('\n[Check 6] Review Queue Synchronization');
        await cdp.evaluate('LazySlothApp.switchTab("review")');
        const reviewItemsCount = await cdp.evaluate('document.querySelectorAll("#review-items-list .paper-card").length');
        console.log(`  Selected items rendered in review list: ${reviewItemsCount}`);
        if (reviewItemsCount === 0) throw new Error('No items rendered in review list');

        // Test 7: Confirmation Guardrail Modal & Cancellation
        console.log('\n[Check 7] Confirmation Modal Safety & Cancellation');
        await cdp.evaluate('LazySlothApp.openDeleteConfirmationModal()');
        const modalOpen = await cdp.evaluate('!document.getElementById("confirm-modal").classList.contains("hidden")');
        console.log(`  Confirmation modal open: ${modalOpen}`);
        if (!modalOpen) throw new Error('Confirmation modal did not open');

        // Cancel modal
        await cdp.evaluate('LazySlothApp.closeDeleteConfirmationModal()');
        const modalClosed = await cdp.evaluate('document.getElementById("confirm-modal").classList.contains("hidden")');
        console.log(`  Confirmation modal safely dismissed with items intact: ${modalClosed}`);
        if (!modalClosed) throw new Error('Modal did not close on cancel');

        // Test 8: Final Sweep Execution
        console.log('\n[Check 8] Execute Final Sweep (In-Memory Cleanup)');
        await cdp.evaluate('LazySlothApp.openDeleteConfirmationModal()');
        await cdp.evaluate('LazySlothApp.executeFinalSweep()');
        await new Promise(r => setTimeout(r, 600));

        const celebrationSpeech = await cdp.evaluate('document.getElementById("sloth-speech").innerText');
        console.log(`  Sloth celebration speech: "${celebrationSpeech}"`);
        if (!celebrationSpeech.includes('Swept away')) throw new Error('Sloth did not announce sweep completion');

        // Test 9: Responsive Layout Verification
        console.log('\n[Check 9] Responsive Viewport Checks (360px, 440px, 1024px)');
        for (const width of [360, 440, 1024]) {
            await cdp.send('Emulation.setDeviceMetricsOverride', {
                width,
                height: 800,
                deviceScaleFactor: 1,
                mobile: width < 768
            });
            const hasHorizontalScroll = await cdp.evaluate('document.documentElement.scrollWidth > window.innerWidth');
            console.log(`  Viewport ${width}px width: horizontal overflow detected = ${hasHorizontalScroll}`);
            if (hasHorizontalScroll) throw new Error(`Horizontal scroll overflow at width ${width}px`);
        }

        // Test 10: Console Error Verification
        console.log('\n[Check 10] Checking for Uncaught Console Errors');
        const errors = cdp.consoleMessages.filter(m => m.level === 'error' || (m.type === 'error'));
        console.log(`  Logged console errors: ${errors.length}`);
        if (errors.length > 0) {
            console.error('Errors found:', errors);
            throw new Error(`Encountered ${errors.length} console errors during execution`);
        }

        console.log('\n========================================================');
        console.log('  ALL END-TO-END BROWSER AUTOMATION TESTS PASSED!       ');
        console.log('========================================================\n');

    } finally {
        if (cdp) cdp.close();
        if (browserProc) browserProc.kill();
        if (serverStartedByTest) server.close();
    }
}

runE2ETests().catch(err => {
    console.error('\nE2E Test Failure:', err);
    process.exit(1);
});
