import React, { useEffect, useCallback, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Text,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import * as ScreenOrientation from 'expo-screen-orientation';
import { GlucoseChart } from '../../components/GlucoseChart';
import { QuickTreatment } from '../../components/QuickTreatment';
import { useSimulationStore } from '../../store/useSimulationStore';
import { glucoseSimulator } from '../../utils/glucoseSimulator';
import { database } from '../../store/database';

export default function GlucoseScreen() {
  const [initError, setInitError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  const {
    currentPatient,
    glucoseReadings,
    recentTreatments,
    simulationState,
    isLoading,
    error,
    nextReadingTime,
    initializeStore,
    createPatient,
    addTreatment,
    loadGlucoseData,
    startSimulation,
    startCGMTimer,
    clearError,
    resetSimulationWithStableData,
  } = useSimulationStore();

  useEffect(() => {
    const initialize = async () => {
      try {
        console.log('GlucoseScreen: Starting initialization...');
        setIsInitializing(true);
        setInitError(null);
        await initializeStore();
        console.log('GlucoseScreen: Initialization complete');
      } catch (error) {
        console.error('GlucoseScreen: Initialization failed:', error);
        setInitError(error instanceof Error ? error.message : 'Initialization failed');
      } finally {
        setIsInitializing(false);
      }
    };

    initialize();
  }, [initializeStore]);

  // Enable screen rotation for this screen
  useEffect(() => {
    const enableRotation = async () => {
      try {
        // Allow all orientations for this screen
        await ScreenOrientation.unlockAsync();
      } catch (error) {
        console.error('Failed to unlock orientation:', error);
      }
    };

    enableRotation();

    // Cleanup: you might want to lock orientation when leaving this screen
    return () => {
      // Optional: Lock back to portrait when leaving
      // ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    };
  }, []);

  const onRefresh = useCallback(async () => {
    if (!currentPatient) return;
    
    try {
      // Recompute simulation
      await startSimulation();
      // Reload glucose data (historical + future)
      await loadGlucoseData(24, 2);
    } catch (error) {
      console.error('Failed to refresh:', error);
    }
  }, [currentPatient, startSimulation, loadGlucoseData]);

  const handleAddTreatment = useCallback(async (type: 'carb' | 'insulin', value: number) => {
    try {
      await addTreatment({
        timestamp: new Date(),
        type,
        value,
      });
      
      Alert.alert(
        'Treatment Added',
        `${value}${type === 'carb' ? 'g carbs' : 'u insulin'} added successfully`
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to add treatment. Please try again.');
    }
  }, [addTreatment]);

  const handleCreatePatient = useCallback(async () => {
    try {
      await createPatient({
        name: 'My Profile',
      });
      
      // Start initial simulation
      await startSimulation();
      await loadGlucoseData(24, 2); // Load 24 hours historical + 2 hours future

      // Start CGM timer for real-time updates
      await startCGMTimer();
    } catch (error) {
      Alert.alert('Error', 'Failed to create patient profile. Please try again.');
    }
  }, [createPatient, startSimulation, loadGlucoseData, startCGMTimer]);

  // Show initialization loading state
  if (isInitializing) {
    return (
      <View style={styles.container}>
        <StatusBar style="dark" />
        <View style={styles.welcomeContainer}>
          <Ionicons name="hourglass" size={64} color="#3b82f6" />
          <Text style={styles.welcomeTitle}>Initializing...</Text>
          <Text style={styles.welcomeMessage}>
            Setting up your CGM simulator...
          </Text>
        </View>
      </View>
    );
  }

  // Show initialization error
  if (initError) {
    return (
      <View style={styles.container}>
        <StatusBar style="dark" />
        <View style={styles.errorContainer}>
          <Ionicons name="warning" size={48} color="#ef4444" />
          <Text style={styles.errorTitle}>Initialization Failed</Text>
          <Text style={styles.errorMessage}>{initError}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => {
              setInitError(null);
              setIsInitializing(true);
              const initialize = async () => {
                try {
                  await initializeStore();
                } catch (error) {
                  setInitError(error instanceof Error ? error.message : 'Initialization failed');
                } finally {
                  setIsInitializing(false);
                }
              };
              initialize();
            }}
          >
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <StatusBar style="dark" />
        <View style={styles.errorContainer}>
          <Ionicons name="warning" size={48} color="#ef4444" />
          <Text style={styles.errorTitle}>Something went wrong</Text>
          <Text style={styles.errorMessage}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={clearError}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (!currentPatient) {
    return (
      <View style={styles.container}>
        <StatusBar style="dark" />
        <View style={styles.welcomeContainer}>
          <Ionicons name="pulse" size={64} color="#3b82f6" />
          <Text style={styles.welcomeTitle}>Welcome to CGM Simulator</Text>
          <Text style={styles.welcomeMessage}>
            Create your patient profile to start simulating glucose levels and tracking treatments.
          </Text>
          <TouchableOpacity 
            style={styles.createPatientButton} 
            onPress={handleCreatePatient}
            disabled={isLoading}
          >
            <Text style={styles.createPatientButtonText}>
              {isLoading ? 'Creating...' : 'Create Patient Profile'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Get the most recent non-future reading (current CGM value)
  const latestReading = glucoseReadings.filter(r => !r.isFuture).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];
  const currentGlucose = latestReading?.value || currentPatient.currentGlucose;
  const iob = latestReading?.iob || 0;
  const cob = latestReading?.cob || 0;

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={isLoading || simulationState.isComputing}
            onRefresh={onRefresh}
            tintColor="#3b82f6"
          />
        }
      >
        <GlucoseChart
          readings={glucoseReadings}
          targetRange={{ low: 70, high: 180 }}
          currentGlucose={currentGlucose}
          iob={iob}
          cob={cob}
          onResetSimulation={resetSimulationWithStableData}
        />

        <QuickTreatment
          onAddTreatment={handleAddTreatment}
          isLoading={isLoading || simulationState.isComputing}
        />

        {/* Simulation status */}
        <View style={styles.statusContainer}>
          <View style={styles.statusHeader}>
            <Ionicons 
              name={simulationState.isComputing ? "hourglass" : "checkmark-circle"} 
              size={20} 
              color={simulationState.isComputing ? "#f59e0b" : "#10b981"} 
            />
            <Text style={styles.statusTitle}>
              {simulationState.isComputing ? 'Computing...' : 'Up to date'}
            </Text>
          </View>
          <Text style={styles.statusText}>
            Last updated: {simulationState.lastComputedAt.toLocaleTimeString()}
          </Text>
          {nextReadingTime && (
            <Text style={styles.statusText}>
              Next reading: {nextReadingTime.toLocaleTimeString()}
            </Text>
          )}
          {simulationState.computedUntil > new Date() && (
            <Text style={styles.statusText}>
              Predicted until: {simulationState.computedUntil.toLocaleTimeString()}
            </Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollView: {
    flex: 1,
  },
  welcomeContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  welcomeMessage: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  createPatientButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  createPatientButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginTop: 16,
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  statusContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  statusTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  statusText: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 2,
  },
});