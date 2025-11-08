export const metadata = {
  title: 'Number Guessing Miniapp',
  description: 'Guess the number and win the pot on Base'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', margin: 0, padding: 20, background: '#0b0b0c', color: '#f2f2f2' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>{children}</div>
      </body>
    </html>
  );
}

