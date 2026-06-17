## Atlas Eye View - Galactic Hub Cartography
#### Overview
This project is an interactive 3D map application designed for navigating the No Man's Sky Galactic Hub. Built with Three.js and Vite, it visualizes star systems, renders registered player bases, and interfaces directly with the Galactic Hub Wiki to provide up to date data from the Galactic hub.

#### Features
- 3D Astrometric Visualization: Full camera controls to navigate the Euclid and Calypso galaxies (potentially Eissentam in the future).
- Live Wiki Integration: Pulls and parses data from the Galactic Hub Miraheze Wiki directly into an in-app reader.
- Portal Glyph Decoder: Automatically calculates and displays NMS portal addresses from regional Hubtags.
- Progressive Web App: Fully installable on desktop, iOS, and Android with offline service worker support.
- Mobile Responsiveness: Custom UI overlays that dynamically adapt to portrait and landscape orientations on touch devices.
- Local Data Management: Save, export, and import surveyor notes into local browser storage.
- Galaxy Map Clone: The movement and camera behaviors of the map seek to mimic the in-game galaxy map.

#### Technology Stack
- 3D Rendering: Three.js with UnrealBloomPass post-processing.
- Camera Physics: camera-controls library for orbital and free-flight modes.
- Database: sql-wasm for loading local SQLite coordinate databases.
- Astrometry: Custom trilateration algorithms for coordinate mapping.

#### Controls
- W, A, S, D or Arrows: Pan and move through space
- Space / Q: Move camera vertically up
- Shift / E: Move camera vertically down
- C: Free cursor from camera lock to interact with UI elements
- F: Toggle visual rendering filters
- H: Toggle system text labels
- B: Toggle 3D base markers
- Left-Click: Lock onto a star system and open its data panel
- Right-Click or Long Press (mobile): Close the system panel and unlock the camera for free flight


## Technical Overview
### 1. Astrometry Engine: Multilateration
The core function of the astrometry engine is to translate abstract distance measurements (specifically, the distance from 4-5 predetermined anchors to the new star system) into precise 3D Cartesian coordinates $(x, y, z)$. This is necessary because, when rendering a 3D map, we need to know an $(x, y, z)$ coordinate of a star, but No Man's Sky never exposes these coordinates from their galaxy map, only relative distances. It is these relative distances that we use to convert into $(x, y, z)$ with multilateration, a variation of trilateration that accepts arbitrarily many known points (decreasing the error with each added point).

Initially, the system explored deterministic algebraic trilateration, which attempts to find the exact intersection of three spheres. However, user-submitted distances invariably contain measurement noise. When spheres fail to intersect perfectly, deterministic algebraic models fail, resulting in imaginary numbers (where $z^2 < 0$) and mirrored coordinate anomalies, which are very challenging to properly handle.

To solve this, the application relies heavily on the Bancroft method, a mathematical algorithm originally developed for GPS receivers to resolve the exact same issue with satellite ranging.

Once a star is placed with a high-confidence of correctness (its distance from the anchors and other high-confidence stars have an error near zero), its transformed coordinates, which I'm calling Galactic Hubspace Coordinates (or GHC), are saved along with the rest of the system data permanently, to avoid constantly recalculating a system's position in GHC each time the map is opened.

#### Multilateration Algorithm: A Two-Phase Approach
Finding a star's location from noisy distance data over vast scales is subject to Geometric Dilution of Precision (GDOP). If the system relies purely on an iterative solver without a good starting point, the mathematical gradient can flatline, causing the calculation to stall and place the star thousands of lightyears away from its true location. To ensure perfect placement, the engine uses a robust two-phase multilateration pipeline:

#### Phase 1: Bancroft Method (Linear Approximation)
The Bancroft method bypasses the need for an initial coordinate guess entirely. Instead of dealing with the complex geometry of intersecting spheres, it transforms the non-linear quadratic equations into a system of linear equations.

By subtracting the equation of the first anchor sphere from the remaining anchor spheres, the non-linear quadratic terms cancel out. This leaves a rigid linear algebra problem that can be written as a matrix ($A\mathbf{x} = \mathbf{b}$). The matrix $A$ contains the coordinate differences between anchors, and the vector $\mathbf{b}$ contains the constants derived from the known distances.

Using the Moore-Penrose pseudo-inverse ($\mathbf{x} = (A^T A)^{-1} A^T \mathbf{b}$), the engine instantly solves the matrix. This calculates the exact mathematical center of the sphere intersections without crashing or producing imaginary numbers, effectively absorbing the measurement noise.

#### Phase 2: Non-Linear Least Squares Optimization
While the Bancroft method provides an excellent mathematical baseline, floating-point precision loss and game-engine distance rounding require a final polish. The coordinate generated by the Bancroft matrix is passed as the initial guess into a non-linear optimizer.

The system defines an error function $E(x, y, z)$ that represents the difference between the user-provided distances and the mathematical distances from the guessed coordinate to each anchor. For a target star at $(x,y,z)$ and $N$ anchors at $(x_i, y_i, z_i)$ with measured distances $r_i$, the error function is:

$$E(x,y,z) = \sum_{i=1}^{N} \left( \sqrt{(x - x_i)^2 + (y - y_i)^2 + (z - z_i)^2} - r_i \right)^2$$

An algorithmic solver iteratively adjusts the coordinates to minimize $E(x,y,z)$. Because the Bancroft method placed the initial guess exactly at the bottom of the "error valley," this algorithm only takes a few rapid iterations to fine-tune the final decimal places, returning the mathematically most probable location for the star.

### 2. Database Architecture
The backend utilizes a SQLite database stored on a local Raspberry Pi. This ensures that the application remains lightweight while permanently retaining user-submitted data across server deployments.

#### Schema Design
The database utilizes a single-table architecture to store a system's data.

**SQL**

SQL

```
CREATE TABLE systems (
  id TEXT PRIMARY KEY,
  name TEXT,
  anchors TEXT,
  ghc_x REAL,
  ghc_y REAL,
  ghc_z REAL,
  color TEXT,
  is_anchor INTEGER,
  anchor_id TEXT,
  confidence REAL,
  wiki_data TEXT,
  galaxy TEXT DEFAULT 'calypso'
)
```

|**Key**|**Meaning**|
|---|---|
|**id**|The Hubtag of the system|
|**name**|The name of the system as seen in-game, minus the hubtag (if there is one...if not, add one!)|
|**anchors**|JSON object containing the system's distance from each anchor (e.x. `{"A": 0, "B": 0, "C": 0, "D": 0, "E": 0}`)|
|**ghc_x**|x-coordinate in Galactic Hubspace Coordinates|
|**ghc_y**|y-coordinate in Galactic Hubspace Coordinates|
|**ghc_z**|z-coordinate in Galactic Hubspace Coordinates|
|**color**|The color of the star system (yellow, blue, red, green, purple - no capitalization)|
|**is_anchor**|Is the system an anchor? Always false|
|**anchor_id**|Empty for mapped systems|
|**confidence**|Used internally, can be left as 0|
|**wiki_data**| Filled out during scheduled wiki fetches - holds all needed wiki data about the system |
|**galaxy**|Name of the galaxy the system is in. "calypso" and "euclid" are currently the only valid options|

When a system on the map is clicked on, the map will check if the system has an article on the Miraheze wiki, and if so, display more information. This feature is the biggest use for the map and is the reason I set out to build it in the first place.

### 3. Client-Server Data Flow

The application separates the computational workload between the client and the server to maintain maximum performance.

1. **Initialization:** Upon loading, the Three.js frontend requests the complete dataset for the active galaxy from the Express backend.
2. **Local Coordinate Assembly:** The frontend isolates the anchor stars and builds a pairwise distance matrix to establish a local, mathematically rigid coordinate plane.
3. **Coordinate Processing:** The client loops through all unmapped systems, parsing their JSON distance payloads, and passes them through the multilateration solver (Bancroft + Least Squares).
4. **Telemetry Sync:** When a new star is successfully mapped, the client permanently updates the backend database with the new Cartesian coordinates via a background fetch request, ensuring the math is only ever executed once per star.
