import { LogOut } from "lucide-react";

import { logoutAction } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";

export function LogoutButton({
  showLabel = true,
  className,
}: {
  showLabel?: boolean;
  className?: string;
}) {
  return (
    <form action={logoutAction} className={className}>
      <Button
        type="submit"
        variant="ghost"
        size={showLabel ? "default" : "icon"}
        className={showLabel ? "w-full justify-start" : undefined}
        aria-label={showLabel ? undefined : "Sign out"}
      >
        <LogOut aria-hidden="true" />
        {showLabel ? "Sign out" : null}
      </Button>
    </form>
  );
}
