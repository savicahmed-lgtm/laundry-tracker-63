#!/usr/bin/env python3
"""
Backend API tests for Loundry Suci - Role-based workflow testing
Tests the newly changed role-based laundry workflow, scan, confirm-received, auto-complete, and rewash features.
"""
import requests
import json
import sys
from typing import Optional

# Backend URL from frontend/.env
BASE_URL = "https://clean-tracker-40.preview.emergentagent.com/api"

# Test credentials
CREDENTIALS = {
    "customer": {"phone": "081211112222", "password": "password123"},
    "admin_cabang": {"phone": "081200000001", "password": "admin123"},
    "admin_cuci": {"phone": "081200000002", "password": "admin123"},
    "admin_setrika": {"phone": "081200000003", "password": "admin123"},
    "admin_antar": {"phone": "081200000004", "password": "admin123"},
    "super_admin": {"phone": "081200000000", "password": "admin123"},
}

# Store tokens and order IDs for test flow
tokens = {}
test_orders = {}

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    RESET = '\033[0m'

def log_test(name: str):
    print(f"\n{Colors.BLUE}[TEST]{Colors.RESET} {name}")

def log_pass(msg: str):
    print(f"  {Colors.GREEN}✓{Colors.RESET} {msg}")

def log_fail(msg: str):
    print(f"  {Colors.RED}✗{Colors.RESET} {msg}")

def log_info(msg: str):
    print(f"  {Colors.YELLOW}ℹ{Colors.RESET} {msg}")

def login(role: str) -> Optional[str]:
    """Login and return access token"""
    creds = CREDENTIALS[role]
    resp = requests.post(f"{BASE_URL}/auth/login", json=creds)
    if resp.status_code == 200:
        token = resp.json()["access_token"]
        tokens[role] = token
        return token
    return None

def auth_headers(role: str) -> dict:
    """Get authorization headers for a role"""
    return {"Authorization": f"Bearer {tokens[role]}"}

def test_login_all_roles():
    """Test login for all roles"""
    log_test("Login all roles")
    for role in CREDENTIALS.keys():
        token = login(role)
        if token:
            log_pass(f"{role} login successful")
        else:
            log_fail(f"{role} login failed")
            sys.exit(1)

def test_full_happy_path_branch():
    """Test full happy path for branch service order"""
    log_test("FULL HAPPY PATH - Branch Service Order")
    
    # a. Customer creates order
    log_info("Step a: Customer creates branch order")
    resp = requests.post(
        f"{BASE_URL}/orders",
        headers=auth_headers("customer"),
        json={"service": "branch", "treatment": "cuci_setrika", "branch_id": "pusat"}
    )
    if resp.status_code != 200:
        log_fail(f"Create order failed: {resp.status_code} - {resp.text}")
        return False
    order = resp.json()
    order_id = order["id"]
    test_orders["branch_happy"] = order_id
    if order["status"] != "diterima":
        log_fail(f"Expected status 'diterima', got '{order['status']}'")
        return False
    log_pass(f"Order created with status 'diterima', ID: {order_id[:8]}, code: {order['code']}")
    
    # b. Admin Cabang sets items
    log_info("Step b: Admin Cabang sets items and weight")
    resp = requests.patch(
        f"{BASE_URL}/orders/{order_id}/items",
        headers=auth_headers("admin_cabang"),
        json={"items": [{"key": "kaos", "qty": 3}], "weight_kg": 4}
    )
    if resp.status_code != 200:
        log_fail(f"Set items failed: {resp.status_code} - {resp.text}")
        return False
    order = resp.json()
    if order["subtotal"] <= 0:
        log_fail(f"Expected subtotal > 0, got {order['subtotal']}")
        return False
    if order["points_earned"] != 4:
        log_fail(f"Expected points_earned ≈ 4, got {order['points_earned']}")
        return False
    log_pass(f"Items set, priced: subtotal={order['subtotal']}, points_earned={order['points_earned']}")
    
    # c. Customer pays
    log_info("Step c: Customer pays order")
    resp = requests.post(
        f"{BASE_URL}/orders/{order_id}/pay",
        headers=auth_headers("customer"),
        json={"use_points": False}
    )
    if resp.status_code != 200:
        log_fail(f"Payment failed: {resp.status_code} - {resp.text}")
        return False
    order = resp.json()
    if order["status"] != "lunas":
        log_fail(f"Expected status 'lunas', got '{order['status']}'")
        return False
    if not order["paid"]:
        log_fail(f"Expected paid=true, got {order['paid']}")
        return False
    log_pass(f"Payment successful, status='lunas', paid=true")
    
    # d. Admin Cuci sets dicuci
    log_info("Step d: Admin Cuci sets status to 'dicuci'")
    resp = requests.patch(
        f"{BASE_URL}/orders/{order_id}/status",
        headers=auth_headers("admin_cuci"),
        json={"status": "dicuci"}
    )
    if resp.status_code != 200:
        log_fail(f"Set dicuci failed: {resp.status_code} - {resp.text}")
        return False
    order = resp.json()
    if order["status"] != "dicuci":
        log_fail(f"Expected status 'dicuci', got '{order['status']}'")
        return False
    log_pass(f"Status set to 'dicuci'")
    
    # e. Admin Setrika sets disetrika
    log_info("Step e: Admin Setrika sets status to 'disetrika'")
    resp = requests.patch(
        f"{BASE_URL}/orders/{order_id}/status",
        headers=auth_headers("admin_setrika"),
        json={"status": "disetrika"}
    )
    if resp.status_code != 200:
        log_fail(f"Set disetrika failed: {resp.status_code} - {resp.text}")
        return False
    order = resp.json()
    if order["status"] != "disetrika":
        log_fail(f"Expected status 'disetrika', got '{order['status']}'")
        return False
    log_pass(f"Status set to 'disetrika'")
    
    # f. Admin Cabang sets siap
    log_info("Step f: Admin Cabang sets status to 'siap'")
    resp = requests.patch(
        f"{BASE_URL}/orders/{order_id}/status",
        headers=auth_headers("admin_cabang"),
        json={"status": "siap"}
    )
    if resp.status_code != 200:
        log_fail(f"Set siap failed: {resp.status_code} - {resp.text}")
        return False
    order = resp.json()
    if order["status"] != "siap":
        log_fail(f"Expected status 'siap', got '{order['status']}'")
        return False
    if not order.get("siap_at"):
        log_fail(f"Expected siap_at to be set")
        return False
    log_pass(f"Status set to 'siap', siap_at={order['siap_at']}")
    
    # g. Customer confirms received
    log_info("Step g: Customer confirms received")
    resp = requests.post(
        f"{BASE_URL}/orders/{order_id}/confirm-received",
        headers=auth_headers("customer")
    )
    if resp.status_code != 200:
        log_fail(f"Confirm received failed: {resp.status_code} - {resp.text}")
        return False
    order = resp.json()
    if order["status"] != "selesai":
        log_fail(f"Expected status 'selesai', got '{order['status']}'")
        return False
    if not order.get("selesai_at"):
        log_fail(f"Expected selesai_at to be set")
        return False
    log_pass(f"Order completed, status='selesai', selesai_at={order['selesai_at']}")
    
    return True

def test_role_enforcement():
    """Test role enforcement - negative tests"""
    log_test("ROLE ENFORCEMENT - Negative Tests")
    
    # Create a test order and advance it to lunas
    log_info("Setup: Creating test order for role enforcement")
    resp = requests.post(
        f"{BASE_URL}/orders",
        headers=auth_headers("customer"),
        json={"service": "branch", "treatment": "cuci_setrika", "branch_id": "pusat"}
    )
    order_id = resp.json()["id"]
    test_orders["role_test"] = order_id
    
    # Set items
    requests.patch(
        f"{BASE_URL}/orders/{order_id}/items",
        headers=auth_headers("admin_cabang"),
        json={"items": [{"key": "kaos", "qty": 2}], "weight_kg": 3}
    )
    
    # Pay
    requests.post(
        f"{BASE_URL}/orders/{order_id}/pay",
        headers=auth_headers("customer"),
        json={"use_points": False}
    )
    
    # Advance to dicuci
    requests.patch(
        f"{BASE_URL}/orders/{order_id}/status",
        headers=auth_headers("admin_cuci"),
        json={"status": "dicuci"}
    )
    
    # Test 1: Admin Cuci trying to set disetrika (should fail)
    log_info("Test: Admin Cuci trying to set 'disetrika' (should be 403)")
    resp = requests.patch(
        f"{BASE_URL}/orders/{order_id}/status",
        headers=auth_headers("admin_cuci"),
        json={"status": "disetrika"}
    )
    if resp.status_code == 403:
        log_pass("Admin Cuci correctly denied setting 'disetrika' (403)")
    else:
        log_fail(f"Expected 403, got {resp.status_code}")
    
    # Advance to disetrika for next tests
    requests.patch(
        f"{BASE_URL}/orders/{order_id}/status",
        headers=auth_headers("admin_setrika"),
        json={"status": "disetrika"}
    )
    
    # Test 2: Admin Setrika trying to set siap (should fail - only cabang can)
    log_info("Test: Admin Setrika trying to set 'siap' (should be 403)")
    resp = requests.patch(
        f"{BASE_URL}/orders/{order_id}/status",
        headers=auth_headers("admin_setrika"),
        json={"status": "siap"}
    )
    if resp.status_code == 403:
        log_pass("Admin Setrika correctly denied setting 'siap' (403)")
    else:
        log_fail(f"Expected 403, got {resp.status_code}")
    
    # Advance to siap
    requests.patch(
        f"{BASE_URL}/orders/{order_id}/status",
        headers=auth_headers("admin_cabang"),
        json={"status": "siap"}
    )
    
    # Test 3: Admin Cuci trying to set selesai (should fail)
    log_info("Test: Admin Cuci trying to set 'selesai' (should be 403)")
    resp = requests.patch(
        f"{BASE_URL}/orders/{order_id}/status",
        headers=auth_headers("admin_cuci"),
        json={"status": "selesai"}
    )
    if resp.status_code == 403:
        log_pass("Admin Cuci correctly denied setting 'selesai' (403)")
    else:
        log_fail(f"Expected 403, got {resp.status_code}")
    
    # Test 4: Admin Cabang trying to set selesai on branch order (should fail - only customer/auto)
    log_info("Test: Admin Cabang trying to set 'selesai' on branch order (should be 403)")
    resp = requests.patch(
        f"{BASE_URL}/orders/{order_id}/status",
        headers=auth_headers("admin_cabang"),
        json={"status": "selesai"}
    )
    if resp.status_code == 403:
        log_pass("Admin Cabang correctly denied setting 'selesai' (403)")
    else:
        log_fail(f"Expected 403, got {resp.status_code}")
    
    # Test 5: Non-sequential status (create new order and try to skip)
    log_info("Test: Non-sequential status change (should be 400)")
    resp = requests.post(
        f"{BASE_URL}/orders",
        headers=auth_headers("customer"),
        json={"service": "branch", "treatment": "cuci_setrika", "branch_id": "pusat"}
    )
    skip_order_id = resp.json()["id"]
    
    # Set items and pay
    requests.patch(
        f"{BASE_URL}/orders/{skip_order_id}/items",
        headers=auth_headers("admin_cabang"),
        json={"items": [{"key": "kaos", "qty": 1}], "weight_kg": 2}
    )
    requests.post(
        f"{BASE_URL}/orders/{skip_order_id}/pay",
        headers=auth_headers("customer"),
        json={"use_points": False}
    )
    
    # Try to set siap while status is lunas (should fail - must be sequential)
    resp = requests.patch(
        f"{BASE_URL}/orders/{skip_order_id}/status",
        headers=auth_headers("admin_cabang"),
        json={"status": "siap"}
    )
    if resp.status_code == 400 and "berurutan" in resp.text.lower():
        log_pass("Non-sequential status correctly rejected (400 'Status harus berurutan')")
    else:
        log_fail(f"Expected 400 with 'berurutan', got {resp.status_code}: {resp.text}")
    
    # Test 6: Customer (non-admin) trying to set status (should fail)
    log_info("Test: Customer trying to set status (should be 403)")
    resp = requests.patch(
        f"{BASE_URL}/orders/{skip_order_id}/status",
        headers=auth_headers("customer"),
        json={"status": "dicuci"}
    )
    if resp.status_code == 403:
        log_pass("Customer correctly denied setting status (403)")
    else:
        log_fail(f"Expected 403, got {resp.status_code}")
    
    # Test 7: Admin Cabang trying to set dicuci (should fail - only cuci can)
    log_info("Test: Admin Cabang trying to set 'dicuci' (should be 403)")
    resp = requests.patch(
        f"{BASE_URL}/orders/{skip_order_id}/status",
        headers=auth_headers("admin_cabang"),
        json={"status": "dicuci"}
    )
    if resp.status_code == 403:
        log_pass("Admin Cabang correctly denied setting 'dicuci' (403)")
    else:
        log_fail(f"Expected 403, got {resp.status_code}")
    
    # Test 8: Admin Setrika trying to set dicuci (should fail)
    log_info("Test: Admin Setrika trying to set 'dicuci' (should be 403)")
    resp = requests.patch(
        f"{BASE_URL}/orders/{skip_order_id}/status",
        headers=auth_headers("admin_setrika"),
        json={"status": "dicuci"}
    )
    if resp.status_code == 403:
        log_pass("Admin Setrika correctly denied setting 'dicuci' (403)")
    else:
        log_fail(f"Expected 403, got {resp.status_code}")
    
    # Test 9: Admin Cabang trying to set items on non-diterima order (should fail)
    log_info("Test: Admin Cabang trying to set items on 'lunas' order (should be 400)")
    resp = requests.patch(
        f"{BASE_URL}/orders/{skip_order_id}/items",
        headers=auth_headers("admin_cabang"),
        json={"items": [{"key": "kaos", "qty": 5}], "weight_kg": 5}
    )
    if resp.status_code == 400:
        log_pass("Admin Cabang correctly denied setting items on non-diterima order (400)")
    else:
        log_fail(f"Expected 400, got {resp.status_code}")
    
    return True

def test_scan_endpoint():
    """Test scan endpoint"""
    log_test("SCAN ENDPOINT")
    
    # Get an existing order code
    if "branch_happy" not in test_orders:
        log_fail("No test order available for scan test")
        return False
    
    order_id = test_orders["branch_happy"]
    resp = requests.get(
        f"{BASE_URL}/orders/{order_id}",
        headers=auth_headers("customer")
    )
    order_code = resp.json()["code"]
    
    # Test 1: Scan with valid code
    log_info(f"Test: Scan with valid code '{order_code}'")
    resp = requests.post(
        f"{BASE_URL}/orders/scan",
        headers=auth_headers("admin_cuci"),
        json={"code": order_code}
    )
    if resp.status_code == 200:
        scanned_order = resp.json()
        if scanned_order["id"] == order_id:
            log_pass(f"Scan successful, returned correct order")
        else:
            log_fail(f"Scan returned wrong order")
    else:
        log_fail(f"Scan failed: {resp.status_code} - {resp.text}")
    
    # Test 2: Scan with unknown code
    log_info("Test: Scan with unknown code (should be 404)")
    resp = requests.post(
        f"{BASE_URL}/orders/scan",
        headers=auth_headers("admin_cuci"),
        json={"code": "SUCI-UNKNOWN123"}
    )
    if resp.status_code == 404:
        log_pass("Unknown code correctly returned 404")
    else:
        log_fail(f"Expected 404, got {resp.status_code}")
    
    # Test 3: Scan with empty code
    log_info("Test: Scan with empty code (should be 422)")
    resp = requests.post(
        f"{BASE_URL}/orders/scan",
        headers=auth_headers("admin_cuci"),
        json={"code": ""}
    )
    if resp.status_code == 422:
        log_pass("Empty code correctly returned 422")
    else:
        log_fail(f"Expected 422, got {resp.status_code}")
    
    return True

def test_confirm_received_negatives():
    """Test confirm-received negative cases"""
    log_test("CONFIRM-RECEIVED - Negative Tests")
    
    # Create test order
    log_info("Setup: Creating test order")
    resp = requests.post(
        f"{BASE_URL}/orders",
        headers=auth_headers("customer"),
        json={"service": "branch", "treatment": "cuci_setrika", "branch_id": "pusat"}
    )
    order_id = resp.json()["id"]
    customer_id = resp.json()["customer_id"]
    
    # Set items and pay
    requests.patch(
        f"{BASE_URL}/orders/{order_id}/items",
        headers=auth_headers("admin_cabang"),
        json={"items": [{"key": "kaos", "qty": 1}], "weight_kg": 2}
    )
    requests.post(
        f"{BASE_URL}/orders/{order_id}/pay",
        headers=auth_headers("customer"),
        json={"use_points": False}
    )
    
    # Test 1: Confirm-received when status is not siap (should fail)
    log_info("Test: Confirm-received when status is 'lunas' (should be 400)")
    resp = requests.post(
        f"{BASE_URL}/orders/{order_id}/confirm-received",
        headers=auth_headers("customer")
    )
    if resp.status_code == 400:
        log_pass("Confirm-received correctly rejected when status is not 'siap' (400)")
    else:
        log_fail(f"Expected 400, got {resp.status_code}")
    
    # Advance to siap
    requests.patch(
        f"{BASE_URL}/orders/{order_id}/status",
        headers=auth_headers("admin_cuci"),
        json={"status": "dicuci"}
    )
    requests.patch(
        f"{BASE_URL}/orders/{order_id}/status",
        headers=auth_headers("admin_setrika"),
        json={"status": "disetrika"}
    )
    requests.patch(
        f"{BASE_URL}/orders/{order_id}/status",
        headers=auth_headers("admin_cabang"),
        json={"status": "siap"}
    )
    
    # Test 2: Confirm-received by different customer (should fail)
    # Login as super admin (different user)
    log_info("Test: Confirm-received by non-owner (should be 403)")
    resp = requests.post(
        f"{BASE_URL}/orders/{order_id}/confirm-received",
        headers=auth_headers("super_admin")
    )
    if resp.status_code == 403:
        log_pass("Confirm-received correctly rejected for non-owner (403)")
    else:
        log_fail(f"Expected 403, got {resp.status_code}")
    
    return True

def test_rewash_complaint():
    """Test rewash/complaint endpoint"""
    log_test("REWASH / COMPLAINT")
    
    # Create and complete an order
    log_info("Setup: Creating and completing order to 'selesai'")
    resp = requests.post(
        f"{BASE_URL}/orders",
        headers=auth_headers("customer"),
        json={"service": "branch", "treatment": "cuci_setrika", "branch_id": "pusat"}
    )
    order_id = resp.json()["id"]
    test_orders["rewash_test"] = order_id
    
    # Set items, pay, and advance to selesai
    requests.patch(
        f"{BASE_URL}/orders/{order_id}/items",
        headers=auth_headers("admin_cabang"),
        json={"items": [{"key": "kaos", "qty": 2}], "weight_kg": 3}
    )
    requests.post(
        f"{BASE_URL}/orders/{order_id}/pay",
        headers=auth_headers("customer"),
        json={"use_points": False}
    )
    requests.patch(
        f"{BASE_URL}/orders/{order_id}/status",
        headers=auth_headers("admin_cuci"),
        json={"status": "dicuci"}
    )
    requests.patch(
        f"{BASE_URL}/orders/{order_id}/status",
        headers=auth_headers("admin_setrika"),
        json={"status": "disetrika"}
    )
    requests.patch(
        f"{BASE_URL}/orders/{order_id}/status",
        headers=auth_headers("admin_cabang"),
        json={"status": "siap"}
    )
    requests.post(
        f"{BASE_URL}/orders/{order_id}/confirm-received",
        headers=auth_headers("customer")
    )
    
    # Test 1: Rewash on completed order
    log_info("Test: Rewash on 'selesai' order")
    resp = requests.post(
        f"{BASE_URL}/orders/{order_id}/rewash",
        headers=auth_headers("customer"),
        json={"reason": "Masih ada noda", "photos": []}
    )
    if resp.status_code != 200:
        log_fail(f"Rewash failed: {resp.status_code} - {resp.text}")
        return False
    
    order = resp.json()
    if order["status"] != "dicuci":
        log_fail(f"Expected status 'dicuci' after rewash, got '{order['status']}'")
        return False
    if len(order["complaints"]) != 1:
        log_fail(f"Expected 1 complaint, got {len(order['complaints'])}")
        return False
    if order["rewash_count"] != 1:
        log_fail(f"Expected rewash_count=1, got {order['rewash_count']}")
        return False
    if not order["rewash_active"]:
        log_fail(f"Expected rewash_active=true, got {order['rewash_active']}")
        return False
    if order["rating"] is not None:
        log_fail(f"Expected rating=null after rewash, got {order['rating']}")
        return False
    log_pass(f"Rewash successful: status='dicuci', complaints={len(order['complaints'])}, rewash_count={order['rewash_count']}, rewash_active=true, rating=null")
    
    # Test 2: Rewash on diterima order (should fail)
    log_info("Test: Rewash on 'diterima' order (should be 400)")
    resp = requests.post(
        f"{BASE_URL}/orders",
        headers=auth_headers("customer"),
        json={"service": "branch", "treatment": "cuci_setrika", "branch_id": "pusat"}
    )
    new_order_id = resp.json()["id"]
    
    resp = requests.post(
        f"{BASE_URL}/orders/{new_order_id}/rewash",
        headers=auth_headers("customer"),
        json={"reason": "Test", "photos": []}
    )
    if resp.status_code == 400:
        log_pass("Rewash correctly rejected on 'diterima' order (400)")
    else:
        log_fail(f"Expected 400, got {resp.status_code}")
    
    # Test 3: Rewash by non-owner (should fail)
    log_info("Test: Rewash by non-owner (should be 403)")
    resp = requests.post(
        f"{BASE_URL}/orders/{order_id}/rewash",
        headers=auth_headers("super_admin"),
        json={"reason": "Test", "photos": []}
    )
    if resp.status_code == 403:
        log_pass("Rewash correctly rejected for non-owner (403)")
    else:
        log_fail(f"Expected 403, got {resp.status_code}")
    
    # Test 4: Continue flow after rewash
    log_info("Test: Continue flow after rewash - Admin Setrika sets 'disetrika'")
    resp = requests.patch(
        f"{BASE_URL}/orders/{order_id}/status",
        headers=auth_headers("admin_setrika"),
        json={"status": "disetrika"}
    )
    if resp.status_code == 200:
        log_pass("Admin Setrika can set 'disetrika' after rewash")
    else:
        log_fail(f"Admin Setrika failed to set 'disetrika': {resp.status_code} - {resp.text}")
    
    return True

def test_pickup_courier_flow():
    """Test pickup courier flow"""
    log_test("PICKUP COURIER FLOW")
    
    # Create pickup order
    log_info("Setup: Creating pickup order")
    resp = requests.post(
        f"{BASE_URL}/orders",
        headers=auth_headers("customer"),
        json={"service": "pickup", "treatment": "cuci_setrika", "address": "Jl. Test No. 1"}
    )
    if resp.status_code != 200:
        log_fail(f"Create pickup order failed: {resp.status_code} - {resp.text}")
        return False
    
    order_id = resp.json()["id"]
    test_orders["pickup_test"] = order_id
    log_pass(f"Pickup order created: {order_id[:8]}")
    
    # Set items, pay, and advance to siap
    requests.patch(
        f"{BASE_URL}/orders/{order_id}/items",
        headers=auth_headers("admin_cabang"),
        json={"items": [{"key": "kaos", "qty": 2}], "weight_kg": 3}
    )
    requests.post(
        f"{BASE_URL}/orders/{order_id}/pay",
        headers=auth_headers("customer"),
        json={"use_points": False}
    )
    requests.patch(
        f"{BASE_URL}/orders/{order_id}/status",
        headers=auth_headers("admin_cuci"),
        json={"status": "dicuci"}
    )
    requests.patch(
        f"{BASE_URL}/orders/{order_id}/status",
        headers=auth_headers("admin_setrika"),
        json={"status": "disetrika"}
    )
    requests.patch(
        f"{BASE_URL}/orders/{order_id}/status",
        headers=auth_headers("admin_cabang"),
        json={"status": "siap"}
    )
    
    # Test 1: Admin Kurir sets selesai on pickup order (should succeed)
    log_info("Test: Admin Kurir sets 'selesai' on pickup order (should succeed)")
    resp = requests.patch(
        f"{BASE_URL}/orders/{order_id}/status",
        headers=auth_headers("admin_antar"),
        json={"status": "selesai"}
    )
    if resp.status_code == 200:
        order = resp.json()
        if order["status"] == "selesai":
            log_pass("Admin Kurir successfully set 'selesai' on pickup order")
        else:
            log_fail(f"Expected status 'selesai', got '{order['status']}'")
    else:
        log_fail(f"Admin Kurir failed to set 'selesai': {resp.status_code} - {resp.text}")
    
    # Test 2: Admin Kurir trying to set selesai on branch order (should fail)
    log_info("Test: Admin Kurir sets 'selesai' on branch order (should be 403)")
    # Create branch order and advance to siap
    resp = requests.post(
        f"{BASE_URL}/orders",
        headers=auth_headers("customer"),
        json={"service": "branch", "treatment": "cuci_setrika", "branch_id": "pusat"}
    )
    branch_order_id = resp.json()["id"]
    
    requests.patch(
        f"{BASE_URL}/orders/{branch_order_id}/items",
        headers=auth_headers("admin_cabang"),
        json={"items": [{"key": "kaos", "qty": 1}], "weight_kg": 2}
    )
    requests.post(
        f"{BASE_URL}/orders/{branch_order_id}/pay",
        headers=auth_headers("customer"),
        json={"use_points": False}
    )
    requests.patch(
        f"{BASE_URL}/orders/{branch_order_id}/status",
        headers=auth_headers("admin_cuci"),
        json={"status": "dicuci"}
    )
    requests.patch(
        f"{BASE_URL}/orders/{branch_order_id}/status",
        headers=auth_headers("admin_setrika"),
        json={"status": "disetrika"}
    )
    requests.patch(
        f"{BASE_URL}/orders/{branch_order_id}/status",
        headers=auth_headers("admin_cabang"),
        json={"status": "siap"}
    )
    
    # Try to set selesai with admin_antar (should fail for branch orders)
    resp = requests.patch(
        f"{BASE_URL}/orders/{branch_order_id}/status",
        headers=auth_headers("admin_antar"),
        json={"status": "selesai"}
    )
    # Note: Based on ROLE_CAN_SET, admin_antar CAN set selesai, but the requirement says
    # branch orders should close via customer/auto. Let me check if there's additional logic...
    # Looking at the code, admin_antar is allowed to set selesai in ROLE_CAN_SET.
    # The requirement might be a business rule not yet implemented in code.
    if resp.status_code == 403:
        log_pass("Admin Kurir correctly denied setting 'selesai' on branch order (403)")
    elif resp.status_code == 200:
        log_fail("Admin Kurir was able to set 'selesai' on branch order (should be 403 per requirements)")
    else:
        log_fail(f"Unexpected status code: {resp.status_code}")
    
    return True

def test_count_check_feature():
    """Test count-check masuk vs keluar feature (Scenario A-F)"""
    log_test("COUNT-CHECK FEATURE - Complete Test Suite")
    
    # Scenario A: Create order and set items (snapshot MASUK)
    log_info("Scenario A: Create order and set items (snapshot MASUK)")
    
    # Create order as customer
    resp = requests.post(
        f"{BASE_URL}/orders",
        headers=auth_headers("customer"),
        json={"service": "branch", "treatment": "cuci_setrika", "branch_id": "pusat"}
    )
    if resp.status_code != 200:
        log_fail(f"Create order failed: {resp.status_code} - {resp.text}")
        return False
    order = resp.json()
    order_id = order["id"]
    order_code = order["code"]
    log_pass(f"Order created: {order_code}")
    
    # Set items as admin_cabang (this creates the MASUK snapshot)
    resp = requests.patch(
        f"{BASE_URL}/orders/{order_id}/items",
        headers=auth_headers("admin_cabang"),
        json={
            "items": [
                {"key": "kemeja", "qty": 2},
                {"key": "celana", "qty": 3}
            ],
            "weight_kg": 3.5
        }
    )
    if resp.status_code != 200:
        log_fail(f"Set items failed: {resp.status_code} - {resp.text}")
        return False
    
    order_data = resp.json()
    
    # Verify items_set_at and items_set_by are present
    if not order_data.get("items_set_at"):
        log_fail("items_set_at not set after set_items")
        return False
    if not order_data.get("items_set_by"):
        log_fail("items_set_by not set after set_items")
        return False
    log_pass(f"items_set_at: {order_data['items_set_at']}, items_set_by: {order_data['items_set_by']}")
    
    # Verify last_count_check shows stage "masuk"
    if not order_data.get("last_count_check"):
        log_fail("last_count_check not present after set_items")
        return False
    if order_data["last_count_check"]["stage"] != "masuk":
        log_fail(f"Expected stage 'masuk', got '{order_data['last_count_check']['stage']}'")
        return False
    if not order_data["last_count_check"]["match"]:
        log_fail("Expected match=true for masuk snapshot")
        return False
    log_pass(f"MASUK snapshot created: stage={order_data['last_count_check']['stage']}, match={order_data['last_count_check']['match']}")
    
    # Scenario B: Count-check with SAME quantities (match=true)
    log_info("Scenario B: Count-check with SAME quantities")
    
    resp = requests.post(
        f"{BASE_URL}/orders/{order_id}/count-check",
        headers=auth_headers("admin_cabang"),
        json={
            "items": [
                {"key": "kemeja", "qty": 2},
                {"key": "celana", "qty": 3}
            ],
            "stage": "keluar"
        }
    )
    if resp.status_code != 200:
        log_fail(f"Count-check failed: {resp.status_code} - {resp.text}")
        return False
    
    check_result = resp.json()
    if not check_result.get("match"):
        log_fail(f"Expected match=true, got {check_result.get('match')}")
        return False
    if check_result.get("diffs"):
        log_fail(f"Expected empty diffs, got {check_result.get('diffs')}")
        return False
    
    check_record = check_result.get("check", {})
    if check_record.get("checked_by") != "Admin Cabang":
        log_fail(f"Expected checked_by='Admin Cabang', got '{check_record.get('checked_by')}'")
        return False
    if check_record.get("role_label") != "Admin Cabang":
        log_fail(f"Expected role_label='Admin Cabang', got '{check_record.get('role_label')}'")
        return False
    if not check_record.get("created_at"):
        log_fail("created_at not present in check record")
        return False
    
    log_pass(f"Count-check MATCH: match=true, diffs=[], checked_by={check_record['checked_by']}, role_label={check_record['role_label']}")
    
    # Scenario C: Count-check with DIFFERENT quantities (match=false)
    log_info("Scenario C: Count-check with DIFFERENT quantities")
    
    # Test 1: Reduce celana from 3 to 2
    resp = requests.post(
        f"{BASE_URL}/orders/{order_id}/count-check",
        headers=auth_headers("admin_cabang"),
        json={
            "items": [
                {"key": "kemeja", "qty": 2},
                {"key": "celana", "qty": 2}  # Changed from 3 to 2
            ],
            "stage": "keluar"
        }
    )
    if resp.status_code != 200:
        log_fail(f"Count-check failed: {resp.status_code} - {resp.text}")
        return False
    
    check_result = resp.json()
    if check_result.get("match"):
        log_fail(f"Expected match=false, got {check_result.get('match')}")
        return False
    
    diffs = check_result.get("diffs", [])
    if len(diffs) != 1:
        log_fail(f"Expected 1 diff, got {len(diffs)}")
        return False
    
    diff = diffs[0]
    if diff["key"] != "celana":
        log_fail(f"Expected diff key 'celana', got '{diff['key']}'")
        return False
    if diff["expected"] != 3:
        log_fail(f"Expected expected=3, got {diff['expected']}")
        return False
    if diff["actual"] != 2:
        log_fail(f"Expected actual=2, got {diff['actual']}")
        return False
    if diff["diff"] != -1:
        log_fail(f"Expected diff=-1, got {diff['diff']}")
        return False
    
    log_pass(f"Count-check MISMATCH (reduce): match=false, diffs=[{{key:celana, expected:3, actual:2, diff:-1}}]")
    
    # Test 2: Increase kemeja from 2 to 3
    resp = requests.post(
        f"{BASE_URL}/orders/{order_id}/count-check",
        headers=auth_headers("admin_cabang"),
        json={
            "items": [
                {"key": "kemeja", "qty": 3},  # Changed from 2 to 3
                {"key": "celana", "qty": 3}
            ],
            "stage": "keluar"
        }
    )
    if resp.status_code != 200:
        log_fail(f"Count-check failed: {resp.status_code} - {resp.text}")
        return False
    
    check_result = resp.json()
    if check_result.get("match"):
        log_fail(f"Expected match=false, got {check_result.get('match')}")
        return False
    
    diffs = check_result.get("diffs", [])
    if len(diffs) != 1:
        log_fail(f"Expected 1 diff, got {len(diffs)}")
        return False
    
    diff = diffs[0]
    if diff["key"] != "kemeja":
        log_fail(f"Expected diff key 'kemeja', got '{diff['key']}'")
        return False
    if diff["expected"] != 2:
        log_fail(f"Expected expected=2, got {diff['expected']}")
        return False
    if diff["actual"] != 3:
        log_fail(f"Expected actual=3, got {diff['actual']}")
        return False
    if diff["diff"] != 1:
        log_fail(f"Expected diff=1, got {diff['diff']}")
        return False
    
    log_pass(f"Count-check MISMATCH (increase): match=false, diffs=[{{key:kemeja, expected:2, actual:3, diff:1}}]")
    
    # Test 3: Add extra item not in masuk (kaos)
    resp = requests.post(
        f"{BASE_URL}/orders/{order_id}/count-check",
        headers=auth_headers("admin_cabang"),
        json={
            "items": [
                {"key": "kemeja", "qty": 2},
                {"key": "celana", "qty": 3},
                {"key": "kaos", "qty": 1}  # Extra item
            ],
            "stage": "keluar"
        }
    )
    if resp.status_code != 200:
        log_fail(f"Count-check failed: {resp.status_code} - {resp.text}")
        return False
    
    check_result = resp.json()
    if check_result.get("match"):
        log_fail(f"Expected match=false, got {check_result.get('match')}")
        return False
    
    diffs = check_result.get("diffs", [])
    if len(diffs) != 1:
        log_fail(f"Expected 1 diff (kaos), got {len(diffs)}")
        return False
    
    diff = diffs[0]
    if diff["key"] != "kaos":
        log_fail(f"Expected diff key 'kaos', got '{diff['key']}'")
        return False
    if diff["expected"] != 0:
        log_fail(f"Expected expected=0 (not in masuk), got {diff['expected']}")
        return False
    if diff["actual"] != 1:
        log_fail(f"Expected actual=1, got {diff['actual']}")
        return False
    if diff["diff"] != 1:
        log_fail(f"Expected diff=1, got {diff['diff']}")
        return False
    
    log_pass(f"Count-check MISMATCH (extra item): match=false, diffs=[{{key:kaos, expected:0, actual:1, diff:1}}]")
    
    # Test 4: Remove one item completely (celana missing)
    resp = requests.post(
        f"{BASE_URL}/orders/{order_id}/count-check",
        headers=auth_headers("admin_cabang"),
        json={
            "items": [
                {"key": "kemeja", "qty": 2}
                # celana missing
            ],
            "stage": "keluar"
        }
    )
    if resp.status_code != 200:
        log_fail(f"Count-check failed: {resp.status_code} - {resp.text}")
        return False
    
    check_result = resp.json()
    if check_result.get("match"):
        log_fail(f"Expected match=false, got {check_result.get('match')}")
        return False
    
    diffs = check_result.get("diffs", [])
    if len(diffs) != 1:
        log_fail(f"Expected 1 diff (celana), got {len(diffs)}")
        return False
    
    diff = diffs[0]
    if diff["key"] != "celana":
        log_fail(f"Expected diff key 'celana', got '{diff['key']}'")
        return False
    if diff["expected"] != 3:
        log_fail(f"Expected expected=3, got {diff['expected']}")
        return False
    if diff["actual"] != 0:
        log_fail(f"Expected actual=0 (missing), got {diff['actual']}")
        return False
    if diff["diff"] != -3:
        log_fail(f"Expected diff=-3, got {diff['diff']}")
        return False
    
    log_pass(f"Count-check MISMATCH (missing item): match=false, diffs=[{{key:celana, expected:3, actual:0, diff:-3}}]")
    
    # Verify notification was sent to customer
    log_info("Verifying notification sent to customer for mismatch")
    resp = requests.get(
        f"{BASE_URL}/notifications",
        headers=auth_headers("customer")
    )
    if resp.status_code != 200:
        log_fail(f"Get notifications failed: {resp.status_code} - {resp.text}")
        return False
    
    notif_data = resp.json()
    notifications = notif_data.get("items", [])
    mismatch_notif = None
    for notif in notifications:
        if "Selisih jumlah item terdeteksi" in notif.get("title", ""):
            mismatch_notif = notif
            break
    
    if not mismatch_notif:
        log_fail("No 'Selisih jumlah item terdeteksi' notification found for customer")
        return False
    
    log_pass(f"Notification sent to customer: '{mismatch_notif['title']}'")
    
    # Scenario D: Validation errors
    log_info("Scenario D: Validation errors")
    
    # D1: Unknown item key
    resp = requests.post(
        f"{BASE_URL}/orders/{order_id}/count-check",
        headers=auth_headers("admin_cabang"),
        json={
            "items": [
                {"key": "unknown_item", "qty": 1}
            ],
            "stage": "keluar"
        }
    )
    if resp.status_code != 422:
        log_fail(f"Expected 422 for unknown item, got {resp.status_code}")
        return False
    log_pass("Unknown item key correctly rejected with 422")
    
    # D2: Count-check on order without items (create new order)
    resp = requests.post(
        f"{BASE_URL}/orders",
        headers=auth_headers("customer"),
        json={"service": "branch", "treatment": "cuci_setrika", "branch_id": "pusat"}
    )
    new_order_id = resp.json()["id"]
    
    resp = requests.post(
        f"{BASE_URL}/orders/{new_order_id}/count-check",
        headers=auth_headers("admin_cabang"),
        json={
            "items": [{"key": "kemeja", "qty": 1}],
            "stage": "keluar"
        }
    )
    if resp.status_code != 400:
        log_fail(f"Expected 400 for order without items, got {resp.status_code}")
        return False
    if "Item masuk belum diinput" not in resp.text:
        log_fail(f"Expected error message about items not set, got: {resp.text}")
        return False
    log_pass("Count-check on order without items correctly rejected with 400")
    
    # D3: Customer access (should be 403)
    resp = requests.post(
        f"{BASE_URL}/orders/{order_id}/count-check",
        headers=auth_headers("customer"),
        json={
            "items": [{"key": "kemeja", "qty": 2}],
            "stage": "keluar"
        }
    )
    if resp.status_code != 403:
        log_fail(f"Expected 403 for customer access, got {resp.status_code}")
        return False
    log_pass("Customer access correctly rejected with 403")
    
    # D4: No token (should be 401 or 403)
    resp = requests.post(
        f"{BASE_URL}/orders/{order_id}/count-check",
        json={
            "items": [{"key": "kemeja", "qty": 2}],
            "stage": "keluar"
        }
    )
    if resp.status_code not in [401, 403]:
        log_fail(f"Expected 401 or 403 for no token, got {resp.status_code}")
        return False
    log_pass(f"No token correctly rejected with {resp.status_code}")
    
    # Scenario E: GET /orders/{id} verification
    log_info("Scenario E: GET /orders/{id} verification")
    
    resp = requests.get(
        f"{BASE_URL}/orders/{order_id}",
        headers=auth_headers("admin_cabang")
    )
    if resp.status_code != 200:
        log_fail(f"Get order failed: {resp.status_code} - {resp.text}")
        return False
    
    order_data = resp.json()
    
    # Verify items_set_at
    if not order_data.get("items_set_at"):
        log_fail("items_set_at not present in GET /orders/{id}")
        return False
    log_pass(f"items_set_at present: {order_data['items_set_at']}")
    
    # Verify items_set_by
    if not order_data.get("items_set_by"):
        log_fail("items_set_by not present in GET /orders/{id}")
        return False
    log_pass(f"items_set_by present: {order_data['items_set_by']}")
    
    # Verify item_checks array (should have 1 masuk + multiple keluar)
    item_checks = order_data.get("item_checks", [])
    if not item_checks:
        log_fail("item_checks array is empty")
        return False
    
    masuk_checks = [c for c in item_checks if c["stage"] == "masuk"]
    keluar_checks = [c for c in item_checks if c["stage"] == "keluar"]
    
    if len(masuk_checks) != 1:
        log_fail(f"Expected 1 masuk check, got {len(masuk_checks)}")
        return False
    if len(keluar_checks) < 1:
        log_fail(f"Expected at least 1 keluar check, got {len(keluar_checks)}")
        return False
    
    log_pass(f"item_checks array present: {len(masuk_checks)} masuk + {len(keluar_checks)} keluar checks")
    
    # Verify last_count_check is the most recent
    last_check = order_data.get("last_count_check")
    if not last_check:
        log_fail("last_count_check not present")
        return False
    if last_check["id"] != item_checks[-1]["id"]:
        log_fail("last_count_check is not the most recent check")
        return False
    log_pass(f"last_count_check is the most recent: stage={last_check['stage']}")
    
    # Scenario F: Regression tests
    log_info("Scenario F: Regression tests")
    
    # F1: PATCH /orders/{id}/status still rejects invalid transitions
    # Create a fresh order for regression testing
    resp = requests.post(
        f"{BASE_URL}/orders",
        headers=auth_headers("customer"),
        json={"service": "branch", "treatment": "cuci_setrika", "branch_id": "pusat"}
    )
    regression_order_id = resp.json()["id"]
    
    # Set items and pay
    requests.patch(
        f"{BASE_URL}/orders/{regression_order_id}/items",
        headers=auth_headers("admin_cabang"),
        json={"items": [{"key": "kaos", "qty": 1}], "weight_kg": 1}
    )
    requests.post(
        f"{BASE_URL}/orders/{regression_order_id}/pay",
        headers=auth_headers("customer"),
        json={"use_points": False}
    )
    
    # Try to skip from lunas to disetrika (should fail)
    resp = requests.patch(
        f"{BASE_URL}/orders/{regression_order_id}/status",
        headers=auth_headers("admin_setrika"),
        json={"status": "disetrika"}
    )
    if resp.status_code != 400:
        log_fail(f"Expected 400 for invalid status transition, got {resp.status_code}")
        return False
    if "Status harus berurutan" not in resp.text:
        log_fail(f"Expected 'Status harus berurutan' error, got: {resp.text}")
        return False
    log_pass("Invalid status transition correctly rejected with 400")
    
    # F2: Role enforcement still works
    # Try admin_cuci setting disetrika (should fail)
    requests.patch(
        f"{BASE_URL}/orders/{regression_order_id}/status",
        headers=auth_headers("admin_cuci"),
        json={"status": "dicuci"}
    )
    
    resp = requests.patch(
        f"{BASE_URL}/orders/{regression_order_id}/status",
        headers=auth_headers("admin_cuci"),
        json={"status": "disetrika"}
    )
    if resp.status_code != 403:
        log_fail(f"Expected 403 for wrong role, got {resp.status_code}")
        return False
    log_pass("Role enforcement still working (403 for wrong role)")
    
    # F3: POST /orders/scan still works
    resp = requests.post(
        f"{BASE_URL}/orders/scan",
        headers=auth_headers("admin_cuci"),
        json={"code": order_code}
    )
    if resp.status_code != 200:
        log_fail(f"Scan endpoint failed: {resp.status_code} - {resp.text}")
        return False
    scanned_order = resp.json()
    if scanned_order["id"] != order_id:
        log_fail(f"Scan returned wrong order: expected {order_id}, got {scanned_order['id']}")
        return False
    log_pass(f"Scan endpoint still working: found order {order_code}")
    
    log_pass("ALL COUNT-CHECK SCENARIOS PASSED ✓")
    return True

def test_demo_order_suci_0cce3a():
    """Test using demo order SUCI-0CCE3A if it exists"""
    log_test("DEMO ORDER TEST - SUCI-0CCE3A")
    
    # Try to scan the demo order
    resp = requests.post(
        f"{BASE_URL}/orders/scan",
        headers=auth_headers("admin_cabang"),
        json={"code": "SUCI-0CCE3A"}
    )
    
    if resp.status_code != 200:
        log_info("Demo order SUCI-0CCE3A not found, skipping demo order test")
        return True
    
    order = resp.json()
    order_id = order["id"]
    log_pass(f"Demo order found: {order['code']}, status: {order['status']}")
    
    # Verify it has items set
    if not order.get("items"):
        log_fail("Demo order has no items set")
        return False
    
    items_str = ", ".join([f"{it['name']} x{it['qty']}" for it in order["items"]])
    log_pass(f"Demo order items: {items_str}")
    
    # Try count-check with matching quantities
    items_for_check = [{"key": it["key"], "qty": it["qty"]} for it in order["items"]]
    resp = requests.post(
        f"{BASE_URL}/orders/{order_id}/count-check",
        headers=auth_headers("admin_cabang"),
        json={"items": items_for_check, "stage": "keluar"}
    )
    
    if resp.status_code != 200:
        log_fail(f"Count-check on demo order failed: {resp.status_code} - {resp.text}")
        return False
    
    result = resp.json()
    if not result.get("match"):
        log_fail(f"Expected match=true for demo order, got {result.get('match')}")
        return False
    
    log_pass("Count-check on demo order: match=true")
    return True

def main():
    print(f"\n{Colors.BLUE}{'='*70}{Colors.RESET}")
    print(f"{Colors.BLUE}Loundry Suci Backend API Tests - Count-Check Feature{Colors.RESET}")
    print(f"{Colors.BLUE}{'='*70}{Colors.RESET}")
    
    try:
        # Login all roles
        test_login_all_roles()
        
        # Run count-check test scenarios
        test_count_check_feature()
        
        # Test demo order if available
        test_demo_order_suci_0cce3a()
        
        # Run other test scenarios
        test_full_happy_path_branch()
        test_role_enforcement()
        test_scan_endpoint()
        test_confirm_received_negatives()
        test_rewash_complaint()
        test_pickup_courier_flow()
        
        print(f"\n{Colors.GREEN}{'='*70}{Colors.RESET}")
        print(f"{Colors.GREEN}All tests completed!{Colors.RESET}")
        print(f"{Colors.GREEN}{'='*70}{Colors.RESET}\n")
        
    except Exception as e:
        print(f"\n{Colors.RED}Test suite failed with error: {e}{Colors.RESET}\n")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
