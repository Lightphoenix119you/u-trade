export interface CreateListingFormData {
  title: string;
  description: string;
  price: number;
  category: string;
  condition: string;
}

export interface CreateListingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}
