const assert = require('assert');
const crypto = require('crypto');

// Polyfill Web Crypto API if needed in Node
if (!global.crypto || !global.crypto.subtle) {
    global.crypto = crypto.webcrypto;
}

const DuplicateDetector = require('../js/duplicate-detector.js');

describe('LazySloth Duplicate Detector Tests', () => {

    it('should correctly format byte sizes', () => {
        assert.strictEqual(DuplicateDetector.formatBytes(0), '0 B');
        assert.strictEqual(DuplicateDetector.formatBytes(512), '512 B');
        assert.strictEqual(DuplicateDetector.formatBytes(1024), '1.0 KB');
        assert.strictEqual(DuplicateDetector.formatBytes(1024 * 1024 * 2.5), '2.5 MB');
        assert.strictEqual(DuplicateDetector.formatBytes(1024 * 1024 * 1024 * 1.5), '1.5 GB');
    });

    it('should identify filenames requiring "Keep Safe" protection', () => {
        assert.strictEqual(DuplicateDetector.shouldKeepSafe('study_notes_lecture.jpg'), true);
        assert.strictEqual(DuplicateDetector.shouldKeepSafe('math_whiteboard_oct21.png'), true);
        assert.strictEqual(DuplicateDetector.shouldKeepSafe('electricity_bill_receipt.pdf'), true);
        assert.strictEqual(DuplicateDetector.shouldKeepSafe('passport_scan.jpg'), true);
        assert.strictEqual(DuplicateDetector.shouldKeepSafe('random_vacation_sunset.jpg'), false);
        assert.strictEqual(DuplicateDetector.shouldKeepSafe('meme_cat_funny.jpg'), false);
    });

    it('should compute identical SHA-256 hashes for identical byte streams', async () => {
        const contentA = Buffer.from('IDENTICAL_IMAGE_BYTES_12345');
        const contentB = Buffer.from('IDENTICAL_IMAGE_BYTES_12345');

        const blobA = new Blob([contentA]);
        const blobB = new Blob([contentB]);

        const hashA = await DuplicateDetector.hashFile(blobA);
        const hashB = await DuplicateDetector.hashFile(blobB);

        assert.strictEqual(typeof hashA, 'string');
        assert.strictEqual(hashA.length, 64); // SHA-256 hex length
        assert.strictEqual(hashA, hashB);
    });

    it('should compute different SHA-256 hashes for different byte streams', async () => {
        const contentA = Buffer.from('IMAGE_ONE_DATA');
        const contentB = Buffer.from('IMAGE_TWO_DATA');

        const blobA = new Blob([contentA]);
        const blobB = new Blob([contentB]);

        const hashA = await DuplicateDetector.hashFile(blobA);
        const hashB = await DuplicateDetector.hashFile(blobB);

        assert.notStrictEqual(hashA, hashB);
    });

    it('should group duplicates with original and mark duplicates for cleanup', async () => {
        const stream1 = Buffer.from('IMAGE_STREAM_ALPHA');
        const stream2 = Buffer.from('IMAGE_STREAM_ALPHA'); // Duplicate of 1
        const stream3 = Buffer.from('IMAGE_STREAM_BETA');  // Unique
        const stream4 = Buffer.from('STUDY_NOTES_STREAM'); // Document

        const file1 = { name: 'photo1.jpg', size: stream1.length, arrayBuffer: async () => (new Blob([stream1])).arrayBuffer() };
        const file2 = { name: 'photo2_copy.jpg', size: stream2.length, arrayBuffer: async () => (new Blob([stream2])).arrayBuffer() };
        const file3 = { name: 'photo3_unique.jpg', size: stream3.length, arrayBuffer: async () => (new Blob([stream3])).arrayBuffer() };
        const file4 = { name: 'study_notes.jpg', size: stream4.length, arrayBuffer: async () => (new Blob([stream4])).arrayBuffer() };

        const progressHistory = [];
        const result = await DuplicateDetector.scanFiles([file1, file2, file3, file4], (p) => {
            progressHistory.push(p);
        });

        assert.strictEqual(result.items.length, 4);
        assert.strictEqual(result.stats.totalFiles, 4);
        assert.strictEqual(result.stats.duplicateCount, 1);
        assert.strictEqual(result.duplicateGroups.length, 1);

        // Check file 1: Original -> keepSafe: true, selected: false
        const item1 = result.items[0];
        assert.strictEqual(item1.isDuplicate, false);
        assert.strictEqual(item1.keepSafe, true);
        assert.strictEqual(item1.selected, false);

        // Check file 2: Duplicate of photo1.jpg -> isDuplicate: true, keepSafe: false, selected: true
        const item2 = result.items[1];
        assert.strictEqual(item2.isDuplicate, true);
        assert.strictEqual(item2.originalName, 'photo1.jpg');
        assert.strictEqual(item2.keepSafe, false);
        assert.strictEqual(item2.selected, true);

        // Check file 3: Unique -> isDuplicate: false, keepSafe: true, selected: false
        const item3 = result.items[2];
        assert.strictEqual(item3.isDuplicate, false);
        assert.strictEqual(item3.selected, false);

        // Check file 4: Document -> keepSafe: true, selected: false
        const item4 = result.items[3];
        assert.strictEqual(item4.keepSafe, true);
        assert.strictEqual(item4.selected, false);

        // Check progress reporting
        assert.strictEqual(progressHistory.length, 4);
        assert.strictEqual(progressHistory[3].percent, 100);
    });

});

function describe(name, fn) {
    console.log(`\n--- ${name} ---`);
    fn();
}

function it(name, fn) {
    const res = fn();
    if (res && typeof res.then === 'function') {
        return res.then(() => {
            console.log(`  ✓ ${name}`);
        }).catch(err => {
            console.error(`  ✗ ${name}`);
            console.error(err);
            process.exitCode = 1;
        });
    } else {
        console.log(`  ✓ ${name}`);
    }
}
