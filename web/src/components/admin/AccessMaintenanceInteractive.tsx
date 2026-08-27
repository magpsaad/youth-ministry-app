"use client";

import { useMemo, useState, useTransition } from "react";
import type { AccessProfile, AccessRoleRow } from "@/app/admin/access-maintenance/actions";
import type { GroupSummary } from "@/lib/groups";
import { grantRoleAction, revokeRoleAction } from "@/app/admin/access-maintenance/actions";

const ROLE_LABELS: Record<AccessRoleRow["role"], string> = {
  admin: "Admin",
  general_coordinator: "General Coordinator",
  sub_coordinator: "Sub-Coordinator",
  servant: "Servant",
  read_only: "Read-Only (exception access)",
};

const ROLES_REQUIRING_GROUP: AccessRoleRow["role"][] = ["sub_coordinator", "read_only"];
const ROLES_ALLOWING_GROUP: AccessRoleRow["role"][] = ["sub_coordinator", "servant", "read_only"];

/** REQUIREMENTS.md §6.14/§4 -- Access Maintenance: grant/revoke role rows
 * over `user_roles`. Only existing profiles (people who've signed in at
 * least once) can be granted a role -- there's no account to attach one to
 * otherwise (matches how the Pending Servants approval flow works). */
export function AccessMaintenanceInteractive({
  profiles,
  initialRoles,
  groups,
}: {
  profiles: AccessProfile[];
  initialRoles: AccessRoleRow[];
  groups: GroupSummary[];
}) {
  const [roles, setRoles] = useState(initialRoles);
  const [search, setSearch] = useState("");
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [newRole, setNewRole] = useState<AccessRoleRow["role"]>("servant");
  const [newGroupId, setNewGroupId] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const filteredProfiles = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return profiles.slice(0, 20);
    return profiles.filter((p) => p.full_name.toLowerCase().includes(q) || p.email?.toLowerCase().includes(q));
  }, [profiles, search]);

  const selectedProfile = profiles.find((p) => p.id === selectedProfileId) ?? null;
  const selectedRoles = roles.filter((r) => r.user_id === selectedProfileId);

  function handleGrant() {
    if (!selectedProfileId) return;
    setError(null);
    const groupId = ROLES_ALLOWING_GROUP.includes(newRole) && newGroupId ? newGroupId : null;
    if (ROLES_REQUIRING_GROUP.includes(newRole) && !groupId) {
      setError("This role requires a group.");
      return;
    }
    startTransition(async () => {
      const res = await grantRoleAction(selectedProfileId, newRole, groupId);
      if (res.error) {
        setError(res.error);
        return;
      }
      setRoles((prev) => [
        ...prev,
        {
          id: res.id!,
          user_id: selectedProfileId,
          role: newRole,
          group_id: groupId,
          group_name: groups.find((g) => g.id === groupId)?.name ?? null,
        },
      ]);
    });
  }

  function handleRevoke(roleRowId: string) {
    if (!confirm("Revoke this role grant?")) return;
    setError(null);
    startTransition(async () => {
      const res = await revokeRoleAction(roleRowId);
      if (res.error) {
        setError(res.error);
        return;
      }
      setRoles((prev) => prev.filter((r) => r.id !== roleRowId));
    });
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="rounded-lg bg-white shadow-[0_2px_8px_rgba(0,0,0,0.08)] p-5">
        <h2 className="text-lg font-bold text-[#1e3a5f] mb-3">Find a Person</h2>
        <p className="text-xs text-[#666] mb-3">
          Only people who&rsquo;ve signed in at least once appear here -- there&rsquo;s no account yet to grant a
          role to otherwise.
        </p>
        <input
          type="text"
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-md border border-[#ddd] px-3 py-2 text-sm mb-3 focus:border-[#1e3a5f] focus:outline-none"
        />
        <div className="divide-y divide-[#f0f0f0] max-h-96 overflow-y-auto">
          {filteredProfiles.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setSelectedProfileId(p.id)}
              className={`w-full text-left py-2 px-2 text-sm rounded-md ${
                selectedProfileId === p.id ? "bg-[#1e3a5f] text-white" : "hover:bg-[#f5f5f5] text-[#333]"
              }`}
            >
              <p className="font-medium">{p.full_name}</p>
              <p className={`text-xs ${selectedProfileId === p.id ? "text-white/70" : "text-[#666]"}`}>{p.email}</p>
            </button>
          ))}
          {filteredProfiles.length === 0 && <p className="py-2 text-sm text-[#666]">No matches.</p>}
        </div>
      </div>

      <div className="rounded-lg bg-white shadow-[0_2px_8px_rgba(0,0,0,0.08)] p-5">
        {!selectedProfile ? (
          <p className="text-sm text-[#666]">Select a person to view/edit their roles.</p>
        ) : (
          <>
            <h2 className="text-lg font-bold text-[#1e3a5f] mb-3">{selectedProfile.full_name}</h2>
            {error && <p className="mb-3 text-sm text-[#dc3545]">{error}</p>}

            <div className="divide-y divide-[#f0f0f0] mb-4">
              {selectedRoles.map((r) => (
                <div key={r.id} className="py-2 flex items-center justify-between text-sm">
                  <span className="text-[#333]">
                    {ROLE_LABELS[r.role]}
                    {r.group_name && ` — ${r.group_name}`}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRevoke(r.id)}
                    disabled={pending}
                    className="text-[#dc3545] text-xs font-semibold disabled:opacity-60"
                  >
                    Revoke
                  </button>
                </div>
              ))}
              {selectedRoles.length === 0 && <p className="py-2 text-sm text-[#666]">No roles granted yet.</p>}
            </div>

            <div className="border-t border-[#f0f0f0] pt-3 space-y-2">
              <h3 className="text-sm font-bold text-[#1e3a5f]">Grant a Role</h3>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as AccessRoleRow["role"])}
                className="w-full rounded-md border border-[#ddd] px-3 py-2 text-sm focus:border-[#1e3a5f] focus:outline-none"
              >
                {(Object.keys(ROLE_LABELS) as AccessRoleRow["role"][]).map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
              {ROLES_ALLOWING_GROUP.includes(newRole) && (
                <select
                  value={newGroupId}
                  onChange={(e) => setNewGroupId(e.target.value)}
                  className="w-full rounded-md border border-[#ddd] px-3 py-2 text-sm focus:border-[#1e3a5f] focus:outline-none"
                >
                  <option value="">{newRole === "servant" ? "Unassigned" : "Select a group..."}</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              )}
              <button
                type="button"
                onClick={handleGrant}
                disabled={pending}
                className="rounded-md bg-[#1e3a5f] px-4 py-2 text-sm font-semibold text-white hover:bg-[#152a45] disabled:opacity-60"
              >
                Grant
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
