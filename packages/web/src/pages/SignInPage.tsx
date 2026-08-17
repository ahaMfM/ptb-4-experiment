import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { readableError } from "../lib/errors";
import { useTRPC } from "../trpc";

/**
 * Shown until someone has signed in. Everyone signs in as themselves, so it
 * is clear who recorded what. Accounts are set up by the team from within
 * the application — there is no self-registration and no password recovery.
 */
export default function SignInPage() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const signIn = useMutation(
    trpc.auth.signIn.mutationOptions({
      onSuccess: (user) => {
        queryClient.setQueryData(trpc.auth.me.queryKey(), user);
      },
    }),
  );

  const submit = (e: FormEvent) => {
    e.preventDefault();
    signIn.mutate({ username, password });
  };

  return (
    <div className="signin">
      <form className="card signin-card" onSubmit={submit}>
        <h1>Sign in</h1>
        <p className="muted">
          Please sign in as yourself, so it is clear who recorded what.
        </p>
        <label>
          Username
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoFocus
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        {signIn.isError && (
          <p className="error" role="alert">
            {readableError(signIn.error.message)}
          </p>
        )}
        <button type="submit" disabled={signIn.isPending}>
          {signIn.isPending ? "Signing in…" : "Sign in"}
        </button>
        <p className="muted signin-hint">
          No account yet? Ask a colleague who is already signed in to add you
          on the Team page.
        </p>
      </form>
    </div>
  );
}
