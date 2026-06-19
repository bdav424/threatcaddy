import { useEffect, useState, type FormEvent } from 'react';
import { Loader2 } from 'lucide-react';
import { Modal } from '../Common/Modal';
import type { NoteTemplate } from '../../types';

interface NoteTemplateCreatorProps {
  open: boolean;
  categories: string[];
  defaultClsLevel?: string;
  attachInvestigationName?: string;
  onClose: () => void;
  onCreate: (data: Partial<NoteTemplate> & { name: string; content: string }) => Promise<void>;
}

export function NoteTemplateCreator({
  open,
  categories,
  defaultClsLevel,
  attachInvestigationName,
  onClose,
  onCreate,
}: NoteTemplateCreatorProps) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('');
  const [category, setCategory] = useState('Custom');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName('');
    setIcon('');
    setCategory('Custom');
    setDescription('');
    setTags('');
    setContent('');
    setSaving(false);
  }, [open]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !content.trim()) return;
    setSaving(true);
    try {
      const normalizedTags = tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean);
      await onCreate({
        name: name.trim(),
        content: content.trim(),
        category: category.trim() || 'Custom',
        icon: icon.trim() || undefined,
        description: description.trim() || undefined,
        tags: normalizedTags.length > 0 ? normalizedTags : undefined,
        clsLevel: defaultClsLevel,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const inputClass = 'w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-accent';

  return (
    <Modal open={open} onClose={onClose} title="New Note Template" wide>
      <form onSubmit={handleSubmit} className="space-y-3">
        {attachInvestigationName && (
          <div className="rounded-lg border border-accent/30 bg-accent/10 px-3 py-2 text-xs text-accent">
            This template will be saved and attached to {attachInvestigationName}.
          </div>
        )}

        <div className="flex gap-3">
          <div className="flex-1">
            <label htmlFor="new-note-template-name" className="block text-xs font-medium text-gray-400 mb-1">Template name</label>
            <input
              id="new-note-template-name"
              autoFocus
              type="text"
              maxLength={200}
              value={name}
              onChange={(event) => setName(event.target.value)}
              className={inputClass}
              placeholder="Investigation update"
            />
          </div>
          <div className="w-20">
            <label htmlFor="new-note-template-icon" className="block text-xs font-medium text-gray-400 mb-1">Icon</label>
            <input
              id="new-note-template-icon"
              type="text"
              maxLength={10}
              value={icon}
              onChange={(event) => setIcon(event.target.value)}
              className={inputClass}
              placeholder="*"
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="new-note-template-category" className="block text-xs font-medium text-gray-400 mb-1">Category</label>
            <input
              id="new-note-template-category"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className={inputClass}
              placeholder="Custom"
              list="quick-note-template-categories"
            />
            <datalist id="quick-note-template-categories">
              {categories.map((item) => <option key={item} value={item} />)}
            </datalist>
          </div>
          <div>
            <label htmlFor="new-note-template-tags" className="block text-xs font-medium text-gray-400 mb-1">Tags</label>
            <input
              id="new-note-template-tags"
              value={tags}
              onChange={(event) => setTags(event.target.value)}
              className={inputClass}
              placeholder="update, review"
            />
          </div>
        </div>

        <div>
          <label htmlFor="new-note-template-description" className="block text-xs font-medium text-gray-400 mb-1">Description</label>
          <input
            id="new-note-template-description"
            type="text"
            maxLength={500}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className={inputClass}
            placeholder="Reusable note structure for a recurring workflow"
          />
        </div>

        <div>
          <label htmlFor="new-note-template-content" className="block text-xs font-medium text-gray-400 mb-1">Template content</label>
          <textarea
            id="new-note-template-content"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            className={`${inputClass} h-64 resize-y font-mono text-xs`}
            placeholder="# Template Title&#10;&#10;## Overview&#10;&#10;## Details&#10;&#10;## Next Steps"
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-200 text-sm"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || !name.trim() || !content.trim()}
            className="px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white text-sm font-medium disabled:opacity-50 flex items-center gap-2"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {saving ? 'Saving...' : 'Save template'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
