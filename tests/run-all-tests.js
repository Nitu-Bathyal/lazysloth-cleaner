/**
 * LazySloth Cleaner - Unified Test Runner
 * Runs unit tests and full headless browser E2E tests.
 */

const crypto = require('crypto');
if (!global.crypto || !global.crypto.subtle) {
    global.crypto = crypto.webcrypto;
}

const { spawn } = require('child_process');
const path = require('path');

const unitSuites = [
    { name: 'Duplicate Detector Unit Suite', file: './duplicate-detector.test.js' },
    { name: 'Review Store Unit Suite', file: './review-store.test.js' },
    { name: 'Gemma AI Service Unit Suite', file: './gemma-service.test.js' }
];

async function run() {
    console.log('========================================================');
    console.log('  LazySloth Cleaner - Complete Test Runner');
    console.log('========================================================\n');

    // Phase 1: Unit Suites
    for (const suite of unitSuites) {
        console.log(`Running ${suite.name}...`);
        try {
            require(suite.file);
            await new Promise(r => setTimeout(r, 200));
            console.log(`✓ ${suite.name} finished.\n`);
        } catch (err) {
            console.error(`✗ ${suite.name} failed:`, err);
            process.exit(1);
        }
    }

    // Phase 2: Browser E2E Test Suite
    console.log('Launching Headless Browser E2E Suite...');
    const e2eProcess = spawn('node', [path.join(__dirname, 'browser-e2e.test.js')], {
        stdio: 'inherit'
    });

    e2eProcess.on('exit', (code) => {
        if (code === 0) {
            console.log('\n========================================================');
            console.log('  ALL TESTS (UNIT & BROWSER E2E) COMPLETED SUCCESSFULLY!  ');
            console.log('========================================================\n');
            process.exit(0);
        } else {
            console.error('\nE2E browser tests failed with exit code', code);
            process.exit(code || 1);
        }
    });
}

run();
