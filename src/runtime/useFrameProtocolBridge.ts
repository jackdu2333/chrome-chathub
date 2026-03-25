import { useEffect } from 'react';
import { handleContentMessageEvent } from './frameBridge';

export function useFrameProtocolBridge() {
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      handleContentMessageEvent(event);
    };

    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);
}
