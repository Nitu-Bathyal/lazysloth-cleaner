/**
 * LazySloth Cleaner - Runtime & Deployment Configuration
 * 
 * Manages environment detection and public backend API configuration.
 * In local development, connects to the local companion at http://localhost:5001.
 * In production (Render static site), avoids mixed-content localhost requests
 * and points to the configured public backend service when provisioned.
 */

(function (root) {
    'use strict';

    const isLocalhost = Boolean(
        root.location && (
            root.location.hostname === 'localhost' ||
            root.location.hostname === '127.0.0.1' ||
            root.location.hostname === '[::1]'
        )
    );

    // Default configuration
    root.LAZYSLOTH_CONFIG = {
        // In local development, default to local loopback;
        // In production, empty by default until a public backend service is provisioned
        apiEndpoint: isLocalhost ? 'http://localhost:5001' : '',
        isLocalhost: isLocalhost,
        environment: isLocalhost ? 'development' : 'production',
        // Require explicit user consent dialog before uploading any photo to a remote backend
        requireUploadConsent: true,
        // Documented model requirements
        modelSpecs: {
            name: 'PaliGemma 3B',
            family: 'PaliGemma (Vision-Language)',
            recommendedRAM: '4 GB+ (quantized) / 8 GB (fp16)',
            freeTierSupported: false // 512MB RAM on Render Free Tier cannot host PaliGemma
        }
    };

}(typeof self !== 'undefined' ? self : this));
