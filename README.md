# CGM Simulator - Local-First Mobile App

A local-first mobile application built with Expo that simulates continuous glucose monitoring (CGM) for diabetes management. All computations happen on-device with no server dependencies.

## Features

### Core Functionality
- **Virtual Patient Management**: Create and customize patient profiles with physiological parameters
- **Glucose Simulation Engine**: Real-time glucose prediction based on treatments and physiological models
- **Treatment Tracking**: Log carbs and insulin with quick-entry presets
- **Interactive Charts**: Visual glucose trends with past/future predictions
- **Local Data Storage**: All data stored locally using SQLite and MMKV

### Key Components
- **Glucose Chart**: SVG-based visualization showing 3 hours past and 3 hours future
- **Quick Treatment Entry**: Fast carb/insulin logging with preset values
- **Patient Profile Management**: Customizable physiological parameters
- **Background Processing**: Automatic recomputation when app returns to foreground

## Technical Stack

- **Framework**: Expo SDK 53+ with TypeScript
- **Navigation**: Expo Router (file-based routing)
- **State Management**: Zustand with MMKV persistence
- **Database**: Expo SQLite for treatments and glucose history
- **Charts**: React Native SVG for glucose visualization
- **Background Processing**: App lifecycle handling for automatic updates

## Project Structure

```
app/
  (tabs)/
    _layout.tsx      # Tab navigation
    index.tsx        # Glucose chart screen
    treatments.tsx   # Treatment history
    profile.tsx      # Patient profile settings
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
types/
  index.ts          # TypeScript definitions
```

## Getting Started

### Prerequisites
- Node.js 18+
- Expo CLI
- iOS Simulator or Android Emulator (or physical device with Expo Go)

### Installation

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start the development server**:
   ```bash
   npx expo start
   ```

3. **Run on device/simulator**:
   - Scan QR code with Expo Go app
   - Or press `i` for iOS simulator
   - Or press `a` for Android emulator

## Usage

### Initial Setup
1. Launch the app
2. Create a patient profile from the Glucose tab
3. Customize physiological parameters in the Profile tab
4. Start adding treatments and viewing glucose predictions

### Adding Treatments
- Use Quick Treatment buttons on the Glucose screen
- Choose from preset values or enter custom amounts
- Treatments automatically trigger simulation updates

### Viewing Data
- **Glucose Tab**: Live chart with past/future glucose trends
- **Treatments Tab**: History of all carb/insulin entries
- **Profile Tab**: Patient settings and physiological parameters

## Simulation Model

The app uses a simplified physiological model based on:

### Insulin Action
- Configurable insulin duration (default: 6 hours)
- Activity curve based on rapid-acting insulin profiles
- Insulin sensitivity factor for glucose impact

### Carb Absorption
- Configurable absorption rate (default: 2 hours)
- Absorption curve for glucose impact timing
- Carb-to-insulin ratio for coverage calculations

### Physiological Factors
- Basal insulin rates (24-hour profile)
- Liver glucose production
- Realistic glucose noise and variation

### Background Processing
- Automatic recomputation when app returns from background (>5 minutes)
- Pre-computed glucose predictions up to 12 hours ahead
- Efficient SQLite storage for historical data

## Customization

### Patient Parameters
- **Weight**: Body weight in kg
- **Total Daily Dose**: Total insulin per day
- **Insulin Sensitivity**: mg/dL drop per unit of insulin
- **Carb Ratio**: Grams of carbs covered per unit of insulin
- **Basal Rates**: 24-hour insulin basal profile
- **Target Range**: Desired glucose range
- **Advanced Settings**: Absorption rates, liver production, noise levels

### Data Management
- All data stored locally (no cloud sync)
- SQLite for treatments and glucose readings
- MMKV for app state and preferences
- Automatic cleanup of old data (configurable retention)

## Development

### Code Structure
- **Types**: Comprehensive TypeScript definitions in `/types`
- **State**: Centralized Zustand store with persistence
- **Database**: Async SQLite operations with proper indexing
- **Simulation**: Modular glucose prediction engine
- **UI**: Reusable components with consistent styling

### Key Design Decisions
- Local-first architecture (no server dependencies)
- File-based routing with Expo Router
- SVG charts for performance and customization
- Physiologically-based simulation model
- Efficient background processing strategy

## Performance Considerations

- **Chart Rendering**: SVG-based for smooth performance
- **Data Loading**: Paginated queries with proper indexing
- **Background Updates**: Minimal computation, only when necessary
- **Memory Management**: Automatic cleanup of old readings
- **Battery Efficiency**: Limited background processing

## Limitations

- No real CGM device integration (simulation only)
- No cloud sync or multi-device support
- Background processing limited by Expo/React Native constraints
- Simplified physiological model (not for medical use)

## Future Enhancements

- Advanced insulin curves (NPH, Lantus, etc.)
- Exercise and stress factor modeling
- Data export capabilities
- More sophisticated noise modeling
- Integration with health platforms

## License

This project is for educational and development purposes only. Not intended for medical use.

## Contributing

This is a demonstration project created following specific requirements. For production use, consider:
- Medical device regulations and compliance
- Clinical validation of simulation models
- Advanced security and privacy measures
- Integration with certified CGM devices