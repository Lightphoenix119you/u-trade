import { createContext, useContext, useState, type ReactNode } from 'react';
import { CreateListingModal } from '@/components/CreateListingModal';

interface CreateListingModalContextValue {
  openCreateListingModal: () => void;
}

const CreateListingModalContext = createContext<CreateListingModalContextValue | undefined>(undefined);

interface CreateListingModalProviderProps {
  children: ReactNode;
  navigate: (path: string) => void;
}

export function CreateListingModalProvider({ children, navigate }: CreateListingModalProviderProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <CreateListingModalContext.Provider value={{ openCreateListingModal: () => setIsOpen(true) }}>
      {children}
      <CreateListingModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onSuccess={() => {
          setIsOpen(false);
          navigate('/market');
        }}
      />
    </CreateListingModalContext.Provider>
  );
}

export function useCreateListingModal() {
  const ctx = useContext(CreateListingModalContext);
  if (!ctx) {
    throw new Error('useCreateListingModal must be used within a CreateListingModalProvider');
  }
  return ctx;
}
