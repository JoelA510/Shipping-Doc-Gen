import { useCallback, useMemo } from 'react';

export function useReportData(allTasks = []) {
  const tasksById = useMemo(() => {
    const entries = (allTasks ?? []).map(task => [task.id, task]);
    return new Map(entries);
  }, [allTasks]);

  const findRootProject = useCallback((taskId) => {
    if (!taskId) {
      return undefined;
    }
    let current = tasksById.get(taskId);
    const visited = new Set();
    while (current && current.parent_task_id) {
      if (visited.has(current.id)) {
        break;
      }
      visited.add(current.id);
      const parent = tasksById.get(current.parent_task_id);
      if (!parent) {
        break;
      }
      current = parent;
    }
    return current;
  }, [tasksById]);

  return {
    tasksById,
    findRootProject
  };
}
