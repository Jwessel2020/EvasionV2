"""
Traffic Stop Risk Prediction Model Training

This script trains an XGBoost classifier to predict the probability of traffic
stops occurring at specific locations and times.

Enhanced with:
- SHAP (SHapley Additive exPlanations) for model explainability
- Location-specific temporal signatures
- Location × Time interaction features
- Statistical significance testing
- Pattern discovery

Usage:
    python train_risk_model.py

The script will:
1. Load traffic violation data from PostgreSQL
2. Extract location signatures and advanced features
3. Train and evaluate an XGBoost model
4. Compute SHAP values for explainability
5. Discover patterns across locations
6. Generate predictions with explanations
7. Insert predictions into the police_predictions table
"""

import os
import sys
import json
import uuid
from datetime import datetime, timedelta
from typing import Tuple, Dict, Any, List, Optional

import numpy as np
import pandas as pd
import psycopg2
from dotenv import load_dotenv
from sklearn.model_selection import cross_val_score, train_test_split
from sklearn.calibration import CalibratedClassifierCV
from sklearn.metrics import roc_auc_score, precision_score, recall_score
from xgboost import XGBClassifier
import joblib
from tqdm import tqdm

try:
    import shap
    SHAP_AVAILABLE = True
except ImportError:
    SHAP_AVAILABLE = False
    print("Warning: SHAP not available. Install with: pip install shap")

# Import our feature engineering modules
from feature_engineering import (
    create_training_data,
    compute_grid_statistics,
    generate_prediction_grid,
    GRID_SIZE,
    GRID_PRECISION,
    round_to_grid,
    encode_temporal_features,
    add_contextual_features
)

from advanced_features import (
    compute_global_distributions,
    extract_all_location_signatures,
    compute_interaction_features,
    compute_statistical_features,
    get_enhanced_feature_columns,
    signatures_to_json,
    LocationSignature
)

from pattern_discovery import discover_all_patterns

# Configuration
MODEL_VERSION = "v2.0.0"
MODEL_VALID_DAYS = 7  # Predictions expire after 7 days
NEGATIVE_RATIO = 3    # 3 negative samples per positive
MIN_STOPS_FOR_PREDICTION = 5  # Minimum stops in grid to include

# Model hyperparameters - GPU accelerated for NVIDIA A4000
MODEL_PARAMS = {
    'n_estimators': 100,
    'max_depth': 6,
    'learning_rate': 0.1,
    'subsample': 0.8,
    'colsample_bytree': 0.8,
    'random_state': 42,
    'eval_metric': 'auc',
    'tree_method': 'hist',  # Use histogram-based algorithm
    'device': 'cuda',       # Use CUDA GPU
}


def get_database_connection():
    """Create a connection to the PostgreSQL database."""
    load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        raise ValueError("DATABASE_URL not found in environment")

    # Parse DATABASE_URL
    # Format: postgresql://user:password@host:port/dbname
    if database_url.startswith('postgresql://'):
        database_url = database_url.replace('postgresql://', '')

    # Split user:password@host:port/dbname
    auth, rest = database_url.split('@')
    user, password = auth.split(':')
    host_port, dbname = rest.split('/')
    host, port = host_port.split(':') if ':' in host_port else (host_port, '5432')

    conn = psycopg2.connect(
        host=host,
        port=port,
        user=user,
        password=password,
        dbname=dbname
    )

    return conn


def load_violations_data(conn) -> pd.DataFrame:
    """Load traffic violations from the database."""
    print("\nLoading traffic violations from database...")

    query = """
    SELECT
        id,
        latitude,
        longitude,
        stop_date,
        stop_time,
        is_speed_related,
        speed_over,
        detection_method,
        alcohol,
        accident,
        violation_type
    FROM traffic_violations
    WHERE latitude IS NOT NULL
      AND longitude IS NOT NULL
      AND stop_date IS NOT NULL
      AND stop_time IS NOT NULL
    """

    df = pd.read_sql(query, conn)
    print(f"  Loaded {len(df):,} violations")

    return df


def get_data_bounds(df: pd.DataFrame) -> Dict[str, float]:
    """Get the bounding box of the data."""
    return {
        'lat_min': df['latitude'].min(),
        'lat_max': df['latitude'].max(),
        'lng_min': df['longitude'].min(),
        'lng_max': df['longitude'].max()
    }


def train_model(X: pd.DataFrame, y: pd.Series) -> Tuple[Any, Dict[str, float]]:
    """
    Train an XGBoost classifier with cross-validation.

    Returns the trained model and evaluation metrics.
    """
    print("\n" + "="*60)
    print("TRAINING XGBOOST MODEL")
    print("="*60)

    # Split data for final evaluation
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    print(f"\nTraining set: {len(X_train):,} samples")
    print(f"Test set: {len(X_test):,} samples")
    print(f"Features: {list(X.columns)}")

    # Create and train model
    model = XGBClassifier(**MODEL_PARAMS)

    print("\nPerforming 5-fold cross-validation...")
    cv_scores = cross_val_score(model, X_train, y_train, cv=5, scoring='roc_auc')
    print(f"  CV AUC scores: {cv_scores}")
    print(f"  Mean CV AUC: {cv_scores.mean():.4f} (+/- {cv_scores.std()*2:.4f})")

    # Train on full training set
    print("\nTraining final model...")
    model.fit(
        X_train, y_train,
        eval_set=[(X_test, y_test)],
        verbose=False
    )

    # Calibrate probabilities
    print("Calibrating probabilities...")
    calibrated_model = CalibratedClassifierCV(model, method='sigmoid', cv='prefit')
    calibrated_model.fit(X_test, y_test)

    # Final evaluation
    y_pred_proba = calibrated_model.predict_proba(X_test)[:, 1]
    y_pred = (y_pred_proba >= 0.5).astype(int)

    metrics = {
        'auc_roc': roc_auc_score(y_test, y_pred_proba),
        'precision': precision_score(y_test, y_pred),
        'recall': recall_score(y_test, y_pred),
        'cv_auc_mean': cv_scores.mean(),
        'cv_auc_std': cv_scores.std()
    }

    print("\n" + "-"*40)
    print("FINAL MODEL METRICS")
    print("-"*40)
    print(f"  AUC-ROC:   {metrics['auc_roc']:.4f}")
    print(f"  Precision: {metrics['precision']:.4f}")
    print(f"  Recall:    {metrics['recall']:.4f}")
    print(f"  CV AUC:    {metrics['cv_auc_mean']:.4f} (+/- {metrics['cv_auc_std']*2:.4f})")

    # Feature importance (XGBoost native)
    print("\nTop 10 XGBoost Feature Importances:")
    importances = model.feature_importances_
    feature_names = X.columns
    importance_df = pd.DataFrame({
        'feature': feature_names,
        'importance': importances
    }).sort_values('importance', ascending=False)

    for _, row in importance_df.head(10).iterrows():
        print(f"  {row['feature']}: {row['importance']:.4f}")

    # Store test set for SHAP computation
    metrics['X_test'] = X_test
    metrics['y_test'] = y_test

    return calibrated_model, metrics, model  # Return base model too for SHAP


def compute_shap_explanations(
    model: XGBClassifier,
    X_sample: pd.DataFrame,
    feature_names: List[str],
    max_samples: int = 1000
) -> Tuple[np.ndarray, Dict[str, float]]:
    """
    Compute SHAP values for model explanations.

    Args:
        model: Trained XGBoost model (base, not calibrated)
        X_sample: Sample of data to explain
        feature_names: List of feature names
        max_samples: Maximum samples to explain (for performance)

    Returns:
        Tuple of (shap_values array, feature_importance dict)
    """
    if not SHAP_AVAILABLE:
        print("  SHAP not available, skipping explanations")
        return None, {}

    print("\nComputing SHAP explanations...")

    # Sample if too large
    if len(X_sample) > max_samples:
        X_sample = X_sample.sample(n=max_samples, random_state=42)

    # Create TreeExplainer (fast for XGBoost)
    explainer = shap.TreeExplainer(model)
    shap_values = explainer.shap_values(X_sample)

    # Compute mean absolute SHAP values for feature importance
    mean_shap = np.abs(shap_values).mean(axis=0)
    feature_importance = {
        name: float(importance)
        for name, importance in zip(feature_names, mean_shap)
    }

    # Sort by importance
    feature_importance = dict(sorted(
        feature_importance.items(),
        key=lambda x: x[1],
        reverse=True
    ))

    print("  Top SHAP feature importances:")
    for i, (feat, imp) in enumerate(list(feature_importance.items())[:10]):
        print(f"    {i+1}. {feat}: {imp:.4f}")

    return shap_values, feature_importance


def get_shap_factors_for_sample(
    shap_values: np.ndarray,
    sample_idx: int,
    feature_names: List[str],
    top_k: int = 5
) -> List[Dict[str, Any]]:
    """
    Get top SHAP factors for a single prediction.

    Args:
        shap_values: Full SHAP values array
        sample_idx: Index of the sample
        feature_names: List of feature names
        top_k: Number of top factors to return

    Returns:
        List of top factors with feature name, value, and meaning
    """
    sample_shap = shap_values[sample_idx]

    # Create list of (feature, shap_value) pairs
    factors = list(zip(feature_names, sample_shap))

    # Sort by absolute SHAP value
    factors.sort(key=lambda x: abs(x[1]), reverse=True)

    # Feature meaning mappings
    feature_meanings = {
        'hour_affinity': 'Peak enforcement hour for this location',
        'day_affinity': 'Peak enforcement day for this location',
        'local_hour_z': 'Unusual hour activity for this location',
        'local_day_z': 'Unusual day activity for this location',
        'hour_concentration': 'Enforcement concentrated in few hours',
        'day_concentration': 'Enforcement concentrated in few days',
        'is_peak_hour': 'Currently a peak hour for this location',
        'is_peak_day': 'Currently a peak day for this location',
        'stop_count_grid': 'High historical stop density',
        'avg_speed_over': 'Average speed-over at this location',
        'radar_pct': 'Radar detection zone',
        'laser_pct': 'Laser detection zone',
        'method_radar_pct': 'Radar-heavy enforcement area',
        'method_laser_pct': 'Laser-heavy enforcement area',
        'location_strictness': 'Enforcement strictness level',
        'is_rush_hour': 'Rush hour time period',
        'is_weekend': 'Weekend vs weekday',
        'is_night': 'Nighttime period',
        'pattern_significant': 'Statistically significant pattern',
        'hour_sin': 'Time of day (cyclical)',
        'hour_cos': 'Time of day (cyclical)',
        'dow_sin': 'Day of week (cyclical)',
        'dow_cos': 'Day of week (cyclical)',
        'grid_lat': 'Location latitude',
        'grid_lng': 'Location longitude',
        'alcohol_pct': 'Alcohol-related incidents',
        'accident_pct': 'Accident-related stops'
    }

    result = []
    for feat, value in factors[:top_k]:
        result.append({
            'feature': feat,
            'contribution': round(float(value), 4),
            'meaning': feature_meanings.get(feat, f'Impact of {feat}'),
            'direction': 'increases' if value > 0 else 'decreases'
        })

    return result


def generate_predictions(
    model,
    violations_df: pd.DataFrame,
    feature_cols: list
) -> pd.DataFrame:
    """
    Generate predictions for all grid-time combinations.
    """
    print("\n" + "="*60)
    print("GENERATING PREDICTIONS")
    print("="*60)

    # Get data bounds
    bounds = get_data_bounds(violations_df)
    print(f"\nData bounds:")
    print(f"  Latitude:  {bounds['lat_min']:.4f} to {bounds['lat_max']:.4f}")
    print(f"  Longitude: {bounds['lng_min']:.4f} to {bounds['lng_max']:.4f}")

    # Prepare grid statistics
    print("\nComputing grid statistics...")
    violations_df['grid_lat'] = violations_df['latitude'].apply(round_to_grid)
    violations_df['grid_lng'] = violations_df['longitude'].apply(round_to_grid)
    grid_stats = compute_grid_statistics(violations_df)

    # Filter to grids with minimum stops
    significant_grids = grid_stats[grid_stats['stop_count'] >= MIN_STOPS_FOR_PREDICTION]
    print(f"  Found {len(significant_grids):,} grid cells with >= {MIN_STOPS_FOR_PREDICTION} stops")

    # Generate prediction grid only for significant cells
    print("\nGenerating prediction grid...")
    pred_data = []

    hours = list(range(24))
    days = list(range(7))

    for _, row in tqdm(significant_grids.iterrows(), total=len(significant_grids), desc="Grid cells"):
        for hour in hours:
            for day in days:
                pred_data.append({
                    'grid_lat': row['grid_lat'],
                    'grid_lng': row['grid_lng'],
                    'hour': hour,
                    'day_of_week': day,
                    'stop_count_grid': row['stop_count'],
                    'avg_speed_over': row.get('avg_speed_over', 0),
                    'alcohol_pct': row.get('alcohol_pct', 0),
                    'accident_pct': row.get('accident_pct', 0),
                    'radar_pct': row.get('radar_pct', 0),
                    'laser_pct': row.get('laser_pct', 0)
                })

    pred_df = pd.DataFrame(pred_data)
    print(f"  Generated {len(pred_df):,} grid-time combinations")

    # Add cyclical temporal features
    pred_df['hour_sin'] = np.sin(2 * np.pi * pred_df['hour'] / 24)
    pred_df['hour_cos'] = np.cos(2 * np.pi * pred_df['hour'] / 24)
    pred_df['dow_sin'] = np.sin(2 * np.pi * pred_df['day_of_week'] / 7)
    pred_df['dow_cos'] = np.cos(2 * np.pi * pred_df['day_of_week'] / 7)

    # Add contextual features
    pred_df['is_weekend'] = pred_df['day_of_week'].isin([5, 6]).astype(int)
    pred_df['is_rush_hour'] = pred_df['hour'].isin([7, 8, 9, 16, 17, 18]).astype(int)
    pred_df['is_night'] = pred_df['hour'].isin([22, 23, 0, 1, 2, 3, 4]).astype(int)

    # Ensure we have all required feature columns
    for col in feature_cols:
        if col not in pred_df.columns:
            pred_df[col] = 0

    # Make predictions
    print("\nMaking predictions...")
    X_pred = pred_df[feature_cols]
    probabilities = model.predict_proba(X_pred)[:, 1]

    pred_df['probability'] = probabilities

    print(f"\nPrediction statistics:")
    print(f"  Min probability:  {probabilities.min():.4f}")
    print(f"  Max probability:  {probabilities.max():.4f}")
    print(f"  Mean probability: {probabilities.mean():.4f}")
    print(f"  High risk (>0.5): {(probabilities > 0.5).sum():,}")
    print(f"  Very high (>0.7): {(probabilities > 0.7).sum():,}")

    return pred_df


def save_predictions_to_database(
    conn,
    predictions_df: pd.DataFrame,
    location_signatures: Dict[str, Any] = None,
    shap_importance: Dict[str, float] = None
):
    """
    Save predictions to the police_predictions table with enhanced factors.
    """
    print("\n" + "="*60)
    print("SAVING PREDICTIONS TO DATABASE")
    print("="*60)

    cursor = conn.cursor()

    # Clear existing predictions from this model version
    print("\nClearing old predictions...")
    cursor.execute("""
        DELETE FROM police_predictions
        WHERE factors->>'model_version' = %s
    """, (MODEL_VERSION,))
    deleted = cursor.rowcount
    print(f"  Deleted {deleted:,} old predictions")

    # Prepare expiration date
    valid_until = datetime.now() + timedelta(days=MODEL_VALID_DAYS)

    # Insert new predictions in batches
    print("\nInserting new predictions...")
    batch_size = 1000
    total_inserted = 0

    insert_query = """
        INSERT INTO police_predictions
        (id, latitude, longitude, probability, time_window, factors, predicted_at, valid_until)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
    """

    for i in tqdm(range(0, len(predictions_df), batch_size), desc="Batches"):
        batch = predictions_df.iloc[i:i+batch_size]
        records = []

        for _, row in batch.iterrows():
            # Create time window string
            time_window = f"hour_{int(row['hour'])}_day_{int(row['day_of_week'])}"

            # Get grid_id for location signature lookup
            grid_id = f"{row['grid_lat']:.3f}_{row['grid_lng']:.3f}"

            # Create enhanced factors JSON
            factors = {
                'model_version': MODEL_VERSION,
                'probability': round(float(row['probability']), 4),

                # Basic factors
                'grid_stop_count': int(row.get('stop_count_grid', 0)),
                'is_rush_hour': bool(row.get('is_rush_hour', False)),
                'is_weekend': bool(row.get('is_weekend', False)),
                'is_night': bool(row.get('is_night', False)),

                # Detection method
                'radar_pct': round(float(row.get('radar_pct', 0)), 3),
                'laser_pct': round(float(row.get('laser_pct', 0)), 3),

                # Interaction features (if available)
                'hour_affinity': round(float(row.get('hour_affinity', 0)), 3),
                'day_affinity': round(float(row.get('day_affinity', 0)), 3),
                'is_peak_hour': bool(row.get('is_peak_hour', False)),
                'is_peak_day': bool(row.get('is_peak_day', False)),
            }

            # Add location signature if available
            if location_signatures and grid_id in location_signatures:
                sig = location_signatures[grid_id]
                if hasattr(sig, 'peak_hours'):
                    factors['location_signature'] = {
                        'peak_hours': [int(h) for h in sig.peak_hours] if sig.peak_hours else [],
                        'peak_days': [int(d) for d in sig.peak_days] if sig.peak_days else [],
                        'hour_concentration': round(float(sig.hour_concentration), 3),
                        'day_concentration': round(float(sig.day_concentration), 3),
                        'primary_method': str(sig.primary_method) if sig.primary_method else 'unknown',
                        'strictness_level': str(sig.strictness_level) if sig.strictness_level else 'moderate',
                        'avg_speed_threshold': float(sig.avg_speed_over) if sig.avg_speed_over else 0.0,
                        'is_significant': bool(sig.is_significant)
                    }
                    factors['generated_insight'] = str(sig.insight) if sig.insight else ''
                elif isinstance(sig, dict):
                    factors['location_signature'] = {
                        'peak_hours': [int(h) for h in sig.get('peak_hours', [])],
                        'peak_days': [int(d) for d in sig.get('peak_days', [])],
                        'hour_concentration': float(sig.get('hour_concentration', 0)),
                        'primary_method': str(sig.get('primary_method', 'unknown')),
                        'strictness_level': str(sig.get('strictness_level', 'moderate')),
                        'is_significant': bool(sig.get('is_significant', False))
                    }
                    factors['generated_insight'] = str(sig.get('insight', ''))

            # Add SHAP importance reference
            if shap_importance:
                # Top 3 features by SHAP importance
                top_features = list(shap_importance.items())[:3]
                factors['shap_top_features'] = [
                    {'feature': str(f), 'importance': round(float(v), 4)}
                    for f, v in top_features
                ]

            records.append((
                str(uuid.uuid4()),
                float(row['grid_lat']),
                float(row['grid_lng']),
                float(row['probability']),
                time_window,
                json.dumps(factors),
                datetime.now(),
                valid_until
            ))

        cursor.executemany(insert_query, records)
        total_inserted += len(records)

    conn.commit()
    print(f"\n  Total predictions inserted: {total_inserted:,}")

    # Verify insertion
    cursor.execute("SELECT COUNT(*) FROM police_predictions WHERE factors->>'model_version' = %s", (MODEL_VERSION,))
    count = cursor.fetchone()[0]
    print(f"  Verified {count:,} predictions in database")

    cursor.close()


def save_model(model, metrics: Dict[str, float], feature_cols: list):
    """Save the trained model and metadata."""
    model_dir = os.path.join(os.path.dirname(__file__), 'models')
    os.makedirs(model_dir, exist_ok=True)

    # Save model
    model_path = os.path.join(model_dir, f'risk_model_{MODEL_VERSION}.joblib')
    joblib.dump({
        'model': model,
        'feature_cols': feature_cols,
        'metrics': metrics,
        'version': MODEL_VERSION,
        'trained_at': datetime.now().isoformat()
    }, model_path)

    print(f"\n  Model saved to: {model_path}")


def save_location_signatures(signatures: Dict[str, Any], patterns: Dict[str, Any]):
    """Save location signatures and discovered patterns to files."""
    model_dir = os.path.join(os.path.dirname(__file__), 'models')
    os.makedirs(model_dir, exist_ok=True)

    # Save signatures
    sig_path = os.path.join(model_dir, f'location_signatures_{MODEL_VERSION}.json')
    with open(sig_path, 'w') as f:
        json.dump(signatures_to_json(signatures), f)
    print(f"  Signatures saved to: {sig_path}")

    # Save patterns
    patterns_path = os.path.join(model_dir, f'discovered_patterns_{MODEL_VERSION}.json')
    with open(patterns_path, 'w') as f:
        json.dump(patterns, f, indent=2)
    print(f"  Patterns saved to: {patterns_path}")


def main():
    """Main training pipeline with enhanced ML features."""
    print("="*60)
    print("EVASION V2 - ENHANCED RISK PREDICTION MODEL TRAINING")
    print("="*60)
    print(f"Model Version: {MODEL_VERSION}")
    print(f"Started at: {datetime.now().isoformat()}")
    print(f"SHAP Available: {SHAP_AVAILABLE}")

    # Connect to database
    print("\nConnecting to database...")
    conn = get_database_connection()
    print("  Connected successfully")

    try:
        # Load data
        violations_df = load_violations_data(conn)

        if len(violations_df) == 0:
            print("\nERROR: No traffic violations found in database!")
            print("Run 'npm run db:import' first to load data.")
            sys.exit(1)

        # ============================================
        # PHASE 1: EXTRACT LOCATION SIGNATURES
        # ============================================
        print("\n" + "="*60)
        print("PHASE 1: EXTRACTING LOCATION SIGNATURES")
        print("="*60)

        # Prepare data with grid cells
        violations_df['grid_lat'] = violations_df['latitude'].apply(round_to_grid)
        violations_df['grid_lng'] = violations_df['longitude'].apply(round_to_grid)

        # Extract temporal features
        if 'stop_time' in violations_df.columns:
            violations_df['hour'] = pd.to_datetime(violations_df['stop_time'].astype(str)).dt.hour
        if 'stop_date' in violations_df.columns:
            violations_df['day_of_week'] = pd.to_datetime(violations_df['stop_date']).dt.dayofweek

        # Extract location signatures
        location_signatures = extract_all_location_signatures(
            violations_df,
            min_stops=MIN_STOPS_FOR_PREDICTION
        )
        print(f"  Extracted {len(location_signatures)} location signatures")

        # Compute global distributions
        global_hour_dist, global_day_dist = compute_global_distributions(violations_df)

        # ============================================
        # PHASE 2: FEATURE ENGINEERING
        # ============================================
        print("\n" + "="*60)
        print("PHASE 2: FEATURE ENGINEERING")
        print("="*60)

        # Create base training data
        X, y = create_training_data(violations_df, negative_ratio=NEGATIVE_RATIO)

        # The create_training_data function removes hour/day_of_week columns
        # We need to re-add them from the combined data for interaction features
        # Reconstruct hour and day_of_week from cyclical encodings
        print("  Reconstructing temporal columns for interaction features...")
        X['hour'] = (np.arctan2(X['hour_sin'], X['hour_cos']) * 24 / (2 * np.pi)).round().astype(int) % 24
        X['day_of_week'] = (np.arctan2(X['dow_sin'], X['dow_cos']) * 7 / (2 * np.pi)).round().astype(int) % 7

        # Add interaction features
        print("  Adding location x time interaction features...")
        X = compute_interaction_features(X, global_hour_dist, global_day_dist, location_signatures)

        # Add statistical features
        print("  Adding statistical significance features...")
        X = compute_statistical_features(X, location_signatures)

        # Get enhanced feature columns
        feature_cols = get_enhanced_feature_columns()

        # Filter to only available columns
        feature_cols = [col for col in feature_cols if col in X.columns]
        X = X[feature_cols]

        print(f"  Final feature set: {len(feature_cols)} features")
        print(f"  Features: {feature_cols}")

        # ============================================
        # PHASE 3: MODEL TRAINING
        # ============================================
        print("\n" + "="*60)
        print("PHASE 3: MODEL TRAINING")
        print("="*60)

        calibrated_model, metrics, base_model = train_model(X, y)

        # ============================================
        # PHASE 4: SHAP EXPLANATIONS
        # ============================================
        print("\n" + "="*60)
        print("PHASE 4: SHAP EXPLANATIONS")
        print("="*60)

        shap_values = None
        shap_importance = {}

        if SHAP_AVAILABLE and 'X_test' in metrics:
            X_test = metrics.pop('X_test')  # Remove from metrics to avoid saving
            metrics.pop('y_test', None)

            shap_values, shap_importance = compute_shap_explanations(
                base_model,
                X_test,
                feature_cols,
                max_samples=2000
            )

        # ============================================
        # PHASE 5: PATTERN DISCOVERY
        # ============================================
        print("\n" + "="*60)
        print("PHASE 5: PATTERN DISCOVERY")
        print("="*60)

        discovered_patterns = discover_all_patterns(violations_df, location_signatures)
        print(f"  Discovered {discovered_patterns['summary']['total_patterns']} patterns")
        print(f"  Detected {discovered_patterns['summary']['total_anomalies']} anomalies")

        # ============================================
        # PHASE 6: GENERATE PREDICTIONS
        # ============================================
        predictions = generate_predictions(
            calibrated_model,
            violations_df,
            feature_cols
        )

        # Add interaction features to predictions for storage
        predictions = compute_interaction_features(
            predictions, global_hour_dist, global_day_dist, location_signatures
        )

        # ============================================
        # PHASE 7: SAVE RESULTS
        # ============================================
        print("\n" + "="*60)
        print("PHASE 7: SAVING RESULTS")
        print("="*60)

        # Save to database with enhanced factors
        save_predictions_to_database(
            conn,
            predictions,
            location_signatures=location_signatures,
            shap_importance=shap_importance
        )

        # Save model file
        save_model(calibrated_model, metrics, feature_cols)

        # Save location signatures and patterns
        save_location_signatures(location_signatures, discovered_patterns)

        # ============================================
        # SUMMARY
        # ============================================
        print("\n" + "="*60)
        print("TRAINING COMPLETE")
        print("="*60)
        print(f"Model Version: {MODEL_VERSION}")
        print(f"AUC-ROC: {metrics['auc_roc']:.4f}")
        print(f"Location Signatures: {len(location_signatures)}")
        print(f"Discovered Patterns: {discovered_patterns['summary']['total_patterns']}")
        print(f"Detected Anomalies: {discovered_patterns['summary']['total_anomalies']}")
        print(f"Predictions Generated: {len(predictions):,}")
        print(f"Valid Until: {datetime.now() + timedelta(days=MODEL_VALID_DAYS)}")
        print(f"Finished at: {datetime.now().isoformat()}")

        if shap_importance:
            print("\nTop SHAP Features:")
            for i, (feat, imp) in enumerate(list(shap_importance.items())[:5]):
                print(f"  {i+1}. {feat}: {imp:.4f}")

    finally:
        conn.close()
        print("\nDatabase connection closed")


if __name__ == "__main__":
    main()
