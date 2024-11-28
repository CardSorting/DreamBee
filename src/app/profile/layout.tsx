import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'My Account - Next.js with Clerk Auth',
  description: 'Manage your account settings and profile information',
};

export default function ProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
