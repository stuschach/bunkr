// src/components/common/debugging/PerformanceMonitor.tsx
import React, { useState, useEffect } from 'react';
import { useListenerStats } from '@/components/common/data/PostListener';
import { listenerManager } from '@/lib/services/listener-manager';

interface PerformanceMonitorProps {
  enabled?: boolean;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
}

/**
 * A component that displays real-time performance metrics
 * for the listener system and overall app performance
 */
export function PerformanceMonitor({ 
  enabled = true, 
  position = 'bottom-right' 
}: PerformanceMonitorProps) {
  const [expanded, setExpanded] = useState(false);
  const [memoryUsage, setMemoryUsage] = useState<any>(null);
  const [renderTimes, setRenderTimes] = useState<number[]>([]);
  const [lastRenderTime, setLastRenderTime] = useState(performance.now());
  
  // Get real-time listener stats
  const listenerStats = useListenerStats();
  
  // Monitor memory usage if available
  useEffect(() => {
    if (!enabled) return;
    
    const updateMemoryUsage = () => {
      if (window.performance && 'memory' in window.performance) {
        // @ts-ignore - memory is not in the standard Performance interface
        setMemoryUsage(window.performance.memory);
      }
    };
    
    // Initial update
    updateMemoryUsage();
    
    // Update every 2 seconds
    const intervalId = setInterval(updateMemoryUsage, 2000);
    
    return () => clearInterval(intervalId);
  }, [enabled]);
  
  // Monitor render times
  useEffect(() => {
    if (!enabled) return;
    
    const now = performance.now();
    const renderTime = now - lastRenderTime;
    
    // Keep only the last 50 render times
    setRenderTimes(prev => [...prev.slice(-49), renderTime]);
    setLastRenderTime(now);
    
    // Measure render times
    const frameId = requestAnimationFrame(() => {
      // This is just to keep the measurement running
    });
    
    return () => cancelAnimationFrame(frameId);
  }, [enabled, lastRenderTime]);
  
  // Calculate average render time
  const avgRenderTime = renderTimes.length
    ? renderTimes.reduce((sum, time) => sum + time, 0) / renderTimes.length
    : 0;
  
  // If disabled, render nothing
  if (!enabled) return null;
  
  // Position classes
  const positionClasses = {
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4'
  }[position];
  
  return (
    <div 
      className={`fixed ${positionClasses} z-50 bg-gray-900/80 backdrop-blur-sm text-white rounded-lg shadow-lg overflow-hidden transition-all duration-300 ease-in-out ${
        expanded ? 'w-80' : 'w-10 h-10 cursor-pointer'
      }`}
      onClick={() => !expanded && setExpanded(true)}
    >
      {expanded ? (
        <div className="p-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-bold text-sm">Performance Monitor</h3>
            <button 
              onClick={() => setExpanded(false)}
              className="text-gray-400 hover:text-white"
            >
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                className="h-4 w-4" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M6 18L18 6M6 6l12 12" 
                />
              </svg>
            </button>
          </div>
          
          <div className="space-y-4 text-xs">
            {/* Listener Statistics */}
            <div className="bg-gray-800 rounded p-2">
              <h4 className="font-bold mb-1 text-blue-300">Listener Stats</h4>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                <div>Active Listeners:</div>
                <div className="text-right font-mono">
                  {listenerStats.currentActive}/{listenerStats.maxConcurrent}
                </div>
                <div>Total Created:</div>
                <div className="text-right font-mono">{listenerStats.created}</div>
                <div>Total Destroyed:</div>
                <div className="text-right font-mono">{listenerStats.destroyed}</div>
                <div>Avg. Lifetime:</div>
                <div className="text-right font-mono">
                  {(listenerStats.averageLifetime / 1000).toFixed(1)}s
                </div>
              </div>
              
              <div className="mt-2">
                <div className="w-full bg-gray-700 h-2 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500"
                    style={{ 
                      width: `${(listenerStats.currentActive / (listenerManager as any).maxConcurrentListeners) * 100}%`
                    }}
                  ></div>
                </div>
                <div className="text-center text-xs mt-1 text-gray-400">
                  Listener Capacity
                </div>
              </div>
            </div>
            
            {/* Render Performance */}
            <div className="bg-gray-800 rounded p-2">
              <h4 className="font-bold mb-1 text-green-300">Render Performance</h4>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                <div>Avg. Render Time:</div>
                <div className="text-right font-mono">
                  {avgRenderTime.toFixed(2)}ms
                </div>
                <div>Last Render:</div>
                <div className="text-right font-mono">
                  {renderTimes.length ? renderTimes[renderTimes.length - 1].toFixed(2) : 0}ms
                </div>
                <div>
                  {avgRenderTime > 16.67 ? (
                    <span className="text-red-400">Frame drops possible</span>
                  ) : (
                    <span className="text-green-400">Performance good</span>
                  )}
                </div>
                <div className="text-right">
                  {avgRenderTime > 16.67 ? (
                    <span className="text-red-400">⚠️</span>
                  ) : (
                    <span className="text-green-400">✓</span>
                  )}
                </div>
              </div>
              
              {/* Render time mini chart */}
              <div className="h-12 mt-2 flex items-end space-x-0.5">
                {renderTimes.slice(-20).map((time, i) => (
                  <div 
                    key={i} 
                    className={`w-1 ${time > 16.67 ? 'bg-red-500' : 'bg-green-500'}`}
                    style={{ 
                      height: `${Math.min(100, (time / 33.33) * 100)}%`,
                    }}
                  ></div>
                ))}
              </div>
            </div>
            
            {/* Memory Usage */}
            {memoryUsage && (
              <div className="bg-gray-800 rounded p-2">
                <h4 className="font-bold mb-1 text-purple-300">Memory Usage</h4>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  <div>Used JS Heap:</div>
                  <div className="text-right font-mono">
                    {(memoryUsage.usedJSHeapSize / (1024 * 1024)).toFixed(1)} MB
                  </div>
                  <div>Total JS Heap:</div>
                  <div className="text-right font-mono">
                    {(memoryUsage.totalJSHeapSize / (1024 * 1024)).toFixed(1)} MB
                  </div>
                  <div>Heap Limit:</div>
                  <div className="text-right font-mono">
                    {(memoryUsage.jsHeapSizeLimit / (1024 * 1024)).toFixed(1)} MB
                  </div>
                </div>
                
                {/* Memory usage bar */}
                <div className="mt-2">
                  <div className="w-full bg-gray-700 h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${
                        memoryUsage.usedJSHeapSize / memoryUsage.jsHeapSizeLimit > 0.8
                          ? 'bg-red-500'
                          : memoryUsage.usedJSHeapSize / memoryUsage.jsHeapSizeLimit > 0.5
                          ? 'bg-yellow-500'
                          : 'bg-green-500'
                      }`}
                      style={{ 
                        width: `${(memoryUsage.usedJSHeapSize / memoryUsage.jsHeapSizeLimit) * 100}%`
                      }}
                    ></div>
                  </div>
                  <div className="text-center text-xs mt-1 text-gray-400">
                    Memory Usage
                  </div>
                </div>
              </div>
            )}
            
            {/* Controls */}
            <div className="flex space-x-2">
              <button
                onClick={() => listenerManager.deactivateAll()}
                className="bg-red-900 hover:bg-red-800 text-white rounded px-2 py-1 text-xs flex-1"
              >
                Clear All Listeners
              </button>
              <button
                onClick={() => {
                  // @ts-ignore - intentional for debugging
                  if (typeof window.gc === 'function') window.gc();
                }}
                className="bg-blue-900 hover:bg-blue-800 text-white rounded px-2 py-1 text-xs flex-1"
              >
                Force GC (if available)
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center h-full">
          <div className={`w-2 h-2 rounded-full ${
            listenerStats.currentActive > 10 ? 'bg-red-500' : 'bg-green-500'
          }`}></div>
        </div>
      )}
    </div>
  );
}