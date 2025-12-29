#!/usr/bin/env python3
"""
EcoPort Backend API Comprehensive Test Suite
Tests all backend APIs and workflows for the waste pickup logistics system
"""

import requests
import json
import base64
import time
from typing import Dict, Any, Optional
import sys

# Backend URL from frontend .env
BACKEND_URL = "https://waste-pickup-11.preview.emergentagent.com/api"

# Test data
ADMIN_CREDENTIALS = {
    "username": "admin",
    "password": "admin123"
}

# Valid Siliguri coordinates (within 20km of 26.7271, 88.3953)
VALID_LOCATION = {
    "latitude": 26.73,
    "longitude": 88.40,
    "address": "Test Address, Siliguri"
}

# Invalid location (outside 20km radius)
INVALID_LOCATION = {
    "latitude": 26.50,  # Too far from Siliguri
    "longitude": 88.10,
    "address": "Outside Service Area"
}

# Sample base64 image (small test image)
SAMPLE_IMAGE = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/8A"

class EcoPortAPITester:
    def __init__(self):
        self.base_url = BACKEND_URL
        self.auth_token = None
        self.test_results = []
        self.created_resources = {
            'pickup_requests': [],
            'drivers': [],
            'ratings': []
        }
    
    def log_test(self, test_name: str, success: bool, message: str = "", details: Any = None):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        result = {
            'test': test_name,
            'status': status,
            'success': success,
            'message': message,
            'details': details
        }
        self.test_results.append(result)
        print(f"{status}: {test_name}")
        if message:
            print(f"   {message}")
        if not success and details:
            print(f"   Details: {details}")
        print()
    
    def make_request(self, method: str, endpoint: str, data: Dict = None, auth: bool = False) -> requests.Response:
        """Make HTTP request with optional auth"""
        url = f"{self.base_url}{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        if auth and self.auth_token:
            headers['Authorization'] = f'Bearer {self.auth_token}'
        
        try:
            if method.upper() == 'GET':
                response = requests.get(url, headers=headers, timeout=30)
            elif method.upper() == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=30)
            elif method.upper() == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=30)
            else:
                raise ValueError(f"Unsupported method: {method}")
            
            return response
        except requests.exceptions.RequestException as e:
            print(f"Request failed: {e}")
            raise
    
    def test_health_check(self):
        """Test basic connectivity"""
        try:
            response = self.make_request('GET', '/health')
            if response.status_code == 200:
                self.log_test("Health Check", True, "Backend is accessible")
            else:
                self.log_test("Health Check", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("Health Check", False, f"Connection failed: {str(e)}")
    
    def test_auth_login(self):
        """Test admin login"""
        try:
            response = self.make_request('POST', '/auth/login', ADMIN_CREDENTIALS)
            
            if response.status_code == 200:
                data = response.json()
                if 'access_token' in data:
                    self.auth_token = data['access_token']
                    self.log_test("Auth Login", True, "Admin login successful")
                    return True
                else:
                    self.log_test("Auth Login", False, "No access token in response", data)
            else:
                self.log_test("Auth Login", False, f"Status: {response.status_code}", response.text)
        except Exception as e:
            self.log_test("Auth Login", False, f"Exception: {str(e)}")
        return False
    
    def test_auth_invalid_credentials(self):
        """Test login with invalid credentials"""
        try:
            invalid_creds = {"username": "wrong", "password": "wrong"}
            response = self.make_request('POST', '/auth/login', invalid_creds)
            
            if response.status_code == 401:
                self.log_test("Auth Invalid Credentials", True, "Correctly rejected invalid credentials")
            else:
                self.log_test("Auth Invalid Credentials", False, f"Expected 401, got {response.status_code}")
        except Exception as e:
            self.log_test("Auth Invalid Credentials", False, f"Exception: {str(e)}")
    
    def test_auth_me(self):
        """Test get current user"""
        try:
            response = self.make_request('GET', '/auth/me', auth=True)
            
            if response.status_code == 200:
                data = response.json()
                if data.get('username') == 'admin' and data.get('role') == 'admin':
                    self.log_test("Auth Me", True, "Current user endpoint working")
                else:
                    self.log_test("Auth Me", False, "Unexpected user data", data)
            else:
                self.log_test("Auth Me", False, f"Status: {response.status_code}", response.text)
        except Exception as e:
            self.log_test("Auth Me", False, f"Exception: {str(e)}")
    
    def test_create_pickup_request_valid(self):
        """Test creating pickup request with valid location"""
        try:
            pickup_data = {
                "location": VALID_LOCATION,
                "waste_image": SAMPLE_IMAGE,
                "waste_type": "Plastic",
                "quantity": "Medium",
                "user_contact": "9876543210"
            }
            
            response = self.make_request('POST', '/pickup-requests', pickup_data)
            
            if response.status_code == 200:
                data = response.json()
                if 'id' in data and data.get('status') == 'Pending':
                    self.created_resources['pickup_requests'].append(data['id'])
                    self.log_test("Create Pickup Request (Valid)", True, 
                                f"Created request {data['id']}, cost: ₹{data.get('estimated_cost')}")
                    return data['id']
                else:
                    self.log_test("Create Pickup Request (Valid)", False, "Invalid response structure", data)
            else:
                self.log_test("Create Pickup Request (Valid)", False, 
                            f"Status: {response.status_code}", response.text)
        except Exception as e:
            self.log_test("Create Pickup Request (Valid)", False, f"Exception: {str(e)}")
        return None
    
    def test_create_pickup_request_invalid_location(self):
        """Test creating pickup request outside service area"""
        try:
            pickup_data = {
                "location": INVALID_LOCATION,
                "waste_image": SAMPLE_IMAGE,
                "waste_type": "Plastic",
                "quantity": "Medium",
                "user_contact": "9876543210"
            }
            
            response = self.make_request('POST', '/pickup-requests', pickup_data)
            
            if response.status_code == 400:
                error_msg = response.json().get('detail', '')
                if 'service area' in error_msg.lower():
                    self.log_test("Service Area Restriction", True, "Correctly rejected out-of-area request")
                else:
                    self.log_test("Service Area Restriction", False, f"Wrong error message: {error_msg}")
            else:
                self.log_test("Service Area Restriction", False, 
                            f"Expected 400, got {response.status_code}")
        except Exception as e:
            self.log_test("Service Area Restriction", False, f"Exception: {str(e)}")
    
    def test_get_pickup_requests(self):
        """Test listing pickup requests"""
        try:
            response = self.make_request('GET', '/pickup-requests')
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    self.log_test("Get Pickup Requests", True, f"Retrieved {len(data)} requests")
                else:
                    self.log_test("Get Pickup Requests", False, "Response is not a list", data)
            else:
                self.log_test("Get Pickup Requests", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("Get Pickup Requests", False, f"Exception: {str(e)}")
    
    def test_get_pickup_request_by_id(self, request_id: str):
        """Test getting specific pickup request"""
        if not request_id:
            self.log_test("Get Pickup Request by ID", False, "No request ID provided")
            return
        
        try:
            response = self.make_request('GET', f'/pickup-requests/{request_id}')
            
            if response.status_code == 200:
                data = response.json()
                if data.get('id') == request_id:
                    self.log_test("Get Pickup Request by ID", True, f"Retrieved request {request_id}")
                else:
                    self.log_test("Get Pickup Request by ID", False, "ID mismatch", data)
            else:
                self.log_test("Get Pickup Request by ID", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("Get Pickup Request by ID", False, f"Exception: {str(e)}")
    
    def test_update_pickup_request_status(self, request_id: str, new_status: str):
        """Test updating pickup request status"""
        if not request_id:
            self.log_test(f"Update Status to {new_status}", False, "No request ID provided")
            return False
        
        try:
            update_data = {"status": new_status}
            response = self.make_request('PUT', f'/pickup-requests/{request_id}', update_data, auth=True)
            
            if response.status_code == 200:
                data = response.json()
                if data.get('status') == new_status:
                    self.log_test(f"Update Status to {new_status}", True, f"Status updated to {new_status}")
                    return True
                else:
                    self.log_test(f"Update Status to {new_status}", False, 
                                f"Expected {new_status}, got {data.get('status')}")
            else:
                self.log_test(f"Update Status to {new_status}", False, 
                            f"Status: {response.status_code}", response.text)
        except Exception as e:
            self.log_test(f"Update Status to {new_status}", False, f"Exception: {str(e)}")
        return False
    
    def test_invalid_status_transition(self, request_id: str):
        """Test invalid status transition (Pending -> Completed)"""
        if not request_id:
            self.log_test("Invalid Status Transition", False, "No request ID provided")
            return
        
        try:
            # Try invalid transition: Pending -> Completed (should fail)
            update_data = {"status": "Completed"}
            response = self.make_request('PUT', f'/pickup-requests/{request_id}', update_data, auth=True)
            
            if response.status_code == 400:
                error_msg = response.json().get('detail', '')
                if 'transition' in error_msg.lower():
                    self.log_test("Invalid Status Transition", True, "Correctly rejected invalid transition")
                else:
                    self.log_test("Invalid Status Transition", False, f"Wrong error: {error_msg}")
            else:
                self.log_test("Invalid Status Transition", False, 
                            f"Expected 400, got {response.status_code}")
        except Exception as e:
            self.log_test("Invalid Status Transition", False, f"Exception: {str(e)}")
    
    def test_create_driver(self):
        """Test creating a driver"""
        try:
            driver_data = {
                "name": "Test Driver",
                "phone": "9876543210",
                "vehicle_type": "Truck",
                "vehicle_number": "WB74A1234"
            }
            
            response = self.make_request('POST', '/drivers', driver_data, auth=True)
            
            if response.status_code == 200:
                data = response.json()
                if 'id' in data and data.get('status') == 'Available':
                    self.created_resources['drivers'].append(data['id'])
                    self.log_test("Create Driver", True, f"Created driver {data['id']}")
                    return data['id']
                else:
                    self.log_test("Create Driver", False, "Invalid response structure", data)
            else:
                self.log_test("Create Driver", False, f"Status: {response.status_code}", response.text)
        except Exception as e:
            self.log_test("Create Driver", False, f"Exception: {str(e)}")
        return None
    
    def test_get_drivers(self):
        """Test listing drivers"""
        try:
            response = self.make_request('GET', '/drivers')
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    self.log_test("Get Drivers", True, f"Retrieved {len(data)} drivers")
                else:
                    self.log_test("Get Drivers", False, "Response is not a list", data)
            else:
                self.log_test("Get Drivers", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("Get Drivers", False, f"Exception: {str(e)}")
    
    def test_get_driver_by_id(self, driver_id: str):
        """Test getting specific driver"""
        if not driver_id:
            self.log_test("Get Driver by ID", False, "No driver ID provided")
            return
        
        try:
            response = self.make_request('GET', f'/drivers/{driver_id}')
            
            if response.status_code == 200:
                data = response.json()
                if data.get('id') == driver_id:
                    self.log_test("Get Driver by ID", True, f"Retrieved driver {driver_id}")
                else:
                    self.log_test("Get Driver by ID", False, "ID mismatch", data)
            else:
                self.log_test("Get Driver by ID", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("Get Driver by ID", False, f"Exception: {str(e)}")
    
    def test_update_driver_status(self, driver_id: str, status: str):
        """Test updating driver status"""
        if not driver_id:
            self.log_test(f"Update Driver Status to {status}", False, "No driver ID provided")
            return
        
        try:
            response = self.make_request('PUT', f'/drivers/{driver_id}/status?status={status}', auth=True)
            
            if response.status_code == 200:
                data = response.json()
                if data.get('status') == status:
                    self.log_test(f"Update Driver Status to {status}", True, f"Driver status updated to {status}")
                else:
                    self.log_test(f"Update Driver Status to {status}", False, 
                                f"Expected {status}, got {data.get('status')}")
            else:
                self.log_test(f"Update Driver Status to {status}", False, 
                            f"Status: {response.status_code}", response.text)
        except Exception as e:
            self.log_test(f"Update Driver Status to {status}", False, f"Exception: {str(e)}")
    
    def test_assign_driver(self, request_id: str, driver_id: str):
        """Test assigning driver to pickup request"""
        if not request_id or not driver_id:
            self.log_test("Assign Driver", False, "Missing request or driver ID")
            return False
        
        try:
            response = self.make_request('POST', f'/pickup-requests/{request_id}/assign-driver?driver_id={driver_id}', 
                                       auth=True)
            
            if response.status_code == 200:
                data = response.json()
                if data.get('driver_id') == driver_id and data.get('status') == 'Assigned':
                    self.log_test("Assign Driver", True, f"Driver {driver_id} assigned to request {request_id}")
                    return True
                else:
                    self.log_test("Assign Driver", False, "Assignment not reflected in response", data)
            else:
                self.log_test("Assign Driver", False, f"Status: {response.status_code}", response.text)
        except Exception as e:
            self.log_test("Assign Driver", False, f"Exception: {str(e)}")
        return False
    
    def test_driver_status_after_assignment(self, driver_id: str):
        """Test that driver status changes to Busy after assignment"""
        if not driver_id:
            self.log_test("Driver Status After Assignment", False, "No driver ID provided")
            return
        
        try:
            response = self.make_request('GET', f'/drivers/{driver_id}')
            
            if response.status_code == 200:
                data = response.json()
                if data.get('status') == 'Busy':
                    self.log_test("Driver Status After Assignment", True, "Driver status correctly changed to Busy")
                else:
                    self.log_test("Driver Status After Assignment", False, 
                                f"Expected Busy, got {data.get('status')}")
            else:
                self.log_test("Driver Status After Assignment", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("Driver Status After Assignment", False, f"Exception: {str(e)}")
    
    def test_stats_api(self):
        """Test stats dashboard API"""
        try:
            response = self.make_request('GET', '/stats')
            
            if response.status_code == 200:
                data = response.json()
                required_fields = ['pending', 'approved', 'assigned', 'completed', 'total']
                if all(field in data for field in required_fields):
                    self.log_test("Stats API", True, f"Stats: {data}")
                else:
                    self.log_test("Stats API", False, "Missing required fields", data)
            else:
                self.log_test("Stats API", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("Stats API", False, f"Exception: {str(e)}")
    
    def test_cost_calculation(self):
        """Test cost calculation endpoint"""
        try:
            # Cost calculation endpoint expects query parameters
            lat = VALID_LOCATION["latitude"]
            lng = VALID_LOCATION["longitude"]
            url = f"/calculate-cost?latitude={lat}&longitude={lng}&quantity=Medium&waste_type=Plastic"
            
            response = self.make_request('POST', url)
            
            if response.status_code == 200:
                data = response.json()
                if data.get('in_service_area') and 'estimated_cost' in data:
                    self.log_test("Cost Calculation", True, 
                                f"Cost: ₹{data['estimated_cost']}, Distance: {data['distance_km']}km")
                else:
                    self.log_test("Cost Calculation", False, "Invalid response structure", data)
            else:
                self.log_test("Cost Calculation", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("Cost Calculation", False, f"Exception: {str(e)}")
    
    def test_ratings_api(self, pickup_id: str):
        """Test ratings API - the one that needs retesting"""
        if not pickup_id:
            self.log_test("Ratings API", False, "No pickup ID provided")
            return
        
        try:
            # Check current status first
            get_response = self.make_request('GET', f'/pickup-requests/{pickup_id}')
            if get_response.status_code == 200:
                current_status = get_response.json().get('status')
                
                # Only update to Completed if not already Completed
                if current_status != "Completed":
                    self.test_update_pickup_request_status(pickup_id, "Completed")
            
            # Create a rating
            rating_data = {
                "pickup_id": pickup_id,
                "rating": 5,
                "feedback": "Excellent service!"
            }
            
            response = self.make_request('POST', '/ratings', rating_data)
            
            if response.status_code == 200:
                data = response.json()
                if 'id' in data and data.get('pickup_id') == pickup_id:
                    self.created_resources['ratings'].append(data['id'])
                    self.log_test("Create Rating", True, f"Created rating for pickup {pickup_id}")
                    
                    # Test getting the rating
                    get_response = self.make_request('GET', f'/ratings/{pickup_id}')
                    if get_response.status_code == 200:
                        self.log_test("Get Rating", True, "Rating retrieval working")
                    else:
                        self.log_test("Get Rating", False, f"Status: {get_response.status_code}")
                else:
                    self.log_test("Create Rating", False, "Invalid response structure", data)
            else:
                self.log_test("Create Rating", False, f"Status: {response.status_code}", response.text)
        except Exception as e:
            self.log_test("Ratings API", False, f"Exception: {str(e)}")
    
    def test_full_workflow(self):
        """Test complete workflow: Create -> Approve -> Assign -> Complete"""
        print("\n=== TESTING FULL WORKFLOW ===")
        
        # 1. Create pickup request
        pickup_id = self.test_create_pickup_request_valid()
        if not pickup_id:
            self.log_test("Full Workflow", False, "Failed to create pickup request")
            return
        
        # 2. Create driver
        driver_id = self.test_create_driver()
        if not driver_id:
            self.log_test("Full Workflow", False, "Failed to create driver")
            return
        
        # 3. Approve request
        if not self.test_update_pickup_request_status(pickup_id, "Approved"):
            self.log_test("Full Workflow", False, "Failed to approve request")
            return
        
        # 4. Assign driver
        if not self.test_assign_driver(pickup_id, driver_id):
            self.log_test("Full Workflow", False, "Failed to assign driver")
            return
        
        # 5. Check driver status changed to Busy
        self.test_driver_status_after_assignment(driver_id)
        
        # 6. Complete request
        if not self.test_update_pickup_request_status(pickup_id, "Completed"):
            self.log_test("Full Workflow", False, "Failed to complete request")
            return
        
        # 7. Test ratings
        self.test_ratings_api(pickup_id)
        
        self.log_test("Full Workflow", True, "Complete workflow executed successfully")
    
    def run_all_tests(self):
        """Run all tests"""
        print("🧪 Starting EcoPort Backend API Tests")
        print(f"Backend URL: {self.base_url}")
        print("=" * 60)
        
        # Basic connectivity
        self.test_health_check()
        
        # Authentication tests
        if not self.test_auth_login():
            print("❌ Authentication failed - cannot continue with authenticated tests")
            return
        
        self.test_auth_invalid_credentials()
        self.test_auth_me()
        
        # Pickup request tests
        self.test_create_pickup_request_invalid_location()
        pickup_id = self.test_create_pickup_request_valid()
        self.test_get_pickup_requests()
        if pickup_id:
            self.test_get_pickup_request_by_id(pickup_id)
            self.test_invalid_status_transition(pickup_id)
        
        # Driver tests
        driver_id = self.test_create_driver()
        self.test_get_drivers()
        if driver_id:
            self.test_get_driver_by_id(driver_id)
            self.test_update_driver_status(driver_id, "Offline")
            self.test_update_driver_status(driver_id, "Available")  # Reset for workflow test
        
        # Other API tests
        self.test_stats_api()
        self.test_cost_calculation()
        
        # Full workflow test
        self.test_full_workflow()
        
        # Print summary
        self.print_summary()
    
    def print_summary(self):
        """Print test summary"""
        print("\n" + "=" * 60)
        print("🧪 TEST SUMMARY")
        print("=" * 60)
        
        passed = sum(1 for result in self.test_results if result['success'])
        failed = len(self.test_results) - passed
        
        print(f"Total Tests: {len(self.test_results)}")
        print(f"✅ Passed: {passed}")
        print(f"❌ Failed: {failed}")
        print(f"Success Rate: {(passed/len(self.test_results)*100):.1f}%")
        
        if failed > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.test_results:
                if not result['success']:
                    print(f"  - {result['test']}: {result['message']}")
        
        print("\n📊 CREATED RESOURCES:")
        for resource_type, ids in self.created_resources.items():
            if ids:
                print(f"  - {resource_type}: {len(ids)} created")
        
        return failed == 0

if __name__ == "__main__":
    tester = EcoPortAPITester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)