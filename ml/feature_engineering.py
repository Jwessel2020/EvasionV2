"""
Feature Engineering for Traffic Stop Risk Prediction

This module provides utilities for extracting and transforming features
from raw traffic violation data for ML model training.
"""

import numpy as np
import pandas as pd
from typing import Tuple, Optional
from datetime import datetime, timedelta

# Configuration
GRID_SIZE = 0.001  # ~100 meters at mid-latitudes
GRID_PRECISION = 3  # Decimal places for grid cell IDs


def round_to_grid(value: float, grid_size: float = GRID_SIZE) -> float:
    """Round a coordinate to the nearest grid cell center."""
    return round(value / grid_size) * grid_size


def create_grid_id(lat: float, lng: float) -> str:
    """Create a unique identifier for a grid cell."""
    grid_lat = round(lat, GRID_PRECISION)
    grid_lng = round(lng, GRID_PRECISION)
    return f"{grid_lat:.{GRID_PRECISION}f}_{grid_lng:.{GRID_PRECISION}f}"


def cyclical_encode(value: float, max_value: float) -> Tuple[float, float]:
    """
    Encode a cyclical feature using sin/cos transformation.

    Args:
        value: The value to encode (e.g., hour 0-23)
        max_value: The maximum value in the cycle (e.g., 24 for hours)

    Returns:
        Tuple of (sin, cos) encodings
    """
    angle = 2 * np.pi * value / max_value
    return np.sin(angle), np.cos(angle)


def encode_temporal_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Add cyclical temporal features to a DataFrame.

    Expects columns: 'hour' (0-23), 'day_of_week' (0-6), 'month' (1-12)
    """
    df = df.copy()

    # Hour encoding (24-hour cycle)
    if 'hour' in df.columns:
        df['hour_sin'] = np.sin(2 * np.pi * df['hour'] / 24)
        df['hour_cos'] = np.cos(2 * np.pi * df['hour'] / 24)

    # Day of week encoding (7-day cycle)
    if 'day_of_week' in df.columns:
        df['dow_sin'] = np.sin(2 * np.pi * df['day_of_week'] / 7)
        df['dow_cos'] = np.cos(2 * np.pi * df['day_of_week'] / 7)

    # Month encoding (12-month cycle)
    if 'month' in df.columns:
        df['month_sin'] = np.sin(2 * np.pi * (df['month'] - 1) / 12)
        df['month_cos'] = np.cos(2 * np.pi * (df['month'] - 1) / 12)

    return df


def add_contextual_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Add contextual binary features.

    Expects columns: 'hour', 'day_of_week'
    """
    df = df.copy()

    # Weekend indicator (Saturday=5, Sunday=6)
    if 'day_of_week' in df.columns:
        df['is_weekend'] = df['day_of_week'].isin([5, 6]).astype(int)

    # Rush hour indicator (7-9 AM and 4-7 PM)
    if 'hour' in df.columns:
        df['is_rush_hour'] = df['hour'].isin([7, 8, 9, 16, 17, 18]).astype(int)
        df['is_night'] = df['hour'].isin([22, 23, 0, 1, 2, 3, 4]).astype(int)

    return df


def compute_grid_statistics(violations_df: pd.DataFrame) -> pd.DataFrame:
    """
    Compute statistics per grid cell.

    Expects columns: 'grid_lat', 'grid_lng', 'speed_over', 'detection_method',
                    'alcohol', 'accident'

    Returns DataFrame with columns:
        - grid_lat, grid_lng
        - stop_count
        - avg_speed_over
        - radar_pct, laser_pct
        - alcohol_pct, accident_pct
    """
    # Group by grid cell
    grid_stats = violations_df.groupby(['grid_lat', 'grid_lng']).agg({
        'id': 'count',
        'speed_over': 'mean',
        'alcohol': 'mean',
        'accident': 'mean',
    }).reset_index()

    grid_stats.columns = ['grid_lat', 'grid_lng', 'stop_count', 'avg_speed_over',
                          'alcohol_pct', 'accident_pct']

    # Detection method percentages (if available)
    if 'detection_method' in violations_df.columns:
        detection_pcts = violations_df.groupby(['grid_lat', 'grid_lng'])['detection_method'].apply(
            lambda x: pd.Series({
                'radar_pct': (x == 'radar').mean(),
                'laser_pct': (x == 'laser').mean(),
            })
        ).unstack().reset_index()
        detection_pcts.columns = ['grid_lat', 'grid_lng', 'radar_pct', 'laser_pct']
        grid_stats = grid_stats.merge(detection_pcts, on=['grid_lat', 'grid_lng'], how='left')
    else:
        grid_stats['radar_pct'] = 0.0
        grid_stats['laser_pct'] = 0.0

    # Fill NaN values
    grid_stats = grid_stats.fillna(0)

    return grid_stats


def compute_temporal_grid_statistics(
    violations_df: pd.DataFrame,
    lookback_days: Optional[int] = None
) -> pd.DataFrame:
    """
    Compute statistics per grid cell per hour per day of week.

    Args:
        violations_df: DataFrame with traffic violations
        lookback_days: If provided, only use data from last N days

    Returns DataFrame with stop counts per grid-time combination
    """
    df = violations_df.copy()

    # Filter by lookback period if specified
    if lookback_days is not None and 'stop_date' in df.columns:
        cutoff_date = df['stop_date'].max() - timedelta(days=lookback_days)
        df = df[df['stop_date'] >= cutoff_date]

    # Extract temporal features
    if 'stop_time' in df.columns:
        # Handle time column (might be time or datetime)
        if df['stop_time'].dtype == 'object':
            df['hour'] = pd.to_datetime(df['stop_time'], format='%H:%M:%S').dt.hour
        else:
            df['hour'] = pd.to_datetime(df['stop_time']).dt.hour

    if 'stop_date' in df.columns:
        df['day_of_week'] = pd.to_datetime(df['stop_date']).dt.dayofweek

    # Group by grid cell and time
    temporal_stats = df.groupby(['grid_lat', 'grid_lng', 'hour', 'day_of_week']).agg({
        'id': 'count'
    }).reset_index()

    temporal_stats.columns = ['grid_lat', 'grid_lng', 'hour', 'day_of_week', 'stop_count']

    return temporal_stats


def create_training_data(
    violations_df: pd.DataFrame,
    negative_ratio: int = 3
) -> Tuple[pd.DataFrame, pd.Series]:
    """
    Create training data with positive and negative examples.

    Positive examples: Grid cells with stops at specific times
    Negative examples: Grid cells without stops (randomly sampled)

    Args:
        violations_df: Raw traffic violations DataFrame
        negative_ratio: Number of negative samples per positive

    Returns:
        X: Feature DataFrame
        y: Target Series (1 = stop occurred, 0 = no stop)
    """
    print("  Preparing data for feature engineering...")

    # Add grid cell identifiers
    df = violations_df.copy()
    df['grid_lat'] = df['latitude'].apply(lambda x: round_to_grid(x))
    df['grid_lng'] = df['longitude'].apply(lambda x: round_to_grid(x))

    # Extract temporal features
    if 'stop_time' in df.columns:
        if df['stop_time'].dtype == 'object':
            df['hour'] = pd.to_datetime(df['stop_time'], format='%H:%M:%S').dt.hour
        else:
            # Handle Time type from PostgreSQL
            df['hour'] = pd.to_datetime(df['stop_time'].astype(str)).dt.hour

    if 'stop_date' in df.columns:
        df['day_of_week'] = pd.to_datetime(df['stop_date']).dt.dayofweek
        df['month'] = pd.to_datetime(df['stop_date']).dt.month

    print("  Computing grid statistics...")

    # Compute grid-level statistics
    grid_stats = compute_grid_statistics(df)

    # Compute temporal grid statistics
    temporal_stats = compute_temporal_grid_statistics(df)

    print(f"  Found {len(temporal_stats)} grid-time combinations with stops")

    # --- POSITIVE EXAMPLES ---
    positive_samples = temporal_stats.copy()
    positive_samples['label'] = 1

    # --- NEGATIVE EXAMPLES ---
    print(f"  Generating {negative_ratio}x negative samples...")

    # Get unique grid cells and times
    unique_grids = positive_samples[['grid_lat', 'grid_lng']].drop_duplicates()
    hours = list(range(24))
    days = list(range(7))

    # Create all possible combinations
    all_combinations = []
    for _, row in unique_grids.iterrows():
        for hour in hours:
            for day in days:
                all_combinations.append({
                    'grid_lat': row['grid_lat'],
                    'grid_lng': row['grid_lng'],
                    'hour': hour,
                    'day_of_week': day
                })

    all_combos_df = pd.DataFrame(all_combinations)

    # Find combinations that are NOT in positive samples
    positive_keys = set(
        tuple(x) for x in positive_samples[['grid_lat', 'grid_lng', 'hour', 'day_of_week']].values
    )

    negative_candidates = all_combos_df[
        ~all_combos_df.apply(
            lambda row: (row['grid_lat'], row['grid_lng'], row['hour'], row['day_of_week']) in positive_keys,
            axis=1
        )
    ]

    # Sample negatives
    n_negatives = min(len(negative_candidates), len(positive_samples) * negative_ratio)
    negative_samples = negative_candidates.sample(n=n_negatives, random_state=42)
    negative_samples['stop_count'] = 0
    negative_samples['label'] = 0

    print(f"  Created {len(negative_samples)} negative samples")

    # Combine positive and negative samples
    combined = pd.concat([positive_samples, negative_samples], ignore_index=True)

    # Merge with grid statistics
    combined = combined.merge(
        grid_stats,
        on=['grid_lat', 'grid_lng'],
        how='left',
        suffixes=('', '_grid')
    )

    # Handle missing values from negative samples
    combined['stop_count_grid'] = combined['stop_count_grid'].fillna(0)
    combined['avg_speed_over'] = combined['avg_speed_over'].fillna(0)
    combined['alcohol_pct'] = combined['alcohol_pct'].fillna(0)
    combined['accident_pct'] = combined['accident_pct'].fillna(0)
    combined['radar_pct'] = combined['radar_pct'].fillna(0)
    combined['laser_pct'] = combined['laser_pct'].fillna(0)

    # Add cyclical temporal features
    combined = encode_temporal_features(combined)

    # Add contextual features
    combined = add_contextual_features(combined)

    print("  Preparing final feature matrix...")

    # Define feature columns
    feature_cols = [
        'grid_lat', 'grid_lng',
        'hour_sin', 'hour_cos',
        'dow_sin', 'dow_cos',
        'stop_count_grid',
        'avg_speed_over',
        'alcohol_pct', 'accident_pct',
        'radar_pct', 'laser_pct',
        'is_weekend', 'is_rush_hour', 'is_night'
    ]

    # Filter to only existing columns
    feature_cols = [col for col in feature_cols if col in combined.columns]

    X = combined[feature_cols]
    y = combined['label']

    print(f"  Final dataset: {len(X)} samples, {len(feature_cols)} features")
    print(f"  Positive: {y.sum()}, Negative: {len(y) - y.sum()}")

    return X, y


def generate_prediction_grid(
    lat_min: float,
    lat_max: float,
    lng_min: float,
    lng_max: float,
    grid_stats: pd.DataFrame
) -> pd.DataFrame:
    """
    Generate a prediction grid for all grid cells and time combinations.

    Args:
        lat_min, lat_max, lng_min, lng_max: Bounding box
        grid_stats: Pre-computed grid statistics

    Returns:
        DataFrame with all grid-time combinations and features
    """
    # Generate grid cells within bounds
    lat_range = np.arange(round_to_grid(lat_min), round_to_grid(lat_max) + GRID_SIZE, GRID_SIZE)
    lng_range = np.arange(round_to_grid(lng_min), round_to_grid(lng_max) + GRID_SIZE, GRID_SIZE)

    hours = list(range(24))
    days = list(range(7))

    # Create all combinations
    combinations = []
    for lat in lat_range:
        for lng in lng_range:
            for hour in hours:
                for day in days:
                    combinations.append({
                        'grid_lat': round(lat, GRID_PRECISION),
                        'grid_lng': round(lng, GRID_PRECISION),
                        'hour': hour,
                        'day_of_week': day
                    })

    pred_df = pd.DataFrame(combinations)

    # Merge with grid statistics
    pred_df = pred_df.merge(
        grid_stats,
        on=['grid_lat', 'grid_lng'],
        how='left'
    )

    # Fill missing with zeros (cells with no historical data)
    for col in ['stop_count', 'avg_speed_over', 'alcohol_pct', 'accident_pct', 'radar_pct', 'laser_pct']:
        if col in pred_df.columns:
            pred_df[col] = pred_df[col].fillna(0)
        else:
            pred_df[col] = 0

    # Rename stop_count to avoid confusion
    if 'stop_count' in pred_df.columns:
        pred_df = pred_df.rename(columns={'stop_count': 'stop_count_grid'})

    # Add temporal encodings
    pred_df = encode_temporal_features(pred_df)
    pred_df = add_contextual_features(pred_df)

    return pred_df


if __name__ == "__main__":
    # Test the module
    print("Feature engineering module loaded successfully")
    print(f"Grid size: {GRID_SIZE} degrees (~{GRID_SIZE * 111}km)")

    # Test cyclical encoding
    hour_sin, hour_cos = cyclical_encode(12, 24)
    print(f"Hour 12 encoding: sin={hour_sin:.3f}, cos={hour_cos:.3f}")

    hour_sin, hour_cos = cyclical_encode(0, 24)
    print(f"Hour 0 encoding: sin={hour_sin:.3f}, cos={hour_cos:.3f}")
