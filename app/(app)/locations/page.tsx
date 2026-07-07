import { redirect } from "next/navigation";
import { query } from "@/lib/db";
import { getAppContext } from "@/lib/auth";
import LocationsClient from "./LocationsClient";

export type LocationRow = {
  id: string;
  code: string;
  zone: string | null;
  note: string | null;
};

export default async function LocationsPage() {
  const ctx = await getAppContext();
  if (!ctx?.org) redirect("/onboarding");

  const locations = await query<LocationRow>(
    "select id, code, zone, note from storage_locations where org_id=$1 order by code",
    [ctx.org.id],
  );

  return <LocationsClient locations={locations} />;
}
