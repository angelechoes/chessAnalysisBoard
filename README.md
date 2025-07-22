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

### Settings Object Structure

```javascript
{
  flipBoard: 'f',        // Key to flip board orientation
  previousMove: 'k',     // Key to go to previous move
  nextMove: 'j'          // Key to go to next move
}
```

### Default Keyboard Shortcuts

| Action | Default Key | Alternative | Description |
|--------|-------------|-------------|-------------|
| Previous Move | `k` | `←` | Navigate to previous move |
| Next Move | `j` | `→` | Navigate to next move |
| Flip Board | `f` | - | Toggle board orientation |
| Open Settings | `Cmd+,` / `Ctrl+,` | - | Open settings panel |
| Close Settings | `Esc` | Click outside | Close settings panel |

## PGN Support

The component supports full PGN import and export with:
- **Move annotations**: Comments, NAGs
- **Variations**: Nested variations and sub-variations  
- **Headers**: Standard PGN headers
- **Live updates**: PGN updates as you play/navigate

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
