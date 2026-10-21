/**
 * LazySloth Cleaner - Live Reviewer Audit Script
 * Runs directly against https://lazysloth-cleaner.onrender.com/ via Headless Chrome CDP.
 */

const { spawn } = require('child_process');

async function runReviewerAudit() {
    const liveUrl = 'https://lazysloth-cleaner.onrender.com/';
    const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    const cdpPort = 9444;

    console.log('========================================================');
    console.log('  LazySloth Cleaner - Live Reviewer Audit');
    console.log(`  Target: ${liveUrl}`);
    console.log('========================================================\n');

    const proc = spawn(chromePath, [
        '--headless=new',
        '--remote-debugging-port=' + cdpPort,
        '--no-sandbox',
        liveUrl
    ]);

    await new Promise(r => setTimeout(r, 2500));

    try {
        const listRes = await fetch('http://localhost:' + cdpPort + '/json/list');
        const list = await listRes.json();
        const page = list.find(t => t.type === 'page');
        if (!page) throw new Error('No page target found');

        const ws = new WebSocket(page.webSocketDebuggerUrl);
        await new Promise(r => ws.onopen = r);
        let id = 1;

        function call(method, params = {}) {
            return new Promise((resolve, reject) => {
                const reqId = id++;
                const handler = (ev) => {
                    const msg = JSON.parse(ev.data);
                    if (msg.id === reqId) {
                        ws.removeEventListener('message', handler);
                        if (msg.error) reject(new Error(msg.error.message));
                        else resolve(msg.result);
                    }
                };
                ws.addEventListener('message', handler);
                ws.send(JSON.stringify({ id: reqId, method, params }));
            });
        }

        const consoleMessages = [];
        ws.onmessage = (ev) => {
            const msg = JSON.parse(ev.data);
            if (msg.method === 'Console.messageAdded') {
                consoleMessages.push(msg.params.message);
            }
        };

        await call('Page.enable');
        await call('Runtime.enable');
        await call('Console.enable');

        async function evalExpr(expression) {
            const res = await call('Runtime.evaluate', {
                expression,
                awaitPromise: true,
                returnByValue: true
            });
            if (res.exceptionDetails) {
                throw new Error(`Eval error (${expression}): ${res.exceptionDetails.text}`);
            }
            return res.result ? res.result.value : undefined;
        }

        // Wait for page ready
        for (let i = 0; i < 40; i++) {
            const ready = await evalExpr('document.readyState === "complete" && Boolean(window.LazySlothApp)');
            if (ready) break;
            await new Promise(r => setTimeout(r, 200));
        }

        console.log('[Check 1] Page Identity & Mascot Artwork Preservation');
        const pageTitle = await evalExpr('document.title');
        const brandText = await evalExpr('document.querySelector("header h1")?.innerText');
        const hasSvg = await evalExpr('Boolean(document.getElementById("sloth-svg"))');
        const hasHoodie = await evalExpr('Boolean(document.getElementById("sloth-body"))');
        const hasWizardHat = await evalExpr('Boolean(document.getElementById("wizard-hat"))');
        const hasHeadphones = await evalExpr('Boolean(document.getElementById("headphones"))');
        const hasGoldenBroom = await evalExpr('Boolean(document.getElementById("magical-broom"))');
        const eyesClosedOnHome = await evalExpr('!document.getElementById("eyes-closed").classList.contains("hidden")');

        console.log(`  Title: "${pageTitle}"`);
        console.log(`  Brand: "${brandText}"`);
        console.log(`  SVG Present: ${hasSvg}`);
        console.log(`  Hoodie, Hat, Headphones, Broom present: ${hasHoodie && hasWizardHat && hasHeadphones && hasGoldenBroom}`);
        console.log(`  Sleeping Nap state on Home: ${eyesClosedOnHome}`);

        if (!hasSvg || !hasHoodie || !hasWizardHat || !hasHeadphones || !hasGoldenBroom) {
            throw new Error('Original sloth mascot artwork elements missing!');
        }

        console.log('\n[Check 2] Dev Challenge Story Modal');
        await evalExpr('LazySlothApp.openStoryModal()');
        const storyOpen = await evalExpr('!document.getElementById("story-modal").classList.contains("hidden")');
        const storyText = await evalExpr('document.getElementById("story-modal").innerText');
        const mentionsGemma = storyText.includes('Gemma');
        const mentionsCopilot = storyText.includes('GitHub Copilot');
        const mentionsRender = storyText.includes('Render');
        console.log(`  Story Modal Open: ${storyOpen}`);
        console.log(`  Mentions Gemma: ${mentionsGemma}`);
        console.log(`  Mentions GitHub Copilot: ${mentionsCopilot}`);
        console.log(`  Mentions Render: ${mentionsRender}`);
        await evalExpr('LazySlothApp.closeStoryModal()');
        const storyClosed = await evalExpr('document.getElementById("story-modal").classList.contains("hidden")');
        console.log(`  Story Modal Closed: ${storyClosed}`);

        if (!storyOpen || !storyClosed || !mentionsGemma || !mentionsCopilot || !mentionsRender) {
            throw new Error('Story modal audit failed');
        }

        console.log('\n[Check 3] Drag-and-Drop Photo Zone');
        await evalExpr('LazySlothApp.switchTab("photos")');
        const dropZoneExists = await evalExpr('Boolean(document.getElementById("photo-drop-zone"))');
        const dropZoneText = await evalExpr('document.getElementById("photo-drop-zone").innerText');
        console.log(`  Drop Zone Exists: ${dropZoneExists}`);
        console.log(`  Drop Zone Mentions Drag & Drop: ${dropZoneText.includes('Drag & drop')}`);
        if (!dropZoneExists) throw new Error('Photo drop zone missing');

        console.log('\n[Check 4] Exact SHA-256 Duplicate Detection (2 Identical + 2 Different Files)');
        const duplicateTestResult = await evalExpr(`(async () => {
            const fIdentical1 = new File(["IDENTICAL_PAYLOAD_ABC_123"], "photo_beach_01.jpg", { type: "image/jpeg" });
            const fIdentical2 = new File(["IDENTICAL_PAYLOAD_ABC_123"], "photo_beach_copy.jpg", { type: "image/jpeg" });
            const fUnique1 = new File(["UNIQUE_PAYLOAD_XYZ_789"], "photo_mountain.jpg", { type: "image/jpeg" });
            const fUnique2 = new File(["ANOTHER_UNIQUE_PAYLOAD_456"], "photo_coffee.jpg", { type: "image/jpeg" });

            await LazySlothApp.processLocalPhotoFiles([fIdentical1, fIdentical2, fUnique1, fUnique2]);

            const allPhotos = LazySlothApp.getGemmaService() ? window.LazySlothApp : null;
            const items = Array.from(document.querySelectorAll("#photo-grid .paper-card")).map(card => {
                return {
                    name: card.querySelector("h4")?.innerText,
                    badge: card.querySelector("span")?.innerText,
                    isChecked: card.querySelector("input[type=checkbox]")?.checked,
                    isDisabled: card.querySelector("input[type=checkbox]")?.disabled,
                    hasExactMatch: card.innerText.includes("Exact Match"),
                    hasKeepSafe: card.innerText.includes("Keep Safe"),
                    hasUnique: card.innerText.includes("Unique")
                };
            });
            return items;
        })()`);

        console.log('  Scanned 4 files (2 identical, 2 different):');
        duplicateTestResult.forEach(item => {
            console.log(`    - ${item.name}: ExactMatch=${item.hasExactMatch}, KeepSafe=${item.hasKeepSafe}, CheckedForSweep=${item.isChecked}`);
        });

        const exactDups = duplicateTestResult.filter(i => i.hasExactMatch && i.isChecked);
        console.log(`  Exact Duplicates Flagged & Checked: ${exactDups.length} (Expected: 1)`);
        if (exactDups.length !== 1) {
            throw new Error(`Expected exactly 1 duplicate to be marked for sweep, got ${exactDups.length}`);
        }

        console.log('\n[Check 5] Keep Safe Protection for Study Notes and Receipts');
        // Wait for prior scan debounce (800ms timeout in app.js)
        await new Promise(r => setTimeout(r, 1200));

        const keepSafeTestResult = await evalExpr(`(async () => {
            const fNote = new File(["STUDY_NOTES_MATH_CALCULUS"], "calculus_lecture_notes_week4.jpg", { type: "image/jpeg" });
            const fReceipt = new File(["STORE_RECEIPT_EXPENSES"], "october_grocery_receipt.png", { type: "image/png" });

            await LazySlothApp.processLocalPhotoFiles([fNote, fReceipt]);

            // Give DOM a tick to render
            await new Promise(r => setTimeout(r, 500));

            const cards = Array.from(document.querySelectorAll("#photo-grid .paper-card"));
            const noteCard = cards.find(c => c.innerText.includes("calculus_lecture_notes"));
            const receiptCard = cards.find(c => c.innerText.includes("october_grocery_receipt"));

            return {
                note: {
                    found: Boolean(noteCard),
                    hasKeepSafeBadge: Boolean(noteCard && noteCard.innerText.includes("Keep Safe")),
                    isProtectedLocked: Boolean(noteCard && noteCard.innerText.includes("Protected")),
                    isChecked: Boolean(noteCard && noteCard.querySelector("input[type=checkbox]")?.checked),
                    isDisabled: Boolean(noteCard && noteCard.querySelector("input[type=checkbox]")?.disabled)
                },
                receipt: {
                    found: Boolean(receiptCard),
                    hasKeepSafeBadge: Boolean(receiptCard && receiptCard.innerText.includes("Keep Safe")),
                    isProtectedLocked: Boolean(receiptCard && receiptCard.innerText.includes("Protected")),
                    isChecked: Boolean(receiptCard && receiptCard.querySelector("input[type=checkbox]")?.checked),
                    isDisabled: Boolean(receiptCard && receiptCard.querySelector("input[type=checkbox]")?.disabled)
                }
            };
        })()`);

        console.log('  Study Note Protection:');
        console.log(`    - Keep Safe Badge: ${keepSafeTestResult.note.hasKeepSafeBadge}`);
        console.log(`    - Protected (Lock): ${keepSafeTestResult.note.isProtectedLocked}`);
        console.log(`    - Checkbox Unchecked: ${!keepSafeTestResult.note.isChecked}`);
        console.log(`    - Checkbox Disabled: ${keepSafeTestResult.note.isDisabled}`);

        console.log('  Receipt Protection:');
        console.log(`    - Keep Safe Badge: ${keepSafeTestResult.receipt.hasKeepSafeBadge}`);
        console.log(`    - Protected (Lock): ${keepSafeTestResult.receipt.isProtectedLocked}`);
        console.log(`    - Checkbox Unchecked: ${!keepSafeTestResult.receipt.isChecked}`);
        console.log(`    - Checkbox Disabled: ${keepSafeTestResult.receipt.isDisabled}`);

        if (!keepSafeTestResult.note.hasKeepSafeBadge || keepSafeTestResult.note.isChecked || !keepSafeTestResult.note.isDisabled ||
            !keepSafeTestResult.receipt.hasKeepSafeBadge || keepSafeTestResult.receipt.isChecked || !keepSafeTestResult.receipt.isDisabled) {
            throw new Error('Study notes or receipts were incorrectly allowed for cleanup!');
        }

        console.log('\n[Check 6] Honest Gemma Status (Offline / UNAVAILABLE & Provenance)');
        const pillText = await evalExpr('document.getElementById("ai-status-label").innerText');
        console.log(`  Header Status Badge: "${pillText}"`);
        if (!pillText.includes('Offline')) {
            throw new Error(`Expected header pill to say Offline, got "${pillText}"`);
        }

        const gemmaState = await evalExpr('LazySlothApp.getGemmaService().getStatus()');
        console.log(`  Gemma Service Status: "${gemmaState.status}" (isUnavailable: ${gemmaState.isUnavailable}, isReady: ${gemmaState.isReady})`);
        if (gemmaState.isReady || !gemmaState.isUnavailable) {
            throw new Error('Gemma service is falsely claiming to be ready!');
        }

        const provenanceBadges = await evalExpr(`(() => {
            const ruleBadges = document.querySelectorAll("#photo-grid .fa-code-branch").length;
            const fakeAIBadges = Array.from(document.querySelectorAll("#photo-grid *")).filter(el => el.innerText && el.innerText.startsWith("Gemma:")).length;
            return { ruleBadges, fakeAIBadges };
        })()`);
        console.log(`  Rule Provenance Badges: ${provenanceBadges.ruleBadges}`);
        console.log(`  Fake AI Model Badges: ${provenanceBadges.fakeAIBadges}`);
        if (provenanceBadges.fakeAIBadges > 0) {
            throw new Error('Detected fake Gemma AI badge on unverified heuristic classification!');
        }

        console.log('\n[Check 7] Review Queue & Confirmation Guardrail Flow');
        await evalExpr('LazySlothApp.switchTab("review")');
        const reviewItemsCountBefore = await evalExpr('document.querySelectorAll("#review-items-list .paper-card").length');
        console.log(`  Review Queue Items Count Before Sweep: ${reviewItemsCountBefore}`);
        if (reviewItemsCountBefore === 0) throw new Error('Review queue is unexpectedly empty');

        // Verify protected items are NOT in the review queue
        const reviewContainsNotes = await evalExpr('document.getElementById("review-items-list").innerText.includes("calculus_lecture_notes")');
        const reviewContainsReceipt = await evalExpr('document.getElementById("review-items-list").innerText.includes("october_grocery_receipt")');
        console.log(`  Protected Notes in Review Sweep: ${reviewContainsNotes} (Expected: false)`);
        console.log(`  Protected Receipts in Review Sweep: ${reviewContainsReceipt} (Expected: false)`);
        if (reviewContainsNotes || reviewContainsReceipt) {
            throw new Error('Protected items leaked into active review cleanup queue!');
        }

        // Test cancel confirmation modal
        console.log('  Testing Confirmation Modal Cancellation...');
        await evalExpr('LazySlothApp.openDeleteConfirmationModal()');
        const confirmModalOpen = await evalExpr('!document.getElementById("confirm-modal").classList.contains("hidden")');
        console.log(`  Confirmation Modal Opened: ${confirmModalOpen}`);
        await evalExpr('LazySlothApp.closeDeleteConfirmationModal()');
        const confirmModalClosed = await evalExpr('document.getElementById("confirm-modal").classList.contains("hidden")');
        console.log(`  Confirmation Modal Cancelled/Closed: ${confirmModalClosed}`);

        const reviewItemsCountAfterCancel = await evalExpr('document.querySelectorAll("#review-items-list .paper-card").length');
        console.log(`  Review Queue Items Count After Cancel: ${reviewItemsCountAfterCancel}`);
        if (reviewItemsCountBefore !== reviewItemsCountAfterCancel) {
            throw new Error('Canceling confirmation modal altered review items!');
        }

        // Test sweep execution
        console.log('  Testing Final Sweep Execution...');
        await evalExpr('LazySlothApp.executeFinalSweep()');
        await new Promise(r => setTimeout(r, 600));

        const reviewEmptyState = await evalExpr('!document.getElementById("review-empty-state").classList.contains("hidden")');
        const celebrationSpeech = await evalExpr('document.getElementById("sloth-speech").innerText');
        console.log(`  Review Queue Empty State Displayed: ${reviewEmptyState}`);
        console.log(`  Sloth Speech: "${celebrationSpeech}"`);
        console.log(`  Speech clarifies original device files kept safe: ${celebrationSpeech.includes("Original device files were kept safe")}`);

        if (!reviewEmptyState || !celebrationSpeech.includes("Original device files were kept safe")) {
            throw new Error('Sweep finalization did not clearly communicate in-memory clearance vs OS file safety');
        }

        console.log('\n[Check 8] Console Errors on Live Site');
        const errors = consoleMessages.filter(m => m.level === 'error');
        console.log(`  Console Errors Logged: ${errors.length}`);
        if (errors.length > 0) {
            console.error('Errors:', errors);
            throw new Error(`Encountered ${errors.length} console errors on live site`);
        }

        console.log('\n========================================================');
        console.log('  LIVE REVIEWER AUDIT PASSED 100% ON RENDER WEBSITE!');
        console.log('========================================================\n');

    } finally {
        proc.kill();
    }
}

runReviewerAudit().catch(err => {
    console.error('\n❌ AUDIT FAILED:', err);
    process.exit(1);
});
