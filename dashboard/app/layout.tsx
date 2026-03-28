import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'DemoFrame',
  description: 'Interactive demo recorder for indie founders',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
