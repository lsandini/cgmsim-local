import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
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

const { width: screenWidth } = Dimensions.get('window');
const CHART_WIDTH = screenWidth - 32;
const CHART_HEIGHT = 200;
const PADDING = 16;

export function GlucoseChart({ 
  readings, 
  targetRange, 
  currentGlucose,
  iob = 0,
  cob = 0 
}: GlucoseChartProps) {
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
  const minGlucose = Math.min(40, Math.min(...readings.map(r => r.value)));
  const maxGlucose = Math.max(300, Math.max(...readings.map(r => r.value)));
  const glucoseRange = maxGlucose - minGlucose;
  
  const minTime = Math.min(...readings.map(r => r.timestamp.getTime()));
  const maxTime = Math.max(...readings.map(r => r.timestamp.getTime()));
  const timeRange = maxTime - minTime;
  
  // Convert glucose value to y coordinate
  const glucoseToY = (glucose: number) => {
    return chartHeight - ((glucose - minGlucose) / glucoseRange) * chartHeight;
  };
  
  // Convert timestamp to x coordinate
  const timeToX = (timestamp: Date) => {
    return ((timestamp.getTime() - minTime) / timeRange) * chartWidth;
  };
  
  // Separate past and future readings
  const now = new Date();
  const pastReadings = readings.filter(r => !r.isFuture);
  const futureReadings = readings.filter(r => r.isFuture);
  
  // Create path for past readings (solid line)
  const createPath = (data: GlucoseReading[]) => {
    if (data.length === 0) return '';
    
    let path = `M ${timeToX(data[0].timestamp)} ${glucoseToY(data[0].value)}`;
    
    for (let i = 1; i < data.length; i++) {
      const x = timeToX(data[i].timestamp);
      const y = glucoseToY(data[i].value);
      path += ` L ${x} ${y}`;
    }
    
    return path;
  };
  
  const pastPath = createPath(pastReadings);
  const futurePath = createPath(futureReadings);
  
  // Target range paths
  const targetLowY = glucoseToY(targetRange.low);
  const targetHighY = glucoseToY(targetRange.high);
  
  // Create time labels
  const timeLabels = [];
  const labelCount = 4;
  for (let i = 0; i <= labelCount; i++) {
    const time = new Date(minTime + (timeRange * i) / labelCount);
    const x = (chartWidth * i) / labelCount;
    timeLabels.push({
      x,
      time: format(time, 'HH:mm'),
    });
  }
  
  // Create glucose labels
  const glucoseLabels = [];
  const glucoseLabelCount = 4;
  for (let i = 0; i <= glucoseLabelCount; i++) {
    const glucose = Math.round(minGlucose + (glucoseRange * i) / glucoseLabelCount);
    const y = chartHeight - (chartHeight * i) / glucoseLabelCount;
    glucoseLabels.push({
      y,
      value: glucose,
    });
  }
  
  // Current reading indicator
  const currentReading = pastReadings[pastReadings.length - 1];
  const currentX = currentReading ? timeToX(currentReading.timestamp) : 0;
  const currentY = currentReading ? glucoseToY(currentReading.value) : 0;

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
        </View>
      </View>

      {/* Chart */}
      <View style={styles.chartContainer}>
        <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
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
            
            {timeLabels.map((label, index) => (
              <Line
                key={`time-grid-${index}`}
                x1={label.x}
                y1={0}
                x2={label.x}
                y2={chartHeight}
                stroke="#e5e7eb"
                strokeWidth={1}
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
            
            {/* Past glucose line */}
            {pastPath && (
              <Path
                d={pastPath}
                stroke="#1f2937"
                strokeWidth={3}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
            
            {/* Future glucose line */}
            {futurePath && (
              <Path
                d={futurePath}
                stroke="url(#futureGradient)"
                strokeWidth={3}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="8,4"
              />
            )}
            
            {/* Current point indicator */}
            {currentReading && (
              <Circle
                cx={currentX}
                cy={currentY}
                r={6}
                fill="#ef4444"
                stroke="#ffffff"
                strokeWidth={2}
              />
            )}
            
            {/* Glucose labels */}
            {glucoseLabels.map((label, index) => (
              <SvgText
                key={`glucose-label-${index}`}
                x={-8}
                y={label.y + 4}
                fontSize={12}
                fill="#6b7280"
                textAnchor="end"
              >
                {label.value}
              </SvgText>
            ))}
            
            {/* Time labels */}
            {timeLabels.map((label, index) => (
              <SvgText
                key={`time-label-${index}`}
                x={label.x}
                y={chartHeight + 16}
                fontSize={12}
                fill="#6b7280"
                textAnchor="middle"
              >
                {label.time}
              </SvgText>
            ))}
          </G>
        </Svg>
      </View>
      
      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendLine, { backgroundColor: '#1f2937' }]} />
          <Text style={styles.legendText}>Past</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendLine, { backgroundColor: '#3b82f6', opacity: 0.6 }]} />
          <Text style={styles.legendText}>Predicted</Text>
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
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
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
    marginBottom: 16,
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
  chartContainer: {
    alignItems: 'center',
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