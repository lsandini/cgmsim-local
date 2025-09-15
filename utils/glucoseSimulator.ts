import {
  Patient,
  Treatment,
  GlucoseReading,
  DEFAULT_INSULIN_CURVE,
  DEFAULT_CARB_CURVE,
  InsulinCurve,
  CarbAbsorption
} from '../types';

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

interface SimulationParams {
  patient: Patient;
  treatments: Treatment[];
  startTime: Date;
  durationHours: number;
  intervalMinutes?: number;
}

interface ActiveTreatment {
  treatment: Treatment;
  timeElapsed: number; // minutes since treatment
}

class GlucoseSimulator {
  private intervalMinutes = 5; // 5-minute simulation intervals
  
  /**
   * Generate Perlin-like noise for glucose variation
   */
  private generateNoise(time: number, amplitude: number): number {
    // Simple pseudo-random noise based on time
    const seed = Math.sin(time / 100) * Math.cos(time / 200) * Math.sin(time / 50);
    return seed * amplitude;
  }

  /**
   * Calculate insulin activity at a given time point
   */
  private getInsulinActivity(minutesElapsed: number, curve: InsulinCurve[] = DEFAULT_INSULIN_CURVE): number {
    if (minutesElapsed <= 0) return 0;
    
    // Find the two points to interpolate between
    let prevPoint = curve[0];
    let nextPoint = curve[curve.length - 1];
    
    for (let i = 0; i < curve.length - 1; i++) {
      if (minutesElapsed >= curve[i].time && minutesElapsed <= curve[i + 1].time) {
        prevPoint = curve[i];
        nextPoint = curve[i + 1];
        break;
      }
    }
    
    if (minutesElapsed >= curve[curve.length - 1].time) {
      return 0; // Insulin has worn off
    }
    
    // Linear interpolation
    const timeDiff = nextPoint.time - prevPoint.time;
    const activityDiff = nextPoint.activity - prevPoint.activity;
    const timeRatio = (minutesElapsed - prevPoint.time) / timeDiff;
    
    return prevPoint.activity + (activityDiff * timeRatio);
  }

  /**
   * Calculate carb absorption at a given time point
   */
  private getCarbAbsorption(minutesElapsed: number, curve: CarbAbsorption[] = DEFAULT_CARB_CURVE): number {
    if (minutesElapsed <= 0) return 0;
    
    let prevPoint = curve[0];
    let nextPoint = curve[curve.length - 1];
    
    for (let i = 0; i < curve.length - 1; i++) {
      if (minutesElapsed >= curve[i].time && minutesElapsed <= curve[i + 1].time) {
        prevPoint = curve[i];
        nextPoint = curve[i + 1];
        break;
      }
    }
    
    if (minutesElapsed >= curve[curve.length - 1].time) {
      return 1.0; // Fully absorbed
    }
    
    // Linear interpolation
    const timeDiff = nextPoint.time - prevPoint.time;
    const absorptionDiff = nextPoint.absorption - prevPoint.absorption;
    const timeRatio = (minutesElapsed - prevPoint.time) / timeDiff;
    
    return prevPoint.absorption + (absorptionDiff * timeRatio);
  }

  /**
   * Calculate insulin on board (IOB) at a specific time
   */
  private calculateIOB(currentTime: Date, treatments: Treatment[], patient: Patient): number {
    let totalIOB = 0;
    
    for (const treatment of treatments) {
      if (treatment.type !== 'insulin') continue;
      
      const minutesElapsed = (currentTime.getTime() - treatment.timestamp.getTime()) / (1000 * 60);
      if (minutesElapsed < 0 || minutesElapsed > patient.insulinDuration * 60) continue;
      
      const activity = this.getInsulinActivity(minutesElapsed);
      const remainingInsulin = treatment.value * (1 - activity);
      totalIOB += remainingInsulin;
    }
    
    return Math.max(0, totalIOB);
  }

  /**
   * Calculate carbs on board (COB) at a specific time
   */
  private calculateCOB(currentTime: Date, treatments: Treatment[], patient: Patient): number {
    let totalCOB = 0;
    
    for (const treatment of treatments) {
      if (treatment.type !== 'carb') continue;
      
      const minutesElapsed = (currentTime.getTime() - treatment.timestamp.getTime()) / (1000 * 60);
      if (minutesElapsed < 0 || minutesElapsed > patient.carbAbsorptionRate * 60) continue;
      
      const absorption = this.getCarbAbsorption(minutesElapsed);
      const remainingCarbs = treatment.value * (1 - absorption);
      totalCOB += remainingCarbs;
    }
    
    return Math.max(0, totalCOB);
  }

  /**
   * Calculate glucose impact from active insulin
   */
  private calculateInsulinEffect(currentTime: Date, treatments: Treatment[], patient: Patient): number {
    let totalEffect = 0;
    
    for (const treatment of treatments) {
      if (treatment.type !== 'insulin') continue;
      
      const minutesElapsed = (currentTime.getTime() - treatment.timestamp.getTime()) / (1000 * 60);
      if (minutesElapsed < 0 || minutesElapsed > patient.insulinDuration * 60) continue;
      
      const activity = this.getInsulinActivity(minutesElapsed);
      const currentActivity = this.getInsulinActivity(minutesElapsed - this.intervalMinutes);
      const deltaActivity = activity - Math.max(0, currentActivity);
      
      if (deltaActivity > 0) {
        totalEffect += deltaActivity * treatment.value * patient.insulinSensitivity;
      }
    }
    
    return totalEffect;
  }

  /**
   * Calculate glucose impact from carb absorption
   */
  private calculateCarbEffect(currentTime: Date, treatments: Treatment[], patient: Patient): number {
    let totalEffect = 0;
    
    for (const treatment of treatments) {
      if (treatment.type !== 'carb') continue;
      
      const minutesElapsed = (currentTime.getTime() - treatment.timestamp.getTime()) / (1000 * 60);
      if (minutesElapsed < 0 || minutesElapsed > patient.carbAbsorptionRate * 60) continue;
      
      const absorption = this.getCarbAbsorption(minutesElapsed);
      const previousAbsorption = this.getCarbAbsorption(minutesElapsed - this.intervalMinutes);
      const deltaAbsorption = absorption - Math.max(0, previousAbsorption);
      
      if (deltaAbsorption > 0) {
        const carbsAbsorbed = deltaAbsorption * treatment.value;
        totalEffect += carbsAbsorbed / patient.carbRatio * patient.insulinSensitivity;
      }
    }
    
    return totalEffect;
  }

  /**
   * Calculate basal insulin effect
   */
  private calculateBasalEffect(currentTime: Date, patient: Patient): number {
    const hour = currentTime.getHours();
    const basalRate = patient.basalRates[hour];
    const basalInsulinPerInterval = (basalRate * this.intervalMinutes) / 60;
    
    return basalInsulinPerInterval * patient.insulinSensitivity;
  }

  /**
   * Calculate liver glucose production
   */
  private calculateLiverGlucoseProduction(patient: Patient): number {
    return patient.liverGlucoseProduction * this.intervalMinutes;
  }

  /**
   * Main simulation function
   */
  simulate(params: SimulationParams): GlucoseReading[] {
    const { patient, treatments, startTime, durationHours, intervalMinutes = 5 } = params;
    this.intervalMinutes = intervalMinutes;

    const readings: GlucoseReading[] = [];
    const totalIntervals = Math.ceil((durationHours * 60) / intervalMinutes);
    let currentGlucose = patient.currentGlucose;

    // Align start time to 5-minute interval
    const alignedStartTime = alignToFiveMinutes(startTime);

    for (let i = 0; i <= totalIntervals; i++) {
      const currentTime = new Date(alignedStartTime.getTime() + i * intervalMinutes * 60 * 1000);
      const timeElapsed = i * intervalMinutes;
      
      if (i > 0) {
        // Calculate glucose change for this interval
        const insulinEffect = this.calculateInsulinEffect(currentTime, treatments, patient);
        const carbEffect = this.calculateCarbEffect(currentTime, treatments, patient);
        const basalEffect = this.calculateBasalEffect(currentTime, patient);
        const liverProduction = this.calculateLiverGlucoseProduction(patient);
        const noise = this.generateNoise(timeElapsed, patient.noiseLevel);
        
        // Apply effects
        currentGlucose -= insulinEffect;
        currentGlucose += carbEffect;
        currentGlucose -= basalEffect;
        currentGlucose += liverProduction;
        currentGlucose += noise;
        
        // Physiological constraints
        currentGlucose = Math.max(40, Math.min(400, currentGlucose));
      }
      
      const iob = this.calculateIOB(currentTime, treatments, patient);
      const cob = this.calculateCOB(currentTime, treatments, patient);
      const isFuture = currentTime > new Date();
      
      readings.push({
        id: `glucose_${currentTime.getTime()}`,
        timestamp: currentTime,
        value: Math.round(currentGlucose * 10) / 10, // Round to 1 decimal
        iob: Math.round(iob * 100) / 100, // Round to 2 decimals
        cob: Math.round(cob * 10) / 10, // Round to 1 decimal
        isFuture,
        patientId: patient.id,
      });
    }
    
    return readings;
  }

  /**
   * Simulate forward from current time
   */
  simulateForward(
    patient: Patient,
    treatments: Treatment[],
    hoursForward: number = 12
  ): GlucoseReading[] {
    const now = new Date();
    const alignedNow = alignToFiveMinutes(now);

    // Include treatments from the last 24 hours that might still be active
    const relevantTreatments = treatments.filter(t => {
      const hoursAgo = (now.getTime() - t.timestamp.getTime()) / (1000 * 60 * 60);
      return hoursAgo <= 24; // Include treatments from last 24 hours
    });

    return this.simulate({
      patient,
      treatments: relevantTreatments,
      startTime: alignedNow,
      durationHours: hoursForward,
      intervalMinutes: this.intervalMinutes,
    });
  }

  /**
   * Update existing readings with new treatments
   */
  updateSimulation(
    patient: Patient,
    treatments: Treatment[],
    existingReadings: GlucoseReading[],
    fromTime: Date
  ): GlucoseReading[] {
    // Keep past readings that are before fromTime
    const pastReadings = existingReadings.filter(r => 
      r.timestamp < fromTime && !r.isFuture
    );
    
    // Get the latest past reading for baseline
    const latestPastReading = pastReadings
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];
    
    if (latestPastReading) {
      // Update patient's current glucose based on latest reading
      patient = { ...patient, currentGlucose: latestPastReading.value };
    }
    
    // Simulate from fromTime forward
    const hoursForward = 12;
    const newReadings = this.simulate({
      patient,
      treatments,
      startTime: fromTime,
      durationHours: hoursForward,
      intervalMinutes: this.intervalMinutes,
    });
    
    // Combine past and new readings
    return [...pastReadings, ...newReadings];
  }
}

export const glucoseSimulator = new GlucoseSimulator();