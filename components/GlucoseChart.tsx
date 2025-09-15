import React, { useRef, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Dimensions, ScrollView, useWindowDimensions, TouchableOpacity } from 'react-native';
import Svg, { 
  Path, 
  Line, 
  Text as SvgText, 
  Defs, 
  LinearGradient, 
  Stop,
  Circle,
  G
} from 'react-native-svg';
import { GlucoseReading } from '../types';
import { format } from 'date-fns';

interface GlucoseChartProps {
  readings: GlucoseReading[];
  targetRange: { low: number; high: number };
  currentGlucose?: number;
  iob?: number;
  cob?: number;
}

const PADDING = 16;
const Y_AXIS_WIDTH = 45;  // Width for Y-axis labels

// Total hours of data to display (24 back + 2 forward)
const TOTAL_HOURS = 26;

export function GlucoseChart({
  readings,
  targetRange,
  currentGlucose,
  iob = 0,
  cob = 0
}: GlucoseChartProps) {
  const scrollViewRef = useRef<ScrollView>(null);
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const [lastScrollX, setLastScrollX] = useState(0);
  const [hoursInViewport, setHoursInViewport] = useState(3); // Default to 3 hours

  // Use dynamic dimensions that update on orientation change
  const windowDimensions = useWindowDimensions();
  const screenWidth = windowDimensions.width;
  const screenHeight = windowDimensions.height;

  // Adjust chart height based on orientation - use more vertical space
  const isLandscape = screenWidth > screenHeight;
  const CHART_HEIGHT = isLandscape
    ? Math.min(screenHeight - 120, 400)  // More height in landscape, leaving room for header/controls
    : Math.min(screenHeight * 0.4, 350); // Use 40% of screen height in portrait, max 350px

  // Calculate dynamic chart width based on current viewport setting
  const VIEWPORT_WIDTH = screenWidth - 32 - Y_AXIS_WIDTH;  // Visible width minus Y-axis
  const PIXELS_PER_HOUR = VIEWPORT_WIDTH / hoursInViewport;  // Calculate pixel density based on current viewport
  const CHART_WIDTH = TOTAL_HOURS * PIXELS_PER_HOUR;  // Total chart width for all hours

  // Function to cycle through time ranges
  const cycleTimeRange = () => {
    const ranges = [1, 3, 6];
    const currentIndex = ranges.indexOf(hoursInViewport);
    const nextIndex = (currentIndex + 1) % ranges.length;
    setHoursInViewport(ranges[nextIndex]);
  };
  if (readings.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No glucose data available</Text>
          <Text style={styles.emptySubtext}>Start simulation to see your glucose trend</Text>
        </View>
      </View>
    );
  }

  // Calculate chart dimensions
  const chartWidth = CHART_WIDTH - (PADDING * 2);
  const chartHeight = CHART_HEIGHT - (PADDING * 2);

  // Find data bounds
  const validReadings = readings.filter(r => !isNaN(r.value) && isFinite(r.value) && !isNaN(r.timestamp.getTime()));

  if (validReadings.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No valid glucose data available</Text>
          <Text style={styles.emptySubtext}>Start simulation to see your glucose trend</Text>
        </View>
      </View>
    );
  }

  // Fixed glucose range from 40 to 400 mg/dL with logarithmic scale
  const minGlucose = 40;
  const maxGlucose = 400;

  // Logarithmic scale parameters
  const logMinGlucose = Math.log(minGlucose);
  const logMaxGlucose = Math.log(maxGlucose);
  const logGlucoseRange = logMaxGlucose - logMinGlucose;

  // Use fixed time scale aligned to hour boundaries
  const now = new Date();
  // For centering, we want current time to be in the middle of our 26-hour window
  // So we'll show 24 hours back + 2 hours forward = 26 hours total
  const currentTime = now.getTime();
  const minTime = currentTime - (24 * 60 * 60 * 1000); // 24 hours ago
  const maxTime = currentTime + (2 * 60 * 60 * 1000); // 2 hours forward
  const timeRange = maxTime - minTime;
  
  // Convert glucose value to y coordinate using logarithmic scale
  const glucoseToY = (glucose: number) => {
    if (logGlucoseRange === 0) return chartHeight / 2;

    // Clamp glucose value to valid range
    const clampedGlucose = Math.max(minGlucose, Math.min(maxGlucose, glucose));

    // Convert to logarithmic scale
    const logGlucose = Math.log(clampedGlucose);
    const normalizedPosition = (logGlucose - logMinGlucose) / logGlucoseRange;

    return chartHeight - (normalizedPosition * chartHeight);
  };
  
  // Convert timestamp to x coordinate
  const timeToX = (timestamp: Date) => {
    if (timeRange === 0) return 0;
    return ((timestamp.getTime() - minTime) / timeRange) * chartWidth;
  };
  
  // Separate past and future readings
  const pastReadings = readings.filter(r => !r.isFuture);
  const futureReadings = readings.filter(r => r.isFuture);

  // Filter and prepare valid readings for dot rendering
  const getValidReadings = (data: GlucoseReading[]) => {
    return data.filter(d =>
      !isNaN(d.value) &&
      !isNaN(d.timestamp.getTime()) &&
      isFinite(d.value) &&
      d.timestamp.getTime() >= minTime &&  // Only show readings within 24-hour window
      d.timestamp.getTime() <= maxTime
    ).map(reading => ({
      ...reading,
      x: timeToX(reading.timestamp),
      y: glucoseToY(reading.value)
    })).filter(reading =>
      !isNaN(reading.x) && !isNaN(reading.y) &&
      isFinite(reading.x) && isFinite(reading.y) &&
      reading.x >= 0 && reading.x <= chartWidth  // Ensure dots are within chart bounds
    );
  };

  const validPastReadings = getValidReadings(pastReadings);
  const validFutureReadings = getValidReadings(futureReadings);
  
  // Target range paths
  const targetLowY = glucoseToY(targetRange.low);
  const targetHighY = glucoseToY(targetRange.high);
  
  // Create time labels - one label per hour, aligned to 5-minute intervals
  const timeLabels = [];

  // Helper function to round time to nearest 5-minute interval
  const roundToNearestFiveMinutes = (date: Date): Date => {
    const rounded = new Date(date);
    const minutes = rounded.getMinutes();
    const remainder = minutes % 5;

    if (remainder !== 0) {
      // Round to nearest 5-minute interval
      if (remainder >= 3) {
        rounded.setMinutes(minutes + (5 - remainder));
      } else {
        rounded.setMinutes(minutes - remainder);
      }
    }

    rounded.setSeconds(0);
    rounded.setMilliseconds(0);
    return rounded;
  };

  for (let i = 0; i <= 26; i++) {
    const time = new Date(minTime + i * 60 * 60 * 1000);
    const alignedTime = roundToNearestFiveMinutes(time);
    const x = (i / 26) * chartWidth;
    timeLabels.push({
      x,
      time: format(alignedTime, 'HH:mm'),
    });
  }

  // Create subtle vertical lines for 5-minute intervals
  const fiveMinuteMarkers = [];
  for (let hours = 0; hours <= 26; hours++) {
    for (let minutes = 0; minutes < 60; minutes += 5) {
      const totalMinutes = hours * 60 + minutes;
      const x = (totalMinutes / (26 * 60)) * chartWidth;
      fiveMinuteMarkers.push({
        x,
        isHour: minutes === 0,
        is15Min: minutes % 15 === 0,
      });
    }
  }
  
  // Create glucose labels - key clinical thresholds only
  const glucoseLabels = [];
  // Only most important clinical values
  const glucoseValues = [55, 72, 120, 140, 180, 250, 300, 400];

  for (const glucose of glucoseValues) {
    const y = glucoseToY(glucose);
    glucoseLabels.push({
      y,
      value: glucose,
    });
  }
  
  // Current reading indicator (latest reading)
  const currentReading = pastReadings[pastReadings.length - 1];
  const currentX = currentReading ? timeToX(currentReading.timestamp) : 0;
  const currentY = currentReading ? glucoseToY(currentReading.value) : 0;

  // Check if current reading coordinates are valid
  const hasValidCurrentReading = currentReading &&
    !isNaN(currentX) && !isNaN(currentY) &&
    isFinite(currentX) && isFinite(currentY);

  // Auto-scroll to center on current time (red dot)
  // This will trigger whenever readings change (new data arrives)
  useEffect(() => {
    if (scrollViewRef.current && readings.length > 0) {
      // For initial load or when not manually scrolling, center on current time
      if (!isUserScrolling) {
        // Current time should be at 24/26 of the total chart width (24h back out of 26h total)
        const currentTimeRatio = 24 / 26; // 24 hours back out of 26 hour total window
        const currentTimePosition = currentTimeRatio * chartWidth;
        const scrollToCenter = Math.max(0, currentTimePosition - (VIEWPORT_WIDTH / 2));

        // Use a small delay to ensure the chart has rendered
        setTimeout(() => {
          scrollViewRef.current?.scrollTo({
            x: scrollToCenter,
            animated: true
          });
          setLastScrollX(scrollToCenter);
          setIsUserScrolling(false);
        }, 100);
      }
    }
  }, [readings, chartWidth]); // Trigger on readings or chart width changes

  // Auto-scroll to center on current time when orientation or viewport changes
  useEffect(() => {
    if (scrollViewRef.current && readings.length > 0) {
      // Current time should be at 24/26 of the total chart width
      const currentTimeRatio = 24 / 26;
      const currentTimePosition = currentTimeRatio * chartWidth;
      const scrollToCenter = Math.max(0, currentTimePosition - (VIEWPORT_WIDTH / 2));

      setTimeout(() => {
        scrollViewRef.current?.scrollTo({
          x: scrollToCenter,
          animated: hoursInViewport !== 3 // Animate when changing viewport, not on orientation
        });
        setLastScrollX(scrollToCenter);
        setIsUserScrolling(false); // Reset manual scroll flag
      }, 300); // Give enough time for layout to complete
    }
  }, [screenWidth, screenHeight, hoursInViewport]); // Trigger on dimension or viewport changes

  return (
    <View style={styles.container}>
      {/* Current values header */}
      <View style={styles.header}>
        <View style={styles.currentValue}>
          <Text style={styles.glucoseValue}>
            {currentGlucose ? Math.round(currentGlucose) : '--'}
          </Text>
          <Text style={styles.glucoseUnit}>mg/dL</Text>
        </View>

        <View style={styles.metrics}>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>IOB</Text>
            <Text style={styles.metricValue}>{iob.toFixed(1)}u</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>COB</Text>
            <Text style={styles.metricValue}>{cob.toFixed(0)}g</Text>
          </View>
          <TouchableOpacity style={styles.timeRangeButton} onPress={cycleTimeRange}>
            <Text style={styles.timeRangeText}>{hoursInViewport}h</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Chart */}
      <View style={styles.chartWrapper}>
        {/* Y-axis labels */}
        <View style={styles.yAxisContainer}>
          <Svg width={Y_AXIS_WIDTH} height={CHART_HEIGHT}>
            <G x={0} y={PADDING}>
              {/* Y-axis line */}
              <Line
                x1={Y_AXIS_WIDTH - 1}
                y1={0}
                x2={Y_AXIS_WIDTH - 1}
                y2={chartHeight}
                stroke="#9ca3af"
                strokeWidth={1}
              />

              {/* Glucose labels on Y-axis */}
              {glucoseLabels.map((label, index) => {
                // Enhanced color coding for logarithmic scale with emphasis on low values
                let textColor = '#374151'; // default gray
                let fontWeight = '400'; // normal weight

                if (label.value < 70) {
                  textColor = '#dc2626'; // red for hypoglycemia (55)
                  fontWeight = '700'; // bold
                } else if (label.value >= 72 && label.value <= 180) {
                  textColor = '#059669'; // green for target range (72, 120, 140, 180)
                  fontWeight = '600'; // bold
                } else if (label.value <= 250) {
                  textColor = '#ea580c'; // orange for high (250)
                  fontWeight = '600';
                } else {
                  textColor = '#dc2626'; // red for very high values (300, 400)
                  fontWeight = '700';
                }

                return (
                  <G key={`y-axis-label-${index}`}>
                    <SvgText
                      x={Y_AXIS_WIDTH - 6}
                      y={label.y + 3}
                      fontSize={10}
                      fill={textColor}
                      textAnchor="end"
                      fontWeight={fontWeight}
                    >
                      {label.value}
                    </SvgText>
                    {/* Tick marks - all clinical thresholds are major */}
                    <Line
                      x1={Y_AXIS_WIDTH - 8}
                      y1={label.y}
                      x2={Y_AXIS_WIDTH - 1}
                      y2={label.y}
                      stroke="#9ca3af"
                      strokeWidth={2}
                    />
                  </G>
                );
              })}
            </G>
          </Svg>
        </View>

        {/* Scrollable chart area */}
        <View style={styles.chartContainer}>
          <ScrollView
            ref={scrollViewRef}
            horizontal
            showsHorizontalScrollIndicator={true}
            style={[styles.chartScrollView, { maxHeight: CHART_HEIGHT + 60 }]}
            contentContainerStyle={{ paddingRight: 40 }}
            onScroll={(event) => {
              const currentX = event.nativeEvent.contentOffset.x;
              setLastScrollX(currentX);
            }}
            onScrollBeginDrag={() => {
              setIsUserScrolling(true);
            }}
            onMomentumScrollEnd={(event) => {
              const currentX = event.nativeEvent.contentOffset.x;
              setLastScrollX(currentX);

              // Check if user scrolled back to center on current time
              const currentTimeRatio = 24 / 26;
              const currentTimePosition = currentTimeRatio * chartWidth;
              const centerPosition = currentTimePosition - (VIEWPORT_WIDTH / 2);
              const isNearCenter = Math.abs(currentX - centerPosition) < 100; // Within 100px of center

              if (isNearCenter) {
                setIsUserScrolling(false); // Resume auto-scroll if near center
              }
            }}
            scrollEventThrottle={16}
          >
            <Svg width={CHART_WIDTH} height={CHART_HEIGHT + 50}>
          <Defs>
            <LinearGradient id="futureGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <Stop offset="0%" stopColor="#3b82f6" stopOpacity="0.8" />
              <Stop offset="100%" stopColor="#3b82f6" stopOpacity="0.2" />
            </LinearGradient>
          </Defs>
          
          <G x={PADDING} y={PADDING}>
            {/* Grid lines */}
            {glucoseLabels.map((label, index) => (
              <Line
                key={`glucose-grid-${index}`}
                x1={0}
                y1={label.y}
                x2={chartWidth}
                y2={label.y}
                stroke="#e5e7eb"
                strokeWidth={1}
              />
            ))}

            {/* 5-minute interval markers */}
            {fiveMinuteMarkers.map((marker, index) => (
              <Line
                key={`5min-marker-${index}`}
                x1={marker.x}
                y1={0}
                x2={marker.x}
                y2={chartHeight}
                stroke={marker.isHour ? "#d1d5db" : "#f3f4f6"}  // Darker for hours
                strokeWidth={marker.isHour ? 1 : 0.5}
                strokeDasharray={marker.isHour ? "0" : marker.is15Min ? "3,3" : "1,3"}
                opacity={marker.isHour ? 1 : 0.5}
              />
            ))}
            
            {/* Target range */}
            <Line
              x1={0}
              y1={targetLowY}
              x2={chartWidth}
              y2={targetLowY}
              stroke="#10b981"
              strokeWidth={2}
              strokeDasharray="5,5"
            />
            <Line
              x1={0}
              y1={targetHighY}
              x2={chartWidth}
              y2={targetHighY}
              stroke="#10b981"
              strokeWidth={2}
              strokeDasharray="5,5"
            />
            
            {/* Past glucose dots */}
            {validPastReadings.map((reading, index) => (
              <Circle
                key={`past-${reading.id}-${index}`}
                cx={reading.x}
                cy={reading.y}
                r={4}
                fill="#1f2937"
                stroke="#ffffff"
                strokeWidth={1}
              />
            ))}

            {/* Future glucose dots with gradient opacity */}
            {validFutureReadings.map((reading, index) => {
              // Calculate time difference from now in minutes
              const now = new Date();
              const minutesInFuture = (reading.timestamp.getTime() - now.getTime()) / (1000 * 60);

              // Calculate opacity: 0.7 at current time, 0.05 at 120 minutes (2 hours)
              // Linear fade from 0.7 to 0.05 over 120 minutes
              const opacity = Math.max(0.05, 0.7 - (minutesInFuture / 120) * 0.65);

              return (
                <Circle
                  key={`future-${reading.id}-${index}`}
                  cx={reading.x}
                  cy={reading.y}
                  r={4}
                  fill="#6b7280"  // Grey-blue color
                  fillOpacity={opacity}
                  stroke="#ffffff"
                  strokeWidth={0.5}
                  strokeOpacity={opacity}
                />
              );
            })}
            
            {/* Current point indicator */}
            {hasValidCurrentReading && (
              <Circle
                cx={currentX}
                cy={currentY}
                r={6}
                fill="#ef4444"
                stroke="#ffffff"
                strokeWidth={2}
              />
            )}
            
            
            {/* Time labels */}
            {timeLabels.map((label, index) => (
              <SvgText
                key={`time-label-${index}`}
                x={label.x}
                y={chartHeight + 35}
                fontSize={12}
                fill="#6b7280"
                textAnchor="middle"
              >
                {label.time}
              </SvgText>
            ))}
          </G>
          </Svg>
        </ScrollView>
        </View>
      </View>
      
      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendLine, { backgroundColor: '#1f2937' }]} />
          <Text style={styles.legendText}>Past</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendLine, { backgroundColor: '#6b7280', opacity: 0.6 }]} />
          <Text style={styles.legendText}>Predicted (2h)</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendLine, { backgroundColor: '#10b981' }]} />
          <Text style={styles.legendText}>Target Range</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,  // Reduced padding for more chart space
    marginHorizontal: 12,  // Reduced margins
    marginVertical: 6,  // Reduced margins
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,  // Reduced margin for more chart space
  },
  currentValue: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  glucoseValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  glucoseUnit: {
    fontSize: 14,
    color: '#6b7280',
    marginLeft: 4,
  },
  metrics: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
  },
  metric: {
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  timeRangeButton: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  timeRangeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  chartWrapper: {
    flexDirection: 'row',
  },
  yAxisContainer: {
    width: Y_AXIS_WIDTH,
    backgroundColor: '#f9fafb',
    borderRightWidth: 1,
    borderRightColor: '#e5e7eb',
  },
  chartContainer: {
    flex: 1,
    alignItems: 'flex-start',
  },
  chartScrollView: {
    // maxHeight will be set dynamically
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 8,  // Restored to normal since time labels are now positioned properly
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendLine: {
    width: 16,
    height: 3,
    borderRadius: 1.5,
  },
  legendText: {
    fontSize: 12,
    color: '#6b7280',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#6b7280',
  },
});