import { ArrowLeft } from 'lucide-react';
import { OrderCard } from '@/components/OrderCard';

interface OrderDetailProps {
  orderId: string;
  navigate: (path: string) => void;
}

export function OrderDetail({ orderId, navigate }: OrderDetailProps) {
  return (
    <div className="relative z-10 mx-auto max-w-2xl px-4 py-6 sm:px-6">
      <button
        onClick={() => navigate('/profile')}
        className="mb-4 flex items-center gap-1.5 text-sm text-white/50 transition hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" /> Retour
      </button>

      <OrderCard orderId={orderId} navigate={navigate} />
    </div>
  );
}
