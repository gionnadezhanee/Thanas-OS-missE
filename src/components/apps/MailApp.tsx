import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { Archive, ArchiveX, FileText, Flag, Inbox, Maximize2, Search, Send, Trash2, type LucideIcon } from 'lucide-react';
import { useMacOS } from '@/contexts/MacOSContext';
import type { WindowState } from '@/types/macos';
import {
  MAILBOXES,
  dismissMailInvitation,
  getMailboxMessages,
  getMessageSearchText,
  getPublishedMessage,
  parseMailDate,
  safeImageSrc,
  safeLinkHref,
  shouldShowMailInvitation,
  type MailboxId,
  type MailMessage,
} from '@/lib/mail';
import { MailInvitation } from './MailInvitation';

const MAILBOX_ICONS: Record<MailboxId, LucideIcon> = {
  inbox: Inbox,
  flagged: Flag,
  drafts: FileText,
  sent: Send,
  archive: Archive,
  junk: ArchiveX,
  trash: Trash2,
};

const EXPANDED_WINDOW_SIZE = { width: 760, height: 660 };

// Which messages this visitor has opened. It lives in memory only and is shared by every Mail window.
let readSnapshot: ReadonlySet<string> = new Set();
const readListeners = new Set<() => void>();
const markMessageRead = (id: string) => {
  if (readSnapshot.has(id)) return;
  readSnapshot = new Set(readSnapshot).add(id);
  readListeners.forEach(listener => listener());
};
const subscribeToReadState = (listener: () => void) => {
  readListeners.add(listener);
  return () => { readListeners.delete(listener); };
};
const useReadIds = () => useSyncExternalStore(subscribeToReadState, () => readSnapshot);
const isUnread = (message: MailMessage, readIds: ReadonlySet<string>) => !!message.unread && !readIds.has(message.id);

// Shared between the reading pane and expanded windows so a message reopens where it was left.
const scrollPositions = new Map<string, number>();

const formatShortDate = (date: string) =>
  parseMailDate(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const formatLongDate = (date: string) =>
  parseMailDate(date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

const MessageScroller = ({ messageId, children }: { messageId: string; children: ReactNode }) => {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (ref.current) ref.current.scrollTop = scrollPositions.get(messageId) ?? 0;
  }, [messageId]);
  return (
    <div
      ref={ref}
      onScroll={event => scrollPositions.set(messageId, event.currentTarget.scrollTop)}
      className="h-full overflow-auto thin-scrollbar"
    >
      {children}
    </div>
  );
};

// Renders structured blocks only; message content is never injected as HTML.
const MessageBody = ({ message }: { message: MailMessage }) => (
  <div className="space-y-3 text-[14px] leading-relaxed">
    {message.content.map((block, index) => {
      switch (block.type) {
        case 'heading':
          return <h2 key={index} className="pt-2 text-[17px] font-semibold">{block.text}</h2>;
        case 'paragraph':
          return <p key={index} className="whitespace-pre-line">{block.text}</p>;
        case 'link': {
          const href = safeLinkHref(block.href);
          return (
            <p key={index}>
              {href
                ? <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">{block.text}</a>
                : block.text}
            </p>
          );
        }
        case 'image': {
          const src = safeImageSrc(block.src);
          if (!src) return null;
          return (
            <figure key={index}>
              <img src={src} alt={block.alt} loading="lazy" className="h-auto max-w-full rounded-md" />
              {block.caption && (
                <figcaption className="mt-1 text-[12px] text-neutral-500 dark:text-neutral-400">{block.caption}</figcaption>
              )}
            </figure>
          );
        }
      }
    })}
  </div>
);

const MessageHeader = ({ message, onExpand }: { message: MailMessage; onExpand?: () => void }) => (
  <div className="flex items-start gap-3 border-b border-black/10 px-6 py-4 dark:border-white/10">
    <div
      aria-hidden="true"
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-neutral-300 to-neutral-400 text-[15px] font-semibold text-white"
    >
      {message.sender.charAt(0)}
    </div>
    <div className="min-w-0 flex-1">
      <div className="flex items-baseline justify-between gap-3">
        <span className="truncate text-[14px] font-semibold">{message.sender}</span>
        <time dateTime={message.date} className="shrink-0 text-[12px] text-neutral-500 dark:text-neutral-400">
          {formatLongDate(message.date)}
        </time>
      </div>
      <h1 className="mt-0.5 text-[15px] font-semibold leading-snug">{message.subject}</h1>
    </div>
    {onExpand && (
      <button
        type="button"
        onClick={onExpand}
        aria-label="Open in separate window"
        title="Open in separate window"
        className="shrink-0 rounded-md p-1.5 text-neutral-500 transition-colors hover:bg-black/5 dark:text-neutral-400 dark:hover:bg-white/10"
      >
        <Maximize2 className="h-4 w-4" aria-hidden="true" />
      </button>
    )}
  </div>
);

const EmptyState = ({ title, hint }: { title: string; hint?: string }) => (
  <div className="flex h-full items-center justify-center px-4 text-center">
    <div>
      <p className="text-[15px] font-semibold text-neutral-400 dark:text-neutral-500">{title}</p>
      {hint && <p className="mt-1 text-[12px] text-neutral-400 dark:text-neutral-500">{hint}</p>}
    </div>
  </div>
);

const MailBrowser = () => {
  const { openApp } = useMacOS();
  const readIds = useReadIds();
  const [mailbox, setMailbox] = useState<MailboxId>('inbox');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showInvitation, setShowInvitation] = useState(shouldShowMailInvitation);
  const [compact, setCompact] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const observer = new ResizeObserver(([entry]) => setCompact(entry.contentRect.width < 720));
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  const normalizedQuery = query.trim().toLowerCase();
  const mailboxMessages = useMemo(() => getMailboxMessages(mailbox), [mailbox]);
  const visibleMessages = useMemo(
    () => (normalizedQuery ? mailboxMessages.filter(message => getMessageSearchText(message).includes(normalizedQuery)) : mailboxMessages),
    [mailboxMessages, normalizedQuery],
  );
  const selected = visibleMessages.find(message => message.id === selectedId) ?? null;

  useEffect(() => {
    if (selected) markMessageRead(selected.id);
  }, [selected]);

  const unreadIn = (id: MailboxId) => getMailboxMessages(id).filter(message => isUnread(message, readIds)).length;
  const mailboxLabel = MAILBOXES.find(box => box.id === mailbox)?.label ?? 'Inbox';
  const unreadHere = unreadIn(mailbox);

  const selectMailbox = (id: MailboxId) => {
    setMailbox(id);
    setSelectedId(null);
  };

  const openExpanded = (messageId: string) =>
    openApp('mail', { newWindow: true, messageId, size: EXPANDED_WINDOW_SIZE });

  const dismissInvitation = () => {
    dismissMailInvitation();
    setShowInvitation(false);
  };

  const onListKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const index = visibleMessages.findIndex(message => message.id === selectedId);
    const nextIndex = event.key === 'ArrowDown' ? Math.min(index + 1, visibleMessages.length - 1) : Math.max(index - 1, 0);
    const target = visibleMessages[nextIndex];
    if (!target) return;
    setSelectedId(target.id);
    listRef.current?.querySelector<HTMLElement>(`[data-message-id="${target.id}"]`)?.focus();
  };

  return (
    <div
      ref={rootRef}
      className="relative flex h-full w-full overflow-hidden bg-white text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100"
    >
      {!compact && (
        <aside className="flex w-[176px] shrink-0 flex-col border-r border-black/5 bg-neutral-200/70 pt-12 backdrop-blur-xl dark:border-white/5 dark:bg-neutral-900/70">
          <div className="px-4 pb-1 text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">Mailboxes</div>
          <nav aria-label="Mailboxes" className="space-y-0.5 px-2">
            {MAILBOXES.map(box => {
              const Icon = MAILBOX_ICONS[box.id];
              const count = unreadIn(box.id);
              const active = box.id === mailbox;
              return (
                <button
                  key={box.id}
                  type="button"
                  onClick={() => selectMailbox(box.id)}
                  aria-current={active ? 'page' : undefined}
                  className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] transition-colors ${
                    active
                      ? 'bg-neutral-300/70 dark:bg-neutral-700/60'
                      : 'hover:bg-neutral-300/50 dark:hover:bg-neutral-800/60'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0 text-blue-500" aria-hidden="true" />
                  <span className="flex-1 truncate">{box.label}</span>
                  {count > 0 && (
                    <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                      <span className="sr-only">{count} unread</span>
                      <span aria-hidden="true">{count}</span>
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </aside>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <div
          className={`flex shrink-0 items-center justify-between gap-3 border-b border-black/10 py-2 pr-3 dark:border-white/10 ${
            compact ? 'pl-[88px]' : 'pl-4'
          }`}
        >
          <div className="min-w-0">
            {compact ? (
              <select
                aria-label="Mailbox"
                value={mailbox}
                onChange={event => selectMailbox(event.target.value as MailboxId)}
                className="max-w-full rounded-md bg-transparent text-[14px] font-semibold outline-none dark:bg-neutral-900"
              >
                {MAILBOXES.map(box => <option key={box.id} value={box.id}>{box.label}</option>)}
              </select>
            ) : (
              <h1 className="truncate text-[15px] font-semibold">{mailboxLabel}</h1>
            )}
            <div className="text-[11px] text-neutral-500 dark:text-neutral-400">
              {visibleMessages.length} message{visibleMessages.length === 1 ? '' : 's'}
              {unreadHere > 0 && `, ${unreadHere} unread`}
            </div>
          </div>
          <div className="flex w-44 shrink-0 items-center gap-1.5 rounded-md bg-black/5 px-2 py-1 dark:bg-white/10">
            <Search className="h-3.5 w-3.5 shrink-0 text-neutral-500 dark:text-neutral-400" aria-hidden="true" />
            <input
              type="search"
              aria-label="Search mail"
              placeholder="Search"
              value={query}
              onChange={event => setQuery(event.target.value)}
              className="min-w-0 flex-1 bg-transparent text-[12px] outline-none placeholder:text-neutral-400"
            />
          </div>
        </div>

        <div className="flex min-h-0 flex-1">
          <div
            ref={listRef}
            onKeyDown={onListKeyDown}
            className="w-[38%] min-w-[220px] max-w-[320px] shrink-0 overflow-auto border-r border-black/10 thin-scrollbar dark:border-white/10"
          >
            {visibleMessages.length === 0 ? (
              <EmptyState
                title={normalizedQuery ? 'No Results' : 'No Messages'}
                hint={normalizedQuery ? 'Check the spelling or try a new search.' : undefined}
              />
            ) : (
              visibleMessages.map(message => {
                const isSelected = message.id === selected?.id;
                const unread = isUnread(message, readIds);
                return (
                  <button
                    key={message.id}
                    type="button"
                    data-message-id={message.id}
                    onClick={() => setSelectedId(message.id)}
                    onDoubleClick={() => openExpanded(message.id)}
                    aria-current={isSelected ? 'true' : undefined}
                    className={`relative block w-full border-b border-black/5 py-2.5 pl-6 pr-3 text-left transition-colors dark:border-white/5 ${
                      isSelected ? 'bg-blue-500 text-white' : 'hover:bg-black/5 dark:hover:bg-white/5'
                    }`}
                  >
                    {unread && (
                      <>
                        <span className="sr-only">Unread. </span>
                        <span
                          aria-hidden="true"
                          className={`absolute left-2 top-4 h-2 w-2 rounded-full ${isSelected ? 'bg-white' : 'bg-blue-500'}`}
                        />
                      </>
                    )}
                    <div className="flex items-baseline justify-between gap-2">
                      <span className={`truncate text-[13px] ${unread ? 'font-semibold' : 'font-medium'}`}>{message.sender}</span>
                      <span className={`shrink-0 text-[11px] ${isSelected ? 'text-white/80' : 'text-neutral-500 dark:text-neutral-400'}`}>
                        {formatShortDate(message.date)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="truncate text-[13px]">{message.subject}</span>
                      {message.flagged && <Flag className="h-3 w-3 shrink-0 text-orange-500" aria-label="Flagged" />}
                    </div>
                    <p className={`mt-0.5 line-clamp-2 text-[12px] ${isSelected ? 'text-white/80' : 'text-neutral-500 dark:text-neutral-400'}`}>
                      {message.preview}
                    </p>
                  </button>
                );
              })
            )}
          </div>

          <section aria-label="Message" className="min-w-0 flex-1">
            {selected ? (
              <MessageScroller key={selected.id} messageId={selected.id}>
                <MessageHeader message={selected} onExpand={() => openExpanded(selected.id)} />
                <div className="px-6 py-5">
                  <MessageBody message={selected} />
                </div>
              </MessageScroller>
            ) : (
              <EmptyState title="No Message Selected" />
            )}
          </section>
        </div>
      </div>

      {showInvitation && <MailInvitation onDismiss={dismissInvitation} />}
    </div>
  );
};

const ExpandedMessageWindow = ({ messageId }: { messageId: string }) => {
  const message = getPublishedMessage(messageId);

  useEffect(() => {
    if (message) markMessageRead(message.id);
  }, [message]);

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-white text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100">
      <div className="shrink-0 border-b border-black/10 py-2.5 pl-[88px] pr-4 dark:border-white/10">
        <div className="truncate text-[13px] font-semibold">{message?.subject ?? 'Message Unavailable'}</div>
      </div>
      {message ? (
        <div className="min-h-0 flex-1">
          <MessageScroller key={message.id} messageId={message.id}>
            <MessageHeader message={message} />
            <div className="px-8 py-6">
              <MessageBody message={message} />
            </div>
          </MessageScroller>
        </div>
      ) : (
        <EmptyState title="Message Unavailable" />
      )}
    </div>
  );
};

export const MailApp = ({ window: appWindow }: { window?: WindowState }) =>
  appWindow?.messageId ? <ExpandedMessageWindow messageId={appWindow.messageId} /> : <MailBrowser />;
