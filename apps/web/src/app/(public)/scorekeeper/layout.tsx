/** Full-screen scorekeeper — cream phone frame on desktop, edge-to-edge on mobile. */
export default function ScorekeeperLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-background min-h-[100dvh] md:bg-[radial-gradient(rgba(30,41,59,0.09)_1.5px,transparent_1.5px)] md:bg-[length:18px_18px] md:p-6">
      <div className="bg-background md:border-ink md:shadow-sticker-lg mx-auto flex min-h-[100dvh] w-full max-w-[390px] flex-col md:min-h-[780px] md:overflow-hidden md:rounded-[2rem] md:border-2">
        {children}
      </div>
    </div>
  );
}
