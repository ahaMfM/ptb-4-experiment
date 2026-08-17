import { createContext, useContext, type ReactNode } from "react";
import type { PublicUser } from "server/router";

const CurrentUserContext = createContext<PublicUser | null>(null);

/** Makes the signed-in user available to any screen without prop drilling. */
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

/** The signed-in user. Only usable inside `CurrentUserProvider`. */
export function useCurrentUser(): PublicUser {
  const user = useContext(CurrentUserContext);
  if (!user) {
    throw new Error("useCurrentUser used outside CurrentUserProvider");
  }
  return user;
}

/** Whether the signed-in user may add, change or remove anything. */
export function useCanWrite(): boolean {
  return useCurrentUser().role === "full";
}
