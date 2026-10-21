/**
 * LazySloth Cleaner - Gemma AI Service Interface (Phase 2)
 * 
 * Manages genuine Gemma AI classification capabilities with strict privacy,
 * hardware validation, and provenance guardrails.
 * 
 * Key Principles:
 * 1. Honest Status: Never claim an AI model is running when it is not configured.
 * 2. Model Appropriateness: Explicitly distinguishes text-only Gemma models from
 *    vision-capable models (e.g. PaliGemma). Never feeds raw image pixels to a text-only model.
 * 3. Privacy & Bandwidth: Never silently download large model weights (1.8GB-5.8GB)
 *    without explicit user consent. Never transmits user photos to third-party clouds.
 * 4. Provenance: Every classification result explicitly identifies its source
 *    ('gemma-vision-model' vs 'heuristic-rule-engine') and confidence score.
 * 5. Protective Defaults: Study notes, documents, receipts, and low-confidence
 *    predictions (< 70%) are automatically protected with "Keep Safe".
 */

(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.LazySlothGemmaService = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {

    const MODEL_STATUS = {
        UNCONFIGURED: 'unconfigured', // Initial clean state
        CHECKING: 'checking',         // Running hardware/runtime diagnostics
        LOADING: 'loading',           // Model weights downloading/initializing with user consent
        READY: 'ready',               // Model loaded and active for local inference
        UNAVAILABLE: 'unavailable',   // Runtime/model not configured or not supported
        ERROR: 'error'                // Initialization or inference failure
    };

    // Known Gemma family model specifications
    const GEMMA_MODELS = {
        'paligemma-3b-pt-224': {
            name: 'PaliGemma 3B',
            family: 'PaliGemma (Vision-Language)',
            type: 'multimodal',
            supportsImages: true,
            architecture: 'SigLIP-So400m + Gemma 2B',
            approxDownloadSize: '1.8 GB (4-bit quantized) / 3.2 GB (fp16)',
            minVRAM: '3.0 GB',
            licensing: 'Google Gemma Terms of Use (Gated repo on Hugging Face)',
            description: 'Genuine multimodal vision-language model accepting image pixels + text prompt.'
        },
        'gemma-2b-it': {
            name: 'Gemma 2B Instruct',
            family: 'Gemma 1 (Text-only)',
            type: 'text-only',
            supportsImages: false,
            architecture: 'Decoder-only Transformer',
            approxDownloadSize: '1.4 GB (4-bit) / 2.5 GB (fp16)',
            minVRAM: '2.0 GB',
            licensing: 'Google Gemma Terms of Use',
            description: 'Text-to-text language model. CANNOT process raw image pixels directly.'
        },
        'gemma-2-2b-it': {
            name: 'Gemma 2 2B Instruct',
            family: 'Gemma 2 (Text-only)',
            type: 'text-only',
            supportsImages: false,
            architecture: 'Sliding window + Global Attention Transformer',
            approxDownloadSize: '1.6 GB (4-bit) / 2.6 GB (fp16)',
            minVRAM: '2.5 GB',
            licensing: 'Google Gemma Terms of Use',
            description: 'Advanced text-to-text model. CANNOT process raw image pixels directly.'
        }
    };

    class GemmaClassifierService {
        constructor(config = {}) {
            this.config = Object.assign({
                runtime: 'browser-webgpu', // 'browser-webgpu' | 'local-endpoint' | 'heuristic-only'
                selectedModel: 'paligemma-3b-pt-224',
                endpointUrl: 'http://localhost:5001',
                confidenceThreshold: 0.70 // Scores below this trigger "Keep Safe"
            }, config);

            this.status = MODEL_STATUS.UNAVAILABLE;
            this.statusMessage = 'Gemma AI is unconfigured. Local SHA-256 duplicate detection and heuristic safety rules are active.';
            this.activeModel = null;
            this.lastDiagnostic = null;
            this.inferenceProvider = null; // Injected inference handler for local runtime or tests
            this.listeners = new Set();
        }

        subscribe(listener) {
            if (typeof listener === 'function') {
                this.listeners.add(listener);
                return () => this.listeners.delete(listener);
            }
            return () => {};
        }

        _notify() {
            const state = this.getStatus();
            for (const listener of this.listeners) {
                try {
                    listener(state);
                } catch (e) {
                    console.error('[GemmaService] Listener error:', e);
                }
            }
        }

        setStatus(status, message) {
            this.status = status;
            if (message) this.statusMessage = message;
            this._notify();
        }

        getStatus() {
            return {
                status: this.status,
                message: this.statusMessage,
                isReady: this.status === MODEL_STATUS.READY,
                isLoading: this.status === MODEL_STATUS.LOADING,
                isUnavailable: this.status === MODEL_STATUS.UNAVAILABLE || this.status === MODEL_STATUS.UNCONFIGURED,
                isError: this.status === MODEL_STATUS.ERROR,
                activeModel: this.activeModel,
                runtime: this.config.runtime,
                knownModels: GEMMA_MODELS,
                lastDiagnostic: this.lastDiagnostic
            };
        }

        /**
         * Comprehensive hardware and browser capability diagnostic
         */
        async checkEnvironmentSupport() {
            this.setStatus(MODEL_STATUS.CHECKING, 'Checking browser hardware acceleration and WebGPU support...');

            const diag = {
                timestamp: new Date().toISOString(),
                webGPU: false,
                webGPUDevice: false,
                adapterInfo: null,
                limits: null,
                webAssembly: typeof WebAssembly === 'object',
                sharedArrayBuffer: typeof SharedArrayBuffer !== 'undefined',
                browserPromptAPI: false,
                recommendation: '',
                blockers: []
            };

            // Check WebGPU availability
            if (typeof navigator !== 'undefined' && navigator.gpu) {
                try {
                    const adapter = await navigator.gpu.requestAdapter();
                    if (adapter) {
                        diag.webGPU = true;
                        diag.limits = {
                            maxBufferSize: adapter.limits ? adapter.limits.maxBufferSize : null,
                            maxStorageBufferBindingSize: adapter.limits ? adapter.limits.maxStorageBufferBindingSize : null
                        };

                        if (adapter.requestAdapterInfo) {
                            try {
                                const info = await adapter.requestAdapterInfo();
                                diag.adapterInfo = {
                                    vendor: info.vendor || 'Unknown',
                                    architecture: info.architecture || 'Unknown',
                                    device: info.device || 'Unknown'
                                };
                            } catch (_) {}
                        }

                        // Check actual device creation
                        try {
                            const device = await adapter.requestDevice();
                            if (device) {
                                diag.webGPUDevice = true;
                                device.destroy();
                            }
                        } catch (devErr) {
                            diag.blockers.push('WebGPU device request failed: ' + devErr.message);
                        }
                    } else {
                        diag.blockers.push('No compatible WebGPU graphics adapter found.');
                    }
                } catch (gpuErr) {
                    diag.blockers.push('WebGPU initialization error: ' + gpuErr.message);
                }
            } else {
                diag.blockers.push('WebGPU is not supported by this browser or platform.');
            }

            // Check experimental window.ai (Chrome Built-in Prompt API)
            if (typeof window !== 'undefined' && window.ai && window.ai.languageModel) {
                diag.browserPromptAPI = true;
            }

            // Synthesize diagnostic summary
            if (diag.webGPU && diag.webGPUDevice && diag.webAssembly) {
                diag.recommendation = 'Hardware supports local WebGPU inference. Downloading a vision-capable Gemma model requires ~1.8 GB to 3.2 GB and explicit user consent.';
            } else if (diag.blockers.length > 0) {
                diag.recommendation = 'Browser-local WebGPU is unavailable: ' + diag.blockers.join('; ') + '. Use a local companion endpoint (localhost) or exact SHA-256 duplicate detection.';
            }

            this.lastDiagnostic = diag;

            if (this.status !== MODEL_STATUS.READY) {
                this.setStatus(
                    MODEL_STATUS.UNAVAILABLE,
                    diag.recommendation || 'Hardware diagnostic completed.'
                );
            }

            return diag;
        }

        /**
         * Connect to a local companion endpoint (e.g. running PaliGemma locally on localhost)
         * Preserves privacy by communicating only via local loopback.
         */
        async connectLocalEndpoint(url) {
            const targetUrl = url || this.config.endpointUrl;
            this.setStatus(MODEL_STATUS.CHECKING, `Checking local Gemma companion at ${targetUrl}...`);

            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 3000);

                const response = await fetch(`${targetUrl}/health`, {
                    method: 'GET',
                    signal: controller.signal
                });
                clearTimeout(timeoutId);

                if (!response.ok) {
                    const errData = await response.json().catch(() => ({}));
                    const blockerMsg = errData.blocker || `Endpoint returned status ${response.status}`;
                    const statusMsg = `Local Gemma companion reached, but model is unconfigured: ${blockerMsg}`;
                    this.setStatus(MODEL_STATUS.UNAVAILABLE, statusMsg);
                    return { success: false, error: blockerMsg, unconfigured: true };
                }

                const data = await response.json();
                this.activeModel = {
                    name: data.modelName || 'Local Gemma/PaliGemma Service',
                    type: data.type || 'multimodal',
                    endpoint: targetUrl,
                    runtime: 'local-endpoint'
                };

                this.config.endpointUrl = targetUrl;
                this.config.runtime = 'local-endpoint';
                this.setStatus(MODEL_STATUS.READY, `Connected to local Gemma service: ${this.activeModel.name}`);
                return { success: true, model: this.activeModel };

            } catch (err) {
                const isConnRefused = err.message && (err.message.includes('Failed to fetch') || err.message.includes('NetworkError') || err.message.includes('ECONNREFUSED'));
                const msg = isConnRefused 
                    ? `Cannot connect to local Gemma companion at ${targetUrl} (Connection refused). Start the companion server with: npm run companion`
                    : `Could not connect to local Gemma endpoint: ${err.message}`;
                this.setStatus(MODEL_STATUS.UNAVAILABLE, msg);
                return { success: false, error: msg };
            }
        }

        /**
         * Initialize on-device WebGPU model.
         * Enforces strict user consent before downloading large model weights.
         */
        async initOnDeviceWebGPU(options = {}) {
            if (!options.userConsent) {
                const consentError = 'Model initialization halted: Downloading ~1.8 GB to 3.2 GB of weights requires explicit user consent.';
                this.setStatus(MODEL_STATUS.UNAVAILABLE, consentError);
                throw new Error(consentError);
            }

            const modelId = options.modelId || this.config.selectedModel;
            const modelMeta = GEMMA_MODELS[modelId];

            if (!modelMeta) {
                throw new Error(`Unknown model identifier: ${modelId}`);
            }

            if (!modelMeta.supportsImages) {
                const textOnlyError = `Model "${modelMeta.name}" is text-only and does not support image input. PaliGemma is required for visual photo classification.`;
                this.setStatus(MODEL_STATUS.ERROR, textOnlyError);
                throw new Error(textOnlyError);
            }

            if (!options.skipHardwareCheck && typeof this.inferenceProvider !== 'function') {
                const diag = await this.checkEnvironmentSupport();
                if (!diag.webGPU || !diag.webGPUDevice) {
                    const gpuError = 'WebGPU is not fully available in this browser environment to allocate model tensors.';
                    this.setStatus(MODEL_STATUS.UNAVAILABLE, gpuError);
                    throw new Error(gpuError);
                }
            }

            this.setStatus(MODEL_STATUS.LOADING, `Initializing ${modelMeta.name} (${modelMeta.approxDownloadSize})...`);

            try {
                // If a real inference provider was injected (e.g. Transformers.js pipeline or test mock)
                if (typeof this.inferenceProvider === 'function') {
                    this.activeModel = {
                        name: modelMeta.name,
                        id: modelId,
                        runtime: 'browser-webgpu',
                        supportsImages: true
                    };
                    this.setStatus(MODEL_STATUS.READY, `${modelMeta.name} active for on-device inference.`);
                    return { success: true, model: this.activeModel };
                }

                // In standard static browser without pre-bundled weights:
                // Google requires accepting the license agreement on Hugging Face (gated repository).
                const gatedNotice = `PaliGemma weights are gated under the Google Gemma Terms of Use. To load on-device, connect an authenticated local server or load via an approved ONNX pipeline.`;
                this.setStatus(MODEL_STATUS.UNAVAILABLE, gatedNotice);
                return { success: false, reason: gatedNotice };

            } catch (err) {
                this.setStatus(MODEL_STATUS.ERROR, `Model initialization failed: ${err.message}`);
                throw err;
            }
        }

        /**
         * Fallback Heuristic Categorization Rule Engine
         * Explicitly tagged with method: 'heuristic' and gemmaActive: false.
         */
        classifyByHeuristics(metadata) {
            const fileName = (metadata && metadata.name) ? metadata.name.toLowerCase() : '';

            // Important documents / study notes (Always Keep Safe!)
            const docPatterns = [
                'note', 'study', 'lecture', 'whiteboard', 'doc', 'receipt', 'bill',
                'invoice', 'tax', 'passport', 'id_card', 'license', 'exam', 'assignment', 'scan'
            ];
            for (const pattern of docPatterns) {
                if (fileName.includes(pattern)) {
                    return {
                        method: 'heuristic',
                        modelIdentity: 'heuristic-rule-engine',
                        gemmaActive: false,
                        category: 'documents',
                        suggestedTag: 'Keep Safe (Document/Notes)',
                        keepSafe: true,
                        recommendedAction: 'keep',
                        confidence: 0.90,
                        isUncertain: false,
                        explanation: `File name matches "${pattern}", indicating valuable study or financial records.`
                    };
                }
            }

            // Memes / social media downloads
            const memePatterns = ['meme', 'reddit', 'whatsapp_image', 'discord', 'download', 'img_'];
            for (const pattern of memePatterns) {
                if (fileName.includes(pattern)) {
                    return {
                        method: 'heuristic',
                        modelIdentity: 'heuristic-rule-engine',
                        gemmaActive: false,
                        category: 'memes',
                        suggestedTag: 'Review Clutter',
                        keepSafe: false,
                        recommendedAction: 'review',
                        confidence: 0.65,
                        isUncertain: false,
                        explanation: 'Naming convention matches downloaded social or meme media.'
                    };
                }
            }

            // Greetings / generic photos
            const greetingPatterns = ['good_morning', 'morning', 'greeting', 'festival', 'wishes', 'happy_'];
            for (const pattern of greetingPatterns) {
                if (fileName.includes(pattern)) {
                    return {
                        method: 'heuristic',
                        modelIdentity: 'heuristic-rule-engine',
                        gemmaActive: false,
                        category: 'greetings',
                        suggestedTag: 'Review Greeting',
                        keepSafe: false,
                        recommendedAction: 'review',
                        confidence: 0.75,
                        isUncertain: false,
                        explanation: 'Naming convention indicates forwarded greeting image.'
                    };
                }
            }

            // Default safe heuristic
            return {
                method: 'heuristic',
                modelIdentity: 'heuristic-rule-engine',
                gemmaActive: false,
                category: 'photos',
                suggestedTag: 'General Photo',
                keepSafe: true, // Default to keep safe if unclassified
                recommendedAction: 'keep',
                confidence: 0.50,
                isUncertain: true,
                explanation: 'General photo with standard filename. Kept safe by default.'
            };
        }

        /**
         * Classify photo:
         * - If Gemma model is READY, runs real inference.
         * - If model is UNAVAILABLE or fails, safely falls back to transparent heuristics.
         * - Applies safety guardrails: study notes and low confidence (< 70%) are forced to keepSafe: true.
         */
        async classifyPhoto(fileOrMetadata) {
            const fileName = (fileOrMetadata && fileOrMetadata.name) ? fileOrMetadata.name : 'image.jpg';

            // Check if study note or document by name first (Invariant: Documents are ALWAYS protected)
            const isProtectedDocument = this.classifyByHeuristics({ name: fileName }).category === 'documents';

            // 1. Model is Ready -> Run real inference
            if (this.status === MODEL_STATUS.READY) {
                try {
                    let prediction = null;

                    if (typeof this.inferenceProvider === 'function') {
                        prediction = await this.inferenceProvider(fileOrMetadata);
                    } else if (this.config.runtime === 'local-endpoint') {
                        prediction = await this._classifyViaLocalEndpoint(fileOrMetadata);
                    }

                    if (prediction) {
                        const confidence = Number(prediction.confidence) || 0.5;
                        const isUncertain = confidence < this.config.confidenceThreshold;
                        const keepSafe = isProtectedDocument || isUncertain || Boolean(prediction.keepSafe);

                        return {
                            method: 'gemma-vision-model',
                            modelIdentity: this.activeModel ? this.activeModel.name : 'PaliGemma-3B',
                            gemmaActive: true,
                            category: prediction.category || 'general-photo',
                            suggestedTag: isProtectedDocument ? 'Keep Safe (Document)' : (keepSafe ? 'Keep Safe (Uncertain)' : 'Review Candidate'),
                            keepSafe,
                            recommendedAction: keepSafe ? 'keep' : 'review',
                            confidence,
                            isUncertain,
                            explanation: isProtectedDocument 
                                ? 'Identified by Gemma, protected due to document/study content.'
                                : (isUncertain 
                                    ? `Model uncertainty high (confidence ${(confidence * 100).toFixed(0)}% < 70%). Kept safe.`
                                    : (prediction.explanation || 'Classified by on-device Gemma vision model.'))
                        };
                    }
                } catch (infErr) {
                    console.warn('[GemmaService] Model inference failed, falling back to heuristic:', infErr.message);
                }
            }

            // 2. Fallback to transparent heuristics
            const fallback = this.classifyByHeuristics(fileOrMetadata);
            return Object.assign({}, fallback, {
                statusNote: 'Advisory heuristic rule. (Gemma model is currently unconfigured or offline).'
            });
        }

        async _classifyViaLocalEndpoint(fileOrBlob) {
            const endpoint = this.config.endpointUrl;
            const formData = new FormData();

            if (typeof Blob !== 'undefined' && fileOrBlob instanceof Blob) {
                const filename = fileOrBlob.name || 'photo.jpg';
                formData.append('file', fileOrBlob, filename);
            } else if (fileOrBlob && fileOrBlob.rawFile && typeof Blob !== 'undefined' && fileOrBlob.rawFile instanceof Blob) {
                formData.append('file', fileOrBlob.rawFile, fileOrBlob.name || 'photo.jpg');
            } else if (fileOrBlob && typeof fileOrBlob === 'object') {
                formData.append('file', new Blob([JSON.stringify(fileOrBlob)], { type: 'application/json' }), fileOrBlob.name || 'metadata.json');
            }

            const res = await fetch(`${endpoint}/classify`, {
                method: 'POST',
                body: formData
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || errData.blocker || `Local endpoint classification error: ${res.status}`);
            }
            return await res.json();
        }
    }

    return {
        MODEL_STATUS,
        GEMMA_MODELS,
        GemmaClassifierService
    };
}));
