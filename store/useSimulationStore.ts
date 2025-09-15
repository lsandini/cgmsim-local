import { create } from 'zustand';
import { MMKV } from 'react-native-mmkv';
import { Patient, Treatment, GlucoseReading, SimulationState, DEFAULT_PATIENT } from '../types';
import { database } from './database';

// Initialize storage only on client side
let storage: MMKV | null = null;
const getStorage = () => {
  if (typeof window !== 'undefined' && !storage) {
    storage = new MMKV();
  }
  return storage;
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
  clearError: () => void;
}

// Helper functions for MMKV persistence
const persistToMMKV = (key: string, value: any) => {
  try {
    const storageInstance = getStorage();
    if (storageInstance) {
      storageInstance.set(key, JSON.stringify(value));
    }
  } catch (error) {
    console.error(`Failed to persist ${key}:`, error);
  }
};

const loadFromMMKV = <T>(key: string, defaultValue: T): T => {
  try {
    const storageInstance = getStorage();
    if (!storageInstance) return defaultValue;

    const stored = storageInstance.getString(key);
    return stored ? JSON.parse(stored) : defaultValue;
  } catch (error) {
    console.error(`Failed to load ${key}:`, error);
    return defaultValue;
  }
};

export const useSimulationStore = create<SimulationStore>((set, get) => ({
  // Initial state
  currentPatient: null,
  currentPatientId: loadFromMMKV('currentPatientId', null),
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

  // Initialize store and database
  initializeStore: async () => {
    try {
      console.log('Starting store initialization...');
      set({ isLoading: true, error: null });

      console.log('Initializing database...');
      await database.init();
      console.log('Database initialized successfully');

      const currentPatientId = get().currentPatientId;
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
        createdAt: now,
        updatedAt: now,
      };

      await database.savePatient(patient);
      
      // Set as current patient
      set({ 
        currentPatient: patient,
        currentPatientId: patientId,
        isLoading: false 
      });
      
      persistToMMKV('currentPatientId', patientId);
      
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
      
      persistToMMKV('currentPatientId', patientId);
      
      // Load recent data
      await get().loadTreatments(20);
      await get().loadGlucoseData(3, 3);
      
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

  // Load glucose data for chart
  loadGlucoseData: async (hoursBack, hoursForward) => {
    try {
      const { currentPatientId } = get();
      if (!currentPatientId) return;

      const now = new Date();
      const from = new Date(now.getTime() - hoursBack * 60 * 60 * 1000);
      const to = new Date(now.getTime() + hoursForward * 60 * 60 * 1000);

      const readings = await database.getGlucoseReadings(currentPatientId, from, to);
      set({ glucoseReadings: readings });
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
      await get().loadGlucoseData(3, 3);
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

  // Clear error state
  clearError: () => {
    set({ error: null });
  },
}));