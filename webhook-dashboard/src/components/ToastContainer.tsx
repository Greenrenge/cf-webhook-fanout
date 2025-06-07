'use client';

import React from 'react';
import { useToast } from '@/contexts/ToastContext';
import ToastNotification from './ToastNotification';

const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToast();

  if (!toasts.length) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 w-80 z-50">
      {toasts.map((toast) => (
        <ToastNotification
          key={toast.id}
          toast={toast}
          onClose={removeToast}
        />
      ))}
    </div>
  );
};

export default ToastContainer;
