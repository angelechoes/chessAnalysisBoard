import './App.css'
import AnalysisBoard from './components/AnalysisBoard'

function App() {
  return (
    <div className="App">
      <AnalysisBoard
        startingFen="rnbqkbnr/pppppppp/8/8/8/7N/PPPPPPPP/RNBQKB1R w KQkq - 0 1"
        startingPgn={`1. e4 e5 2. Nf3 Nc6 3. Bb5 {The Spanish Opening} a6 
(3... f5 {The Schliemann Defense} 4. Nc3 fxe4 5. Nxe4) 
4. Ba4 Nf6 5. O-O Be7 *`}
        />
    </div>
  )
}

export default App 