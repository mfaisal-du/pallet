import { homePathForRoles, rolesOfUser } from "@/lib/roles";
import { redirect } from "next/navigation";
import { LandingClient } from "@/components/marketing/LandingClient";
import { safeAuth } from "@/lib/safe-auth";

export default async function HomePage() {
  const session = await safeAuth();
  if (session?.user) {
    const roles = rolesOfUser(session.user);
    if (roles.length > 0) {
      redirect(homePathForRoles(roles));
    }
  }

  return <LandingClient />;
}
