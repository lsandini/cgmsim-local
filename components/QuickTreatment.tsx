import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  Modal,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface QuickTreatmentProps {
  onAddTreatment: (type: 'carb' | 'insulin', value: number) => void;
  isLoading?: boolean;
}

export function QuickTreatment({ onAddTreatment, isLoading = false }: QuickTreatmentProps) {
  const [modalVisible, setModalVisible] = useState(false);
  const [treatmentType, setTreatmentType] = useState<'carb' | 'insulin'>('carb');
  const [inputValue, setInputValue] = useState('');

  const carbPresets = [5, 10, 15, 20, 30, 45, 60];
  const insulinPresets = [0.5, 1, 1.5, 2, 3, 4, 5];

  const handlePresetPress = (value: number) => {
    onAddTreatment(treatmentType, value);
  };

  const handleCustomSubmit = () => {
    const value = parseFloat(inputValue);
    if (isNaN(value) || value <= 0) {
      Alert.alert('Invalid Input', 'Please enter a valid positive number');
      return;
    }

    if (treatmentType === 'carb' && value > 200) {
      Alert.alert('High Carb Amount', 'Are you sure you want to enter more than 200g of carbs?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Yes', onPress: () => submitTreatment(value) },
      ]);
      return;
    }

    if (treatmentType === 'insulin' && value > 20) {
      Alert.alert('High Insulin Dose', 'Are you sure you want to enter more than 20 units of insulin?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Yes', onPress: () => submitTreatment(value) },
      ]);
      return;
    }

    submitTreatment(value);
  };

  const submitTreatment = (value: number) => {
    onAddTreatment(treatmentType, value);
    setInputValue('');
    setModalVisible(false);
  };

  const openModal = (type: 'carb' | 'insulin') => {
    setTreatmentType(type);
    setModalVisible(true);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Quick Treatment</Text>
      
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.treatmentButton, styles.carbButton]}
          onPress={() => openModal('carb')}
          disabled={isLoading}
        >
          <Ionicons name="restaurant" size={24} color="#ffffff" />
          <Text style={styles.buttonText}>Add Carbs</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.treatmentButton, styles.insulinButton]}
          onPress={() => openModal('insulin')}
          disabled={isLoading}
        >
          <Ionicons name="medical" size={24} color="#ffffff" />
          <Text style={styles.buttonText}>Add Insulin</Text>
        </TouchableOpacity>
      </View>

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Add {treatmentType === 'carb' ? 'Carbs' : 'Insulin'}
              </Text>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <Text style={styles.sectionTitle}>Quick Select</Text>
            <View style={styles.presetContainer}>
              {(treatmentType === 'carb' ? carbPresets : insulinPresets).map((preset) => (
                <TouchableOpacity
                  key={preset}
                  style={styles.presetButton}
                  onPress={() => handlePresetPress(preset)}
                  disabled={isLoading}
                >
                  <Text style={styles.presetText}>
                    {preset}{treatmentType === 'carb' ? 'g' : 'u'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.sectionTitle}>Custom Amount</Text>
            <View style={styles.customInputContainer}>
              <TextInput
                style={styles.customInput}
                value={inputValue}
                onChangeText={setInputValue}
                placeholder={`Enter ${treatmentType === 'carb' ? 'grams' : 'units'}`}
                keyboardType="decimal-pad"
                returnKeyType="done"
                onSubmitEditing={handleCustomSubmit}
              />
              <Text style={styles.inputUnit}>
                {treatmentType === 'carb' ? 'g' : 'u'}
              </Text>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.actionButton, styles.cancelButton]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  styles.submitButton,
                  treatmentType === 'carb' ? styles.carbButton : styles.insulinButton
                ]}
                onPress={handleCustomSubmit}
                disabled={isLoading || !inputValue.trim()}
              >
                <Text style={styles.submitButtonText}>
                  {isLoading ? 'Adding...' : 'Add'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  treatmentButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  carbButton: {
    backgroundColor: '#f59e0b',
  },
  insulinButton: {
    backgroundColor: '#3b82f6',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1f2937',
  },
  closeButton: {
    padding: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
    marginTop: 8,
  },
  presetContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  presetButton: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  presetText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  customInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 20,
  },
  customInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1f2937',
  },
  inputUnit: {
    fontSize: 16,
    color: '#6b7280',
    marginLeft: 8,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  submitButton: {
    // Color will be set by carbButton or insulinButton
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
});