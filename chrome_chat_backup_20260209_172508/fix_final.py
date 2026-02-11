#!/usr/bin/env python3
"""Create clean version - correct line numbers"""

# Read the backup file
with open('src/content/index.ts.backup', 'r') as f:
    lines = f.readlines()

# Correct structure:
# Lines 1-215: Keep (everything before duplicate functions)
# Lines 216-253: Skip (both old simulateEnterKey functions)
# Insert: New simplified function
# Lines 254+: Keep (setNativeValue and rest)

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

# Build clean file
new_lines = lines[:215] + [new_function] + lines[253:]

# Write
with open('src/content/index.ts', 'w') as f:
    f.writelines(new_lines)

print(f"Clean file created: {len(new_lines)} lines")
