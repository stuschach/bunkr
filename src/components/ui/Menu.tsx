// src/components/ui/Menu.tsx
import React, { useState, useEffect, useRef, createContext, useContext } from 'react';

type MenuContextType = {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  close: () => void;
};

const MenuContext = createContext<MenuContextType | undefined>(undefined);

function useMenuContext() {
  const context = useContext(MenuContext);
  if (context === undefined) {
    throw new Error('useMenuContext must be used within a Menu provider');
  }
  return context;
}

interface MenuProps {
  children: React.ReactNode;
}

export function Menu({ children }: MenuProps) {
  const [open, setOpen] = useState(false);
  
  const close = () => setOpen(false);
  
  return (
    <MenuContext.Provider value={{ open, setOpen, close }}>
      <div className="relative inline-block text-left">
        {children}
      </div>
    </MenuContext.Provider>
  );
}

interface MenuButtonProps {
  asChild?: boolean;
  children: React.ReactNode;
}

Menu.Button = function MenuButton({ asChild = false, children }: MenuButtonProps) {
  const { open, setOpen } = useMenuContext();
  
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setOpen(!open);
  };
  
  if (asChild) {
    return React.cloneElement(React.Children.only(children) as React.ReactElement, {
      onClick: handleClick,
      'aria-expanded': open,
      'aria-haspopup': true
    });
  }
  
  return (
    <button
      type="button"
      className="inline-flex justify-center w-full rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
      onClick={handleClick}
      aria-expanded={open}
      aria-haspopup="true"
    >
      {children}
    </button>
  );
};

interface MenuItemsProps {
  children: React.ReactNode;
}

Menu.Items = function MenuItems({ children }: MenuItemsProps) {
  const { open, close } = useMenuContext();
  const itemsRef = useRef<HTMLDivElement>(null);
  
  // Close menu when clicking outside
  useEffect(() => {
    if (!open) return;
    
    function handleClickOutside(event: MouseEvent) {
      if (itemsRef.current && !itemsRef.current.contains(event.target as Node)) {
        close();
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open, close]);
  
  // Close menu when pressing Escape
  useEffect(() => {
    if (!open) return;
    
    function handleEscapeKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        close();
      }
    }
    
    document.addEventListener('keydown', handleEscapeKey);
    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [open, close]);
  
  if (!open) return null;
  
  return (
    <div
      ref={itemsRef}
      className="origin-top-right absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none z-50"
      role="menu"
      aria-orientation="vertical"
      tabIndex={-1}
    >
      <div className="py-1" role="none">
        {children}
      </div>
    </div>
  );
};

interface MenuItemProps {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}

Menu.Item = function MenuItem({ children, onClick, disabled = false }: MenuItemProps) {
  const { close } = useMenuContext();
  
  const handleClick = () => {
    if (disabled) return;
    if (onClick) onClick();
    close();
  };
  
  return (
    <div
      role="menuitem"
      onClick={handleClick}
      className={`${
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
      }`}
    >
      {children}
    </div>
  );
};

export default Menu;