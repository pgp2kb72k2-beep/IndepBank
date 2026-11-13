"use client";

import { twoFactorClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  plugins: [
    twoFactorClient({
      onTwoFactorRedirect() {
        // Full navigation on purpose: runs outside React, right after the auth cookies change.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.href = "/ingresar/verificar";
      },
    }),
  ],
});
