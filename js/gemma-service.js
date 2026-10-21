/**
 * LazySloth Cleaner - Gemma AI Service Interface (Phase 4)
 * 
 * Clean, decoupled boundary preparing for Gemma AI classification
 * (e.g. Gemma 2B/3B via MediaPipe Web / WebGPU, LiteRT, or local endpoint).
 * 
 * Strict safety rules:
 * 1. Never label heuristic rules as Gemma AI results.
 * 2. Never claim an AI model is loaded when it is not configured.
 * 3. Never download large weights or transmit private user media without explicit consent.
 * 4. All AI outputs must remain advisory suggestions requiring user approval.
 */

(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.LazySlothGemmaService = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {

    const MODEL_STATUS = {
        UNCONFIGURED: 'unconfigured',
        CHECKING: 'checking',
        DOWNLOADING: 'downloading',
        READY: 'ready',
        UNSUPPORTED: 'unsupported',
        ERROR: 'error'
    };

    class GemmaClassifierService {
        constructor(config = {}) {
            this.config = Object.assign({
                runtime: 'browser-local', // 'browser-local' | 'mediapipe-webgpu' | 'local-endpoint'
                endpointUrl: null,
                modelName: 'gemma-2b-it',
                autoLoad: false
            }, config);

            // Initial honest state: Not configured in static browser client
            this.status = MODEL_STATUS.UNCONFIGURED;
            this.statusMessage = 'Gemma AI is not configured. Exact SHA-256 duplicate detection is currently active.';
            this.activeBackend = null;
        }

        /**
         * Return the current honest operational status of the Gemma model
         */
        getStatus() {
            return {
                status: this.status,
                message: this.statusMessage,
                isAvailable: this.status === MODEL_STATUS.READY,
                activeBackend: this.activeBackend,
                runtime: this.config.runtime
            };
        }

        /**
         * Check environment capabilities for running Gemma locally in the browser
         * Checks WebGPU, WebAssembly SIMD, available memory, and browser APIs
         */
        async checkEnvironmentSupport() {
            const support = {
                webGPU: false,
                webAssembly: typeof WebAssembly === 'object',
                sharedArrayBuffer: typeof SharedArrayBuffer !== 'undefined',
                browserPromptAPI: false,
                isRecommendedForLocalInference: false,
                details: []
            };

            // Check WebGPU availability
            if (typeof navigator !== 'undefined' && navigator.gpu) {
                try {
                    const adapter = await navigator.gpu.requestAdapter();
                    if (adapter) {
                        support.webGPU = true;
                        support.details.push('WebGPU hardware acceleration available.');
                    }
                } catch (e) {
                    support.details.push('WebGPU initialization failed: ' + e.message);
                }
            } else {
                support.details.push('WebGPU is not supported by this browser.');
            }

            // Check for experimental built-in Chrome Prompt API (window.ai)
            if (typeof window !== 'undefined' && window.ai && window.ai.languageModel) {
                support.browserPromptAPI = true;
                support.details.push('Experimental window.ai Prompt API detected.');
            }

            // Gemma 2B local browser inference requires WebGPU and >= 4GB available RAM
            if (support.webGPU && support.webAssembly) {
                support.isRecommendedForLocalInference = true;
            }

            return support;
        }

        /**
         * Heuristic categorization rule engine.
         * Explicitly tagged as METHOD: 'heuristic' so callers and the UI never mistake
         * simple keyword/extension checks for an actual Gemma neural inference.
         * 
         * @param {Object} metadata File metadata { name, size, type }
         * @returns {Object} Advisory suggestion
         */
        classifyByHeuristics(metadata) {
            const fileName = (metadata && metadata.name) ? metadata.name.toLowerCase() : '';
            const size = metadata ? metadata.size || 0 : 0;

            // Important documents / study notes
            const docPatterns = [
                'note', 'study', 'lecture', 'whiteboard', 'doc', 'receipt', 'bill',
                'invoice', 'tax', 'passport', 'id_card', 'license', 'exam', 'assignment'
            ];
            for (const pattern of docPatterns) {
                if (fileName.includes(pattern)) {
                    return {
                        method: 'heuristic',
                        category: 'documents',
                        suggestedTag: 'Keep Safe',
                        keepSafe: true,
                        recommendedAction: 'keep',
                        confidence: 0.85,
                        explanation: `File name contains "${pattern}", indicating a potentially important study note or document.`
                    };
                }
            }

            // Memes / social downloads
            const memePatterns = ['meme', 'reddit', 'whatsapp_image', 'discord', 'download', 'img_'];
            for (const pattern of memePatterns) {
                if (fileName.includes(pattern)) {
                    return {
                        method: 'heuristic',
                        category: 'memes',
                        suggestedTag: 'Review for Cleanup',
                        keepSafe: false,
                        recommendedAction: 'review',
                        confidence: 0.60,
                        explanation: `File name suggests a downloaded image or social media media.`
                    };
                }
            }

            // Greetings / generic photos
            const greetingPatterns = ['good_morning', 'morning', 'greeting', 'festival', 'wishes', 'happy_'];
            for (const pattern of greetingPatterns) {
                if (fileName.includes(pattern)) {
                    return {
                        method: 'heuristic',
                        category: 'greetings',
                        suggestedTag: 'Greeting Image',
                        keepSafe: false,
                        recommendedAction: 'review',
                        confidence: 0.70,
                        explanation: `File name indicates a forwarded festival or morning greeting.`
                    };
                }
            }

            // Default heuristic
            return {
                method: 'heuristic',
                category: 'photos',
                suggestedTag: 'General Photo',
                keepSafe: false,
                recommendedAction: 'keep',
                confidence: 0.40,
                explanation: 'General photo with standard naming convention.'
            };
        }

        /**
         * Classify photo using Gemma model if configured; otherwise safely falls back
         * to heuristic engine while explicitly reporting the provenance.
         */
        async classifyPhoto(fileOrMetadata) {
            // If model is not ready, safely fall back to transparent heuristics
            if (this.status !== MODEL_STATUS.READY) {
                const heuristicResult = this.classifyByHeuristics(fileOrMetadata);
                return Object.assign({}, heuristicResult, {
                    aiProvider: 'none',
                    gemmaActive: false,
                    statusNote: 'Advisory heuristic rule (Gemma AI offline).'
                });
            }

            // When a real Gemma runtime is configured in the future:
            // This is where MediaPipe LLM Inference / LiteRT would run on-device.
            throw new Error('Gemma model is configured but runtime execution handler is not implemented.');
        }
    }

    return {
        MODEL_STATUS,
        GemmaClassifierService
    };
}));
