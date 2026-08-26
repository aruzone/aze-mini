import './global.css';

export const metadata = {
  title: 'Aze Starter',
  description: 'A full-stack starter template',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
