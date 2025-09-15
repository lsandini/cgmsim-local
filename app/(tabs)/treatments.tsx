import React, { useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSimulationStore } from '../../store/useSimulationStore';
import { Treatment } from '../../types';
import { format, isToday, isYesterday } from 'date-fns';

interface TreatmentItemProps {
  treatment: Treatment;
}

function TreatmentItem({ treatment }: TreatmentItemProps) {
  const getDateLabel = (date: Date) => {
    if (isToday(date)) return 'Today';
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'MMM d');
  };

  const getTypeIcon = (type: string) => {
    return type === 'carb' ? 'restaurant' : 'medical';
  };

  const getTypeColor = (type: string) => {
    return type === 'carb' ? '#f59e0b' : '#3b82f6';
  };

  return (
    <View style={styles.treatmentItem}>
      <View style={styles.treatmentHeader}>
        <View style={styles.treatmentInfo}>
          <View style={[styles.typeIcon, { backgroundColor: getTypeColor(treatment.type) }]}>
            <Ionicons 
              name={getTypeIcon(treatment.type) as any} 
              size={16} 
              color="#ffffff" 
            />
          </View>
          <View style={styles.treatmentDetails}>
            <Text style={styles.treatmentValue}>
              {treatment.value}{treatment.type === 'carb' ? 'g' : 'u'}
            </Text>
            <Text style={styles.treatmentType}>
              {treatment.type === 'carb' ? 'Carbs' : 'Insulin'}
            </Text>
          </View>
        </View>
        <View style={styles.treatmentTime}>
          <Text style={styles.dateLabel}>{getDateLabel(treatment.timestamp)}</Text>
          <Text style={styles.timeLabel}>{format(treatment.timestamp, 'h:mm a')}</Text>
        </View>
      </View>
      {treatment.metadata?.description && (
        <Text style={styles.treatmentDescription}>
          {treatment.metadata.description}
        </Text>
      )}
    </View>
  );
}

function EmptyState() {
  return (
    <View style={styles.emptyState}>
      <Ionicons name="medical-outline" size={64} color="#d1d5db" />
      <Text style={styles.emptyTitle}>No treatments yet</Text>
      <Text style={styles.emptyMessage}>
        Add carbs or insulin from the Glucose tab to see your treatment history here.
      </Text>
    </View>
  );
}

export default function TreatmentsScreen() {
  const {
    recentTreatments,
    isLoading,
    loadTreatments,
    currentPatient,
  } = useSimulationStore();

  useEffect(() => {
    if (currentPatient) {
      loadTreatments(50); // Load more treatments for history
    }
  }, [currentPatient, loadTreatments]);

  const onRefresh = useCallback(async () => {
    if (currentPatient) {
      await loadTreatments(50);
    }
  }, [currentPatient, loadTreatments]);

  // Group treatments by date
  const groupedTreatments = recentTreatments.reduce((groups, treatment) => {
    const dateKey = format(treatment.timestamp, 'yyyy-MM-dd');
    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }
    groups[dateKey].push(treatment);
    return groups;
  }, {} as Record<string, Treatment[]>);

  const sections = Object.entries(groupedTreatments)
    .map(([date, treatments]) => ({
      date: new Date(date),
      treatments: treatments.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()),
    }))
    .sort((a, b) => b.date.getTime() - a.date.getTime());

  const renderTreatment = ({ item }: { item: Treatment }) => (
    <TreatmentItem treatment={item} />
  );

  const renderSection = ({ item }: { item: typeof sections[0] }) => (
    <View style={styles.section}>
      <Text style={styles.sectionHeader}>
        {isToday(item.date) ? 'Today' : 
         isYesterday(item.date) ? 'Yesterday' : 
         format(item.date, 'EEEE, MMM d')}
      </Text>
      <FlatList
        data={item.treatments}
        renderItem={renderTreatment}
        keyExtractor={(treatment) => treatment.id}
        scrollEnabled={false}
      />
    </View>
  );

  if (!currentPatient) {
    return (
      <View style={styles.container}>
        <StatusBar style="dark" />
        <View style={styles.noPatientContainer}>
          <Ionicons name="person-add" size={64} color="#d1d5db" />
          <Text style={styles.noPatientTitle}>No Patient Profile</Text>
          <Text style={styles.noPatientMessage}>
            Create a patient profile from the Glucose tab to track treatments.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      
      {/* Summary Stats */}
      <View style={styles.summaryContainer}>
        <Text style={styles.summaryTitle}>Treatment Summary</Text>
        <View style={styles.summaryStats}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{recentTreatments.length}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>
              {recentTreatments.filter(t => t.type === 'carb').length}
            </Text>
            <Text style={styles.statLabel}>Carb Entries</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>
              {recentTreatments.filter(t => t.type === 'insulin').length}
            </Text>
            <Text style={styles.statLabel}>Insulin Doses</Text>
          </View>
        </View>
      </View>

      {sections.length === 0 ? (
        <EmptyState />
      ) : (
        <FlatList
          data={sections}
          renderItem={renderSection}
          keyExtractor={(section) => section.date.toISOString()}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={onRefresh}
              tintColor="#3b82f6"
            />
          }
          style={styles.list}
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  summaryContainer: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  summaryStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#3b82f6',
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    paddingLeft: 4,
  },
  treatmentItem: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  treatmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  treatmentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  typeIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  treatmentDetails: {
    flex: 1,
  },
  treatmentValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  treatmentType: {
    fontSize: 12,
    color: '#6b7280',
  },
  treatmentTime: {
    alignItems: 'flex-end',
  },
  dateLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  timeLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  treatmentDescription: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 8,
    fontStyle: 'italic',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyMessage: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  noPatientContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  noPatientTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
    marginBottom: 8,
  },
  noPatientMessage: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
  },
});