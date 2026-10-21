const assert = require('assert');
const { MODEL_STATUS, GemmaClassifierService } = require('../js/gemma-service.js');

describe('LazySloth Gemma AI Service Tests', () => {

    it('should report honest unconfigured status initially', () => {
        const service = new GemmaClassifierService();
        const status = service.getStatus();

        assert.strictEqual(status.status, MODEL_STATUS.UNCONFIGURED);
        assert.strictEqual(status.isAvailable, false);
        assert.strictEqual(typeof status.message, 'string');
        assert.strictEqual(status.message.includes('not configured'), true);
    });

    it('should classify study notes as keepSafe using explicit heuristic method tag', async () => {
        const service = new GemmaClassifierService();

        const result = await service.classifyPhoto({ name: 'calculus_lecture_notes.jpg', size: 102400 });

        assert.strictEqual(result.method, 'heuristic');
        assert.strictEqual(result.gemmaActive, false);
        assert.strictEqual(result.keepSafe, true);
        assert.strictEqual(result.category, 'documents');
        assert.strictEqual(result.suggestedTag, 'Keep Safe');
        assert.strictEqual(result.recommendedAction, 'keep');
    });

    it('should tag memes as review candidates without claiming Gemma AI execution', async () => {
        const service = new GemmaClassifierService();

        const result = await service.classifyPhoto({ name: 'discord_funny_meme.png', size: 50000 });

        assert.strictEqual(result.method, 'heuristic');
        assert.strictEqual(result.gemmaActive, false);
        assert.strictEqual(result.category, 'memes');
        assert.strictEqual(result.keepSafe, false);
    });

    it('should check environment capabilities safely', async () => {
        const service = new GemmaClassifierService();
        const support = await service.checkEnvironmentSupport();

        assert.strictEqual(typeof support.webAssembly, 'boolean');
        assert.strictEqual(Array.isArray(support.details), true);
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
