import { SignIn } from "@clerk/nextjs";

export default function Page() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-black via-gray-900 to-black p-4">
      <div className="w-full max-w-md">
        <SignIn 
          appearance={{
            elements: {
              formButtonPrimary: 
                "bg-gradient-to-r from-purple-500 to-pink-500 hover:opacity-90 transition-opacity",
              footerActionLink: "text-purple-400 hover:text-purple-300",
            },
          }}
          redirectUrl="/dashboard" 
        />
      </div>
    </div>
  );
}
