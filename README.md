# Chess Analysis Board React Component

A comprehensive chess analysis board built with React, featuring move navigation, variation support, PGN import/export, and customizable keyboard shortcuts.

## Features

### Core Chess Functionality
- **Interactive Chessboard**: Drag-and-drop piece movement with validation
- **Move Navigation**: Navigate through games with arrow keys or custom shortcuts
- **Variation Support**: Full support for chess variations and sub-variations
- **PGN Import/Export**: Load and save games in standard PGN format with comments and variations
- **Move Comments**: Add and edit comments for any move
- **Auto-scroll**: Selected moves automatically scroll into view

### User Interface
- **Modern Design**: Clean, professional interface similar to Lichess
- **Responsive Layout**: Adapts to different screen sizes
- **Variation Display**: Clear visual hierarchy for main lines and variations
- **Comment Integration**: Comments appear inline with proper spacing

### Customization
- **Board Flipping**: Toggle between white and black perspectives
- **Keyboard Shortcuts**: Fully customizable navigation keys
- **Settings Panel**: User-friendly settings interface (Cmd+, or Ctrl+,)

## Installation

```bash
npm install @mliebelt/pgn-parser chess.js react-chessboard use-immer
```

## Basic Usage

### Standalone Component

```jsx
import React from 'react';
import AnalysisBoard from './components/AnalysisBoard';

function App() {
  return (
    <div className="App">
      <AnalysisBoard />
    </div>
  );
}

export default App;
```

### Accessing Generated PGN

The component can notify your app whenever the PGN changes:

```jsx
import React, { useState } from 'react';
import AnalysisBoard from './components/AnalysisBoard';

function App() {
  const [currentPgn, setCurrentPgn] = useState('');

  // This runs on every change - just store it
  const handlePgnChange = (pgn) => {
    setCurrentPgn(pgn);
  };

  // This runs only when user clicks save
  const handleSaveStudy = async () => {
    await invoke('save_study', { pgn: currentPgn });
  };

  return (
    <div>
      <AnalysisBoard onPgnChange={handlePgnChange} />
      <button onClick={handleSaveStudy}>Save Study</button>
    </div>
  );
}
```

### Desktop App Integration (Tauri)

For desktop applications, you can hide the PGN box and handle saving externally:

```jsx
import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import AnalysisBoard from './components/AnalysisBoard';

function App() {
  const [currentPgn, setCurrentPgn] = useState('');

  const handlePgnChange = (newPgn) => {
    setCurrentPgn(newPgn);
  };

  const handleSaveStudy = async () => {
    try {
      await invoke('save_study', { pgn: currentPgn });
      console.log('Study saved successfully');
    } catch (error) {
      console.error('Failed to save study:', error);
    }
  };

  return (
    <div>
      <AnalysisBoard 
        enablePgnBox={false}  // Hide PGN box, handle saving externally
        onPgnChange={handlePgnChange} 
      />
      <button onClick={handleSaveStudy}>Save Study</button>
    </div>
  );
}
```

### With External Settings (Recommended for Apps)

```jsx
import React, { useState, useEffect } from 'react';
import AnalysisBoard from './components/AnalysisBoard';

function App() {
  const [appSettings, setAppSettings] = useState({
    keyboard: {
      flipBoard: 'f',
      previousMove: 'k',
      nextMove: 'j'
    }
  });
  
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  const handleSettingsChange = (newKeyboardSettings) => {
    setAppSettings({
      ...appSettings,
      keyboard: newKeyboardSettings
    });
    // Save to localStorage, database, etc.
    localStorage.setItem('chessSettings', JSON.stringify(appSettings));
  };

  return (
    <div className="App">
      <AnalysisBoard 
        externalSettings={appSettings.keyboard}
        onSettingsChange={handleSettingsChange}
        showExternalSettings={showSettingsModal}
        onToggleSettings={setShowSettingsModal}
      />
    </div>
  );
}
```

## Tauri Desktop App Integration

For desktop applications using Tauri, the component can be fully integrated with native menus and persistent settings.

### Frontend Integration

```jsx
// App.jsx
import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { listen } from '@tauri-apps/api/event';
import AnalysisBoard from './components/AnalysisBoard';

function App() {
  const [appSettings, setAppSettings] = useState({
    keyboard: {
      flipBoard: 'f',
      previousMove: 'k', 
      nextMove: 'j'
    }
  });
  
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Load settings from file when app starts
  useEffect(() => {
    loadSettings();
    setupMenuHandlers();
  }, []);

  const loadSettings = async () => {
    try {
      const savedSettings = await invoke('load_settings');
      if (savedSettings) {
        setAppSettings(savedSettings);
      }
    } catch (error) {
      console.log('No saved settings found, using defaults');
    }
  };

  const setupMenuHandlers = async () => {
    // Listen for menu events
    await listen('menu', (event) => {
      if (event.payload === 'settings') {
        setShowSettingsModal(true);
      }
    });
  };

  const handleAppSettingsChange = async (newKeyboardSettings) => {
    const updatedSettings = {
      ...appSettings,
      keyboard: newKeyboardSettings
    };
    
    setAppSettings(updatedSettings);
    
    // Save to file via Tauri
    try {
      await invoke('save_settings', { settings: updatedSettings });
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  };

  return (
    <div className="app">
      <AnalysisBoard 
        externalSettings={appSettings.keyboard}
        onSettingsChange={handleAppSettingsChange}
        showExternalSettings={showSettingsModal}
        onToggleSettings={setShowSettingsModal}
      />
    </div>
  );
}

export default App;
```

### Tauri Backend (Rust)

```rust
// src-tauri/src/main.rs
use tauri::Manager;
use serde::{Deserialize, Serialize};
use std::fs;

#[derive(Serialize, Deserialize)]
struct KeyboardSettings {
    #[serde(rename = "flipBoard")]
    flip_board: String,
    #[serde(rename = "previousMove")]
    previous_move: String,
    #[serde(rename = "nextMove")]
    next_move: String,
}

#[derive(Serialize, Deserialize)]
struct AppSettings {
    keyboard: KeyboardSettings,
}

#[tauri::command]
fn load_settings() -> Result<AppSettings, String> {
    let app_dir = tauri::api::path::app_data_dir(&tauri::Config::default())
        .ok_or("Failed to get app data directory")?;
    let settings_path = app_dir.join("settings.json");
    
    match fs::read_to_string(settings_path) {
        Ok(contents) => {
            serde_json::from_str(&contents)
                .map_err(|e| format!("Failed to parse settings: {}", e))
        }
        Err(_) => Err("Settings file not found".to_string())
    }
}

#[tauri::command]
fn save_settings(settings: AppSettings) -> Result<(), String> {
    let app_dir = tauri::api::path::app_data_dir(&tauri::Config::default())
        .ok_or("Failed to get app data directory")?;
    
    fs::create_dir_all(&app_dir)
        .map_err(|e| format!("Failed to create app directory: {}", e))?;
        
    let settings_path = app_dir.join("settings.json");
    
    let json = serde_json::to_string_pretty(&settings)
        .map_err(|e| format!("Failed to serialize settings: {}", e))?;
    
    fs::write(settings_path, json)
        .map_err(|e| format!("Failed to write settings: {}", e))
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![load_settings, save_settings])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

## API Reference

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `externalSettings` | `Object \| null` | `null` | External keyboard settings object |
| `onSettingsChange` | `Function \| null` | `null` | Callback when settings change |
| `showExternalSettings` | `boolean` | `false` | Whether to show settings modal externally |
| `onToggleSettings` | `Function \| null` | `null` | Callback to toggle settings modal |
| `startingFen` | `string \| null` | `null` | Custom starting position in FEN notation |
| `onPgnChange` | `Function \| null` | `null` | Callback when PGN changes (for external save functionality) |
| `enableFenInput` | `boolean` | `true` | Whether to enable FEN input functionality |
| `enablePgnBox` | `boolean` | `true` | Whether to show the PGN input/output box |
| `containerMode` | `string` | `'standalone'` | Layout mode: `'standalone'` (viewport-based) or `'embedded'` (container-relative) |

### Settings Object Structure

```javascript
{
  flipBoard: 'f',        // Key to flip board orientation
  previousMove: 'k',     // Key to go to previous move
  nextMove: 'j'          // Key to go to next move
}
```

## Container Modes

The component supports two layout modes for different integration scenarios:

### Standalone Mode (Default)

```jsx
<AnalysisBoard />
// or explicitly
<AnalysisBoard containerMode="standalone" />
```

- Uses viewport-based sizing (`vw`, `vh`)
- Designed for full-page applications
- Components size themselves relative to the browser window
- Best for dedicated chess analysis applications

### Embedded Mode

```jsx
<AnalysisBoard containerMode="embedded" />
```

- Uses container-relative sizing (`%`, `px`)
- Designed for integration into existing applications
- Components adapt to their container size
- Perfect for Tauri desktop apps, dashboards, or embedded widgets

**Key differences in embedded mode:**
- Board and moves panel are limited to reasonable max sizes
- Sections stack vertically on smaller screens
- No viewport units - works within any container
- Reduced padding and margins for compact layouts

**Example for Tauri integration:**
```jsx
<div style={{ width: '1200px', height: '800px' }}>
  <AnalysisBoard 
    containerMode="embedded"
    enablePgnBox={false}
    onPgnChange={handlePgnChange}
  />
</div>
```

### Default Keyboard Shortcuts

| Action | Default Key | Alternative | Description |
|--------|-------------|-------------|-------------|
| Next Move | `j` | `→` | Navigate to next move |
| Previous Move | `k` | `←` | Navigate to previous move |
| Jump to Start | `↑` | - | Jump to beginning of game |
| Jump to End | `↓` | - | Jump to end of main line |
| Flip Board | `f` | - | Toggle board orientation |
| Toggle FEN Input | `Shift+F` | - | Show/hide FEN input section |
| Open Settings | `Cmd+,` / `Ctrl+,` | - | Open settings panel |
| Close Settings | `Esc` | Click outside | Close settings panel |

### Customizable Settings

All keyboard shortcuts and UI behavior can be customized via the settings panel:

- **Access**: Press `Cmd+,` (or `Ctrl+,`) to open settings
- **Keyboard Shortcuts**: Change any keyboard shortcut to your preference
- **Board Orientation**: View current board orientation
- **Auto-scroll**: Toggle automatic scrolling to keep selected move in view (default: enabled)
- **Close**: Press `Esc` or click outside to close

## UI Component Control

The component supports selective enabling/disabling of UI sections for different use cases:

### Disabling FEN Input

```jsx
// Completely disable FEN input functionality
<AnalysisBoard enableFenInput={false} />
```

When `enableFenInput={false}`:
- The FEN input section never appears
- The "Toggle FEN Input" option is removed from settings
- The Shift+F keyboard shortcut is disabled
- Users cannot change the starting position via the UI

### Disabling PGN Box

```jsx
// Hide the PGN input/output box entirely
<AnalysisBoard enablePgnBox={false} />
```

When `enablePgnBox={false}`:
- The entire PGN box is hidden (no textarea, copy button, or load button)
- PGN generation still works internally for `onPgnChange` callback
- Perfect for desktop apps that handle PGN saving externally

### Combined Usage

```jsx
// For embedded use cases - minimal UI with external PGN handling
<AnalysisBoard 
  enableFenInput={false}
  enablePgnBox={false}
  onPgnChange={handlePgnUpdate}  // Just tracking changes
  startingFen="rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1"
/>
```

## FEN Support

The component supports custom starting positions via FEN (Forsyth-Edwards Notation):

### User Interface (when enabled)t 
- **Toggle Display**: Press `Shift+F` (or customize in settings) to show/hide the FEN input section
- **FEN Input**: Paste FEN notation to set custom starting positions
- **Validation**: Invalid FEN strings are rejected with user feedback
- **Optional Display**: The FEN input section is hidden by default to keep the UI clean

### Programmatic Control

```jsx
// Set a custom starting position programmatically
<AnalysisBoard 
  startingFen="rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1"
/>

// Example: King and Pawn endgame
<AnalysisBoard 
  startingFen="8/8/8/8/8/8/4K1k1/8 w - - 0 1"
/>
```

## PGN Support

The component supports full PGN import and export with:
- **Move annotations**: Comments, NAGs
- **Variations**: Nested variations and sub-variations  
- **Headers**: Standard PGN headers
- **Live updates**: PGN updates as you play/navigate
- **Custom starting positions**: PGNs work with any starting FEN

### Example PGN with Variations

```pgn
1. e4 e5 2. Nf3 Nc6 3. Bb5 {The Spanish Opening} a6 
(3... f5 {The Schliemann Defense} 4. Nc3 fxe4 5. Nxe4) 
4. Ba4 Nf6 5. O-O Be7 *
```

## Styling

The component uses CSS classes that can be customized:

```css
/* Main container */
.analysis-board-container { }

/* Chessboard area */
.analysis-board { }

/* Moves panel */
.move-history { }

/* Individual moves */
.move { }
.selected-move { }

/* Variations */
.variation-line { }
.variation-row { }

/* Comments */
.comment { }
.inline-comment { }

/* Settings modal */
.settings-overlay { }
.settings-modal { }
```

## Dependencies

- `react` (^19.1.0)
- `chess.js` (^1.4.0) - Chess game logic and validation
- `react-chessboard` (^4.7.3) - Interactive chessboard component
- `use-immer` (^0.11.0) - Immutable state management
- `@mliebelt/pgn-parser` - PGN parsing for variations and comments

## Browser Compatibility

- Chrome/Edge 88+
- Firefox 85+
- Safari 14+

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details.
