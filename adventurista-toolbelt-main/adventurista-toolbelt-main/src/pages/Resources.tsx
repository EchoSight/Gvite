import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { CampaignResource } from '@/lib/types';
import { getResources, addResource, deleteResource } from '@/lib/store';
import { Plus, X, Tag, FileText, Map, BookOpen, ScrollText } from 'lucide-react';

const typeIcons: Record<string, typeof FileText> = {
  map: Map,
  lore: BookOpen,
  rules: ScrollText,
  handout: FileText,
};

export default function Resources() {
  const [resources, setResources] = useState<CampaignResource[]>([]);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [content, setContent] = useState('');
  const [type, setType] = useState<CampaignResource['type']>('rules');
  const [tags, setTags] = useState('');
  const [filterTag, setFilterTag] = useState('all');

  useEffect(() => {
    setResources(getResources());
  }, []);

  const allTags = Array.from(new Set(resources.flatMap(r => r.tags)));

  const filtered = filterTag === 'all' ? resources : resources.filter(r => r.tags.includes(filterTag));

  const handleAdd = () => {
    if (!title.trim()) return;
    const res: CampaignResource = {
      id: `res-${Date.now()}`,
      title: title.trim(),
      description: desc.trim(),
      content: content.trim(),
      type,
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
      createdAt: new Date().toISOString(),
    };
    addResource(res);
    setResources(getResources());
    setTitle(''); setDesc(''); setContent(''); setTags('');
    setAdding(false);
  };

  const handleDelete = (id: string) => {
    deleteResource(id);
    setResources(getResources());
  };

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-lg text-foreground">CAMPAIGN RESOURCES</h1>
          <p className="text-[11px] text-muted-foreground uppercase tracking-widest">{resources.length} ASSET{resources.length !== 1 ? 'S' : ''} INDEXED</p>
        </div>
        <motion.button
          onClick={() => setAdding(!adding)}
          className="tactical-card py-2 px-4 flex items-center gap-2 text-[11px] uppercase tracking-widest font-bold"
          whileTap={{ scale: 0.98 }}
        >
          {adding ? <><X className="w-3 h-3" /> CANCEL</> : <><Plus className="w-3 h-3" /> ADD RESOURCE</>}
        </motion.button>
      </div>

      {/* Tag filter */}
      {allTags.length > 0 && (
        <div className="flex gap-1 mb-4 flex-wrap">
          <button
            onClick={() => setFilterTag('all')}
            className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded-sm transition-colors ${
              filterTag === 'all' ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            ALL
          </button>
          {allTags.map(tag => (
            <button
              key={tag}
              onClick={() => setFilterTag(tag)}
              className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded-sm transition-colors flex items-center gap-1 ${
                filterTag === tag ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Tag className="w-2 h-2" /> {tag}
            </button>
          ))}
        </div>
      )}

      {/* Add form */}
      {adding && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="tactical-card mb-4 space-y-3"
        >
          <div className="grid grid-cols-12 gap-2">
            <div className="col-span-8">
              <label className="stat-label block mb-1">TITLE</label>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full bg-transparent font-mono text-sm text-foreground outline-none border-b border-border pb-1 placeholder:text-muted-foreground/50"
                placeholder="Resource title..."
              />
            </div>
            <div className="col-span-4">
              <label className="stat-label block mb-1">TYPE</label>
              <select
                value={type}
                onChange={e => setType(e.target.value as any)}
                className="w-full bg-transparent font-mono text-sm text-foreground outline-none"
              >
                <option value="rules" className="bg-card">Rules</option>
                <option value="lore" className="bg-card">Lore</option>
                <option value="map" className="bg-card">Map</option>
                <option value="handout" className="bg-card">Handout</option>
              </select>
            </div>
          </div>
          <div>
            <label className="stat-label block mb-1">DESCRIPTION</label>
            <input
              value={desc}
              onChange={e => setDesc(e.target.value)}
              className="w-full bg-transparent font-mono text-sm text-foreground outline-none border-b border-border pb-1 placeholder:text-muted-foreground/50"
              placeholder="Brief description..."
            />
          </div>
          <div>
            <label className="stat-label block mb-1">CONTENT</label>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              rows={3}
              className="w-full bg-transparent font-mono text-sm text-foreground outline-none border border-border rounded-sm p-2 placeholder:text-muted-foreground/50 resize-none"
              placeholder="Resource content..."
            />
          </div>
          <div>
            <label className="stat-label block mb-1">TAGS (comma separated)</label>
            <input
              value={tags}
              onChange={e => setTags(e.target.value)}
              className="w-full bg-transparent font-mono text-sm text-foreground outline-none border-b border-border pb-1 placeholder:text-muted-foreground/50"
              placeholder="rules, combat, starter"
            />
          </div>
          <motion.button
            onClick={handleAdd}
            disabled={!title.trim()}
            className="w-full text-center text-[11px] uppercase tracking-widest font-bold border border-border rounded-sm py-2 hover:bg-foreground hover:text-background transition-colors disabled:opacity-30"
            whileTap={{ scale: 0.98 }}
          >
            REGISTER RESOURCE
          </motion.button>
        </motion.div>
      )}

      {/* Resource list */}
      <div className="space-y-1">
        {filtered.map(res => {
          const Icon = typeIcons[res.type] || FileText;
          return (
            <motion.div
              key={res.id}
              className="tactical-card"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <div className="flex items-start gap-3">
                <Icon className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-sm text-foreground">{res.title}</h3>
                    <button
                      onClick={() => handleDelete(res.id)}
                      className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                    >
                      <X className="w-3 h-3" />
                      <span className="sr-only">DELETE</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{res.description}</p>
                  <p className="font-body text-sm text-foreground/80 mt-2">{res.content}</p>
                  <div className="flex gap-1 mt-2">
                    {res.tags.map(tag => (
                      <span key={tag} className="text-[9px] uppercase tracking-wider text-muted-foreground bg-muted px-1.5 py-0.5 rounded-sm">
                        {tag}
                      </span>
                    ))}
                    <span className="text-[9px] uppercase tracking-wider text-tactical-blue ml-auto">{res.type}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
