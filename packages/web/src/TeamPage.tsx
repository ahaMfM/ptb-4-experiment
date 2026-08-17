import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { useTRPC } from "./trpc";
import { formatDateTime, readableError } from "./utils";

type TeamFormValues = {
  name: string;
  username: string;
  password: string;
};

const emptyForm: TeamFormValues = { name: "", username: "", password: "" };

/**
 * The people who can sign in. We set the people up ourselves: anyone who is
 * signed in can add a team member and passes the username and password on
 * to them directly — nobody registers on their own.
 */
export default function TeamPage() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<TeamFormValues>(emptyForm);
  const [lastAdded, setLastAdded] = useState<string | null>(null);

  const usersQuery = useQuery(trpc.user.list.queryOptions());

  const create = useMutation(
    trpc.user.create.mutationOptions({
      onSuccess: (created) => {
        setForm(emptyForm);
        setLastAdded(created.name);
        void queryClient.invalidateQueries({
          queryKey: trpc.user.list.queryKey(),
        });
      },
    }),
  );

  const set =
    (field: keyof TeamFormValues) =>
    (e: { target: { value: string } }) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setLastAdded(null);
    create.mutate(form);
  };

  return (
    <>
      <section className="card">
        <h2>Add a person</h2>
        <form onSubmit={submit}>
          <div className="grid">
            <label>
              Name
              <input
                value={form.name}
                onChange={set("name")}
                placeholder="Jane Doe"
                required
              />
            </label>
            <label>
              Username
              <input
                value={form.username}
                onChange={set("username")}
                placeholder="jane"
                autoComplete="off"
                required
              />
            </label>
            <label>
              Password
              <input
                type="text"
                value={form.password}
                onChange={set("password")}
                autoComplete="off"
                required
              />
            </label>
          </div>
          <p className="muted">
            Tell the person their username and password directly — there is no
            password recovery.
          </p>
          {create.isError && (
            <p className="error" role="alert">
              {readableError(create.error.message)}
            </p>
          )}
          {lastAdded && (
            <p className="success" role="status">
              {lastAdded} can now sign in.
            </p>
          )}
          <button type="submit" disabled={create.isPending}>
            {create.isPending ? "Adding…" : "Add person"}
          </button>
        </form>
      </section>

      <section className="card">
        <h2>
          Team{" "}
          {usersQuery.isSuccess && (
            <span className="count">({usersQuery.data.length})</span>
          )}
        </h2>
        {usersQuery.isPending && <p className="muted">Loading…</p>}
        {usersQuery.isError && (
          <p className="error">{readableError(usersQuery.error.message)}</p>
        )}
        {usersQuery.isSuccess && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Username</th>
                  <th>Added</th>
                </tr>
              </thead>
              <tbody>
                {usersQuery.data.map((user) => (
                  <tr key={user.id}>
                    <td>{user.name}</td>
                    <td>{user.username}</td>
                    <td>{formatDateTime(user.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
