import * as SQLite from 'expo-sqlite';
import { Treatment, GlucoseReading, Patient } from '../types';

const DB_NAME = 'cgmsim.db';

class Database {
  private db: SQLite.SQLiteDatabase | null = null;

  async init() {
    if (this.db) return;

    try {
      console.log('Initializing database...');
      this.db = await SQLite.openDatabaseAsync(DB_NAME);
      console.log('Database opened successfully');
      await this.createTables();
      console.log('Database tables created successfully');
    } catch (error) {
      console.error('Database initialization failed:', error);
      throw error;
    }
  }

  private async createTables() {
    if (!this.db) throw new Error('Database not initialized');

    // Patients table
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS patients (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        weight REAL NOT NULL,
        totalDailyDose REAL NOT NULL,
        insulinSensitivity REAL NOT NULL,
        carbRatio REAL NOT NULL,
        basalRates TEXT NOT NULL,
        targetGlucoseLow REAL NOT NULL,
        targetGlucoseHigh REAL NOT NULL,
        insulinDuration REAL NOT NULL,
        carbAbsorptionRate REAL NOT NULL,
        liverGlucoseProduction REAL NOT NULL,
        currentGlucose REAL NOT NULL,
        noiseLevel REAL NOT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );
    `);

    // Treatments table
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS treatments (
        id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('carb', 'insulin')),
        value REAL NOT NULL,
        metadata TEXT,
        patientId TEXT NOT NULL,
        FOREIGN KEY (patientId) REFERENCES patients (id)
      );
    `);

    // Glucose readings table
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS glucose_readings (
        id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        value REAL NOT NULL,
        iob REAL NOT NULL,
        cob REAL NOT NULL,
        isFuture INTEGER NOT NULL,
        patientId TEXT NOT NULL,
        FOREIGN KEY (patientId) REFERENCES patients (id)
      );
    `);

    // Create indexes for better query performance
    await this.db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_treatments_timestamp ON treatments (timestamp);
      CREATE INDEX IF NOT EXISTS idx_treatments_patient ON treatments (patientId);
      CREATE INDEX IF NOT EXISTS idx_glucose_timestamp ON glucose_readings (timestamp);
      CREATE INDEX IF NOT EXISTS idx_glucose_patient ON glucose_readings (patientId);
    `);
  }

  // Patient operations
  async savePatient(patient: Patient): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const basalRatesJson = JSON.stringify(patient.basalRates);
    
    await this.db.runAsync(
      `INSERT OR REPLACE INTO patients (
        id, name, weight, totalDailyDose, insulinSensitivity, carbRatio,
        basalRates, targetGlucoseLow, targetGlucoseHigh, insulinDuration,
        carbAbsorptionRate, liverGlucoseProduction, currentGlucose, noiseLevel,
        createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        patient.id, patient.name, patient.weight, patient.totalDailyDose,
        patient.insulinSensitivity, patient.carbRatio, basalRatesJson,
        patient.targetGlucose.low, patient.targetGlucose.high, patient.insulinDuration,
        patient.carbAbsorptionRate, patient.liverGlucoseProduction, patient.currentGlucose,
        patient.noiseLevel, patient.createdAt.toISOString(), patient.updatedAt.toISOString()
      ]
    );
  }

  async getPatient(id: string): Promise<Patient | null> {
    if (!this.db) throw new Error('Database not initialized');

    const result = await this.db.getFirstAsync<any>(
      'SELECT * FROM patients WHERE id = ?',
      [id]
    );

    if (!result) return null;

    return {
      id: result.id,
      name: result.name,
      weight: result.weight,
      totalDailyDose: result.totalDailyDose,
      insulinSensitivity: result.insulinSensitivity,
      carbRatio: result.carbRatio,
      basalRates: JSON.parse(result.basalRates),
      targetGlucose: {
        low: result.targetGlucoseLow,
        high: result.targetGlucoseHigh,
      },
      insulinDuration: result.insulinDuration,
      carbAbsorptionRate: result.carbAbsorptionRate,
      liverGlucoseProduction: result.liverGlucoseProduction,
      currentGlucose: result.currentGlucose,
      noiseLevel: result.noiseLevel,
      createdAt: new Date(result.createdAt),
      updatedAt: new Date(result.updatedAt),
    };
  }

  // Treatment operations
  async saveTreatment(treatment: Treatment, patientId: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const metadataJson = treatment.metadata ? JSON.stringify(treatment.metadata) : null;
    
    await this.db.runAsync(
      `INSERT INTO treatments (id, timestamp, type, value, metadata, patientId)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        treatment.id,
        treatment.timestamp.toISOString(),
        treatment.type,
        treatment.value,
        metadataJson,
        patientId,
      ]
    );
  }

  async getTreatments(patientId: string, since?: Date): Promise<Treatment[]> {
    if (!this.db) throw new Error('Database not initialized');

    let query = 'SELECT * FROM treatments WHERE patientId = ?';
    const params: any[] = [patientId];

    if (since) {
      query += ' AND timestamp >= ?';
      params.push(since.toISOString());
    }

    query += ' ORDER BY timestamp DESC';

    const results = await this.db.getAllAsync<any>(query, params);

    return results.map(row => ({
      id: row.id,
      timestamp: new Date(row.timestamp),
      type: row.type as 'carb' | 'insulin',
      value: row.value,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    }));
  }

  // Glucose reading operations
  async saveGlucoseReadings(readings: GlucoseReading[]): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.withTransactionAsync(async () => {
      for (const reading of readings) {
        await this.db!.runAsync(
          `INSERT OR REPLACE INTO glucose_readings 
           (id, timestamp, value, iob, cob, isFuture, patientId)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            reading.id,
            reading.timestamp.toISOString(),
            reading.value,
            reading.iob,
            reading.cob,
            reading.isFuture ? 1 : 0,
            reading.patientId,
          ]
        );
      }
    });
  }

  async getGlucoseReadings(
    patientId: string, 
    from: Date, 
    to: Date
  ): Promise<GlucoseReading[]> {
    if (!this.db) throw new Error('Database not initialized');

    const results = await this.db.getAllAsync<any>(
      `SELECT * FROM glucose_readings 
       WHERE patientId = ? AND timestamp >= ? AND timestamp <= ?
       ORDER BY timestamp ASC`,
      [patientId, from.toISOString(), to.toISOString()]
    );

    return results.map(row => ({
      id: row.id,
      timestamp: new Date(row.timestamp),
      value: row.value,
      iob: row.iob,
      cob: row.cob,
      isFuture: row.isFuture === 1,
      patientId: row.patientId,
    }));
  }

  async clearFutureReadings(patientId: string, from: Date): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.runAsync(
      'DELETE FROM glucose_readings WHERE patientId = ? AND isFuture = 1 AND timestamp >= ?',
      [patientId, from.toISOString()]
    );
  }

  async getLatestGlucoseReading(patientId: string): Promise<GlucoseReading | null> {
    if (!this.db) throw new Error('Database not initialized');

    const result = await this.db.getFirstAsync<any>(
      `SELECT * FROM glucose_readings 
       WHERE patientId = ? AND isFuture = 0
       ORDER BY timestamp DESC LIMIT 1`,
      [patientId]
    );

    if (!result) return null;

    return {
      id: result.id,
      timestamp: new Date(result.timestamp),
      value: result.value,
      iob: result.iob,
      cob: result.cob,
      isFuture: result.isFuture === 1,
      patientId: result.patientId,
    };
  }

  // Advance next future reading to current
  async advanceNextReading(patientId: string): Promise<GlucoseReading | null> {
    if (!this.db) throw new Error('Database not initialized');

    // Get the earliest future reading
    const nextReading = await this.db.getFirstAsync<any>(
      `SELECT * FROM glucose_readings
       WHERE patientId = ? AND isFuture = 1 AND timestamp <= ?
       ORDER BY timestamp ASC LIMIT 1`,
      [patientId, new Date().toISOString()]
    );

    if (!nextReading) return null;

    // Mark it as current (not future)
    await this.db.runAsync(
      'UPDATE glucose_readings SET isFuture = 0 WHERE id = ?',
      [nextReading.id]
    );

    return {
      id: nextReading.id,
      timestamp: new Date(nextReading.timestamp),
      value: nextReading.value,
      iob: nextReading.iob,
      cob: nextReading.cob,
      isFuture: false,
      patientId: nextReading.patientId,
    };
  }

  // Get next scheduled reading time
  async getNextReadingTime(patientId: string): Promise<Date | null> {
    if (!this.db) throw new Error('Database not initialized');

    const nextReading = await this.db.getFirstAsync<any>(
      `SELECT timestamp FROM glucose_readings
       WHERE patientId = ? AND isFuture = 1
       ORDER BY timestamp ASC LIMIT 1`,
      [patientId]
    );

    return nextReading ? new Date(nextReading.timestamp) : null;
  }

  // Insert a single glucose reading
  async insertGlucoseReading(reading: GlucoseReading): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.runAsync(
      `INSERT OR REPLACE INTO glucose_readings
       (id, timestamp, value, iob, cob, isFuture, patientId)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        reading.id,
        reading.timestamp.toISOString(),
        reading.value,
        reading.iob,
        reading.cob,
        reading.isFuture ? 1 : 0,
        reading.patientId,
      ]
    );
  }

  // Clear all glucose data for a patient
  async clearGlucoseData(patientId: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.runAsync(
      'DELETE FROM glucose_readings WHERE patientId = ?',
      [patientId]
    );
    console.log(`Cleared all glucose data for patient ${patientId}`);
  }

  // Cleanup old data
  async cleanupOldData(patientId: string, before: Date): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.withTransactionAsync(async () => {
      // Keep treatments for longer (30 days)
      const treatmentCutoff = new Date(before.getTime() - 30 * 24 * 60 * 60 * 1000);
      await this.db!.runAsync(
        'DELETE FROM treatments WHERE patientId = ? AND timestamp < ?',
        [patientId, treatmentCutoff.toISOString()]
      );

      // Keep past glucose readings for 7 days
      await this.db!.runAsync(
        'DELETE FROM glucose_readings WHERE patientId = ? AND isFuture = 0 AND timestamp < ?',
        [patientId, before.toISOString()]
      );
    });
  }
}

export const database = new Database();