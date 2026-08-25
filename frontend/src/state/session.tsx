import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { Loaded } from "../lib/types";

/** What survives a route change: which dataset is open, what we're predicting,
 *  and the training job in flight. Persisted so a refresh does not lose it. */
interface Session {
  dataset: Loaded | null;
  target: string | null;
  jobId: string | null;
  open: (loaded: Loaded) => void;
  close: () => void;
  setTarget: (target: string | null) => void;
  setJobId: (jobId: string | null) => void;
}

const SessionContext = createContext<Session | null>(null);

const KEY = "databench.session";

interface Stored {
  dataset: Loaded | null;
  target: string | null;
  jobId: string | null;
}

function load(): Stored {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Stored;
  } catch {
    /* private mode, or corrupt json -- start clean */
  }
  return { dataset: null, target: null, jobId: null };
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const initial = useMemo(load, []);
  const [dataset, setDataset] = useState<Loaded | null>(initial.dataset);
  const [target, setTarget] = useState<string | null>(initial.target);
  const [jobId, setJobId] = useState<string | null>(initial.jobId);

  useEffect(() => {
    try {
      sessionStorage.setItem(KEY, JSON.stringify({ dataset, target, jobId }));
    } catch {
      /* over quota on a huge preview -- the app still works, just not across reloads */
    }
  }, [dataset, target, jobId]);

  const open = useCallback((loaded: Loaded) => {
    setDataset(loaded);
    setTarget(null);
    setJobId(null);
  }, []);

  const close = useCallback(() => {
    setDataset(null);
    setTarget(null);
    setJobId(null);
  }, []);

  const value = useMemo(
    () => ({ dataset, target, jobId, open, close, setTarget, setJobId }),
    [dataset, target, jobId, open, close],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession must be used inside SessionProvider");
  return value;
}
