# CGM Local-First Glucose Computation Implementation

## Context
I'm developing a Type 1 Diabetes simulator mobile app using Expo SDK 54. This is a local-first version of CGMSIM v3 (which runs in the cloud). The app needs to compute glucose curves in advance since mobile apps can't run calculations in the background.

## Current Status
- Graph component: ✅ Completed
- Expo app structure: ✅ Set up
- cgmsim-lib: Available as npm package (https://github.com/lsandini/cgmsim-lib)

## Core Strategy
1. **Pre-compute** glucose curves for the next 24-48 hours while app is active
2. **Dual-array system**:
   - Clean predictions (deterministic math)
   - Display values (with Perlin noise for realism)
3. **Progressive reveal**: Show past/current with noise, future as clean predictions
4. **Local storage**: Persist pre-computed curves in SQLite

## Implementation Plan

### Phase 1: Library Integration
**Goal**: Integrate cgmsim-lib into the Expo app
- Install cgmsim-lib from npm: `npm install cgmsim-lib`
- Test import and basic functionality in Expo environment
- Identify any Node.js dependencies requiring polyfills
- Add necessary polyfills if needed (e.g., `react-native-get-random-values`)

### Phase 2: Therapy Mode Configuration
**Goal**: Support both MDI and pump therapy modes
- Implement therapy mode selector:
  - **MDI (Multiple Daily Injections)**: Separate basal/bolus insulins
  - **Pump therapy**: Continuous basal infusion + boluses
- Store user's therapy preference in settings

### Phase 3: Pre-computed Insulin Activity Curves
**Goal**: Create reusable normalized insulin activity profiles
- **MDI Mode insulins**:
  - Long-acting analogs (basal):
    - **Lantus/Toujeo**: 20-24 hour flat curve
    - **Levemir**: 12-20 hour curve (twice daily)
    - **Tresiba**: 42 hour ultra-flat curve
  - Rapid-acting (mealtime):
    - **Humalog/Novolog**: 4-5 hour curve, 60-90min peak
    - **Apidra**: 3-4 hour curve, 60min peak
    - **Fiasp**: 3-4 hour curve, 30-50min peak
- **Pump Mode**:
  - Implement "basal as boluses": every 5min of basal = mini-bolus
  - Use rapid-acting insulin curves for both basal and boluses
- Store curves as constants indexed by insulin type
- Implement calculation: `glucose_effect = activity[index] × units × ISF`
- Create IOB (Insulin on Board) function: sum remaining activities

**Example structure**:
```typescript
const INSULIN_CURVES = {
  // Rapid-acting
  'humalog': [...], // 4-5hr curve
  'fiasp': [...],   // 3-4hr curve, earlier peak

  // Long-acting
  'lantus': [...],  // 24hr flat
  'tresiba': [...], // 42hr ultra-flat

  // Pump basal (5min micro-boluses)
  'pump_basal': [...] // Same as rapid curve
}
```

### Phase 4: Carbohydrate Absorption Curves
**Goal**: Model carb absorption profiles
- Create normalized absorption curves for 1g carb:
  - **Fast carbs**: 15-30 min peak (juice, glucose tabs)
  - **Medium carbs**: 30-60 min peak (bread, fruit)
  - **Slow carbs**: 60-120 min peak (pasta, pizza)
- Implement COB (Carbs on Board) calculation
- Apply CSF (Carb Sensitivity Factor)

### Phase 5: Unit System Configuration
**Goal**: Support both mg/dL and mmol/L units
- Implement unit preference in user settings
- Create conversion utilities:
  - `mgToMmol(mg: number): number` (divide by 18.0182)
  - `mmolToMg(mmol: number): number` (multiply by 18.0182)
- Apply conversions at:
  - Display layer (graph, current value)
  - User input (target ranges, corrections)
  - Alert thresholds
- Store internally in mg/dL for consistency
- Format display values appropriately:
  - mg/dL: integer (e.g., "120")
  - mmol/L: one decimal (e.g., "6.7")

### Phase 6: Glucose Computation Engine
**Goal**: Calculate complete glucose curves
- Build 24-hour prediction calculator combining:
  - Basal rate / endogenous glucose production
  - Sum of all active insulin activities
  - Sum of all active carb absorptions
  - Net glucose change per 5min interval
- Track active doses and meals:

```typescript
interface Dose {
  timestamp: Date
  units: number
  type: 'rapid' | 'long'
  currentIndex: number // position in activity curve
}

interface Meal {
  timestamp: Date
  carbs: number
  absorptionTime: number
  currentIndex: number
}
```

### Phase 7: Dual-Array System
**Goal**: Separate predictions from realistic display
- Create parallel arrays:
  - `glucoseClean[288]`: Deterministic math (24hr @ 5min)
  - `glucoseDisplay[288]`: Clean + Perlin noise
- Time-based reveal logic:
  - **Past**: Show display values (with noise)
  - **Current**: Show display value (with noise)
  - **Future**: Show clean predictions (no noise)

### Phase 8: Perlin Noise Implementation
**Goal**: Add realistic CGM variability
- Implement or import Perlin noise generator
- Configure parameters:
  - **Base amplitude**: ±10 mg/dL
  - **Frequency**: 0.02-0.03 (slow biological drift)
  - **Octaves**: 2-3 for layered variation
- Variability modifiers by context:
  - Exercise: ×1.5 amplitude
  - Night: ×0.5 amplitude
  - Stress/illness: ×2.0 amplitude
  - Dawn phenomenon: gradual increase 4-8am
- Use deterministic seed for reproducibility

### Phase 9: Data Persistence
**Goal**: Store pre-computed curves locally
- Use expo-sqlite for storage
- Schema design:

```sql
-- Insulin doses
CREATE TABLE doses (
  id INTEGER PRIMARY KEY,
  timestamp INTEGER,
  units REAL,
  type TEXT,
  insulin_type TEXT
);

-- Meals
CREATE TABLE meals (
  id INTEGER PRIMARY KEY,
  timestamp INTEGER,
  carbs REAL,
  absorption_time INTEGER
);

-- Pre-computed glucose curves
CREATE TABLE glucose_curves (
  timestamp INTEGER PRIMARY KEY,
  clean_value REAL,
  display_value REAL,
  iob REAL,
  cob REAL
);
```

### Phase 10: Background Computation Strategy
**Goal**: Work within mobile OS constraints
- Pre-compute 48 hours ahead when app is active
- Store all curves in database
- Progressive reveal based on current time
- Recomputation triggers:
  - New insulin dose entered
  - New meal logged
  - Settings changed (ISF, CSF, basal rates)
  - App becomes active after >1 hour

### Phase 11: Graph Integration
**Goal**: Connect to existing graph component
- Feed computed values to graph
- Visual differentiation:
  - **Past/Current**: Solid line (display values)
  - **Future**: Dashed line (predictions)
  - **IOB/COB**: Area charts below
- Smooth animation as time progresses
- Update every 5 minutes

### Phase 12: Glucose Alert Notifications
**Goal**: Implement hypo/hyperglycemic alerts
- Configure alert thresholds in settings:
  - **Urgent Low**: <55 mg/dL (3.1 mmol/L)
  - **Low**: <70 mg/dL (3.9 mmol/L)
  - **High**: >180 mg/dL (10.0 mmol/L)
  - **Urgent High**: >250 mg/dL (13.9 mmol/L)
- Implement notification logic:
  - Use expo-notifications for local alerts
  - Smart snoozing (don't repeat within 15-30min)
  - Predictive alerts ("Low predicted in 20min")
  - Rising/falling rate alerts
- Notification customization:
  - Sound/vibration patterns per alert type
  - Quiet hours configuration
  - Alert preview on graph (shaded zones)

### Phase 13: Physical Activity Integration
**Goal**: Adjust insulin sensitivity based on exercise
- Platform-specific health data access:
  - iOS: HealthKit integration via expo-health
  - Android: Google Fit API
- Activity data collection:
  - Steps, active calories, workout sessions
  - Heart rate data if available
- Insulin sensitivity adjustments:
  - During activity: ISF × 1.5-2.0 (more sensitive)
  - Post-activity: Extended sensitivity (2-8 hours)
  - Activity intensity mapping:
    - Light: walking (ISF × 1.2)
    - Moderate: jogging (ISF × 1.5)
    - Intense: running/sports (ISF × 2.0)
- Carb absorption changes:
  - Slower absorption during intense exercise
  - Faster post-exercise (glycogen replenishment)

### Phase 14: Testing & Validation
**Goal**: Ensure accuracy and realism
- Validate insulin curves against published profiles
- Test overlapping doses (stacking)
- Verify IOB/COB calculations
- Compare with CGMSIM v3 outputs
- Test app restart/persistence
- Validate noise patterns look realistic

## Technical Requirements

### Dependencies
```json
{
  "cgmsim-lib": "latest",
  "expo-sqlite": "~14.0.0",
  "perlin-noise": "^0.0.1",
  "expo-notifications": "~0.29.0",
  "expo-health": "latest",
  "react-native-health": "latest",
  "react-native-google-fit": "latest"
}
```

### Key Functions to Implement
```typescript
// Core computation
function computeGlucoseCurve(hours: number): GlucosePoint[]
function calculateIOB(doses: Dose[]): number
function calculateCOB(meals: Meal[]): number

// Therapy modes
function configureMDIMode(basalInsulin: string, bolusInsulin: string): void
function configurePumpMode(basalRates: HourlyRate[]): void
function computeBasalAsBoluses(rate: number): Dose[]

// Insulin activity
function getInsulinActivity(type: string, minutesSinceAdmin: number): number
function applyInsulinEffect(activity: number, units: number, isf: number): number

// Carb absorption
function getCarbAbsorption(type: string, minutesSinceMeal: number): number
function applyCarbEffect(absorption: number, grams: number, csf: number): number

// Unit conversion
function mgToMmol(mg: number): number
function mmolToMg(mmol: number): number
function formatGlucose(value: number, unit: 'mg/dL' | 'mmol/L'): string

// Alerts
function checkGlucoseAlerts(current: number, predicted: number[]): Alert[]
function scheduleNotification(alert: Alert): void
function shouldSuppressAlert(type: string, lastAlertTime: Date): boolean

// Activity integration
function fetchActivityData(start: Date, end: Date): ActivityData[]
function adjustISFForActivity(baseISF: number, activity: ActivityData): number
function adjustCarbAbsorptionForActivity(baseRate: number, activity: ActivityData): number

// Noise generation
function generatePerlinNoise(seed: number, length: number, params: NoiseParams): number[]
function applyContextualVariability(baseNoise: number, context: Context): number

// Storage
async function saveGlucoseCurves(curves: GlucosePoint[]): Promise<void>
async function loadGlucoseCurves(from: Date, to: Date): Promise<GlucosePoint[]>
```

## Performance Targets
- Compute 24hr in <500ms
- Store 48hr of data in <1MB
- Update display every 5min with <50ms latency
- Smooth 60fps graph scrolling with 288 points

## Notes for Implementation
- Start with Phase 1-2 to validate cgmsim-lib integration
- Phases 2-3 can be developed in parallel (insulin & carbs)
- Test each phase thoroughly before moving on
- Keep noise subtle - CGMs are fairly stable
- Consider adding a "scenario mode" for testing edge cases
- Document any deviations from cgmsim-lib algorithms

## Implementation Priority Order

### Essential Features (MVP)
1. **Phase 1**: Library Integration
2. **Phase 2**: Therapy Mode Configuration
3. **Phase 3**: Insulin Activity Curves
4. **Phase 4**: Carbohydrate Absorption
5. **Phase 5**: Unit System (mg/dL and mmol/L)
6. **Phase 6**: Glucose Computation Engine
7. **Phase 7**: Dual-Array System
8. **Phase 9**: Data Persistence
9. **Phase 11**: Graph Integration

### Enhanced Realism
10. **Phase 8**: Perlin Noise Implementation
11. **Phase 10**: Background Computation Strategy

### Advanced Features
12. **Phase 12**: Alert Notifications
13. **Phase 13**: Physical Activity Integration
14. **Phase 14**: Testing & Validation

## Success Criteria
- [ ] Both MDI and pump modes fully functional
- [ ] All major insulin types supported with accurate curves
- [ ] Basal-as-boluses implementation for pumps
- [ ] Seamless mg/dL ↔ mmol/L conversion
- [ ] Glucose predictions match CGMSIM v3 within ±5%
- [ ] Noise patterns indistinguishable from real CGM
- [ ] Alert notifications working on both iOS/Android
- [ ] Activity data influencing insulin sensitivity
- [ ] App remains responsive during computation
- [ ] Curves persist correctly across app restarts
- [ ] IOB/COB calculations match standard pumps
- [ ] Works offline without any cloud dependency