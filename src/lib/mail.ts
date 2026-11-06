export type MailboxId = 'inbox' | 'flagged' | 'drafts' | 'sent' | 'archive' | 'junk' | 'trash';

export type MailContentBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'heading'; text: string }
  | { type: 'image'; src: string; alt: string; caption?: string }
  | { type: 'link'; text: string; href: string };

export interface MailMessage {
  id: string;
  mailbox: Exclude<MailboxId, 'flagged'>;
  sender: string;
  subject: string;
  preview: string;
  date: string;
  featured?: boolean;
  flagged?: boolean;
  unread?: boolean;
  published: boolean;
  content: MailContentBlock[];
}

export const MAIL_MESSAGES: readonly MailMessage[] = [
  {
    id: 'welcome',
    mailbox: 'inbox',
    sender: 'Miss Editaire',
    subject: 'You’re Invited 💌',
    preview: 'A little invitation to future correspondence.',
    date: '2026-11-06',
    featured: true,
    unread: true,
    published: true,
    content: [
      { type: 'paragraph', text: 'Hello, and welcome to my inbox.' },
      { type: 'paragraph', text: 'I hope to share future newsletters with you here and, eventually, by email. Subscription signup is coming soon.' },
      { type: 'paragraph', text: 'Until then, thank you for stopping by.' },
      { type: 'paragraph', text: 'Miss Editaire' },
    ],
  },
];

export const MAILBOXES: readonly { id: MailboxId; label: string }[] = [
  { id: 'inbox', label: 'Inbox' },
  { id: 'flagged', label: 'Flagged' },
  { id: 'drafts', label: 'Drafts' },
  { id: 'sent', label: 'Sent' },
  { id: 'archive', label: 'Archive' },
  { id: 'junk', label: 'Junk' },
  { id: 'trash', label: 'Trash' },
];

// Unpublished messages never leave this module.
const publishedMessages = MAIL_MESSAGES.filter(message => message.published);

// Flagged is a filter over the other mailboxes, not a separate collection.
export const getMailboxMessages = (mailbox: MailboxId): MailMessage[] =>
  publishedMessages
    .filter(message => (mailbox === 'flagged' ? message.flagged : message.mailbox === mailbox))
    .sort((a, b) => Number(!!b.featured) - Number(!!a.featured) || b.date.localeCompare(a.date));

export const getPublishedMessage = (id: string) => publishedMessages.find(message => message.id === id);

export const getMessageSearchText = (message: MailMessage) =>
  [
    message.sender,
    message.subject,
    message.preview,
    ...message.content.map(block => (block.type === 'image' ? `${block.alt} ${block.caption ?? ''}` : block.text)),
  ].join(' ').toLowerCase();

// Built from local components so a date-only value never shifts with the visitor's timezone.
export const parseMailDate = (date: string) => {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day);
};

export const safeLinkHref = (href: string) => {
  try {
    const url = new URL(href);
    return url.protocol === 'https:' || url.protocol === 'mailto:' ? url.href : null;
  } catch {
    return null;
  }
};

export const safeImageSrc = (src: string) => {
  if (src.startsWith('/') && !src.startsWith('//')) return src;
  return safeLinkHref(src)?.startsWith('https:') ? src : null;
};

const INVITATION_KEY = 'mail-invitation-dismissed-at';
const INVITATION_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000;
let invitationDismissedThisVisit = false;

// Only records that the invitation was dismissed; it says nothing about subscription.
export const shouldShowMailInvitation = () => {
  if (invitationDismissedThisVisit) return false;
  try {
    const dismissedAt = Number(localStorage.getItem(INVITATION_KEY));
    return !(dismissedAt > 0 && Date.now() - dismissedAt < INVITATION_COOLDOWN_MS);
  } catch {
    return true;
  }
};

export const dismissMailInvitation = () => {
  invitationDismissedThisVisit = true;
  try {
    localStorage.setItem(INVITATION_KEY, String(Date.now()));
  } catch { /* storage unavailable; the in-memory flag still covers this visit */ }
};