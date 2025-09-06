import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import AnalysisBoard from '../AnalysisBoard'

// Mock react-chessboard since it's complex to test
vi.mock('react-chessboard', () => ({
  Chessboard: ({ position, onPieceDrop }) => (
    <div data-testid="chessboard" data-position={position}>
      Mock Chessboard
    </div>
  ),
}))

describe('AnalysisBoard', () => {
  const mockOnPgnChange = vi.fn()
  const mockOnError = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Basic Rendering', () => {
    it('renders with default props', () => {
      render(<AnalysisBoard />)
      expect(screen.getByTestId('chessboard')).toBeInTheDocument()
      expect(screen.getByText('Live PGN')).toBeInTheDocument()
    })

    it('hides PGN box when enablePgnBox is false', () => {
      render(<AnalysisBoard enablePgnBox={false} />)
      expect(screen.queryByText('Live PGN')).not.toBeInTheDocument()
    })

    it('hides FEN input when enableFenInput is false', () => {
      render(<AnalysisBoard enableFenInput={false} />)
      // FEN input is hidden by default, but shift+F should not work
      expect(screen.queryByText('Starting Position (FEN)')).not.toBeInTheDocument()
    })
  })

  describe('Starting FEN Prop', () => {
    it('starts from custom FEN position', async () => {
      const customFen = 'rnbqkb1r/pp2pppp/2p2n2/3p4/3P1B2/2N5/PPP1PPPP/R2QKBNR w KQkq - 0 1'
      render(<AnalysisBoard startingFen={customFen} onPgnChange={mockOnPgnChange} />)
      
      await waitFor(() => {
        expect(screen.getByTestId('chessboard')).toHaveAttribute('data-position', customFen)
      })
    })

    it('includes FEN header in generated PGN when starting from custom position', async () => {
      const customFen = 'rnbqkb1r/pp2pppp/2p2n2/3p4/3P1B2/2N5/PPP1PPPP/R2QKBNR w KQkq - 0 1'
      render(<AnalysisBoard startingFen={customFen} onPgnChange={mockOnPgnChange} />)
      
      await waitFor(() => {
        expect(mockOnPgnChange).toHaveBeenCalledWith(
          expect.stringContaining(`[FEN "${customFen}"]`)
        )
      })
    })
  })

  describe('Starting PGN Prop', () => {
    it('loads PGN without FEN header (standard starting position)', async () => {
      const pgn = '1. e4 e5 2. Nf3 Nc6 *'
      render(<AnalysisBoard startingPgn={pgn} onPgnChange={mockOnPgnChange} />)
      
      await waitFor(() => {
        // Should start from standard position
        expect(screen.getByTestId('chessboard')).toHaveAttribute(
          'data-position', 
          'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1'
        )
      })
    })

    it('loads PGN with FEN header', async () => {
      const customFen = 'rnbqkb1r/pp2pppp/2p2n2/3p4/3P1B2/2N5/PPP1PPPP/R2QKBNR w KQkq - 0 1'
      const pgn = `[FEN "${customFen}"]\n\n1. e3 e6 2. Nf3 Na6 *`
      render(<AnalysisBoard startingPgn={pgn} onPgnChange={mockOnPgnChange} />)
      
      await waitFor(() => {
        // Should start from the custom FEN and apply moves
        expect(screen.getByTestId('chessboard')).toHaveAttribute(
          'data-position', 
          expect.stringContaining('w') // After moves are applied
        )
      })
    })

    it('loads PGN with comments and variations', async () => {
      const pgn = '1. e4 e5 2. Nf3 {A good move} 2... Nc6 (2... d6 {Alternative}) 3. Bb5 *'
      render(<AnalysisBoard startingPgn={pgn} />)
      
      await waitFor(() => {
        expect(screen.getByText('A good move')).toBeInTheDocument()
        expect(screen.getByText('Alternative')).toBeInTheDocument()
      })
    })
  })

  describe('FEN and PGN Prop Combinations', () => {
    it('uses startingFen when PGN has no FEN header', async () => {
      const customFen = 'rnbqkb1r/pp2pppp/2p2n2/3p4/3P1B2/2N5/PPP1PPPP/R2QKBNR w KQkq - 0 1'
      const pgn = '1. e3 e6 2. Nf3 Na6 *'
      
      render(
        <AnalysisBoard 
          startingFen={customFen} 
          startingPgn={pgn} 
          onError={mockOnError}
        />
      )
      
      await waitFor(() => {
        // Should not report error
        expect(mockOnError).not.toHaveBeenCalled()
        // Should use the custom FEN and apply PGN moves
        expect(screen.getByTestId('chessboard')).toBeInTheDocument()
      })
    })

    it('reports conflict when startingFen conflicts with PGN FEN header', async () => {
      const fenProp = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
      const differentFen = 'rnbqkb1r/pp2pppp/2p2n2/3p4/3P1B2/2N5/PPP1PPPP/R2QKBNR w KQkq - 0 1'
      const pgn = `[FEN "${differentFen}"]\n\n1. e3 e6 *`
      
      render(
        <AnalysisBoard 
          startingFen={fenProp} 
          startingPgn={pgn} 
          onError={mockOnError}
        />
      )
      
      await waitFor(() => {
        expect(mockOnError).toHaveBeenCalledWith({
          type: 'fen_pgn_conflict',
          message: 'The startingFen prop conflicts with the FEN header in the PGN',
          details: {
            providedFen: fenProp,
            pgnFen: differentFen,
            pgn: pgn
          }
        })
      })
    })

    it('accepts matching startingFen and PGN FEN header', async () => {
      const customFen = 'rnbqkb1r/pp2pppp/2p2n2/3p4/3P1B2/2N5/PPP1PPPP/R2QKBNR w KQkq - 0 1'
      const pgn = `[FEN "${customFen}"]\n\n1. e3 e6 *`
      
      render(
        <AnalysisBoard 
          startingFen={customFen} 
          startingPgn={pgn} 
          onError={mockOnError}
        />
      )
      
      await waitFor(() => {
        // Should not report error
        expect(mockOnError).not.toHaveBeenCalled()
      })
    })
  })

  describe('Error Handling', () => {
    it('reports error for invalid PGN', async () => {
      const invalidPgn = '[FEN "invalid-fen"]\n\ninvalid moves'
      
      render(
        <AnalysisBoard 
          startingPgn={invalidPgn} 
          onError={mockOnError}
        />
      )
      
      await waitFor(() => {
        expect(mockOnError).toHaveBeenCalledWith(
          expect.objectContaining({
            type: expect.stringMatching(/invalid_fen_in_pgn|pgn_parse_error|invalid_pgn_moves/)
          })
        )
      })
    })

    it('reports error for illegal moves in PGN', async () => {
      const pgn = '1. e4 e5 2. Qh5 Nf6 3. Qxf7# *' // This is legal, let's use illegal move
      const illegalPgn = '1. e9 *' // Illegal move
      
      render(
        <AnalysisBoard 
          startingPgn={illegalPgn} 
          onError={mockOnError}
        />
      )
      
      await waitFor(() => {
        expect(mockOnError).toHaveBeenCalledWith(
          expect.objectContaining({
            type: expect.stringMatching(/invalid_pgn_moves|pgn_parse_error/)
          })
        )
      })
    })
  })

  describe('UI Interactions', () => {
    it('loads PGN via UI', async () => {
      const user = userEvent.setup()
      render(<AnalysisBoard />)
      
      const textarea = screen.getByDisplayValue('')
      const loadButton = screen.getByText('Load PGN')
      
      await user.type(textarea, '1. e4 e5 *')
      await user.click(loadButton)
      
      await waitFor(() => {
        expect(screen.getByText('e4')).toBeInTheDocument()
        expect(screen.getByText('e5')).toBeInTheDocument()
      })
    })

    it('shows FEN input when Shift+F is pressed', async () => {
      const user = userEvent.setup()
      render(<AnalysisBoard enableFenInput={true} />)
      
      await user.keyboard('{Shift>}f{/Shift}')
      
      await waitFor(() => {
        expect(screen.getByText('Starting Position (FEN)')).toBeInTheDocument()
      })
    })

    it('loads FEN via UI', async () => {
      const user = userEvent.setup()
      const customFen = 'rnbqkb1r/pp2pppp/2p2n2/3p4/3P1B2/2N5/PPP1PPPP/R2QKBNR w KQkq - 0 1'
      
      render(<AnalysisBoard enableFenInput={true} />)
      
      // Show FEN input
      await user.keyboard('{Shift>}f{/Shift}')
      
      await waitFor(() => {
        expect(screen.getByText('Starting Position (FEN)')).toBeInTheDocument()
      })
      
      const fenTextarea = screen.getByPlaceholderText(/Paste FEN notation here/)
      const loadFenButton = screen.getByText('Load FEN')
      
      await user.type(fenTextarea, customFen)
      await user.click(loadFenButton)
      
      await waitFor(() => {
        expect(screen.getByTestId('chessboard')).toHaveAttribute('data-position', customFen)
      })
    })
  })

  describe('Container Modes', () => {
    it('applies embedded mode classes', () => {
      render(<AnalysisBoard containerMode="embedded" />)
      const container = screen.getByTestId('chessboard').parentElement.parentElement.parentElement
      expect(container).toHaveClass('embedded-mode')
    })

    it('applies standalone mode classes by default', () => {
      render(<AnalysisBoard />)
      const container = screen.getByTestId('chessboard').parentElement.parentElement.parentElement
      expect(container).toHaveClass('standalone-mode')
    })
  })

  describe('PGN Change Callback', () => {
    it('calls onPgnChange when moves are made', async () => {
      render(<AnalysisBoard onPgnChange={mockOnPgnChange} />)
      
      await waitFor(() => {
        // Initial PGN should be called
        expect(mockOnPgnChange).toHaveBeenCalledWith(' *')
      })
    })

    it('includes FEN header in PGN when starting from custom position', async () => {
      const customFen = 'rnbqkb1r/pp2pppp/2p2n2/3p4/3P1B2/2N5/PPP1PPPP/R2QKBNR w KQkq - 0 1'
      render(<AnalysisBoard startingFen={customFen} onPgnChange={mockOnPgnChange} />)
      
      await waitFor(() => {
        expect(mockOnPgnChange).toHaveBeenCalledWith(
          expect.stringContaining(`[FEN "${customFen}"]`)
        )
      })
    })
  })
})
