import './globals.css'

export const metadata = {
  title: 'Backend Health Check',
  description: 'Simple page to check if the backend is working',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
