import { useEffect, useMemo, useState } from 'react';
import { FileText, Search, X } from 'lucide-react';
import { Modal } from '../Common/Modal';
import type { NoteTemplate } from '../../types';
import { cn } from '../../lib/utils';

interface InvestigationTemplatePickerProps {
  open: boolean;
  templates: NoteTemplate[];
  selectedTemplateIds: string[];
  investigationName?: string;
  onClose: () => void;
  onSave: (templateIds: string[]) => void | Promise<void>;
}

export function InvestigationTemplatePicker({
  open,
  templates,
  selectedTemplateIds,
  investigationName,
  onClose,
  onSave,
}: InvestigationTemplatePickerProps) {
  const [draftIds, setDraftIds] = useState<string[]>(selectedTemplateIds);
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDraftIds(selectedTemplateIds);
    setQuery('');
  }, [open, selectedTemplateIds]);

  const selectedSet = useMemo(() => new Set(draftIds), [draftIds]);
  const normalizedQuery = query.trim().toLowerCase();

  const filteredTemplates = useMemo(() => {
    return templates
      .filter((template) => {
        if (!normalizedQuery) return true;
        return [
          template.name,
          template.description,
          template.category,
          ...(template.tags ?? []),
        ].some((value) => value?.toLowerCase().includes(normalizedQuery));
      })
      .sort((a, b) => {
        if (a.source !== b.source) return a.source === 'user' ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
  }, [normalizedQuery, templates]);

  const groupedTemplates = useMemo(() => {
    const groups = new Map<string, NoteTemplate[]>();
    for (const template of filteredTemplates) {
      const label = template.source === 'user' ? 'Your templates' : template.source === 'team' ? 'Team templates' : 'Built-in templates';
      groups.set(label, [...(groups.get(label) ?? []), template]);
    }
    return Array.from(groups.entries());
  }, [filteredTemplates]);

  const toggleTemplate = (templateId: string) => {
    setDraftIds((current) =>
      current.includes(templateId)
        ? current.filter((id) => id !== templateId)
        : [...current, templateId],
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(draftIds);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={investigationName ? `Templates for ${investigationName}` : 'Investigation templates'}
      wide
    >
      <div className="space-y-4">
        <div className="flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2">
          <Search size={15} className="shrink-0 text-gray-500" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="min-w-0 flex-1 bg-transparent text-sm text-gray-200 placeholder:text-gray-500 focus:outline-none"
            placeholder="Find a template"
            autoFocus
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="rounded p-1 text-gray-500 hover:bg-gray-700 hover:text-gray-300"
              aria-label="Clear template search"
              title="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="max-h-[46vh] space-y-4 overflow-y-auto pe-1">
          {groupedTemplates.length === 0 ? (
            <div className="rounded-lg border border-gray-700 bg-gray-800/50 px-4 py-8 text-center text-sm text-gray-500">
              No templates match this search.
            </div>
          ) : (
            groupedTemplates.map(([label, groupTemplates]) => (
              <section key={label} className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</h3>
                  <span className="text-[10px] text-gray-600">{groupTemplates.length}</span>
                </div>
                <div className="space-y-1.5">
                  {groupTemplates.map((template) => {
                    const checked = selectedSet.has(template.id);
                    return (
                      <label
                        key={template.id}
                        className={cn(
                          'flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 transition-colors',
                          checked
                            ? 'border-accent/50 bg-accent/10'
                            : 'border-gray-700 bg-gray-800/40 hover:border-gray-600 hover:bg-gray-800',
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleTemplate(template.id)}
                          className="h-4 w-4 rounded border-gray-600 bg-gray-900 text-accent focus:ring-accent"
                        />
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-gray-900 text-sm text-gray-300">
                          {template.icon || <FileText size={15} />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium text-gray-200">{template.name}</div>
                          <div className="truncate text-xs text-gray-500">
                            {template.description || template.category || 'Note template'}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </section>
            ))
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-800 pt-3">
          <span className="text-xs text-gray-500">
            {draftIds.length === 0
              ? 'No templates attached.'
              : `${draftIds.length} template${draftIds.length === 1 ? '' : 's'} attached.`}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-gray-700 px-4 py-2 text-sm text-gray-200 hover:bg-gray-600"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save templates'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
