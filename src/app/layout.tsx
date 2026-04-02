import './globals.css'
import { AppProvider } from './providers';

export const metadata = {
  title: 'Inventory Management System',
  description: 'Manage your inventory, clients, and quotes',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <AppProvider>
          {children}
        </AppProvider>
      </body>
    </html>
  )
}