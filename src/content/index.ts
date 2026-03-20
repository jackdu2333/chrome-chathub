import { DEFAULT_ADAPTERS, ServiceAdapter, UserMessagePayload } from '../types';
import { detectSelectors } from '../lib/selectorDetector';

console.log('[ChatHub Content] Script loaded for:', window.location.hostname);

/**
 * Generate random delay to simulate human behavior and prevent bot detection
 * @param min Minimum delay in milliseconds
 * @param max Maximum delay in milliseconds
 */
function randomDelay(min: number, max: number): Promise<void> {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    return new Promise(resolve => setTimeout(resolve, delay));
}

// Store for current adapter
let currentAdapter: ServiceAdapter | undefined;

// Initialize adapter by loading custom adapters from storage
(async () => {
    try {
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
            console.log('[ChatHub Content] ✅ Activated adapter:', currentAdapter.name);
            console.log('[ChatHub Content] Input selector:', currentAdapter.inputSelector);
            console.log('[ChatHub Content] Submit selector:', currentAdapter.submitSelector);
        } else {
            console.log('[ChatHub Content] ⚠️ No adapter found for this domain');
        }
    } catch (error) {
        console.error('[ChatHub Content] Failed to load adapters:', error);
        // Fallback to default adapters
        currentAdapter = DEFAULT_ADAPTERS.find(adapter =>
            window.location.href.includes(new URL(adapter.url).hostname)
        );
    }
})();

// Listen for messages from the Hub (parent window)
window.addEventListener('message', async (event) => {
    try {
        // ✅ Phase 1: Message Origin 验证
        // 只接受同源消息,防止XSS攻击
        // Verify origin - allow same origin OR extension origin
        const extensionOrigin = `chrome-extension://${chrome.runtime.id}`;
        // Allow messages from the same window (our own iframe parent)
        const isSameWindow = event.source === window.parent || event.source === window;

        if (!isSameWindow && event.origin !== window.location.origin && event.origin !== extensionOrigin) {
            // console.warn('[ChatHub Content] ⚠️ Rejected message from untrusted origin:', event.origin);
            return;
        }

        // In Chrome extensions, event.source might not equal window.parent
        // So we validate by message structure instead
        const { type, payload } = event.data;

        // Only process known message types
        if (!type || !['USER_MESSAGE', 'INJECT_PROMPT', 'DETECT_SELECTORS'].includes(type)) {
            return;
        }

        console.log('[ChatHub Content] 📩 Received message:', { type, payload, hostname: window.location.hostname });

        if (type === 'USER_MESSAGE') {
            await handleUserMessage(payload);
        } else if (type === 'INJECT_PROMPT') {
            await handleUserMessage({ text: payload.content, autoSubmit: false });
        } else if (type === 'DETECT_SELECTORS') {
            handleDetectSelectors();
        }
    } catch (error) {
        // ✅ Phase 1: 全局错误边界
        console.error('[ChatHub Content] ❌ Unhandled error in message handler:', error);

        // 通知父窗口发生错误
        window.parent.postMessage({
            type: 'CONTENT_ERROR',
            payload: {
                error: error instanceof Error ? error.message : 'Unknown error'
            }
        }, '*');
    }
});

/**
 * Auto-detect selectors and send back to parent
 */
function handleDetectSelectors() {
    console.log('[ChatHub Content] 🔍 Starting auto-detection...');

    try {
        const detected = detectSelectors();

        if (detected) {
            console.log('[ChatHub Content] ✅ Detection successful:', detected);
            window.parent.postMessage({
                type: 'SELECTORS_DETECTED',
                payload: detected
            }, '*');
        } else {
            console.log('[ChatHub Content] ❌ Detection failed');
            window.parent.postMessage({
                type: 'SELECTORS_DETECTED',
                payload: null
            }, '*');
        }
    } catch (error) {
        console.error('[ChatHub Content] ❌ Detection error:', error);
        window.parent.postMessage({
            type: 'SELECTORS_DETECTED',
            payload: null
        }, '*');
    }
}

async function handleUserMessage({ text, autoSubmit, files }: UserMessagePayload) {
    console.log('[ChatHub Content] 🔄 Processing message:', { text: text.substring(0, 50), autoSubmit, filesCount: files?.length });

    if (!currentAdapter) {
        console.error('[ChatHub Content] ❌ No adapter found for this site');
        return;
    }

    // Anti-bot: Simulate thinking delay (150-350ms)
    await randomDelay(150, 350);

    // 1. Find Input
    console.log('[ChatHub Content] 🔍 Looking for input with selector:', currentAdapter.inputSelector);
    let inputEl = document.querySelector(currentAdapter.inputSelector) as HTMLElement;

    if (!inputEl) {
        console.error('[ChatHub Content] ❌ Could not find input element!');
        console.log('[ChatHub Content] 📋 Available textareas:', document.querySelectorAll('textarea').length);
        console.log('[ChatHub Content] 📋 Available contenteditable:', document.querySelectorAll('[contenteditable="true"]').length);
        return;
    }

    console.log('[ChatHub Content] ✅ Found input element:', inputEl.tagName, inputEl.className);

    // 2. Handle File Uploads (Pre-text)
    if (files && files.length > 0) {
        console.log('[ChatHub Content] 📂 Found files to upload:', files.length);
        const success = await handleFileUpload(inputEl, files);
        if (success) {
            console.log('[ChatHub Content] ✅ File upload simulation completed');
            // Wait for UI to react/upload to finish (mock waiter)
            await randomDelay(2500, 4000);
        } else {
            console.warn('[ChatHub Content] ⚠️ File upload simulation failed or not supported');
        }
    }

    // 3. Set Value
    if (text) {
        await setNativeValue(inputEl, text);
        console.log('[ChatHub Content] ✅ Value set to input');
    }

    // 4. Submit if requested
    if (autoSubmit) {
        console.log('[ChatHub Content] 🚀 Auto-submit is ENABLED');

        try {
            // Anti-bot: Simulate checking delay (250-600ms) before submission
            await randomDelay(250, 600);

            let submitSuccess = false;

            // Strategy A: Try clicking the button first
            if (currentAdapter.submitSelector) {
                console.log('[ChatHub Content] 🔍 Looking for submit button with selector:', currentAdapter.submitSelector);
                let submitBtn = document.querySelector(currentAdapter.submitSelector) as HTMLElement;

                if (submitBtn) {
                    console.log('[ChatHub Content] ✅ Found submit button:', submitBtn.tagName, submitBtn.className);

                    // Wait for button to be enabled (up to 5s)
                    // This allows file uploads to complete on sites like Gemini
                    let isEnabled = false;
                    for (let i = 0; i < 25; i++) { // 25 * 200ms = 5000ms
                        // Check multiple ways a button can be disabled
                        const isDisabled = submitBtn.hasAttribute('disabled') ||
                            submitBtn.getAttribute('aria-disabled') === 'true' ||
                            submitBtn.classList.contains('disabled') ||
                            (submitBtn as any).disabled;

                        if (!isDisabled) {
                            isEnabled = true;
                            break;
                        }
                        await randomDelay(200, 200);
                    }

                    if (isEnabled) {
                        console.log('[ChatHub Content] ✅ Button is enabled, clicking...');
                        clickElement(submitBtn);
                        console.log('[ChatHub Content] 🖱️ Clicked submit button');
                        submitSuccess = true;
                    } else {
                        console.warn('[ChatHub Content] ⚠️ Button still disabled after timeout. Force enabling as last resort...');
                        // CRITICAL: Force-enable the button (DeepSeek fallback)
                        submitBtn.removeAttribute('disabled');
                        submitBtn.removeAttribute('aria-disabled');
                        submitBtn.classList.remove('disabled');
                        submitBtn.classList.remove('ds-icon-button--disabled');
                        if (submitBtn instanceof HTMLButtonElement) submitBtn.disabled = false;

                        await randomDelay(100, 200);
                        clickElement(submitBtn);
                        console.log('[ChatHub Content] 🖱️ Force clicked submit button');
                        submitSuccess = true;
                    }
                } else {
                    console.log('[ChatHub Content] ⚠️ Submit button not found via selector');
                }
            }

            // Strategy B: Simulate Enter key (Fallback or Primary if no selector)
            if (!submitSuccess) {
                console.log('[ChatHub Content] ⌨️ Falling back to Enter key simulation...');
                await simulateEnterKey(inputEl);
            }

        } catch (error) {
            console.error('[ChatHub Content] ❌ Auto-submit error:', error);
        }
    } else {
        console.log('[ChatHub Content] ⏸️ Auto-submit is DISABLED (Draft mode), skipping send');
    }

    console.log('[ChatHub Content] ✅ Message handled successfully');
}

/**
 * Handles file upload simulation via Drag and Drop
 */
async function handleFileUpload(targetElement: HTMLElement, files: NonNullable<UserMessagePayload['files']>) {
    try {
        console.log('[ChatHub Content] 📂 Starting refined file upload sequence...');

        // 1. Convert Base64 files back to File objects
        const fileObjects = files.map(f => base64ToFile(f.data, f.name, f.type));

        // Create a DataTransfer object (reused for all strategies)
        const dataTransfer = new DataTransfer();
        fileObjects.forEach(file => dataTransfer.items.add(file));
        dataTransfer.effectAllowed = 'all';
        dataTransfer.dropEffect = 'copy';

        // --- Strategy 1: Paste Event (ContentEditable / Rich Text editors) ---
        // Most modern AI chats (ChatGLM, Claude, ChatGPT, Gemini, Yiyan) use contenteditable divs
        if (targetElement.isContentEditable || targetElement.getAttribute('contenteditable') === 'true') {
            try {
                console.log('[ChatHub Content] 📋 Strategy 1 (Paste): Dispatching Paste event...');
                const pasteEvent = new ClipboardEvent('paste', {
                    bubbles: true,
                    cancelable: true,
                    composed: true,
                    clipboardData: dataTransfer
                });
                targetElement.dispatchEvent(pasteEvent);
                console.log('[ChatHub Content] ✅ Paste event dispatched (Exclusive Strategy)');

                // For some editors, we might need to focus explicitly
                targetElement.focus();

                return true; // Stop here to avoid duplicates
            } catch (err) {
                console.warn('[ChatHub Content] ⚠️ Paste simulation failed:', err);
                // Fallthrough to other strategies if paste fails completely (unlikely)
            }
        }

        // --- Strategy 2: File Input Injection (Native Forms / Textareas) ---
        try {
            // Find the most likely file input
            // 1. Look inside the same form/container as the target
            let fileInput = targetElement.closest('form')?.querySelector('input[type="file"]') as HTMLInputElement;

            // 2. If not found, look for any visible file input in the document
            if (!fileInput) {
                const inputs = Array.from(document.querySelectorAll('input[type="file"]')) as HTMLInputElement[];
                // Filter out disabled inputs
                const activeInputs = inputs.filter(input => !input.disabled);
                if (activeInputs.length > 0) {
                    // Start with the last one (often the most recently added for the chat context) or just the first
                    fileInput = activeInputs[0];
                }
            }

            if (fileInput) {
                console.log('[ChatHub Content] 📎 Strategy 2 (Input): Found file input, setting files...');
                fileInput.files = dataTransfer.files;
                fileInput.dispatchEvent(new Event('change', { bubbles: true }));
                fileInput.dispatchEvent(new Event('input', { bubbles: true }));
                console.log('[ChatHub Content] ✅ File input set successfully (Exclusive Strategy)');
                return true; // Stop here
            }
        } catch (err) {
            console.warn('[ChatHub Content] ⚠️ File Input injection failed:', err);
        }

        // --- Strategy 3: Drag & Drop (Fallback) ---
        try {
            console.log('[ChatHub Content] 🖱️ Strategy 3 (Drag&Drop): Dispatching events...');
            const eventProps = {
                bubbles: true,
                cancelable: true,
                composed: true,
                dataTransfer: dataTransfer,
                view: window
            };

            // Dispatch to target
            targetElement.dispatchEvent(new DragEvent('dragenter', eventProps));
            targetElement.dispatchEvent(new DragEvent('dragover', eventProps));
            targetElement.dispatchEvent(new DragEvent('drop', eventProps));

            // Dispatch to body (global dropzone fallback)
            document.body.dispatchEvent(new DragEvent('dragenter', eventProps));
            document.body.dispatchEvent(new DragEvent('dragover', eventProps));
            document.body.dispatchEvent(new DragEvent('drop', eventProps));

            console.log('[ChatHub Content] ✅ Drag & Drop events dispatched');
            return true;
        } catch (err) {
            console.warn('[ChatHub Content] ⚠️ Drag & Drop simulation failed:', err);
        }

        return false;
    } catch (e) {
        console.error('[ChatHub Content] File upload error:', e);
        return false;
    }
}

/**
 * Helper: Convert Base64 string to File object
 */
function base64ToFile(base64Data: string, filename: string, mimeType: string): File {
    // Remove "data:image/png;base64," prefix if present
    const cleanBase64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;

    const byteCharacters = atob(cleanBase64);
    const byteArrays = [];

    for (let offset = 0; offset < byteCharacters.length; offset += 512) {
        const slice = byteCharacters.slice(offset, offset + 512);
        const byteNumbers = new Array(slice.length);

        for (let i = 0; i < slice.length; i++) {
            byteNumbers[i] = slice.charCodeAt(i);
        }

        const byteArray = new Uint8Array(byteNumbers);
        byteArrays.push(byteArray);
    }

    const blob = new Blob(byteArrays, { type: mimeType });
    return new File([blob], filename, { type: mimeType });
}

/**
 * Aggressive element clicking (including mouse events)
 */
function clickElement(element: HTMLElement) {
    // 1. Dispatch Mouse Events
    const mouseOptions = { bubbles: true, cancelable: true, view: window };
    element.dispatchEvent(new MouseEvent('mousedown', mouseOptions));
    element.dispatchEvent(new MouseEvent('mouseup', mouseOptions));

    // 2. Standard Click
    element.click();
}

/**
 * Simulate Enter key press on an element
 * Enhanced for DeepSeek compatibility
 */
/**
 * Simulate Enter key press on an element
 * Simplified for DeepSeek - complex events interfere with their listeners
 */
async function simulateEnterKey(element: HTMLElement) {
    // Ensure element is focused
    element.focus();
    await new Promise(r => setTimeout(r, 50));

    const eventOptions = {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        bubbles: true,
        cancelable: true,
        composed: true,
        view: window
    };

    // Simple, reliable sequence with anti-bot delays
    element.dispatchEvent(new KeyboardEvent('keydown', eventOptions));
    await randomDelay(15, 35); // Anti-bot: Random delay between key events

    element.dispatchEvent(new KeyboardEvent('keypress', eventOptions));
    await randomDelay(15, 35); // Anti-bot: Random delay between key events

    element.dispatchEvent(new KeyboardEvent('keyup', eventOptions));

    console.log('[ChatHub Content] ↵ Dispatched Enter key events');
}

async function setNativeValue(element: HTMLElement, value: string) {
    if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
        const input = element as HTMLInputElement | HTMLTextAreaElement;
        const lastValue = input.value;

        // CRITICAL: Use native setter from window.HTMLTextAreaElement.prototype or HTMLInputElement.prototype
        // NOT from Object.getPrototypeOf(input) which may be overridden by React/Vue
        if (element.tagName === 'TEXTAREA') {
            const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
            if (nativeSetter) {
                nativeSetter.call(input, value);
            } else {
                input.value = value;
            }
        } else {
            const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
            if (nativeSetter) {
                nativeSetter.call(input, value);
            } else {
                input.value = value;
            }
        }

        // CRITICAL FIX for DeepSeek: Simulate keyboard interaction to trigger framework validation
        input.focus();

        // Dispatch keyboard events to mimic user typing - this triggers DeepSeek's button enable logic
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', code: 'KeyA', bubbles: true }));
        input.dispatchEvent(new KeyboardEvent('keyup', { key: 'a', code: 'KeyA', bubbles: true }));

        // Trigger multiple events for React compatibility
        input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }));
        input.dispatchEvent(new Event('change', { bubbles: true }));

        // React 15/16 hack
        const tracker = (input as any)._valueTracker;
        if (tracker) {
            tracker.setValue(lastValue);
        }

    } else if (element.isContentEditable || element.querySelector('[contenteditable="true"]')) {
        // Find the actual editable element if a wrapper was targeted
        const editableElement = element.isContentEditable ? element : (element.querySelector('[contenteditable="true"]') as HTMLElement);

        console.log('[ChatHub Content] 📋 Using ExecCommand/Paste Simulation strategy');
        editableElement.focus();

        // New Strategy: execCommand is the most reliable way to insert text in contenteditable for all modern frameworks
        // Select all existing content
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(editableElement);
        selection?.removeAllRanges();
        selection?.addRange(range);

        // Try direct replacement via command
        const success = document.execCommand('insertText', false, value);
        
        if (!success) {
            console.log('[ChatHub Content] ⚠️ execCommand failed, falling back to Paste event');
            const dataTransfer = new DataTransfer();
            dataTransfer.setData('text/plain', value);
            const pasteEvent = new ClipboardEvent('paste', {
                clipboardData: dataTransfer,
                bubbles: true,
                cancelable: true,
                composed: true,
            });
            editableElement.dispatchEvent(pasteEvent);
            
            // Wait for paste to process
            await new Promise(r => setTimeout(r, 50));
            
            // Do NOT forcefully wipe innerText because it breaks ProseMirror/Lexical
            if (!editableElement.innerText.includes(value.trim())) {
                console.log('[ChatHub Content] ⚠️ Paste seemingly ignored. Appending via DOM (risky for Prosemirror)');
                // If we must fallback, do it safer
                if (editableElement.querySelector('p')) {
                    const p = editableElement.querySelector('p');
                    if (p) p.innerText = value;
                } else {
                    editableElement.innerText = value;
                }
            }
        }

        // 4. Trigger standard events to notify framework
        editableElement.dispatchEvent(new InputEvent('input', {
            bubbles: true,
            inputType: 'insertText',
            data: value
        }));



        element.dispatchEvent(new Event('change', { bubbles: true }));
    }
}
