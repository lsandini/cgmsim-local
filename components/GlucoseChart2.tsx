import React, { useRef, useEffect, useState } from 'react';
import { View, Text, StyleSheet, useWindowDimensions, TouchableOpacity, ScrollView } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { format } from 'date-fns';

// Simple data point interface
interface GlucoseDataPoint {
  timestamp: number; // epoch milliseconds
  value: number; // mg/dL
  isCurrent: boolean;
  isFuture: boolean;
}

interface GlucoseChart2Props {
  onResetData?: () => void;
}

export function GlucoseChart2({ onResetData }: GlucoseChart2Props) {
  const [hoursInViewport, setHoursInViewport] = useState(5); // 3h past + 2h future
  const windowDimensions = useWindowDimensions();
  const screenWidth = windowDimensions.width;
  const screenHeight = windowDimensions.height;
  const scrollViewRef = useRef(null);

  // Chart dimensions
  const isLandscape = screenWidth > screenHeight;
  const CHART_HEIGHT = isLandscape
    ? Math.min(screenHeight - 120, 400)
    : Math.min(screenHeight * 0.4, 350);

  // Function to cycle through time ranges
  const cycleTimeRange = () => {
    const ranges = [3, 5, 8]; // 1h+2h, 3h+2h, 6h+2h
    const currentIndex = ranges.indexOf(hoursInViewport);
    const nextIndex = (currentIndex + 1) % ranges.length;
    setHoursInViewport(ranges[nextIndex]);
  };

  // Generate test dataset
  const generateTestData = (): GlucoseDataPoint[] => {
    const data: GlucoseDataPoint[] = [];
    const now = Date.now();
    const intervalMs = 5 * 60 * 1000; // 5 minutes

    // Start 12 hours ago, go to 3 hours future (15 hours total)
    const startTime = now - (12 * 60 * 60 * 1000); // 12h ago
    const endTime = now + (3 * 60 * 60 * 1000); // 3h future

    console.log(`Generating data from ${new Date(startTime)} to ${new Date(endTime)}`);

    let currentValue = 120; // Starting glucose value

    for (let time = startTime; time <= endTime; time += intervalMs) {
      // Add some realistic variation
      const variation = (Math.random() - 0.5) * 30; // ±15 mg/dL variation
      currentValue = Math.max(90, Math.min(210, currentValue + variation));

      const isCurrent = Math.abs(time - now) < (2.5 * 60 * 1000); // Within 2.5 min of now
      const isFuture = time > now;

      data.push({
        timestamp: time,
        value: Math.round(currentValue * 10) / 10,
        isCurrent,
        isFuture
      });
    }

    console.log(`Generated ${data.length} data points`);
    console.log(`Current readings: ${data.filter(d => d.isCurrent).length}`);
    console.log(`Future readings: ${data.filter(d => d.isFuture).length}`);
    console.log(`Past readings: ${data.filter(d => !d.isFuture && !d.isCurrent).length}`);

    return data;
  };

  const testData = generateTestData();

  // Create chart data for react-native-gifted-charts
  const chartData = testData.map((point, index) => ({
    value: point.value,
    label: index % 36 === 0 ? format(new Date(point.timestamp), 'HH:mm') : '', // Labels every 3h
    dataPointColor: point.isCurrent ? '#ef4444' : point.isFuture ? '#6b7280' : '#000000',
    dataPointRadius: point.isCurrent ? 6 : 4,
    showDataPoint: true,
    timestamp: point.timestamp
  }));

  // Calculate chart dimensions based on viewport
  // Make spacing differences more dramatic
  const dotsPerHour = 12; // 5-minute intervals = 12 dots per hour
  const dotsInViewport = hoursInViewport * dotsPerHour;
  const viewportWidth = screenWidth - 40; // Account for padding

  // More dramatic spacing differences
  let pointSpacing: number;
  switch (hoursInViewport) {
    case 3:
      pointSpacing = 50; // Wide spacing - fewer dots visible
      break;
    case 5:
      pointSpacing = 30; // Medium spacing
      break;
    case 8:
      pointSpacing = 20; // Tight spacing - more dots visible
      break;
    default:
      pointSpacing = 30;
  }

  // Full chart width should be much larger for scrolling
  const fullChartWidth = chartData.length * pointSpacing;

  console.log(`Viewport: ${hoursInViewport}h = ${dotsInViewport} dots, spacing: ${pointSpacing.toFixed(1)}px`);
  console.log(`Chart width: ${fullChartWidth}px for ${chartData.length} points`);

  // Find current reading index for centering
  const currentReadingIndex = testData.findIndex(point => point.isCurrent);
  const hasCurrentReading = currentReadingIndex !== -1;

  console.log(`Chart: ${chartData.length} points, width: ${fullChartWidth}px`);
  console.log(`Current reading at index: ${currentReadingIndex}`);

  // Auto-scroll to current reading when component loads or viewport changes
  useEffect(() => {
    if (hasCurrentReading && scrollViewRef.current) {
      const scrollToX = Math.max(0, (currentReadingIndex * pointSpacing) - (screenWidth / 2));
      console.log(`Auto-scrolling to current reading at index ${currentReadingIndex}, x=${scrollToX}, spacing=${pointSpacing}`);

      setTimeout(() => {
        scrollViewRef.current?.scrollTo?.({
          x: scrollToX,
          y: 0,
          animated: true
        });
      }, 300);
    }
  }, [hasCurrentReading, currentReadingIndex, pointSpacing, screenWidth, hoursInViewport]); // Added hoursInViewport dependency

  const currentGlucose = testData.find(d => d.isCurrent)?.value || testData[testData.length - 1]?.value;

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
            <Text style={styles.metricLabel}>Points</Text>
            <Text style={styles.metricValue}>{chartData.length}</Text>
          </View>
          <TouchableOpacity style={styles.timeRangeButton} onPress={cycleTimeRange}>
            <Text style={styles.timeRangeText}>
              {hoursInViewport === 3 ? 'Zoom' : hoursInViewport === 5 ? 'Normal' : 'Wide'}
            </Text>
          </TouchableOpacity>
          {onResetData && (
            <TouchableOpacity style={styles.resetButton} onPress={onResetData}>
              <Text style={styles.resetButtonText}>Reset</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Chart */}
      <View style={styles.chartContainer}>
        <Text style={{ fontSize: 12, color: '#666', marginBottom: 5 }}>
          Test Chart: {chartData.length} points - Viewport: {hoursInViewport}h ({dotsInViewport} dots)
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={true}
          ref={scrollViewRef}
          style={{ width: screenWidth - 40 }}
        >
          <LineChart
            data={chartData}
            width={fullChartWidth}
            height={CHART_HEIGHT}

            // Basic styling
            color1="#cccccc"
            thickness1={2}

            // Data points - will use individual colors from data
            hideDataPoints={false}

            // Y-axis
            maxValue={250}
            minValue={50}
            noOfSections={8}
            yAxisColor="#9ca3af"
            yAxisTextStyle={{ color: '#6b7280', fontSize: 12 }}

            // X-axis
            xAxisColor="#9ca3af"

            // Grid
            rulesType="solid"
            rulesColor="#f3f4f6"

            // Scrolling - use ScrollView instead of built-in scrolling
            spacing={pointSpacing}
            initialSpacing={20}
            endSpacing={20}

            // Disable built-in scrolling since we use ScrollView
            scrollToEnd={false}
            scrollAnimation={false}
            disableScroll={true}

            // Performance
            animateOnDataChange={false}
          />
        </ScrollView>
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#000000' }]} />
          <Text style={styles.legendText}>Past</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#ef4444' }]} />
          <Text style={styles.legendText}>Current</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#6b7280' }]} />
          <Text style={styles.legendText}>Future</Text>
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
  legendText: {
    fontSize: 12,
    color: '#6b7280',
  },
});