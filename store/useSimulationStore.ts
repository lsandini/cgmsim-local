import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Patient, Treatment, GlucoseReading, SimulationState, DEFAULT_PATIENT } from '../types';
import { database } from './database';

// Helper function to align timestamp to nearest 5-minute interval
const alignToFiveMinutes = (date: Date): Date => {
  const aligned = new Date(date);
  const minutes = aligned.getMinutes();
  const remainder = minutes % 5;

  if (remainder !== 0) {
    // Round down to nearest 5-minute interval
    aligned.setMinutes(minutes - remainder);
    aligned.setSeconds(0);
    aligned.setMilliseconds(0);
  }

  return aligned;
};

// Helper function to generate stable historical glucose data
const generateHistoricalGlucoseData = (patient: Patient, durationMinutes: number = 30): GlucoseReading[] => {
  const readings: GlucoseReading[] = [];
  const now = new Date();
  const alignedNow = alignToFiveMinutes(now);
  const intervalMinutes = 5;
  const totalReadings = Math.floor(durationMinutes / intervalMinutes) + 1; // +1 for starting point
  const baseGlucose = 108; // mg/dL (6 mmol/L)

  for (let i = 0; i < totalReadings; i++) {
    // Create timestamps aligned to 5-minute intervals
    const timestamp = new Date(alignedNow.getTime() - (totalReadings - 1 - i) * intervalMinutes * 60 * 1000);

    // Add minimal random variation (±2 mg/dL) to make it realistic but stable
    const variation = (Math.random() - 0.5) * 4; // ±2 mg/dL range
    const glucoseValue = baseGlucose + variation;

    readings.push({
      id: `historical_${timestamp.getTime()}`,
      timestamp,
      value: Math.round(glucoseValue * 10) / 10,
      iob: 0, // No insulin on board for historical stable data
      cob: 0, // No carbs on board for historical stable data
      isFuture: false,
      patientId: patient.id,
    });
  }

  return readings;
};


interface SimulationStore {
  // State
  currentPatient: Patient | null;
  currentPatientId: string | null;
  glucoseReadings: GlucoseReading[];
  recentTreatments: Treatment[];
  simulationState: SimulationState;
  isLoading: boolean;
  error: string | null;
  nextReadingTime: Date | null;
  cgmTimer: NodeJS.Timeout | null;

  // Actions
  initializeStore: () => Promise<void>;
  createPatient: (patientData: Partial<Patient>) => Promise<string>;
  loadPatient: (patientId: string) => Promise<void>;
  updatePatient: (updates: Partial<Patient>) => Promise<void>;
  addTreatment: (treatment: Omit<Treatment, 'id'>) => Promise<void>;
  loadTreatments: (limit?: number) => Promise<void>;
  loadGlucoseData: (hoursBack: number, hoursForward: number) => Promise<void>;
  startSimulation: () => Promise<void>;
  updateSimulationState: (state: Partial<SimulationState>) => void;
  setCurrentGlucose: (value: number) => Promise<void>;
  startCGMTimer: () => Promise<void>;
  stopCGMTimer: () => void;
  advanceToNextReading: () => Promise<void>;
  clearError: () => void;
}

// Helper functions for AsyncStorage persistence
const persistToAsyncStorage = async (key: string, value: any) => {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Failed to persist ${key}:`, error);
  }
};

const loadFromAsyncStorage = async <T>(key: string, defaultValue: T): Promise<T> => {
  try {
    const stored = await AsyncStorage.getItem(key);
    return stored ? JSON.parse(stored) : defaultValue;
  } catch (error) {
    console.error(`Failed to load ${key}:`, error);
    return defaultValue;
  }
};

export const useSimulationStore = create<SimulationStore>((set, get) => ({
  // Initial state
  currentPatient: null,
  currentPatientId: null,
  glucoseReadings: [],
  recentTreatments: [],
  simulationState: {
    lastComputedAt: new Date(),
    nextComputationTime: new Date(),
    computedUntil: new Date(),
    isComputing: false,
  },
  isLoading: false,
  error: null,
  nextReadingTime: null,
  cgmTimer: null,

  // Initialize store and database
  initializeStore: async () => {
    try {
      console.log('Starting store initialization...');
      set({ isLoading: true, error: null });

      console.log('Initializing database...');
      await database.init();
      console.log('Database initialized successfully');

      // Load currentPatientId from AsyncStorage
      const currentPatientId = await loadFromAsyncStorage('currentPatientId', null);
      set({ currentPatientId });
      console.log('Current patient ID:', currentPatientId);

      if (currentPatientId) {
        console.log('Loading existing patient...');
        await get().loadPatient(currentPatientId);
      }

      console.log('Store initialization complete');
      set({ isLoading: false });
    } catch (error) {
      console.error('Store initialization failed:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to initialize store',
        isLoading: false
      });
    }
  },

  // Create a new patient
  createPatient: async (patientData) => {
    try {
      set({ isLoading: true, error: null });

      const patientId = `patient_${Date.now()}`;
      const now = new Date();

      const patient: Patient = {
        ...DEFAULT_PATIENT,
        ...patientData,
        id: patientId,
        currentGlucose: 108, // Set initial glucose to 108 mg/dL
        createdAt: now,
        updatedAt: now,
      };

      await database.savePatient(patient);

      // Generate and save 30 minutes of stable historical glucose data
      const historicalReadings = generateHistoricalGlucoseData(patient, 30);
      await database.saveGlucoseReadings(historicalReadings);

      // Set as current patient
      set({
        currentPatient: patient,
        currentPatientId: patientId,
        isLoading: false
      });

      await persistToAsyncStorage('currentPatientId', patientId);

      return patientId;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to create patient',
        isLoading: false
      });
      throw error;
    }
  },

  // Load patient data
  loadPatient: async (patientId) => {
    try {
      set({ isLoading: true, error: null });
      
      const patient = await database.getPatient(patientId);
      if (!patient) {
        throw new Error('Patient not found');
      }

      set({ 
        currentPatient: patient,
        currentPatientId: patientId,
      });
      
      await persistToAsyncStorage('currentPatientId', patientId);
      
      // Load recent data
      await get().loadTreatments(20);
      await get().loadGlucoseData(24, 2); // Load 24 hours historical + 2 hours future

      // Start CGM timer for real-time updates
      await get().startCGMTimer();

      set({ isLoading: false });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to load patient',
        isLoading: false 
      });
    }
  },

  // Update patient data
  updatePatient: async (updates) => {
    try {
      const { currentPatient } = get();
      if (!currentPatient) {
        throw new Error('No current patient');
      }

      const updatedPatient: Patient = {
        ...currentPatient,
        ...updates,
        updatedAt: new Date(),
      };

      await database.savePatient(updatedPatient);
      set({ currentPatient: updatedPatient });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to update patient'
      });
    }
  },

  // Add a new treatment
  addTreatment: async (treatmentData) => {
    try {
      const { currentPatientId } = get();
      if (!currentPatientId) {
        throw new Error('No current patient');
      }

      const treatment: Treatment = {
        ...treatmentData,
        id: `treatment_${Date.now()}`,
      };

      await database.saveTreatment(treatment, currentPatientId);
      
      // Reload treatments and trigger simulation
      await get().loadTreatments(20);
      await get().startSimulation();
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to add treatment'
      });
    }
  },

  // Load recent treatments
  loadTreatments: async (limit = 20) => {
    try {
      const { currentPatientId } = get();
      if (!currentPatientId) return;

      const treatments = await database.getTreatments(currentPatientId);
      set({ recentTreatments: treatments.slice(0, limit) });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to load treatments'
      });
    }
  },

  // Load glucose data for chart (historical and future predictions)
  loadGlucoseData: async (hoursBack, hoursForward = 2) => {
    try {
      const { currentPatientId } = get();
      if (!currentPatientId) return;

      const now = new Date();
      const from = new Date(now.getTime() - hoursBack * 60 * 60 * 1000);
      // Include future predictions up to specified hours forward
      const to = new Date(now.getTime() + hoursForward * 60 * 60 * 1000);

      const allReadings = await database.getGlucoseReadings(currentPatientId, from, to);

      // Include both historical and future readings (up to 1 hour of predictions)
      set({ glucoseReadings: allReadings });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load glucose data'
      });
    }
  },

  // Start glucose simulation
  startSimulation: async () => {
    try {
      const { currentPatient, recentTreatments, simulationState } = get();
      if (!currentPatient || simulationState.isComputing) return;

      set({ 
        simulationState: { 
          ...simulationState, 
          isComputing: true,
          lastComputedAt: new Date(),
        }
      });

      // Import the simulator
      const { glucoseSimulator } = await import('../utils/glucoseSimulator');

      // Get treatments from the last 24 hours that might still be active
      const now = new Date();
      const relevantTreatments = recentTreatments.filter(t => {
        const hoursAgo = (now.getTime() - t.timestamp.getTime()) / (1000 * 60 * 60);
        return hoursAgo <= 24;
      });

      // Clear future readings from database
      await database.clearFutureReadings(currentPatient.id, now);

      // Generate new simulation data
      const futureReadings = glucoseSimulator.simulateForward(
        currentPatient,
        relevantTreatments,
        12 // 12 hours forward
      );

      // Save readings to database
      await database.saveGlucoseReadings(futureReadings);

      // Update simulation state
      const computedUntil = new Date(now.getTime() + 12 * 60 * 60 * 1000);
      set({
        simulationState: {
          lastComputedAt: now,
          nextComputationTime: new Date(now.getTime() + 5 * 60 * 1000), // Next in 5 min
          computedUntil,
          isComputing: false,
        }
      });

      // Reload glucose data to update the chart
      await get().loadGlucoseData(24, 2);
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Simulation failed',
        simulationState: { ...get().simulationState, isComputing: false }
      });
    }
  },

  // Update simulation state
  updateSimulationState: (updates) => {
    set({ 
      simulationState: { ...get().simulationState, ...updates }
    });
  },

  // Set current glucose value
  setCurrentGlucose: async (value) => {
    try {
      await get().updatePatient({ currentGlucose: value });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to update glucose'
      });
    }
  },

  // Start CGM timer for real-time readings
  startCGMTimer: async () => {
    const { currentPatientId, cgmTimer } = get();
    if (!currentPatientId) return;

    // Clear existing timer
    if (cgmTimer) {
      clearInterval(cgmTimer);
    }

    console.log('Starting CGM timer...');

    // Get next reading time
    const nextTime = await database.getNextReadingTime(currentPatientId);
    if (nextTime) {
      set({ nextReadingTime: nextTime });
      console.log('Next reading scheduled for:', nextTime.toLocaleTimeString());
    }

    // Set up interval to check every 30 seconds
    const timer = setInterval(async () => {
      await get().advanceToNextReading();
    }, 30000); // Check every 30 seconds

    set({ cgmTimer: timer });
  },

  // Stop CGM timer
  stopCGMTimer: () => {
    const { cgmTimer } = get();
    if (cgmTimer) {
      clearInterval(cgmTimer);
      set({ cgmTimer: null, nextReadingTime: null });
      console.log('CGM timer stopped');
    }
  },

  // Advance to next reading if it's time
  advanceToNextReading: async () => {
    try {
      const { currentPatientId, nextReadingTime } = get();
      if (!currentPatientId || !nextReadingTime) return;

      const now = new Date();
      if (now >= nextReadingTime) {
        console.log('Advancing to next CGM reading...');

        // Advance the reading in database
        const newReading = await database.advanceNextReading(currentPatientId);

        if (newReading) {
          console.log(`New CGM reading: ${newReading.value} mg/dL at ${newReading.timestamp.toLocaleTimeString()}`);

          // Update current glucose in patient
          await get().updatePatient({ currentGlucose: newReading.value });

          // Reload glucose data to update the chart
          await get().loadGlucoseData(24, 2);

          // Get next reading time
          const nextTime = await database.getNextReadingTime(currentPatientId);
          set({ nextReadingTime: nextTime });

          if (nextTime) {
            console.log('Next reading scheduled for:', nextTime.toLocaleTimeString());
          } else {
            console.log('No more future readings available - triggering simulation');
            // Trigger new simulation to generate more readings
            await get().startSimulation();
          }
        }
      }
    } catch (error) {
      console.error('Failed to advance CGM reading:', error);
    }
  },

  // Clear error state
  clearError: () => {
    set({ error: null });
  },
}));