import { useEffect, useRef, useState } from 'react';
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
  const scrollRef = useRef<HTMLDivElement>(null);
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
    <section aria-label="Pinterest Moodboard" className="relative h-[172px] w-[172px] shrink-0 overflow-hidden rounded-3xl text-white" style={widgetGlass}>
      <div ref={scrollRef} className="relative h-full overflow-y-auto overflow-x-hidden px-2">
        {status !== 'ready' && (
          <div className="absolute inset-0 flex items-center justify-center px-4 text-center text-xs text-white/75" role="status">
            {status === 'loading' ? 'Loading moodboard...' : 'Moodboard unavailable.'}
          </div>
        )}
        <div className="flex min-h-full justify-center">
          <div ref={embedRef} className={`m-auto ${status === 'ready' ? '' : 'invisible'}`} />
        </div>
      </div>
      <a
        href={PROFILE_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Open Miss Editaire's Pinterest profile in a new tab"
        className="absolute inset-0 z-10 cursor-pointer rounded-3xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-white"
        onWheel={event => {
          if (scrollRef.current) scrollRef.current.scrollTop += event.deltaY;
        }}
        onKeyDown={event => {
          if (!scrollRef.current) return;
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            scrollRef.current.scrollTop += event.key === 'ArrowDown' ? 40 : -40;
          }
        }}
      />
    </section>
  );
};