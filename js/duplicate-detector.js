/**
 * LazySloth Cleaner - Duplicate Detection Engine
 * 
 * Uses the browser's native Web Crypto API (SHA-256) to perform 100% on-device,
 * byte-for-byte exact duplicate identification without transmitting any file data.
 */

(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.LazySlothDuplicateDetector = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {

    // Document/study keyword patterns that should automatically trigger "Keep Safe" protection
    const KEEP_SAFE_PATTERNS = [
        /study/i,
        /notes?/i,
        /lecture/i,
        /whiteboard/i,
        /doc(ument)?s?/i,
        /receipts?/i,
        /bills?/i,
        /invoice/i,
        /tax/i,
        /passport/i,
        /license/i,
        /cert(ificate)?/i,
        /exam/i,
        /assignment/i,
        /homework/i,
        /scan/i
    ];

    /**
     * Format byte sizes into readable strings (KB, MB, GB)
     */
    function formatBytes(bytes) {
        if (!bytes || bytes <= 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        const formatted = (bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1);
        return `${formatted} ${sizes[i]}`;
    }

    /**
     * Check if a filename suggests a valuable document or study note
     */
    function shouldKeepSafe(fileName) {
        if (!fileName || typeof fileName !== 'string') return false;
        return KEEP_SAFE_PATTERNS.some(pattern => pattern.test(fileName));
    }

    /**
     * Compute SHA-256 hash for a File, Blob, or Buffer using Web Crypto API
     * @param {Blob|File|ArrayBuffer|ArrayBufferView} file 
     * @returns {Promise<string>} Hex string of SHA-256 digest
     */
    async function hashFile(file) {
        if (!file) throw new Error('No file provided for hashing');

        // Check for Web Crypto API support
        const subtleCrypto = (typeof crypto !== 'undefined' && crypto.subtle) 
            ? crypto.subtle 
            : null;

        if (!subtleCrypto) {
            // Defensive fallback when Web Crypto is unavailable (e.g., insecure HTTP context)
            throw new Error('Web Crypto API (crypto.subtle) is not available in this browser environment.');
        }

        let arrayBuffer;
        if (typeof file.arrayBuffer === 'function') {
            arrayBuffer = await file.arrayBuffer();
        } else if (file instanceof ArrayBuffer) {
            arrayBuffer = file;
        } else if (ArrayBuffer.isView(file)) {
            arrayBuffer = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
        } else {
            throw new Error('Unsupported file or stream data provided for hashing');
        }

        // Ensure we hash the exact slice if an ArrayBufferView was converted
        if (arrayBuffer && arrayBuffer.byteOffset !== undefined && arrayBuffer.byteLength !== undefined) {
            arrayBuffer = arrayBuffer.buffer.slice(arrayBuffer.byteOffset, arrayBuffer.byteOffset + arrayBuffer.byteLength);
        }

        const hashBuffer = await subtleCrypto.digest('SHA-256', arrayBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        return hashHex;
    }

    /**
     * Process an array of local image files:
     * - Compute SHA-256 hashes
     * - Identify exact byte duplicates
     * - Group duplicates with their respective original
     * - Tag documents/study notes as "Keep Safe"
     * 
     * @param {File[]} files 
     * @param {Function} [onProgress] Callback with { current, total, percent, currentFileName }
     * @returns {Promise<Object>} Results containing processed items and duplicate groups
     */
    async function scanFiles(files, onProgress) {
        if (!Array.isArray(files)) {
            files = Array.from(files || []);
        }

        const total = files.length;
        const hashGroups = new Map();
        const processedItems = [];

        let duplicateCount = 0;
        let duplicateBytes = 0;
        let totalBytes = 0;

        for (let i = 0; i < total; i++) {
            const file = files[i];
            const currentFileName = file.name || `photo_${i + 1}`;
            totalBytes += file.size || 0;

            if (typeof onProgress === 'function') {
                const percent = Math.round(((i + 1) / total) * 100);
                onProgress({
                    current: i + 1,
                    total,
                    percent,
                    currentFileName
                });
            }

            let hash = null;
            let hashError = null;

            try {
                hash = await hashFile(file);
            } catch (err) {
                console.warn(`[LazySloth] Could not hash file "${currentFileName}":`, err.message);
                hashError = err.message;
            }

            const isDocument = shouldKeepSafe(currentFileName);
            const isFirstSeen = hash && !hashGroups.has(hash);

            let isDuplicate = false;
            let originalName = null;
            let reason = 'Unique local image';

            if (hash) {
                if (isFirstSeen) {
                    hashGroups.set(hash, [file]);
                    reason = 'Original image';
                } else {
                    const group = hashGroups.get(hash);
                    group.push(file);
                    isDuplicate = true;
                    originalName = group[0].name;
                    reason = `Exact SHA-256 match with ${originalName}`;
                    duplicateCount++;
                    duplicateBytes += file.size || 0;
                }
            } else {
                reason = hashError ? `Hash unavailable: ${hashError}` : 'Unprocessed image';
            }

            // Safe default: Study notes, documents, and originals default to "keepSafe = true"
            // Only non-protected exact duplicates are selected for cleanup by default
            const keepSafe = isDocument || !isDuplicate;
            const selectedForCleanup = isDuplicate && !isDocument;

            const item = {
                id: `photo_${i}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
                category: 'photo',
                file,
                fileName: currentFileName,
                displayName: currentFileName,
                sizeBytes: file.size || 0,
                formattedSize: formatBytes(file.size || 0),
                mimeType: file.type || 'image/unknown',
                lastModified: file.lastModified ? new Date(file.lastModified).toISOString() : null,
                hash,
                isDuplicate,
                originalName,
                reason,
                keepSafe,
                selected: selectedForCleanup,
                isDemo: false,
                thumbnailUrl: null // Generated lazily via URL.createObjectURL
            };

            processedItems.push(item);
        }

        return {
            items: processedItems,
            duplicateGroups: Array.from(hashGroups.entries()).filter(([_, group]) => group.length > 1),
            stats: {
                totalFiles: total,
                totalBytes,
                formattedTotalBytes: formatBytes(totalBytes),
                duplicateCount,
                duplicateBytes,
                formattedDuplicateBytes: formatBytes(duplicateBytes),
                uniqueCount: total - duplicateCount
            }
        };
    }

    return {
        formatBytes,
        shouldKeepSafe,
        hashFile,
        scanFiles
    };
}));
