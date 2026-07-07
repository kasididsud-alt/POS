import { requireOwnerPage } from "@/lib/guard";
import { query } from "@/lib/db";
import StaffClient from "./StaffClient";

export default async function StaffPage() {
  const ctx = await requireOwnerPage();

  const members = await query<{
    user_id: string;
    role: string;
    email: string;
    full_name: string | null;
    branch_id: string | null;
    branch_name: string | null;
    created_at: string;
  }>(
    `select m.user_id, m.role, m.created_at, m.branch_id, u.email, u.full_name,
            b.name as branch_name
       from memberships m
       join users u on u.id = m.user_id
       left join branches b on b.id = m.branch_id
      where m.org_id = $1
      order by m.created_at`,
    [ctx.org.id],
  );

  return (
    <StaffClient
      members={members}
      branches={ctx.branches}
      isOwner={ctx.membership?.role === "owner"}
      currentUserId={ctx.userId}
    />
  );
}
