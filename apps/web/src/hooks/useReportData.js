import { useCallback, useMemo } from 'react';

export function useReportData(allTasks = []) {
  const tasksById = useMemo(() => {
    const entries = (allTasks ?? [])
      .filter(task => task?.id != null)
      .map(task => [task.id, task]);
    return new Map(entries);
  }, [allTasks]);

  const findRootProject = useCallback((taskId) => {
    const visited = new Set();
    let currentTask = tasksById.get(taskId);
    while (currentTask && currentTask.parent_task_id) {
      if (visited.has(currentTask.id)) {
        break;
      }
      visited.add(currentTask.id);
      currentTask = tasksById.get(currentTask.parent_task_id);
    }
    return currentTask ?? null;
  }, [tasksById]);

  return {
    tasksById,
    findRootProject
  };
}
