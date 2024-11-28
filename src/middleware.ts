import { clerkMiddleware } from "@clerk/nextjs/server";

// Disable telemetry in middleware
process.env.CLERK_TELEMETRY_DISABLED = "1";

export default clerkMiddleware();

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public (public files)
     * - sign-in, sign-up (auth routes)
     */
    "/((?!_next/static|_next/image|favicon.ico|public|sign-in|sign-up).*)",
  ],
};
