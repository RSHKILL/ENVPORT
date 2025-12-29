import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { Colors, Spacing, Typography, Radius, Shadows } from '../constants/theme';

interface LocationMapModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (location: { latitude: number; longitude: number; address: string }) => void;
  initialLocation?: { latitude: number; longitude: number; address: string } | null;
}

// Siliguri center coordinates
const DEFAULT_LOCATION = {
  latitude: 26.7271,
  longitude: 88.3953,
};

export default function LocationMapModal({
  visible,
  onClose,
  onConfirm,
  initialLocation,
}: LocationMapModalProps) {
  const [latitude, setLatitude] = useState(
    initialLocation?.latitude?.toString() || DEFAULT_LOCATION.latitude.toString()
  );
  const [longitude, setLongitude] = useState(
    initialLocation?.longitude?.toString() || DEFAULT_LOCATION.longitude.toString()
  );
  const [address, setAddress] = useState(initialLocation?.address || '');
  const [loading, setLoading] = useState(false);
  const [geocoding, setGeocoding] = useState(false);

  useEffect(() => {
    if (visible && initialLocation) {
      setLatitude(initialLocation.latitude.toString());
      setLongitude(initialLocation.longitude.toString());
      setAddress(initialLocation.address);
    }
  }, [visible, initialLocation]);

  const reverseGeocode = async () => {
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    if (isNaN(lat) || isNaN(lng)) {
      Alert.alert('Invalid Coordinates', 'Please enter valid latitude and longitude.');
      return;
    }

    try {
      setGeocoding(true);
      const [result] = await Location.reverseGeocodeAsync({
        latitude: lat,
        longitude: lng,
      });

      if (result) {
        const addr = `${result.street || ''} ${result.city || ''} ${result.region || ''}`.trim();
        setAddress(addr || 'Location found');
      }
    } catch (error) {
      console.error('Reverse geocode error:', error);
      setAddress('Address lookup failed');
    } finally {
      setGeocoding(false);
    }
  };

  const getCurrentLocation = async () => {
    try {
      setLoading(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required.');
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      setLatitude(location.coords.latitude.toString());
      setLongitude(location.coords.longitude.toString());

      const [result] = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      if (result) {
        const addr = `${result.street || ''} ${result.city || ''} ${result.region || ''}`.trim();
        setAddress(addr || 'Current location');
      }
    } catch (error) {
      console.error('Location error:', error);
      Alert.alert('Error', 'Failed to get current location.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    if (isNaN(lat) || isNaN(lng)) {
      Alert.alert('Invalid Coordinates', 'Please enter valid latitude and longitude.');
      return;
    }

    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      Alert.alert('Invalid Coordinates', 'Coordinates are out of valid range.');
      return;
    }

    onConfirm({
      latitude: lat,
      longitude: lng,
      address: address || `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
    });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={[styles.container, Shadows.elevation6]}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Set Location</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={Colors.textDark} />
            </TouchableOpacity>
          </View>

          {/* Map Placeholder */}
          <View style={styles.mapPlaceholder}>
            <Ionicons name="map" size={64} color={Colors.primary} />
            <Text style={styles.placeholderTitle}>Map View</Text>
            <Text style={styles.placeholderText}>
              {Platform.OS === 'web'
                ? 'Maps are not available in web preview. Please use coordinates below.'
                : 'Google Maps integration requires API key. Enter coordinates manually or use GPS.'}
            </Text>
          </View>

          {/* Coordinates Input */}
          <View style={styles.inputSection}>
            <View style={styles.coordRow}>
              <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>Latitude</Text>
                <TextInput
                  style={styles.input}
                  value={latitude}
                  onChangeText={setLatitude}
                  keyboardType="numeric"
                  placeholder="e.g., 26.7271"
                  placeholderTextColor={Colors.textGray}
                />
              </View>
              <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>Longitude</Text>
                <TextInput
                  style={styles.input}
                  value={longitude}
                  onChangeText={setLongitude}
                  keyboardType="numeric"
                  placeholder="e.g., 88.3953"
                  placeholderTextColor={Colors.textGray}
                />
              </View>
            </View>

            <View style={styles.addressWrapper}>
              <Text style={styles.inputLabel}>Address</Text>
              <TextInput
                style={[styles.input, styles.addressInput]}
                value={address}
                onChangeText={setAddress}
                placeholder="Enter address or get from coordinates"
                placeholderTextColor={Colors.textGray}
                multiline
              />
            </View>

            {/* Action Buttons */}
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={[styles.actionButton, styles.gpsButton]}
                onPress={getCurrentLocation}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color={Colors.white} />
                ) : (
                  <Ionicons name="navigate" size={20} color={Colors.white} />
                )}
                <Text style={styles.gpsButtonText}>Use GPS</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.geocodeButton]}
                onPress={reverseGeocode}
                disabled={geocoding}
              >
                {geocoding ? (
                  <ActivityIndicator size="small" color={Colors.primary} />
                ) : (
                  <Ionicons name="search" size={20} color={Colors.primary} />
                )}
                <Text style={styles.geocodeButtonText}>Get Address</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Instruction Card */}
          <View style={styles.instructionCard}>
            <Ionicons name="information-circle" size={20} color={Colors.secondary} />
            <Text style={styles.instructionText}>
              For Siliguri area, latitude should be around 26.6-26.9 and longitude around 88.3-88.5
            </Text>
          </View>

          {/* Confirm Button */}
          <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm}>
            <Ionicons name="checkmark-circle" size={24} color={Colors.white} />
            <Text style={styles.confirmButtonText}>Confirm Location</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.md,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  title: {
    fontSize: Typography.lg,
    fontWeight: '700',
    color: Colors.textDark,
  },
  closeButton: {
    padding: Spacing.xs,
  },
  mapPlaceholder: {
    backgroundColor: Colors.backgroundEnd,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  placeholderTitle: {
    fontSize: Typography.md,
    fontWeight: '600',
    color: Colors.textDark,
    marginTop: Spacing.xs,
  },
  placeholderText: {
    fontSize: Typography.sm,
    color: Colors.textGray,
    textAlign: 'center',
    marginTop: Spacing.xs,
  },
  inputSection: {
    marginBottom: Spacing.sm,
  },
  coordRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  inputWrapper: {
    flex: 1,
  },
  addressWrapper: {
    marginTop: Spacing.xs,
  },
  inputLabel: {
    fontSize: Typography.sm,
    color: Colors.textGray,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    padding: Spacing.xs,
    fontSize: Typography.md,
    color: Colors.textDark,
  },
  addressInput: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xs,
    borderRadius: Radius.sm,
    gap: 6,
  },
  gpsButton: {
    backgroundColor: Colors.primary,
  },
  gpsButtonText: {
    color: Colors.white,
    fontWeight: '600',
    fontSize: Typography.sm,
  },
  geocodeButton: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  geocodeButtonText: {
    color: Colors.primary,
    fontWeight: '600',
    fontSize: Typography.sm,
  },
  instructionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.secondary + '15',
    borderRadius: Radius.sm,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
    gap: Spacing.xs,
  },
  instructionText: {
    flex: 1,
    fontSize: Typography.sm,
    color: Colors.textDark,
  },
  confirmButton: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.sm,
    borderRadius: Radius.lg,
    gap: Spacing.xs,
  },
  confirmButtonText: {
    color: Colors.white,
    fontSize: Typography.lg,
    fontWeight: '700',
  },
});
