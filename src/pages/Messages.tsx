import { MessageSquare, Sparkles } from 'lucide-react';

interface MessagesProps {
  navigate: (path: string) => void;
  initialRecipient?: string;
  initialListing?: string;
}

export function Messages(_props: MessagesProps) {
  return (
    <div className="relative z-10 mx-auto flex min-h-[70vh] max-w-2xl flex-col items-center justify-center px-4 text-center sm:px-6">
      <div className="glass-strong flex flex-col items-center rounded-2xl border border-white/10 p-10">
        <div className="mb-4 flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-white/60">
          <Sparkles className="h-3.5 w-3.5 campus-text" /> Arrive bientôt
        </div>
        <div className="campus-gradient mb-5 flex h-16 w-16 items-center justify-center rounded-2xl">
          <MessageSquare className="h-8 w-8 text-white" />
        </div>
        <h1 className="text-xl font-bold">Messagerie</h1>
        <p className="mt-2 max-w-sm text-sm text-white/50">
          De nouvelles fonctionnalités sont en cours de préparation pour cet espace. Reviens vite !
        </p>
      </div>
    </div>
  );
}
