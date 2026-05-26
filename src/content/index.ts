import { DEFAULT_ADAPTERS, ServiceAdapter, UserMessagePayload } from '../types';
import {
    CONTENT_MESSAGE_SOURCE,
    DriverCapabilities,
    isHubToContentMessage,
    type ContentToHubMessage,
    type ExecuteCommandMessage,
    type FrameStatus,
} from '../runtime/protocol';
import { resolveDriver } from './drivers';
import {
    DriverExecutionError,
    type BotDriver,
    type DriverTraceEntry,
} from './drivers/types';
import {
    executeAdapterActions,
    selectorSpecToDebugString,
    sleep,
    waitForElement,
} from './dom/actions';

console.log('[ChatHub Content] Script loaded for:', window.location.hostname);

// Store for current adapter
let currentAdapter: ServiceAdapter | undefined;
let currentDriver: BotDriver | undefined;
let currentStatus: FrameStatus = 'booting';
let commandQueue: Promise<void> = Promise.resolve();
let readyStatePromise: Promise<void> | null = null;

function isLegacyHubMessage(
    value: unknown
): value is {
    type: 'USER_MESSAGE' | 'INJECT_PROMPT';
    payload?: unknown;
} {
    if (!value || typeof value !== 'object') {
        return false;
    }

    const candidate = value as { type?: unknown };
    return candidate.type === 'USER_MESSAGE'
        || candidate.type === 'INJECT_PROMPT';
}

function getCapabilities(): DriverCapabilities {
    if (currentAdapter && currentDriver) {
        return currentDriver.getCapabilities(currentAdapter);
    }

    return {
        text: false,
        submit: false,
        files: false,
    };
}

function postToParent(message: ContentToHubMessage) {
    window.parent.postMessage(message, '*');
}

function emitFrameStatus(status: FrameStatus, reason?: string, detail?: string) {
    currentStatus = status;
    postToParent({
        source: CONTENT_MESSAGE_SOURCE,
        type: status === 'ready' ? 'FRAME_READY' : 'FRAME_STATUS',
        payload: {
            status,
            adapterId: currentAdapter?.id,
            adapterName: currentAdapter?.name,
            url: window.location.href,
            capabilities: getCapabilities(),
            reason,
            detail,
            timestamp: Date.now(),
        },
    });
}

function enqueueCommand(task: () => Promise<void>) {
    commandQueue = commandQueue.then(task, task);
    return commandQueue;
}

function summarizeTrace(trace: DriverTraceEntry[]) {
    return trace
        .map((entry) => `${entry.step}:${entry.status}:${entry.message}`)
        .slice(-8)
        .join(' | ');
}

function getReadySelector(adapter: ServiceAdapter) {
    return adapter.readySelector ?? adapter.inputSelector ?? 'textarea, input[type="text"], div[contenteditable="true"]';
}

async function waitForCurrentAdapterReady(forceRefresh = false) {
    await adapterReadyPromise;

    if (!currentAdapter) {
        throw new Error('ADAPTER_NOT_FOUND');
    }

    if (!forceRefresh && currentStatus === 'ready') {
        return;
    }

    if (readyStatePromise) {
        return readyStatePromise;
    }

    readyStatePromise = (async () => {
        const selector = getReadySelector(currentAdapter as ServiceAdapter);
        const selectorDebug = selectorSpecToDebugString(selector);
        const startedAt = Date.now();

        while (Date.now() - startedAt < 15000) {
            try {
                await waitForElement(selector, {
                    timeoutMs: 600,
                    intervalMs: 150,
                    visible: false,
                });

                if (currentAdapter?.readyActions?.length) {
                    await executeAdapterActions(currentAdapter.readyActions);
                    await waitForElement(selector, {
                        timeoutMs: 600,
                        intervalMs: 150,
                        visible: false,
                    });
                }

                emitFrameStatus('ready');
                return;
            } catch {
                await sleep(250);
            }
        }

        emitFrameStatus('error', 'READY_TIMEOUT', selectorDebug);
        throw new Error('READY_TIMEOUT');
    })();

    try {
        await readyStatePromise;
    } finally {
        readyStatePromise = null;
    }
}

// Initialize adapter by loading custom adapters from storage
const adapterReadyPromise = (async () => {
    try {
        emitFrameStatus('booting');

        // Load custom adapters from storage
        const result = await chrome.storage.local.get(['customAdapters']);
        const customAdapters = (result.customAdapters as ServiceAdapter[]) || [];

        // Merge with default adapters
        const allAdapters = [...DEFAULT_ADAPTERS, ...customAdapters];

        console.log('[ChatHub Content] Available adapters:', allAdapters.length);

        // Find the adapter for the current domain
        currentAdapter = allAdapters.find(adapter =>
            window.location.href.includes(new URL(adapter.url).hostname)
        );

        if (currentAdapter) {
            currentDriver = resolveDriver(currentAdapter);
            console.log('[ChatHub Content] ✅ Activated adapter:', currentAdapter.name);
            console.log('[ChatHub Content] ✅ Activated driver:', currentDriver.id);
            console.log('[ChatHub Content] Input selector:', selectorSpecToDebugString(currentAdapter.inputSelector));
            console.log('[ChatHub Content] Submit selector:', selectorSpecToDebugString(currentAdapter.submitSelector));


            void waitForCurrentAdapterReady(true).catch((error) => {
                console.warn('[ChatHub Content] Ready probe failed:', error);
            });
        } else {
            console.log('[ChatHub Content] ⚠️ No adapter found for this domain');
            emitFrameStatus('unsupported', 'ADAPTER_NOT_FOUND');
        }
    } catch (error) {
        console.error('[ChatHub Content] Failed to load adapters:', error);
        // Fallback to default adapters
        currentAdapter = DEFAULT_ADAPTERS.find(adapter =>
            window.location.href.includes(new URL(adapter.url).hostname)
        );

        if (currentAdapter) {
            currentDriver = resolveDriver(currentAdapter);



            void waitForCurrentAdapterReady(true).catch((error) => {
                console.warn('[ChatHub Content] Ready probe failed:', error);
            });
        } else {
            emitFrameStatus('unsupported', 'ADAPTER_NOT_FOUND');
        }
    }
})();

// Listen for messages from the Hub (parent window)
window.addEventListener('message', async (event) => {
    try {
        const extensionOrigin = `chrome-extension://${chrome.runtime.id}`;
        const isParentWindow = event.source === window.parent;
        const isExtensionOrigin = event.origin === extensionOrigin;

        console.log('[ChatHub Content] 📩 Message received:', {
            type: (event.data as any)?.type,
            source: event.source === window.parent ? 'parent' : 'other',
            origin: event.origin,
            isParentWindow,
            isExtensionOrigin,
            hostname: window.location.hostname
        });

        if (!isParentWindow && !isExtensionOrigin) {
            console.log('[ChatHub Content] ⚠️ Message rejected: not from parent window or extension origin');
            return;
        }

        if (isHubToContentMessage(event.data)) {
            if (event.data.type === 'FRAME_HELLO') {
                await adapterReadyPromise;

                if (currentAdapter) {
                    try {
                        await waitForCurrentAdapterReady(currentStatus !== 'ready');
                    } catch {
                        // Status has already been emitted by waitForCurrentAdapterReady.
                    }
                } else {
                    emitFrameStatus(currentStatus, currentStatus === 'unsupported' ? 'ADAPTER_NOT_FOUND' : undefined);
                }
                return;
            }

            if (event.data.type === 'EXECUTE_COMMAND') {
                handleExecuteCommand(event.data.payload);
                return;
            }
        }

        if (!isLegacyHubMessage(event.data)) {
            return;
        }

        const { type, payload } = event.data;

        console.log('[ChatHub Content] 📩 Received message:', { type, payload, hostname: window.location.hostname });

        if (type === 'USER_MESSAGE') {
            await handleUserMessage(payload as UserMessagePayload);
        } else if (type === 'INJECT_PROMPT') {
            await handleUserMessage({ text: (payload as { content: string }).content, autoSubmit: false });
        }
    } catch (error) {
        console.error('[ChatHub Content] ❌ Unhandled error in message handler:', error);

        if (isHubToContentMessage(event.data) || isLegacyHubMessage(event.data)) {
            emitFrameStatus('error', error instanceof Error ? error.message : 'Unknown error');
        }
    }
});

window.addEventListener('load', () => {
    void adapterReadyPromise.then(async () => {
        if (currentAdapter) {
            try {
                await waitForCurrentAdapterReady(currentStatus !== 'ready');
            } catch {
                // Status already emitted.
            }
            return;
        }

        emitFrameStatus(currentStatus, currentStatus === 'unsupported' ? 'ADAPTER_NOT_FOUND' : undefined);
    });
});

function handleExecuteCommand(payload: ExecuteCommandMessage['payload']) {
    void handleExecuteCommandAsync(payload).catch(() => {});
}

async function handleExecuteCommandAsync(payload: ExecuteCommandMessage['payload']): Promise<void> {
    if (window !== window.parent) {
        postToParent({
            source: CONTENT_MESSAGE_SOURCE,
            type: 'COMMAND_ACK',
            payload: {
                commandId: payload.commandId,
                timestamp: Date.now(),
            },
        });
    }

    return new Promise<void>((resolve, reject) => {
        void enqueueCommand(async () => {
            const trace: DriverTraceEntry[] = [];
            const context = {
                trace: (entry: Omit<DriverTraceEntry, 'timestamp'>) => {
                    trace.push({
                        ...entry,
                        timestamp: Date.now(),
                    });
                },
            };

            try {
                emitFrameStatus('busy');
                await adapterReadyPromise;
                await waitForCurrentAdapterReady(currentStatus !== 'ready');
                await handleUserMessage({
                    text: payload.text,
                    autoSubmit: payload.autoSubmit,
                    files: payload.files,
                }, context);

                const detail = summarizeTrace(trace);
                emitFrameStatus(currentAdapter ? 'ready' : 'unsupported', undefined, detail);
                if (window !== window.parent) {
                    postToParent({
                        source: CONTENT_MESSAGE_SOURCE,
                        type: 'COMMAND_RESULT',
                        payload: {
                            commandId: payload.commandId,
                            success: true,
                            detail,
                            timestamp: Date.now(),
                        },
                    });
                }
                resolve();
            } catch (error) {
                const detail = summarizeTrace(trace);
                const message = error instanceof DriverExecutionError
                    ? `${error.step}:${error.code}:${error.message}`
                    : error instanceof Error
                        ? error.message
                        : 'UNKNOWN_ERROR';
                console.error('[ChatHub Content] ❌ Command failed:', message);
                emitFrameStatus(currentAdapter ? 'error' : 'unsupported', message, detail);
                if (window !== window.parent) {
                    postToParent({
                        source: CONTENT_MESSAGE_SOURCE,
                        type: 'COMMAND_ERROR',
                        payload: {
                            commandId: payload.commandId,
                            error: message,
                            detail,
                            timestamp: Date.now(),
                        },
                    });
                }
                reject(new Error(message));
            }
        });
    });
}

async function handleUserMessage(
    { text, autoSubmit, files }: UserMessagePayload,
    context?: { trace: (entry: Omit<DriverTraceEntry, 'timestamp'>) => void }
) {
    console.log('[ChatHub Content] 🔄 Processing message:', { text: text.substring(0, 50), autoSubmit, filesCount: files?.length });

    await adapterReadyPromise;
    await waitForCurrentAdapterReady(currentStatus !== 'ready');

    if (!currentAdapter) {
        console.error('[ChatHub Content] ❌ No adapter found for this site');
        throw new Error('ADAPTER_NOT_FOUND');
    }

    if (!currentDriver) {
        currentDriver = resolveDriver(currentAdapter);
    }

    await currentDriver.executeMessage(currentAdapter, {
        text,
        autoSubmit,
        files,
    }, context ?? { trace: () => {} });

    console.log('[ChatHub Content] ✅ Message handled successfully');
}

// ─── Chrome Message Listener ─────────────────────────────────
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === 'EXECUTE_COMMAND') {
        handleExecuteCommandAsync(message.payload)
            .then(() => sendResponse({ success: true }))
            .catch((error) => sendResponse({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }));
        return true; // Keep message channel open for async response
    }
    if (message?.type === 'BROADCAST_RESULT') {
        const { totalSent, totalFailed } = message.payload || {};
        if (totalFailed > 0) {
            showNotification(`已发送到 ${totalSent} 个 AI，${totalFailed} 个失败`, 'warning');
        } else {
            showNotification(`已发送到 ${totalSent} 个 AI`, 'success');
        }
        sendResponse({ success: true });
        return;
    }
});

// ─── Toast Notifications ─────────────────────────────────────
let activeToast: HTMLElement | null = null;

function showNotification(message: string, type: 'success' | 'warning' | 'error' = 'success') {
    if (activeToast && activeToast.parentNode) {
        activeToast.parentNode.removeChild(activeToast);
    }

    const toast = document.createElement('div');
    toast.className = `jackdu-chathub-toast jackdu-chathub-toast-${type}`;
    toast.textContent = message;

    const bar = document.getElementById('jackdu-chathub-bar');
    if (bar && bar.parentNode) {
        bar.parentNode.insertBefore(toast, bar);
    } else {
        document.body.appendChild(toast);
    }
    activeToast = toast;

    requestAnimationFrame(() => {
        toast.classList.add('jackdu-chathub-toast-visible');
    });

    setTimeout(() => {
        toast.classList.remove('jackdu-chathub-toast-visible');
        toast.classList.add('jackdu-chathub-toast-hide');
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
            if (activeToast === toast) {
                activeToast = null;
            }
        }, 300);
    }, 2000);
}


