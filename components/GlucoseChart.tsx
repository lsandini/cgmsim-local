import React, { useRef, useEffect, useState } from 'react';
import { View, Text, StyleSheet, useWindowDimensions, TouchableOpacity, ScrollView } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { GlucoseReading } from '../types';
import { format } from 'date-fns';

interface GlucoseChartProps {
  readings: GlucoseReading[];
  targetRange: { low: number; high: number };
  currentGlucose?: number;
  iob?: number;
  cob?: number;
  onResetSimulation?: () => void;
}

export function GlucoseChart({
  readings,
  targetRange,
  currentGlucose,
  iob = 0,
  cob = 0,
  onResetSimulation
}: GlucoseChartProps) {
  const [hoursInViewport, setHoursInViewport] = useState(3); // Default to 3 hours
  const [forceCenter, setForceCenter] = useState(0); // Trigger for forcing re-center
  const [isInitialLoad, setIsInitialLoad] = useState(true); // Track initial load
  const windowDimensions = useWindowDimensions();
  const screenWidth = windowDimensions.width;
  const screenHeight = windowDimensions.height;
  const scrollViewRef = useRef<ScrollView>(null);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const userScrollRef = useRef({ hasScrolled: false, lastScrollTime: 0 });

  // Chart dimensions
  const isLandscape = screenWidth > screenHeight;
  const CHART_HEIGHT = isLandscape
    ? Math.min(screenHeight - 220, 180)
    : Math.min(screenHeight * 0.3, 280);

  // Function to cycle through time ranges
  const cycleTimeRange = () => {
    const ranges = [1, 3, 6];
    const currentIndex = ranges.indexOf(hoursInViewport);
    const nextIndex = (currentIndex + 1) % ranges.length;
    setHoursInViewport(ranges[nextIndex]);
    userScrollRef.current.hasScrolled = false; // Reset scroll state when changing zoom
    setForceCenter(prev => prev + 1); // Trigger re-center
  };

  const now = new Date();

  // === STEP 1: CREATE FULL 24H TIMELINE WITH ACTUAL DATA ===
  // Create a complete timeline with 5-minute intervals for past 24h + future 2h
  const createFullTimeline = () => {
    const timeline = [];
    const intervalMs = 5 * 60 * 1000; // 5 minutes
    const startTime = now.getTime() - (24 * 60 * 60 * 1000); // 24h ago
    const endTime = now.getTime() + (2 * 60 * 60 * 1000); // 2h future

    console.log(`Creating timeline from ${new Date(startTime)} to ${new Date(endTime)}`);
    console.log(`Available readings: ${readings.length}, first: ${readings[0]?.timestamp}, last: ${readings[readings.length-1]?.timestamp}`);

    // Add test data points for scrolling verification
    const testTime4hAgo = now.getTime() - (4 * 60 * 60 * 1000);
    const testTime6hAgo = now.getTime() - (6 * 60 * 60 * 1000);
    console.log(`Adding test readings: 4h ago at ${new Date(testTime4hAgo)}, 6h ago at ${new Date(testTime6hAgo)}`);

    for (let time = startTime; time <= endTime; time += intervalMs) {
      const timePoint = new Date(time);

      // Find actual reading for this time slot (within 2.5 minutes)
      let actualReading = readings.find(r =>
        Math.abs(r.timestamp.getTime() - time) <= (2.5 * 60 * 1000)
      );

      // Inject test data points for scrolling verification
      if (!actualReading) {
        if (Math.abs(time - testTime4hAgo) <= (2.5 * 60 * 1000)) {
          actualReading = {
            id: `test_4h_${time}`,
            timestamp: new Date(time),
            value: 180,
            isFuture: false,
            iob: 0,
            cob: 0,
            patientId: 'test'
          };
        } else if (Math.abs(time - testTime6hAgo) <= (2.5 * 60 * 1000)) {
          actualReading = {
            id: `test_6h_${time}`,
            timestamp: new Date(time),
            value: 200,
            isFuture: false,
            iob: 0,
            cob: 0,
            patientId: 'test'
          };
        }
      }

      if (actualReading) {
        // Use actual glucose reading
        timeline.push({
          timestamp: timePoint,
          value: actualReading.value,
          isFuture: actualReading.isFuture || false,
          hasData: true,
          isCurrent: false // We'll mark the most recent reading as current after processing all data
        });
      } else {
        // No data - use baseline for scrolling
        timeline.push({
          timestamp: timePoint,
          value: 150, // Baseline for empty slots
          isFuture: time > now.getTime(),
          hasData: false,
          isCurrent: false
        });
      }
    }

    // Find the most recent non-future reading and mark it as current
    const nonFutureReadings = timeline.filter(p => p.hasData && !p.isFuture);
    if (nonFutureReadings.length > 0) {
      // Sort by timestamp and take the most recent
      const mostRecent = nonFutureReadings.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];
      const mostRecentIndex = timeline.findIndex(p => p === mostRecent);
      if (mostRecentIndex !== -1) {
        timeline[mostRecentIndex].isCurrent = true;
        console.log(`Marked reading at ${format(mostRecent.timestamp, 'HH:mm')} as current (value: ${mostRecent.value})`);
      }
    }

    console.log(`Created ${timeline.length} timeline points (should be ~312)`);
    console.log(`Points with actual data: ${timeline.filter(p => p.hasData).length}`);
    console.log(`Current reading: ${timeline.filter(p => p.isCurrent).length} points`);
    console.log(`Future predictions: ${timeline.filter(p => p.hasData && p.isFuture).length} points`);
    return timeline;
  };

  const fullTimeline = createFullTimeline();
  console.log(`Created timeline: ${fullTimeline.length} points over 26h, ${fullTimeline.filter(p => p.hasData).length} with data`);

  // === STEP 2: TRANSFORM DATA FOR CHART ===
  // Logarithmic scaling for glucose values
  const transformToLogScale = (value: number) => {
    const minGlucose = 40;
    const maxGlucose = 400;
    const logMin = Math.log(minGlucose);
    const logMax = Math.log(maxGlucose);
    const logValue = Math.log(Math.max(minGlucose, Math.min(maxGlucose, value)));
    return ((logValue - logMin) / (logMax - logMin)) * 360 + 40;
  };

  // Find the current reading index for centering
  const currentReadingIndex = fullTimeline.findIndex(point => point.isCurrent);
  const hasCurrentReading = currentReadingIndex !== -1;

  console.log(`Current reading index: ${currentReadingIndex}, has current: ${hasCurrentReading}`);

  // STEP 1: Create simple chart data for react-native-gifted-charts
  // Convert timeline to gifted-charts format
  const chartData = fullTimeline.map((point, index) => ({
    value: point.value, // Always use the point's value (actual data or baseline)
    label: index % 72 === 0 ? format(point.timestamp, 'HH:mm') : '', // Labels every 6h
    dataPointColor: point.isCurrent ? '#ef4444' : point.isFuture ? '#6b7280' : '#000000',
    dataPointRadius: point.isCurrent ? 6 : 4,
    showDataPoint: point.hasData, // Only show dots where we have data
  }));

  // Use chartData directly without anchor points - rely on explicit scaling properties instead

  // Create metadata for dot styling (we'll use this for custom rendering if needed)
  const dotMetadata = fullTimeline.map(point => ({
    hasData: point.hasData,
    isCurrent: point.isCurrent,
    isFuture: point.isFuture,
    value: point.value
  }));

  console.log(`=== TIMELINE FOUNDATION ===`);
  console.log(`Created timeline: ${fullTimeline.length} points over 26 hours`);
  console.log(`From: ${format(fullTimeline[0].timestamp, 'MMM dd HH:mm')}`);
  console.log(`To: ${format(fullTimeline[fullTimeline.length - 1].timestamp, 'MMM dd HH:mm')}`);
  console.log(`Chart should be scrollable through full timeline`);

  console.log(`=== CHART DATA VERIFICATION ===`);
  console.log(`Chart data points: ${chartData.length} total timeline slots`);
  console.log(`Expected: 312 points (26h * 12 points/hour)`);
  console.log(`Points with data: ${chartData.filter(p => p.showDataPoint).length}`);
  console.log(`Current readings: ${chartData.filter(p => p.dataPointColor === '#ef4444').length}`);
  console.log(`Future predictions: ${chartData.filter(p => p.dataPointColor === '#6b7280').length}`);
  console.log(`Past readings: ${chartData.filter(p => p.dataPointColor === '#000000' && p.showDataPoint).length}`);

  // === STEP 3: CALCULATE CHART DIMENSIONS & VIEWPORT ===
  const baseChartWidth = Math.max(300, screenWidth - 80);

  // Calculate viewport requirements - simplified
  const dotsPerHour = 12; // 5-minute intervals
  const viewportDots = hoursInViewport * dotsPerHour; // Show exactly what the button says
  const dotSpacing = (screenWidth - 40) / Math.max(1, viewportDots - 1);

  // Make chart width based on calculated dot spacing
  const fullChartWidth = chartData.length * dotSpacing;

  console.log(`=== VIEWPORT CALCULATIONS ===`);
  console.log(`Selected: ${hoursInViewport}h viewport = ${viewportDots} dots should fit in screen`);
  console.log(`Dot spacing: ${dotSpacing.toFixed(1)}px`);
  console.log(`Full chart width: ${fullChartWidth.toFixed(0)}px for ${chartData.length} timeline points`);

  // X-axis labels are created within the chartData array
  console.log(`Created ${chartData.filter(p => p.label !== '').length} time labels (every 6h)`);

  // === STEP 5: BASIC VIEWPORT INFO ===
  useEffect(() => {
    console.log(`=== Time Range Button Clicked: ${hoursInViewport}h ===`);
    console.log(`This should change the dot spacing and make timeline denser/wider`);
    console.log(`Current dot spacing: ${dotSpacing.toFixed(1)}px`);
  }, [hoursInViewport, dotSpacing]);

  // Track previous values to detect actual changes
  const prevHoursInViewport = useRef(hoursInViewport);
  const prevForceCenter = useRef(forceCenter);

  // === AUTO-SCROLL TO CURRENT READING ===
  useEffect(() => {
    if (!hasCurrentReading || currentReadingIndex === -1 || !scrollViewRef.current) {
      return;
    }

    // Detect what actually changed
    const zoomChanged = prevHoursInViewport.current !== hoursInViewport;
    const forceCenterChanged = prevForceCenter.current !== forceCenter;

    // Update refs
    prevHoursInViewport.current = hoursInViewport;
    prevForceCenter.current = forceCenter;

    // Proceed if: zoom changed, force center triggered, OR initial load
    if (!zoomChanged && !forceCenterChanged && !isInitialLoad) {
      console.log('Skipping auto-scroll - no actual trigger');
      return;
    }

    // Mark initial load as complete
    if (isInitialLoad) {
      console.log('Initial load detected - auto-scrolling to current reading');
      setIsInitialLoad(false);
    }

    // Skip if user has scrolled recently (unless force center is triggered)
    if (!forceCenterChanged && userScrollRef.current.hasScrolled &&
        Date.now() - userScrollRef.current.lastScrollTime < 10000) {
      console.log('Skipping auto-scroll - user scrolled recently');
      return;
    }

    const scrollToX = Math.max(0, (currentReadingIndex * dotSpacing) - (screenWidth / 2));
    console.log(`Auto-scrolling to current reading at index ${currentReadingIndex}, x=${scrollToX} (zoom: ${zoomChanged}, force: ${forceCenterChanged}, initial: ${isInitialLoad})`);

    setTimeout(() => {
      scrollViewRef.current?.scrollTo({
        x: scrollToX,
        y: 0,
        animated: true
      });
    }, 300);
  }, [hoursInViewport, forceCenter, hasCurrentReading, currentReadingIndex, dotSpacing, screenWidth, isInitialLoad]);

  // Auto-refresh viewport for new current readings
  useEffect(() => {
    const refreshInterval = setInterval(() => {
      console.log('Auto-refresh: Checking if re-centering needed');

      // Check if we should auto-scroll to keep current value in view
      const timeSinceLastScroll = Date.now() - userScrollRef.current.lastScrollTime;

      if (timeSinceLastScroll > 10000) { // If user hasn't scrolled for 10 seconds
        console.log('Auto-centering due to time-based refresh (user inactive)');
        userScrollRef.current.hasScrolled = false;
        setForceCenter(prev => prev + 1); // Trigger re-center through the main useEffect
      }
    }, 5 * 60 * 1000); // Every 5 minutes

    return () => clearInterval(refreshInterval);
  }, []); // No dependencies - use refs instead

  // Early return for empty data - after all hooks are declared
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

  return (
    <View style={styles.container}>
      {/* Header */}
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
          {onResetSimulation && (
            <TouchableOpacity
              style={styles.resetButton}
              onPress={() => {
                console.log('🟥🟥🟥 RESET BUTTON PRESSED IN CHART 🟥🟥🟥');
                console.log('🔍 onResetSimulation type:', typeof onResetSimulation);
                console.log('🔍 onResetSimulation exists:', !!onResetSimulation);
                console.log('🔍 onResetSimulation function:', onResetSimulation);

                if (!onResetSimulation) {
                  alert('ERROR: onResetSimulation function is not provided!');
                  return;
                }

                alert('Reset button was pressed! About to call reset function...');

                try {
                  console.log('📞📞📞 CALLING onResetSimulation... 📞📞📞');
                  const result: any = onResetSimulation();
                  console.log('📞 onResetSimulation returned:', result);

                  // Check if result is a Promise by testing for 'then' method
                  if (result != null && typeof result === 'object' && 'then' in result && typeof result.then === 'function') {
                    console.log('📞 Function returned a Promise, waiting...');
                    result.then(() => {
                      console.log('✅✅✅ onResetSimulation Promise completed ✅✅✅');
                      alert('Reset completed successfully!');
                    }).catch((error: any) => {
                      console.error('❌❌❌ onResetSimulation Promise failed:', error);
                      alert('Reset failed: ' + (error?.message || error));
                    });
                  } else {
                    console.log('✅✅✅ onResetSimulation call completed ✅✅✅');
                    alert('Reset completed successfully!');
                  }
                } catch (error: any) {
                  console.error('❌❌❌ Error calling onResetSimulation:', error);
                  alert('Error: ' + (error?.message || error));
                }
              }}
            >
              <Text style={styles.resetButtonText}>RESET</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Chart */}
      <View style={styles.chartContainer}>
        <View style={{ flexDirection: 'row', width: screenWidth - 40 }}>
          {/* Y-axis stays fixed on the left */}
          <View style={{ width: 60, justifyContent: 'center' }}>
            <LineChart
              data={[{value: 40}, {value: 400}]} // Min and max to establish range
              width={60}
              height={CHART_HEIGHT}
              maxValue={400}
              mostNegativeValue={40}
              noOfSections={8}
              stepValue={(400-40)/8} // Explicit step value: 45
              yAxisLabelTexts={['40', '70', '100', '140', '180', '250', '320', '360', '400']} // Clinical glucose values
              yAxisColor="#9ca3af"
              yAxisTextStyle={{ color: '#6b7280', fontSize: 10 }}
              hideDataPoints={true}
              color1="transparent"
              thickness1={0}
              xAxisColor="transparent"
              hideYAxisText={false}
              rulesType="solid"
              rulesColor="#f3f4f6"
              showVerticalLines={false}
              spacing={0}
              initialSpacing={0}
              endSpacing={0}
            />
          </View>

          {/* Scrollable chart area without Y-axis */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={true}
            ref={scrollViewRef}
            style={{ flex: 1 }}
            onScroll={(event) => {
              // Track user scroll activity
              userScrollRef.current.hasScrolled = true;
              userScrollRef.current.lastScrollTime = Date.now();

              // Clear existing timeout
              if (scrollTimeoutRef.current) {
                clearTimeout(scrollTimeoutRef.current);
              }

              // Reset scroll state after 10 seconds of inactivity
              scrollTimeoutRef.current = setTimeout(() => {
                console.log('10s timeout - triggering re-center to red dot');
                userScrollRef.current.hasScrolled = false;
                setForceCenter(prev => prev + 1); // Trigger re-center to red dot
              }, 10000);
            }}
            scrollEventThrottle={100}
          >
            <View style={{ paddingBottom: 20 }}>
              <LineChart
                data={chartData}
                width={fullChartWidth}
                height={CHART_HEIGHT}

                // Basic styling - hide the line, keep only dots
                color1="transparent"
                thickness1={0}

                // Data points - will use individual colors from data
                hideDataPoints={false}

                // Hide Y-axis since it's shown separately
                yAxisColor="transparent"
                hideYAxisText={true}
                yAxisLabelWidth={0}

                // X-axis
                xAxisColor="#9ca3af"

                // Grid - only horizontal lines matching the Y-axis
                rulesType="solid"
                rulesColor="#f3f4f6"
                showYAxisIndices={false}
                showVerticalLines={false}

                // Scrolling - key properties
                spacing={dotSpacing}
                initialSpacing={20}
                endSpacing={20}

                // Disable built-in scrolling since we use ScrollView
                scrollToEnd={false}
                scrollAnimation={false}
                disableScroll={true}

                // Performance
                animateOnDataChange={false}

                // CRITICAL: Match exact scaling of Y-axis chart
                maxValue={400}
                mostNegativeValue={40}
                noOfSections={8}
                stepValue={(400-40)/8} // Same explicit step value: 45
              />
            </View>
          </ScrollView>
        </View>
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#1f2937' }]} />
          <Text style={styles.legendText}>Past</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#ef4444' }]} />
          <Text style={styles.legendText}>Current</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#6b7280', opacity: 0.6 }]} />
          <Text style={styles.legendText}>Predicted</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendLine, { backgroundColor: '#10b981' }]} />
          <Text style={styles.legendText}>Target</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 12,
    marginVertical: 6,
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
    marginBottom: 12,
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
  resetButton: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#dc2626',
    marginLeft: 8,
  },
  resetButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
  chartContainer: {
    alignItems: 'center',
    marginVertical: 8,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
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