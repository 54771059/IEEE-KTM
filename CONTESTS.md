# Contest Management

This document explains how to manage contests in the IEEE-KTM Monkeytype fork.

## How Contest Mode Works

1. **Database-Driven**: Contests are stored in the `contests` MongoDB collection
2. **Time-Based Activation**: Contests are only active between their `startTime` and `endTime` (if specified). In all cases isActive must be true to enable the contest. Consider it an "emergency off-switch"
3. **Configuration**: Contest feature must be enabled in backend configuration (`contests.enabled: true`)
4. **English Only**: All contests are fixed to English language
5. **Unlimited Attempts**: No limit on the number of attempts per user

## Contest Document Structure

```javascript
{
  "_id": ObjectId,
  "name": "Contest Name",           // Required
  "description": "Contest description", // Optional
  "startTime": 1642694400000,      // Optional Unix timestamp (isActive must still be true)
  "endTime": 1643299200000,        // Optional Unix timestamp (isActive must still be true)
  "isActive": true                 // Required boolean - manual toggle (if not true, the competition will not be available)
  "options":{                      // Required options for contest, manually set for each contest as user cannot modify them
    mode:"time"
    mode2:"60"
    punctuation:false
    numbers:false
  }
}
```

## Creating a Contest

### Option 1: Using the Admin Panel (Recommended)

Access the admin panel at `/admin` (requires authentication) to:
- Create new contests with a user-friendly interface
- Edit existing contests with form validation
- Set unlimited participants or specify a maximum number
- View contest statistics and participant data
- Manage contest status and timing

The admin panel provides:
- **Contest Management**: Full CRUD operations with intuitive forms
- **Participant Limits**: Toggle between limited and unlimited participants
- **Statistics Dashboard**: View overall and contest-specific analytics
- **Search & Filter**: Find contests by name, description, or status
- **Real-time Validation**: Prevent invalid configurations and conflicts

### Option 2: Using the Sample Script

```bash
cd backend
npx ts-node scripts/create-sample-contest.ts
```

### Option 3: Manual MongoDB Insert

```javascript
db.contests.insertOne({
  name: "Your Contest Name",
  description: "Your contest description", // Optional
  startTime: Date.now(),                   // Optional - start now
  endTime: Date.now() + (7 * 24 * 60 * 60 * 1000), // Optional - end in 1 week
  isActive: true
    "options":{                      // 60 second test, unpunctuated with no numbers
    mode:"time"
    mode2:"60"
    punctuation:false
    numbers:false
  }
});
```

### Option 4: Simple Always-Active Contest

```javascript
db.contests.insertOne({
  name: "Always Active Contest",
  description: "This contest runs indefinitely",
  isActive: true
  // No startTime/endTime = always active when isActive is true
});
```

## Admin Panel Features

The admin panel (`/admin`) provides a comprehensive interface for contest management:

### Contest Management Tab
- **Create/Edit Contests**: User-friendly forms with validation
- **Search & Filter**: Find contests by name, description, or status
- **Status Management**: View and manage contest active states
- **Bulk Operations**: Efficient management of multiple contests

### Participants Tab
- **View Participants**: See all registered participants per contest
- **Filter by Contest**: Focus on specific contest participants
- **Participant Details**: Access WPM, accuracy, and ranking data

### Leaderboard Tab
- **Real-time Rankings**: View current contest standings
- **Export Functionality**: Download leaderboard data
- **Contest Selection**: Switch between different contest leaderboards

### Statistics Tab
- **Overall Analytics**: Platform-wide statistics and metrics
- **Contest-specific Stats**: Detailed analytics per contest
- **Performance Metrics**: Average WPM, accuracy, participation rates
- **Visual Dashboard**: Interactive charts and data visualization

### Key Features
- **Unlimited Participants**: Toggle between limited and unlimited participant modes
- **Form Validation**: Prevent invalid configurations and timing conflicts
- **Real-time Updates**: Live data refresh and instant feedback
- **Responsive Design**: Works on desktop and mobile devices
- **Error Handling**: Comprehensive validation and error messaging

## Contest Activation Logic

A contest is considered active when:
1. `contests.enabled` is `true` in backend configuration
2. `isActive` field is `true`
3. **AND** one of the following time conditions:
   - Both `startTime` and `endTime` are set and current time is between them
   - Only `startTime` is set and current time is after it
   - Only `endTime` is set and current time is before it
   - Neither `startTime` nor `endTime` are set (always active)

## Simplified Features

- **Language**: Fixed to English (no language field needed)
- **Mode**: Any typing mode is allowed (time, words, quote, etc.)
- **Attempts**: Unlimited (no maxAttempts field)
- **Regions**: Global (no region restrictions)

## Frontend Integration

The frontend automatically:
- Fetches active contest via `/contests/active` API
- Shows/hides contest mode based on active contests
- Displays contest information and leaderboards
- Submits results to contest when in contest mode
- Works with any typing test mode/settings

## API Endpoints

- `GET /contests/active` - Get currently active contest
- `POST /contests/results` - Submit contest result
- `GET /contests/:contestId/leaderboard` - Get contest leaderboard
- `GET /contests/:contestId/users/:uid/results` - Get user's contest results

## Testing Contest Mode

1. Ensure MongoDB is running
2. Run the sample contest script to create a test contest
3. Start the backend and frontend
4. Click the trophy icon (🏆) in the header
5. Select the active contest
6. View results on the contests leaderboard (Yet unimplemented)

## Managing Multiple Contests

Only one contest can be active at a time. To switch contests:
1. Set current contest `isActive: false`
2. Set new contest `isActive: true`
3. Ensure the new contest's time range is valid (if using time restrictions)

## Contest Results

Results are stored in the `contest` document in the `results` object:
- Each set of user attempts, an array indexed by user UID
- Full typing test results (WPM, accuracy, etc.)
- Attempt number for tracking multiple submissions
- Timestamp for submission tracking

You can read the results of the active contest on the /contests page. The leaderboard on that page is placeholder until we have completed the UI/UX for such a feature.
