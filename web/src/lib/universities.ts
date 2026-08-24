import { createClient } from "@/lib/supabase/server";

export type University = {
  id: string;
  name: string;
  proximity: "Local" | "Regional" | "Abroad" | "Unknown";
};

export async function getUniversities(): Promise<University[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("universities").select("id, name, proximity").order("name");
  return data ?? [];
}
