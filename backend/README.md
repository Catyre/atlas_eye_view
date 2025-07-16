# No Man's Sky Backend Server

A Node.js/Express backend server for managing No Man's Sky star system coordinates and data.

## Features

- **Coordinate Management**: Update and retrieve 3D coordinates for star systems
- **Database Integration**: SQLite database with automatic schema updates
- **RESTful API**: Full CRUD operations for system data
- **Batch Operations**: Update multiple systems at once
- **Status Monitoring**: Track coordinate update progress
- **CORS Support**: Cross-origin requests enabled

## Prerequisites

- Node.js (version 14 or higher)
- SQLite database file (`euclid.sqlite`)

## Installation

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Ensure your SQLite database file (`euclid.sqlite`) is in the backend directory

## Usage

### Start the Server

```bash
npm start
```

Or for development with auto-restart:
```bash
npm run dev
```

The server will start on `http://localhost:3000`

### API Endpoints

#### GET `/systems`
Get all systems from the database.

**Response:**
```json
[
  {
    "id": 1,
    "name": "Sun Tzu",
    "A": 0.0,
    "B": 15.2,
    "C": 23.4,
    "D": 18.7,
    "ghc_x": 0.0,
    "ghc_y": 0.0,
    "ghc_z": 0.0,
    "is_anchor": true,
    "color": "#FFD700"
  }
]
```

#### POST `/update-coordinates`
Update coordinates for a single system.

**Request Body:**
```json
{
  "name": "Alpha Centauri",
  "ghc_x": 123.45,
  "ghc_y": 67.89,
  "ghc_z": -12.34
}
```

**Response:**
```json
{
  "success": true,
  "message": "Coordinates updated for Alpha Centauri",
  "changes": 1,
  "coordinates": {
    "ghc_x": 123.45,
    "ghc_y": 67.89,
    "ghc_z": -12.34
  }
}
```

#### POST `/batch-update-coordinates`
Update coordinates for multiple systems at once.

**Request Body:**
```json
{
  "updates": [
    {
      "name": "System 1",
      "ghc_x": 100.0,
      "ghc_y": 200.0,
      "ghc_z": 300.0
    },
    {
      "name": "System 2",
      "ghc_x": 150.0,
      "ghc_y": 250.0,
      "ghc_z": 350.0
    }
  ]
}
```

#### GET `/system/:name`
Get a specific system by name.

**Response:**
```json
{
  "id": 1,
  "name": "Sun Tzu",
  "A": 0.0,
  "B": 15.2,
  "C": 23.4,
  "D": 18.7,
  "ghc_x": 0.0,
  "ghc_y": 0.0,
  "ghc_z": 0.0,
  "is_anchor": true,
  "color": "#FFD700"
}
```

#### GET `/systems-with-coordinates`
Get all systems that have coordinates set.

**Response:**
```json
{
  "count": 150,
  "systems": [...]
}
```

#### GET `/coordinates-status`
Get the status of coordinate updates across all systems.

**Response:**
```json
{
  "total_systems": 200,
  "systems_with_coordinates": 150,
  "systems_without_coordinates": 50,
  "completion_percentage": "75.0"
}
```

#### GET `/health`
Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:45.123Z",
  "database": "connected"
}
```

## Database Schema

The server automatically adds coordinate columns to your existing database:

```sql
ALTER TABLE systems ADD COLUMN ghc_x REAL;
ALTER TABLE systems ADD COLUMN ghc_y REAL;
ALTER TABLE systems ADD COLUMN ghc_z REAL;
```

## Error Handling

The server includes comprehensive error handling:

- **400 Bad Request**: Invalid input data
- **404 Not Found**: System not found in database
- **500 Internal Server Error**: Database or server errors

## Logging

The server logs all coordinate updates and errors:

```
Updated coordinates for Sun Tzu: [0.00, 0.00, 0.00]
Updated coordinates for Alpha Centauri: [123.45, 67.89, -12.34]
```

## Integration with Frontend

The frontend (`main.js`) automatically calls the `/update-coordinates` endpoint after calculating each system's position using trilateration.

## Development

### Adding New Endpoints

1. Add the route handler in `server.js`
2. Include proper error handling
3. Add validation for input data
4. Update this README with endpoint documentation

### Database Changes

The server automatically handles adding new columns. For more complex schema changes, modify the `initializeDatabase()` function.

## Troubleshooting

### Common Issues

1. **Database not found**: Ensure `euclid.sqlite` exists in the backend directory
2. **Port already in use**: Change the PORT constant in `server.js`
3. **CORS errors**: The server includes CORS middleware, but check browser console for issues

### Debug Mode

Run with additional logging:
```bash
DEBUG=* npm start
```

## License

MIT License - see LICENSE file for details. 