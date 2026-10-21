/**
 * LazySloth Cleaner - Centralized Review Store (Phase 3.F)
 * 
 * Provides a single source of truth for all candidate items across
 * Photos, Email, and SMS/Messages.
 * 
 * Guarantees:
 * 1. Stable, unique string IDs (no DOM position coupling).
 * 2. Protected items ("Keep Safe") are never auto-selected for deletion.
 * 3. Toggling "Keep Safe" immediately deselects the item from cleanup.
 * 4. Reactive listener subscriptions for synchronized UI updates.
 * 5. Safe lifecycle management (object URL revocation on removal).
 */

(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.LazySlothReviewStore = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {

    function formatBytes(bytes) {
        if (!bytes || bytes <= 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        const formatted = (bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1);
        return `${formatted} ${sizes[i]}`;
    }

    class ReviewStore {
        constructor() {
            this.items = new Map(); // id -> item
            this.listeners = new Set();
        }

        /**
         * Subscribe a listener callback to store changes
         * @param {Function} listener 
         * @returns {Function} Unsubscribe function
         */
        subscribe(listener) {
            if (typeof listener === 'function') {
                this.listeners.add(listener);
                return () => this.listeners.delete(listener);
            }
            return () => {};
        }

        /**
         * Notify all registered listeners
         */
        _notify() {
            const summary = this.getSummary();
            for (const listener of this.listeners) {
                try {
                    listener(this.getAll(), summary);
                } catch (e) {
                    console.error('[ReviewStore] Listener error:', e);
                }
            }
        }

        /**
         * Add or update an item
         */
        addItem(item) {
            if (!item || !item.id) {
                console.warn('[ReviewStore] Item missing valid ID:', item);
                return;
            }

            const existing = this.items.get(item.id);

            // Ensure stable fields
            const normalized = Object.assign({
                id: item.id,
                category: item.category || 'photo', // 'photo' | 'email' | 'sms'
                displayName: item.displayName || item.name || 'Untitled Item',
                reason: item.reason || 'Candidate for review',
                sizeBytes: Number(item.sizeBytes) || 0,
                keepSafe: Boolean(item.keepSafe),
                selected: Boolean(item.selected),
                isDemo: Boolean(item.isDemo),
                thumbnailUrl: item.thumbnailUrl || null,
                fileRef: item.fileRef || item.file || null,
                details: item.details || null
            }, existing, item);

            normalized.formattedSize = formatBytes(normalized.sizeBytes);

            // Invariant: Protected items cannot be selected for cleanup
            if (normalized.keepSafe) {
                normalized.selected = false;
            }

            this.items.set(item.id, normalized);
            this._notify();
            return normalized;
        }

        /**
         * Bulk add or update items
         */
        addItems(itemsList) {
            if (!Array.isArray(itemsList)) return;
            itemsList.forEach(item => {
                if (item && item.id) {
                    const normalized = Object.assign({
                        id: item.id,
                        category: item.category || 'photo',
                        displayName: item.displayName || item.name || 'Untitled Item',
                        reason: item.reason || 'Candidate for review',
                        sizeBytes: Number(item.sizeBytes) || 0,
                        keepSafe: Boolean(item.keepSafe),
                        selected: Boolean(item.selected),
                        isDemo: Boolean(item.isDemo),
                        thumbnailUrl: item.thumbnailUrl || null,
                        fileRef: item.fileRef || item.file || null,
                        details: item.details || null
                    }, item);
                    normalized.formattedSize = formatBytes(normalized.sizeBytes);
                    if (normalized.keepSafe) {
                        normalized.selected = false;
                    }
                    this.items.set(item.id, normalized);
                }
            });
            this._notify();
        }

        /**
         * Get an item by ID
         */
        getItem(id) {
            return this.items.get(id);
        }

        /**
         * Get all items as an array
         */
        getAll() {
            return Array.from(this.items.values());
        }

        /**
         * Get items by category
         */
        getByCategory(category) {
            return this.getAll().filter(item => item.category === category);
        }

        /**
         * Toggle item selection state for cleanup
         */
        toggleSelect(id, forceState) {
            const item = this.items.get(id);
            if (!item) return;

            // Cannot select protected items
            if (item.keepSafe) {
                item.selected = false;
                this._notify();
                return;
            }

            item.selected = typeof forceState === 'boolean' ? forceState : !item.selected;
            this._notify();
        }

        /**
         * Toggle Keep Safe protection
         */
        toggleKeepSafe(id, forceState) {
            const item = this.items.get(id);
            if (!item) return;

            item.keepSafe = typeof forceState === 'boolean' ? forceState : !item.keepSafe;
            if (item.keepSafe) {
                // Instantly unselect for cleanup if marked safe
                item.selected = false;
            }
            this._notify();
        }

        /**
         * Select or deselect all eligible items in a category (or overall)
         * Protected items ("keepSafe") are NEVER selected.
         */
        setSelectAll(selected, category = null) {
            const items = category ? this.getByCategory(category) : this.getAll();
            items.forEach(item => {
                if (item.keepSafe) {
                    item.selected = false;
                } else {
                    item.selected = Boolean(selected);
                }
            });
            this._notify();
        }

        /**
         * Safely remove an item from the review store.
         * Revokes object URLs to prevent browser memory leaks.
         */
        removeItem(id) {
            const item = this.items.get(id);
            if (!item) return;

            if (item.thumbnailUrl && item.thumbnailUrl.startsWith('blob:')) {
                try {
                    URL.revokeObjectURL(item.thumbnailUrl);
                } catch (e) {
                    // Ignore URL revoke failures
                }
            }

            this.items.delete(id);
            this._notify();
        }

        /**
         * Remove all currently selected items (after confirmed sweep)
         * Returns an array of removed items for confirmation messaging.
         */
        removeSelected() {
            const removed = [];
            for (const [id, item] of this.items.entries()) {
                if (item.selected && !item.keepSafe) {
                    if (item.thumbnailUrl && item.thumbnailUrl.startsWith('blob:')) {
                        try {
                            URL.revokeObjectURL(item.thumbnailUrl);
                        } catch (e) {}
                    }
                    removed.push(item);
                    this.items.delete(id);
                }
            }
            this._notify();
            return removed;
        }

        /**
         * Clear all items in the store (or specific category)
         */
        clear(category = null) {
            for (const [id, item] of this.items.entries()) {
                if (!category || item.category === category) {
                    if (item.thumbnailUrl && item.thumbnailUrl.startsWith('blob:')) {
                        try {
                            URL.revokeObjectURL(item.thumbnailUrl);
                        } catch (e) {}
                    }
                    this.items.delete(id);
                }
            }
            this._notify();
        }

        /**
         * Calculate reactive summary statistics
         */
        getSummary() {
            let totalCount = 0;
            let totalBytes = 0;
            let selectedCount = 0;
            let selectedBytes = 0;
            let keepSafeCount = 0;

            const categoryBreakdown = {
                photo: { count: 0, bytes: 0, selectedCount: 0, selectedBytes: 0 },
                email: { count: 0, bytes: 0, selectedCount: 0, selectedBytes: 0 },
                sms: { count: 0, bytes: 0, selectedCount: 0, selectedBytes: 0 }
            };

            for (const item of this.items.values()) {
                totalCount++;
                totalBytes += item.sizeBytes || 0;

                const cat = categoryBreakdown[item.category] || categoryBreakdown.photo;
                cat.count++;
                cat.bytes += item.sizeBytes || 0;

                if (item.keepSafe) {
                    keepSafeCount++;
                } else if (item.selected) {
                    selectedCount++;
                    selectedBytes += item.sizeBytes || 0;
                    cat.selectedCount++;
                    cat.selectedBytes += item.sizeBytes || 0;
                }
            }

            return {
                totalCount,
                totalBytes,
                formattedTotalBytes: formatBytes(totalBytes),
                selectedCount,
                selectedBytes,
                formattedSelectedBytes: formatBytes(selectedBytes),
                keepSafeCount,
                categoryBreakdown: {
                    photo: {
                        ...categoryBreakdown.photo,
                        formattedBytes: formatBytes(categoryBreakdown.photo.bytes),
                        formattedSelectedBytes: formatBytes(categoryBreakdown.photo.selectedBytes)
                    },
                    email: {
                        ...categoryBreakdown.email,
                        formattedBytes: formatBytes(categoryBreakdown.email.bytes),
                        formattedSelectedBytes: formatBytes(categoryBreakdown.email.selectedBytes)
                    },
                    sms: {
                        ...categoryBreakdown.sms,
                        formattedBytes: formatBytes(categoryBreakdown.sms.bytes),
                        formattedSelectedBytes: formatBytes(categoryBreakdown.sms.selectedBytes)
                    }
                }
            };
        }
    }

    return {
        ReviewStore,
        formatBytes
    };
}));
