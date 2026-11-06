import { useMemo, useState, type ReactNode } from 'react';
import { ExternalLink, Globe, Mail, Phone, Search, User } from 'lucide-react';
import { CONTACTS, type ContactRecord } from '@/lib/contacts';

const PINNED_CONTACT_ID = 'miss-editaire';
const CONTACT_LETTERS = Array.from({ length: 26 }, (_, index) => String.fromCharCode(65 + index));

export const ContactApp = () => {
  const [query, setQuery] = useState('');
  const [activeView, setActiveView] = useState<'contact' | 'directory'>('contact');
  const [selectedContactId, setSelectedContactId] = useState(PINNED_CONTACT_ID);
  const publishedContacts = useMemo(
    () => CONTACTS.filter(contact => contact.publicationStatus === 'published'),
    []
  );
  const pinnedContact = publishedContacts.find(contact => contact.id === PINNED_CONTACT_ID);
  const allContacts = useMemo(
    () => publishedContacts
      .filter(contact => contact.id !== PINNED_CONTACT_ID)
      .slice()
      .sort((first, second) => first.name.localeCompare(second.name)),
    [publishedContacts]
  );
  const normalizedQuery = query.trim().toLowerCase();
  const directoryContacts = useMemo(
    () => publishedContacts
      .filter(contact => contact.name.toLowerCase().includes(normalizedQuery))
      .slice()
      .sort((first, second) => first.name.localeCompare(second.name)),
    [publishedContacts, normalizedQuery]
  );
  const directorySections = useMemo(() => {
    const contactsByLetter = new Map(CONTACT_LETTERS.map(letter => [letter, [] as ContactRecord[]]));
    directoryContacts.forEach(contact => {
      const firstLetter = contact.name.trim().charAt(0).toUpperCase();
      contactsByLetter.get(firstLetter)?.push(contact);
    });
    return CONTACT_LETTERS.map(letter => ({
      letter,
      contacts: contactsByLetter.get(letter) ?? [],
    }));
  }, [directoryContacts]);
  const showPinnedContact = !!pinnedContact && pinnedContact.name.toLowerCase().includes(normalizedQuery);
  const filteredContacts = useMemo(() => {
    return allContacts.filter(contact => contact.name.toLowerCase().includes(normalizedQuery));
  }, [allContacts, normalizedQuery]);
  const selectedContact = publishedContacts.find(contact => contact.id === selectedContactId);

  const showAllContacts = () => {
    setQuery('');
    setSelectedContactId(pinnedContact?.id ?? '');
    setActiveView('directory');
  };

  const selectContact = (contactId: string) => {
    setSelectedContactId(contactId);
    setActiveView('contact');
  };

  const renderContact = (contact: ContactRecord) => (
    <button
      key={contact.id}
      type="button"
      onClick={() => selectContact(contact.id)}
      aria-current={selectedContactId === contact.id ? 'true' : undefined}
      className={`mb-0.5 w-full truncate rounded-lg px-3 py-2 text-left text-[13px] transition-colors ${
        selectedContactId === contact.id ? 'bg-white/15 text-white' : 'text-white/80 hover:bg-white/10'
      }`}
    >
      {contact.name}
    </button>
  );

  return (
    <div
      className="relative h-full w-full overflow-hidden text-white"
      style={{
        backgroundImage: 'url(/images/contacts-pink-halftone.jpeg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      <div className="relative z-10 flex h-full min-h-0 flex-col sm:flex-row">
        <aside
          className="flex max-h-56 w-full shrink-0 flex-col border-b border-white/25 sm:max-h-none sm:w-56 sm:border-b-0 sm:border-r"
          style={{
            background: 'rgba(28, 20, 42, 0.14)',
            backdropFilter: 'blur(8px) saturate(125%)',
            WebkitBackdropFilter: 'blur(8px) saturate(125%)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2), inset -1px 0 0 rgba(255,255,255,0.08)',
          }}
        >
          <div className="px-3 pb-3 pt-10">
            <div className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-wider text-white/55">Contacts</div>
            <button
              type="button"
              onClick={showAllContacts}
              aria-current={activeView === 'directory' ? 'page' : undefined}
              className={`w-full rounded-lg px-3 py-2 text-left text-[13px] font-medium text-white transition-colors ${
                activeView === 'directory' ? 'bg-white/20 ring-1 ring-white/25' : 'bg-white/15 hover:bg-white/20'
              }`}
            >
              All Contacts
            </button>
          </div>

          <div className="mx-3 mb-2 flex items-center gap-2 rounded-md border border-white/10 bg-white/10 px-2.5 py-1.5">
            <Search className="h-3.5 w-3.5 shrink-0 text-white/55" aria-hidden="true" />
            <input
              type="search"
              aria-label="Search contacts by name"
              placeholder="Search"
              value={query}
              onChange={event => setQuery(event.target.value)}
              className="min-w-0 flex-1 bg-transparent text-[12px] text-white outline-none placeholder:text-white/45"
            />
          </div>

          <div className="min-h-0 flex-1 overflow-auto px-2 pb-3">
            {showPinnedContact && (
              <section className="mb-3">
                <h2 className="px-3 py-1 text-[10px] font-semibold tracking-wider text-white/65">PINNED</h2>
                {renderContact(pinnedContact)}
              </section>
            )}
            <section>
              <h2 className="px-3 py-1 text-[10px] font-semibold tracking-wider text-white/65">ALL CONTACTS</h2>
              {filteredContacts.length > 0 ? filteredContacts.map(renderContact) : (
                <div className="px-3 py-3 text-[12px] text-white/55">
                  {normalizedQuery ? 'No contacts found' : 'No other contacts yet'}
                </div>
              )}
            </section>
          </div>
        </aside>

        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto no-scrollbar pb-8">
          {activeView === 'directory' ? (
            <div className="relative mx-auto w-full max-w-4xl px-6 pb-8 pt-8 sm:px-10">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-2 top-5 bottom-8 rounded-2xl"
                style={{
                  background: 'linear-gradient(145deg, rgba(255,177,209,0.2), rgba(126,28,79,0.16))',
                  backdropFilter: 'blur(2px) saturate(115%)',
                  WebkitBackdropFilter: 'blur(2px) saturate(115%)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.25), inset 0 -1px 0 rgba(58,8,35,0.08)',
                }}
              />
              <div className="relative z-10">
                <h1 className="mb-5 text-[22px] font-semibold text-white drop-shadow-sm">All Contacts</h1>
                <div className="grid grid-cols-1 gap-y-1">
                  {directorySections.map(({ letter, contacts }) => (
                    <section key={letter} className="min-w-0">
                      <h2
                        className="border-b border-white/25 py-1 text-[11px] font-semibold tracking-wider text-white"
                        style={{ textShadow: '0 1px 2px rgba(0,0,0,0.55)' }}
                      >
                        {letter}
                      </h2>
                      <div className="min-h-8 py-1">
                        {contacts.map(contact => (
                          <button
                            key={contact.id}
                            type="button"
                            onClick={() => selectContact(contact.id)}
                            className="w-full truncate rounded-md px-3 py-2 text-left text-[13px] text-white transition-colors hover:bg-white/15"
                            style={{ textShadow: '0 1px 2px rgba(0,0,0,0.55)' }}
                          >
                            {contact.name}
                          </button>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              </div>
            </div>
          ) : selectedContact ? <ContactCard contact={selectedContact} /> : (
            <div className="flex h-full items-center justify-center px-6 text-center text-sm text-white/65">
              No published contacts
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

const ContactCard = ({ contact }: { contact: ContactRecord }) => {
  const actions = [
    ...(contact.phone ? [{ label: 'Call', href: `tel:${contact.phone}`, icon: <Phone className="h-6 w-6" strokeWidth={2.4} /> }] : []),
    ...(contact.email ? [{ label: 'Email', href: `mailto:${contact.email}`, icon: <Mail className="h-6 w-6" strokeWidth={2.4} /> }] : []),
    ...(contact.website ? [{ label: contact.website.label, href: contact.website.url, icon: <Globe className="h-6 w-6" strokeWidth={2.2} /> }] : []),
    ...(contact.socialProfiles ?? []).map(profile => ({
      label: profile.label,
      href: profile.url,
      icon: <ExternalLink className="h-6 w-6" strokeWidth={2.2} />,
    })),
  ];

  return (
    <div className="mx-auto w-full max-w-3xl pb-8">
      <div className="flex flex-col items-center px-4 pt-10 sm:pt-16">
        <div
          className="h-[132px] w-[132px] overflow-hidden rounded-full ring-1 ring-white/20 shadow-2xl"
          style={{
            background: 'rgba(255,255,255,0.08)',
            backdropFilter: 'blur(30px) saturate(180%)',
            WebkitBackdropFilter: 'blur(30px) saturate(180%)',
          }}
        >
          {contact.photoUrl ? (
            <img src={contact.photoUrl} alt={contact.name} className="h-full w-full object-cover" />
          ) : (
            <div role="img" aria-label={`${contact.name} profile photo placeholder`} className="flex h-full w-full items-center justify-center text-white/70">
              <User className="h-14 w-14" aria-hidden="true" />
            </div>
          )}
        </div>

        <h1 className="mt-4 text-center text-[34px] font-bold leading-tight drop-shadow-lg sm:text-[44px]">
          {contact.name}
        </h1>
        {(contact.role || contact.organization) && (
          <div className="mt-1 text-center text-[14px] text-white/80">
            {[contact.role, contact.organization].filter(Boolean).join(' · ')}
          </div>
        )}
      </div>

      {actions.length > 0 && (
        <div className="mt-6 flex flex-wrap justify-center gap-4 px-4">
          {actions.map(action => (
            <GlassCircle key={`${action.label}:${action.href}`} href={action.href} label={action.label}>
              {action.icon}
            </GlassCircle>
          ))}
        </div>
      )}

      {(contact.email || contact.phone || contact.website) && (
        <div className="mx-4 mt-6">
          <GlassPanel className="divide-y divide-white/10">
            {contact.phone && <Field label="phone" value={contact.phone} href={`tel:${contact.phone}`} right={<Phone className="h-5 w-5 text-yellow-400" />} />}
            {contact.email && <Field label="email" value={contact.email} href={`mailto:${contact.email}`} right={<Mail className="h-5 w-5 text-yellow-400" />} />}
            {contact.website && <Field label={contact.website.label.toLowerCase()} value={contact.website.label} href={contact.website.url} right={<Globe className="h-5 w-5 text-yellow-400" />} />}
          </GlassPanel>
        </div>
      )}

      {contact.socialProfiles && contact.socialProfiles.length > 0 && (
        <div className="mx-4 mt-4">
          <GlassPanel className="divide-y divide-white/10">
            {contact.socialProfiles.map(profile => (
              <Field key={profile.url} label={profile.label.toLowerCase()} value={profile.label} href={profile.url} right={<ExternalLink className="h-5 w-5 text-yellow-400" />} />
            ))}
          </GlassPanel>
        </div>
      )}

      {contact.collaborationNotes && (
        <div className="mx-4 mt-4">
          <GlassPanel className="p-4">
            <div className="mb-1 text-[13px] font-medium text-yellow-400">Collaboration</div>
            <p className="text-[14px] leading-relaxed">{contact.collaborationNotes}</p>
          </GlassPanel>
        </div>
      )}
    </div>
  );
};

const GlassCircle = ({ children, href, label }: { children: ReactNode; href: string; label: string }) => {
  const external = href.startsWith('http');
  return (
    <a
      href={href}
      aria-label={label}
      title={label}
      target={external ? '_blank' : undefined}
      rel={external ? 'noreferrer' : undefined}
      className="flex h-16 w-16 items-center justify-center rounded-full transition-transform active:scale-95"
      style={{
        background: 'rgba(255,255,255,0.10)',
        backdropFilter: 'blur(30px) saturate(180%)',
        WebkitBackdropFilter: 'blur(30px) saturate(180%)',
        border: '1px solid rgba(255,255,255,0.18)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.25), inset 0 -1px 0 rgba(0,0,0,0.18), 0 8px 24px rgba(0,0,0,0.25)',
      }}
    >
      {children}
    </a>
  );
};

const GlassPanel = ({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) => (
  <div
    className={`rounded-2xl ${className}`}
    style={{
      background: 'rgba(255,255,255,0.1)',
      backdropFilter: 'blur(12px) saturate(125%)',
      WebkitBackdropFilter: 'blur(12px) saturate(125%)',
      border: '1px solid rgba(255,255,255,0.18)',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2), 0 8px 24px rgba(0,0,0,0.12)',
    }}
  >
    {children}
  </div>
);

const Field = ({ label, value, right, href }: { label: string; value: string; right?: ReactNode; href: string }) => {
  const external = href.startsWith('http');
  return (
  <a
    href={href}
    target={external ? '_blank' : undefined}
    rel={external ? 'noreferrer' : undefined}
    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/5"
  >
    <div className="flex-1 min-w-0">
      <div className="text-[13px] text-yellow-400 font-medium leading-tight mb-0.5">
        {label}
      </div>
      <div className="text-[18px] leading-tight truncate">{value}</div>
    </div>
    {right}
  </a>
  );
};
