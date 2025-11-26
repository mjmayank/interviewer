import './globals.css'

export const metadata = {
  title: 'Three Questions - Life Interview',
  description: 'A conversation to share with close friends',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}

