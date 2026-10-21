const assert = require('assert');
const { MODEL_STATUS, GEMMA_MODELS, GemmaClassifierService } = require('../js/gemma-service.js');

describe('LazySloth Gemma AI Service Tests (Phase 2)', () => {

    it('should initialize with honest UNAVAILABLE status', () => {
        const service = new GemmaClassifierService();
        const status = service.getStatus();

        assert.strictEqual(status.status, MODEL_STATUS.UNAVAILABLE);
        assert.strictEqual(status.isReady, false);
        assert.strictEqual(status.isLoading, false);
        assert.strictEqual(status.isUnavailable, true);
        assert.strictEqual(typeof status.message, 'string');
        assert.strictEqual(status.message.includes('unconfigured'), true);
    });

    it('should distinguish text-only Gemma models from vision-capable PaliGemma', () => {
        assert.strictEqual(GEMMA_MODELS['paligemma-3b-pt-224'].supportsImages, true);
        assert.strictEqual(GEMMA_MODELS['gemma-2b-it'].supportsImages, false);
        assert.strictEqual(GEMMA_MODELS['gemma-2-2b-it'].supportsImages, false);
    });

    it('should refuse to initialize on-device download without explicit user consent', async () => {
        const service = new GemmaClassifierService();

        await assert.rejects(
            async () => {
                await service.initOnDeviceWebGPU({ userConsent: false });
            },
            /explicit user consent/i
        );

        assert.strictEqual(service.getStatus().isUnavailable, true);
    });

    it('should refuse to run image classification using text-only Gemma models', async () => {
        const service = new GemmaClassifierService();

        await assert.rejects(
            async () => {
                await service.initOnDeviceWebGPU({
                    userConsent: true,
                    modelId: 'gemma-2b-it'
                });
            },
            /text-only and does not support image input/i
        );

        assert.strictEqual(service.getStatus().isError, true);
    });

    it('should strictly tag heuristic results as heuristic and NEVER as Gemma AI', async () => {
        const service = new GemmaClassifierService();
        // Model is unconfigured
        assert.strictEqual(service.getStatus().isReady, false);

        const result = await service.classifyPhoto({ name: 'calc_notes_lecture.jpg' });

        assert.strictEqual(result.method, 'heuristic');
        assert.strictEqual(result.gemmaActive, false);
        assert.strictEqual(result.modelIdentity, 'heuristic-rule-engine');
        assert.strictEqual(result.keepSafe, true);
        assert.strictEqual(result.category, 'documents');
    });

    it('should record genuine model prediction when runtime is configured and READY', async () => {
        const service = new GemmaClassifierService();

        // Inject real/mocked vision model inference provider
        service.inferenceProvider = async (file) => {
            return {
                category: 'memes',
                confidence: 0.94,
                keepSafe: false,
                explanation: 'PaliGemma SigLIP vision encoder identified internet meme text overlay.'
            };
        };

        // Initialize with consent and vision model
        await service.initOnDeviceWebGPU({
            userConsent: true,
            modelId: 'paligemma-3b-pt-224'
        });

        assert.strictEqual(service.getStatus().isReady, true);

        const result = await service.classifyPhoto({ name: 'funny_download_01.jpg' });

        assert.strictEqual(result.method, 'gemma-vision-model');
        assert.strictEqual(result.gemmaActive, true);
        assert.strictEqual(result.modelIdentity, 'PaliGemma 3B');
        assert.strictEqual(result.confidence, 0.94);
        assert.strictEqual(result.category, 'memes');
        assert.strictEqual(result.keepSafe, false);
        assert.strictEqual(result.isUncertain, false);
    });

    it('should enforce safety invariant: document/study notes are ALWAYS Keep Safe even if model says cleanup', async () => {
        const service = new GemmaClassifierService();

        service.inferenceProvider = async () => ({
            category: 'general-photo',
            confidence: 0.98,
            keepSafe: false // Model proposes cleanup
        });

        await service.initOnDeviceWebGPU({ userConsent: true, modelId: 'paligemma-3b-pt-224' });

        // Input is a study note
        const result = await service.classifyPhoto({ name: 'algebra_study_notes_whiteboard.jpg' });

        assert.strictEqual(result.keepSafe, true, 'Document keywords must override model cleanup suggestion');
        assert.strictEqual(result.recommendedAction, 'keep');
    });

    it('should enforce uncertainty safety: confidence < 0.70 forces Keep Safe', async () => {
        const service = new GemmaClassifierService();

        service.inferenceProvider = async () => ({
            category: 'clutter',
            confidence: 0.52, // Low confidence
            keepSafe: false
        });

        await service.initOnDeviceWebGPU({ userConsent: true, modelId: 'paligemma-3b-pt-224' });

        const result = await service.classifyPhoto({ name: 'blurry_unclear_photo.jpg' });

        assert.strictEqual(result.isUncertain, true);
        assert.strictEqual(result.keepSafe, true, 'Low confidence prediction must default to Keep Safe');
        assert.strictEqual(result.recommendedAction, 'keep');
    });

    it('should fall back to heuristics gracefully if active model throws an error', async () => {
        const service = new GemmaClassifierService();

        service.inferenceProvider = async () => {
            throw new Error('Out of WebGPU memory allocating KV cache');
        };

        await service.initOnDeviceWebGPU({ userConsent: true, modelId: 'paligemma-3b-pt-224' });

        const result = await service.classifyPhoto({ name: 'random_photo.jpg' });

        // Safe fallback to heuristic
        assert.strictEqual(result.method, 'heuristic');
        assert.strictEqual(result.gemmaActive, false);
    });

    it('should handle offline local companion endpoint with clear actionable message', async () => {
        const service = new GemmaClassifierService();
        // Target an unused port
        const res = await service.connectLocalEndpoint('http://localhost:59999');
        assert.strictEqual(res.success, false);
        assert.strictEqual(typeof res.error, 'string');
        assert.strictEqual(service.getStatus().isUnavailable, true);
    });

    it('should handle unconfigured companion model state gracefully', async () => {
        const service = new GemmaClassifierService();
        
        // Mock a 503 response from companion server
        const originalFetch = global.fetch;
        global.fetch = async (url) => {
            if (url.includes('/health')) {
                return {
                    ok: false,
                    status: 503,
                    json: async () => ({
                        status: 'unconfigured',
                        blocker: 'PaliGemma weights not loaded'
                    })
                };
            }
            return originalFetch(url);
        };

        try {
            const res = await service.connectLocalEndpoint('http://localhost:5001');
            assert.strictEqual(res.success, false);
            assert.strictEqual(res.unconfigured, true);
            assert.strictEqual(res.error, 'PaliGemma weights not loaded');
            assert.strictEqual(service.getStatus().isUnavailable, true);
        } finally {
            global.fetch = originalFetch;
        }
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
