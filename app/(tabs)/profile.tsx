import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  Switch,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSimulationStore } from '../../store/useSimulationStore';

interface SettingRowProps {
  label: string;
  value: string | number;
  unit?: string;
  onPress?: () => void;
  editable?: boolean;
}

function SettingRow({ label, value, unit, onPress, editable = true }: SettingRowProps) {
  return (
    <TouchableOpacity 
      style={styles.settingRow} 
      onPress={editable ? onPress : undefined}
      disabled={!editable}
    >
      <Text style={styles.settingLabel}>{label}</Text>
      <View style={styles.settingValue}>
        <Text style={styles.settingValueText}>
          {value}{unit ? ` ${unit}` : ''}
        </Text>
        {editable && <Ionicons name="chevron-forward" size={16} color="#9ca3af" />}
      </View>
    </TouchableOpacity>
  );
}

interface EditModalProps {
  visible: boolean;
  title: string;
  value: string;
  unit?: string;
  keyboardType?: 'default' | 'numeric' | 'decimal-pad';
  onSave: (value: string) => void;
  onCancel: () => void;
}

function EditModal({ visible, title, value, unit, keyboardType = 'default', onSave, onCancel }: EditModalProps) {
  const [inputValue, setInputValue] = useState(value);

  if (!visible) return null;

  return (
    <View style={styles.modalOverlay}>
      <View style={styles.modalContent}>
        <Text style={styles.modalTitle}>{title}</Text>
        
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={inputValue}
            onChangeText={setInputValue}
            keyboardType={keyboardType}
            placeholder={`Enter ${title.toLowerCase()}`}
            returnKeyType="done"
            autoFocus
          />
          {unit && <Text style={styles.inputUnit}>{unit}</Text>}
        </View>

        <View style={styles.modalActions}>
          <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.saveButton} onPress={() => onSave(inputValue)}>
            <Text style={styles.saveButtonText}>Save</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

export default function ProfileScreen() {
  const { currentPatient, updatePatient, isLoading } = useSimulationStore();
  const [editModal, setEditModal] = useState<{
    visible: boolean;
    field: string;
    title: string;
    value: string;
    unit?: string;
    type?: 'default' | 'numeric' | 'decimal-pad';
  }>({
    visible: false,
    field: '',
    title: '',
    value: '',
  });

  const openEditModal = useCallback((
    field: string, 
    title: string, 
    value: number | string, 
    unit?: string,
    type: 'default' | 'numeric' | 'decimal-pad' = 'decimal-pad'
  ) => {
    setEditModal({
      visible: true,
      field,
      title,
      value: value.toString(),
      unit,
      type,
    });
  }, []);

  const handleSave = useCallback(async (value: string) => {
    if (!currentPatient) return;

    try {
      const numericValue = parseFloat(value);
      if (isNaN(numericValue) && editModal.type !== 'default') {
        Alert.alert('Invalid Input', 'Please enter a valid number');
        return;
      }

      const updates: any = {};
      
      if (editModal.type === 'default') {
        updates[editModal.field] = value;
      } else {
        updates[editModal.field] = numericValue;
      }

      await updatePatient(updates);
      setEditModal(prev => ({ ...prev, visible: false }));
    } catch (error) {
      Alert.alert('Error', 'Failed to update profile. Please try again.');
    }
  }, [currentPatient, updatePatient, editModal.field, editModal.type]);

  const handleCancel = useCallback(() => {
    setEditModal(prev => ({ ...prev, visible: false }));
  }, []);

  if (!currentPatient) {
    return (
      <View style={styles.container}>
        <StatusBar style="dark" />
        <View style={styles.noPatientContainer}>
          <Ionicons name="person-add" size={64} color="#d1d5db" />
          <Text style={styles.noPatientTitle}>No Patient Profile</Text>
          <Text style={styles.noPatientMessage}>
            Create a patient profile from the Glucose tab to configure your settings.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Profile Header */}
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={32} color="#6b7280" />
          </View>
          <Text style={styles.patientName}>{currentPatient.name}</Text>
          <Text style={styles.patientId}>ID: {currentPatient.id.slice(-8)}</Text>
        </View>

        {/* Basic Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Basic Information</Text>
          <SettingRow
            label="Name"
            value={currentPatient.name}
            onPress={() => openEditModal('name', 'Name', currentPatient.name, undefined, 'default')}
          />
          <SettingRow
            label="Weight"
            value={currentPatient.weight}
            unit="kg"
            onPress={() => openEditModal('weight', 'Weight', currentPatient.weight, 'kg')}
          />
          <SettingRow
            label="Total Daily Dose"
            value={currentPatient.totalDailyDose}
            unit="units"
            onPress={() => openEditModal('totalDailyDose', 'Total Daily Dose', currentPatient.totalDailyDose, 'units')}
          />
        </View>

        {/* Insulin Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Insulin Settings</Text>
          <SettingRow
            label="Insulin Sensitivity"
            value={currentPatient.insulinSensitivity}
            unit="mg/dL per unit"
            onPress={() => openEditModal('insulinSensitivity', 'Insulin Sensitivity', currentPatient.insulinSensitivity, 'mg/dL per unit')}
          />
          <SettingRow
            label="Carb Ratio"
            value={currentPatient.carbRatio}
            unit="g per unit"
            onPress={() => openEditModal('carbRatio', 'Carb Ratio', currentPatient.carbRatio, 'g per unit')}
          />
          <SettingRow
            label="Insulin Duration"
            value={currentPatient.insulinDuration}
            unit="hours"
            onPress={() => openEditModal('insulinDuration', 'Insulin Duration', currentPatient.insulinDuration, 'hours')}
          />
        </View>

        {/* Target Range */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Target Range</Text>
          <SettingRow
            label="Target Low"
            value={currentPatient.targetGlucose.low}
            unit="mg/dL"
            onPress={() => openEditModal('targetGlucose.low', 'Target Low', currentPatient.targetGlucose.low, 'mg/dL')}
          />
          <SettingRow
            label="Target High"
            value={currentPatient.targetGlucose.high}
            unit="mg/dL"
            onPress={() => openEditModal('targetGlucose.high', 'Target High', currentPatient.targetGlucose.high, 'mg/dL')}
          />
        </View>

        {/* Advanced Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Advanced Settings</Text>
          <SettingRow
            label="Carb Absorption Rate"
            value={currentPatient.carbAbsorptionRate}
            unit="hours"
            onPress={() => openEditModal('carbAbsorptionRate', 'Carb Absorption Rate', currentPatient.carbAbsorptionRate, 'hours')}
          />
          <SettingRow
            label="Liver Glucose Production"
            value={currentPatient.liverGlucoseProduction}
            unit="mg/dL per min"
            onPress={() => openEditModal('liverGlucoseProduction', 'Liver Glucose Production', currentPatient.liverGlucoseProduction, 'mg/dL per min')}
          />
          <SettingRow
            label="Current Glucose"
            value={currentPatient.currentGlucose}
            unit="mg/dL"
            onPress={() => openEditModal('currentGlucose', 'Current Glucose', currentPatient.currentGlucose, 'mg/dL')}
          />
          <SettingRow
            label="Noise Level"
            value={currentPatient.noiseLevel}
            unit="mg/dL"
            onPress={() => openEditModal('noiseLevel', 'Noise Level', currentPatient.noiseLevel, 'mg/dL')}
          />
        </View>

        {/* Profile Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profile Information</Text>
          <SettingRow
            label="Created"
            value={currentPatient.createdAt.toLocaleDateString()}
            editable={false}
          />
          <SettingRow
            label="Last Modified"
            value={currentPatient.updatedAt.toLocaleDateString()}
            editable={false}
          />
        </View>
      </ScrollView>

      <EditModal
        visible={editModal.visible}
        title={editModal.title}
        value={editModal.value}
        unit={editModal.unit}
        keyboardType={editModal.type}
        onSave={handleSave}
        onCancel={handleCancel}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  header: {
    backgroundColor: '#ffffff',
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  patientName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
  },
  patientId: {
    fontSize: 12,
    color: '#6b7280',
  },
  section: {
    backgroundColor: '#ffffff',
    marginTop: 16,
    marginHorizontal: 16,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    padding: 16,
    paddingBottom: 8,
    backgroundColor: '#f9fafb',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  settingLabel: {
    fontSize: 14,
    color: '#374151',
    flex: 1,
  },
  settingValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  settingValueText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    marginHorizontal: 32,
    width: '100%',
    maxWidth: 300,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 16,
    textAlign: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 20,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1f2937',
  },
  inputUnit: {
    fontSize: 14,
    color: '#6b7280',
    marginLeft: 8,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  saveButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
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