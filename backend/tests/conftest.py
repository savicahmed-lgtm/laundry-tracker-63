"""Shared fixtures — reset demo customer points before tests."""
import os
import pytest
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv("/app/backend/.env")


@pytest.fixture(scope="session", autouse=True)
def reset_demo_state():
    """Ensure demo customer has >=30 points before session begins so redemption tests work."""
    mongo = MongoClient(os.environ["MONGO_URL"])
    db = mongo[os.environ["DB_NAME"]]
    db.users.update_one({"phone": "081211112222"}, {"$set": {"points": 30}})
    yield
    mongo.close()
