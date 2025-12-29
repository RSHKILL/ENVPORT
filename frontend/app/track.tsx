import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Linking,
  Alert,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, Typography, Radius, Shadows, StatusColors } from '../constants/theme';
import { useStore } from '../store/useStore';
import { pickupApi, driversApi, PickupRequest, Driver } from '../services/api';
import { format } from 'date-fns';

export default function TrackScreen() {
  const insets = useSafeAreaInsets();
  const { trackingRequestId, setTrackingRequestId, recentRequests, setRecentRequests } = useStore();
  const [searchId, setSearchId] = useState(trackingRequestId || '');
  const [request, setRequest] = useState<PickupRequest | null>(null);
  const [driver, setDriver] = useState<Driver | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (trackingRequestId) {
      setSearchId(trackingRequestId);
      fetchRequest(trackingRequestId);
    }
    fetchRecentRequests();
  }, [trackingRequestId]);

  const fetchRequest = async (id: string) => {
    if (!id.trim()) return;

    try {
      setLoading(true);
      setError(null);
      const data = await pickupApi.getById(id.trim());
      setRequest(data);
      setTrackingRequestId(data.id);

      if (data.driver_id) {
        try {
          const driverData = await driversApi.getById(data.driver_id);
          setDriver(driverData);
        } catch (e) {
          setDriver(null);
        }
      } else {
        setDriver(null);
      }
    } catch (error: any) {
      console.error('Fetch error:', error);
      setError('Request not found. Please check the ID.');
      setRequest(null);
      setDriver(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchRecentRequests = async () => {
    try {
      const requests = await pickupApi.getAll(undefined, 10, 0);
      setRecentRequests(requests);
    } catch (error) {
      console.error('Error fetching recent requests:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    if (searchId) {
      await fetchRequest(searchId);
    }
    await fetchRecentRequests();
    setRefreshing(false);
  };

  const callDriver = (phone: string) => {
    Linking.openURL(`tel:${phone}`);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Pending':
        return 'time';
      case 'Approved':
        return 'checkmark-circle';
      case 'Assigned':
        return 'person';
      case 'Completed':
        return 'checkmark-done-circle';
      default:
        return 'help-circle';
    }
  };

  const getStatusDescription = (status: string) => {
    switch (status) {
      case 'Pending':
        return 'Your request is awaiting admin approval.';
      case 'Approved':
        return 'Request approved! A driver will be assigned soon.';
      case 'Assigned':
        return 'A driver has been assigned and will arrive shortly.';
      case 'Completed':
        return 'Pickup completed. Thank you for choosing EcoPort!';
      default:
        return 'Status unknown.';
    }
  };

  return (
    <LinearGradient
      colors={[Colors.backgroundStart, Colors.backgroundEnd]}
      style={[styles.container, { paddingTop: insets.top }]}
    >
      {/* Header */}
      <View style={styles.header}>
        <Ionicons name="location" size={28} color={Colors.primary} />
        <Text style={styles.headerTitle}>Track Request</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />
        }
        style={styles.scrollView}
      >
        {/* Search Box */}
        <View style={[styles.searchBox, Shadows.elevation2]}>
          <TextInput
            style={styles.searchInput}
            placeholder="Enter Request ID"
            placeholderTextColor={Colors.textGray}
            value={searchId}
            onChangeText={setSearchId}
          />
          <TouchableOpacity
            style={styles.searchButton}
            onPress={() => fetchRequest(searchId)}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color={Colors.white} />
            ) : (
              <Ionicons name="search" size={20} color={Colors.white} />
            )}
          </TouchableOpacity>
        </View>

        {error && (
          <View style={[styles.errorBox, Shadows.elevation2]}>
            <Ionicons name="alert-circle" size={24} color={Colors.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Request Details */}
        {request && (
          <View style={[styles.detailsCard, Shadows.elevation4]}>
            {/* Status Banner */}
            <View style={[styles.statusBanner, { backgroundColor: StatusColors[request.status] }]}>
              <Ionicons name={getStatusIcon(request.status) as any} size={24} color={Colors.white} />
              <View style={styles.statusTextContainer}>
                <Text style={styles.statusTitle}>{request.status}</Text>
                <Text style={styles.statusDescription}>{getStatusDescription(request.status)}</Text>
              </View>
            </View>

            {/* Request Info */}
            <View style={styles.infoSection}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Request ID</Text>
                <Text style={styles.infoValue}>{request.id.slice(0, 8)}...</Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Waste Type</Text>
                <View style={styles.wasteTypeBadge}>
                  <Ionicons
                    name={
                      request.waste_type === 'Organic' ? 'leaf' :
                      request.waste_type === 'Plastic' ? 'water' :
                      request.waste_type === 'Metal' ? 'construct' :
                      request.waste_type === 'E-Waste' ? 'phone-portrait' : 'layers'
                    }
                    size={16}
                    color={Colors.primary}
                  />
                  <Text style={styles.wasteTypeText}>{request.waste_type}</Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Quantity</Text>
                <Text style={styles.infoValue}>{request.quantity}</Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Distance</Text>
                <Text style={styles.infoValue}>{request.distance_km} km</Text>
              </View>

              <View style={styles.costRow}>
                <View>
                  <Text style={styles.costLabel}>Estimated Cost</Text>
                  <Text style={styles.costValue}>₹{request.estimated_cost}</Text>
                </View>
                {request.actual_cost && (
                  <View>
                    <Text style={styles.costLabel}>Final Cost</Text>
                    <Text style={[styles.costValue, { color: Colors.primary }]}>
                      ₹{request.actual_cost}
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.addressSection}>
                <Text style={styles.infoLabel}>Pickup Address</Text>
                <Text style={styles.addressText}>{request.location.address || 'Address not specified'}</Text>
                <Text style={styles.coordsText}>
                  ({request.location.latitude.toFixed(4)}, {request.location.longitude.toFixed(4)})
                </Text>
              </View>

              {request.waste_image && (
                <View style={styles.imageSection}>
                  <Text style={styles.infoLabel}>Waste Photo</Text>
                  <Image source={{ uri: request.waste_image }} style={styles.wasteImage} />
                </View>
              )}

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Created</Text>
                <Text style={styles.infoValue}>
                  {format(new Date(request.created_at), 'MMM d, yyyy h:mm a')}
                </Text>
              </View>
            </View>

            {/* Driver Info */}
            {driver && (
              <View style={styles.driverSection}>
                <Text style={styles.sectionTitle}>Assigned Driver</Text>
                <View style={styles.driverCard}>
                  <View style={styles.driverAvatar}>
                    <Ionicons name="person" size={24} color={Colors.white} />
                  </View>
                  <View style={styles.driverInfo}>
                    <Text style={styles.driverName}>{driver.name}</Text>
                    <Text style={styles.driverVehicle}>
                      {driver.vehicle_type} • {driver.vehicle_number}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.callButton}
                    onPress={() => callDriver(driver.phone)}
                  >
                    <Ionicons name="call" size={20} color={Colors.white} />
                    <Text style={styles.callButtonText}>Call</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        )}

        {/* Recent Requests List */}
        {!request && recentRequests.length > 0 && (
          <View style={styles.recentSection}>
            <Text style={styles.sectionTitle}>Your Recent Requests</Text>
            {recentRequests.map((req) => (
              <TouchableOpacity
                key={req.id}
                style={[styles.recentCard, Shadows.elevation2]}
                onPress={() => {
                  setSearchId(req.id);
                  fetchRequest(req.id);
                }}
              >
                <View style={[styles.statusDot, { backgroundColor: StatusColors[req.status] }]} />
                <View style={styles.recentInfo}>
                  <Text style={styles.recentType}>{req.waste_type} - {req.quantity}</Text>
                  <Text style={styles.recentDate}>
                    {format(new Date(req.created_at), 'MMM d, h:mm a')}
                  </Text>
                </View>
                <View>
                  <Text style={styles.recentStatus}>{req.status}</Text>
                  <Text style={styles.recentCost}>₹{req.actual_cost || req.estimated_cost}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={Colors.textGray} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={{ height: Spacing.xxl }} />
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    gap: Spacing.xs,
  },
  headerTitle: {
    fontSize: Typography.xl,
    fontWeight: '700',
    color: Colors.textDark,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: Spacing.sm,
  },
  searchBox: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    overflow: 'hidden',
    marginBottom: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    padding: Spacing.sm,
    fontSize: Typography.md,
    color: Colors.textDark,
  },
  searchButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
    gap: Spacing.xs,
    borderLeftWidth: 4,
    borderLeftColor: Colors.error,
  },
  errorText: {
    flex: 1,
    color: Colors.error,
    fontSize: Typography.sm,
  },
  detailsCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    marginBottom: Spacing.sm,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    gap: Spacing.xs,
  },
  statusTextContainer: {
    flex: 1,
  },
  statusTitle: {
    fontSize: Typography.lg,
    fontWeight: '700',
    color: Colors.white,
  },
  statusDescription: {
    fontSize: Typography.sm,
    color: Colors.white + 'DD',
  },
  infoSection: {
    padding: Spacing.sm,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  infoLabel: {
    fontSize: Typography.sm,
    color: Colors.textGray,
  },
  infoValue: {
    fontSize: Typography.md,
    color: Colors.textDark,
    fontWeight: '500',
  },
  wasteTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary + '15',
    paddingHorizontal: Spacing.xs,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    gap: 4,
  },
  wasteTypeText: {
    fontSize: Typography.sm,
    color: Colors.primary,
    fontWeight: '600',
  },
  costRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  costLabel: {
    fontSize: Typography.xs,
    color: Colors.textGray,
  },
  costValue: {
    fontSize: Typography.xl,
    fontWeight: '700',
    color: Colors.textDark,
  },
  addressSection: {
    paddingVertical: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  addressText: {
    fontSize: Typography.md,
    color: Colors.textDark,
    marginTop: 4,
  },
  coordsText: {
    fontSize: Typography.sm,
    color: Colors.textGray,
    marginTop: 2,
  },
  imageSection: {
    paddingVertical: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  wasteImage: {
    width: '100%',
    height: 150,
    borderRadius: Radius.sm,
    marginTop: Spacing.xs,
    backgroundColor: Colors.backgroundEnd,
  },
  driverSection: {
    padding: Spacing.sm,
    backgroundColor: Colors.backgroundEnd,
  },
  sectionTitle: {
    fontSize: Typography.md,
    fontWeight: '600',
    color: Colors.textDark,
    marginBottom: Spacing.xs,
  },
  driverCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    padding: Spacing.sm,
  },
  driverAvatar: {
    width: 48,
    height: 48,
    borderRadius: Radius.round,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  driverInfo: {
    flex: 1,
    marginLeft: Spacing.xs,
  },
  driverName: {
    fontSize: Typography.md,
    fontWeight: '600',
    color: Colors.textDark,
  },
  driverVehicle: {
    fontSize: Typography.sm,
    color: Colors.textGray,
  },
  callButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.round,
    gap: 4,
  },
  callButtonText: {
    color: Colors.white,
    fontWeight: '600',
    fontSize: Typography.sm,
  },
  recentSection: {
    marginTop: Spacing.xs,
  },
  recentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    marginBottom: Spacing.xs,
    gap: Spacing.xs,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: Radius.round,
  },
  recentInfo: {
    flex: 1,
  },
  recentType: {
    fontSize: Typography.md,
    fontWeight: '600',
    color: Colors.textDark,
  },
  recentDate: {
    fontSize: Typography.xs,
    color: Colors.textGray,
  },
  recentStatus: {
    fontSize: Typography.xs,
    color: Colors.textGray,
    textAlign: 'right',
  },
  recentCost: {
    fontSize: Typography.md,
    fontWeight: '700',
    color: Colors.primary,
    textAlign: 'right',
  },
});
