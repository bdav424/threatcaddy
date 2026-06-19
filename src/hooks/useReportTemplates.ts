import { useState, useEffect, useCallback, useMemo } from 'react';
import { db } from '../db';
import type { ReportTemplate, ReportSection } from '../types';
import { BUILTIN_REPORT_TEMPLATES } from '../lib/builtin-report-templates';
import { nanoid } from 'nanoid';

export function useReportTemplates() {
  const [userTemplates, setUserTemplates] = useState<ReportTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  const loadTemplates = useCallback(async () => {
    const all = await db.reportTemplates.toArray();
    setUserTemplates(all);
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadTemplates();
  }, [loadTemplates]);

  const allTemplates = useMemo(
    () => [...BUILTIN_REPORT_TEMPLATES, ...userTemplates],
    [userTemplates],
  );

  const createTemplate = useCallback(
    async (partial: Pick<ReportTemplate, 'name' | 'category'> & Partial<ReportTemplate>): Promise<ReportTemplate> => {
      const now = Date.now();
      const template: ReportTemplate = {
        id: nanoid(),
        name: partial.name,
        description: partial.description,
        icon: partial.icon,
        category: partial.category || 'Custom',
        sections: partial.sections ?? [],
        source: 'user',
        createdAt: now,
        updatedAt: now,
      };
      await db.reportTemplates.add(template);
      await loadTemplates();
      return template;
    },
    [loadTemplates],
  );

  const updateTemplate = useCallback(
    async (id: string, updates: Partial<Omit<ReportTemplate, 'id' | 'source' | 'createdAt'>>) => {
      await db.reportTemplates.update(id, { ...updates, updatedAt: Date.now() });
      await loadTemplates();
    },
    [loadTemplates],
  );

  const deleteTemplate = useCallback(
    async (id: string) => {
      await db.reportTemplates.delete(id);
      await loadTemplates();
    },
    [loadTemplates],
  );

  const addSection = useCallback(
    async (templateId: string, section: Omit<ReportSection, 'id' | 'order'>) => {
      const tmpl = userTemplates.find(t => t.id === templateId);
      if (!tmpl) return;
      const newSection: ReportSection = {
        id: nanoid(),
        order: tmpl.sections.length,
        ...section,
      };
      await updateTemplate(templateId, { sections: [...tmpl.sections, newSection] });
    },
    [userTemplates, updateTemplate],
  );

  const categories = useMemo(
    () => [...new Set(allTemplates.map(t => t.category))].sort(),
    [allTemplates],
  );

  return {
    allTemplates,
    userTemplates,
    loading,
    categories,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    addSection,
    reload: loadTemplates,
  };
}
