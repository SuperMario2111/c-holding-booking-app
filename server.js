const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'db.json');

// --- Room Capacity Configuration ---
const roomCapacities = {
    "Main Stage":        { min: 10, max: 22 },
    "The Premiere Room": { min: 6,  max: 12 },
    "The Briefing Room": { min: 2,  max: 10 },
    "The Vision Hall":   { min: 2,  max: 10 },
    "Main Stage West":   { min: 8,  max: 15 },
    "The Lounge Room":   { min: 4,  max: 10 }
};

// Helper function to read from our JSON database
function readDb() {
  if (!fs.existsSync(DB_FILE)) {
    // Create the file with a default structure if it doesn't exist
    const defaultData = { users: {}, bookings: {} };
    fs.writeFileSync(DB_FILE, JSON.stringify(defaultData, null, 2));
    return defaultData;
  }
  const data = fs.readFileSync(DB_FILE, 'utf-8');
  return JSON.parse(data);
}

// Helper function to write to our JSON database
function writeDb(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// Middleware to parse JSON bodies and serve static files
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname)); // Serve HTML, CSS, etc.


// --- API Endpoints ---

// User Signup
app.post('/api/signup', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: 'Please fill in all fields.' });
  }

  const db = readDb();
  if (db.users[username]) {
    return res.status(400).json({ message: 'User already exists.' });
  }

  db.users[username] = password; // In a real app, hash the password!
  writeDb(db);

  res.status(201).json({ message: 'Sign up successful.' });
});

// User Login
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const db = readDb();

  if (db.users[username] && db.users[username] === password) {
    // In a real app, you'd use sessions or JWTs instead of this
    res.json({ message: 'Login successful.', username });
  } else {
    res.status(401).json({ message: 'Incorrect username or password.' });
  }
});

// Get Rooms (moved from frontend)
app.get('/api/rooms', (req, res) => {
    const rooms = {
        "New Cairo": [
          "Main Stage",
          "The Premiere Room",
          "The Briefing Room",
          "The Vision Hall"
        ],
        "Zayed": [
          "Main Stage West",
          "The Lounge Room"
        ]
    };
    const location = req.query.location;
    if (location && rooms[location]) {
        res.json(rooms[location]);
    } else {
        res.status(404).json({ message: 'Location not found' });
    }
});

// Get capacity for a specific room
app.get('/api/room-capacity', (req, res) => {
    const { roomName } = req.query;
    const capacity = roomCapacities[roomName];
    if (capacity) {
        res.json(capacity);
    } else {
        // No specific capacity found, don't send an error, just an empty object
        res.json({}); 
    }
});

// Get Bookings for a specific date/room
app.get('/api/bookings', (req, res) => {
  const { key } = req.query; // key is "location_room_date"
  if (!key) {
    return res.status(400).json({ message: 'Booking key is required.' });
  }
  const db = readDb();
  const roomBookings = db.bookings[key] || {};
  res.json(roomBookings);
});

// Create a new booking
app.post('/api/bookings', (req, res) => {
  const { key, roomName, hourLabel, details } = req.body;

  if (!key || !roomName || !hourLabel || !details) {
    return res.status(400).json({ message: 'Missing booking information.' });
  }
  
  // --- Capacity Validation ---
  const capacity = roomCapacities[roomName];
  if (capacity) {
      const numPersons = parseInt(details.persons, 10);
      if (numPersons < capacity.min || numPersons > capacity.max) {
          return res.status(400).json({ message: `Number of persons must be between ${capacity.min} and ${capacity.max} for this room.` });
      }
  }

  const db = readDb();
  db.bookings[key] = db.bookings[key] || {};

  if (db.bookings[key][hourLabel]) {
    return res.status(409).json({ message: 'Slot already booked!' });
  }

  db.bookings[key][hourLabel] = details;
  writeDb(db);
  res.status(201).json({ message: 'Booking successful.' });
});

// Update an existing booking
app.put('/api/bookings', (req, res) => {
    const { oldKey, oldHourLabel, newKey, newRoomName, newHourLabel, newDetails, username } = req.body;

    if (!oldKey || !oldHourLabel || !newKey || !newRoomName || !newHourLabel || !newDetails || !username) {
        return res.status(400).json({ message: 'Missing update information.' });
    }

    const db = readDb();
    const oldBooking = db.bookings[oldKey] && db.bookings[oldKey][oldHourLabel];

    // 1. Verify the user owns the original booking
    if (!oldBooking) {
        return res.status(404).json({ message: 'Original booking not found.' });
    }
    if (oldBooking.presenter !== username) {
        return res.status(403).json({ message: 'You can only edit your own bookings.' });
    }

    // 2. Validate new booking details (capacity)
    const capacity = roomCapacities[newRoomName];
    if (capacity) {
        const numPersons = parseInt(newDetails.persons, 10);
        if (numPersons < capacity.min || numPersons > capacity.max) {
            return res.status(400).json({ message: `Number of persons must be between ${capacity.min} and ${capacity.max} for this room.` });
        }
    }

    // 3. Check if the new slot is available (if it's different from the old one)
    const isSameSlot = oldKey === newKey && oldHourLabel === newHourLabel;
    if (!isSameSlot && db.bookings[newKey] && db.bookings[newKey][newHourLabel]) {
        return res.status(409).json({ message: 'The new time slot is already booked.' });
    }

    // 4. Perform the update: delete old, create new
    delete db.bookings[oldKey][oldHourLabel];
    if (Object.keys(db.bookings[oldKey]).length === 0) {
        delete db.bookings[oldKey];
    }
    db.bookings[newKey] = db.bookings[newKey] || {};
    db.bookings[newKey][newHourLabel] = newDetails;
    writeDb(db);
    res.json({ message: 'Booking updated successfully.' });
});

// Cancel a booking
app.delete('/api/bookings', (req, res) => {
    const { key, hourLabel, username } = req.body;

    if (!key || !hourLabel || !username) {
        return res.status(400).json({ message: 'Missing cancellation information.' });
    }

    const db = readDb();
    const booking = db.bookings[key] && db.bookings[key][hourLabel];

    if (!booking) {
        return res.status(404).json({ message: 'Booking not found.' });
    }

    if (booking.presenter !== username) {
        return res.status(403).json({ message: 'Only the user who booked this slot can cancel it.' });
    }

    delete db.bookings[key][hourLabel];
    writeDb(db);
    res.json({ message: 'Booking cancelled.' });
});

// Get all bookings for a specific user
app.get('/api/user-bookings', (req, res) => {
    const { username } = req.query;
    if (!username) {
        return res.status(400).json({ message: 'Username is required.' });
    }

    const db = readDb();
    const userBookings = [];

    // Iterate through all booking keys (e.g., "New Cairo_Main Stage_2024-10-27")
    for (const key in db.bookings) {
        const roomBookings = db.bookings[key];
        const [location, room, date] = key.split('_');

        // Iterate through the time slots for that day
        for (const hourLabel in roomBookings) {
            const bookingDetails = roomBookings[hourLabel];
            if (bookingDetails.presenter === username) {
                userBookings.push({
                    key, location, room, date, hourLabel,
                    details: bookingDetails
                });
            }
        }
    }

    // Sort bookings by date, soonest first
    userBookings.sort((a, b) => new Date(a.date) - new Date(b.date));
    res.json(userBookings);
});

// --- Start Server ---
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});