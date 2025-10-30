import { renderHook } from '@testing-library/react';
import { useReportData } from '../useReportData';

describe('useReportData', () => {
  it('finds the correct root project for nested tasks', () => {
    const tasks = [
      { id: 'root', parent_task_id: null },
      { id: 'middle', parent_task_id: 'root' },
      { id: 'leaf', parent_task_id: 'middle' }
    ];

    const { result } = renderHook(() => useReportData(tasks));
    const rootTask = result.current.findRootProject('leaf');

    expect(rootTask).toBe(tasks[0]);
  });
});
