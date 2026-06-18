# MiraaTrans - Meru County Transport Logistics Platform

## Overview

MiraaTrans is a comprehensive web-based logistics platform designed for the transportation of miraa (khat) from Meru County, Kenya, to major markets across the country. The application implements VAM (Vogel's Approximation Method) optimization for transport cost modeling and provides real-time tracking, cost calculation, and AI-powered assistance for farmers and buyers.

## Project Components

### 1. Web Application (`index.html`)

A single-page application featuring:

- **Role-based Interface**: Toggle between Farmer and Buyer views with customized workflows
- **Shipment Ordering**: Form-based submission with VAM-optimized cost preview
- **Live Tracking**: Track shipments by ID with freshness visualization
- **Cost Calculator**: Interactive VAM cost matrix with route optimization
- **AI Assistant**: Chat-based interface for logistics inquiries (requires backend API)

### 2. VAM Verification Notebook (`miraa_vam_verification.ipynb`)

A Jupyter notebook that:

- Replicates the VAM procedure step-by-step
- Validates manual calculations from the group report
- Compares VAM results with linear programming optimal solution
- Confirms VAM optimality for this transportation problem

## Mathematical Foundation

### Transportation Problem

The platform solves a balanced transportation problem with:

- **3 Sources**: Maua, Laare, Kangeta (Meru County growing areas)
- **4 Destinations**: Isiolo, Kilifi, Eastleigh (Nairobi), Likoni (Mombasa)
- **Supply Total**: 6,000 kg
- **Demand Total**: 6,000 kg

### Cost Structure

Each route cost is composed of four components:
- Base distance cost
- Road type premium
- Vehicle type surcharge
- Freshness urgency adjustment

### VAM Optimization

Vogel's Approximation Method (VAM) is implemented to find near-optimal transportation schedules by:
1. Computing row and column penalties (difference between two smallest costs)
2. Allocating to the cell with the lowest cost in the highest-penalty row/column
3. Iterating until all supply and demand are satisfied

### Verification Methodology

The notebook validates VAM results by:
1. Implementing VAM in Python with full traceability
2. Solving the same problem with linear programming (PuLP)
3. Comparing allocations and total costs
4. Using dual variables (MODI method) to confirm optimality

## Technical Implementation

### Frontend Features

- **Responsive Design**: Works on desktop and mobile devices
- **Freshness Tracking**: Circular progress indicator showing remaining freshness window (48 hours)
- **Real-time Cost Updates**: Dynamic cost preview as form fields change
- **Shipment Management**: Store and display both demo and user-created shipments
- **Cost Matrix Visualization**: Interactive table with optimal route highlighting

### Cost Model

The VAM cost matrix is defined as:

```
            Isiolo  Kilifi  Eastleigh  Likoni
Maua          10      21        18       23
Laare         11      22        16       23
Kangeta       10      21        17       23
```

### API Integration (Optional)

The chat feature expects a backend endpoint at `/api/chat` that:
- Accepts conversation history
- Returns natural language responses
- Can provide cost calculations and route information

## Data Model

### Shipment Object

```javascript
{
  id: "MT-XXXX",
  src: 0-2,        // Source index
  dst: 0-3,        // Destination index
  qty: number,     // Quantity in kg
  harvestTime: timestamp,
  status: string,  // "In Transit", "Urgent", "Overdue", "Arrived"
  driver: string,
  plate: string,
  note: string
}
```

### Cost Configuration

```javascript
const COST = [
  [10, 21, 18, 23],  // Maua
  [11, 22, 16, 23],  // Laare
  [10, 21, 17, 23]   // Kangeta
];
```

## Key Findings

1. **VAM Optimality**: The VAM solution (KES 101,700) matches the LP optimal solution exactly
2. **Optimal Allocation**:
   - Maua → Isiolo: 1,500 kg, Kilifi: 1,500 kg, Likoni: 1,000 kg
   - Laare → Eastleigh: 1,800 kg
   - Kangeta → Isiolo: 1,000 kg, Eastleigh: 200 kg, Kilifi: 500 kg

3. **Cost Breakdown**:
   - Maua → Kilifi: KES 31,500 (1,500kg × 21)
   - Maua → Likoni: KES 23,000 (1,000kg × 23)
   - Laare → Eastleigh: KES 28,800 (1,800kg × 16)
   - Kangeta → Isiolo: KES 10,000 (1,000kg × 10)
   - Kangeta → Eastleigh: KES 3,400 (200kg × 17)

## Running the Application

1. **Web Interface**: Open `index.html` in any modern browser
2. **Verification**: Run the Jupyter notebook to validate VAM calculations
3. **Local Server** (for chat feature):
   ```bash
   python -m http.server 8000
   ```

## Dependencies

### Web Application
- None (vanilla JavaScript, HTML5, CSS3)

### Notebook
- numpy
- pandas
- pulp
- Python 3.6+

## Project Structure

```
miraatrans/
├── index.html                          # Main application
└── miraa_vam_verification.ipynb        # VAM validation and LP comparison
```

## Usage Scenarios

### For Farmers
1. Enter shipment details (source, destination, quantity, harvest time)
2. View VAM-optimized cost preview
3. Submit order and receive tracking ID
4. Monitor shipment status and freshness

### For Buyers
1. Place orders directly from growers
2. View same pricing model and route options
3. Track deliveries in real-time
4. Access AI assistant for logistics questions

## Future Enhancements

1. **Backend Integration**: Full API for shipment management and chat
2. **Database Storage**: Persistent shipment records
3. **Real-time GPS**: Live vehicle tracking
4. **Payment Integration**: Mobile money processing
5. **Multi-language Support**: Swahili and English interfaces

## License

This project is developed for academic purposes as part of the Masters in Data Science program at Strathmore Institute of Mathematical Sciences.

## Contributors

- Data Science Team, Strathmore University
- Group Report Authors (DSA 8302 Practical Exercise 2)



---

*MiraaTrans: Optimizing Kenya's miraa logistics through data-driven transportation planning.*