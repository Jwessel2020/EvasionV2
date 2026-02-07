# Evasion V2: AI/ML Project Proposal
## Predictive Traffic Enforcement Intelligence System

**Version:** 1.0
**Date:** February 2026
**Author:** AI/ML Research Team

---

## Executive Summary

This document outlines a comprehensive machine learning strategy to transform the Evasion V2 traffic violation dataset into actionable, real-time intelligence for drivers. With 1M+ historical traffic stops containing rich temporal, spatial, and contextual data, we can build predictive models that provide significant value to users in real-time driving scenarios.

---

## 1. Dataset Analysis

### 1.1 Data Overview

| Dimension | Fields | Cardinality |
|-----------|--------|-------------|
| **Temporal** | stopDate, stopTime | 1M+ timestamps spanning 10+ years |
| **Spatial** | latitude, longitude, subAgency | High-precision GPS coordinates |
| **Violation** | description, violationType, charge, article | ~100 violation types |
| **Vehicle** | make, model, year, color, type | 50+ makes, 500+ models |
| **Incident** | accident, alcohol, fatal, workZone, searchConducted | Binary flags |
| **Speed** | recordedSpeed, postedLimit, speedOver, detectionMethod | Quantitative speed data |
| **Enforcement** | arrestType (A-S codes) | 19 detection method codes |

### 1.2 Data Quality Assessment

**Strengths:**
- High spatial precision (lat/lng to 6 decimal places)
- Complete temporal coverage (date + time)
- Parsed speed data from free-text descriptions
- Detection method classification (radar/laser/vascar/patrol)
- Consistent geographic region (Montgomery County, MD area)

**Challenges:**
- Some records lack speed parsing (free-text variations)
- Vehicle data occasionally missing or inconsistent
- Historical bias (enforcement patterns may change)

### 1.3 Feature Engineering Opportunities

```
TEMPORAL FEATURES:
├── Hour of day (0-23) → Peak enforcement times
├── Day of week (0-6) → Weekend vs weekday patterns
├── Month (1-12) → Seasonal variations
├── Holiday proximity → Enforcement campaigns
├── Rush hour binary → Morning (7-9) / Evening (4-7)
└── Time since last stop at location → Recency weighting

SPATIAL FEATURES:
├── GPS coordinates → Clustering for hotspots
├── Road segment ID → Derived from OSM/Google Roads API
├── Speed limit zone → Derived from posted limits
├── Proximity to highway interchange → High-enforcement zones
├── School zone binary → Time-sensitive enforcement
└── Work zone active → Construction alerts

CONTEXTUAL FEATURES:
├── Weather conditions → External API join
├── Traffic volume → External API join
├── Special events → Calendar integration
├── Historical stop density → Rolling 30-day average
└── Detection method prevalence → Area-specific tactics
```

---

## 2. ML Model Architecture

### 2.1 Primary Model: Spatiotemporal Risk Prediction

**Objective:** Predict the probability of a traffic stop occurring at a given location and time.

**Architecture:** Gradient Boosted Decision Trees (XGBoost/LightGBM) with geospatial feature engineering

```
INPUT FEATURES:
├── Latitude, Longitude (binned to 0.001° grid ≈ 100m)
├── Hour of day (cyclical encoding: sin/cos)
├── Day of week (cyclical encoding)
├── Month (cyclical encoding)
├── Historical stop count in cell (last 7/30/90 days)
├── Stop velocity (change in stop rate)
├── Detection method distribution in area
├── Road type (highway, arterial, residential)
└── Posted speed limit

OUTPUT:
└── P(stop) = probability of enforcement activity [0.0 - 1.0]
```

**Training Strategy:**
1. Create spatiotemporal grid (100m x 100m x 1 hour)
2. Label positive examples from historical stops
3. Negative sampling from unoccupied grid cells
4. Time-based train/test split (last 6 months for validation)
5. Calibrate probabilities using Platt scaling

**Expected Performance:**
- AUC-ROC: 0.80-0.85
- Precision@10%: 0.60+ (top 10% predictions capture 60%+ of stops)

### 2.2 Secondary Model: Speed Trap Detection

**Objective:** Identify likely speed trap locations using stationary detection method patterns.

**Features:**
- Arrest type codes (E, F, G, H = stationary radar; Q, R = laser)
- Geographic clustering of stationary detections
- Time-of-day patterns (speed traps operate on schedules)
- Road geometry (straight stretches, downhill grades)

**Architecture:** DBSCAN clustering + Random Forest classification

```python
# Pseudocode for speed trap detection
speed_trap_stops = filter(stops, arrestType in ['E','F','G','H','Q','R'])
clusters = DBSCAN(speed_trap_stops, eps=0.002, min_samples=10)

for cluster in clusters:
    features = [
        cluster.centroid,
        cluster.stop_count,
        cluster.time_distribution,
        cluster.avg_speed_over,
        cluster.recency_score
    ]
    trap_probability = rf_model.predict(features)
```

### 2.3 Tertiary Model: Vehicle Risk Profiling

**Objective:** Understand which vehicles are disproportionately stopped.

**Application:** Alert users if their vehicle profile has elevated risk.

**Approach:** Logistic regression with vehicle features

```
Features:
├── Vehicle make (one-hot encoded)
├── Vehicle age (year - current_year)
├── Vehicle color
├── Vehicle type (sedan, SUV, motorcycle)
└── Interaction: make × color

Output: Relative risk multiplier (1.0 = average)
```

**Ethical Consideration:** This model should ONLY use vehicle characteristics (not demographics). The purpose is informational awareness, not profiling validation.

---

## 3. Real-Time Driver Applications

### 3.1 Live Risk Heat Map

**User Experience:**
- Map overlay showing real-time enforcement probability
- Color gradient: Green (low) → Yellow (moderate) → Red (high)
- Updates dynamically based on current time and day

**Technical Implementation:**
```typescript
// API endpoint: /api/predictions/heatmap
interface HeatmapRequest {
  bounds: [minLng, minLat, maxLng, maxLat];
  timestamp: Date;
  resolution: 'high' | 'medium' | 'low';
}

interface HeatmapResponse {
  cells: Array<{
    lat: number;
    lng: number;
    probability: number;
    confidence: number;
    factors: string[];
  }>;
  model_version: string;
  generated_at: Date;
}
```

### 3.2 Route Risk Scoring

**User Experience:**
- User inputs origin/destination
- System calculates route options
- Each route gets a "risk score" based on:
  - Number of high-risk segments
  - Active speed trap likelihood
  - Historical stop density along route

**Technical Implementation:**
```typescript
// API endpoint: /api/predictions/route-risk
interface RouteRiskRequest {
  origin: [lng, lat];
  destination: [lng, lat];
  departure_time: Date;
  alternatives: boolean;
}

interface RouteRiskResponse {
  routes: Array<{
    geometry: GeoJSON.LineString;
    duration_minutes: number;
    distance_miles: number;
    risk_score: number;        // 0-100
    high_risk_segments: Array<{
      start_index: number;
      end_index: number;
      probability: number;
      reason: string;
    }>;
    recommended_speed_buffer: number; // suggested mph under limit
  }>;
}
```

### 3.3 Proactive Alerts System

**User Experience:**
- Push notifications when entering high-risk zones
- Audio alerts during navigation ("Speed enforcement ahead")
- Contextual advice ("Radar commonly used on this stretch")

**Alert Logic:**
```typescript
interface AlertTrigger {
  type: 'speed_trap' | 'high_activity' | 'known_location';
  priority: 'high' | 'medium' | 'low';
  distance_threshold: number; // meters
  probability_threshold: number;
  cooldown_minutes: number;
}

const ALERT_CONFIG: AlertTrigger[] = [
  { type: 'speed_trap', priority: 'high', distance_threshold: 500, probability_threshold: 0.7, cooldown_minutes: 5 },
  { type: 'high_activity', priority: 'medium', distance_threshold: 1000, probability_threshold: 0.5, cooldown_minutes: 15 },
  { type: 'known_location', priority: 'low', distance_threshold: 300, probability_threshold: 0.3, cooldown_minutes: 30 },
];
```

### 3.4 Personalized Risk Assessment

**User Experience:**
- "Your Vehicle Risk Profile"
- Shows: "BMW 3-Series drivers are stopped 1.4x more often for speed violations"
- Time-based advice: "Your peak risk hours are 7-9 AM on weekdays"

**Technical Implementation:**
```typescript
interface UserProfile {
  vehicle_make: string;
  vehicle_model: string;
  vehicle_year: number;
  vehicle_color: string;
  typical_routes: GeoJSON.LineString[];
  typical_commute_times: string[];
}

interface PersonalizedRisk {
  overall_multiplier: number;
  factors: Array<{
    factor: string;
    impact: number;
    explanation: string;
  }>;
  recommendations: string[];
}
```

---

## 4. Advanced Analytics Features

### 4.1 Temporal Pattern Discovery

**Analysis:** Identify recurring enforcement patterns

**Output:**
- "Speed traps on Route 270 peak at 9:30 AM ± 15 minutes"
- "DUI checkpoints increase 300% on holiday weekends"
- "Month-end shows 15% increase in citation issuance"

**Algorithm:** Time series decomposition + anomaly detection

```python
from statsmodels.tsa.seasonal import STL

# Decompose stop frequency by hour
stop_counts_hourly = aggregate_by_hour(violations)
decomposition = STL(stop_counts_hourly, period=24).fit()

trend = decomposition.trend
seasonal = decomposition.seasonal  # Daily pattern
residual = decomposition.resid    # Anomalies
```

### 4.2 Enforcement Behavior Analysis

**Analysis:** Understand officer/unit behavior patterns

**Output:**
- Average stops per shift by subAgency
- Detection method preferences by location
- Citation vs. warning ratios by time of day

**Value:** Predict enforcement intensity based on unit assignment patterns

### 4.3 Speed Threshold Analysis

**Analysis:** Determine "safe" speed buffers by location

**Output:**
- "On this road, 95% of stops occurred at 15+ mph over limit"
- "Laser enforcement targets 12+ mph over; radar targets 17+ mph over"

**Algorithm:** Distribution analysis of speedOver field

```python
import numpy as np
from scipy import stats

def safe_speed_buffer(location_stops):
    speed_overs = location_stops['speed_over'].dropna()

    # Find the speed threshold below which 95% of stops occurred
    percentile_5 = np.percentile(speed_overs, 5)

    # Fit distribution to understand variance
    params = stats.norm.fit(speed_overs)

    return {
        'min_observed': speed_overs.min(),
        'percentile_5': percentile_5,
        'mean': params[0],
        'std': params[1],
        'recommended_buffer': max(5, percentile_5 - 2)  # Conservative
    }
```

### 4.4 Predictive Maintenance of Model

**Challenge:** Enforcement patterns change over time

**Solution:** Continuous learning pipeline

```
┌─────────────────────────────────────────────────────────────┐
│                    ML Pipeline Architecture                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────┐    ┌──────────┐    ┌──────────────┐          │
│  │ New Data │───►│ Feature  │───►│ Incremental  │          │
│  │ Ingestion│    │ Pipeline │    │ Training     │          │
│  └──────────┘    └──────────┘    └──────────────┘          │
│       │                               │                     │
│       │                               ▼                     │
│       │              ┌──────────────────────────┐          │
│       │              │ Model Registry           │          │
│       │              │ - Champion Model         │          │
│       │              │ - Challenger Models      │          │
│       │              │ - A/B Test Allocation    │          │
│       │              └──────────────────────────┘          │
│       │                               │                     │
│       ▼                               ▼                     │
│  ┌──────────┐    ┌──────────┐    ┌──────────────┐          │
│  │ Data     │    │ Model    │    │ Production   │          │
│  │ Quality  │    │ Metrics  │    │ Serving      │          │
│  │ Checks   │    │ Dashboard│    │ (REST API)   │          │
│  └──────────┘    └──────────┘    └──────────────┘          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Implementation Roadmap

### Phase 1: Foundation (Weeks 1-4)
**Goal:** Build core prediction infrastructure

| Task | Deliverable | Tech Stack |
|------|-------------|------------|
| Data pipeline | ETL from PostgreSQL to ML-ready format | Python, Pandas |
| Feature engineering | Temporal + spatial features | NumPy, GeoPandas |
| Baseline model | XGBoost risk predictor | scikit-learn, XGBoost |
| API endpoint | `/api/predictions/risk` | Next.js API Routes |
| Basic heatmap | Risk overlay on existing map | Mapbox GL JS |

### Phase 2: Enhancement (Weeks 5-8)
**Goal:** Add advanced features and real-time capabilities

| Task | Deliverable | Tech Stack |
|------|-------------|------------|
| Speed trap model | Dedicated trap detection | DBSCAN, Random Forest |
| Route scoring | Risk per navigation route | Graph algorithms |
| Alert system | Proximity-based notifications | React Native / Push |
| Vehicle profiling | Make/model risk analysis | Logistic regression |
| Dashboard | Analytics for patterns | Recharts, D3.js |

### Phase 3: Intelligence (Weeks 9-12)
**Goal:** Continuous learning and personalization

| Task | Deliverable | Tech Stack |
|------|-------------|------------|
| User profiles | Personalized risk scores | Collaborative filtering |
| Real-time updates | Live enforcement reports | WebSocket, Redis |
| Model retraining | Automated weekly updates | MLflow, Airflow |
| Mobile app | Driver companion app | React Native |
| Community reports | Waze-style user reports | Crowdsourcing system |

---

## 6. Technical Architecture

### 6.1 ML Service Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client Layer                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐│
│  │ Web App  │  │ Mobile   │  │Navigation│  │ Third-Party APIs ││
│  │ (Next.js)│  │ App      │  │ Integration│  │                ││
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────────┬─────────┘│
└───────┼─────────────┼─────────────┼─────────────────┼──────────┘
        │             │             │                 │
        ▼             ▼             ▼                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                         API Gateway                              │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ /api/predictions/*  │  /api/analytics/*  │  /api/alerts/* │  │
│  └──────────────────────────────────────────────────────────┘  │
└───────────────────────────┬─────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│ Prediction   │   │ Analytics    │   │ Real-Time    │
│ Service      │   │ Service      │   │ Alert Service│
│              │   │              │   │              │
│ - Risk Model │   │ - Aggregation│   │ - WebSocket  │
│ - Trap Model │   │ - Patterns   │   │ - Push Queue │
│ - Route Score│   │ - Trends     │   │ - Geo-fence  │
└──────┬───────┘   └──────┬───────┘   └──────┬───────┘
       │                  │                  │
       └─────────────┬────┴──────────────────┘
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                         Data Layer                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ PostgreSQL   │  │ Redis        │  │ Model Storage        │  │
│  │ (violations) │  │ (cache/RT)   │  │ (MLflow/S3)          │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 Model Serving Options

| Option | Pros | Cons | Recommendation |
|--------|------|------|----------------|
| **In-Process (Node.js)** | Low latency, simple | Limited ML libraries | Phase 1 |
| **Python Microservice** | Full ML ecosystem | Network overhead | Phase 2+ |
| **ONNX Runtime** | Fast inference, portable | Conversion complexity | Production |
| **TensorFlow.js** | Browser-based | Model size limits | Mobile |

### 6.3 Database Schema Extensions

```sql
-- New tables for ML predictions
CREATE TABLE ml_predictions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  grid_lat DECIMAL(9,6) NOT NULL,
  grid_lng DECIMAL(9,6) NOT NULL,
  hour_of_day INT NOT NULL,
  day_of_week INT NOT NULL,
  probability DECIMAL(5,4) NOT NULL,
  confidence DECIMAL(5,4),
  model_version VARCHAR(50) NOT NULL,
  factors JSONB DEFAULT '{}',
  predicted_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,

  CONSTRAINT unique_prediction UNIQUE (grid_lat, grid_lng, hour_of_day, day_of_week, model_version)
);

CREATE INDEX idx_predictions_location ON ml_predictions USING GIST (
  point(grid_lng, grid_lat)
);
CREATE INDEX idx_predictions_time ON ml_predictions (hour_of_day, day_of_week);
CREATE INDEX idx_predictions_probability ON ml_predictions (probability DESC);

-- Speed trap clusters
CREATE TABLE speed_trap_clusters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  centroid_lat DECIMAL(9,6) NOT NULL,
  centroid_lng DECIMAL(9,6) NOT NULL,
  radius_meters INT NOT NULL,
  stop_count INT NOT NULL,
  avg_speed_over DECIMAL(5,2),
  primary_detection_method VARCHAR(20),
  confidence DECIMAL(5,4),
  active_hours INT[], -- Array of peak hours
  active_days INT[], -- Array of peak days
  last_updated TIMESTAMP DEFAULT NOW()
);

-- User risk profiles
CREATE TABLE user_risk_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  vehicle_make VARCHAR(50),
  vehicle_model VARCHAR(50),
  vehicle_year INT,
  risk_multiplier DECIMAL(4,2) DEFAULT 1.0,
  factors JSONB DEFAULT '{}',
  calculated_at TIMESTAMP DEFAULT NOW()
);
```

---

## 7. Key Insights from Data Exploration

### 7.1 Preliminary Findings

Based on the existing schema and data patterns:

1. **Detection Method Distribution**
   - Radar (E, F, G, H, I, J): Most common for highway enforcement
   - Laser (Q, R): Precision targeting, higher speed-over averages
   - VASCAR (C, D): Distance-time calculation, less common
   - Patrol (A, B, L, M, N, O, P): Mobile enforcement

2. **Temporal Patterns**
   - Peak enforcement hours correlate with commute times
   - Weekend nights show elevated alcohol-related stops
   - Month-end may show quota-driven increases

3. **Spatial Clustering**
   - Highway interchanges are enforcement hotspots
   - Certain subAgencies have distinct patrol territories
   - Speed traps cluster on specific road segments

### 7.2 Questions for Further Analysis

1. **Seasonality**: Do enforcement patterns change with seasons?
2. **Event Correlation**: Do local events affect stop frequency?
3. **Weather Impact**: Does weather affect enforcement activity?
4. **Vehicle Bias**: Which vehicles are disproportionately stopped?
5. **Outcome Prediction**: Can we predict citation vs. warning?

---

## 8. Ethical Considerations

### 8.1 Responsible Use Guidelines

1. **Purpose Limitation**: System designed for legal speed awareness, not evasion of lawful traffic stops
2. **No Demographic Profiling**: Vehicle profiling excludes driver demographics
3. **Transparency**: Users understand this is probabilistic, not deterministic
4. **No Guarantee**: Clear disclaimers that predictions are informational only
5. **Legal Compliance**: Ensure compliance with local laws regarding radar detectors/alerts

### 8.2 Data Privacy

1. User location data is anonymized and aggregated
2. No individual traffic stop outcomes are exposed
3. Historical data is de-identified for analysis
4. User profiles are stored with encryption

---

## 9. Success Metrics

### 9.1 Model Performance

| Metric | Target | Measurement |
|--------|--------|-------------|
| AUC-ROC | > 0.80 | Weekly validation |
| Precision@10% | > 0.60 | Top decile accuracy |
| Alert Accuracy | > 70% | User feedback loop |
| Latency | < 100ms | P95 API response |

### 9.2 User Value

| Metric | Target | Measurement |
|--------|--------|-------------|
| Alert Engagement | > 30% | User interactions with alerts |
| Route Adoption | > 20% | Users who choose lower-risk routes |
| NPS Score | > 50 | User satisfaction surveys |
| Daily Active Users | Growing | App analytics |

---

## 10. Resource Requirements

### 10.1 Team

| Role | Responsibility | Allocation |
|------|---------------|------------|
| ML Engineer | Model development, training | 1 FTE |
| Backend Developer | API, data pipeline | 0.5 FTE |
| Frontend Developer | UI/UX for predictions | 0.5 FTE |
| Data Analyst | Pattern discovery, validation | 0.5 FTE |

### 10.2 Infrastructure

| Component | Specification | Monthly Cost |
|-----------|---------------|--------------|
| ML Training | GPU instance (weekly) | ~$50 |
| Model Serving | 2 vCPU, 4GB RAM | ~$40 |
| Redis Cache | 1GB | ~$15 |
| PostgreSQL | Existing | $0 |
| **Total** | | **~$105/month** |

---

## 11. Conclusion

The Evasion V2 dataset presents an exceptional opportunity for ML-driven driver intelligence. With 1M+ historical traffic stops, rich temporal/spatial data, and parsed speed enforcement details, we can build:

1. **Predictive risk models** that anticipate enforcement activity
2. **Speed trap detection** using clustering and pattern analysis
3. **Personalized alerts** based on vehicle profile and driving patterns
4. **Route optimization** that balances time with enforcement risk

The existing database schema already includes `PolicePrediction` and `ViolationHotspot` models, indicating this direction was anticipated. The proposed ML architecture extends these foundations into a comprehensive predictive intelligence platform.

**Recommended Next Step:** Begin with Phase 1 (baseline risk prediction model) to validate the approach with real users before investing in advanced features.

---

## Appendix A: Feature Engineering Code Samples

```python
import pandas as pd
import numpy as np
from sklearn.preprocessing import StandardScaler

def engineer_temporal_features(df: pd.DataFrame) -> pd.DataFrame:
    """Extract temporal features from stop_date and stop_time."""

    df['hour'] = df['stop_time'].dt.hour
    df['day_of_week'] = df['stop_date'].dt.dayofweek
    df['month'] = df['stop_date'].dt.month
    df['is_weekend'] = df['day_of_week'].isin([5, 6]).astype(int)
    df['is_rush_hour'] = df['hour'].isin([7, 8, 9, 16, 17, 18]).astype(int)

    # Cyclical encoding for time
    df['hour_sin'] = np.sin(2 * np.pi * df['hour'] / 24)
    df['hour_cos'] = np.cos(2 * np.pi * df['hour'] / 24)
    df['dow_sin'] = np.sin(2 * np.pi * df['day_of_week'] / 7)
    df['dow_cos'] = np.cos(2 * np.pi * df['day_of_week'] / 7)

    return df

def engineer_spatial_features(df: pd.DataFrame, grid_size: float = 0.001) -> pd.DataFrame:
    """Bin coordinates into grid cells."""

    df['grid_lat'] = (df['latitude'] / grid_size).round() * grid_size
    df['grid_lng'] = (df['longitude'] / grid_size).round() * grid_size
    df['grid_id'] = df['grid_lat'].astype(str) + '_' + df['grid_lng'].astype(str)

    return df

def engineer_historical_features(df: pd.DataFrame, lookback_days: int = 30) -> pd.DataFrame:
    """Calculate historical stop counts per grid cell."""

    # Sort by date
    df = df.sort_values('stop_date')

    # Rolling count per grid cell
    df['historical_count'] = df.groupby('grid_id').cumcount()

    # Could extend with actual rolling window calculation
    return df
```

## Appendix B: Model Training Pipeline

```python
from xgboost import XGBClassifier
from sklearn.model_selection import TimeSeriesSplit
from sklearn.metrics import roc_auc_score, precision_score
import mlflow

def train_risk_model(X: pd.DataFrame, y: pd.Series, dates: pd.Series):
    """Train risk prediction model with time-based cross-validation."""

    # Time series split
    tscv = TimeSeriesSplit(n_splits=5)

    scores = []

    with mlflow.start_run():
        for fold, (train_idx, val_idx) in enumerate(tscv.split(X)):
            X_train, X_val = X.iloc[train_idx], X.iloc[val_idx]
            y_train, y_val = y.iloc[train_idx], y.iloc[val_idx]

            model = XGBClassifier(
                n_estimators=100,
                max_depth=6,
                learning_rate=0.1,
                subsample=0.8,
                colsample_bytree=0.8,
                random_state=42
            )

            model.fit(
                X_train, y_train,
                eval_set=[(X_val, y_val)],
                early_stopping_rounds=10,
                verbose=False
            )

            y_pred = model.predict_proba(X_val)[:, 1]
            auc = roc_auc_score(y_val, y_pred)
            scores.append(auc)

            mlflow.log_metric(f'auc_fold_{fold}', auc)

        mlflow.log_metric('mean_auc', np.mean(scores))
        mlflow.xgboost.log_model(model, 'model')

    return model, scores
```

## Appendix C: API Response Examples

```json
// GET /api/predictions/risk?lat=39.0458&lng=-77.1201&time=2024-03-15T08:30:00
{
  "success": true,
  "data": {
    "location": {
      "lat": 39.0458,
      "lng": -77.1201,
      "grid_cell": "39.046_-77.120"
    },
    "time": {
      "hour": 8,
      "day_of_week": "Friday",
      "is_rush_hour": true
    },
    "prediction": {
      "probability": 0.73,
      "confidence": 0.85,
      "risk_level": "high"
    },
    "factors": [
      {"factor": "rush_hour", "impact": "+0.15", "description": "Morning rush hour"},
      {"factor": "historical_density", "impact": "+0.22", "description": "High enforcement area"},
      {"factor": "radar_zone", "impact": "+0.12", "description": "Stationary radar common"}
    ],
    "recommendations": [
      "Maintain speed at or below posted limit",
      "Radar enforcement likely - watch for parked vehicles"
    ],
    "model_version": "v1.2.3",
    "generated_at": "2024-03-15T08:30:01Z"
  }
}
```

---

*Document generated by AI/ML Research Team for Evasion V2 Project*
