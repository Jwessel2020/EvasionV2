"""
Pattern Discovery Module for Speed Trap Intelligence

This module discovers non-obvious patterns across locations:
- Time clusters: Groups of locations with similar temporal patterns
- Method zones: Geographic clusters by detection method preference
- Quota effects: Statistical test for end-of-month enforcement spikes
- Anomaly detection: Statistically significant deviations from expected behavior

These patterns answer questions like:
"We discovered 12 locations with similar morning rush patterns forming a cluster along Route 29"
"""

import numpy as np
import pandas as pd
from scipy import stats
from scipy.cluster.hierarchy import linkage, fcluster
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
from typing import Dict, List, Tuple, Optional, Any
from dataclasses import dataclass, asdict
from datetime import datetime, timedelta
import warnings

warnings.filterwarnings('ignore')


@dataclass
class DiscoveredPattern:
    """A pattern discovered by ML analysis."""
    pattern_id: str
    pattern_type: str  # 'time_cluster', 'method_zone', 'quota_effect', 'day_pattern'
    name: str
    description: str
    location_count: int
    locations: List[Dict[str, Any]]
    confidence: float
    statistics: Dict[str, Any]
    insight: str


@dataclass
class Anomaly:
    """A statistically significant anomaly at a location."""
    grid_id: str
    lat: float
    lng: float
    anomaly_type: str  # 'temporal_spike', 'method_shift', 'enforcement_surge'
    description: str
    z_score: float
    p_value: float
    expected_value: float
    actual_value: float
    insight: str
    detected_at: str


def discover_time_clusters(
    location_signatures: Dict[str, Any],
    n_clusters: int = 5,
    min_cluster_size: int = 3
) -> List[DiscoveredPattern]:
    """
    Find groups of locations with similar temporal patterns.

    Uses KMeans clustering on hour_distribution vectors to find:
    - "Morning rush cluster" (7-9am peak)
    - "Afternoon cluster" (2-4pm peak)
    - "All-day steady" (uniform distribution)
    - "Evening cluster" (5-7pm peak)

    Args:
        location_signatures: Dict of grid_id -> LocationSignature
        n_clusters: Number of clusters to find
        min_cluster_size: Minimum locations to form a valid cluster

    Returns:
        List of discovered temporal patterns
    """
    if len(location_signatures) < n_clusters:
        return []

    # Extract hour distributions as feature vectors
    grid_ids = list(location_signatures.keys())
    hour_vectors = []

    for grid_id in grid_ids:
        sig = location_signatures[grid_id]
        if hasattr(sig, 'hour_distribution'):
            hour_vectors.append(sig.hour_distribution)
        elif isinstance(sig, dict) and 'hour_distribution' in sig:
            hour_vectors.append(sig['hour_distribution'])
        else:
            hour_vectors.append([1/24] * 24)

    X = np.array(hour_vectors)

    # Normalize features
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    # Cluster using KMeans
    kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
    cluster_labels = kmeans.fit_predict(X_scaled)

    # Analyze each cluster
    patterns = []
    cluster_names = {
        'morning': (6, 10),
        'midday': (10, 14),
        'afternoon': (14, 18),
        'evening': (18, 22),
        'night': (22, 6)
    }

    for cluster_id in range(n_clusters):
        cluster_mask = cluster_labels == cluster_id
        cluster_indices = np.where(cluster_mask)[0]

        if len(cluster_indices) < min_cluster_size:
            continue

        cluster_grid_ids = [grid_ids[i] for i in cluster_indices]
        cluster_hour_vectors = X[cluster_mask]

        # Average hour distribution for this cluster
        avg_hour_dist = cluster_hour_vectors.mean(axis=0)

        # Find peak hours
        peak_hour = int(np.argmax(avg_hour_dist))
        peak_hours = sorted(range(24), key=lambda h: avg_hour_dist[h], reverse=True)[:3]

        # Determine cluster name based on peak
        cluster_name = "General"
        for name, (start, end) in cluster_names.items():
            if start <= peak_hour < end or (name == 'night' and (peak_hour >= 22 or peak_hour < 6)):
                cluster_name = name.title()
                break

        # Compute cluster statistics
        concentration = 1 - (stats.entropy(avg_hour_dist) / np.log(24))

        # Build location list
        locations = []
        for grid_id in cluster_grid_ids:
            sig = location_signatures[grid_id]
            if hasattr(sig, 'lat'):
                locations.append({
                    'gridId': grid_id,
                    'lat': sig.lat,
                    'lng': sig.lng
                })
            elif isinstance(sig, dict):
                locations.append({
                    'gridId': grid_id,
                    'lat': sig.get('lat', 0),
                    'lng': sig.get('lng', 0)
                })

        pattern = DiscoveredPattern(
            pattern_id=f"time_cluster_{cluster_id}",
            pattern_type="time_cluster",
            name=f"{cluster_name} Rush Cluster",
            description=f"{len(cluster_grid_ids)} locations with {int(concentration*100)}%+ stops during {peak_hours[0]}:00-{peak_hours[0]+1}:00",
            location_count=len(cluster_grid_ids),
            locations=locations,
            confidence=min(0.95, 0.5 + concentration * 0.5),
            statistics={
                'avg_hour_distribution': avg_hour_dist.tolist(),
                'peak_hours': peak_hours,
                'concentration': round(concentration, 3),
                'cluster_size': len(cluster_grid_ids)
            },
            insight=f"{len(cluster_grid_ids)} locations show concentrated enforcement at {format_hours(peak_hours[:2])}. "
                    f"Average concentration: {int(concentration*100)}%."
        )
        patterns.append(pattern)

    return patterns


def discover_method_zones(
    location_signatures: Dict[str, Any],
    method_threshold: float = 0.7,
    min_zone_size: int = 3
) -> List[DiscoveredPattern]:
    """
    Find geographic clusters by detection method preference.

    Returns patterns like:
    - "Radar corridor along Route 29" (75%+ radar)
    - "Laser zone near I-66" (60%+ laser)

    Args:
        location_signatures: Dict of grid_id -> LocationSignature
        method_threshold: Minimum percentage to be considered method-dominant
        min_zone_size: Minimum locations to form a zone

    Returns:
        List of discovered method zone patterns
    """
    patterns = []

    # Group by dominant method
    method_groups = {'radar': [], 'laser': [], 'vascar': [], 'other': []}

    for grid_id, sig in location_signatures.items():
        if hasattr(sig, 'method_distribution'):
            method_dist = sig.method_distribution
        elif isinstance(sig, dict) and 'method_distribution' in sig:
            method_dist = sig['method_distribution']
        else:
            continue

        for method, pct in method_dist.items():
            if pct >= method_threshold:
                method_key = method.lower() if method.lower() in method_groups else 'other'
                if hasattr(sig, 'lat'):
                    method_groups[method_key].append({
                        'gridId': grid_id,
                        'lat': sig.lat,
                        'lng': sig.lng,
                        'pct': pct
                    })
                elif isinstance(sig, dict):
                    method_groups[method_key].append({
                        'gridId': grid_id,
                        'lat': sig.get('lat', 0),
                        'lng': sig.get('lng', 0),
                        'pct': pct
                    })

    # Create patterns for significant method zones
    for method, locations in method_groups.items():
        if len(locations) < min_zone_size:
            continue

        avg_pct = np.mean([loc['pct'] for loc in locations])

        pattern = DiscoveredPattern(
            pattern_id=f"method_zone_{method}",
            pattern_type="method_zone",
            name=f"{method.title()} Detection Zone",
            description=f"{len(locations)} locations with {int(avg_pct*100)}%+ {method} detection",
            location_count=len(locations),
            locations=locations,
            confidence=min(0.95, avg_pct),
            statistics={
                'method': method,
                'avg_percentage': round(avg_pct, 3),
                'zone_size': len(locations)
            },
            insight=f"Concentrated {method} enforcement zone: {len(locations)} locations "
                    f"averaging {int(avg_pct*100)}% {method} detection."
        )
        patterns.append(pattern)

    return patterns


def test_quota_effect(
    violations_df: pd.DataFrame,
    significance_level: float = 0.05
) -> Optional[DiscoveredPattern]:
    """
    Statistical test: Do stops increase at end of month?

    H0: Uniform distribution across days 1-31
    Returns pattern if significant quota effect detected.

    Args:
        violations_df: DataFrame with stop_date column
        significance_level: P-value threshold for significance

    Returns:
        DiscoveredPattern if quota effect detected, None otherwise
    """
    df = violations_df.copy()

    if 'stop_date' not in df.columns:
        return None

    df['day_of_month'] = pd.to_datetime(df['stop_date']).dt.day

    # Split into early (1-20) and late (21-31) month
    early_count = len(df[df['day_of_month'] <= 20])
    late_count = len(df[df['day_of_month'] > 20])

    # Expected: proportional to number of days
    total = early_count + late_count
    expected_early = total * (20 / 31)
    expected_late = total * (11 / 31)

    # Chi-square test
    observed = [early_count, late_count]
    expected = [expected_early, expected_late]

    chi2, pvalue = stats.chisquare(observed, f_exp=expected)

    # Calculate effect size (percentage increase in late month)
    early_daily_avg = early_count / 20
    late_daily_avg = late_count / 11
    effect_size = (late_daily_avg - early_daily_avg) / early_daily_avg if early_daily_avg > 0 else 0

    if pvalue < significance_level and effect_size > 0.1:  # At least 10% increase
        # Find which locations show the strongest effect
        location_effects = []
        if 'latitude' in df.columns:
            for (lat, lng), group in df.groupby([
                df['latitude'].round(3),
                df['longitude'].round(3)
            ]):
                early = len(group[group['day_of_month'] <= 20])
                late = len(group[group['day_of_month'] > 20])
                if early > 5 and late > 2:
                    loc_effect = (late / 11) / (early / 20) - 1 if early > 0 else 0
                    if loc_effect > 0.2:
                        location_effects.append({
                            'gridId': f"{lat:.3f}_{lng:.3f}",
                            'lat': lat,
                            'lng': lng,
                            'effect': loc_effect
                        })

        location_effects.sort(key=lambda x: x['effect'], reverse=True)

        return DiscoveredPattern(
            pattern_id="quota_effect",
            pattern_type="quota_effect",
            name="End-of-Month Enforcement Spike",
            description=f"{len(location_effects)} locations show {int(effect_size*100)}%+ increase on days 21-31",
            location_count=len(location_effects),
            locations=location_effects[:10],  # Top 10
            confidence=1 - pvalue,
            statistics={
                'chi2': round(chi2, 2),
                'pvalue': round(pvalue, 4),
                'effect_size': round(effect_size, 3),
                'early_daily_avg': round(early_daily_avg, 1),
                'late_daily_avg': round(late_daily_avg, 1)
            },
            insight=f"Statistical evidence of quota effect: {int(effect_size*100)}% more stops per day "
                    f"in final 11 days of month (p={pvalue:.4f})."
        )

    return None


def discover_day_patterns(
    location_signatures: Dict[str, Any],
    min_concentration: float = 0.3
) -> List[DiscoveredPattern]:
    """
    Find locations with significant day-of-week patterns.

    Discovers patterns like:
    - "Tuesday/Thursday enforcement cluster"
    - "Weekend-only enforcement zone"
    """
    patterns = []
    day_names = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

    # Group by peak day pattern
    weekday_heavy = []  # Mon-Fri concentrated
    weekend_heavy = []  # Sat-Sun concentrated
    specific_days = {i: [] for i in range(7)}

    for grid_id, sig in location_signatures.items():
        if hasattr(sig, 'day_distribution'):
            day_dist = sig.day_distribution
            day_conc = sig.day_concentration
        elif isinstance(sig, dict):
            day_dist = sig.get('day_distribution', [1/7]*7)
            day_conc = sig.get('day_concentration', 0)
        else:
            continue

        if day_conc < min_concentration:
            continue

        weekday_pct = sum(day_dist[:5])
        weekend_pct = sum(day_dist[5:])

        loc_info = {
            'gridId': grid_id,
            'lat': sig.lat if hasattr(sig, 'lat') else sig.get('lat', 0),
            'lng': sig.lng if hasattr(sig, 'lng') else sig.get('lng', 0),
            'concentration': day_conc
        }

        if weekday_pct > 0.85:
            weekday_heavy.append(loc_info)
        elif weekend_pct > 0.4:  # Weekends are 2/7 ≈ 0.28, so 0.4 is significant
            weekend_heavy.append(loc_info)
        else:
            # Check for specific day concentration
            peak_day = int(np.argmax(day_dist))
            if day_dist[peak_day] > 0.25:  # More than 25% on one day
                specific_days[peak_day].append(loc_info)

    # Create patterns
    if len(weekday_heavy) >= 3:
        patterns.append(DiscoveredPattern(
            pattern_id="weekday_pattern",
            pattern_type="day_pattern",
            name="Weekday Enforcement Zone",
            description=f"{len(weekday_heavy)} locations with 85%+ weekday enforcement",
            location_count=len(weekday_heavy),
            locations=weekday_heavy,
            confidence=0.85,
            statistics={'weekday_percentage': 0.85},
            insight=f"{len(weekday_heavy)} locations primarily enforce Monday-Friday."
        ))

    if len(weekend_heavy) >= 3:
        patterns.append(DiscoveredPattern(
            pattern_id="weekend_pattern",
            pattern_type="day_pattern",
            name="Weekend Enforcement Zone",
            description=f"{len(weekend_heavy)} locations with elevated weekend enforcement",
            location_count=len(weekend_heavy),
            locations=weekend_heavy,
            confidence=0.80,
            statistics={'weekend_elevated': True},
            insight=f"{len(weekend_heavy)} locations show elevated weekend enforcement."
        ))

    # Specific day patterns
    for day_num, locations in specific_days.items():
        if len(locations) >= 3:
            patterns.append(DiscoveredPattern(
                pattern_id=f"day_pattern_{day_names[day_num].lower()}",
                pattern_type="day_pattern",
                name=f"{day_names[day_num]} Enforcement Pattern",
                description=f"{len(locations)} locations with concentrated {day_names[day_num]} enforcement",
                location_count=len(locations),
                locations=locations,
                confidence=0.75,
                statistics={'peak_day': day_names[day_num]},
                insight=f"{len(locations)} locations show significant {day_names[day_num]} enforcement concentration."
            ))

    return patterns


def detect_anomalies(
    violations_df: pd.DataFrame,
    location_signatures: Dict[str, Any],
    z_threshold: float = 2.0
) -> List[Anomaly]:
    """
    Find statistically significant anomalies.

    Anomaly types:
    - temporal_spike: Unusual enforcement at specific time vs historical
    - enforcement_surge: Recent spike in overall enforcement
    - method_shift: Change in detection method usage

    Args:
        violations_df: DataFrame with violations
        location_signatures: Pre-computed signatures
        z_threshold: Z-score threshold for anomaly detection

    Returns:
        List of detected anomalies
    """
    anomalies = []
    df = violations_df.copy()

    # Ensure temporal columns
    if 'hour' not in df.columns and 'stop_time' in df.columns:
        df['hour'] = pd.to_datetime(df['stop_time'].astype(str)).dt.hour
    if 'day_of_week' not in df.columns and 'stop_date' in df.columns:
        df['day_of_week'] = pd.to_datetime(df['stop_date']).dt.dayofweek

    # Create grid_id
    if 'grid_id' not in df.columns:
        df['grid_id'] = df.apply(
            lambda row: f"{round(row['latitude'], 3):.3f}_{round(row['longitude'], 3):.3f}",
            axis=1
        )

    # Global statistics for comparison
    global_hour_counts = df.groupby('hour').size()
    global_hour_mean = global_hour_counts.mean()
    global_hour_std = global_hour_counts.std()

    # Check each location for anomalies
    for grid_id, sig in location_signatures.items():
        grid_df = df[df['grid_id'] == grid_id]
        if len(grid_df) < 10:
            continue

        lat = sig.lat if hasattr(sig, 'lat') else sig.get('lat', 0)
        lng = sig.lng if hasattr(sig, 'lng') else sig.get('lng', 0)

        # Get hour distribution
        if hasattr(sig, 'hour_distribution'):
            hour_dist = sig.hour_distribution
        else:
            hour_dist = sig.get('hour_distribution', [1/24]*24)

        # Check for temporal spikes
        hour_counts = grid_df.groupby('hour').size()
        for hour, count in hour_counts.items():
            hour_int = int(hour)  # Ensure hour is an integer index
            expected = len(grid_df) * (1/24)  # Uniform expectation
            local_expected = len(grid_df) * hour_dist[hour_int] if hour_int < len(hour_dist) else expected

            # Compare to what's expected for this location
            if local_expected > 0:
                z_score = (count - local_expected) / max(np.sqrt(local_expected), 1)

                if abs(z_score) > z_threshold:
                    pvalue = 2 * (1 - stats.norm.cdf(abs(z_score)))

                    anomalies.append(Anomaly(
                        grid_id=grid_id,
                        lat=lat,
                        lng=lng,
                        anomaly_type='temporal_spike',
                        description=f"Unusual {'high' if z_score > 0 else 'low'} {hour}:00 enforcement",
                        z_score=round(z_score, 2),
                        p_value=round(pvalue, 4),
                        expected_value=round(local_expected, 1),
                        actual_value=int(count),
                        insight=f"{int(abs(count - local_expected))} {'more' if z_score > 0 else 'fewer'} stops at {hour}:00 than expected (z={z_score:.1f})",
                        detected_at=datetime.now().isoformat()
                    ))

    # Sort by z-score magnitude
    anomalies.sort(key=lambda x: abs(x.z_score), reverse=True)

    return anomalies[:20]  # Return top 20 anomalies


def detect_recent_changes(
    violations_df: pd.DataFrame,
    lookback_days: int = 90,
    comparison_days: int = 180
) -> List[Anomaly]:
    """
    Detect recent changes in enforcement patterns.

    Compares recent period to historical baseline.
    """
    anomalies = []
    df = violations_df.copy()

    if 'stop_date' not in df.columns:
        return anomalies

    df['stop_date'] = pd.to_datetime(df['stop_date'])
    max_date = df['stop_date'].max()
    recent_start = max_date - timedelta(days=lookback_days)
    historical_start = max_date - timedelta(days=comparison_days)

    recent_df = df[df['stop_date'] >= recent_start]
    historical_df = df[(df['stop_date'] >= historical_start) & (df['stop_date'] < recent_start)]

    if len(recent_df) < 10 or len(historical_df) < 10:
        return anomalies

    # Create grid_id
    for frame in [recent_df, historical_df]:
        if 'grid_id' not in frame.columns:
            frame['grid_id'] = frame.apply(
                lambda row: f"{round(row['latitude'], 3):.3f}_{round(row['longitude'], 3):.3f}",
                axis=1
            )

    # Compare by location
    recent_counts = recent_df.groupby('grid_id').size()
    historical_counts = historical_df.groupby('grid_id').size()

    # Normalize by time period
    recent_daily = recent_counts / lookback_days
    historical_daily = historical_counts / (comparison_days - lookback_days)

    for grid_id in recent_counts.index:
        if grid_id not in historical_counts.index:
            continue

        recent_rate = recent_daily[grid_id]
        historical_rate = historical_daily[grid_id]

        if historical_rate > 0:
            change_ratio = recent_rate / historical_rate
            if change_ratio > 2.0 or change_ratio < 0.5:
                # Get location info
                loc_df = recent_df[recent_df['grid_id'] == grid_id].iloc[0]

                anomalies.append(Anomaly(
                    grid_id=grid_id,
                    lat=round(loc_df['latitude'], 3),
                    lng=round(loc_df['longitude'], 3),
                    anomaly_type='enforcement_surge' if change_ratio > 1 else 'enforcement_drop',
                    description=f"{'Increased' if change_ratio > 1 else 'Decreased'} enforcement in past {lookback_days} days",
                    z_score=round(np.log2(change_ratio), 2),
                    p_value=0.01,  # Simplified
                    expected_value=round(historical_rate * lookback_days, 1),
                    actual_value=int(recent_counts[grid_id]),
                    insight=f"{int(change_ratio * 100 - 100):+d}% change in enforcement rate vs prior period",
                    detected_at=datetime.now().isoformat()
                ))

    anomalies.sort(key=lambda x: abs(x.z_score), reverse=True)
    return anomalies[:10]


def discover_all_patterns(
    violations_df: pd.DataFrame,
    location_signatures: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Run all pattern discovery algorithms.

    Returns comprehensive pattern analysis.
    """
    print("  Discovering temporal clusters...")
    time_clusters = discover_time_clusters(location_signatures)

    print("  Discovering detection method zones...")
    method_zones = discover_method_zones(location_signatures)

    print("  Testing for quota effect...")
    quota_effect = test_quota_effect(violations_df)

    print("  Discovering day-of-week patterns...")
    day_patterns = discover_day_patterns(location_signatures)

    print("  Detecting anomalies...")
    anomalies = detect_anomalies(violations_df, location_signatures)

    print("  Detecting recent changes...")
    recent_changes = detect_recent_changes(violations_df)

    all_patterns = time_clusters + method_zones + day_patterns
    if quota_effect:
        all_patterns.append(quota_effect)

    all_anomalies = anomalies + recent_changes

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

    return {
        'patterns': [convert_numpy_types(asdict(p)) for p in all_patterns],
        'anomalies': [convert_numpy_types(asdict(a)) for a in all_anomalies],
        'summary': {
            'total_patterns': len(all_patterns),
            'time_clusters': len(time_clusters),
            'method_zones': len(method_zones),
            'day_patterns': len(day_patterns),
            'quota_effect_detected': quota_effect is not None,
            'total_anomalies': len(all_anomalies)
        }
    }


def format_hours(hours: List[int]) -> str:
    """Format hour list as readable range."""
    if not hours:
        return ""
    hours = sorted(hours)
    if len(hours) == 1:
        return f"{hours[0]}:00"
    return f"{hours[0]}:00-{hours[-1]+1}:00"


if __name__ == "__main__":
    print("Pattern Discovery Module")
    print("=" * 50)

    # Test chi-square for quota effect
    observed = [800, 500]  # Early vs late month
    expected = [800 * 20/31, 800 * 11/31 + 500 - 800 * 11/31]  # Proportional
    chi2, pvalue = stats.chisquare(observed, f_exp=[1300 * 20/31, 1300 * 11/31])
    print(f"Quota test: chi2={chi2:.2f}, p={pvalue:.4f}")

    # Test z-score
    z = (50 - 30) / 5
    print(f"Z-score example: (50-30)/5 = {z}")
