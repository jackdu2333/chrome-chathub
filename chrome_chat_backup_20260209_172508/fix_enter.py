#!/usr/bin/env python3
"""Replace the simulateEnterKey function with simplified version"""

# Read the backup file
with open('src/content/index.ts.backup', 'r') as f:
    lines = f.readlines()

# New simplified function
new_function = '''/**
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

    // Simple, reliable sequence - tested working on DeepSeek
    // Complex events (beforeinput, composition, delays) interfere with DeepSeek's listeners
    element.dispatchEvent(new KeyboardEvent('keydown', eventOptions));
    element.dispatchEvent(new KeyboardEvent('keypress', eventOptions));
    element.dispatchEvent(new KeyboardEvent('keyup', eventOptions));

    console.log('[ChatHub Content] ↵ Dispatched Enter key events');
}
'''

# Replace lines 216-266 (0-indexed: 215-265)
new_lines = lines[:215] + [new_function + '\n'] + lines[266:]

# Write the new file
with open('src/content/index.ts', 'w') as f:
    f.writelines(new_lines)

print("Successfully replaced simulateEnterKey function")
