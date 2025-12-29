from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, validator
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime
import math
import jwt
from enum import Enum

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'ecoport_db')]

# Environment variables with defaults
JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'ecoport_secret_key_2024')
SERVICE_CENTER_LAT = float(os.environ.get('SERVICE_CENTER_LAT', '26.7271'))
SERVICE_CENTER_LNG = float(os.environ.get('SERVICE_CENTER_LNG', '88.3953'))
SERVICE_RADIUS_KM = float(os.environ.get('SERVICE_RADIUS_KM', '20'))

# Pricing constants
RATE_PER_KM = 10
BASE_RATE = 50

# Volume factors
VOLUME_FACTORS = {
    'Small': 1.0,
    'Medium': 1.5,
    'Large': 2.0,
    'Bulk': 3.0
}

# Waste type surcharges
WASTE_SURCHARGES = {
    'Organic': 1.0,
    'Plastic': 1.0,
    'Metal': 1.0,
    'E-Waste': 1.2,
    'Mixed': 1.1
}

# Hardcoded admin credentials for pilot
ADMIN_CREDENTIALS = {
    'username': 'admin',
    'password': 'admin123'
}

# Create the main app
app = FastAPI(title="EcoPort API", version="1.0.0")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

security = HTTPBearer()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ============ ENUMS ============
class PickupStatus(str, Enum):
    PENDING = "Pending"
    APPROVED = "Approved"
    ASSIGNED = "Assigned"
    COMPLETED = "Completed"

class WasteType(str, Enum):
    ORGANIC = "Organic"
    PLASTIC = "Plastic"
    METAL = "Metal"
    E_WASTE = "E-Waste"
    MIXED = "Mixed"

class Quantity(str, Enum):
    SMALL = "Small"
    MEDIUM = "Medium"
    LARGE = "Large"
    BULK = "Bulk"

class DriverStatus(str, Enum):
    AVAILABLE = "Available"
    BUSY = "Busy"
    OFFLINE = "Offline"

class PaymentStatus(str, Enum):
    PENDING = "Pending"
    PAID = "Paid"
    FAILED = "Failed"

class PaymentMethod(str, Enum):
    COD = "COD"
    UPI = "UPI"
    INVOICE = "Invoice"

# ============ MODELS ============
class Location(BaseModel):
    latitude: float
    longitude: float
    address: str = ""

class StatusHistoryEntry(BaseModel):
    status: str
    at: datetime = Field(default_factory=datetime.utcnow)
    by: str = "system"

class PriceHistoryEntry(BaseModel):
    actual_cost: float
    at: datetime = Field(default_factory=datetime.utcnow)
    by: str = "admin"

class PickupRequest(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    location: Location
    waste_image: str  # base64 string
    waste_type: WasteType
    quantity: Quantity
    estimated_cost: float
    actual_cost: Optional[float] = None
    distance_km: float
    status: PickupStatus = PickupStatus.PENDING
    user_contact: Optional[str] = None
    notes: Optional[str] = None
    driver_id: Optional[str] = None
    payment_method: Optional[PaymentMethod] = None
    payment_status: PaymentStatus = PaymentStatus.PENDING
    status_history: List[StatusHistoryEntry] = []
    price_history: List[PriceHistoryEntry] = []
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class PickupRequestCreate(BaseModel):
    location: Location
    waste_image: str
    waste_type: WasteType
    quantity: Quantity
    user_contact: Optional[str] = None
    notes: Optional[str] = None
    payment_method: Optional[PaymentMethod] = None

    @validator('waste_image')
    def validate_image_size(cls, v):
        # Check base64 size (2MB limit ~ 2.67MB base64)
        max_size = 2.67 * 1024 * 1024  # ~2MB in base64
        if len(v) > max_size:
            raise ValueError('Image too large. Maximum size is 2MB.')
        return v

class PickupRequestUpdate(BaseModel):
    status: Optional[PickupStatus] = None
    actual_cost: Optional[float] = None
    notes: Optional[str] = None
    payment_status: Optional[PaymentStatus] = None

class Driver(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    phone: str
    vehicle_type: str
    vehicle_number: str
    status: DriverStatus = DriverStatus.AVAILABLE
    current_location: Optional[Location] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class DriverCreate(BaseModel):
    name: str
    phone: str
    vehicle_type: str
    vehicle_number: str

class Rating(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    pickup_id: str
    rating: int = Field(ge=1, le=5)
    feedback: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class RatingCreate(BaseModel):
    pickup_id: str
    rating: int = Field(ge=1, le=5)
    feedback: Optional[str] = None

class LoginRequest(BaseModel):
    username: str
    password: str

class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"

class AdminUser(BaseModel):
    username: str
    role: str = "admin"

# ============ UTILITIES ============
def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance between two points in km using Haversine formula"""
    R = 6371  # Earth's radius in km
    
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lon = math.radians(lon2 - lon1)
    
    a = math.sin(delta_lat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    
    return R * c

def calculate_cost(distance_km: float, quantity: str, waste_type: str) -> float:
    """Calculate estimated cost based on distance, quantity, and waste type"""
    volume_factor = VOLUME_FACTORS.get(quantity, 1.0)
    surcharge = WASTE_SURCHARGES.get(waste_type, 1.0)
    
    total = ((distance_km * RATE_PER_KM) + (volume_factor * BASE_RATE)) * surcharge
    return round(total, 2)

def create_jwt_token(username: str) -> str:
    """Create JWT token for admin"""
    payload = {
        'sub': username,
        'role': 'admin',
        'exp': datetime.utcnow().timestamp() + 86400  # 24 hours
    }
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm='HS256')

def verify_jwt_token(token: str) -> Optional[Dict]:
    """Verify JWT token"""
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=['HS256'])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None

async def get_current_admin(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Dependency to verify admin token"""
    token = credentials.credentials
    payload = verify_jwt_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return AdminUser(username=payload['sub'])

# ============ AUTH ROUTES ============
@api_router.post("/auth/login", response_model=LoginResponse)
async def login(request: LoginRequest):
    """Admin login endpoint"""
    if request.username == ADMIN_CREDENTIALS['username'] and request.password == ADMIN_CREDENTIALS['password']:
        token = create_jwt_token(request.username)
        return LoginResponse(access_token=token)
    raise HTTPException(status_code=401, detail="Invalid credentials")

@api_router.get("/auth/me", response_model=AdminUser)
async def get_me(admin: AdminUser = Depends(get_current_admin)):
    """Get current admin user"""
    return admin

# ============ PICKUP REQUEST ROUTES ============
@api_router.post("/pickup-requests", response_model=PickupRequest)
async def create_pickup_request(request: PickupRequestCreate):
    """Create a new pickup request"""
    # Calculate distance from service center
    distance_km = haversine_distance(
        SERVICE_CENTER_LAT, SERVICE_CENTER_LNG,
        request.location.latitude, request.location.longitude
    )
    
    # Check service area
    if distance_km > SERVICE_RADIUS_KM:
        raise HTTPException(
            status_code=400,
            detail="Currently we serve Siliguri city limits only. Your location is outside our service area."
        )
    
    # Calculate estimated cost
    estimated_cost = calculate_cost(distance_km, request.quantity.value, request.waste_type.value)
    
    # Create pickup request
    pickup = PickupRequest(
        location=request.location,
        waste_image=request.waste_image,
        waste_type=request.waste_type,
        quantity=request.quantity,
        estimated_cost=estimated_cost,
        distance_km=round(distance_km, 2),
        user_contact=request.user_contact,
        notes=request.notes,
        payment_method=request.payment_method,
        status_history=[StatusHistoryEntry(status=PickupStatus.PENDING.value, by="user")]
    )
    
    await db.pickup_requests.insert_one(pickup.dict())
    logger.info(f"Created pickup request: {pickup.id}")
    return pickup

@api_router.get("/pickup-requests", response_model=List[PickupRequest])
async def get_pickup_requests(
    status: Optional[PickupStatus] = None,
    limit: int = 50,
    skip: int = 0
):
    """Get all pickup requests with optional filters"""
    query = {}
    if status:
        query['status'] = status.value
    
    cursor = db.pickup_requests.find(query).sort('created_at', -1).skip(skip).limit(limit)
    requests = await cursor.to_list(limit)
    return [PickupRequest(**req) for req in requests]

@api_router.get("/pickup-requests/{request_id}", response_model=PickupRequest)
async def get_pickup_request(request_id: str):
    """Get a specific pickup request"""
    request = await db.pickup_requests.find_one({'id': request_id})
    if not request:
        raise HTTPException(status_code=404, detail="Pickup request not found")
    return PickupRequest(**request)

@api_router.put("/pickup-requests/{request_id}", response_model=PickupRequest)
async def update_pickup_request(
    request_id: str,
    update: PickupRequestUpdate,
    admin: AdminUser = Depends(get_current_admin)
):
    """Update a pickup request (admin only)"""
    existing = await db.pickup_requests.find_one({'id': request_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Pickup request not found")
    
    pickup = PickupRequest(**existing)
    update_data = update.dict(exclude_unset=True)
    
    # Validate status transitions
    if 'status' in update_data:
        new_status = update_data['status']
        current_status = pickup.status
        
        valid_transitions = {
            PickupStatus.PENDING: [PickupStatus.APPROVED],
            PickupStatus.APPROVED: [PickupStatus.ASSIGNED],
            PickupStatus.ASSIGNED: [PickupStatus.COMPLETED],
            PickupStatus.COMPLETED: []
        }
        
        if new_status not in valid_transitions.get(current_status, []):
            raise HTTPException(
                status_code=400,
                detail=f"Invalid status transition from {current_status.value} to {new_status.value}"
            )
        
        # Add to status history - convert existing entries to dicts if needed
        existing_history = [
            h.dict() if hasattr(h, 'dict') else h 
            for h in pickup.status_history
        ]
        update_data['status_history'] = existing_history + [
            StatusHistoryEntry(status=new_status.value, by=admin.username).dict()
        ]
    
    # Track price changes
    if 'actual_cost' in update_data and update_data['actual_cost'] is not None:
        # Convert existing entries to dicts if needed
        existing_price_history = [
            p.dict() if hasattr(p, 'dict') else p 
            for p in pickup.price_history
        ]
        update_data['price_history'] = existing_price_history + [
            PriceHistoryEntry(actual_cost=update_data['actual_cost'], by=admin.username).dict()
        ]
    
    update_data['updated_at'] = datetime.utcnow()
    
    await db.pickup_requests.update_one(
        {'id': request_id},
        {'$set': update_data}
    )
    
    updated = await db.pickup_requests.find_one({'id': request_id})
    return PickupRequest(**updated)

@api_router.post("/pickup-requests/{request_id}/assign-driver", response_model=PickupRequest)
async def assign_driver(
    request_id: str,
    driver_id: str,
    admin: AdminUser = Depends(get_current_admin)
):
    """Assign a driver to a pickup request"""
    # Verify pickup request exists and is approved
    pickup = await db.pickup_requests.find_one({'id': request_id})
    if not pickup:
        raise HTTPException(status_code=404, detail="Pickup request not found")
    
    pickup_obj = PickupRequest(**pickup)
    if pickup_obj.status != PickupStatus.APPROVED:
        raise HTTPException(status_code=400, detail="Can only assign driver to approved requests")
    
    # Verify driver exists and is available
    driver = await db.drivers.find_one({'id': driver_id})
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
    
    driver_obj = Driver(**driver)
    if driver_obj.status != DriverStatus.AVAILABLE:
        raise HTTPException(status_code=400, detail="Driver is not available")
    
    # Update pickup request - convert existing entries to dicts if needed
    existing_history = [
        h.dict() if hasattr(h, 'dict') else h 
        for h in pickup_obj.status_history
    ]
    new_status_history = existing_history + [
        StatusHistoryEntry(status=PickupStatus.ASSIGNED.value, by=admin.username).dict()
    ]
    
    await db.pickup_requests.update_one(
        {'id': request_id},
        {'$set': {
            'driver_id': driver_id,
            'status': PickupStatus.ASSIGNED.value,
            'status_history': new_status_history,
            'updated_at': datetime.utcnow()
        }}
    )
    
    # Update driver status to busy
    await db.drivers.update_one(
        {'id': driver_id},
        {'$set': {'status': DriverStatus.BUSY.value}}
    )
    
    updated = await db.pickup_requests.find_one({'id': request_id})
    return PickupRequest(**updated)

# ============ DRIVER ROUTES ============
@api_router.post("/drivers", response_model=Driver)
async def create_driver(driver: DriverCreate, admin: AdminUser = Depends(get_current_admin)):
    """Create a new driver (admin only)"""
    new_driver = Driver(**driver.dict())
    await db.drivers.insert_one(new_driver.dict())
    logger.info(f"Created driver: {new_driver.id}")
    return new_driver

@api_router.get("/drivers", response_model=List[Driver])
async def get_drivers(status: Optional[DriverStatus] = None):
    """Get all drivers with optional status filter"""
    query = {}
    if status:
        query['status'] = status.value
    
    drivers = await db.drivers.find(query).to_list(100)
    return [Driver(**d) for d in drivers]

@api_router.get("/drivers/{driver_id}", response_model=Driver)
async def get_driver(driver_id: str):
    """Get a specific driver"""
    driver = await db.drivers.find_one({'id': driver_id})
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
    return Driver(**driver)

@api_router.put("/drivers/{driver_id}/status", response_model=Driver)
async def update_driver_status(
    driver_id: str,
    status: DriverStatus,
    admin: AdminUser = Depends(get_current_admin)
):
    """Update driver status (admin only)"""
    driver = await db.drivers.find_one({'id': driver_id})
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
    
    await db.drivers.update_one(
        {'id': driver_id},
        {'$set': {'status': status.value}}
    )
    
    updated = await db.drivers.find_one({'id': driver_id})
    return Driver(**updated)

# ============ RATING ROUTES ============
@api_router.post("/ratings", response_model=Rating)
async def create_rating(rating: RatingCreate):
    """Create a rating for a completed pickup"""
    # Verify pickup exists and is completed
    pickup = await db.pickup_requests.find_one({'id': rating.pickup_id})
    if not pickup:
        raise HTTPException(status_code=404, detail="Pickup request not found")
    
    if pickup['status'] != PickupStatus.COMPLETED.value:
        raise HTTPException(status_code=400, detail="Can only rate completed pickups")
    
    # Check if already rated
    existing = await db.ratings.find_one({'pickup_id': rating.pickup_id})
    if existing:
        raise HTTPException(status_code=400, detail="This pickup has already been rated")
    
    new_rating = Rating(**rating.dict())
    await db.ratings.insert_one(new_rating.dict())
    return new_rating

@api_router.get("/ratings/{pickup_id}", response_model=Rating)
async def get_rating(pickup_id: str):
    """Get rating for a specific pickup"""
    rating = await db.ratings.find_one({'pickup_id': pickup_id})
    if not rating:
        raise HTTPException(status_code=404, detail="Rating not found")
    return Rating(**rating)

# ============ STATS ROUTE ============
@api_router.get("/stats")
async def get_stats():
    """Get dashboard statistics"""
    pending = await db.pickup_requests.count_documents({'status': PickupStatus.PENDING.value})
    approved = await db.pickup_requests.count_documents({'status': PickupStatus.APPROVED.value})
    assigned = await db.pickup_requests.count_documents({'status': PickupStatus.ASSIGNED.value})
    completed = await db.pickup_requests.count_documents({'status': PickupStatus.COMPLETED.value})
    
    return {
        'pending': pending,
        'approved': approved,
        'assigned': assigned,
        'completed': completed,
        'total': pending + approved + assigned + completed
    }

# ============ PRICING PREVIEW ============
@api_router.post("/calculate-cost")
async def calculate_cost_preview(
    latitude: float,
    longitude: float,
    quantity: Quantity,
    waste_type: WasteType
):
    """Calculate estimated cost preview"""
    distance_km = haversine_distance(
        SERVICE_CENTER_LAT, SERVICE_CENTER_LNG,
        latitude, longitude
    )
    
    if distance_km > SERVICE_RADIUS_KM:
        return {
            'in_service_area': False,
            'message': "Currently we serve Siliguri city limits only."
        }
    
    cost = calculate_cost(distance_km, quantity.value, waste_type.value)
    
    return {
        'in_service_area': True,
        'distance_km': round(distance_km, 2),
        'estimated_cost': cost
    }

# Root endpoint
@api_router.get("/")
async def root():
    return {"message": "EcoPort API - Waste Pickup Logistics", "version": "1.0.0"}

# Health check
@api_router.get("/health")
async def health_check():
    return {"status": "healthy"}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_db_client():
    """Create indexes on startup"""
    await db.pickup_requests.create_index('status')
    await db.pickup_requests.create_index('created_at')
    await db.pickup_requests.create_index('driver_id')
    await db.drivers.create_index('status')
    logger.info("Database indexes created")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
