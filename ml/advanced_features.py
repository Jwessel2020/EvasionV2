"""
Advanced Feature Engineering for Speed Trap Intelligence

This module provides sophisticated feature extraction that captures:
- Location-specific temporal signatures (when does THIS location have enforcement?)
- Location × Time interaction features (how does this location differ from global patterns?)
- Statistical significance features (is this pattern real or random chance?)
- Detection method signatures (what enforcement style is used here?)

These features enable the model to learn location-specific behaviors rather than
just global averages, answering questions like:
"This intersection has 80% of its traps at 7-8am on Tuesdays"
"""

import numpy as np
import pandas as pd
from scipy import stats
from typing import Dict, List, Tuple, Optional, Any
from dataclasses import dataclass, asdict
import warnings

warnings.filterwarnings('ignore', category=RuntimeWarning)


@dataclass
class LocationSignature:
    """Complete signature for a single grid cell location."""
    grid_id: str
    lat: float
    lng: float
    total_stops: int

    # Temporal signature
    hour_distribution: List[float]  # 24 values, normalized
    day_distribution: List[float]   # 7 values, normalized
    peak_hours: List[int]           # Top 3 hours
    peak_days: List[int]            # Top 3 days (0=Mon, 6=Sun)
    hour_concentration: float       # 0-1, how focused in specific hours
    day_concentration: float        # 0-1, how focused in specific days
    weekday_ratio: float            # % on weekdays vs weekends

    # Detection profile
    primary_method: str
    method_distribution: Dict[str, float]
    avg_speed_over: float
    min_speed_over: float
    strictness_level: str  # 'strict', 'moderate', 'lenient'

    # Statistical measures
    hour_chi2: float
    hour_pvalue: float
    day_chi2: float
    day_pvalue: float
    is_significant: bool

    # Generated insight
    insight: str


def compute_global_distributions(violations_df: pd.DataFrame) -> Tuple[Dict[int, float], Dict[int, float]]:
    """
    Compute global hour and day distributions across all violations.

    Returns:
        Tuple of (hour_distribution, day_distribution) as dicts mapping hour/day to probability
    """
    # Ensure we have temporal columns
    df = violations_df.copy()

    if 'hour' not in df.columns and 'stop_time' in df.columns:
        df['hour'] = pd.to_datetime(df['stop_time'].astype(str)).dt.hour

    if 'day_of_week' not in df.columns and 'stop_date' in df.columns:
        df['day_of_week'] = pd.to_datetime(df['stop_date']).dt.dayofweek

    # Hour distribution
    hour_counts = df['hour'].value_counts().sort_index()
    total_hours = hour_counts.sum()
    hour_dist = {h: hour_counts.get(h, 0) / total_hours for h in range(24)}

    # Day distribution
    day_counts = df['day_of_week'].value_counts().sort_index()
    total_days = day_counts.sum()
    day_dist = {d: day_counts.get(d, 0) / total_days for d in range(7)}

    return hour_dist, day_dist


def compute_entropy(distribution: List[float]) -> float:
    """
    Compute Shannon entropy of a probability distribution.

    Lower entropy = more concentrated/predictable
    Higher entropy = more spread out/uniform
    """
    probs = np.array(distribution)
    probs = probs[probs > 0]  # Remove zeros to avoid log(0)
    if len(probs) == 0:
        return 0.0
    return -np.sum(probs * np.log2(probs))


def compute_concentration(distribution: List[float], max_categories: int) -> float:
    """
    Compute concentration score (1 - normalized entropy).

    Range: 0 (uniform) to 1 (all in one category)
    """
    entropy = compute_entropy(distribution)
    max_entropy = np.log2(max_categories)
    if max_entropy == 0:
        return 1.0
    return 1 - (entropy / max_entropy)


def compute_hour_affinity(local_hour_pct: float, global_hour_pct: float) -> float:
    """
    Compute how much this location "prefers" this hour vs global average.

    affinity = (local_pct / global_pct) - 1

    Example: Local has 20% at 8am, global is 5%
    Affinity = (0.20 / 0.05) - 1 = 3.0 (300% over-indexed)

    Returns value from -1 (never at this hour) to positive (over-indexed)
    """
    if global_hour_pct < 0.001:
        global_hour_pct = 0.001  # Avoid division by zero
    return (local_hour_pct / global_hour_pct) - 1


def compute_local_z_score(
    observed_count: int,
    expected_count: float,
    std_dev: float
) -> float:
    """
    Compute z-score for whether this count is unusual.

    z = (observed - expected) / std

    |z| > 2 indicates statistically unusual
    """
    if std_dev < 0.001:
        std_dev = 0.001
    return (observed_count - expected_count) / std_dev


def test_temporal_significance(
    observed_counts: Dict[int, int],
    expected_counts: Optional[Dict[int, float]] = None,
    n_categories: int = 24
) -> Dict[str, Any]:
    """
    Chi-square test: Is temporal distribution significantly non-uniform?

    H0: Stops uniformly distributed across categories
    Returns: chi2, p_value, is_significant
    """
    total = sum(observed_counts.values())
    if total < 5:  # Not enough data for chi-square
        return {'chi2': 0, 'pvalue': 1.0, 'is_significant': False}

    if expected_counts is None:
        # Uniform distribution
        expected_counts = {i: total / n_categories for i in range(n_categories)}

    observed = [observed_counts.get(i, 0) for i in range(n_categories)]
    expected = [max(expected_counts.get(i, total / n_categories), 0.1) for i in range(n_categories)]

    try:
        chi2, pvalue = stats.chisquare(observed, f_exp=expected)
        return {
            'chi2': float(chi2),
            'pvalue': float(pvalue),
            'is_significant': pvalue < 0.05
        }
    except Exception:
        return {'chi2': 0, 'pvalue': 1.0, 'is_significant': False}


def compute_location_signature(
    grid_df: pd.DataFrame,
    grid_id: str,
    lat: float,
    lng: float,
    global_hour_dist: Dict[int, float],
    global_day_dist: Dict[int, float],
    global_avg_speed_over: float
) -> LocationSignature:
    """
    Compute complete signature for a single grid cell.

    This captures everything about HOW this location differs from global patterns.
    """
    total_stops = len(grid_df)

    # --- Temporal Signature ---

    # Hour distribution
    hour_counts = grid_df.groupby('hour').size()
    hour_dist = [hour_counts.get(h, 0) / total_stops if total_stops > 0 else 0 for h in range(24)]

    # Day distribution
    day_counts = grid_df.groupby('day_of_week').size()
    day_dist = [day_counts.get(d, 0) / total_stops if total_stops > 0 else 0 for d in range(7)]

    # Peak hours (top 3)
    peak_hours = sorted(range(24), key=lambda h: hour_dist[h], reverse=True)[:3]

    # Peak days (top 3)
    peak_days = sorted(range(7), key=lambda d: day_dist[d], reverse=True)[:3]

    # Concentration scores
    hour_concentration = compute_concentration(hour_dist, 24)
    day_concentration = compute_concentration(day_dist, 7)

    # Weekday ratio (Mon-Fri vs Sat-Sun)
    weekday_stops = sum(day_counts.get(d, 0) for d in range(5))
    weekday_ratio = weekday_stops / total_stops if total_stops > 0 else 0.714  # 5/7

    # --- Detection Profile ---

    if 'detection_method' in grid_df.columns:
        method_counts = grid_df['detection_method'].value_counts()
        method_dist = {m: c / total_stops for m, c in method_counts.items()}
        primary_method = method_counts.index[0] if len(method_counts) > 0 else 'unknown'
    else:
        method_dist = {}
        primary_method = 'unknown'

    if 'speed_over' in grid_df.columns:
        avg_speed_over = grid_df['speed_over'].mean()
        min_speed_over = grid_df['speed_over'].min()
    else:
        avg_speed_over = 0
        min_speed_over = 0

    # Strictness compared to global
    if avg_speed_over < global_avg_speed_over * 0.8:
        strictness = 'strict'
    elif avg_speed_over > global_avg_speed_over * 1.2:
        strictness = 'lenient'
    else:
        strictness = 'moderate'

    # --- Statistical Significance ---

    hour_test = test_temporal_significance(
        {h: hour_counts.get(h, 0) for h in range(24)},
        n_categories=24
    )

    day_test = test_temporal_significance(
        {d: day_counts.get(d, 0) for d in range(7)},
        n_categories=7
    )

    is_significant = hour_test['is_significant'] or day_test['is_significant']

    # --- Generate Insight ---
    insight = generate_location_insight(
        peak_hours=peak_hours,
        peak_days=peak_days,
        hour_concentration=hour_concentration,
        primary_method=primary_method,
        strictness=strictness,
        avg_speed_over=avg_speed_over,
        is_significant=is_significant,
        hour_pvalue=hour_test['pvalue']
    )

    return LocationSignature(
        grid_id=grid_id,
        lat=lat,
        lng=lng,
        total_stops=total_stops,
        hour_distribution=hour_dist,
        day_distribution=day_dist,
        peak_hours=peak_hours,
        peak_days=peak_days,
        hour_concentration=hour_concentration,
        day_concentration=day_concentration,
        weekday_ratio=weekday_ratio,
        primary_method=primary_method,
        method_distribution=method_dist,
        avg_speed_over=round(avg_speed_over, 1) if not np.isnan(avg_speed_over) else 0,
        min_speed_over=round(min_speed_over, 1) if not np.isnan(min_speed_over) else 0,
        strictness_level=strictness,
        hour_chi2=hour_test['chi2'],
        hour_pvalue=hour_test['pvalue'],
        day_chi2=day_test['chi2'],
        day_pvalue=day_test['pvalue'],
        is_significant=is_significant,
        insight=insight
    )


def generate_location_insight(
    peak_hours: List[int],
    peak_days: List[int],
    hour_concentration: float,
    primary_method: str,
    strictness: str,
    avg_speed_over: float,
    is_significant: bool,
    hour_pvalue: float
) -> str:
    """
    Generate human-readable insight from location signature.
    """
    day_names = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    parts = []

    # Temporal concentration insight
    if hour_concentration > 0.5:
        pct = int(hour_concentration * 100)
        hour_range = format_hour_range(peak_hours[:2])
        day_str = '/'.join(day_names[d][:3] for d in peak_days[:2])
        parts.append(f"{pct}% of stops occur {hour_range} on {day_str}")

    # Detection method
    if primary_method and primary_method != 'unknown':
        parts.append(f"{primary_method.title()} detection zone")

    # Strictness
    if strictness == 'strict':
        parts.append(f"Strict enforcement (avg {avg_speed_over:.0f} over)")
    elif strictness == 'lenient':
        parts.append(f"Lenient enforcement (avg {avg_speed_over:.0f} over)")

    # Statistical significance
    if is_significant and hour_pvalue < 0.01:
        parts.append("Pattern highly significant (p < 0.01)")
    elif is_significant:
        parts.append("Pattern statistically significant")

    return ". ".join(parts) + "." if parts else "No significant patterns detected."


def format_hour_range(hours: List[int]) -> str:
    """Format a list of hours as a readable range."""
    if not hours:
        return ""
    hours = sorted(hours)
    if len(hours) == 1:
        return f"{hours[0]}:00"
    return f"{hours[0]}:00-{hours[-1]+1}:00"


def compute_interaction_features(
    df: pd.DataFrame,
    global_hour_dist: Dict[int, float],
    global_day_dist: Dict[int, float],
    location_signatures: Dict[str, LocationSignature]
) -> pd.DataFrame:
    """
    Add location × time interaction features to a DataFrame.

    These features capture how THIS sample's time differs from:
    1. Global patterns (hour_affinity, day_affinity)
    2. This location's typical patterns (local_z_score)

    Args:
        df: DataFrame with grid_lat, grid_lng, hour, day_of_week columns
        global_hour_dist: Global hour distribution
        global_day_dist: Global day distribution
        location_signatures: Pre-computed signatures per grid cell

    Returns:
        DataFrame with added interaction features
    """
    df = df.copy()

    # Create grid_id for lookup
    df['grid_id'] = df.apply(
        lambda row: f"{row['grid_lat']:.3f}_{row['grid_lng']:.3f}",
        axis=1
    )

    # Initialize new columns
    df['hour_affinity'] = 0.0
    df['day_affinity'] = 0.0
    df['local_hour_z'] = 0.0
    df['local_day_z'] = 0.0
    df['hour_concentration'] = 0.0
    df['day_concentration'] = 0.0
    df['is_peak_hour'] = 0
    df['is_peak_day'] = 0
    df['method_radar_pct'] = 0.0
    df['method_laser_pct'] = 0.0
    df['location_strictness'] = 0.0  # -1=strict, 0=moderate, 1=lenient

    for idx, row in df.iterrows():
        grid_id = row['grid_id']
        hour = int(row['hour'])
        day = int(row['day_of_week'])

        # Global affinities (how this hour/day compares to global average)
        global_hour_pct = global_hour_dist.get(hour, 1/24)
        global_day_pct = global_day_dist.get(day, 1/7)

        if grid_id in location_signatures:
            sig = location_signatures[grid_id]

            # Local hour percentage at this location
            local_hour_pct = sig.hour_distribution[hour]
            local_day_pct = sig.day_distribution[day]

            # Hour affinity: how much this location prefers this hour vs global
            df.at[idx, 'hour_affinity'] = compute_hour_affinity(local_hour_pct, global_hour_pct)
            df.at[idx, 'day_affinity'] = compute_hour_affinity(local_day_pct, global_day_pct)

            # Local z-scores: is this hour unusual for THIS location?
            hour_mean = 1/24
            hour_std = np.std(sig.hour_distribution) if np.std(sig.hour_distribution) > 0 else 0.05
            df.at[idx, 'local_hour_z'] = (local_hour_pct - hour_mean) / hour_std

            day_mean = 1/7
            day_std = np.std(sig.day_distribution) if np.std(sig.day_distribution) > 0 else 0.1
            df.at[idx, 'local_day_z'] = (local_day_pct - day_mean) / day_std

            # Concentration scores
            df.at[idx, 'hour_concentration'] = sig.hour_concentration
            df.at[idx, 'day_concentration'] = sig.day_concentration

            # Is this a peak time for this location?
            df.at[idx, 'is_peak_hour'] = 1 if hour in sig.peak_hours else 0
            df.at[idx, 'is_peak_day'] = 1 if day in sig.peak_days else 0

            # Detection method distribution
            df.at[idx, 'method_radar_pct'] = sig.method_distribution.get('radar', 0)
            df.at[idx, 'method_laser_pct'] = sig.method_distribution.get('laser', 0)

            # Strictness encoding
            strictness_map = {'strict': -1, 'moderate': 0, 'lenient': 1}
            df.at[idx, 'location_strictness'] = strictness_map.get(sig.strictness_level, 0)
        else:
            # No signature for this location - use global averages
            df.at[idx, 'hour_affinity'] = 0
            df.at[idx, 'day_affinity'] = 0

    return df


def extract_all_location_signatures(
    violations_df: pd.DataFrame,
    min_stops: int = 10
) -> Dict[str, LocationSignature]:
    """
    Extract signatures for all grid cells with sufficient data.

    Args:
        violations_df: DataFrame with violations (needs lat, lng, time columns)
        min_stops: Minimum stops required to compute signature

    Returns:
        Dict mapping grid_id to LocationSignature
    """
    df = violations_df.copy()

    # Ensure we have required columns
    if 'grid_lat' not in df.columns:
        from feature_engineering import round_to_grid
        df['grid_lat'] = df['latitude'].apply(round_to_grid)
        df['grid_lng'] = df['longitude'].apply(round_to_grid)

    if 'hour' not in df.columns and 'stop_time' in df.columns:
        df['hour'] = pd.to_datetime(df['stop_time'].astype(str)).dt.hour

    if 'day_of_week' not in df.columns and 'stop_date' in df.columns:
        df['day_of_week'] = pd.to_datetime(df['stop_date']).dt.dayofweek

    # Create grid IDs
    df['grid_id'] = df.apply(
        lambda row: f"{row['grid_lat']:.3f}_{row['grid_lng']:.3f}",
        axis=1
    )

    # Compute global distributions
    global_hour_dist, global_day_dist = compute_global_distributions(df)

    # Global average speed over
    global_avg_speed = df['speed_over'].mean() if 'speed_over' in df.columns else 15

    # Extract signatures for each grid cell
    signatures = {}
    grid_groups = df.groupby('grid_id')

    print(f"  Extracting signatures for {len(grid_groups)} grid cells...")

    for grid_id, group in grid_groups:
        if len(group) < min_stops:
            continue

        lat = group['grid_lat'].iloc[0]
        lng = group['grid_lng'].iloc[0]

        sig = compute_location_signature(
            grid_df=group,
            grid_id=grid_id,
            lat=lat,
            lng=lng,
            global_hour_dist=global_hour_dist,
            global_day_dist=global_day_dist,
            global_avg_speed_over=global_avg_speed
        )

        signatures[grid_id] = sig

    print(f"  Extracted {len(signatures)} location signatures")

    return signatures


def compute_statistical_features(
    df: pd.DataFrame,
    location_signatures: Dict[str, LocationSignature]
) -> pd.DataFrame:
    """
    Add statistical significance features to each sample.
    """
    df = df.copy()

    df['grid_id'] = df.apply(
        lambda row: f"{row['grid_lat']:.3f}_{row['grid_lng']:.3f}",
        axis=1
    )

    # Initialize columns
    df['pattern_significant'] = 0
    df['hour_chi2'] = 0.0
    df['hour_pvalue'] = 1.0
    df['day_chi2'] = 0.0
    df['day_pvalue'] = 1.0

    for idx, row in df.iterrows():
        grid_id = row['grid_id']
        if grid_id in location_signatures:
            sig = location_signatures[grid_id]
            df.at[idx, 'pattern_significant'] = 1 if sig.is_significant else 0
            df.at[idx, 'hour_chi2'] = sig.hour_chi2
            df.at[idx, 'hour_pvalue'] = sig.hour_pvalue
            df.at[idx, 'day_chi2'] = sig.day_chi2
            df.at[idx, 'day_pvalue'] = sig.day_pvalue

    return df


def get_enhanced_feature_columns() -> List[str]:
    """
    Return the list of all feature columns including advanced features.
    """
    base_features = [
        'grid_lat', 'grid_lng',
        'hour_sin', 'hour_cos',
        'dow_sin', 'dow_cos',
        'stop_count_grid',
        'avg_speed_over',
        'alcohol_pct', 'accident_pct',
        'radar_pct', 'laser_pct',
        'is_weekend', 'is_rush_hour', 'is_night'
    ]

    interaction_features = [
        'hour_affinity',
        'day_affinity',
        'local_hour_z',
        'local_day_z',
        'hour_concentration',
        'day_concentration',
        'is_peak_hour',
        'is_peak_day',
        'method_radar_pct',
        'method_laser_pct',
        'location_strictness'
    ]

    statistical_features = [
        'pattern_significant',
        'hour_chi2',
        'hour_pvalue'
    ]

    return base_features + interaction_features + statistical_features


def convert_numpy_types(obj):
    """Recursively convert numpy types to Python native types for JSON serialization."""
    if isinstance(obj, dict):
        return {k: convert_numpy_types(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [convert_numpy_types(item) for item in obj]
    elif isinstance(obj, (np.integer, np.int64, np.int32)):
        return int(obj)
    elif isinstance(obj, (np.floating, np.float64, np.float32)):
        return float(obj)
    elif isinstance(obj, (np.bool_, bool)):
        return bool(obj)
    elif isinstance(obj, np.ndarray):
        return obj.tolist()
    else:
        return obj


def signature_to_dict(sig: LocationSignature) -> Dict[str, Any]:
    """Convert LocationSignature to JSON-serializable dict."""
    raw_dict = asdict(sig)
    return convert_numpy_types(raw_dict)


def signatures_to_json(signatures: Dict[str, LocationSignature]) -> Dict[str, Any]:
    """Convert all signatures to JSON-serializable format."""
    return {grid_id: signature_to_dict(sig) for grid_id, sig in signatures.items()}


if __name__ == "__main__":
    print("Advanced Features Module")
    print("=" * 50)

    # Test entropy computation
    uniform_dist = [1/24] * 24
    concentrated_dist = [0.5, 0.3, 0.1, 0.1] + [0] * 20

    print(f"Uniform entropy: {compute_entropy(uniform_dist):.3f}")
    print(f"Concentrated entropy: {compute_entropy(concentrated_dist):.3f}")

    print(f"Uniform concentration: {compute_concentration(uniform_dist, 24):.3f}")
    print(f"Concentrated concentration: {compute_concentration(concentrated_dist, 24):.3f}")

    # Test affinity
    print(f"\nHour affinity (20% local vs 5% global): {compute_hour_affinity(0.20, 0.05):.1f}")
    print(f"Hour affinity (5% local vs 5% global): {compute_hour_affinity(0.05, 0.05):.1f}")
    print(f"Hour affinity (2% local vs 5% global): {compute_hour_affinity(0.02, 0.05):.1f}")

    # Test chi-square
    observed = {8: 50, 9: 45, 10: 5}  # Concentrated at 8-9am
    result = test_temporal_significance(observed, n_categories=24)
    print(f"\nChi-square test: chi2={result['chi2']:.1f}, p={result['pvalue']:.4f}, sig={result['is_significant']}")
