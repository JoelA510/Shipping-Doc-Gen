import { supabase } from './supabaseClient';

const TABLE_NAME = 'tasks';

export async function fetchFilteredTasks({
  text = '',
  status = null,
  taskType = null,
  assigneeId = null,
  projectId = null,
  from = 0,
  limit = 20,
  dateFrom = null,
  dateTo = null,
  includeArchived = false,
  priority = null,
  signal = null
} = {}) {
  let query = supabase.from(TABLE_NAME).select('*', { count: 'exact' });

  if (signal && typeof query.abortSignal === 'function') {
    query = query.abortSignal(signal);
  }

  if (status !== null) {
    query = query.eq('status', status);
  }

  if (taskType !== null) {
    query = query.eq('task_type', taskType);
  }

  if (assigneeId !== null) {
    query = query.eq('assignee_id', assigneeId);
  }

  if (projectId !== null) {
    query = query.eq('project_id', projectId);
  }

  if (text) {
    const escaped = text.replace(/,/g, '\\,');
    query = query.or(`title.ilike.%${escaped}%,description.ilike.%${escaped}%`);
  }

  if (dateFrom) {
    query = query.gte('updated_at', dateFrom);
  }

  if (dateTo) {
    query = query.lte('updated_at', dateTo);
  }

  if (!includeArchived) {
    query = query.eq('is_archived', false);
  }

  if (priority !== null) {
    query = query.eq('priority', priority);
  }

  query = query.range(from, from + limit - 1);

  const { data, error, count } = await query;
  if (error) {
    throw error;
  }

  return {
    data: data ?? [],
    count: typeof count === 'number' ? count : 0,
    from,
    limit
  };
}
