from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional
import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, roc_auc_score
import joblib
import os
from datetime import datetime
from pymongo import MongoClient
from bson import ObjectId
from fastapi.middleware.cors import CORSMiddleware


app = FastAPI(title="Hospital No-Show Prediction Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://hospital-app-self-theta.vercel.app",
        "http://localhost:5173",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global model reference
model = None
model_metadata = {}

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://admin:hospital_secure_2024@localhost:27017/hospital_db?authSource=admin")
MODEL_PATH = "/app/models/noshow_model.pkl"

# Diagnostic at startup: log which host (no password) and whether env var was used
_uri_host = MONGODB_URI.split('@')[-1].split('/')[0].split('?')[0] if '@' in MONGODB_URI else MONGODB_URI
print(f"[startup] MONGODB_URI host: {_uri_host}", flush=True)
print(f"[startup] MONGODB_URI is from env: {os.getenv('MONGODB_URI') is not None}", flush=True)


class PredictionRequest(BaseModel):
    appointmentId: str
    patientId: str
    doctorId: str
    departmentId: str
    date: str
    startTime: str
    type: str


class PredictionResponse(BaseModel):
    appointmentId: str
    riskScore: float
    riskLevel: str
    features: dict


class TrainResponse(BaseModel):
    message: str
    accuracy: float
    auc_score: float
    feature_importances: dict


def get_db():
    """
    Resolve the database in this order:
      1. Database name in the MONGODB_URI path (preferred — single source of truth)
      2. MONGODB_DB env var override
      3. Hardcoded fallback 'medbook'
    """
    client = MongoClient(MONGODB_URI)
    try:
        db = client.get_default_database()
        if db is not None:
            return db
    except Exception:
        pass
    return client[os.getenv("MONGODB_DB", "medbook")]


def extract_features(patient_data: dict, appointment_data: dict) -> dict:
    """Extract features for prediction from patient and appointment data."""
    now = datetime.now()
    appt_date = datetime.strptime(appointment_data.get("date", ""), "%Y-%m-%d") if isinstance(appointment_data.get("date"), str) else appointment_data.get("date", now)

    # Lead time (days between booking and appointment)
    lead_time = (appt_date - now).days if appt_date > now else 0

    # Time features
    hour = int(appointment_data.get("startTime", "09:00").split(":")[0])
    day_of_week = appt_date.weekday()

    # Patient history features
    total_appointments = patient_data.get("totalAppointments", 0)
    no_show_count = patient_data.get("noShowCount", 0)
    no_show_rate = no_show_count / max(total_appointments, 1)
    attended = patient_data.get("attendedAppointments", 0)
    cancelled = patient_data.get("cancelledAppointments", 0)

    # Age
    dob = patient_data.get("dateOfBirth")
    age = 30  # default
    if dob:
        if isinstance(dob, str):
            dob = datetime.strptime(dob[:10], "%Y-%m-%d")
        age = (now - dob).days // 365

    # Appointment type encoding
    type_map = {"regular": 0, "follow_up": 1, "walk_in": 2, "emergency": 3, "consultation": 4, "procedure": 5}
    appt_type = type_map.get(appointment_data.get("type", "regular"), 0)

    # Gender encoding
    gender_map = {"male": 0, "female": 1, "other": 2}
    gender = gender_map.get(patient_data.get("gender", "male"), 0)

    features = {
        "lead_time_days": lead_time,
        "hour_of_day": hour,
        "day_of_week": day_of_week,
        "is_morning": 1 if hour < 12 else 0,
        "is_monday": 1 if day_of_week == 0 else 0,
        "is_friday": 1 if day_of_week == 4 else 0,
        "total_appointments": total_appointments,
        "no_show_count": no_show_count,
        "no_show_rate": no_show_rate,
        "attended_count": attended,
        "cancelled_count": cancelled,
        "age": age,
        "gender": gender,
        "appointment_type": appt_type,
        "is_new_patient": 1 if total_appointments == 0 else 0,
    }

    return features


@app.on_event("startup")
async def load_model():
    global model, model_metadata
    if os.path.exists(MODEL_PATH):
        model = joblib.load(MODEL_PATH)
        model_metadata = {
            "loaded_at": datetime.now().isoformat(),
            "model_type": "GradientBoostingClassifier",
        }
        print(f"Model loaded from {MODEL_PATH}")
    else:
        print("No pre-trained model found. Use /train endpoint to train a new model.")


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "model_loaded": model is not None,
        "model_metadata": model_metadata,
    }


@app.post("/predict", response_model=PredictionResponse)
async def predict(request: PredictionRequest):
    """Predict no-show probability for an appointment."""
    try:
        db = get_db()

        # Get patient data
        patient = db.patients.find_one({"_id": ObjectId(request.patientId)})
        if not patient:
            # Return moderate risk for unknown patients
            return PredictionResponse(
                appointmentId=request.appointmentId,
                riskScore=0.3,
                riskLevel="medium",
                features={"note": "Patient not found, using default risk"},
            )

        # Extract features
        features = extract_features(
            patient,
            {
                "date": request.date,
                "startTime": request.startTime,
                "type": request.type,
            },
        )

        if model is not None:
            # Use trained model
            feature_array = np.array([list(features.values())])
            probability = model.predict_proba(feature_array)[0][1]  # probability of no-show
        else:
            # Heuristic fallback if no model trained yet
            probability = calculate_heuristic_risk(features)

        risk_level = "low" if probability < 0.3 else "medium" if probability < 0.6 else "high"

        return PredictionResponse(
            appointmentId=request.appointmentId,
            riskScore=round(float(probability), 4),
            riskLevel=risk_level,
            features=features,
        )

    except Exception as e:
        print(f"Prediction error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


def calculate_heuristic_risk(features: dict) -> float:
    """Heuristic risk calculation when no ML model is available."""
    score = 0.15  # base risk

    # History-based factors (strongest predictors per thesis)
    if features["no_show_rate"] > 0.3:
        score += 0.25
    elif features["no_show_rate"] > 0.15:
        score += 0.12

    if features["no_show_count"] >= 3:
        score += 0.15

    # Lead time factor
    if features["lead_time_days"] > 14:
        score += 0.1
    elif features["lead_time_days"] > 7:
        score += 0.05

    # Time factors
    if features["is_monday"] or features["is_friday"]:
        score += 0.05

    if features["hour_of_day"] >= 16:
        score += 0.05

    # New patient risk
    if features["is_new_patient"]:
        score += 0.08

    # Age factor
    if features["age"] < 30:
        score += 0.05

    return min(score, 0.95)


@app.post("/train", response_model=TrainResponse)
async def train_model():
    """Train the no-show prediction model using historical data."""
    global model, model_metadata

    try:
        db = get_db()

        # Fetch historical appointments with outcomes
        appointments = list(db.appointments.find({
            "status": {"$in": ["completed", "no_show"]},
        }))
        print(
            f"[train] Found {len(appointments)} eligible appointments in db '{db.name}' "
            f"from collection 'appointments'. Total docs in collection: "
            f"{db.appointments.estimated_document_count()}",
            flush=True,
        )

        if len(appointments) < 50:
            raise HTTPException(
                status_code=400,
                detail=f"Not enough training data. Found {len(appointments)} appointments, need at least 50.",
            )

        # Build training dataset
        rows = []
        for appt in appointments:
            patient = db.patients.find_one({"_id": appt.get("patientId")})
            if not patient:
                continue

            features = extract_features(patient, appt)
            features["no_show"] = 1 if appt["status"] == "no_show" else 0
            rows.append(features)

        df = pd.DataFrame(rows)
        if len(df) < 50:
            raise HTTPException(status_code=400, detail="Not enough valid training samples")

        X = df.drop("no_show", axis=1)
        y = df["no_show"]

        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

        # Train Gradient Boosting model
        model = GradientBoostingClassifier(
            n_estimators=100,
            max_depth=4,
            learning_rate=0.1,
            min_samples_split=10,
            min_samples_leaf=5,
            random_state=42,
        )
        model.fit(X_train, y_train)

        # Evaluate
        y_pred = model.predict(X_test)
        y_prob = model.predict_proba(X_test)[:, 1]
        accuracy = model.score(X_test, y_test)

        try:
            auc = roc_auc_score(y_test, y_prob)
        except ValueError:
            auc = 0.0

        # Feature importances
        importances = dict(zip(X.columns, model.feature_importances_))
        importances = {k: round(float(v), 4) for k, v in sorted(importances.items(), key=lambda x: -x[1])}

        # Save model
        os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
        joblib.dump(model, MODEL_PATH)

        model_metadata = {
            "trained_at": datetime.now().isoformat(),
            "model_type": "GradientBoostingClassifier",
            "training_samples": len(X_train),
            "test_samples": len(X_test),
            "accuracy": round(accuracy, 4),
            "auc_score": round(auc, 4),
        }

        # Store metadata in DB
        db.model_metadata.insert_one({
            **model_metadata,
            "feature_importances": importances,
            "created_at": datetime.now(),
        })

        return TrainResponse(
            message="Model trained successfully",
            accuracy=round(accuracy, 4),
            auc_score=round(auc, 4),
            feature_importances=importances,
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"Training error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/model/info")
async def model_info():
    """Get current model information."""
    return {
        "model_loaded": model is not None,
        "metadata": model_metadata,
        "features_used": [
            "lead_time_days", "hour_of_day", "day_of_week", "is_morning",
            "is_monday", "is_friday", "total_appointments", "no_show_count",
            "no_show_rate", "attended_count", "cancelled_count", "age",
            "gender", "appointment_type", "is_new_patient",
        ],
    }