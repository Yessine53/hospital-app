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
# Default to a path relative to CWD so it works on Render's native runtime
# (where /app is not writable). Override with MODEL_PATH env var if needed.
MODEL_PATH = os.getenv("MODEL_PATH", "models/noshow_model.pkl")

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
async def train_model(sample_size: int = 30000):
    """
    Train the no-show prediction model using historical data.

    sample_size: max number of appointments to train on (default 30000).
    On Render free tier (512 MB RAM) keep this modest. Set higher only on a
    paid instance.
    """
    global model, model_metadata

    try:
        db = get_db()

        # Count first so we can log progress meaningfully
        eligible_count = db.appointments.count_documents({
            "status": {"$in": ["completed", "no_show"]},
        })
        print(
            f"[train] Eligible appointments in db '{db.name}': {eligible_count}. "
            f"Sample size cap: {sample_size}",
            flush=True,
        )

        if eligible_count < 50:
            raise HTTPException(
                status_code=400,
                detail=f"Not enough training data. Found {eligible_count} appointments, need at least 50.",
            )

        # 1) Stratified sampling — fetch ALL no_show rows (minority class)
        #    plus a random sample of completed rows (majority class).
        #    This guarantees both classes are represented in training.
        projection = {
            "patientId": 1, "status": 1, "date": 1, "startTime": 1, "type": 1,
        }

        # Get all no_show rows (rare class — typically a few thousand)
        no_show_appts = list(
            db.appointments.find({"status": "no_show"}, projection)
        )
        print(f"[train] Loaded {len(no_show_appts)} no_show appointments", flush=True)

        # Cap how many "completed" rows we use, leaving room for the no_shows
        # within the overall sample_size budget.
        completed_budget = max(50, sample_size - len(no_show_appts))

        # Random sample of completed rows via $sample (server-side, memory-friendly)
        completed_appts = list(
            db.appointments.aggregate([
                {"$match": {"status": "completed"}},
                {"$sample": {"size": completed_budget}},
                {"$project": projection},
            ])
        )
        print(f"[train] Loaded {len(completed_appts)} completed appointments (sampled)", flush=True)

        appointments = no_show_appts + completed_appts
        print(
            f"[train] Total training pool: {len(appointments)} "
            f"(no_show={len(no_show_appts)}, completed={len(completed_appts)})",
            flush=True,
        )

        # Sanity check — both classes must be present
        if len(no_show_appts) < 10 or len(completed_appts) < 10:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Not enough class diversity. no_show={len(no_show_appts)}, "
                    f"completed={len(completed_appts)}. Need at least 10 of each."
                ),
            )

        # 2) Bulk-fetch all unique patients in ONE round trip instead of N.
        unique_patient_ids = list({a["patientId"] for a in appointments if a.get("patientId")})
        print(f"[train] Fetching {len(unique_patient_ids)} unique patients in bulk...", flush=True)

        patient_projection = {
            "totalAppointments": 1, "noShowCount": 1, "attendedAppointments": 1,
            "cancelledAppointments": 1, "dateOfBirth": 1, "gender": 1,
        }
        patients_by_id = {
            p["_id"]: p
            for p in db.patients.find(
                {"_id": {"$in": unique_patient_ids}}, patient_projection
            )
        }
        print(f"[train] Patient map built: {len(patients_by_id)} patients", flush=True)

        # 3) Build feature rows in memory (no more DB calls inside the loop)
        rows = []
        for appt in appointments:
            patient = patients_by_id.get(appt.get("patientId"))
            if not patient:
                continue
            features = extract_features(patient, appt)
            features["no_show"] = 1 if appt["status"] == "no_show" else 0
            rows.append(features)

        print(f"[train] Built feature matrix: {len(rows)} rows", flush=True)
        df = pd.DataFrame(rows)
        if len(df) < 50:
            raise HTTPException(status_code=400, detail="Not enough valid training samples")

        # Log class balance — critical for imbalanced classification debugging
        class_counts = df["no_show"].value_counts().to_dict()
        print(f"[train] Class distribution: {class_counts}", flush=True)
        if len(class_counts) < 2:
            raise HTTPException(
                status_code=400,
                detail=f"Training data only contains one class: {class_counts}. Need both no_show=0 and no_show=1.",
            )

        X = df.drop("no_show", axis=1)
        y = df["no_show"]

        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
        print(f"[train] Split done. Train={len(X_train)}, Test={len(X_test)}. Fitting model...", flush=True)

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
        print("[train] Model fit complete", flush=True)

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

        # Save model (don't fail the whole train run if disk write fails —
        # the in-memory model is still usable for predictions until restart)
        try:
            model_dir = os.path.dirname(MODEL_PATH)
            if model_dir:
                os.makedirs(model_dir, exist_ok=True)
            joblib.dump(model, MODEL_PATH)
            print(f"[train] Model saved to {MODEL_PATH}", flush=True)
        except Exception as save_err:
            print(
                f"[train] WARNING: failed to persist model to {MODEL_PATH}: {save_err}. "
                f"Model is still active in memory until next restart.",
                flush=True,
            )

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