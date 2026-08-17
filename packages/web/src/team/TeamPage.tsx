import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { useCanWrite } from "../auth/CurrentUserContext";
import QueryFeedback from "../components/QueryFeedback";
import { readableError } from "../lib/errors";
import { formatDateTime } from "../lib/format";
import { useTRPC } from "../trpc";

type TeamMemberFormValues = {
  name: string;
  username: string;
  password: string;
  role: "full" | "read_only";
};

const emptyForm: TeamMemberFormValues = {
  name: "",
  username: "",
  password: "",
  role: "full",
};

/** "read_only" → "Read only" */
function roleLabel(role: "full" | "read_only"): string {
  return role === "full" ? "Full access" : "Read only";
}

/**
 * The people who can sign in. We set the people up ourselves: anyone who is
 * signed in can add a team member and passes the username and password on
 * to them directly — nobody registers on their own. New team members get
 * full access unless read-only is chosen explicitly.
 */
export default function TeamPage() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const canWrite = useCanWrite();
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
    (field: "name" | "username" | "password") =>
    (e: { target: { value: string } }) =>
      setForm((current) => ({ ...current, [field]: e.target.value }));

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setLastAdded(null);
    addTeamMember.mutate(form);
  };

  return (
    <>
      {canWrite && (
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
              <label>
                Access
                <select
                  value={form.role}
                  onChange={(e) =>
                    setForm((current) => ({
                      ...current,
                      role: e.target.value as TeamMemberFormValues["role"],
                    }))
                  }
                >
                  <option value="full">Full access</option>
                  <option value="read_only">Read only</option>
                </select>
              </label>
            </div>
            <p className="muted">
              Tell the person their username and password directly — there is
              no password recovery. Read only means they can see customers,
              products, orders and invoices, but cannot add, change or remove
              anything, place an order or record a payment.
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
      )}

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
                  <th>Access</th>
                  <th>Added</th>
                </tr>
              </thead>
              <tbody>
                {teamQuery.data.map((member) => (
                  <tr key={member.id}>
                    <td>{member.name}</td>
                    <td>{member.username}</td>
                    <td>{roleLabel(member.role)}</td>
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
