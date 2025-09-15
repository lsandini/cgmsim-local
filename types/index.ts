export interface Patient {
  id: string;
  name: string;
  weight: number; // kg
  totalDailyDose: number; // units
  insulinSensitivity: number; // mg/dL per unit
  carbRatio: number; // grams per unit
  basalRates: number[]; // 24 hourly rates in units/hour
  targetGlucose: {
    low: number; // mg/dL
    high: number; // mg/dL
  };
  insulinDuration: number; // hours
  carbAbsorptionRate: number; // hours
  liverGlucoseProduction: number; // mg/dL per minute
  currentGlucose: number; // mg/dL
  noiseLevel: number; // variance for glucose noise
  createdAt: Date;
  updatedAt: Date;
}

export interface Treatment {
  id: string;
  timestamp: Date;
  type: 'carb' | 'insulin';
  value: number; // grams for carbs, units for insulin
  metadata?: {
    description?: string;
    rapid?: boolean; // for carbs: fast vs slow absorption
    bolus?: boolean; // for insulin: bolus vs basal adjustment
  };
}

export interface GlucoseReading {
  id: string;
  timestamp: Date;
  value: number; // mg/dL
  iob: number; // insulin on board (units)
  cob: number; // carbs on board (grams)
  isFuture: boolean;
  patientId: string;
}

export interface SimulationState {
  lastComputedAt: Date;
  nextComputationTime: Date;
  computedUntil: Date;
  isComputing: boolean;
}

export interface InsulinCurve {
  time: number; // minutes
  activity: number; // percentage of peak activity
}

export interface CarbAbsorption {
  time: number; // minutes
  absorption: number; // percentage absorbed
}

// Default insulin action curve (based on Humalog/NovoRapid)
export const DEFAULT_INSULIN_CURVE: InsulinCurve[] = [
  { time: 0, activity: 0 },
  { time: 15, activity: 0.1 },
  { time: 30, activity: 0.3 },
  { time: 60, activity: 0.7 },
  { time: 90, activity: 1.0 },
  { time: 120, activity: 0.8 },
  { time: 180, activity: 0.5 },
  { time: 240, activity: 0.2 },
  { time: 300, activity: 0.05 },
  { time: 360, activity: 0 },
];

// Default carb absorption curve
export const DEFAULT_CARB_CURVE: CarbAbsorption[] = [
  { time: 0, absorption: 0 },
  { time: 15, absorption: 0.2 },
  { time: 30, absorption: 0.5 },
  { time: 60, absorption: 0.8 },
  { time: 90, absorption: 0.95 },
  { time: 120, absorption: 1.0 },
];

export const DEFAULT_PATIENT: Omit<Patient, 'id' | 'createdAt' | 'updatedAt'> = {
  name: 'Default Patient',
  weight: 70,
  totalDailyDose: 40,
  insulinSensitivity: 50, // 1 unit lowers glucose by 50 mg/dL
  carbRatio: 12, // 1 unit covers 12g carbs
  basalRates: new Array(24).fill(0.8), // 0.8 units/hour baseline
  targetGlucose: {
    low: 80,
    high: 140,
  },
  insulinDuration: 6, // hours
  carbAbsorptionRate: 2, // hours
  liverGlucoseProduction: 1.5, // mg/dL per minute
  currentGlucose: 120,
  noiseLevel: 5, // mg/dL standard deviation
};