import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, Typography, Radius, Shadows, StatusColors } from '../constants/theme';
import { useStore } from '../store/useStore';
import {
  authApi,
  pickupApi,
  driversApi,
  statsApi,
  PickupRequest,
  Driver,
  Stats,
} from '../services/api';
import { format } from 'date-fns';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function AdminScreen() {
  const insets = useSafeAreaInsets();
  const { isAdminLoggedIn, setAdminLoggedIn, logout, drivers, setDrivers, allRequests, setAllRequests } = useStore();

  // Auth state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Dashboard state
  const [stats, setStats] = useState<Stats | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'requests' | 'drivers'>('requests');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  // Driver form
  const [showDriverForm, setShowDriverForm] = useState(false);
  const [driverForm, setDriverForm] = useState({
    name: '',
    phone: '',
    vehicle_type: '',
    vehicle_number: '',
  });
  const [addingDriver, setAddingDriver] = useState(false);

  // Request detail modal
  const [selectedRequest, setSelectedRequest] = useState<PickupRequest | null>(null);
  const [adjustedCost, setAdjustedCost] = useState('');
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (isAdminLoggedIn) {
      fetchDashboardData();
    }
  }, [isAdminLoggedIn, statusFilter]);

  const checkAuth = async () => {
    try {
      const token = await AsyncStorage.getItem('admin_token');
      if (token) {
        await authApi.getMe();
        setAdminLoggedIn(true, token);
      }
    } catch (error) {
      await AsyncStorage.removeItem('admin_token');
    } finally {
      setCheckingAuth(false);
    }
  };

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert('Error', 'Please enter username and password.');
      return;
    }

    try {
      setLoginLoading(true);
      const response = await authApi.login(username, password);
      await AsyncStorage.setItem('admin_token', response.access_token);
      setAdminLoggedIn(true, response.access_token);
      setUsername('');
      setPassword('');
    } catch (error: any) {
      const message = error.response?.data?.detail || 'Login failed. Please check your credentials.';
      Alert.alert('Login Failed', message);
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: logout,
      },
    ]);
  };

  const fetchDashboardData = async () => {
    try {
      const [statsData, requestsData, driversData] = await Promise.all([
        statsApi.get(),
        pickupApi.getAll(statusFilter || undefined, 100, 0),
        driversApi.getAll(),
      ]);
      setStats(statsData);
      setAllRequests(requestsData);
      setDrivers(driversData);
    } catch (error) {
      console.error('Dashboard fetch error:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchDashboardData();
    setRefreshing(false);
  };

  const handleAddDriver = async () => {
    if (!driverForm.name || !driverForm.phone || !driverForm.vehicle_type || !driverForm.vehicle_number) {
      Alert.alert('Error', 'Please fill all driver fields.');
      return;
    }

    try {
      setAddingDriver(true);
      await driversApi.create(driverForm);
      setDriverForm({ name: '', phone: '', vehicle_type: '', vehicle_number: '' });
      setShowDriverForm(false);
      Alert.alert('Success', 'Driver added successfully!');
      fetchDashboardData();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to add driver.');
    } finally {
      setAddingDriver(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedRequest) return;

    try {
      setUpdating(true);
      await pickupApi.update(selectedRequest.id, { status: 'Approved' });
      Alert.alert('Success', 'Request approved!');
      setSelectedRequest(null);
      fetchDashboardData();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to approve.');
    } finally {
      setUpdating(false);
    }
  };

  const handleAssignDriver = async () => {
    if (!selectedRequest || !selectedDriverId) {
      Alert.alert('Error', 'Please select a driver.');
      return;
    }

    try {
      setUpdating(true);
      await pickupApi.assignDriver(selectedRequest.id, selectedDriverId);
      Alert.alert('Success', 'Driver assigned!');
      setSelectedRequest(null);
      setSelectedDriverId(null);
      fetchDashboardData();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to assign driver.');
    } finally {
      setUpdating(false);
    }
  };

  const handleComplete = async () => {
    if (!selectedRequest) return;

    try {
      setUpdating(true);
      
      // Update cost if adjusted
      if (adjustedCost && parseFloat(adjustedCost) > 0) {
        await pickupApi.update(selectedRequest.id, { actual_cost: parseFloat(adjustedCost) });
      }
      
      await pickupApi.update(selectedRequest.id, { status: 'Completed' });
      
      // Set driver back to available
      if (selectedRequest.driver_id) {
        await driversApi.updateStatus(selectedRequest.driver_id, 'Available');
      }
      
      Alert.alert('Success', 'Pickup completed!');
      setSelectedRequest(null);
      setAdjustedCost('');
      fetchDashboardData();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to complete.');
    } finally {
      setUpdating(false);
    }
  };

  const handleUpdateCost = async () => {
    if (!selectedRequest || !adjustedCost) return;

    try {
      setUpdating(true);
      await pickupApi.update(selectedRequest.id, { actual_cost: parseFloat(adjustedCost) });
      Alert.alert('Success', 'Cost updated!');
      fetchDashboardData();
      // Update local state
      setSelectedRequest({ ...selectedRequest, actual_cost: parseFloat(adjustedCost) });
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to update cost.');
    } finally {
      setUpdating(false);
    }
  };

  const getDriverStatusColor = (status: string) => {
    switch (status) {
      case 'Available':
        return Colors.success;
      case 'Busy':
        return Colors.warning;
      case 'Offline':
        return Colors.textGray;
      default:
        return Colors.textGray;
    }
  };

  const availableDrivers = drivers.filter((d) => d.status === 'Available');

  if (checkingAuth) {
    return (
      <View style={[styles.centerContainer, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  // Login Screen
  if (!isAdminLoggedIn) {
    return (
      <LinearGradient
        colors={[Colors.backgroundStart, Colors.backgroundEnd]}
        style={[styles.container, { paddingTop: insets.top }]}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.centerContainer}
        >
          <View style={[styles.loginCard, Shadows.elevation4]}>
            <View style={styles.loginHeader}>
              <View style={styles.adminIcon}>
                <Ionicons name="shield-checkmark" size={40} color={Colors.primary} />
              </View>
              <Text style={styles.loginTitle}>Admin Login</Text>
              <Text style={styles.loginSubtitle}>EcoPort Dashboard</Text>
            </View>

            <TextInput
              style={styles.loginInput}
              placeholder="Username"
              placeholderTextColor={Colors.textGray}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
            />

            <TextInput
              style={styles.loginInput}
              placeholder="Password"
              placeholderTextColor={Colors.textGray}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />

            <TouchableOpacity
              style={[styles.loginButton, loginLoading && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={loginLoading}
            >
              {loginLoading ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <Text style={styles.loginButtonText}>Login</Text>
              )}
            </TouchableOpacity>

            <Text style={styles.hint}>Demo: admin / admin123</Text>
          </View>
        </KeyboardAvoidingView>
      </LinearGradient>
    );
  }

  // Admin Dashboard
  return (
    <LinearGradient
      colors={[Colors.backgroundStart, Colors.backgroundEnd]}
      style={[styles.container, { paddingTop: insets.top }]}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Admin Dashboard</Text>
          <Text style={styles.headerSubtitle}>EcoPort Management</Text>
        </View>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={24} color={Colors.error} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />
        }
        style={styles.scrollView}
      >
        {/* Stats Cards */}
        {stats && (
          <View style={styles.statsGrid}>
            <TouchableOpacity
              style={[styles.statCard, Shadows.elevation2, statusFilter === 'Pending' && styles.statCardActive]}
              onPress={() => setStatusFilter(statusFilter === 'Pending' ? null : 'Pending')}
            >
              <Text style={[styles.statValue, { color: Colors.warning }]}>{stats.pending}</Text>
              <Text style={styles.statLabel}>Pending</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.statCard, Shadows.elevation2, statusFilter === 'Approved' && styles.statCardActive]}
              onPress={() => setStatusFilter(statusFilter === 'Approved' ? null : 'Approved')}
            >
              <Text style={[styles.statValue, { color: Colors.secondary }]}>{stats.approved}</Text>
              <Text style={styles.statLabel}>Approved</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.statCard, Shadows.elevation2, statusFilter === 'Assigned' && styles.statCardActive]}
              onPress={() => setStatusFilter(statusFilter === 'Assigned' ? null : 'Assigned')}
            >
              <Text style={[styles.statValue, { color: '#7B1FA2' }]}>{stats.assigned}</Text>
              <Text style={styles.statLabel}>Assigned</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.statCard, Shadows.elevation2, statusFilter === 'Completed' && styles.statCardActive]}
              onPress={() => setStatusFilter(statusFilter === 'Completed' ? null : 'Completed')}
            >
              <Text style={[styles.statValue, { color: Colors.success }]}>{stats.completed}</Text>
              <Text style={styles.statLabel}>Completed</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Tab Switcher */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'requests' && styles.tabActive]}
            onPress={() => setActiveTab('requests')}
          >
            <Ionicons
              name="document-text"
              size={20}
              color={activeTab === 'requests' ? Colors.primary : Colors.textGray}
            />
            <Text style={[styles.tabText, activeTab === 'requests' && styles.tabTextActive]}>
              Requests ({allRequests.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === 'drivers' && styles.tabActive]}
            onPress={() => setActiveTab('drivers')}
          >
            <Ionicons
              name="car"
              size={20}
              color={activeTab === 'drivers' ? Colors.primary : Colors.textGray}
            />
            <Text style={[styles.tabText, activeTab === 'drivers' && styles.tabTextActive]}>
              Drivers ({drivers.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Requests Tab */}
        {activeTab === 'requests' && (
          <View style={styles.listContainer}>
            {allRequests.length === 0 ? (
              <View style={[styles.emptyState, Shadows.elevation2]}>
                <Ionicons name="document-text-outline" size={48} color={Colors.textGray} />
                <Text style={styles.emptyText}>No requests found</Text>
              </View>
            ) : (
              allRequests.map((req) => (
                <TouchableOpacity
                  key={req.id}
                  style={[styles.requestCard, Shadows.elevation2]}
                  onPress={() => {
                    setSelectedRequest(req);
                    setAdjustedCost(req.actual_cost?.toString() || '');
                  }}
                >
                  <View style={styles.requestHeader}>
                    <View style={[styles.statusBadge, { backgroundColor: StatusColors[req.status] }]}>
                      <Text style={styles.statusText}>{req.status}</Text>
                    </View>
                    <Text style={styles.requestDate}>
                      {format(new Date(req.created_at), 'MMM d, h:mm a')}
                    </Text>
                  </View>
                  <View style={styles.requestBody}>
                    <View style={styles.requestInfo}>
                      <Text style={styles.wasteTypeText}>
                        {req.waste_type} • {req.quantity}
                      </Text>
                      <Text style={styles.addressSnippet} numberOfLines={1}>
                        {req.location.address || 'No address'}
                      </Text>
                      <Text style={styles.distanceText}>{req.distance_km} km away</Text>
                    </View>
                    <View style={styles.requestCost}>
                      <Text style={styles.costAmount}>
                        ₹{req.actual_cost || req.estimated_cost}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        {/* Drivers Tab */}
        {activeTab === 'drivers' && (
          <View style={styles.listContainer}>
            <TouchableOpacity
              style={[styles.addDriverButton, Shadows.elevation2]}
              onPress={() => setShowDriverForm(true)}
            >
              <Ionicons name="add-circle" size={24} color={Colors.primary} />
              <Text style={styles.addDriverText}>Add New Driver</Text>
            </TouchableOpacity>

            {drivers.length === 0 ? (
              <View style={[styles.emptyState, Shadows.elevation2]}>
                <Ionicons name="car-outline" size={48} color={Colors.textGray} />
                <Text style={styles.emptyText}>No drivers added yet</Text>
              </View>
            ) : (
              drivers.map((driver) => (
                <View key={driver.id} style={[styles.driverCard, Shadows.elevation2]}>
                  <View style={styles.driverAvatar}>
                    <Ionicons name="person" size={24} color={Colors.white} />
                  </View>
                  <View style={styles.driverInfo}>
                    <Text style={styles.driverName}>{driver.name}</Text>
                    <Text style={styles.driverVehicle}>
                      {driver.vehicle_type} • {driver.vehicle_number}
                    </Text>
                    <Text style={styles.driverPhone}>{driver.phone}</Text>
                  </View>
                  <View
                    style={[styles.driverStatusBadge, { backgroundColor: getDriverStatusColor(driver.status) }]}
                  >
                    <Text style={styles.driverStatusText}>{driver.status}</Text>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        <View style={{ height: Spacing.xxl }} />
      </ScrollView>

      {/* Add Driver Modal */}
      <Modal visible={showDriverForm} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, Shadows.elevation6]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add New Driver</Text>
              <TouchableOpacity onPress={() => setShowDriverForm(false)}>
                <Ionicons name="close" size={24} color={Colors.textDark} />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.modalInput}
              placeholder="Driver Name"
              placeholderTextColor={Colors.textGray}
              value={driverForm.name}
              onChangeText={(text) => setDriverForm({ ...driverForm, name: text })}
            />

            <TextInput
              style={styles.modalInput}
              placeholder="Phone Number"
              placeholderTextColor={Colors.textGray}
              value={driverForm.phone}
              onChangeText={(text) => setDriverForm({ ...driverForm, phone: text })}
              keyboardType="phone-pad"
            />

            <TextInput
              style={styles.modalInput}
              placeholder="Vehicle Type (e.g., Pickup Truck)"
              placeholderTextColor={Colors.textGray}
              value={driverForm.vehicle_type}
              onChangeText={(text) => setDriverForm({ ...driverForm, vehicle_type: text })}
            />

            <TextInput
              style={styles.modalInput}
              placeholder="Vehicle Number"
              placeholderTextColor={Colors.textGray}
              value={driverForm.vehicle_number}
              onChangeText={(text) => setDriverForm({ ...driverForm, vehicle_number: text })}
              autoCapitalize="characters"
            />

            <TouchableOpacity
              style={[styles.modalButton, addingDriver && styles.buttonDisabled]}
              onPress={handleAddDriver}
              disabled={addingDriver}
            >
              {addingDriver ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <Text style={styles.modalButtonText}>Add Driver</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Request Detail Modal */}
      <Modal visible={!!selectedRequest} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.detailModalContent, Shadows.elevation6, { paddingBottom: insets.bottom + Spacing.sm }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Request Details</Text>
              <TouchableOpacity onPress={() => setSelectedRequest(null)}>
                <Ionicons name="close" size={24} color={Colors.textDark} />
              </TouchableOpacity>
            </View>

            {selectedRequest && (
              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Status */}
                <View
                  style={[
                    styles.detailStatusBanner,
                    { backgroundColor: StatusColors[selectedRequest.status] },
                  ]}
                >
                  <Text style={styles.detailStatusText}>{selectedRequest.status}</Text>
                </View>

                {/* Waste Image */}
                {selectedRequest.waste_image && (
                  <Image source={{ uri: selectedRequest.waste_image }} style={styles.detailImage} />
                )}

                {/* Info */}
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Waste Type</Text>
                  <Text style={styles.detailValue}>{selectedRequest.waste_type}</Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Quantity</Text>
                  <Text style={styles.detailValue}>{selectedRequest.quantity}</Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Distance</Text>
                  <Text style={styles.detailValue}>{selectedRequest.distance_km} km</Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Address</Text>
                  <Text style={styles.detailValue}>{selectedRequest.location.address || 'N/A'}</Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Coordinates</Text>
                  <Text style={styles.detailValue}>
                    {selectedRequest.location.latitude.toFixed(4)}, {selectedRequest.location.longitude.toFixed(4)}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Estimated Cost</Text>
                  <Text style={styles.detailValue}>₹{selectedRequest.estimated_cost}</Text>
                </View>

                {/* Price Adjustment */}
                <View style={styles.priceAdjustSection}>
                  <Text style={styles.detailLabel}>Adjust Final Cost</Text>
                  <View style={styles.priceInputRow}>
                    <TextInput
                      style={styles.priceInput}
                      placeholder="Enter amount"
                      placeholderTextColor={Colors.textGray}
                      value={adjustedCost}
                      onChangeText={setAdjustedCost}
                      keyboardType="numeric"
                    />
                    <TouchableOpacity
                      style={styles.updateCostButton}
                      onPress={handleUpdateCost}
                      disabled={updating}
                    >
                      <Text style={styles.updateCostText}>Update</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Action Buttons */}
                <View style={styles.actionButtons}>
                  {selectedRequest.status === 'Pending' && (
                    <TouchableOpacity
                      style={[styles.actionButton, { backgroundColor: Colors.secondary }]}
                      onPress={handleApprove}
                      disabled={updating}
                    >
                      {updating ? (
                        <ActivityIndicator color={Colors.white} />
                      ) : (
                        <>
                          <Ionicons name="checkmark-circle" size={20} color={Colors.white} />
                          <Text style={styles.actionButtonText}>Approve</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}

                  {selectedRequest.status === 'Approved' && (
                    <View style={styles.assignSection}>
                      <Text style={styles.detailLabel}>Assign Driver</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        {availableDrivers.length === 0 ? (
                          <Text style={styles.noDriversText}>No available drivers</Text>
                        ) : (
                          availableDrivers.map((driver) => (
                            <TouchableOpacity
                              key={driver.id}
                              style={[
                                styles.driverOption,
                                selectedDriverId === driver.id && styles.driverOptionSelected,
                              ]}
                              onPress={() => setSelectedDriverId(driver.id)}
                            >
                              <Text
                                style={[
                                  styles.driverOptionText,
                                  selectedDriverId === driver.id && styles.driverOptionTextSelected,
                                ]}
                              >
                                {driver.name}
                              </Text>
                              <Text style={styles.driverOptionVehicle}>{driver.vehicle_number}</Text>
                            </TouchableOpacity>
                          ))
                        )}
                      </ScrollView>
                      {availableDrivers.length > 0 && (
                        <TouchableOpacity
                          style={[styles.actionButton, { backgroundColor: '#7B1FA2', marginTop: Spacing.xs }]}
                          onPress={handleAssignDriver}
                          disabled={updating || !selectedDriverId}
                        >
                          {updating ? (
                            <ActivityIndicator color={Colors.white} />
                          ) : (
                            <>
                              <Ionicons name="person-add" size={20} color={Colors.white} />
                              <Text style={styles.actionButtonText}>Assign Driver</Text>
                            </>
                          )}
                        </TouchableOpacity>
                      )}
                    </View>
                  )}

                  {selectedRequest.status === 'Assigned' && (
                    <TouchableOpacity
                      style={[styles.actionButton, { backgroundColor: Colors.success }]}
                      onPress={handleComplete}
                      disabled={updating}
                    >
                      {updating ? (
                        <ActivityIndicator color={Colors.white} />
                      ) : (
                        <>
                          <Ionicons name="checkmark-done-circle" size={20} color={Colors.white} />
                          <Text style={styles.actionButtonText}>Mark Complete</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  headerTitle: {
    fontSize: Typography.xl,
    fontWeight: '700',
    color: Colors.textDark,
  },
  headerSubtitle: {
    fontSize: Typography.sm,
    color: Colors.textGray,
  },
  logoutButton: {
    padding: Spacing.xs,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: Spacing.sm,
  },
  loginCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    width: '100%',
    maxWidth: 400,
  },
  loginHeader: {
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  adminIcon: {
    width: 80,
    height: 80,
    borderRadius: Radius.round,
    backgroundColor: Colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  loginTitle: {
    fontSize: Typography.xl,
    fontWeight: '700',
    color: Colors.textDark,
  },
  loginSubtitle: {
    fontSize: Typography.sm,
    color: Colors.textGray,
  },
  loginInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    padding: Spacing.sm,
    fontSize: Typography.md,
    color: Colors.textDark,
    marginBottom: Spacing.sm,
  },
  loginButton: {
    backgroundColor: Colors.primary,
    padding: Spacing.sm,
    borderRadius: Radius.md,
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  loginButtonText: {
    color: Colors.white,
    fontSize: Typography.md,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  hint: {
    textAlign: 'center',
    color: Colors.textGray,
    fontSize: Typography.sm,
    marginTop: Spacing.sm,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    alignItems: 'center',
  },
  statCardActive: {
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  statValue: {
    fontSize: Typography.xxl,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: Typography.sm,
    color: Colors.textGray,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    padding: 4,
    marginBottom: Spacing.sm,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xs,
    borderRadius: Radius.sm,
    gap: 6,
  },
  tabActive: {
    backgroundColor: Colors.primary + '15',
  },
  tabText: {
    fontSize: Typography.sm,
    color: Colors.textGray,
    fontWeight: '500',
  },
  tabTextActive: {
    color: Colors.primary,
  },
  listContainer: {
    gap: Spacing.xs,
  },
  emptyState: {
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    alignItems: 'center',
  },
  emptyText: {
    color: Colors.textGray,
    fontSize: Typography.md,
    marginTop: Spacing.xs,
  },
  requestCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    padding: Spacing.sm,
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
  requestBody: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  requestInfo: {
    flex: 1,
  },
  wasteTypeText: {
    fontSize: Typography.md,
    fontWeight: '600',
    color: Colors.textDark,
  },
  addressSnippet: {
    fontSize: Typography.sm,
    color: Colors.textGray,
  },
  distanceText: {
    fontSize: Typography.xs,
    color: Colors.textGray,
  },
  requestCost: {
    alignItems: 'flex-end',
  },
  costAmount: {
    fontSize: Typography.lg,
    fontWeight: '700',
    color: Colors.primary,
  },
  addDriverButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    gap: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderStyle: 'dashed',
  },
  addDriverText: {
    color: Colors.primary,
    fontSize: Typography.md,
    fontWeight: '600',
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
  driverPhone: {
    fontSize: Typography.sm,
    color: Colors.textGray,
  },
  driverStatusBadge: {
    paddingHorizontal: Spacing.xs,
    paddingVertical: 4,
    borderRadius: Radius.sm,
  },
  driverStatusText: {
    color: Colors.white,
    fontSize: Typography.xs,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.md,
  },
  detailModalContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.md,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  modalTitle: {
    fontSize: Typography.lg,
    fontWeight: '700',
    color: Colors.textDark,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    padding: Spacing.sm,
    fontSize: Typography.md,
    color: Colors.textDark,
    marginBottom: Spacing.sm,
  },
  modalButton: {
    backgroundColor: Colors.primary,
    padding: Spacing.sm,
    borderRadius: Radius.md,
    alignItems: 'center',
  },
  modalButtonText: {
    color: Colors.white,
    fontSize: Typography.md,
    fontWeight: '600',
  },
  detailStatusBanner: {
    padding: Spacing.sm,
    borderRadius: Radius.sm,
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  detailStatusText: {
    color: Colors.white,
    fontSize: Typography.md,
    fontWeight: '700',
  },
  detailImage: {
    width: '100%',
    height: 150,
    borderRadius: Radius.md,
    marginBottom: Spacing.sm,
    backgroundColor: Colors.backgroundEnd,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  detailLabel: {
    fontSize: Typography.sm,
    color: Colors.textGray,
  },
  detailValue: {
    fontSize: Typography.sm,
    color: Colors.textDark,
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
  },
  priceAdjustSection: {
    marginTop: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  priceInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  priceInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    padding: Spacing.xs,
    fontSize: Typography.md,
  },
  updateCostButton: {
    backgroundColor: Colors.secondary,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.sm,
  },
  updateCostText: {
    color: Colors.white,
    fontWeight: '600',
  },
  actionButtons: {
    marginTop: Spacing.md,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.sm,
    borderRadius: Radius.md,
    gap: Spacing.xs,
  },
  actionButtonText: {
    color: Colors.white,
    fontSize: Typography.md,
    fontWeight: '600',
  },
  assignSection: {
    marginTop: Spacing.xs,
  },
  noDriversText: {
    color: Colors.textGray,
    padding: Spacing.sm,
  },
  driverOption: {
    backgroundColor: Colors.backgroundEnd,
    padding: Spacing.sm,
    borderRadius: Radius.sm,
    marginRight: Spacing.xs,
    marginTop: Spacing.xs,
    minWidth: 100,
    alignItems: 'center',
  },
  driverOptionSelected: {
    backgroundColor: Colors.primary,
  },
  driverOptionText: {
    fontSize: Typography.sm,
    fontWeight: '600',
    color: Colors.textDark,
  },
  driverOptionTextSelected: {
    color: Colors.white,
  },
  driverOptionVehicle: {
    fontSize: Typography.xs,
    color: Colors.textGray,
  },
});
