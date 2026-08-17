import { useCallback, useEffect, useState } from "react";

function readParam(key: string): string | null {
  return new URLSearchParams(window.location.search).get(key);
}

function writeParam(key: string, value: string | null, mode: "push" | "replace") {
  const params = new URLSearchParams(window.location.search);
  if (value === null) {
    params.delete(key);
  } else {
    params.set(key, value);
  }
  const query = params.toString();
  const url = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
  if (mode === "push") {
    window.history.pushState(null, "", url);
  } else {
    window.history.replaceState(null, "", url);
  }
}

/**
 * A piece of state that lives in the `key` query parameter instead of plain
 * component state, so it survives a reload and is part of the link when the
 * page is shared. Setting it back to `defaultValue` removes the parameter,
 * keeping the URL clean when nothing is narrowed down.
 */
export function useSearchParam<T extends string>(
  key: string,
  defaultValue: T,
  mode: "push" | "replace" = "replace",
): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => (readParam(key) as T) ?? defaultValue);

  useEffect(() => {
    const onPopState = () => setValue((readParam(key) as T) ?? defaultValue);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [key, defaultValue]);

  const update = useCallback(
    (next: T) => {
      setValue(next);
      writeParam(key, next === defaultValue ? null : next, mode);
    },
    [key, defaultValue, mode],
  );

  return [value, update];
}
