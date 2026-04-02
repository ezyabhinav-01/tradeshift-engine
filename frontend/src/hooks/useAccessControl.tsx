import React, { createContext, useContext, useState, type ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';
import { AccessRestrictedModal } from '../components/shared/AccessRestrictedModal';

interface AccessContextType {
  checkAccess: () => boolean;
  isAccessModalOpen: boolean;
  setAccessModalOpen: (open: boolean) => void;
}

const AccessContext = createContext<AccessContextType | undefined>(undefined);

export const AccessProvider = ({ children }: { children: ReactNode }): React.ReactElement => {
  const { user } = useAuth();
  const [isAccessModalOpen, setAccessModalOpen] = useState(false);

  const checkAccess = () => {
    if (user) return true;
    setAccessModalOpen(true);
    return false;
  };

  const contextValue: AccessContextType = {
    checkAccess,
    isAccessModalOpen,
    setAccessModalOpen
  };

  return (
    <AccessContext.Provider value={contextValue}>
      {children}
      {isAccessModalOpen && (
        <AccessRestrictedModal 
          isOpen={isAccessModalOpen} 
          onClose={() => setAccessModalOpen(false)} 
        />
      )}
    </AccessContext.Provider>
  );
};

export const useAccessControl = () => {
  const context = useContext(AccessContext);
  if (context === undefined) {
    throw new Error('useAccessControl must be used within an AccessProvider');
  }
  return context;
};
