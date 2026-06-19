import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Circle, CheckCircle2, Calendar, Trash2, GripVertical, MessageSquare, Archive, RotateCcw, Search, CheckSquare, Square, AlertTriangle, ChevronDown } from 'lucide-react';
import type { Task, Priority, InvestigationMember } from '../../types';
import { PRIORITY_COLORS } from '../../types';
import { ConfirmDialog } from '../Common/ConfirmDialog';
import { ClsBadge } from '../Common/ClsBadge';
import { TagPills } from '../Common/TagPills';
import { isOverdue, cn, currentLocale } from '../../lib/utils';

interface TaskItemProps {
  task: Task;
  onToggleComplete: (id: string) => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onTrash?: (id: string) => void;
  onRestore?: (id: string) => void;
  onToggleArchive?: (id: string) => void;
  onUpdateTask?: (id: string, updates: Partial<Task>) => void;
  active?: boolean;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  members?: InvestigationMember[];
  compact?: boolean;
}

const PRIORITY_KEYS: Record<Priority, string> = {
  none: '',
  low: 'priority.low',
  medium: 'priority.medium',
  high: 'priority.high',
};

export const TaskItem = React.memo(function TaskItem({ task, onToggleComplete, onSelect, onDelete, onTrash, onRestore, onToggleArchive, onUpdateTask, active, draggable, onDragStart, members, compact }: TaskItemProps) {
  const { t } = useTranslation('tasks');
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [checklistOpen, setChecklistOpen] = useState(() => Boolean(compact && (task.checklist?.length ?? 0) > 0));
  const checklistUserToggledRef = useRef(false);
  const overdue = isOverdue(task.dueDate) && !task.completed;
  const assignee = task.assigneeId && members ? members.find((m) => m.userId === task.assigneeId) : undefined;
  const hasChecklist = (task.checklist?.length ?? 0) > 0;
  const displayTitle = task.title || t('item.untitled');

  useEffect(() => {
    if (compact && hasChecklist && !checklistUserToggledRef.current) {
      setChecklistOpen(true);
    }
  }, [compact, hasChecklist]);

  const toggleChecklistItem = (itemId: string) => {
    if (!task.checklist || !onUpdateTask) return;
    const updated = task.checklist.map(c => c.id === itemId ? { ...c, done: !c.done } : c);
    onUpdateTask(task.id, { checklist: updated });
  };

  return (
    <div className="relative">
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors group',
        compact && 'items-start gap-1.5 rounded-[8px] px-2 py-1.5',
        active
          ? 'bg-accent/10 border-accent/30'
          : 'bg-bg-raised border-border-subtle hover:bg-bg-hover hover:border-border-medium',
        overdue && 'border-red-500/30',
        checklistOpen && 'rounded-b-none'
      )}
      draggable={draggable}
      onDragStart={onDragStart}
    >
      {draggable && (
        <GripVertical size={14} className="text-gray-600 cursor-grab shrink-0" />
      )}

      <button
        onClick={(e) => { e.stopPropagation(); onToggleComplete(task.id); }}
        className={cn('shrink-0', compact && 'pt-0.5', task.completed ? 'text-green-400' : 'text-gray-500 hover:text-gray-300')}
        title={task.completed ? t('item.markIncomplete') : t('item.markComplete')}
      >
        {task.completed ? <CheckCircle2 size={compact ? 16 : 18} /> : <Circle size={compact ? 16 : 18} />}
      </button>

      <button
        onClick={() => onSelect(task.id)}
        className="min-w-0 flex-1 text-start"
        title={displayTitle}
      >
        <span
          className={cn(
            'block text-sm',
            compact ? 'line-clamp-2 whitespace-normal break-words text-xs leading-4' : 'truncate',
            task.completed ? 'text-gray-500 line-through' : 'text-gray-200',
          )}
        >
          {displayTitle}
        </span>
      </button>

      <div className={cn('flex shrink-0 items-center gap-2', compact && 'max-w-[46%] flex-wrap justify-end gap-1')}>
        {hasChecklist && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              checklistUserToggledRef.current = true;
              setChecklistOpen(!checklistOpen);
            }}
            className={cn(
              'flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded transition-colors',
              checklistOpen
                ? 'text-accent bg-accent/15'
                : 'text-gray-400 bg-gray-700/50 hover:bg-gray-700 hover:text-gray-300'
            )}
            title={t('item.toggleChecklist')}
            data-task-checklist-toggle="true"
          >
            <CheckSquare size={10} />
            {task.checklist!.filter(c => c.done).length}/{task.checklist!.length}
            <ChevronDown size={8} className={cn('ms-0.5 transition-transform', checklistOpen && 'rotate-180')} />
          </button>
        )}
        {(task.iocAnalysis?.iocs.filter((i) => !i.dismissed).length ?? 0) > 0 && (
          <span className="flex items-center gap-0.5 text-[10px] text-accent bg-accent/10 px-1.5 py-0.5 rounded">
            <Search size={9} />
            {task.iocAnalysis?.iocs.filter((i) => !i.dismissed).length}
          </span>
        )}
        {(task.comments?.length ?? 0) > 0 && (
          <span className="flex items-center gap-0.5 text-[10px] text-gray-400 bg-gray-700/50 px-1.5 py-0.5 rounded">
            <MessageSquare size={10} />
            {task.comments?.length}
          </span>
        )}
        {assignee && (
          <span
            className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400"
            title={assignee.displayName}
          >
            {assignee.displayName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)}
          </span>
        )}
        {task.priority !== 'none' && (
          <span
            className="text-[10px] font-medium px-1.5 py-0.5 rounded"
            style={{ backgroundColor: PRIORITY_COLORS[task.priority] + '20', color: PRIORITY_COLORS[task.priority] }}
          >
            {t(PRIORITY_KEYS[task.priority])}
          </span>
        )}
        {task.clsLevel && <ClsBadge level={task.clsLevel} />}
        {task.dueDate && (
          <span className={cn('flex items-center gap-1 text-[10px]', overdue ? 'text-red-400 font-medium' : 'text-gray-500')}>
            {overdue ? <AlertTriangle size={10} /> : <Calendar size={10} />}
            {new Date(task.dueDate).toLocaleDateString(currentLocale(), { month: 'short', day: 'numeric' })}
          </span>
        )}
        {!compact && <TagPills tags={task.tags} />}
        {task.trashed ? (
          <>
            {onRestore && (
              <button
                onClick={(e) => { e.stopPropagation(); onRestore(task.id); }}
                className="opacity-40 group-hover:opacity-100 group-focus-within:opacity-100 p-1 rounded hover:bg-gray-700 text-gray-500 hover:text-green-400"
                title={t('item.restoreTask')}
              >
                <RotateCcw size={12} />
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); setShowConfirmDelete(true); }}
              className="opacity-40 group-hover:opacity-100 group-focus-within:opacity-100 p-1 rounded hover:bg-gray-700 text-gray-500 hover:text-red-400"
              title={t('item.deletePermanently')}
            >
              <Trash2 size={12} />
            </button>
          </>
        ) : (
          <>
            {onToggleArchive && (
              <button
                onClick={(e) => { e.stopPropagation(); onToggleArchive(task.id); }}
                className="opacity-40 group-hover:opacity-100 group-focus-within:opacity-100 p-1 rounded hover:bg-gray-700 text-gray-500 hover:text-gray-300"
                title={task.archived ? t('item.unarchive') : t('item.archive')}
              >
                <Archive size={12} />
              </button>
            )}
            {onTrash ? (
              <button
                onClick={(e) => { e.stopPropagation(); onTrash(task.id); }}
                className="opacity-40 group-hover:opacity-100 group-focus-within:opacity-100 p-1 rounded hover:bg-gray-700 text-gray-500 hover:text-red-400"
                title={t('item.moveToTrash')}
              >
                <Trash2 size={12} />
              </button>
            ) : (
              <button
                onClick={(e) => { e.stopPropagation(); setShowConfirmDelete(true); }}
                className="opacity-40 group-hover:opacity-100 group-focus-within:opacity-100 p-1 rounded hover:bg-gray-700 text-gray-500 hover:text-red-400"
                title={t('item.deleteTask')}
              >
                <Trash2 size={12} />
              </button>
            )}
          </>
        )}
      </div>

      <ConfirmDialog
        open={showConfirmDelete}
        onClose={() => setShowConfirmDelete(false)}
        onConfirm={() => onDelete(task.id)}
        title={t('item.confirmDeleteTitle')}
        message={t('item.confirmDeleteMessage')}
        confirmLabel={t('item.confirmDeleteLabel')}
        danger
      />
    </div>

    {/* Checklist dropdown */}
    {checklistOpen && hasChecklist && (
      <div
        className={cn(
          'space-y-0.5 rounded-b-lg border border-t-0 border-border-subtle bg-bg-raised px-3 py-1.5',
          compact && 'px-2 py-1',
        )}
        data-task-checklist="true"
      >
        {task.checklist!.map((item) => (
          <button
            key={item.id}
            onClick={(e) => { e.stopPropagation(); toggleChecklistItem(item.id); }}
            className="flex items-center gap-2 w-full text-start py-0.5 group/cl hover:bg-bg-hover rounded px-1 -mx-1 transition-colors"
            data-task-checklist-item="true"
            title={item.text}
          >
            {item.done
              ? <CheckSquare size={13} className="text-green-400 shrink-0" />
              : <Square size={13} className="text-gray-500 group-hover/cl:text-gray-300 shrink-0" />
            }
            <span className={cn('text-xs', compact ? 'line-clamp-2 whitespace-normal break-words leading-4' : 'truncate', item.done ? 'text-gray-500 line-through' : 'text-gray-300')}>
              {item.text}
            </span>
          </button>
        ))}
      </div>
    )}
    </div>
  );
});
