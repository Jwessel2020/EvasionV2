# Evasion V2 - Traffic Violation Analytics Platform

A comprehensive web application for analyzing traffic stop data with interactive maps, real-time filtering, and detailed analytics.

## Features

- 📍 **Interactive Map Visualization** - View traffic stops on an interactive map with clustering and heat mapping
- 🎯 **Speed Trap Detection** - Identify likely speed trap locations using stationary radar/laser detection patterns
- 📊 **Advanced Analytics** - Drill down into specific areas with detailed statistics and breakdowns
- 🔍 **Multi-Filter System** - Filter by vehicle make, violation type, speed, time, location, and more
- 🗺️ **Area Selection Tool** - Draw custom areas on the map to analyze specific regions
- 💨 **Real-time Updates** - Dynamic filtering with instant map updates
- 📱 **Responsive Design** - Works on desktop and mobile devices

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or higher) - [Download](https://nodejs.org/)
- **PostgreSQL** (v14 or higher) - [Download](https://www.postgresql.org/download/)
- **Git** - [Download](https://git-scm.com/downloads)

## Installation

### 1. Clone the Repository

```bash
git clone <your-repository-url>
cd V2
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Database Setup

Create a PostgreSQL database:

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE evasion;
\q
```

### 4. Configure Environment Variables

Create a `.env` file in the root directory:

```bash
# Database
DATABASE_URL="postgresql://postgres:your_password@localhost:5432/evasion"

# Optional: Mapbox token for custom map styles
NEXT_PUBLIC_MAPBOX_TOKEN="your_mapbox_token_here"
```

**Note:** Replace `your_password` with your PostgreSQL password.

### 5. Run Database Migrations

```bash
npx prisma generate
npx prisma migrate dev
```

### 6. Import Traffic Data

**Get the Data Files:**
- Obtain the traffic violation CSV files from the project maintainer
- Place them in a folder called `Police data/` in the project root

**Import the Data:**

```bash
npm run db:import
```

This will:
- Parse CSV files from the `Police data/` directory
- Detect speed-related violations
- Calculate geographic hotspots
- Import data into PostgreSQL

**Note:** The import process may take several minutes depending on dataset size.

### 7. Start the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
V2/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── (dashboard)/        # Main application pages
│   │   │   ├── analytics/      # Analytics dashboard with map
│   │   │   ├── events/         # Events management
│   │   │   └── forums/         # Community forums
│   │   └── api/                # API routes
│   │       ├── analytics/      # Analytics endpoints
│   │       ├── events/         # Events endpoints
│   │       └── forum/          # Forum endpoints
│   ├── components/             # React components
│   │   ├── analytics/          # Analytics charts & stats
│   │   ├── map/                # Map components & layers
│   │   └── ui/                 # Reusable UI components
│   ├── lib/                    # Utility functions
│   ├── models/                 # Data models & schemas
│   └── styles/                 # Global styles
├── prisma/                     # Database schema & migrations
├── public/                     # Static assets
└── scripts/                    # Utility scripts (import, etc.)
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run db:import` - Import CSV data into database
- `npx prisma studio` - Open Prisma Studio (database GUI)
- `npx prisma generate` - Generate Prisma client
- `npx prisma migrate dev` - Run database migrations

## Using the Application

### Analytics Dashboard

1. **Map View** - Navigate the map to explore traffic stop locations
2. **Filters Panel** (top-left):
   - **Violation Type** - Citations, Warnings, etc.
   - **Incident Type** - Alcohol, Accidents, Search Conducted
   - **Speed Violations** - Filter by speed-related stops
   - **Detection Method** - Radar, Laser, VASCAR, Patrol
   - **Vehicle Make** - Filter by car manufacturer (dynamic list)
   - **Time Filters** - Filter by hour, day, or year
   - **Speed Thresholds** - 10+, 15+, 20+, 25+, 30+ mph over limit

3. **View Controls** (top-right):
   - **Points** - Toggle individual stop markers
   - **Clustered/All Points** - Switch between clustered and all points view
   - **Heatmap** - Toggle heat map visualization
   - **Speed Traps** - Show likely speed trap locations

4. **Area Analysis Tool**:
   - Click "Analyze Area" button
   - Draw a rectangle on the map
   - View detailed statistics for the selected area

### Clicking Map Points

Click any point on the map to see:
- Stop description
- Violation type
- Vehicle information (make, model, year)
- District/location
- Speed data (if applicable)
- Alcohol/accident indicators

## Technology Stack

- **Frontend:**
  - [Next.js 14](https://nextjs.org/) - React framework
  - [TypeScript](https://www.typescriptlang.org/) - Type safety
  - [Tailwind CSS](https://tailwindcss.com/) - Styling
  - [Mapbox GL JS](https://docs.mapbox.com/mapbox-gl-js/) - Interactive maps
  - [Recharts](https://recharts.org/) - Data visualization

- **Backend:**
  - [PostgreSQL](https://www.postgresql.org/) - Database
  - [Prisma](https://www.prisma.io/) - ORM
  - Next.js API Routes - RESTful API

- **Database Features:**
  - Spatial indexing for fast geographic queries
  - Computed columns for speed analysis
  - Materialized views for hotspot detection

## Performance Optimization

The application uses several optimization techniques:

- **Spatial Sampling** - Dynamic point sampling based on zoom level
- **Query Limits** - Automatic result limiting (5,000-10,000 points)
- **Sequential Queries** - Area drill-down uses sequential queries to prevent memory issues
- **Clustering** - Mapbox clustering for better performance with many points
- **Caching** - API response caching for frequently accessed data

## Troubleshooting

### Database Connection Issues

If you see "Failed to fetch points" errors:

1. Check PostgreSQL is running: `sudo systemctl status postgresql` (Linux) or check Services (Windows)
2. Verify `.env` DATABASE_URL is correct
3. Test connection: `psql $DATABASE_URL`

### Import Fails

If `npm run db:import` fails:

1. Ensure CSV files are in `Police data/` folder
2. Check CSV format matches expected schema
3. Verify database has sufficient disk space
4. Check logs in `logs/` directory

### Map Not Loading

1. Clear browser cache
2. Check browser console for errors
3. Verify Mapbox token (if using custom styles)
4. Ensure data was imported successfully

### Build Errors

```bash
# Clear Next.js cache
rm -rf .next

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Rebuild
npm run build
```

## Data Privacy

- Traffic stop data may contain sensitive information
- Ensure compliance with local privacy laws
- The dataset is excluded from version control (`.gitignore`)
- Data files must be shared separately and securely

## Contributing

1. Create a feature branch: `git checkout -b feature-name`
2. Make your changes
3. Test thoroughly
4. Commit: `git commit -m "Add feature description"`
5. Push: `git push origin feature-name`
6. Create a Pull Request

## License

This project is for educational and research purposes.

## Support

For issues or questions:
- Open an issue on GitHub
- Contact the project maintainer

---

Built with ❤️ using Next.js and Mapbox
