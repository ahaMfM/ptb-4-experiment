import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import QueryFeedback from "../components/QueryFeedback";
import { readableError } from "../lib/errors";
import { formatDateTime } from "../lib/format";
import { useTRPC } from "../trpc";

type TeamMemberFormValues = {
  name: string;
  username: string;
  password: string;
};

const emptyForm: TeamMemberFormValues = { name: "", username: "", password: "" };

/**
 * The people who can sign in. We set the people up ourselves: anyone who is
 * signed in can add a team member and passes the username and password on
 * to them directly — nobody registers on their own.
 */
export default function TeamPage() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<TeamMemberFormValues>(emptyForm);
  const [lastAdded, setLastAdded] = useState<string | null>(null);

  const teamQuery = useQuery(trpc.user.list.queryOptions());

  const addTeamMember = useMutation(
    trpc.user.create.mutationOptions({
      onSuccess: (created) => {
        setForm(emptyForm);
        setLastAdded(created.name);
        void queryClient.invalidateQueries(trpc.user.list.queryFilter());
      },
    }),
  );

  const set =
    (field: keyof TeamMemberFormValues) =>
    (e: { target: { value: string } }) =>
      setForm((current) => ({ ...current, [field]: e.target.value }));

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setLastAdded(null);
    addTeamMember.mutate(form);
  };

  return (
    <>
      <section className="card">
        <h2>Add a person</h2>
        <form onSubmit={handleSubmit}>
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
          {addTeamMember.isError && (
            <p className="error" role="alert">
              {readableError(addTeamMember.error.message)}
            </p>
          )}
          {lastAdded && (
            <p className="success" role="status">
              {lastAdded} can now sign in.
            </p>
          )}
          <button type="submit" disabled={addTeamMember.isPending}>
            {addTeamMember.isPending ? "Adding…" : "Add person"}
          </button>
        </form>
      </section>

      <section className="card">
        <h2>
          Team{" "}
          {teamQuery.isSuccess && (
            <span className="count">({teamQuery.data.length})</span>
          )}
        </h2>
        <QueryFeedback query={teamQuery} />
        {teamQuery.isSuccess && (
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
                {teamQuery.data.map((member) => (
                  <tr key={member.id}>
                    <td>{member.name}</td>
                    <td>{member.username}</td>
                    <td>{formatDateTime(member.createdAt)}</td>
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
