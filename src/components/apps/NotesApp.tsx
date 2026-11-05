import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { FileText, Folder, Search } from 'lucide-react';
import { BLOG_POSTS, NOTE_FOLDERS, type NoteFolderId } from '@/lib/blogPosts';

type CollectionId = 'notes' | NoteFolderId;

export const NotesApp = () => {
  const [selectedCollection, setSelectedCollection] = useState<CollectionId>('notes');
  const [activeId, setActiveId] = useState<string | null>(BLOG_POSTS[0]?.id ?? null);
  const [query, setQuery] = useState('');
  const active = BLOG_POSTS.find(p => p.id === activeId);
  const collections = [
    {
      id: 'notes' as const,
      name: 'Notes',
      icon: FileText,
      count: BLOG_POSTS.filter(note => !note.folderId).length,
    },
    ...NOTE_FOLDERS.map(folder => ({
      ...folder,
      icon: Folder,
      count: BLOG_POSTS.filter(note => note.folderId === folder.id).length,
    })),
  ];

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const noteId = detail?.payload?.noteId;
      if (detail?.appId === 'notes' && typeof noteId === 'string') {
        const note = BLOG_POSTS.find(post => post.id === noteId);
        if (note) {
          setSelectedCollection(note.folderId ?? 'notes');
          setActiveId(note.id);
        }
      }
    };
    window.addEventListener('spotlight:open', handler);
    return () => window.removeEventListener('spotlight:open', handler);
  }, []);

  const notesInCollection = BLOG_POSTS.filter(note =>
    selectedCollection === 'notes' ? !note.folderId : note.folderId === selectedCollection
  );
  const filtered = notesInCollection.filter(
    note => !query || note.title.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="h-full w-full flex overflow-hidden bg-[#1c1c1e] text-neutral-100">
      <aside className="w-44 shrink-0 bg-[#19181a] border-r border-white/5">
        <div className="px-2 pt-12">
          <div className="px-2 pb-2 text-[11px] font-semibold text-neutral-500">Folders</div>
          <div className="space-y-0.5">
            {collections.map(collection => {
              const Icon = collection.icon;
              return (
                <button
                  key={collection.id}
                  onClick={() => {
                    setSelectedCollection(collection.id);
                    setQuery('');
                    setActiveId(collection.id === 'notes' ? BLOG_POSTS[0]?.id ?? null : null);
                  }}
                  className={`w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors ${
                    selectedCollection === collection.id ? 'bg-white/10 text-white' : 'text-neutral-300 hover:bg-white/5'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
                  <span className="flex-1 truncate">{collection.name}</span>
                  <span className="text-[10px] text-neutral-500">{collection.count}</span>
                </button>
              );
            })}
          </div>
        </div>
      </aside>

      <aside className="w-72 shrink-0 bg-[#1f1e21] border-r border-white/5 flex flex-col">
        <div className="flex items-center gap-2 px-3 pt-2.5 pb-2.5">
          <div className="flex-1 flex items-center gap-2 px-2 py-1 rounded-md bg-white/5 min-w-0">
            <Search className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search"
              className="flex-1 bg-transparent outline-none text-xs text-white placeholder-neutral-500 min-w-0"
            />
          </div>
        </div>
        <div className="flex-1 overflow-auto">
          {filtered.length ? filtered.map(note => (
              <button
                key={note.id}
                onClick={() => setActiveId(note.id)}
                className={`w-full text-left px-4 py-2.5 border-b border-white/5 transition-colors ${
                  activeId === note.id ? 'bg-yellow-700/30' : 'hover:bg-white/5'
                }`}
              >
                <div className="font-semibold text-[13px] text-white truncate">{note.title}</div>
                <div className="flex gap-2 mt-0.5 text-[11px] text-neutral-400">
                  <span>{note.date}</span>
                  <span className="truncate">{note.preview}</span>
                </div>
              </button>
            )) : (
              <div className="px-4 py-8 text-center text-xs text-neutral-500">
                {query ? 'No matching notes' : 'No notes in this folder yet'}
              </div>
            )}
        </div>
      </aside>

      {/* Editor / Markdown view */}
      <div className="flex-1 overflow-auto bg-[#1c1c1e]">
        {active ? (
          <div className="max-w-2xl mx-auto px-10 pt-12 pb-10">
            <div className="text-[11px] text-neutral-500 mb-4 text-center">{active.date}</div>
            <article className="prose prose-invert max-w-none prose-headings:text-white prose-p:text-neutral-200 prose-a:text-blue-400 prose-code:text-emerald-300 prose-code:bg-white/10 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none prose-pre:bg-black/60 prose-pre:text-neutral-100 prose-blockquote:border-yellow-500 prose-blockquote:text-neutral-300">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{active.content}</ReactMarkdown>
            </article>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-xs text-neutral-500">
            Select a note to read it
          </div>
        )}
      </div>
    </div>
  );
};
