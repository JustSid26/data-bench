import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { Fix, RecipeStep } from "../lib/insights";
import { useSession } from "./session";

/** A staged cleaning recipe per dataset. The backend has no cleaning endpoint
 *  yet, so steps are recorded, projected onto the profile and exportable --
 *  they do not change the data the models train on. */
interface Cleaning {
  steps: RecipeStep[];
  add: (column: string, fix: Fix) => RecipeStep;
  remove: (id: string) => void;
  restore: (step: RecipeStep) => void;
  clear: () => void;
  has: (column: string, action: Fix["action"]) => boolean;
}

const CleaningContext = createContext<Cleaning | null>(null);
const key = (dataset: string) => `databench.recipe.${dataset}`;

function load(dataset: string | undefined): RecipeStep[] {
  if (!dataset) return [];
  try {
    return JSON.parse(sessionStorage.getItem(key(dataset)) ?? "[]") as RecipeStep[];
  } catch {
    return [];
  }
}

export function CleaningProvider({ children }: { children: ReactNode }) {
  const { dataset } = useSession();
  const id = dataset?.id;
  // steps are tagged with the dataset they belong to, so switching datasets can
  // never write one dataset's recipe under another's key
  const [recipe, setRecipe] = useState(() => ({ owner: id, steps: load(id) }));
  if (recipe.owner !== id) setRecipe({ owner: id, steps: load(id) });
  const steps = recipe.owner === id ? recipe.steps : [];
  const setSteps = useCallback(
    (update: (all: RecipeStep[]) => RecipeStep[]) => setRecipe((current) => ({ ...current, steps: update(current.steps) })),
    [],
  );

  useEffect(() => {
    if (!recipe.owner) return;
    try {
      sessionStorage.setItem(key(recipe.owner), JSON.stringify(recipe.steps));
    } catch {
      /* recipe survives this page view only */
    }
  }, [recipe]);

  const add = useCallback((column: string, fix: Fix) => {
    const step: RecipeStep = { ...fix, column, id: `${column}:${fix.action}:${Date.now()}`, at: Date.now() };
    // one step per column and action -- re-adding replaces, it does not stack
    setSteps((all) => [...all.filter((s) => !(s.column === column && s.action === fix.action)), step]);
    return step;
  }, [setSteps]);
  const remove = useCallback((stepId: string) => setSteps((all) => all.filter((s) => s.id !== stepId)), [setSteps]);
  const restore = useCallback(
    (step: RecipeStep) => setSteps((all) => (all.some((s) => s.id === step.id) ? all : [...all, step].sort((a, b) => a.at - b.at))),
    [setSteps],
  );
  const clear = useCallback(() => setSteps(() => []), [setSteps]);
  const has = useCallback((column: string, action: Fix["action"]) => steps.some((s) => s.column === column && s.action === action), [steps]);

  const value = useMemo(() => ({ steps, add, remove, restore, clear, has }), [steps, add, remove, restore, clear, has]);
  return <CleaningContext.Provider value={value}>{children}</CleaningContext.Provider>;
}

export function useCleaning() {
  const value = useContext(CleaningContext);
  if (!value) throw new Error("useCleaning must be used inside CleaningProvider");
  return value;
}
