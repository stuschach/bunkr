// src/lib/contexts/UserPreferencesContext.tsx
import { createContext, useContext, useEffect, useState } from 'react';

interface UserPreferences {
  measurementUnit: 'yards' | 'meters';
  notificationsEnabled: boolean;
  scorecardView: 'compact' | 'detailed';
  statsTimeframe: 'lastMonth' | 'lastThreeMonths' | 'lastYear' | 'allTime';
}

const defaultPreferences: UserPreferences = {
  measurementUnit: 'yards',
  notificationsEnabled: true,
  scorecardView: 'detailed',
  statsTimeframe: 'lastThreeMonths',
};

interface UserPreferencesContextType {
  preferences: UserPreferences;
  updatePreference: <K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K]
  ) => void;
  resetPreferences: () => void;
}

const UserPreferencesContext = createContext<UserPreferencesContextType | undefined>(undefined);

export const UserPreferencesProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [preferences, setPreferences] = useState<UserPreferences>(defaultPreferences);
  const [loaded, setLoaded] = useState(false);

  // Load preferences from localStorage on mount
  useEffect(() => {
    const storedPreferences = localStorage.getItem('userPreferences');
    
    if (storedPreferences) {
      try {
        setPreferences({
          ...defaultPreferences,
          ...JSON.parse(storedPreferences),
        });
      } catch (error) {
        console.error('Failed to parse stored preferences:', error);
      }
    }
    
    setLoaded(true);
  }, []);

  // Save preferences to localStorage when they change
  useEffect(() => {
    if (loaded) {
      localStorage.setItem('userPreferences', JSON.stringify(preferences));
    }
  }, [preferences, loaded]);

  // Update a single preference
  const updatePreference = <K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K]
  ) => {
    setPreferences(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  // Reset preferences to defaults
  const resetPreferences = () => {
    setPreferences(defaultPreferences);
  };

  return (
    <UserPreferencesContext.Provider
      value={{
        preferences,
        updatePreference,
        resetPreferences,
      }}
    >
      {children}
    </UserPreferencesContext.Provider>
  );
};

// Custom hook to use the preferences context
export const useUserPreferences = () => {
  const context = useContext(UserPreferencesContext);
  if (context === undefined) {
    throw new Error('useUserPreferences must be used within a UserPreferencesProvider');
  }
  return context;
};