import { useCallback, useMemo } from 'react';

export function useReportData(allTasks = []) {
  const tasksById = useMemo(() => new Map(allTasks.map(task => [task.id, task])), [allTasks]);

  const findRootProject = useCallback((taskId) => {
    if (!taskId) {
      return undefined;
    }
    let current = tasksById.get(taskId);
    while (current && current.parent_task_id) {
      current = tasksById.get(current.parent_task_id);
    }
    return current;
  }, [tasksById]);

  return {
    tasksById,
    findRootProject
  };
}
