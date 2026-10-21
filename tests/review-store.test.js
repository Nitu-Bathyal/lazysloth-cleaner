const assert = require('assert');
const { ReviewStore, formatBytes } = require('../js/review-store.js');

describe('LazySloth Review Store Tests', () => {

    it('should add items and compute correct summary', () => {
        const store = new ReviewStore();

        store.addItem({
            id: 'item_1',
            category: 'photo',
            displayName: 'Duplicate Photo 1',
            sizeBytes: 1024 * 1024 * 2,
            selected: true,
            keepSafe: false
        });

        store.addItem({
            id: 'item_2',
            category: 'email',
            displayName: 'Promo Newsletter',
            sizeBytes: 1024 * 512,
            selected: true,
            keepSafe: false
        });

        store.addItem({
            id: 'item_3',
            category: 'photo',
            displayName: 'Study Notes Calc',
            sizeBytes: 1024 * 1024 * 3,
            selected: false,
            keepSafe: true
        });

        const summary = store.getSummary();
        assert.strictEqual(summary.totalCount, 3);
        assert.strictEqual(summary.selectedCount, 2);
        assert.strictEqual(summary.keepSafeCount, 1);
        assert.strictEqual(summary.selectedBytes, 1024 * 1024 * 2 + 1024 * 512);
    });

    it('should enforce invariant: protected (keepSafe) items CANNOT be selected for cleanup', () => {
        const store = new ReviewStore();

        store.addItem({
            id: 'item_safe',
            category: 'photo',
            displayName: 'Passport Scan',
            sizeBytes: 500000,
            selected: true, // Attempt to select
            keepSafe: true  // But marked keepSafe!
        });

        const item = store.getItem('item_safe');
        assert.strictEqual(item.keepSafe, true);
        assert.strictEqual(item.selected, false, 'Protected items must remain unselected');

        // Attempting to select via toggleSelect
        store.toggleSelect('item_safe', true);
        assert.strictEqual(store.getItem('item_safe').selected, false, 'toggleSelect must not select protected item');

        // Marking an item as keepSafe should immediately unselect it
        store.addItem({
            id: 'item_toggle',
            category: 'email',
            displayName: 'Travel Ticket',
            sizeBytes: 300000,
            selected: true,
            keepSafe: false
        });
        assert.strictEqual(store.getItem('item_toggle').selected, true);

        store.toggleKeepSafe('item_toggle', true);
        assert.strictEqual(store.getItem('item_toggle').keepSafe, true);
        assert.strictEqual(store.getItem('item_toggle').selected, false, 'Marking keepSafe must deselect item');
    });

    it('should safely remove selected items and update summary', () => {
        const store = new ReviewStore();

        store.addItem({
            id: 'item_a',
            category: 'photo',
            sizeBytes: 1000,
            selected: true,
            keepSafe: false
        });

        store.addItem({
            id: 'item_b',
            category: 'photo',
            sizeBytes: 2000,
            selected: false,
            keepSafe: false
        });

        const removed = store.removeSelected();
        assert.strictEqual(removed.length, 1);
        assert.strictEqual(removed[0].id, 'item_a');

        assert.strictEqual(store.getAll().length, 1);
        assert.strictEqual(store.getItem('item_b') !== undefined, true);
        assert.strictEqual(store.getItem('item_a'), undefined);

        const summary = store.getSummary();
        assert.strictEqual(summary.totalCount, 1);
        assert.strictEqual(summary.selectedCount, 0);
    });

    it('should notify subscribers when store mutations occur', () => {
        const store = new ReviewStore();
        let notificationCount = 0;
        let lastSummary = null;

        const unsubscribe = store.subscribe((items, summary) => {
            notificationCount++;
            lastSummary = summary;
        });

        store.addItem({ id: 'note_1', category: 'photo', sizeBytes: 500, selected: false, keepSafe: true });
        assert.strictEqual(notificationCount, 1);
        assert.strictEqual(lastSummary.totalCount, 1);

        store.addItem({ id: 'note_2', category: 'email', sizeBytes: 1500, selected: true, keepSafe: false });
        assert.strictEqual(notificationCount, 2);
        assert.strictEqual(lastSummary.selectedCount, 1);

        unsubscribe();
        store.addItem({ id: 'note_3', category: 'sms', sizeBytes: 100 });
        assert.strictEqual(notificationCount, 2, 'Unsubscribed listener should not receive updates');
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
