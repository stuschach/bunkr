import React, { useState } from 'react';
import { cn } from '@/lib/utils/cn';

type TabItem = {
  id: string;
  label: string;
  content: React.ReactNode;
  icon?: React.ReactNode;
};

interface TabsProps {
  tabs: TabItem[];
  defaultTab?: string;
  onChange?: (id: string) => void;
  variant?: 'default' | 'pills' | 'underline';
  className?: string;
}

export const Tabs: React.FC<TabsProps> = ({
  tabs,
  defaultTab,
  onChange,
  variant = 'default',
  className,
}) => {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id);

  const handleTabChange = (id: string) => {
    setActiveTab(id);
    if (onChange) onChange(id);
  };

  // Styles for different variants
  const tabStyles = {
    default: {
      list: "flex border-b border-gray-200 dark:border-gray-700",
      tab: (isActive: boolean) =>
        cn(
          "px-4 py-2 text-sm font-medium",
          isActive
            ? "border-b-2 border-green-fairway text-green-fairway"
            : "text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300"
        ),
    },
    pills: {
      list: "flex space-x-2",
      tab: (isActive: boolean) =>
        cn(
          "px-4 py-2 text-sm font-medium rounded-full",
          isActive
            ? "bg-green-fairway text-white"
            : "text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
        ),
    },
    underline: {
      list: "flex space-x-8",
      tab: (isActive: boolean) =>
        cn(
          "pb-2 text-sm font-medium border-b-2 -mb-px",
          isActive
            ? "border-green-fairway text-green-fairway"
            : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300"
        ),
    },
  };

  return (
    <div className={className}>
      <div className={tabStyles[variant].list}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={tabStyles[variant].tab(activeTab === tab.id)}
            onClick={() => handleTabChange(tab.id)}
            type="button"
          >
            {tab.icon && <span className="mr-2">{tab.icon}</span>}
            {tab.label}
          </button>
        ))}
      </div>
      <div className="py-4">
        {tabs.map((tab) => (
          <div key={tab.id} className={activeTab === tab.id ? 'block' : 'hidden'}>
            {tab.content}
          </div>
        ))}
      </div>
    </div>
  );
};