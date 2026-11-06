export interface ContactLink {
  label: string;
  url: string;
}

export type ContactPublicationStatus = 'published' | 'unpublished';

export interface ContactRecord {
  id: string;
  name: string;
  photoUrl?: string;
  role?: string;
  organization?: string;
  email?: string;
  phone?: string;
  website?: ContactLink;
  socialProfiles?: ContactLink[];
  collaborationNotes?: string;
  publicationStatus: ContactPublicationStatus;
}

// Only approved public contact records belong in this client-side list.
export const CONTACTS: readonly ContactRecord[] = [
  {
    id: 'miss-editaire',
    name: 'Miss Editaire',
    email: 'maindesk@misseditaire.com',
    publicationStatus: 'published',
  },
];