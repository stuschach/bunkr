// src/components/profile/AchievementBadges.tsx
'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  dateEarned: Date;
  category: 'score' | 'social' | 'progress' | 'skill' | 'special';
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
}

interface AchievementBadgesProps {
  achievements: Achievement[];
  compact?: boolean;
}

// Color mapping for achievement rarities
const rarityColors = {
  common: 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700',
  uncommon: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-200 dark:border-green-800',
  rare: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-200 dark:border-blue-800',
  epic: 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-200 dark:border-purple-800',
  legendary: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-800'
};

// Category icons
const categoryIcons = {
  score: '🏆',
  social: '👥',
  progress: '📈',
  skill: '🎯',
  special: '✨'
};

export function AchievementBadges({ achievements, compact = false }: AchievementBadgesProps) {
  if (achievements.length === 0) {
    return null;
  }

  // Sort achievements by rarity (most rare first) and then by date earned (most recent first)
  const rarityOrder = {
    legendary: 0,
    epic: 1,
    rare: 2,
    uncommon: 3,
    common: 4
  };

  const sortedAchievements = [...achievements].sort((a, b) => {
    const rarityDiff = rarityOrder[a.rarity] - rarityOrder[b.rarity];
    if (rarityDiff !== 0) return rarityDiff;
    return b.dateEarned.getTime() - a.dateEarned.getTime();
  });

  // For compact mode, show only the 4 most prestigious achievements
  const displayedAchievements = compact ? sortedAchievements.slice(0, 4) : sortedAchievements;

  if (compact) {
    return (
      <div className="flex flex-wrap gap-2 mb-2">
        {displayedAchievements.map((achievement) => (
          <div 
            key={achievement.id}
            className={`inline-flex items-center px-2 py-1 rounded-full border ${rarityColors[achievement.rarity]}`}
            title={`${achievement.name}: ${achievement.description}`}
          >
            <span className="mr-1">{achievement.icon}</span>
            <span className="text-xs font-medium">{achievement.name}</span>
          </div>
        ))}
        {achievements.length > 4 && (
          <div className="inline-flex items-center px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
            <span className="text-xs font-medium">+{achievements.length - 4} more</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center">
          <span className="mr-2">🏅</span>
          Achievements ({achievements.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {displayedAchievements.map((achievement) => (
            <div 
              key={achievement.id}
              className={`flex items-center p-3 rounded-lg border ${rarityColors[achievement.rarity]}`}
            >
              <div className="h-10 w-10 flex items-center justify-center text-2xl mr-3">
                {achievement.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium">{achievement.name}</div>
                <div className="text-xs truncate">{achievement.description}</div>
                <div className="text-xs mt-1 opacity-75">
                  {new Date(achievement.dateEarned).toLocaleDateString()}
                </div>
              </div>
              <div className="flex-shrink-0 ml-2">
                <div className="h-6 w-6 flex items-center justify-center text-xs">
                  {categoryIcons[achievement.category]}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
