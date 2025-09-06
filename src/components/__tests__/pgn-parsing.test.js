import { describe, it, expect } from 'vitest'
import { parse } from '@mliebelt/pgn-parser'
import { Chess } from 'chess.js'

describe('PGN Parsing Logic', () => {
  describe('Standard PGN without FEN header', () => {
    it('parses simple PGN correctly', () => {
      const pgn = '1. e4 e5 2. Nf3 Nc6 *'
      const result = parse(pgn, { startRule: 'game' })
      
      expect(result).toBeTruthy()
      expect(result.moves).toHaveLength(4)
      expect(result.moves[0].notation.notation).toBe('e4')
      expect(result.moves[1].notation.notation).toBe('e5')
      expect(result.tags).toBeTruthy()
      expect(result.tags.FEN).toBeUndefined()
    })

    it('parses PGN with comments', () => {
      const pgn = '1. e4 {Good opening move} 1... e5 2. Nf3 *'
      const result = parse(pgn, { startRule: 'game' })
      
      expect(result.moves[0].commentAfter).toBe(' Good opening move ')
    })

    it('parses PGN with variations', () => {
      const pgn = '1. e4 e5 (1... c5 {Sicilian Defense}) 2. Nf3 *'
      const result = parse(pgn, { startRule: 'game' })
      
      expect(result.moves[1].variations).toHaveLength(1)
      expect(result.moves[1].variations[0][0].notation.notation).toBe('c5')
    })
  })

  describe('PGN with FEN header', () => {
    it('extracts FEN from tags', () => {
      const customFen = 'rnbqkb1r/pp2pppp/2p2n2/3p4/3P1B2/2N5/PPP1PPPP/R2QKBNR w KQkq - 0 1'
      const pgn = `[FEN "${customFen}"]\n\n1. e3 e6 *`
      const result = parse(pgn, { startRule: 'game' })
      
      expect(result.tags.FEN).toBe(customFen)
      expect(result.moves[0].notation.notation).toBe('e3')
    })

    it('handles multiple headers including FEN', () => {
      const customFen = 'rnbqkb1r/pp2pppp/2p2n2/3p4/3P1B2/2N5/PPP1PPPP/R2QKBNR w KQkq - 0 1'
      const pgn = `[Event "Test Game"]
[FEN "${customFen}"]
[SetUp "1"]

1. e3 e6 *`
      const result = parse(pgn, { startRule: 'game' })
      
      expect(result.tags.FEN).toBe(customFen)
      expect(result.tags.Event).toBe('Test Game')
      expect(result.tags.SetUp).toBe('1')
    })
  })

  describe('Move Validation', () => {
    it('validates legal moves from standard position', () => {
      const game = new Chess()
      expect(() => game.move('e4')).not.toThrow()
      expect(() => game.move('e5')).not.toThrow()
    })

    it('validates legal moves from custom FEN', () => {
      const customFen = 'rnbqkb1r/pp2pppp/2p2n2/3p4/3P1B2/2N5/PPP1PPPP/R2QKBNR w KQkq - 0 1'
      const game = new Chess(customFen)
      expect(() => game.move('e3')).not.toThrow()
    })

    it('rejects illegal moves', () => {
      const game = new Chess()
      expect(() => game.move('e9')).toThrow()
    })

    it('rejects moves that don\'t match starting position', () => {
      const standardFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
      const game = new Chess(standardFen)
      // This move would be legal from a different position but not from standard
      expect(() => game.move('Nxe5')).toThrow()
    })
  })

  describe('FEN Validation', () => {
    it('accepts valid FEN strings', () => {
      const validFens = [
        'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', // Standard
        'rnbqkb1r/pp2pppp/2p2n2/3p4/3P1B2/2N5/PPP1PPPP/R2QKBNR w KQkq - 0 1', // Custom
        '8/8/8/8/8/8/4K1k1/8 w - - 0 1', // King and pawn endgame
      ]
      
      validFens.forEach(fen => {
        expect(() => new Chess(fen)).not.toThrow()
      })
    })

    it('rejects invalid FEN strings', () => {
      const invalidFens = [
        'invalid-fen',
        'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR', // Missing parts
        '9nbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', // Invalid piece
      ]
      
      invalidFens.forEach(fen => {
        expect(() => new Chess(fen)).toThrow()
      })
    })
  })

  describe('Complex PGN Scenarios', () => {
    it('handles nested variations', () => {
      const pgn = `1. e4 e5 2. Nf3 Nc6 (2... d6 3. d4 (3. Bc4 Be7) 3... exd4) 3. Bb5 *`
      const result = parse(pgn, { startRule: 'game' })
      
      expect(result.moves[3].variations).toHaveLength(1) // Main variation
      expect(result.moves[3].variations[0][1].variations).toHaveLength(1) // Nested variation
    })

    it('handles PGN with multiple comments', () => {
      const pgn = `1. e4 {Best by test} 1... e5 {Classical response} 2. Nf3 {Developing} *`
      const result = parse(pgn, { startRule: 'game' })
      
      expect(result.moves[0].commentAfter).toContain('Best by test')
      expect(result.moves[1].commentAfter).toContain('Classical response')
      expect(result.moves[2].commentAfter).toContain('Developing')
    })

    it('handles empty PGN', () => {
      const result = parse('', { startRule: 'game' })
      expect(result).toBeFalsy()
    })

    it('handles PGN with only headers', () => {
      const pgn = `[Event "Test"]
[Site "Online"]`
      const result = parse(pgn, { startRule: 'game' })
      
      // Should have tags but no moves
      expect(result.tags.Event).toBe('Test')
      expect(result.moves).toHaveLength(0)
    })
  })
})
