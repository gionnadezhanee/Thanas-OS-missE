import { useEffect, useRef, type ReactNode } from 'react';
import mailIcon from '@/assets/mail-icon.svg';

// Placeholder until a newsletter provider is connected; it collects and sends nothing.
export const NewsletterSignupComingSoon = () => (
  <div className="rounded-xl border border-black/10 bg-black/[0.03] p-3 dark:border-white/10 dark:bg-white/[0.04]">
    <div className="flex items-center gap-2">
      <label htmlFor="newsletter-email" className="sr-only">Email address</label>
      <input
        id="newsletter-email"
        type="email"
        disabled
        placeholder="Email address"
        className="min-w-0 flex-1 cursor-not-allowed rounded-md border border-black/10 bg-white/60 px-2.5 py-1.5 text-[13px] opacity-60 outline-none dark:border-white/10 dark:bg-white/5"
      />
      <button
        type="button"
        disabled
        className="cursor-not-allowed rounded-md bg-blue-500 px-3 py-1.5 text-[13px] font-medium text-white opacity-50"
      >
        Subscribe
      </button>
    </div>
    <p role="status" className="mt-2 text-[12px] text-neutral-500 dark:text-neutral-400">
      Coming soon. Signup isn’t open yet, and nothing you type here is collected or sent.
    </p>
  </div>
);

export const MailInvitation = ({
  onDismiss,
  signup = <NewsletterSignupComingSoon />,
}: {
  onDismiss: () => void;
  signup?: ReactNode;
}) => {
  const dismissRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    dismissRef.current?.focus();
  }, []);

  return (
    <div
      className="absolute inset-0 z-30 flex items-start justify-center bg-black/25 px-4 pt-10"
      onClick={onDismiss}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="mail-invitation-title"
        onClick={event => event.stopPropagation()}
        className="w-[440px] max-w-full animate-fade-in rounded-2xl bg-white/90 p-6 text-neutral-900 shadow-2xl ring-1 ring-black/10 backdrop-blur-2xl dark:bg-neutral-800/90 dark:text-neutral-100 dark:ring-white/10"
      >
        <div className="flex flex-col items-center text-center">
          <img src={mailIcon} alt="" className="h-14 w-14" />
          <h2 id="mail-invitation-title" className="mt-3 text-[17px] font-semibold">
            Join Miss Editaire’s mailing list
          </h2>
          <p className="mt-1.5 text-[13px] leading-relaxed text-neutral-600 dark:text-neutral-300">
            Subscribers receive future newsletters from Miss Editaire straight to their email inbox.
          </p>
        </div>

        <div className="mt-4">{signup}</div>

        <div className="mt-4 flex justify-end">
          <button
            ref={dismissRef}
            type="button"
            onClick={onDismiss}
            className="rounded-md bg-neutral-200 px-4 py-1.5 text-[13px] font-medium text-neutral-900 transition-colors hover:bg-neutral-300 dark:bg-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-600"
          >
            Not Now
          </button>
        </div>
      </div>
    </div>
  );
};
