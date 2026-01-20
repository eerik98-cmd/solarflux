import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'SolarFlux Stock Manager',
  description: 'Solar panel inventory and client management system',
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
