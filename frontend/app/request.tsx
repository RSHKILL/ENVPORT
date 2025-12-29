import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { Colors, Spacing, Typography, Radius, Shadows, WasteTypes, Quantities } from '../constants/theme';
import { useStore } from '../store/useStore';
import { pickupApi, calculateCost } from '../services/api';
import LocationMapModal from '../components/LocationMapModal';

// Pricing constants for preview
const RATE_PER_KM = 10;
const BASE_RATE = 50;
const VOLUME_FACTORS: Record<string, number> = {
  'Small': 1.0,
  'Medium': 1.5,
  'Large': 2.0,
  'Bulk': 3.0,
};
const WASTE_SURCHARGES: Record<string, number> = {
  'Organic': 1.0,
  'Plastic': 1.0,
  'Metal': 1.0,
  'E-Waste': 1.2,
  'Mixed': 1.1,
};

// Service center for Siliguri
const SERVICE_CENTER = { lat: 26.7271, lng: 88.3953 };
const SERVICE_RADIUS_KM = 20;

export default function RequestScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    pickupLocation,
    wasteImage,
    wasteType,
    quantity,
    userContact,
    notes,
    setPickupLocation,
    setWasteImage,
    setWasteType,
    setQuantity,
    setUserContact,
    setNotes,
    resetPickupForm,
    setTrackingRequestId,
  } = useStore();

  const [showMapModal, setShowMapModal] = useState(false);
  const [estimatedCost, setEstimatedCost] = useState<number | null>(null);
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [isInServiceArea, setIsInServiceArea] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [manualAddress, setManualAddress] = useState('');

  useEffect(() => {
    if (pickupLocation) {
      setManualAddress(pickupLocation.address);
      calculateEstimate();
    }
  }, [pickupLocation, wasteType, quantity]);

  const haversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371;
    const lat1Rad = (lat1 * Math.PI) / 180;
    const lat2Rad = (lat2 * Math.PI) / 180;
    const deltaLat = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLon = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(deltaLat / 2) ** 2 +
      Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(deltaLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const calculateEstimate = () => {
    if (!pickupLocation || !wasteType || !quantity) {
      setEstimatedCost(null);
      return;
    }

    const distance = haversineDistance(
      SERVICE_CENTER.lat,
      SERVICE_CENTER.lng,
      pickupLocation.latitude,
      pickupLocation.longitude
    );

    setDistanceKm(Math.round(distance * 100) / 100);
    setIsInServiceArea(distance <= SERVICE_RADIUS_KM);

    if (distance <= SERVICE_RADIUS_KM) {
      const volumeFactor = VOLUME_FACTORS[quantity] || 1;
      const surcharge = WASTE_SURCHARGES[wasteType] || 1;
      const cost = ((distance * RATE_PER_KM) + (volumeFactor * BASE_RATE)) * surcharge;
      setEstimatedCost(Math.round(cost * 100) / 100);
    } else {
      setEstimatedCost(null);
    }
  };

  const getCurrentLocation = async () => {
    try {
      setIsLoadingLocation(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required for this feature.');
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const [reverseGeocode] = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      const address = reverseGeocode
        ? `${reverseGeocode.street || ''} ${reverseGeocode.city || ''} ${reverseGeocode.region || ''}`.trim()
        : 'Location detected';

      setPickupLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        address,
      });
    } catch (error) {
      console.error('Location error:', error);
      Alert.alert('Error', 'Failed to get current location. Please try again.');
    } finally {
      setIsLoadingLocation(false);
    }
  };

  const pickImage = async (source: 'camera' | 'gallery') => {
    try {
      let result;

      if (source === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Denied', 'Camera permission is required.');
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.7,
          base64: true,
        });
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Denied', 'Gallery permission is required.');
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.7,
          base64: true,
        });
      }

      if (!result.canceled && result.assets[0].base64) {
        const base64Size = result.assets[0].base64.length;
        const maxSize = 2.67 * 1024 * 1024; // ~2MB in base64

        if (base64Size > maxSize) {
          Alert.alert('Image Too Large', 'Please select an image smaller than 2MB.');
          return;
        }

        setWasteImage(`data:image/jpeg;base64,${result.assets[0].base64}`);
      }
    } catch (error) {
      console.error('Image picker error:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const handleSubmit = async () => {
    // Validation
    if (!pickupLocation) {
      Alert.alert('Missing Information', 'Please set a pickup location.');
      return;
    }
    if (!wasteImage) {
      Alert.alert('Missing Information', 'Please add a photo of the waste.');
      return;
    }
    if (!wasteType) {
      Alert.alert('Missing Information', 'Please select a waste type.');
      return;
    }
    if (!quantity) {
      Alert.alert('Missing Information', 'Please select a quantity.');
      return;
    }
    if (!isInServiceArea) {
      Alert.alert('Outside Service Area', 'Currently we serve Siliguri city limits only.');
      return;
    }

    try {
      setIsSubmitting(true);

      const request = await pickupApi.create({
        location: {
          latitude: pickupLocation.latitude,
          longitude: pickupLocation.longitude,
          address: manualAddress || pickupLocation.address,
        },
        waste_image: wasteImage,
        waste_type: wasteType,
        quantity: quantity,
        user_contact: userContact || undefined,
        notes: notes || undefined,
      });

      resetPickupForm();
      setTrackingRequestId(request.id);

      Alert.alert(
        'Success!',
        `Your pickup request has been submitted. Estimated cost: ₹${request.estimated_cost}`,
        [
          {
            text: 'Track Request',
            onPress: () => router.push('/track'),
          },
        ]
      );
    } catch (error: any) {
      console.error('Submit error:', error);
      const message = error.response?.data?.detail || 'Failed to submit request. Please try again.';
      Alert.alert('Error', message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMapConfirm = (location: { latitude: number; longitude: number; address: string }) => {
    setPickupLocation(location);
    setShowMapModal(false);
  };

  return (
    <LinearGradient
      colors={[Colors.backgroundStart, Colors.backgroundEnd]}
      style={[styles.container, { paddingTop: insets.top }]}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={Colors.textDark} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Request Pickup</Text>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollView}>
          {/* Location Section */}
          <View style={[styles.section, Shadows.elevation2]}>
            <View style={styles.sectionHeader}>
              <Ionicons name="location" size={24} color={Colors.primary} />
              <Text style={styles.sectionTitle}>Pickup Location</Text>
            </View>

            <TextInput
              style={styles.addressInput}
              placeholder="Enter address manually"
              placeholderTextColor={Colors.textGray}
              value={manualAddress}
              onChangeText={setManualAddress}
              multiline
            />

            {pickupLocation && (
              <View style={styles.coordsContainer}>
                <Text style={styles.coordsText}>
                  Lat: {pickupLocation.latitude.toFixed(6)}, Lng: {pickupLocation.longitude.toFixed(6)}
                </Text>
              </View>
            )}

            <View style={styles.locationButtons}>
              <TouchableOpacity
                style={[styles.locationButton, styles.gpsButton]}
                onPress={getCurrentLocation}
                disabled={isLoadingLocation}
              >
                {isLoadingLocation ? (
                  <ActivityIndicator size="small" color={Colors.white} />
                ) : (
                  <Ionicons name="navigate" size={20} color={Colors.white} />
                )}
                <Text style={styles.gpsButtonText}>Use GPS</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.locationButton, styles.mapButton]}
                onPress={() => setShowMapModal(true)}
              >
                <Ionicons name="map" size={20} color={Colors.primary} />
                <Text style={styles.mapButtonText}>Pin on Map</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Waste Photo Section */}
          <View style={[styles.section, Shadows.elevation2]}>
            <View style={styles.sectionHeader}>
              <Ionicons name="camera" size={24} color={Colors.primary} />
              <Text style={styles.sectionTitle}>Waste Photo</Text>
              <Text style={styles.requiredBadge}>Required</Text>
            </View>

            {wasteImage ? (
              <View style={styles.imagePreview}>
                <Image source={{ uri: wasteImage }} style={styles.previewImage} />
                <TouchableOpacity
                  style={styles.removeImageButton}
                  onPress={() => setWasteImage(null)}
                >
                  <Ionicons name="close-circle" size={28} color={Colors.error} />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.imageButtons}>
                <TouchableOpacity
                  style={[styles.imageButton, { backgroundColor: Colors.primary }]}
                  onPress={() => pickImage('camera')}
                >
                  <Ionicons name="camera" size={32} color={Colors.white} />
                  <Text style={styles.imageButtonText}>Camera</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.imageButton, { backgroundColor: Colors.secondary }]}
                  onPress={() => pickImage('gallery')}
                >
                  <Ionicons name="images" size={32} color={Colors.white} />
                  <Text style={styles.imageButtonText}>Gallery</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Waste Type Section */}
          <View style={[styles.section, Shadows.elevation2]}>
            <View style={styles.sectionHeader}>
              <Ionicons name="trash" size={24} color={Colors.primary} />
              <Text style={styles.sectionTitle}>Waste Type</Text>
              <Text style={styles.requiredBadge}>Required</Text>
            </View>

            <View style={styles.wasteTypeGrid}>
              {WasteTypes.map((type) => (
                <TouchableOpacity
                  key={type.id}
                  style={[
                    styles.wasteTypeButton,
                    wasteType === type.id && styles.wasteTypeButtonActive,
                  ]}
                  onPress={() => setWasteType(type.id)}
                >
                  <View
                    style={[
                      styles.wasteTypeIcon,
                      wasteType === type.id && styles.wasteTypeIconActive,
                    ]}
                  >
                    <Ionicons
                      name={type.icon as any}
                      size={24}
                      color={wasteType === type.id ? Colors.white : Colors.primary}
                    />
                  </View>
                  <Text
                    style={[
                      styles.wasteTypeLabel,
                      wasteType === type.id && styles.wasteTypeLabelActive,
                    ]}
                  >
                    {type.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Quantity Section */}
          <View style={[styles.section, Shadows.elevation2]}>
            <View style={styles.sectionHeader}>
              <Ionicons name="cube" size={24} color={Colors.primary} />
              <Text style={styles.sectionTitle}>Quantity</Text>
              <Text style={styles.requiredBadge}>Required</Text>
            </View>

            <View style={styles.quantityGrid}>
              {Quantities.map((q) => (
                <TouchableOpacity
                  key={q.id}
                  style={[
                    styles.quantityButton,
                    quantity === q.id && styles.quantityButtonActive,
                  ]}
                  onPress={() => setQuantity(q.id)}
                >
                  <Text
                    style={[
                      styles.quantityLabel,
                      quantity === q.id && styles.quantityLabelActive,
                    ]}
                  >
                    {q.label}
                  </Text>
                  <Text
                    style={[
                      styles.quantityDescription,
                      quantity === q.id && styles.quantityDescriptionActive,
                    ]}
                  >
                    {q.description}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Cost Preview */}
          {(estimatedCost !== null || !isInServiceArea) && (
            <View
              style={[
                styles.costPreview,
                Shadows.elevation4,
                !isInServiceArea && styles.costPreviewError,
              ]}
            >
              {isInServiceArea ? (
                <>
                  <View style={styles.costHeader}>
                    <Ionicons name="calculator" size={24} color={Colors.textDark} />
                    <Text style={styles.costTitle}>Estimated Cost</Text>
                  </View>
                  <Text style={styles.costValue}>₹{estimatedCost}</Text>
                  <Text style={styles.costDistance}>Distance: {distanceKm} km from depot</Text>
                </>
              ) : (
                <>
                  <Ionicons name="alert-circle" size={32} color={Colors.error} />
                  <Text style={styles.errorText}>Outside Service Area</Text>
                  <Text style={styles.errorSubtext}>
                    Currently we serve Siliguri city limits only ({SERVICE_RADIUS_KM}km radius).
                  </Text>
                </>
              )}
            </View>
          )}

          {/* Contact & Notes */}
          <View style={[styles.section, Shadows.elevation2]}>
            <View style={styles.sectionHeader}>
              <Ionicons name="call" size={24} color={Colors.primary} />
              <Text style={styles.sectionTitle}>Contact (Optional)</Text>
            </View>
            <TextInput
              style={styles.input}
              placeholder="Phone number"
              placeholderTextColor={Colors.textGray}
              value={userContact}
              onChangeText={setUserContact}
              keyboardType="phone-pad"
            />

            <View style={[styles.sectionHeader, { marginTop: Spacing.sm }]}>
              <Ionicons name="document-text" size={24} color={Colors.primary} />
              <Text style={styles.sectionTitle}>Notes (Optional)</Text>
            </View>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Any special instructions..."
              placeholderTextColor={Colors.textGray}
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
            />
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>

        {/* Submit Button */}
        <View style={[styles.submitContainer, Shadows.elevation6, { paddingBottom: insets.bottom + Spacing.sm }]}>
          <TouchableOpacity
            style={[
              styles.submitButton,
              (!isInServiceArea || isSubmitting) && styles.submitButtonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={!isInServiceArea || isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={24} color={Colors.white} />
                <Text style={styles.submitButtonText}>Submit Request</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <LocationMapModal
        visible={showMapModal}
        onClose={() => setShowMapModal(false)}
        onConfirm={handleMapConfirm}
        initialLocation={pickupLocation}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  backButton: {
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
  scrollView: {
    flex: 1,
    paddingHorizontal: Spacing.sm,
  },
  section: {
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    gap: Spacing.xs,
  },
  sectionTitle: {
    fontSize: Typography.md,
    fontWeight: '600',
    color: Colors.textDark,
    flex: 1,
  },
  requiredBadge: {
    fontSize: Typography.xs,
    color: Colors.error,
    fontWeight: '500',
  },
  addressInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    padding: Spacing.xs,
    fontSize: Typography.md,
    color: Colors.textDark,
    minHeight: 44,
  },
  coordsContainer: {
    backgroundColor: Colors.backgroundEnd,
    padding: Spacing.xs,
    borderRadius: Radius.sm,
    marginTop: Spacing.xs,
  },
  coordsText: {
    fontSize: Typography.sm,
    color: Colors.textGray,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  locationButtons: {
    flexDirection: 'row',
    marginTop: Spacing.sm,
    gap: Spacing.xs,
  },
  locationButton: {
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
  mapButton: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  mapButtonText: {
    color: Colors.primary,
    fontWeight: '600',
    fontSize: Typography.sm,
  },
  imageButtons: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  imageButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.md,
    borderRadius: Radius.md,
    gap: Spacing.xs,
  },
  imageButtonText: {
    color: Colors.white,
    fontWeight: '600',
    fontSize: Typography.sm,
  },
  imagePreview: {
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: 200,
    borderRadius: Radius.md,
    backgroundColor: Colors.backgroundEnd,
  },
  removeImageButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: Colors.white,
    borderRadius: Radius.round,
  },
  wasteTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    justifyContent: 'space-between',
  },
  wasteTypeButton: {
    width: '18%',
    alignItems: 'center',
    padding: Spacing.xs,
  },
  wasteTypeButtonActive: {},
  wasteTypeIcon: {
    width: 52,
    height: 52,
    borderRadius: Radius.round,
    backgroundColor: Colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  wasteTypeIconActive: {
    backgroundColor: Colors.primary,
  },
  wasteTypeLabel: {
    fontSize: Typography.xs,
    color: Colors.textDark,
    textAlign: 'center',
  },
  wasteTypeLabelActive: {
    color: Colors.primary,
    fontWeight: '600',
  },
  quantityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  quantityButton: {
    flex: 1,
    minWidth: '45%',
    padding: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  quantityButtonActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  quantityLabel: {
    fontSize: Typography.md,
    fontWeight: '600',
    color: Colors.textDark,
  },
  quantityLabelActive: {
    color: Colors.white,
  },
  quantityDescription: {
    fontSize: Typography.xs,
    color: Colors.textGray,
    marginTop: 2,
  },
  quantityDescriptionActive: {
    color: Colors.white + 'CC',
  },
  costPreview: {
    backgroundColor: Colors.ctaGold,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    alignItems: 'center',
  },
  costPreviewError: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.error,
  },
  costHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  costTitle: {
    fontSize: Typography.md,
    fontWeight: '600',
    color: Colors.textDark,
  },
  costValue: {
    fontSize: Typography.xxl,
    fontWeight: '700',
    color: Colors.textDark,
    marginTop: Spacing.xs,
  },
  costDistance: {
    fontSize: Typography.sm,
    color: Colors.textDark + 'AA',
    marginTop: 4,
  },
  errorText: {
    fontSize: Typography.lg,
    fontWeight: '600',
    color: Colors.error,
    marginTop: Spacing.xs,
  },
  errorSubtext: {
    fontSize: Typography.sm,
    color: Colors.textGray,
    textAlign: 'center',
    marginTop: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    padding: Spacing.xs,
    fontSize: Typography.md,
    color: Colors.textDark,
    minHeight: 44,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  submitContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.white,
    paddingHorizontal: Spacing.sm,
    paddingTop: Spacing.sm,
  },
  submitButton: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.sm,
    borderRadius: Radius.lg,
    gap: Spacing.xs,
  },
  submitButtonDisabled: {
    backgroundColor: Colors.textGray,
  },
  submitButtonText: {
    color: Colors.white,
    fontSize: Typography.lg,
    fontWeight: '700',
  },
});
