'use client';

import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function ExtensionBridge() {
  useEffect(() => {
    const initializeBridge = async () => {
      try {
        // Get the current session
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.access_token) {
          return;
        }

        // Send token to extension via window.postMessage
        window.postMessage(
          {
            type: 'DEMOFRAME_SEND_TOKEN',
            token: session.access_token,
          },
          '*'
        );

        // Listen for confirmation (optional, for debugging)
        const handleMessage = (event: MessageEvent) => {
          if (event.data.type === 'DEMOFRAME_TOKEN_STORED') {
            console.log('[DemoFrame] Extension received auth token');
          }
        };

        window.addEventListener('message', handleMessage);

        return () => {
          window.removeEventListener('message', handleMessage);
        };
      } catch (error) {
        console.error('[DemoFrame] Failed to initialize extension bridge:', error);
      }
    };

    initializeBridge();
  }, []);

  return null; // This component doesn't render anything
}
