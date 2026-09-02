/** The reserved `/g/[groupId]/*` route param for the "Load Youth Data for
 * all cohorts" combined view (REQUIREMENTS.md §6.1 addendum) -- not a real
 * groups.id. Kept in its own file with zero imports (not layout.tsx, which
 * pulls in server-only modules) so client components can import just this
 * constant without dragging server code into the client bundle. */
export const ALL_COHORTS_GROUP_ID = "all";
