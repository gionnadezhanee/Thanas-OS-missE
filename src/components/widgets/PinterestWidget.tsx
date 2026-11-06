import { useEffect, useRef, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { widgetGlass } from './widgetGlass';

const PROFILE_URL = 'https://www.pinterest.com/misseditaire/';
const SCRIPT_URL = 'https://assets.pinterest.com/js/pinit.js';

type PinterestWindow = Window & { PinUtils?: { build: () => void } };

let scriptPromise: Promise<void> | undefined;

const loadPinterestScript = () => {
  if ((window as PinterestWindow).PinUtils) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_URL}"]`);
    const script = existing ?? document.createElement('script');
    script.addEventListener('load', () => resolve(), { once: true });
    script.addEventListener('error', () => reject(new Error('Pinterest script unavailable')), { once: true });
    if (!existing) {
      script.src = SCRIPT_URL;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
  });
  return scriptPromise;
};

export const PinterestWidget = () => {
  const embedRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading');

  useEffect(() => {
    const container = embedRef.current;
    if (!container) return;

    let active = true;
    const anchor = document.createElement('a');
    anchor.href = PROFILE_URL;
    anchor.dataset.pinDo = 'embedUser';
    anchor.dataset.pinBoardWidth = '130';
    anchor.dataset.pinScaleHeight = '60';
    anchor.dataset.pinScaleWidth = '60';
    container.appendChild(anchor);

    const observer = new MutationObserver(() => {
      if (container.querySelector('iframe, [data-pin-log="embed_user_ft"]')) {
        setStatus('ready');
      }
    });
    observer.observe(container, { childList: true, subtree: true });
    const timeout = window.setTimeout(() => {
      if (active) setStatus(current => current === 'ready' ? current : 'unavailable');
    }, 12000);

    loadPinterestScript().then(() => {
      if (!active) return;
      const pinterest = (window as PinterestWindow).PinUtils;
      if (pinterest) pinterest.build();
    }).catch(() => {
      if (active) setStatus('unavailable');
    });

    return () => {
      active = false;
      window.clearTimeout(timeout);
      observer.disconnect();
      container.replaceChildren();
    };
  }, []);

  return (
    <section aria-label="Pinterest Moodboard" className="flex h-[172px] w-[172px] shrink-0 flex-col overflow-hidden rounded-3xl text-white" style={widgetGlass}>
      <div className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2 pt-2">
        {status !== 'ready' && (
          <div className="absolute inset-0 flex items-center justify-center px-4 text-center text-xs text-white/75" role="status">
            {status === 'loading' ? 'Loading moodboard...' : 'Moodboard unavailable.'}
          </div>
        )}
        <div className="flex min-h-full justify-center">
          <div ref={embedRef} className={`m-auto ${status === 'ready' ? '' : 'invisible'}`} />
        </div>
      </div>
      <a href={PROFILE_URL} target="_blank" rel="noopener noreferrer" className="flex shrink-0 items-center justify-center gap-1 pb-1.5 pt-1 text-[10px] text-white/90 hover:text-white" title="Open Miss Editaire's Pinterest profile">
        Open profile <ExternalLink className="h-3 w-3" aria-hidden="true" />
      </a>
    </section>
  );
};