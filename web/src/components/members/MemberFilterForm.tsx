import type { University } from "@/lib/universities";
import type { ServantOption } from "@/lib/servants";
import type { MemberFilters } from "@/lib/members";

const PROXIMITIES = ["Local", "Regional", "Abroad", "Unknown"];

export function MemberFilterForm({
  basePath,
  filters,
  activeFilterCount,
  universities,
  servants,
  memberLabel,
}: {
  basePath: string;
  filters: MemberFilters;
  activeFilterCount: number;
  universities: University[];
  servants: ServantOption[];
  memberLabel: string;
}) {
  return (
    <form action={basePath} method="get" className="space-y-3">
      <div className="flex gap-2">
        <input
          type="text"
          name="q"
          defaultValue={filters.q ?? ""}
          placeholder={`Search ${memberLabel.toLowerCase()}s…`}
          className="flex-1 rounded-md border border-[#ddd] px-3 py-2 text-sm focus:border-[#1e3a5f] focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/10"
        />
        <button
          type="submit"
          className="rounded-md bg-[#1e3a5f] px-4 py-2 text-sm font-semibold text-white hover:bg-[#152a45]"
        >
          Search
        </button>
      </div>

      <details className="rounded-md border border-[#ddd]">
        <summary className="cursor-pointer select-none px-3 py-2 text-sm font-semibold text-[#333] flex items-center gap-2">
          Filters
          {activeFilterCount > 0 && (
            <span className="rounded-full bg-[#dc3545] text-white text-[11px] px-2 py-0.5">
              {activeFilterCount}
            </span>
          )}
        </summary>

        <div className="p-3 border-t border-[#eee] grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="font-semibold mb-1.5">Assigned Servant</p>
            <label className="flex items-center gap-2 mb-1">
              <input
                type="checkbox"
                name="servant"
                value="unassigned"
                defaultChecked={filters.servantIds?.includes("unassigned")}
              />
              Unassigned
            </label>
            {servants.map((s) => (
              <label key={s.id} className="flex items-center gap-2 mb-1">
                <input
                  type="checkbox"
                  name="servant"
                  value={s.id}
                  defaultChecked={filters.servantIds?.includes(s.id)}
                />
                {s.full_name}
              </label>
            ))}
          </div>

          <div>
            <p className="font-semibold mb-1.5">University/College</p>
            <div className="max-h-32 overflow-y-auto">
              {universities.map((u) => (
                <label key={u.id} className="flex items-center gap-2 mb-1">
                  <input
                    type="checkbox"
                    name="university"
                    value={u.id}
                    defaultChecked={filters.universityIds?.includes(u.id)}
                  />
                  {u.name}
                </label>
              ))}
            </div>
          </div>

          <div>
            <p className="font-semibold mb-1.5">Proximity</p>
            {PROXIMITIES.map((p) => (
              <label key={p} className="flex items-center gap-2 mb-1">
                <input
                  type="checkbox"
                  name="proximity"
                  value={p}
                  defaultChecked={filters.proximities?.includes(p)}
                />
                {p}
              </label>
            ))}
          </div>

          <div>
            <p className="font-semibold mb-1.5">Other</p>
            <label className="flex items-center gap-2 mb-1">
              <input type="checkbox" name="excludeVisitors" value="1" defaultChecked={filters.excludeVisitors} />
              Exclude Visitors
            </label>
            <label className="flex items-center gap-2 mb-1">
              <input type="checkbox" name="hasPhoto" value="1" defaultChecked={filters.hasPhoto} />
              Has Photo
            </label>
            <label className="flex items-center gap-2 mb-1">
              <input type="checkbox" name="male" value="1" defaultChecked={filters.male} />
              Male
            </label>
            <label className="flex items-center gap-2 mb-1">
              <input type="checkbox" name="female" value="1" defaultChecked={filters.female} />
              Female
            </label>
          </div>

          <div className="sm:col-span-2 flex gap-2 pt-1">
            <button
              type="submit"
              className="rounded-md bg-[#1e3a5f] px-4 py-2 text-sm font-semibold text-white hover:bg-[#152a45]"
            >
              Apply Filters
            </button>
            <a
              href={basePath}
              className="rounded-md bg-[#f0f0f0] px-4 py-2 text-sm font-semibold text-[#333] hover:bg-[#e0e0e0]"
            >
              Clear All
            </a>
          </div>
        </div>
      </details>
    </form>
  );
}
