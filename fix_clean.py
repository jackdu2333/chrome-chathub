#!/usr/bin/env python3
"""Create clean version of index.ts with single simulateEnterKey function"""

# Read the backup file
with open('src/content/index.ts.backup', 'r') as f:
    lines = f.readlines()

# The file has duplicate simulateEnterKey functions at lines 216 and 225
# We need to:
# 1. Keep lines 1-215 (everything before first function)
# 2. Skip lines 216-224 (first incomplete function definition)  
# 3. Keep lines 225-266 (second complete function) BUT replace it with simplified version
# 4. Keep lines 267+ (rest of file)

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

# Build clean file: lines 1-215, skip 216-266, add new function, then 267+
new_lines = lines[:215] + [new_function] + lines[266:]

# Write the new file
with open('src/content/index.ts', 'w') as f:
    f.writelines(new_lines)

print("Successfully created clean index.ts")
