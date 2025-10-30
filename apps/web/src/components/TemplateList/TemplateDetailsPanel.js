import React, { useEffect, useRef, useState } from 'react';
import { useMasterLibrary } from '../../hooks/useMasterLibrary';

export default function TemplateDetailsPanel({ task }) {
  const [isCheckingLibraryStatus, setIsCheckingLibraryStatus] = useState(false);
  const [isInLibrary, setIsInLibrary] = useState(false);
  const masterLibrary = useMasterLibrary();
  const checkStatusRef = useRef(masterLibrary.checkTaskLibraryStatus);

  useEffect(() => {
    checkStatusRef.current = masterLibrary.checkTaskLibraryStatus;
  }, [masterLibrary.checkTaskLibraryStatus]);

  useEffect(() => {
    if (!task?.id) {
      setIsCheckingLibraryStatus(false);
      setIsInLibrary(false);
      return undefined;
    }
    let mounted = true;
    setIsCheckingLibraryStatus(true);
    Promise.resolve(checkStatusRef.current(task.id))
      .then(inLibrary => {
        if (mounted) {
          setIsInLibrary(Boolean(inLibrary));
        }
      })
      .catch(() => {
        if (mounted) {
          setIsInLibrary(false);
        }
      })
      .finally(() => {
        if (mounted) {
          setIsCheckingLibraryStatus(false);
        }
      });
    return () => {
      mounted = false;
    };
  }, [task?.id]);

  return (
    <section aria-live="polite">
      <h2>{task?.title ?? 'Untitled template'}</h2>
      <p data-testid="library-status">
        {isCheckingLibraryStatus
          ? 'Checking library status…'
          : isInLibrary
            ? 'Template is in the library.'
            : 'Template is not in the library.'}
      </p>
    </section>
  );
}
