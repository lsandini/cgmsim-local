# CGMSIM Local-First Mobile App - Project Creation Prompt

Create a local-first mobile CGM (Continuous Glucose Monitor) simulator app using Expo SDK 53 with TypeScript. This app simulates glucose values for diabetes management with all computation happening on-device.

## Project Requirements

### Core Functionality
1. **Virtual Patient Management**
   - Create/edit patient profiles with physiological parameters (weight, insulin sensitivity, carb ratio, basal rates, etc.)
   - Store patient data locally using MMKV for state and SQLite for historical data
   - Support multiple insulin action curves and carb absorption models

2. **Glucose Simulation Engine**
   - Implement a physiological model (simplified Bergman or similar)
   - Calculate glucose changes based on: insulin (IOB), carbs (COB), basal rates, liver glucose production
   - Add Perlin noise for realistic variations
   - Pre-compute next 12 hours of glucose values
   - Update calculations when app returns to foreground (if >5 minutes elapsed)

3. **Treatment Input**
   - Quick entry for carbs and insulin with preset buttons
   - Store all treatments with timestamps in SQLite
   - Recalculate future glucose on new treatments

4. **Glucose Visualization**
   - SVG-based chart showing 3 hours past and 3 hours future
   - Past values: clear, solid line
   - Future values: blurred/dashed with reduced opacity
   - Show target range (80-140 mg/dL default)
   - Display current glucose, IOB, and COB

5. **Data Persistence**
   - Use Zustand with MMKV for app state
   - SQLite for treatments and glucose history
   - No server/cloud dependencies

## Technical Stack
- **Framework**: Expo SDK 53 with TypeScript
- **Navigation**: Expo Router (file-based)
- **State**: Zustand + MMKV
- **Database**: Expo SQLite
- **Charts**: react-native-svg-charts or react-native-svg
- **UI**: Native components with StyleSheet
- **Background**: expo-background-fetch (limited to 15-min intervals)

## Project Structure
```
app/
  (tabs)/
    _layout.tsx      # Tab navigation
    index.tsx        # Glucose chart screen
    treatments.tsx   # Treatment history
    profile.tsx      # Patient profile
components/
  GlucoseChart.tsx   # Main chart component
  QuickTreatment.tsx # Carb/insulin input
store/
  useSimulationStore.ts # Zustand store
  database.ts        # SQLite operations
utils/
  glucoseSimulator.ts # Simulation engine
hooks/
  useAppLifecycle.ts # Foreground/background handling
```

## Key Implementation Details

### Glucose Simulation Algorithm
- Use 5-minute intervals for calculations
- Implement insulin-on-board (IOB) decay curves
- Carbs-on-board (COB) with configurable absorption rates
- Basal insulin effects based on hourly rates
- Endogenous glucose production (~1.5 mg/dL/min)

### Background Processing Strategy
Since Expo doesn't support true background processing:
- Pre-compute 12-24 hours ahead when app is active
- Use expo-background-fetch for periodic updates (minimum 15 minutes)
- Recompute on app foreground if >5 minutes since last computation
- Store future values in database for immediate display

### UI/UX Requirements
- Three tabs: Glucose, Treatments, Profile
- Pull-to-refresh on glucose screen to recompute
- Haptic feedback on button presses
- Show loading states during computation
- Empty states for no data

### Data Models
```typescript
Patient: {
  id, name, weight, totalDailyDose,
  insulinSensitivity, carbRatio, basalRates[24],
  targetGlucose: {low, high},
  insulinDuration, carbAbsorptionRate,
  liverGlucoseProduction, currentGlucose, noiseLevel
}

Treatment: {
  id, timestamp, type: 'carb'|'insulin',
  value, metadata
}

GlucoseReading: {
  timestamp, value, iob, cob, isFuture
}
```

## Constraints
- NO platform-specific code (iOS/Android)
- Must work in Expo Go for development
- All packages must be Expo SDK 53 compatible
- Use only managed workflow features

## Initial Setup Commands
```bash
npx create-expo-app@latest cgmsim-local --template blank-typescript
cd cgmsim-local
npx expo install expo-router expo-sqlite expo-blur expo-background-fetch expo-task-manager
npx expo install react-native-svg react-native-svg-charts zustand react-native-mmkv
npm install date-fns uuid
```

## MVP Features Priority
1. Create patient profile with basic parameters
2. Display glucose chart with past/future values
3. Add carb/insulin treatments
4. Show treatment history
5. Background computation of future values

Build this app focusing on reliability, performance, and a clean user interface. The glucose simulation should feel realistic with smooth transitions and appropriate medical ranges.