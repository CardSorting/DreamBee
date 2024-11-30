import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Routes that can be accessed while signed out
const publicRoutes = ["/", "/sign-in(.*)", "/sign-up(.*)", "/api/webhooks(.*)"];

function isPublic(path: string) {
  return publicRoutes.find((x) =>
    path.match(new RegExp(`^${x}$`))
  );
}

export default clerkMiddleware(async (auth, request) => {
  if (isPublic(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  try {
    // Check authentication for protected routes
    await auth.protect();
    return NextResponse.next();
  } catch (error) {
    // Redirect to sign-in for unauthenticated requests to protected routes
    const signInUrl = new URL('/sign-in', request.url);
    signInUrl.searchParams.set('redirect_url', request.url);
    return NextResponse.redirect(signInUrl);
  }
});

// Stop Middleware running on static files and api routes
export const config = {
  matcher: [
    "/((?!.*\\..*|_next).*)",
    "/"
  ]
};
