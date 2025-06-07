import React from 'react';

export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface ToastNotificationProps {
  toast: ToastMessage;
  onClose: (id: string) => void;
}

const ToastNotification: React.FC<ToastNotificationProps> = ({ toast, onClose }) => {
  const baseStyle = "p-4 rounded-md shadow-lg flex justify-between items-center text-white";
  const typeStyles = {
    success: "bg-green-500",
    error: "bg-red-500",
    info: "bg-blue-500",
  };

  return (
    <div className={`${baseStyle} ${typeStyles[toast.type]} mb-2`}>
      <span>{toast.message}</span>
      <button
        onClick={() => onClose(toast.id)}
        className="ml-4 text-white hover:text-gray-200"
      >
        &times;
      </button>
    </div>
  );
};

export default ToastNotification;
