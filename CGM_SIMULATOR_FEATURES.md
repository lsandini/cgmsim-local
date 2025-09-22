# CGM Simulator - Current Features

A React Native/Expo continuous glucose monitoring (CGM) simulator application that provides realistic glucose level tracking and prediction capabilities.

## 📱 Application Overview

The CGM Simulator is a comprehensive mobile application that simulates real-world continuous glucose monitoring functionality. It generates realistic glucose data, provides treatment tracking, and offers interactive visualization of glucose trends over time.

## 🏗️ Architecture

- **Framework**: React Native with Expo
- **State Management**: Zustand
- **Database**: SQLite (expo-sqlite)
- **Storage**: AsyncStorage for persistence
- **Charts**: react-native-gifted-charts
- **Language**: TypeScript

## ✨ Core Features

### 🎯 Glucose Monitoring & Visualization

#### Interactive Glucose Chart
- **Dot-based visualization**: Shows glucose readings as individual data points (no connecting lines)
- **Color-coded readings**:
  - Black dots: Past glucose readings
  - Red dot: Current glucose reading (most recent)
  - Gray dots: Future predictions
- **Fixed Y-axis**: Glucose scale (0-400 mg/dL) remains visible during horizontal scrolling
- **Scrollable timeline**: 26-hour view (24 hours historical + 2 hours future predictions)
- **Smart viewport management**: Three zoom levels (1h, 3h, 6h visible in viewport)
- **Auto-centering**: Automatically scrolls to current reading on app load and zoom changes
- **Manual scroll with auto-return**: Returns to current reading after 10 seconds of inactivity

#### Real-time Data Updates
- **5-minute intervals**: Glucose readings align to 5-minute CGM standard
- **Automatic progression**: New readings become available every 5 minutes
- **Live current glucose display**: Large numeric display in app header
- **IOB/COB tracking**: Shows insulin on board and carbs on board values

### 🔄 Data Management & Simulation

#### Comprehensive Reset Functionality
- **Complete data clearing**: Removes all existing glucose and treatment data
- **Fresh data generation**: Creates 24 hours of realistic historical glucose data
- **Future predictions**: Generates 12 hours of glucose predictions using physiological modeling
- **Realistic variation**: Historical data includes natural glucose fluctuations (±10 mg/dL)
- **Proper sequencing**: Updates patient baseline before generating predictions

#### Advanced Glucose Simulation Engine
- **Physiological modeling**: Simulates glucose response to insulin and carbohydrates
- **Treatment effects**: Models insulin action and carb absorption curves
- **Noise modeling**: Includes realistic measurement variability
- **Constraint handling**: Maintains glucose values within physiological ranges (40-400 mg/dL)
- **Time-aligned data**: All readings align to 5-minute boundaries

### 💊 Treatment Tracking

#### Quick Treatment Entry
- **Insulin logging**: Record insulin doses with timestamp
- **Carbohydrate logging**: Record carb intake with timestamp
- **Immediate effect calculation**: Treatments immediately influence future glucose predictions
- **Treatment history**: Maintains record of recent treatments

#### Treatment Integration
- **Active treatment tracking**: Considers treatments from last 24 hours for predictions
- **Physiological curves**: Uses realistic insulin and carb absorption profiles
- **Automatic recalculation**: Updates predictions when new treatments are added

### 📊 Patient Profile Management

#### Patient Data Storage
- **Persistent patient profiles**: Stores patient information in SQLite database
- **Automatic profile loading**: Restores last active patient on app restart
- **Current glucose tracking**: Maintains real-time glucose state
- **Treatment history**: Links all treatments to patient profiles

#### Default Patient Parameters
- **Weight**: 70 kg
- **Total Daily Dose**: 40 units
- **Insulin Sensitivity**: 50 mg/dL per unit
- **Carb Ratio**: 15 g per unit
- **Target Range**: 70-180 mg/dL
- **Insulin Duration**: 4 hours
- **Carb Absorption Rate**: 30 g/hour

### 🔧 User Interface Features

#### Responsive Design
- **Portrait/landscape support**: Optimized layouts for both orientations
- **Screen rotation**: Allows rotation for better chart viewing
- **Adaptive sizing**: Chart dimensions adjust to screen size
- **Touch-friendly controls**: Large, accessible buttons and controls

#### Interactive Controls
- **Zoom controls**: 1h/3h/6h viewport selection
- **Reset button**: Complete simulation reset with confirmation
- **Manual scrolling**: Touch-based chart navigation
- **Pull-to-refresh**: Refresh glucose data and predictions

#### Status Information
- **Computation status**: Shows when predictions are being calculated
- **Next reading time**: Displays when next glucose reading will be available
- **Last update time**: Shows when data was last computed
- **Prediction coverage**: Indicates how far into the future predictions extend

### 💾 Data Persistence & Storage

#### SQLite Database
- **Patient profiles**: Persistent storage of patient information
- **Glucose readings**: Historical and predicted glucose data
- **Treatment records**: Complete treatment history
- **Efficient indexing**: Optimized queries for performance

#### Data Management
- **Automatic cleanup**: Removes old data to maintain performance
- **Data integrity**: Ensures consistent data relationships
- **Background processing**: Database operations don't block UI
- **Recovery handling**: Graceful error handling and recovery

### ⏱️ Real-time Functionality

#### CGM Timer System
- **Automatic progression**: Moves future predictions to current readings
- **5-minute intervals**: Follows standard CGM timing
- **Background operation**: Continues running when app is active
- **Smart scheduling**: Efficient timer management

#### Live Updates
- **Current glucose updates**: Header display updates with new readings
- **Chart refreshing**: Visual updates when new data becomes available
- **Prediction regeneration**: Creates new predictions as time progresses
- **State synchronization**: Maintains consistent state across components

## 🎮 User Workflow

### Initial Setup
1. App launches and initializes database
2. Creates default patient profile if none exists
3. Generates 24 hours of historical glucose data
4. Creates 12 hours of future predictions
5. Auto-scrolls chart to current reading

### Daily Usage
1. View current glucose on main screen
2. Scroll through historical data and predictions
3. Add treatments (insulin/carbs) as needed
4. Monitor glucose trends and patterns
5. Use reset function for fresh simulation data

### Chart Interaction
1. Use zoom buttons (1h/3h/6h) to change viewport
2. Manually scroll to explore different time periods
3. Chart automatically returns to current reading after inactivity
4. View fixed Y-axis scale while scrolling horizontally

## 🔬 Technical Capabilities

### Data Generation
- **288 historical readings**: Full 24-hour glucose history
- **144 future readings**: 12 hours of predictions
- **Realistic patterns**: Natural glucose variation and trends
- **Treatment integration**: Physiologically accurate responses

### Performance Optimization
- **Efficient rendering**: Optimized chart performance for large datasets
- **Background processing**: Non-blocking simulation calculations
- **Memory management**: Automatic cleanup of old data
- **Smooth scrolling**: Optimized viewport calculations

### Error Handling
- **Graceful degradation**: App continues functioning with partial data
- **User feedback**: Clear error messages and recovery options
- **Data validation**: Ensures data integrity and consistency
- **Fallback mechanisms**: Default values when data is unavailable

## 📱 Platform Support

- **iOS**: Full functionality via Expo Go and standalone builds
- **Android**: Cross-platform compatibility
- **Responsive**: Adapts to various screen sizes and orientations
- **Native performance**: Leverages React Native optimization

## 🎯 Current Limitations

- **Single patient**: Currently supports one active patient profile
- **Simulated data**: No integration with real CGM devices
- **Local storage**: Data stored locally on device only
- **No cloud sync**: No multi-device synchronization
- **Basic treatment types**: Limited to insulin and carbohydrates only

---

*This documentation reflects the current state of the CGM Simulator application. All features listed are fully implemented and functional.*