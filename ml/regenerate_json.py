"""
Quick script to regenerate location_signatures and discovered_patterns JSON files.
Uses existing data in database - much faster than re-running entire pipeline.
"""

import os
import sys
import json
import psycopg2
import numpy as np
import pandas as pd
from dotenv import load_dotenv

# Add ml directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from advanced_features import (
    extract_all_location_signatures,
    signatures_to_json
)
from pattern_discovery import discover_all_patterns

# Load environment
env_path = os.path.join(os.path.dirname(__file__), '..', '.env.local')
load_dotenv(env_path)

MODEL_VERSION = "v2.0.0"


def get_database_connection():
    """Get PostgreSQL database connection."""
    # Parse DATABASE_URL if available, otherwise use defaults
    database_url = os.getenv('DATABASE_URL', '')
    if database_url:
        # Parse: postgresql://user:pass@host:port/database
        import re
        match = re.match(r'postgresql://([^:]+):([^@]+)@([^:]+):(\d+)/(.+)', database_url)
        if match:
            user, password, host, port, database = match.groups()
            return psycopg2.connect(
                host=host,
                port=int(port),
                database=database,
                user=user,
                password=password
            )

    # Fallback to individual env vars or defaults (Docker config)
    return psycopg2.connect(
        host=os.getenv('POSTGRES_HOST', 'localhost'),
        port=int(os.getenv('POSTGRES_PORT', 54322)),
        database=os.getenv('POSTGRES_DATABASE', 'evasion'),
        user=os.getenv('POSTGRES_USER', 'postgres'),
        password=os.getenv('POSTGRES_PASSWORD', 'postgres')
    )


def load_violations_data(conn) -> pd.DataFrame:
    """Load traffic violations from database."""
    query = """
    SELECT
        id,
        stop_date as date_of_stop,
        stop_time as time_of_stop,
        latitude,
        longitude,
        recorded_speed as speed,
        posted_limit as posted_speed,
        COALESCE(speed_over, recorded_speed - posted_limit, 0) as speed_over,
        description,
        detection_method,
        EXTRACT(HOUR FROM stop_time) as hour,
        EXTRACT(DOW FROM stop_date) as day_of_week,
        EXTRACT(MONTH FROM stop_date) as month,
        EXTRACT(DAY FROM stop_date) as day_of_month
    FROM traffic_violations
    WHERE latitude IS NOT NULL
      AND longitude IS NOT NULL
      AND is_speed_related = true
    """

    return pd.read_sql(query, conn)


def main():
    print("="*60)
    print("REGENERATING JSON FILES")
    print("="*60)

    # Connect to database
    print("\nConnecting to database...")
    conn = get_database_connection()
    print("  Connected successfully")

    try:
        # Load data
        print("\nLoading violations data...")
        violations_df = load_violations_data(conn)
        print(f"  Loaded {len(violations_df):,} violations")

        # Extract location signatures (computes global distributions internally)
        print("\nExtracting location signatures...")
        location_signatures = extract_all_location_signatures(violations_df)
        print(f"  Extracted {len(location_signatures):,} location signatures")

        # Discover patterns
        print("\nDiscovering patterns...")
        discovered_patterns = discover_all_patterns(violations_df, location_signatures)
        print(f"  Found {discovered_patterns['summary']['total_patterns']} patterns")
        print(f"  Found {discovered_patterns['summary']['total_anomalies']} anomalies")

        # Save to JSON files
        model_dir = os.path.join(os.path.dirname(__file__), 'models')
        os.makedirs(model_dir, exist_ok=True)

        # Save signatures
        print("\nSaving location signatures...")
        sig_path = os.path.join(model_dir, f'location_signatures_{MODEL_VERSION}.json')
        with open(sig_path, 'w') as f:
            json.dump(signatures_to_json(location_signatures), f)
        print(f"  Saved to: {sig_path}")

        # Save patterns
        print("\nSaving discovered patterns...")
        patterns_path = os.path.join(model_dir, f'discovered_patterns_{MODEL_VERSION}.json')
        with open(patterns_path, 'w') as f:
            json.dump(discovered_patterns, f, indent=2)
        print(f"  Saved to: {patterns_path}")

        print("\n" + "="*60)
        print("JSON FILES REGENERATED SUCCESSFULLY!")
        print("="*60)

    finally:
        conn.close()
        print("\nDatabase connection closed")


if __name__ == "__main__":
    main()
