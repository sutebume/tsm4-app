import { useEffect, useState } from 'react';

export function Toast({ message, show }) {
  return (
    <div className={`toast ${show ? 'show' : ''}`}>
      {message}
    </div>
  );
}

export function useToast() {
  const [toast, setToast] = useState({ message: '', show: false });

  const showToast = (message) => {
    setToast({ message, show: true });
    setTimeout(() => setToast(t => ({ ...t, show: false })), 2500);
  };

  return { toast, showToast };
}
