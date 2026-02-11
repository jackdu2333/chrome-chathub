/**
 * Smart CSS Selector Detection for Chat Interfaces
 * Automatically detects input fields and submit buttons on chat websites
 */

export interface DetectedSelectors {
    inputSelector: string;
    submitSelector: string;
    confidence: number; // 0-100
}

/**
 * Detects chat input field using heuristic rules
 */
export function detectInputSelector(): string | null {
    const candidates: Array<{ element: HTMLElement; score: number; selector: string }> = [];

    // Strategy 1: Find textareas
    const textareas = Array.from(document.querySelectorAll('textarea')) as HTMLTextAreaElement[];
    textareas.forEach(textarea => {
        if (textarea.offsetWidth === 0 || textarea.offsetHeight === 0) return;

        let score = 50;
        const rect = textarea.getBoundingClientRect();

        // Prefer elements near bottom of page
        if (rect.bottom > window.innerHeight * 0.7) score += 20;

        // Prefer larger textareas
        if (rect.width > 300) score += 15;
        if (rect.height > 40) score += 10;

        // Check for chat-related attributes
        const placeholder = textarea.placeholder?.toLowerCase() || '';
        if (placeholder.includes('message') || placeholder.includes('chat') ||
            placeholder.includes('输入') || placeholder.includes('发送')) {
            score += 20;
        }

        // Generate selector
        const selector = generateSelector(textarea);
        candidates.push({ element: textarea as HTMLElement, score, selector });
    });

    // Strategy 2: Find contenteditable divs
    const editableDivs = Array.from(document.querySelectorAll('div[contenteditable="true"]')) as HTMLDivElement[];
    editableDivs.forEach(div => {
        if (div.offsetWidth === 0 || div.offsetHeight === 0) return;

        let score = 40;
        const rect = div.getBoundingClientRect();

        // Prefer elements near bottom
        if (rect.bottom > window.innerHeight * 0.7) score += 20;

        // Check for role attribute
        if (div.getAttribute('role') === 'textbox') score += 25;

        // Check for data attributes (React/Vue frameworks)
        if (div.hasAttribute('data-slate-editor')) score += 15;
        if (div.hasAttribute('data-lexical-editor')) score += 15;

        const selector = generateSelector(div);
        candidates.push({ element: div, score, selector });
    });

    // Sort by score and return best match
    candidates.sort((a, b) => b.score - a.score);

    if (candidates.length > 0 && candidates[0].score > 60) {
        return candidates[0].selector;
    }

    return null;
}

/**
 * Detects submit button using heuristic rules
 */
export function detectSubmitSelector(inputElement?: HTMLElement): string | null {
    const candidates: Array<{ element: HTMLElement; score: number; selector: string }> = [];

    // Find all buttons and clickable elements
    const buttons = Array.from(document.querySelectorAll('button, div[role="button"], [class*="send"], [class*="submit"]')) as HTMLElement[];

    buttons.forEach(btn => {
        if (btn.offsetWidth === 0 || btn.offsetHeight === 0) return;

        let score = 30;
        const rect = btn.getBoundingClientRect();

        // Prefer buttons near the input element
        if (inputElement) {
            const inputRect = inputElement.getBoundingClientRect();
            const distance = Math.abs(rect.left - inputRect.right) + Math.abs(rect.top - inputRect.top);
            if (distance < 100) score += 30;
            if (distance < 50) score += 20;
        }

        // Check text content
        const text = btn.textContent?.toLowerCase() || '';
        const ariaLabel = btn.getAttribute('aria-label')?.toLowerCase() || '';
        if (text.includes('send') || text.includes('submit') || text.includes('发送') || text.includes('提交')) {
            score += 25;
        }
        if (ariaLabel.includes('send') || ariaLabel.includes('submit') || ariaLabel.includes('发送')) {
            score += 25;
        }

        // Check for send icon (SVG with arrow)
        const svg = btn.querySelector('svg');
        if (svg) {
            const svgHTML = svg.innerHTML.toLowerCase();
            // Common patterns for send/arrow icons
            if (svgHTML.includes('path') && (
                svgHTML.includes('m12') ||
                svgHTML.includes('arrow') ||
                btn.querySelector('[data-icon-type*="send"]') ||
                btn.querySelector('[class*="arrow"]')
            )) {
                score += 20;
            }
        }

        // Check for blue/primary color (common for send buttons)
        const style = window.getComputedStyle(btn);
        const bgColor = style.backgroundColor;
        if (bgColor.includes('rgb(0, 82, 255)') || // Qwen blue
            bgColor.includes('rgb(25, 118, 210)') || // Standard blue
            bgColor.includes('rgb(16, 163, 127)')) { // Claude green
            score += 15;
        }

        // Prefer circular/icon-only buttons
        if (rect.width > 30 && rect.width < 60 && Math.abs(rect.width - rect.height) < 10) {
            score += 10;
        }

        // Prefer buttons near bottom-right
        if (rect.bottom > window.innerHeight * 0.7 && rect.right > window.innerWidth * 0.7) {
            score += 15;
        }

        const selector = generateSelector(btn);
        candidates.push({ element: btn, score, selector });
    });

    // Sort by score and return best match
    candidates.sort((a, b) => b.score - a.score);

    if (candidates.length > 0 && candidates[0].score > 50) {
        return candidates[0].selector;
    }

    return null;
}

/**
 * Generates a unique and stable CSS selector for an element
 */
function generateSelector(element: HTMLElement): string {
    // Try ID first (most stable)
    if (element.id) {
        return `#${element.id}`;
    }

    // Try unique class combinations
    if (element.className) {
        const classes = element.className.split(/\s+/).filter(c => c && !c.includes(':')).slice(0, 3);
        if (classes.length > 0) {
            const classSelector = `${element.tagName.toLowerCase()}.${classes.join('.')}`;
            // Verify uniqueness
            if (document.querySelectorAll(classSelector).length === 1) {
                return classSelector;
            }
        }
    }

    // Try data attributes (common in React/Vue)
    const dataAttrs = Array.from(element.attributes).filter(attr =>
        attr.name.startsWith('data-') && !attr.name.includes('reactid')
    );
    if (dataAttrs.length > 0) {
        const attr = dataAttrs[0];
        const attrSelector = `${element.tagName.toLowerCase()}[${attr.name}="${attr.value}"]`;
        if (document.querySelectorAll(attrSelector).length === 1) {
            return attrSelector;
        }
    }

    // Fallback: use tag + class combination
    const classes = element.className.split(/\s+/).filter(c => c).slice(0, 2);
    if (classes.length > 0) {
        return `${element.tagName.toLowerCase()}.${classes.join('.')}`;
    }

    return element.tagName.toLowerCase();
}

/**
 * Main detection function - detects both selectors
 */
export function detectSelectors(): DetectedSelectors | null {
    console.log('[SelectorDetector] Starting auto-detection...');

    const inputSelector = detectInputSelector();
    if (!inputSelector) {
        console.log('[SelectorDetector] Failed to detect input selector');
        return null;
    }

    console.log('[SelectorDetector] Detected input:', inputSelector);

    const inputElement = document.querySelector(inputSelector) as HTMLElement;
    const submitSelector = detectSubmitSelector(inputElement);

    if (!submitSelector) {
        console.log('[SelectorDetector] Failed to detect submit selector');
        return null;
    }

    console.log('[SelectorDetector] Detected submit:', submitSelector);

    // Calculate confidence based on selector quality
    let confidence = 70;
    if (inputSelector.startsWith('#')) confidence += 15; // ID is very stable
    if (submitSelector.startsWith('#')) confidence += 15;

    return {
        inputSelector,
        submitSelector,
        confidence: Math.min(confidence, 100)
    };
}
