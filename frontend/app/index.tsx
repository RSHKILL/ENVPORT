import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { Colors, Spacing, Typography, Radius, Shadows, StatusColors } from '../constants/theme';
import { useStore } from '../store/useStore';
import { pickupApi, PickupRequest } from '../services/api';
import { format } from 'date-fns';

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { setCurrentLocation, setPickupLocation, recentRequests, setRecentRequests } = useStore();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [locationStatus, setLocationStatus] = useState<'loading' | 'success' | 'error'>('loading');

  useEffect(() => {
    getLocation();
    fetchRecentRequests();
  }, []);

  const getLocation = async () => {
    try {
      setLocationStatus('loading');
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationStatus('error');
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

      const locationData = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        address,
      };

      setCurrentLocation(locationData);
      setPickupLocation(locationData);
      setLocationStatus('success');
    } catch (error) {
      console.error('Location error:', error);
      setLocationStatus('error');
    }
  };

  const fetchRecentRequests = async () => {
    try {
      const requests = await pickupApi.getAll(undefined, 5, 0);
      setRecentRequests(requests);
    } catch (error) {
      console.error('Error fetching requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([getLocation(), fetchRecentRequests()]);
    setRefreshing(false);
  };

  const getStatusColor = (status: string) => StatusColors[status] || Colors.textGray;

  return (
    <LinearGradient
      colors={[Colors.backgroundStart, Colors.backgroundEnd]}
      style={[styles.container, { paddingTop: insets.top }]}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <View style={styles.logoCircle}>
              <Ionicons name="leaf" size={32} color={Colors.white} />
            </View>
            <View>
              <Text style={styles.title}>EcoPort</Text>
              <Text style={styles.subtitle}>by Environ Solutions</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.notificationButton}>
            <Ionicons name="notifications-outline" size={24} color={Colors.textDark} />
          </TouchableOpacity>
        </View>

        {/* Search Card - Uber Style */}
        <TouchableOpacity
          style={[styles.searchCard, Shadows.elevation4]}
          onPress={() => router.push('/request')}
          activeOpacity={0.9}
        >
          <View style={styles.searchIconContainer}>
            <Ionicons name="location" size={24} color={Colors.primary} />
          </View>
          <View style={styles.searchTextContainer}>
            <Text style={styles.searchPlaceholder}>Where to pick up?</Text>
            <Text style={styles.searchSubtext}>
              {locationStatus === 'loading'
                ? 'Detecting location...'
                : locationStatus === 'success'
                ? 'Tap to schedule pickup'
                : 'Set pickup location'}
            </Text>
          </View>
          <View style={styles.laterPill}>
            <Ionicons name="time-outline" size={16} color={Colors.textDark} />
            <Text style={styles.laterText}>Later</Text>
          </View>
        </TouchableOpacity>

        {/* Info Banner */}
        <View style={[styles.infoBanner, Shadows.elevation2]}>
          <View style={styles.infoIconContainer}>
            <Ionicons name="leaf" size={24} color={Colors.primary} />
          </View>
          <View style={styles.infoTextContainer}>
            <Text style={styles.infoTitle}>Eco-Friendly Pickup</Text>
            <Text style={styles.infoDescription}>
              We responsibly dispose of waste, ensuring maximum recycling and minimal environmental impact.
            </Text>
          </View>
        </View>

        {/* Recent Requests */}
        <View style={styles.recentSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Requests</Text>
            {recentRequests.length > 0 && (
              <TouchableOpacity onPress={() => router.push('/track')}>
                <Text style={styles.seeAllText}>See All</Text>
              </TouchableOpacity>
            )}
          </View>

          {loading ? (
            <ActivityIndicator size="large" color={Colors.primary} style={styles.loader} />
          ) : recentRequests.length === 0 ? (
            <View style={[styles.emptyState, Shadows.elevation2]}>
              <Ionicons name="document-text-outline" size={48} color={Colors.textGray} />
              <Text style={styles.emptyTitle}>No requests yet</Text>
              <Text style={styles.emptyDescription}>
                Schedule your first waste pickup and contribute to a cleaner environment.
              </Text>
              <TouchableOpacity
                style={styles.emptyButton}
                onPress={() => router.push('/request')}
              >
                <Text style={styles.emptyButtonText}>Schedule Pickup</Text>
              </TouchableOpacity>
            </View>
          ) : (
            recentRequests.map((request) => (
              <TouchableOpacity
                key={request.id}
                style={[styles.requestCard, Shadows.elevation2]}
                onPress={() => {
                  useStore.getState().setTrackingRequestId(request.id);
                  router.push('/track');
                }}
              >
                <View style={styles.requestHeader}>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(request.status) }]}>
                    <Text style={styles.statusText}>{request.status}</Text>
                  </View>
                  <Text style={styles.requestDate}>
                    {format(new Date(request.created_at), 'MMM d, h:mm a')}
                  </Text>
                </View>
                <View style={styles.requestContent}>
                  <View style={styles.wasteTypeIcon}>
                    <Ionicons
                      name={
                        request.waste_type === 'Organic' ? 'leaf' :
                        request.waste_type === 'Plastic' ? 'water' :
                        request.waste_type === 'Metal' ? 'construct' :
                        request.waste_type === 'E-Waste' ? 'phone-portrait' : 'layers'
                      }
                      size={20}
                      color={Colors.primary}
                    />
                  </View>
                  <View style={styles.requestDetails}>
                    <Text style={styles.wasteType}>{request.waste_type} - {request.quantity}</Text>
                    <Text style={styles.requestAddress} numberOfLines={1}>
                      {request.location.address || 'Location set'}
                    </Text>
                  </View>
                  <Text style={styles.requestCost}>₹{request.actual_cost || request.estimated_cost}</Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionGrid}>
            <TouchableOpacity
              style={[styles.actionCard, Shadows.elevation2]}
              onPress={() => router.push('/request')}
            >
              <View style={[styles.actionIcon, { backgroundColor: Colors.primary + '20' }]}>
                <Ionicons name="add-circle" size={28} color={Colors.primary} />
              </View>
              <Text style={styles.actionText}>New Pickup</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionCard, Shadows.elevation2]}
              onPress={() => router.push('/track')}
            >
              <View style={[styles.actionIcon, { backgroundColor: Colors.secondary + '20' }]}>
                <Ionicons name="location" size={28} color={Colors.secondary} />
              </View>
              <Text style={styles.actionText}>Track</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionCard, Shadows.elevation2]}
              onPress={() => router.push('/admin')}
            >
              <View style={[styles.actionIcon, { backgroundColor: Colors.ctaGold + '20' }]}>
                <Ionicons name="settings" size={28} color={Colors.ctaGold} />
              </View>
              <Text style={styles.actionText}>Admin</Text>
            </TouchableOpacity>
          </View>
        </View>

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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  logoCircle: {
    width: 48,
    height: 48,
    borderRadius: Radius.round,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: Typography.xl,
    fontWeight: '700',
    color: Colors.textDark,
  },
  subtitle: {
    fontSize: Typography.xs,
    color: Colors.textGray,
  },
  notificationButton: {
    width: 44,
    height: 44,
    borderRadius: Radius.round,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    marginHorizontal: Spacing.sm,
    marginVertical: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: Radius.lg,
  },
  searchIconContainer: {
    width: 44,
    height: 44,
    borderRadius: Radius.round,
    backgroundColor: Colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchTextContainer: {
    flex: 1,
    marginLeft: Spacing.xs,
  },
  searchPlaceholder: {
    fontSize: Typography.md,
    fontWeight: '600',
    color: Colors.textDark,
  },
  searchSubtext: {
    fontSize: Typography.sm,
    color: Colors.textGray,
  },
  laterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundEnd,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 6,
    borderRadius: Radius.round,
    gap: 4,
  },
  laterText: {
    fontSize: Typography.sm,
    color: Colors.textDark,
    fontWeight: '500',
  },
  infoBanner: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    marginHorizontal: Spacing.sm,
    marginBottom: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: Radius.md,
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
  },
  infoIconContainer: {
    width: 40,
    height: 40,
    borderRadius: Radius.round,
    backgroundColor: Colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoTextContainer: {
    flex: 1,
    marginLeft: Spacing.xs,
  },
  infoTitle: {
    fontSize: Typography.md,
    fontWeight: '600',
    color: Colors.textDark,
  },
  infoDescription: {
    fontSize: Typography.sm,
    color: Colors.textGray,
    marginTop: 2,
  },
  recentSection: {
    paddingHorizontal: Spacing.sm,
    marginTop: Spacing.xs,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  sectionTitle: {
    fontSize: Typography.lg,
    fontWeight: '700',
    color: Colors.textDark,
  },
  seeAllText: {
    fontSize: Typography.sm,
    color: Colors.primary,
    fontWeight: '600',
  },
  loader: {
    marginVertical: Spacing.lg,
  },
  emptyState: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: Typography.lg,
    fontWeight: '600',
    color: Colors.textDark,
    marginTop: Spacing.sm,
  },
  emptyDescription: {
    fontSize: Typography.sm,
    color: Colors.textGray,
    textAlign: 'center',
    marginTop: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  emptyButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.round,
  },
  emptyButtonText: {
    color: Colors.white,
    fontWeight: '600',
    fontSize: Typography.md,
  },
  requestCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  statusBadge: {
    paddingHorizontal: Spacing.xs,
    paddingVertical: 4,
    borderRadius: Radius.sm,
  },
  statusText: {
    color: Colors.white,
    fontSize: Typography.xs,
    fontWeight: '600',
  },
  requestDate: {
    fontSize: Typography.xs,
    color: Colors.textGray,
  },
  requestContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  wasteTypeIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.sm,
    backgroundColor: Colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  requestDetails: {
    flex: 1,
    marginLeft: Spacing.xs,
  },
  wasteType: {
    fontSize: Typography.md,
    fontWeight: '600',
    color: Colors.textDark,
  },
  requestAddress: {
    fontSize: Typography.sm,
    color: Colors.textGray,
  },
  requestCost: {
    fontSize: Typography.lg,
    fontWeight: '700',
    color: Colors.primary,
  },
  quickActions: {
    paddingHorizontal: Spacing.sm,
    marginTop: Spacing.md,
  },
  actionGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.xs,
  },
  actionCard: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  actionIcon: {
    width: 56,
    height: 56,
    borderRadius: Radius.round,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  actionText: {
    fontSize: Typography.sm,
    fontWeight: '600',
    color: Colors.textDark,
  },
});
