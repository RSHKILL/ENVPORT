import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
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
  const mapRef = useRef<MapView>(null);
  const [markerPosition, setMarkerPosition] = useState({
    latitude: initialLocation?.latitude || DEFAULT_LOCATION.latitude,
    longitude: initialLocation?.longitude || DEFAULT_LOCATION.longitude,
  });
  const [address, setAddress] = useState(initialLocation?.address || '');
  const [loading, setLoading] = useState(false);
  const [geocoding, setGeocoding] = useState(false);

  useEffect(() => {
    if (visible && initialLocation) {
      setMarkerPosition({
        latitude: initialLocation.latitude,
        longitude: initialLocation.longitude,
      });
      setAddress(initialLocation.address);
    }
  }, [visible, initialLocation]);

  const reverseGeocode = async (lat: number, lng: number) => {
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

      const newPosition = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
      setMarkerPosition(newPosition);

      // Animate map to new location
      mapRef.current?.animateToRegion({
        ...newPosition,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 500);

      await reverseGeocode(newPosition.latitude, newPosition.longitude);
    } catch (error) {
      console.error('Location error:', error);
      Alert.alert('Error', 'Failed to get current location.');
    } finally {
      setLoading(false);
    }
  };

  const handleMapPress = (event: any) => {
    const { coordinate } = event.nativeEvent;
    setMarkerPosition(coordinate);
    reverseGeocode(coordinate.latitude, coordinate.longitude);
  };

  const handleMarkerDragEnd = (event: any) => {
    const { coordinate } = event.nativeEvent;
    setMarkerPosition(coordinate);
    reverseGeocode(coordinate.latitude, coordinate.longitude);
  };

  const handleConfirm = () => {
    onConfirm({
      latitude: markerPosition.latitude,
      longitude: markerPosition.longitude,
      address: address || `${markerPosition.latitude.toFixed(4)}, ${markerPosition.longitude.toFixed(4)}`,
    });
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <View style={styles.container}>
        {/* Header */}
        <View style={[styles.header, Shadows.elevation4]}>
          <TouchableOpacity onPress={onClose} style={styles.headerButton}>
            <Ionicons name="close" size={24} color={Colors.textDark} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Select Location</Text>
          <TouchableOpacity
            onPress={getCurrentLocation}
            style={styles.headerButton}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : (
              <Ionicons name="navigate" size={24} color={Colors.primary} />
            )}
          </TouchableOpacity>
        </View>

        {/* Map */}
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={PROVIDER_GOOGLE}
          initialRegion={{
            latitude: markerPosition.latitude,
            longitude: markerPosition.longitude,
            latitudeDelta: 0.02,
            longitudeDelta: 0.02,
          }}
          onPress={handleMapPress}
          showsUserLocation
          showsMyLocationButton={false}
        >
          <Marker
            coordinate={markerPosition}
            draggable
            onDragEnd={handleMarkerDragEnd}
          >
            <View style={styles.markerContainer}>
              <Ionicons name="location" size={40} color={Colors.primary} />
            </View>
          </Marker>
        </MapView>

        {/* Footer */}
        <View style={[styles.footer, Shadows.elevation6]}>
          {/* Address Display */}
          <View style={styles.addressContainer}>
            <Ionicons name="location" size={24} color={Colors.primary} />
            <View style={styles.addressTextContainer}>
              {geocoding ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : (
                <>
                  <Text style={styles.addressLabel}>Pickup Location</Text>
                  <Text style={styles.addressText} numberOfLines={2}>
                    {address || 'Tap on map or drag marker to set location'}
                  </Text>
                  <Text style={styles.coordsText}>
                    {markerPosition.latitude.toFixed(6)}, {markerPosition.longitude.toFixed(6)}
                  </Text>
                </>
              )}
            </View>
          </View>

          {/* Instruction Card */}
          <View style={styles.instructionCard}>
            <Ionicons name="information-circle" size={18} color={Colors.secondary} />
            <Text style={styles.instructionText}>
              Tap anywhere or drag the pin to set your pickup location
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
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundStart,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingTop: Platform.OS === 'ios' ? 50 : Spacing.sm,
    backgroundColor: Colors.white,
  },
  headerButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: Typography.lg,
    fontWeight: '700',
    color: Colors.textDark,
  },
  map: {
    flex: 1,
  },
  markerContainer: {
    alignItems: 'center',
  },
  footer: {
    backgroundColor: Colors.white,
    padding: Spacing.md,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
  },
  addressContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  addressTextContainer: {
    flex: 1,
    marginLeft: Spacing.xs,
  },
  addressLabel: {
    fontSize: Typography.sm,
    color: Colors.textGray,
  },
  addressText: {
    fontSize: Typography.md,
    fontWeight: '600',
    color: Colors.textDark,
    marginTop: 2,
  },
  coordsText: {
    fontSize: Typography.xs,
    color: Colors.textGray,
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  instructionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.secondary + '15',
    borderRadius: Radius.sm,
    padding: Spacing.xs,
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
