import { createContext, useContext, type ReactNode } from "react";
import type { PublicUser } from "server/router";

/**
 * The signed-in user, available to any page without threading it through
 * every prop list. `canWrite` is the one thing most pages actually need: a
 * viewer can look at everything but not add, change or remove anything.
 */
const CurrentUserContext = createContext<PublicUser | null>(null);

export function CurrentUserProvider({
  user,
  children,
}: {
  user: PublicUser;
  children: ReactNode;
}) {
  return (
    <CurrentUserContext.Provider value={user}>
      {children}
    </CurrentUserContext.Provider>
  );
}

export function useCurrentUser(): PublicUser {
  const user = useContext(CurrentUserContext);
  if (!user) {
    throw new Error("useCurrentUser must be used within a CurrentUserProvider");
  }
  return user;
}

/** Whether the signed-in user may add, change or remove anything. */
export function useCanWrite(): boolean {
  return useCurrentUser().role !== "viewer";
}
