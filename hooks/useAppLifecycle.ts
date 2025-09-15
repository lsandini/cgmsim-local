import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useSimulationStore } from '../store/useSimulationStore';
import { glucoseSimulator } from '../utils/glucoseSimulator';
import { database } from '../store/database';

interface UseAppLifecycleOptions {
  onForeground?: () => void;
  onBackground?: () => void;
  minBackgroundMinutes?: number;
}

export function useAppLifecycle(options: UseAppLifecycleOptions = {}) {
  const { 
    minBackgroundMinutes = 5,
    onForeground,
    onBackground 
  } = options;
  
  const appState = useRef(AppState.currentState);
  const backgroundTime = useRef<Date | null>(null);
  
  const {
    currentPatient,
    recentTreatments,
    simulationState,
    loadGlucoseData,
    updateSimulationState,
  } = useSimulationStore();

  const handleRecomputation = async () => {
    if (!currentPatient) return;

    try {
      updateSimulationState({ isComputing: true });

      // Get recent treatments that might affect the simulation
      const now = new Date();
      const relevantTreatments = recentTreatments.filter(t => {
        const hoursAgo = (now.getTime() - t.timestamp.getTime()) / (1000 * 60 * 60);
        return hoursAgo <= 24; // Include treatments from last 24 hours
      });

      // Clear future readings and recompute
      await database.clearFutureReadings(currentPatient.id, now);

      // Generate new simulation data
      const futureReadings = glucoseSimulator.simulateForward(
        currentPatient,
        relevantTreatments,
        12 // 12 hours forward
      );

      // Save future readings to database
      await database.saveGlucoseReadings(futureReadings);

      // Update simulation state
      const computedUntil = new Date(now.getTime() + 12 * 60 * 60 * 1000);
      updateSimulationState({
        lastComputedAt: now,
        nextComputationTime: new Date(now.getTime() + 5 * 60 * 1000), // Next in 5 min
        computedUntil,
        isComputing: false,
      });

      // Reload glucose data in the UI
      await loadGlucoseData(3, 3);

      console.log('Background recomputation completed');
    } catch (error) {
      console.error('Failed to recompute simulation:', error);
      updateSimulationState({ isComputing: false });
    }
  };

  useEffect(() => {
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      const prevAppState = appState.current;
      appState.current = nextAppState;

      if (prevAppState === 'background' && nextAppState === 'active') {
        // App came to foreground
        console.log('App came to foreground');
        
        if (backgroundTime.current) {
          const backgroundDuration = (Date.now() - backgroundTime.current.getTime()) / (1000 * 60);
          console.log(`App was in background for ${backgroundDuration.toFixed(1)} minutes`);
          
          // Recompute if app was in background for more than the threshold
          if (backgroundDuration >= minBackgroundMinutes) {
            console.log('Triggering background recomputation...');
            await handleRecomputation();
          }
        }
        
        backgroundTime.current = null;
        onForeground?.();
      } else if (prevAppState === 'active' && nextAppState === 'background') {
        // App went to background
        console.log('App went to background');
        backgroundTime.current = new Date();
        onBackground?.();
      }
    };

    // Subscribe to app state changes
    const subscription = AppState.addEventListener('change', handleAppStateChange);

    // Cleanup
    return () => {
      subscription?.remove();
    };
  }, [
    currentPatient,
    recentTreatments,
    simulationState,
    minBackgroundMinutes,
    onForeground,
    onBackground,
    loadGlucoseData,
    updateSimulationState,
  ]);

  return {
    currentAppState: appState.current,
    isInBackground: appState.current === 'background',
    backgroundTime: backgroundTime.current,
    triggerRecomputation: handleRecomputation,
  };
}