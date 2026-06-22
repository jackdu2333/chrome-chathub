/**
 * Broadcasts a message to all iframes that match our known bot URLs.
 * In a real extension, we might use runtime.connect, but postMessage is simpler for this structure.
 */
export function broadcastMessage(type: string, payload: unknown) {
    const iframes = document.querySelectorAll('iframe');
    iframes.forEach(iframe => {
        if (iframe.contentWindow) {
            iframe.contentWindow.postMessage({ type, payload }, '*');
        }
    });
}
